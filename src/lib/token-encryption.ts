import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * PAY-04: cifrado at-rest de secretos sensibles (tokens OAuth de MercadoPago).
 *
 * Formato del valor cifrado: `enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>` (AES-256-GCM).
 * `decryptSecret` es retrocompatible: si el valor NO tiene el prefijo `enc:v1:`
 * se asume texto plano legacy y se devuelve tal cual (permite migrar sin downtime).
 */

const ENC_PREFIX = "enc:v1:";

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (raw && raw.length >= 16) {
    // Derivamos siempre 32 bytes con SHA-256 (acepta claves de cualquier largo).
    return createHash("sha256").update(raw).digest();
  }
  const env = process.env.NODE_ENV;
  if (env !== "development" && env !== "test") {
    throw new Error("TOKEN_ENCRYPTION_KEY is required (min 16 chars) to encrypt provider tokens");
  }
  return createHash("sha256").update("dev-insecure-token-key").digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

/** Cifra si el valor es no-nulo; preserva null/undefined. */
export function encryptSecretNullable(plain: string | null | undefined): string | null {
  if (plain == null || plain === "") return plain ?? null;
  return encryptSecret(plain);
}

export function decryptSecret(stored: string | null | undefined): string | null {
  if (stored == null) return null;
  if (!stored.startsWith(ENC_PREFIX)) return stored; // texto plano legacy
  try {
    const [ivB64, tagB64, dataB64] = stored.slice(ENC_PREFIX.length).split(":");
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const data = Buffer.from(dataB64, "base64");
    const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
