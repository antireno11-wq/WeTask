import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { isMercadoPagoOAuthConfigured } from "@/lib/payments/providers/mercadopago";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const identity = getRequestIdentity(req);
  if (!identity.userId || !hasRole(identity.role, [UserRole.PRO, UserRole.ADMIN])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: identity.userId },
    select: {
      mpAccountStatus: true,
      mpUserId: true,
      mpConnectedAt: true,
      mpTokenExpiresAt: true
    }
  });

  return NextResponse.json(
    {
      status: user?.mpAccountStatus ?? null,
      mpUserId: user?.mpUserId ?? null,
      connectedAt: user?.mpConnectedAt ?? null,
      tokenExpiresAt: user?.mpTokenExpiresAt ?? null,
      oauthConfigured: isMercadoPagoOAuthConfigured()
    },
    { status: 200 }
  );
}
