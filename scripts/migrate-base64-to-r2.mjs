/**
 * Backfill: migra documentos guardados como data:URL base64 dentro de
 * CleaningOnboarding (y Message.imageUrl) a Cloudflare R2.
 *
 * Uso:
 *   node scripts/migrate-base64-to-r2.mjs           # dry-run, no escribe
 *   node scripts/migrate-base64-to-r2.mjs --apply   # ejecuta y persiste
 *
 * Idempotente: filas que ya contienen una key de storage o una URL https
 * son ignoradas. Una segunda corrida sin cambios no hace nada.
 *
 * Requiere las mismas env vars que el módulo lib/storage/r2.ts:
 *   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET, DATABASE_URL
 */
import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const APPLY = process.argv.includes("--apply");

const ONBOARDING_COLUMNS = [
  { column: "profilePhotoUrl", kind: "profile_photo" },
  { column: "identityDocumentFile", kind: "identity_front" },
  { column: "identityDocumentFrontFile", kind: "identity_front" },
  { column: "identityDocumentBackFile", kind: "identity_back" },
  { column: "identitySelfieFile", kind: "identity_selfie" },
  { column: "criminalRecordFile", kind: "criminal_record" }
];

const EXTENSION_BY_CONTENT_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf"
};

function isDataUrl(value) {
  return typeof value === "string" && value.startsWith("data:");
}

function isStorageKey(value) {
  return typeof value === "string" && /^users\//.test(value);
}

function parseDataUrl(value) {
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const contentType = match[1];
  const bytes = Buffer.from(match[2], "base64");
  return { contentType, bytes, sizeBytes: bytes.length };
}

function generateKey(userId, kind, contentType) {
  const ext = EXTENSION_BY_CONTENT_TYPE[contentType] ?? "bin";
  return `users/${userId}/${kind}/${randomUUID()}.${ext}`;
}

function makeClient() {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT;
  const bucket = process.env.R2_BUCKET;
  if (!accessKeyId || !secretAccessKey || !endpoint || !bucket) {
    throw new Error("Missing R2_* env vars (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET)");
  }
  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true
  });
  return { client, bucket };
}

async function uploadToR2(client, bucket, key, contentType, bytes) {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: bytes,
      ContentType: contentType
    })
  );
}

async function migrateOnboarding(prisma, storage) {
  const onboardings = await prisma.cleaningOnboarding.findMany({
    select: {
      id: true,
      userId: true,
      profilePhotoUrl: true,
      identityDocumentFile: true,
      identityDocumentFrontFile: true,
      identityDocumentBackFile: true,
      identitySelfieFile: true,
      criminalRecordFile: true
    }
  });

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of onboardings) {
    const updates = {};
    for (const { column, kind } of ONBOARDING_COLUMNS) {
      const value = row[column];
      if (!value) continue;
      if (isStorageKey(value) || (!isDataUrl(value) && /^https?:\/\//i.test(value))) {
        skipped += 1;
        continue;
      }
      if (!isDataUrl(value)) {
        skipped += 1;
        continue;
      }
      const parsed = parseDataUrl(value);
      if (!parsed) {
        console.warn(`[skip] onboarding ${row.id}/${column} no parseable`);
        failed += 1;
        continue;
      }
      const key = generateKey(row.userId, kind, parsed.contentType);
      if (APPLY) {
        try {
          await uploadToR2(storage.client, storage.bucket, key, parsed.contentType, parsed.bytes);
          updates[column] = key;
          console.log(`[ok]  onboarding ${row.id}/${column} → ${key} (${parsed.sizeBytes} bytes)`);
          migrated += 1;
        } catch (err) {
          console.error(`[err] onboarding ${row.id}/${column}`, err?.message ?? err);
          failed += 1;
        }
      } else {
        console.log(`[dry] onboarding ${row.id}/${column} → ${key} (${parsed.sizeBytes} bytes)`);
        migrated += 1;
      }
    }

    if (APPLY && Object.keys(updates).length > 0) {
      await prisma.cleaningOnboarding.update({ where: { id: row.id }, data: updates });
    }
  }

  return { migrated, skipped, failed };
}

async function migrateMessages(prisma, storage) {
  const messages = await prisma.message.findMany({
    where: { imageUrl: { not: null } },
    select: { id: true, imageUrl: true, senderId: true }
  });

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const msg of messages) {
    if (!msg.imageUrl) {
      skipped += 1;
      continue;
    }
    if (isStorageKey(msg.imageUrl) || /^https?:\/\//i.test(msg.imageUrl)) {
      skipped += 1;
      continue;
    }
    if (!isDataUrl(msg.imageUrl)) {
      skipped += 1;
      continue;
    }
    const parsed = parseDataUrl(msg.imageUrl);
    if (!parsed) {
      failed += 1;
      continue;
    }
    const key = generateKey(msg.senderId, "chat_image", parsed.contentType);
    if (APPLY) {
      try {
        await uploadToR2(storage.client, storage.bucket, key, parsed.contentType, parsed.bytes);
        await prisma.message.update({ where: { id: msg.id }, data: { imageUrl: key } });
        console.log(`[ok]  message ${msg.id} → ${key} (${parsed.sizeBytes} bytes)`);
        migrated += 1;
      } catch (err) {
        console.error(`[err] message ${msg.id}`, err?.message ?? err);
        failed += 1;
      }
    } else {
      console.log(`[dry] message ${msg.id} → ${key} (${parsed.sizeBytes} bytes)`);
      migrated += 1;
    }
  }

  return { migrated, skipped, failed };
}

async function main() {
  console.log(`Running base64 → R2 backfill (${APPLY ? "APPLY MODE" : "DRY-RUN"})`);
  const prisma = new PrismaClient();
  try {
    const storage = APPLY ? makeClient() : { client: null, bucket: null };

    console.log("\n--- CleaningOnboarding ---");
    const onboardingStats = await migrateOnboarding(prisma, storage);
    console.log("\n--- Message ---");
    const messageStats = await migrateMessages(prisma, storage);

    console.log("\n--- Summary ---");
    console.log(JSON.stringify({ onboarding: onboardingStats, messages: messageStats }, null, 2));
    if (!APPLY) {
      console.log("\nDry-run completo. Volve a correr con `--apply` para escribir cambios.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Backfill abortado:", err);
  process.exit(1);
});
