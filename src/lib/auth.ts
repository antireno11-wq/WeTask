import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";

export const SESSION_COOKIE_NAME = "wetask_session";

export type RequestIdentity = {
  userId: string | null;
  role: UserRole | null;
  email?: string | null;
  fullName?: string | null;
};

type SessionCookie = {
  userId: string;
  role: UserRole;
  email?: string | null;
  fullName?: string | null;
};

function safeParseSessionCookie(raw: string | undefined): SessionCookie | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as SessionCookie;
    if (!parsed?.userId || !parsed?.role) return null;
    if (parsed.role !== UserRole.ADMIN && parsed.role !== UserRole.CUSTOMER && parsed.role !== UserRole.PRO) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function encodeSessionCookie(identity: { userId: string; role: UserRole; email?: string | null; fullName?: string | null }) {
  return encodeURIComponent(
    JSON.stringify({
      userId: identity.userId,
      role: identity.role,
      email: identity.email ?? null,
      fullName: identity.fullName ?? null
    })
  );
}

export function decodeSessionCookie(raw: string | undefined): RequestIdentity {
  const parsed = safeParseSessionCookie(raw);
  if (!parsed) return { userId: null, role: null };
  return {
    userId: parsed.userId,
    role: parsed.role,
    email: parsed.email ?? null,
    fullName: parsed.fullName ?? null
  };
}

export function getRequestIdentity(req: NextRequest): RequestIdentity {
  const cookieIdentity = decodeSessionCookie(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (cookieIdentity.role && cookieIdentity.userId) {
    return cookieIdentity;
  }

  const allowHeaderAuth = process.env.ALLOW_HEADER_AUTH === "true";
  if (!allowHeaderAuth) {
    return { userId: null, role: null };
  }

  const userId = req.headers.get("x-user-id");
  const rawRole = req.headers.get("x-user-role");

  if (rawRole === UserRole.ADMIN || rawRole === UserRole.CUSTOMER || rawRole === UserRole.PRO) {
    return { userId, role: rawRole, email: null, fullName: null };
  }

  return { userId, role: null };
}

export function hasRole(role: UserRole | null, expected: UserRole | UserRole[]): boolean {
  if (!role) return false;
  return Array.isArray(expected) ? expected.includes(role) : role === expected;
}
