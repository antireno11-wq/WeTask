import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
const allowedOrigins = appUrl
  ? [appUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")]
  : process.env.NODE_ENV === "production"
    ? []
    : ["localhost:3000"];

const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins
    }
  }
};

// Sentry: solo envuelve si hay DSN configurada. Sin DSN, fail-suave =
// el bundle no carga Sentry en runtime y los configs ven dsn vacío.
const sentryEnabled = Boolean(
  process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
);

const sentryBuildOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  tunnelRoute: "/monitoring"
};

export default sentryEnabled
  ? withSentryConfig(nextConfig, sentryBuildOptions)
  : nextConfig;
