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
  const match = window.match(/^(\d+)\/(s|m|h|d)$/);
  if (!match) throw new Error(`Window inválido para rate-limit: ${window}`);
  const count = Number(match[1]);
  const unit = match[2];
  const duration =
    unit === "s" ? "1 s" : unit === "m" ? "1 m" : unit === "h" ? "1 h" : "1 d";
  return Ratelimit.slidingWindow(count, duration as `${number} ${"s" | "m" | "h" | "d"}`);
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
    return { success: true, limit: Infinity, remaining: Infinity, reset: 0, reason: "no_redis" };
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
    // Fallar abierto: si Upstash está caído no bloqueamos al usuario.
    logger.warn({ scope, err }, "rate-limit: limiter.limit() failed, allowing request");
    return { success: true, limit: 0, remaining: 0, reset: 0, reason: "no_redis" };
  }
}

/**
 * Extrae la IP del cliente de los headers usuales en Next.js + Railway.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return req.headers.get("x-real-ip") ?? "unknown";
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
