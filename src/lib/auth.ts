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
  sessionVersion?: number | null;
};

type SessionCookie = {
  sid?: string;
  userId: string;
  role: UserRole;
  exp?: number;
  email?: string | null;
  fullName?: string | null;
  sv?: number;
};

export function encodeSessionCookie(identity: {
  userId: string;
  role: UserRole;
  email?: string | null;
  fullName?: string | null;
  sessionVersion?: number;
}) {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  return signSession({
    userId: identity.userId,
    role: identity.role,
    email: identity.email ?? null,
    fullName: identity.fullName ?? null,
    // AUTH-05: la versión de sesión se embebe en la cookie; al hacer reset de
    // contraseña se incrementa en DB y las cookies viejas dejan de validar.
    sv: identity.sessionVersion ?? 0,
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
    fullName: signed.fullName ?? null,
    sessionVersion: typeof signed.sv === "number" ? signed.sv : 0
  };
}

export function getRequestIdentity(req: NextRequest): RequestIdentity {
  const cookieIdentity = decodeSessionCookie(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (cookieIdentity.role && cookieIdentity.userId) {
    return cookieIdentity;
  }

  // AUTH-03: el header-auth (impersonación por x-user-*) es un backdoor de pruebas.
  // Sólo se permite en development/test local Y exige un secreto compartido en el header,
  // de modo que un NODE_ENV mal configurado o un staging accesible nunca lo habiliten.
  const env = process.env.NODE_ENV;
  if (env !== "development" && env !== "test") {
    return { userId: null, role: null };
  }

  const headerAuthSecret = process.env.HEADER_AUTH_SECRET;
  if (process.env.ALLOW_HEADER_AUTH !== "true" || !headerAuthSecret) {
    return { userId: null, role: null };
  }
  if (req.headers.get("x-header-auth-secret") !== headerAuthSecret) {
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
