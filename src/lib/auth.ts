import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";
import { signSession, verifySession } from "@/lib/security";

export const SESSION_COOKIE_NAME = "wetask_session";

export type RequestIdentity = {
  userId: string | null;
  role: UserRole | null;
  sessionId?: string | null;
  email?: string | null;
  fullName?: string | null;
};

type SessionCookie = {
  sid?: string;
  userId: string;
  role: UserRole;
  exp?: number;
  email?: string | null;
  fullName?: string | null;
};

export function encodeSessionCookie(identity: { userId: string; role: UserRole; email?: string | null; fullName?: string | null }) {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  return signSession({
    userId: identity.userId,
    role: identity.role,
    email: identity.email ?? null,
    fullName: identity.fullName ?? null,
    exp
  });
}

export function decodeSessionCookie(raw: string | undefined): RequestIdentity {
  const signed = raw ? verifySession<SessionCookie>(raw) : null;
  if (!signed) return { userId: null, role: null };
  return {
    sessionId: signed.sid ?? null,
    userId: signed.userId,
    role: signed.role,
    email: signed.email ?? null,
    fullName: signed.fullName ?? null
  };
}

export function getRequestIdentity(req: NextRequest): RequestIdentity {
  const cookieIdentity = decodeSessionCookie(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (cookieIdentity.role && cookieIdentity.userId) {
    return cookieIdentity;
  }

  if (process.env.NODE_ENV === "production") {
    return { userId: null, role: null };
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
