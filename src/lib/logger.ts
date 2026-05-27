import pino, { type Logger } from "pino";

/**
 * Logger estructurado del backend de WeTask.
 *
 * - JSON en producción (compatible con log aggregators), pretty en dev.
 * - Redacta automáticamente campos sensibles que podrían acabar en logs
 *   por accidente (passwordHash, tokenHash, mpAccessToken, etc.).
 * - Métodos estándar: trace/debug/info/warn/error/fatal + child loggers.
 *
 * Uso:
 *   import { logger } from "@/lib/logger";
 *   logger.info({ bookingId, userId }, "booking confirmed");
 *
 *   const reqLogger = logger.child({ requestId: req.headers.get("x-request-id") });
 *   reqLogger.warn({ reason }, "slot not available");
 */
const REDACT_PATHS = [
  "passwordHash",
  "password",
  "tokenHash",
  "mpAccessToken",
  "mpRefreshToken",
  "accessToken",
  "refreshToken",
  "secret",
  "*.passwordHash",
  "*.tokenHash",
  "*.mpAccessToken",
  "*.mpRefreshToken",
  "*.accessToken",
  "*.refreshToken",
  "*.secret",
  "req.headers.authorization",
  "req.headers.cookie",
  "headers.authorization",
  "headers.cookie"
];

const isProd = process.env.NODE_ENV === "production";

export const logger: Logger = pino({
  level: process.env.LOG_LEVEL ?? (isProd ? "info" : "debug"),
  base: { app: "wetask" },
  redact: {
    paths: REDACT_PATHS,
    censor: "[REDACTED]",
    remove: false
  },
  // Pretty transport en dev requeriría pino-pretty como dev dep + transport.
  // Lo mantengo simple: JSON siempre. Si querés pretty local, usar
  // `LOG_LEVEL=debug npm run dev | npx pino-pretty`.
  formatters: {
    level: (label) => ({ level: label })
  },
  timestamp: () => `,"time":"${new Date().toISOString()}"`
});

export function logError(scope: string, error: unknown, extra: Record<string, unknown> = {}) {
  const message = error instanceof Error ? error.message : "unknown";
  const stack = error instanceof Error ? error.stack : undefined;
  logger.error({ scope, ...extra, err: { message, stack } }, message);
}
