import { createHash, createHmac, timingSafeEqual } from "crypto";

/**
 * Verifica la firma `Upstash-Signature` que QStash agrega a sus webhooks.
 *
 * QStash firma cada llamada con un JWT HS256 cuyo payload incluye:
 *   - body: SHA-256 base64url del raw body
 *   - exp / nbf: validez temporal
 *
 * Soporta rotación de keys: QSTASH_CURRENT_SIGNING_KEY y, opcionalmente,
 * QSTASH_NEXT_SIGNING_KEY (se intenta primero la "current").
 *
 * Si no hay ninguna key configurada, devuelve "unverifiable". El caller
 * decide si rechazar (producción) o permitir (dev / pruebas).
 */
export type QStashVerification = "valid" | "invalid" | "unverifiable";

function base64UrlToBuffer(value: string): Buffer {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const normalized = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64");
}

function safeEqualString(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function verifyWithKey(signatureHeader: string, rawBody: string, signingKey: string): boolean {
  const parts = signatureHeader.split(".");
  if (parts.length !== 3) return false;
  const [headerB64, payloadB64, signatureB64] = parts;

  const expected = createHmac("sha256", signingKey)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64url");
  if (!safeEqualString(expected, signatureB64)) return false;

  let payload: { exp?: number; nbf?: number; body?: string };
  try {
    payload = JSON.parse(base64UrlToBuffer(payloadB64).toString("utf8"));
  } catch {
    return false;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp < nowSec) return false;
  if (typeof payload.nbf === "number" && payload.nbf > nowSec + 5) return false;

  // body claim = sha256(rawBody) in base64url (padding stripped)
  if (typeof payload.body === "string") {
    const expectedBody = createHash("sha256").update(rawBody).digest("base64url");
    if (!safeEqualString(payload.body, expectedBody)) return false;
  }

  return true;
}

export function verifyQStashSignature(input: {
  signatureHeader: string | null;
  rawBody: string;
}): QStashVerification {
  const current = process.env.QSTASH_CURRENT_SIGNING_KEY ?? process.env.QSTASH_SIGNING_KEY;
  const next = process.env.QSTASH_NEXT_SIGNING_KEY ?? null;

  if (!current && !next) return "unverifiable";
  if (!input.signatureHeader) return "invalid";

  try {
    if (current && verifyWithKey(input.signatureHeader, input.rawBody, current)) return "valid";
    if (next && verifyWithKey(input.signatureHeader, input.rawBody, next)) return "valid";
  } catch {
    return "invalid";
  }
  return "invalid";
}

/**
 * Helper para usar al inicio de un cron-handler:
 *   const verdict = await assertQStashRequest(req);
 *   if (!verdict.ok) return verdict.response;
 */
export async function assertQStashRequest(req: Request): Promise<
  | { ok: true; body: string; parsed: unknown }
  | { ok: false; response: Response }
> {
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("upstash-signature");
  const verdict = verifyQStashSignature({ signatureHeader, rawBody });

  if (verdict === "invalid") {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Firma QStash inválida" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      })
    };
  }
  // BOOK-11: fuera de development/test exigimos firma válida. Antes sólo se rechazaba en
  // production, así que un NODE_ENV mal configurado (preview/staging) dejaba los crons
  // (payouts, borrado de cuentas) disparables sin firma.
  if (verdict === "unverifiable" && process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test") {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: "QSTASH_CURRENT_SIGNING_KEY no configurado" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    };
  }

  let parsed: unknown = {};
  if (rawBody) {
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      parsed = rawBody;
    }
  }
  return { ok: true, body: rawBody, parsed };
}
