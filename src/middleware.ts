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

function decodeSessionCookie(raw: string | undefined): { userId: string | null; role: UserRole | null } {
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

function hasRequiredRole(role: UserRole | null, allowed: UserRole[]) {
  if (!role) return false;
  return allowed.includes(role);
}

function redirectToLogin(req: NextRequest) {
  const loginUrl = new URL("/ingresar", req.url);
  loginUrl.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = decodeSessionCookie(req.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (pathname.startsWith("/cliente")) {
    if (!hasRequiredRole(session.role, ["CUSTOMER", "ADMIN"])) return redirectToLogin(req);
  }

  if (pathname.startsWith("/pro") && !pathname.startsWith("/profesionales")) {
    if (!hasRequiredRole(session.role, ["PRO", "ADMIN"])) return redirectToLogin(req);
  }

  if (pathname.startsWith("/admin")) {
    if (!hasRequiredRole(session.role, ["ADMIN"])) return redirectToLogin(req);
  }

  if (pathname.startsWith("/reservar")) {
    if (!hasRequiredRole(session.role, ["CUSTOMER", "ADMIN"])) return redirectToLogin(req);
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
  matcher: ["/cliente/:path*", "/pro/:path*", "/admin/:path*", "/reservar/:path*", "/api/marketplace/:path*"]
};
