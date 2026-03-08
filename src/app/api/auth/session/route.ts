import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const identity = getRequestIdentity(req);
  if (!identity.userId || !identity.role) {
    return NextResponse.json({ session: null }, { status: 200 });
  }
  const user = await prisma.user.findUnique({
    where: { id: identity.userId },
    select: { authProvider: true, emailVerifiedAt: true, termsAcceptedAt: true }
  });
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
