import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, type RequestIdentity } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type AdminRequestIdentity = RequestIdentity & {
  userId: string;
  role: UserRole;
  email: string | null;
  fullName: string | null;
};

export async function requireAdminRequest(
  req: NextRequest
): Promise<{ ok: true; identity: AdminRequestIdentity } | { ok: false; response: NextResponse<{ error: string }> }> {
  const identity = getRequestIdentity(req);
  if (!identity.userId || identity.role !== UserRole.ADMIN) {
    return { ok: false, response: NextResponse.json({ error: "No autorizado" }, { status: 403 }) };
  }

  const user = await prisma.user.findUnique({
    where: { id: identity.userId },
    select: {
      id: true,
      role: true,
      email: true,
      fullName: true
    }
  });

  if (!user || user.role !== UserRole.ADMIN) {
    return { ok: false, response: NextResponse.json({ error: "No autorizado" }, { status: 403 }) };
  }

  return {
    ok: true,
    identity: {
      ...identity,
      userId: user.id,
      role: UserRole.ADMIN,
      email: user.email,
      fullName: user.fullName
    }
  };
}
