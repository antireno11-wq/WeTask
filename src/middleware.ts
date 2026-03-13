import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "wetask_session";
type UserRole = "CUSTOMER" | "PRO" | "ADMIN";

const PUBLIC_MARKETPLACE_API_PREFIXES = [
  "/api/marketplace/catalog",
  "/api/marketplace/pros",
  "/api/marketplace/availability",
  "/api/marketplace/search-professionals",
  "/api/marketplace/demo"
];

function isPublicMarketplaceApi(pathname: string) {
  return PUBLIC_MARKETPLACE_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function decodeLegacySessionCookie(raw: string | undefined): { userId: string | null; role: UserRole | null } {
  if (!raw) return { userId: null, role: null };
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as { userId?: string; role?: UserRole };
    if (!parsed?.userId || !parsed?.role) return { userId: null, role: null };
    if (parsed.role !== "CUSTOMER" && parsed.role !== "PRO" && parsed.role !== "ADMIN") return { userId: null, role: null };
    return { userId: parsed.userId, role: parsed.role };
  } catch {
    return { userId: null, role: null };
  }
}

function toBase64(value: Uint8Array) {
  let output = "";
  for (let i = 0; i < value.length; i += 1) output += String.fromCharCode(value[i]);
  return btoa(output).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function decodeSignedSessionCookie(raw: string | undefined): Promise<{ userId: string | null; role: UserRole | null }> {
  if (!raw || !raw.includes(".")) return { userId: null, role: null };
  try {
    const secret = process.env.SESSION_SECRET || "dev-insecure-change-me";
    const [header, payload, signature] = raw.split(".");
    if (!header || !payload || !signature) return { userId: null, role: null };

    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${payload}`));
    const expected = toBase64(new Uint8Array(signed));
    if (expected !== signature) return { userId: null, role: null };

    const base64Payload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = base64Payload + "=".repeat((4 - (base64Payload.length % 4)) % 4);
    const parsed = JSON.parse(atob(paddedPayload)) as {
      userId?: string;
      role?: UserRole;
      exp?: number;
    };
    if (!parsed?.userId || !parsed?.role) return { userId: null, role: null };
    if (parsed.exp && parsed.exp < Math.floor(Date.now() / 1000)) return { userId: null, role: null };
    if (parsed.role !== "CUSTOMER" && parsed.role !== "PRO" && parsed.role !== "ADMIN") return { userId: null, role: null };
    return { userId: parsed.userId, role: parsed.role };
  } catch {
    return { userId: null, role: null };
  }
}

function hasRequiredRole(role: UserRole | null, allowed: UserRole[]) {
  if (!role) return false;
  return allowed.includes(role);
}

function redirectToLogin(req: NextRequest, mode: "cliente" | "tasker" = "cliente") {
  const loginUrl = new URL(`/ingresar/${mode}`, req.url);
  loginUrl.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const rawSession = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const signedSession = await decodeSignedSessionCookie(rawSession);
  const session = signedSession.userId ? signedSession : decodeLegacySessionCookie(rawSession);

  if (pathname.startsWith("/cliente")) {
    if (!hasRequiredRole(session.role, ["CUSTOMER", "ADMIN"])) return redirectToLogin(req, "cliente");
  }

  if (pathname.startsWith("/pro") && !pathname.startsWith("/profesionales")) {
    if (!hasRequiredRole(session.role, ["PRO", "ADMIN"])) return redirectToLogin(req, "tasker");
  }

  if (pathname.startsWith("/admin")) {
    if (!hasRequiredRole(session.role, ["ADMIN"])) return redirectToLogin(req, "cliente");
  }

  if (pathname.startsWith("/reservar") || pathname.startsWith("/booking")) {
    if (!hasRequiredRole(session.role, ["CUSTOMER", "ADMIN"])) return redirectToLogin(req, "cliente");
  }

  if (pathname.startsWith("/api/admin")) {
    if (!session.userId || !session.role) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (!hasRequiredRole(session.role, ["ADMIN"])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  if (pathname.startsWith("/api/marketplace") && !isPublicMarketplaceApi(pathname)) {
    if (!session.userId || !session.role) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    if (pathname.startsWith("/api/marketplace/admin") && !hasRequiredRole(session.role, ["ADMIN"])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    if (pathname.startsWith("/api/marketplace/pro") && !hasRequiredRole(session.role, ["PRO", "ADMIN"])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    if (pathname.startsWith("/api/marketplace/client") && !hasRequiredRole(session.role, ["CUSTOMER", "ADMIN"])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/cliente/:path*",
    "/pro/:path*",
    "/admin/:path*",
    "/reservar/:path*",
    "/booking/:path*",
    "/api/admin/:path*",
    "/api/marketplace/:path*"
  ]
};
