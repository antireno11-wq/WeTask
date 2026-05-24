import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const identity = getRequestIdentity(req);
  if (!identity.userId || !hasRole(identity.role, [UserRole.PRO, UserRole.ADMIN])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  await prisma.user.update({
    where: { id: identity.userId },
    data: {
      mpAccessToken: null,
      mpRefreshToken: null,
      mpUserId: null,
      mpTokenExpiresAt: null,
      mpAccountStatus: null,
      mpConnectedAt: null
    }
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
