import { randomUUID } from "crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const STORAGE_KINDS = [
  "identity_front",
  "identity_back",
  "identity_selfie",
  "criminal_record",
  "profile_photo",
  "chat_image",
  "dispute_evidence",
  "check_in_photo"
] as const;

export type StorageKind = (typeof STORAGE_KINDS)[number];

export const STORAGE_LIMITS: Record<StorageKind, { maxBytes: number; allowedContentTypes: string[] }> = {
  identity_front: {
    maxBytes: 8 * 1024 * 1024,
    allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"]
  },
  identity_back: {
    maxBytes: 8 * 1024 * 1024,
    allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"]
  },
  identity_selfie: {
    maxBytes: 6 * 1024 * 1024,
    allowedContentTypes: ["image/jpeg", "image/png", "image/webp"]
  },
  criminal_record: {
    maxBytes: 8 * 1024 * 1024,
    allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"]
  },
  profile_photo: {
    maxBytes: 4 * 1024 * 1024,
    allowedContentTypes: ["image/jpeg", "image/png", "image/webp"]
  },
  chat_image: {
    maxBytes: 5 * 1024 * 1024,
    allowedContentTypes: ["image/jpeg", "image/png", "image/webp"]
  },
  dispute_evidence: {
    maxBytes: 8 * 1024 * 1024,
    allowedContentTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"]
  },
  check_in_photo: {
    maxBytes: 5 * 1024 * 1024,
    allowedContentTypes: ["image/jpeg", "image/png", "image/webp"]
  }
};

const KEY_PREFIX = "users";

let cachedClient: S3Client | null = null;

function getClient(): S3Client {
  if (cachedClient) return cachedClient;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT;
  if (!accessKeyId || !secretAccessKey || !endpoint) {
    throw new Error("R2 storage is not configured. Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET.");
  }
  cachedClient = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true
  });
  return cachedClient;
}

function getBucket(): string {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) {
    throw new Error("R2_BUCKET env var is required");
  }
  return bucket;
}

export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_ENDPOINT &&
      process.env.R2_BUCKET
  );
}

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf"
};

export function extensionForContentType(contentType: string): string {
  return EXTENSION_BY_CONTENT_TYPE[contentType] ?? "bin";
}

export function generateStorageKey(input: {
  userId: string;
  kind: StorageKind;
  contentType: string;
}): string {
  const ext = extensionForContentType(input.contentType);
  return `${KEY_PREFIX}/${input.userId}/${input.kind}/${randomUUID()}.${ext}`;
}

export function isStorageKey(value: string | null | undefined): value is string {
  if (!value || typeof value !== "string") return false;
  if (value.startsWith("data:")) return false;
  if (value.startsWith("http://") || value.startsWith("https://")) return false;
  return value.startsWith(`${KEY_PREFIX}/`);
}

export async function getPresignedUploadUrl(input: {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const client = getClient();
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: input.key,
    ContentType: input.contentType
  });
  return getSignedUrl(client, command, { expiresIn: input.expiresInSeconds ?? 900 });
}

export async function getPresignedReadUrl(input: {
  key: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const client = getClient();
  const command = new GetObjectCommand({ Bucket: getBucket(), Key: input.key });
  return getSignedUrl(client, command, { expiresIn: input.expiresInSeconds ?? 3600 });
}

/**
 * Resolve an asset reference to a final URL usable in <img src=...>.
 * - data: URLs and absolute URLs are returned as-is (legacy support).
 * - Storage keys are resolved into a signed read URL (TTL 1h by default).
 * - Returns null if value is empty or storage is not configured for a key value.
 */
export async function resolveAssetUrl(
  value: string | null | undefined,
  options?: { expiresInSeconds?: number }
): Promise<string | null> {
  if (!value) return null;
  if (value.startsWith("data:")) return value;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (!isStorageKey(value)) return null;
  if (!isStorageConfigured()) return null;
  return getPresignedReadUrl({ key: value, expiresInSeconds: options?.expiresInSeconds });
}

export async function resolveAssetUrlMap<K extends string>(
  entries: Record<K, string | null | undefined>,
  options?: { expiresInSeconds?: number }
): Promise<Record<K, string | null>> {
  const keys = Object.keys(entries) as K[];
  const resolved = await Promise.all(keys.map((key) => resolveAssetUrl(entries[key], options)));
  const out = {} as Record<K, string | null>;
  keys.forEach((key, index) => {
    out[key] = resolved[index];
  });
  return out;
}
