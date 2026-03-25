import { NextRequest } from "next/server";

function sanitizeBaseUrl(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "");
}

export function resolvePublicAppUrl(req?: NextRequest) {
  if (req) {
    const forwardedHost = sanitizeBaseUrl(req.headers.get("x-forwarded-host"));
    const forwardedProto = sanitizeBaseUrl(req.headers.get("x-forwarded-proto")) || "https";
    if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;

    const host = sanitizeBaseUrl(req.headers.get("host"));
    if (host && !host.includes("localhost")) {
      const proto = req.nextUrl.protocol.replace(":", "") || "https";
      return `${proto}://${host}`;
    }
  }

  const envUrl = sanitizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) || sanitizeBaseUrl(process.env.APP_URL);
  if (envUrl) return envUrl;

  return "https://wetask.cl";
}
