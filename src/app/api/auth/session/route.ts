import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/auth";
import { ensurePrimaryAdminUser } from "@/lib/primary-admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await ensurePrimaryAdminUser();
  const identity = getRequestIdentity(req);
  if (!identity.userId || !identity.role) {
    return NextResponse.json({ session: null }, { status: 200 });
  }
  const user = await prisma.user.findUnique({
    where: { id: identity.userId },
    select: { authProvider: true, emailVerifiedAt: true, termsAcceptedAt: true, sessionVersion: true }
  });

  // AUTH-05: si la cookie quedó obsoleta (reset de contraseña posterior), la sesión es nula.
  if (!user || (identity.sessionVersion ?? 0) !== user.sessionVersion) {
    return NextResponse.json({ session: null }, { status: 200 });
  }

  return NextResponse.json(
    {
      session: {
        ...identity,
        authProvider: user?.authProvider ?? "EMAIL",
        emailVerified: Boolean(user?.emailVerifiedAt),
        termsAccepted: Boolean(user?.termsAcceptedAt)
      }
    },
    { status: 200 }
  );
}
