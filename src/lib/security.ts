import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { compare, hash } from "bcryptjs";

const BCRYPT_ROUNDS = 12;

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 16) return secret;
  // AUTH-02: fail-closed. El fallback inseguro SOLO se permite en desarrollo/test local.
  // Cualquier otro NODE_ENV (production, preview, undefined, mal configurado) exige el secreto.
  const env = process.env.NODE_ENV;
  if (env !== "development" && env !== "test") {
    throw new Error("SESSION_SECRET is required (min 16 chars)");
  }
  return "dev-insecure-change-me";
}

export async function hashPassword(password: string) {
  return hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}

export function sha256(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

export function randomToken(size = 32) {
  return randomBytes(size).toString("hex");
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function signSession(payload: Record<string, unknown>) {
  const secret = getSessionSecret();
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

export function verifySession<T>(token: string): T | null {
  try {
    const secret = getSessionSecret();
    const [header, body, signature] = token.split(".");
    if (!header || !body || !signature) return null;

    // AUTH-02: validar explícitamente el algoritmo del header (rechaza alg:none / variantes).
    const parsedHeader = JSON.parse(base64UrlDecode(header)) as { alg?: string };
    if (parsedHeader.alg !== "HS256") return null;

    // AUTH-02: comparación de firma en tiempo constante.
    const expected = createHmac("sha256", secret).update(`${header}.${body}`).digest();
    const provided = Buffer.from(signature, "base64url");
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;

    const payload = JSON.parse(base64UrlDecode(body)) as T & { exp?: number };
    if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

