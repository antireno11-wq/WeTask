import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";

export function getRequestIdentity(req: NextRequest): { userId: string | null; role: UserRole | null } {
  const userId = req.headers.get("x-user-id");
  const rawRole = req.headers.get("x-user-role");

  if (!rawRole) {
    return { userId, role: null };
  }

  if (rawRole === UserRole.ADMIN || rawRole === UserRole.CUSTOMER || rawRole === UserRole.PRO) {
    return { userId, role: rawRole };
  }

  return { userId, role: null };
}

export function hasRole(role: UserRole | null, expected: UserRole | UserRole[]): boolean {
  if (!role) return false;
  return Array.isArray(expected) ? expected.includes(role) : role === expected;
}
