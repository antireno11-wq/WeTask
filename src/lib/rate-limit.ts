import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { logger } from "@/lib/logger";

/**
 * Rate limiting helper centralizado para WeTask.
 *
 * Backed by Upstash Redis (HTTP-only, gratis para nuestro volumen).
 * Si `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` no están
 * configurados, retorna no-op (permite todo). Esto evita bloquear dev
 * pero también significa que en producción HAY QUE configurar las envs
 * (un check al boot lo recomienda).
 *
 * Uso típico en un route handler:
 *
 *   import { rateLimit, getClientIp } from "@/lib/rate-limit";
 *
 *   const decision = await rateLimit("auth.login", `${ip}:${email}`, "5/m");
 *   if (!decision.success) {
 *     return NextResponse.json({ error: "Demasiados intentos" }, { status: 429 });
 *   }
 */

const redis = (() => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    return new Redis({ url, token });
  } catch (err) {
    logger.warn({ err }, "rate-limit: Upstash Redis init failed");
    return null;
  }
})();

if (!redis && process.env.NODE_ENV === "production") {
  logger.warn(
    "rate-limit: UPSTASH_REDIS_REST_URL/TOKEN no configurados en producción — rate limiting deshabilitado"
  );
}

const limiterCache = new Map<string, Ratelimit>();

/**
 * Sintaxis del window: "5/m", "10/m", "3/h", "100/d".
 * Devuelve un Ratelimit cacheado por (prefix + window).
 */
function getLimiter(prefix: string, window: string): Ratelimit | null {
  if (!redis) return null;
  const key = `${prefix}:${window}`;
  const cached = limiterCache.get(key);
  if (cached) return cached;
  const limiter = new Ratelimit({
    redis,
    limiter: parseWindow(window),
    prefix: `wetask:rl:${prefix}`,
    analytics: false,
    timeout: 1500
  });
  limiterCache.set(key, limiter);
  return limiter;
}

function parseWindow(window: string) {
  const { count, unit } = parseWindowParts(window);
  const duration =
    unit === "s" ? "1 s" : unit === "m" ? "1 m" : unit === "h" ? "1 h" : "1 d";
  return Ratelimit.slidingWindow(count, duration as `${number} ${"s" | "m" | "h" | "d"}`);
}

function parseWindowParts(window: string): { count: number; unit: string; ms: number } {
  const match = window.match(/^(\d+)\/(s|m|h|d)$/);
  if (!match) throw new Error(`Window inválido para rate-limit: ${window}`);
  const count = Number(match[1]);
  const unit = match[2];
  const ms = unit === "s" ? 1000 : unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;
  return { count, unit, ms };
}

/**
 * AUTH-06/PRO-14: fallback en memoria (por instancia) para cuando Upstash no está
 * configurado o falla. No es distribuido, pero evita el "fail-open" total: un atacante
 * ya no obtiene intentos ilimitados contra login/OTP/refund si Redis cae.
 */
const memoryBuckets = new Map<string, number[]>();
let lastMemorySweep = 0;

function inMemoryLimit(scope: string, identifier: string, window: string): RateLimitDecision {
  const { count, ms } = parseWindowParts(window);
  const now = Date.now();
  const key = `${scope}:${identifier}`;
  const hits = (memoryBuckets.get(key) ?? []).filter((ts) => now - ts < ms);

  // Barrido perezoso para no crecer sin límite (cada 5 min).
  if (now - lastMemorySweep > 300_000) {
    lastMemorySweep = now;
    for (const [k, arr] of memoryBuckets) {
      const fresh = arr.filter((ts) => now - ts < ms);
      if (fresh.length === 0) memoryBuckets.delete(k);
      else memoryBuckets.set(k, fresh);
    }
  }

  if (hits.length >= count) {
    const reset = (hits[0] ?? now) + ms;
    return { success: false, limit: count, remaining: 0, reset, reason: "limited" };
  }
  hits.push(now);
  memoryBuckets.set(key, hits);
  return { success: true, limit: count, remaining: count - hits.length, reset: now + ms, reason: "ok" };
}

export type RateLimitDecision = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // epoch ms cuando se resetea
  reason?: "no_redis" | "limited" | "ok";
};

export async function rateLimit(
  scope: string,
  identifier: string,
  window: string
): Promise<RateLimitDecision> {
  const limiter = getLimiter(scope, window);
  if (!limiter) {
    // Sin Redis: usamos el limitador en memoria en vez de permitir todo.
    return inMemoryLimit(scope, identifier, window);
  }
  try {
    const result = await limiter.limit(identifier);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
      reason: result.success ? "ok" : "limited"
    };
  } catch (err) {
    // Upstash caído: degradamos al limitador en memoria (no fail-open total).
    logger.warn({ scope, err }, "rate-limit: limiter.limit() failed, fallback a memoria");
    return inMemoryLimit(scope, identifier, window);
  }
}

/**
 * Extrae la IP del cliente de los headers usuales en Next.js + Railway.
 */
export function getClientIp(req: Request): string {
  // PRO-09: preferimos `x-real-ip`, que setea el proxy de borde de confianza (Railway/edge)
  // y el cliente no puede falsificar. `x-forwarded-for` SÍ es manipulable por el cliente
  // (puede prependir IPs falsas), así que se usa sólo como fallback en entornos sin x-real-ip.
  // Además, los rate-limits sensibles combinan la IP con un identificador no-spoofeable
  // (email/teléfono/userId), de modo que el spoofeo de IP no basta para evadirlos.
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return "unknown";
}

/**
 * Helper para devolver una respuesta 429 estándar.
 */
export function tooManyRequestsResponse(decision: RateLimitDecision) {
  const retryAfter = decision.reset > 0 ? Math.max(1, Math.ceil((decision.reset - Date.now()) / 1000)) : 60;
  return new Response(
    JSON.stringify({
      error: "Demasiadas solicitudes. Intenta nuevamente en unos momentos.",
      retryAfterSeconds: retryAfter
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(decision.limit),
        "X-RateLimit-Remaining": String(decision.remaining),
        "X-RateLimit-Reset": String(decision.reset)
      }
    }
  );
}
