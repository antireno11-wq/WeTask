import { PayoutStatus, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const identity = getRequestIdentity(req);
  if (!identity.userId || !hasRole(identity.role, [UserRole.PRO, UserRole.ADMIN])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // PAY-07: no permitir desconectar MP con fondos en juego — quedarían atrapados
  // (el cron de payouts no podría liberar el escrow sin el token del collector).
  const [heldEscrow, pendingPayouts] = await Promise.all([
    prisma.payment.count({
      where: { escrowStatus: "HELD", booking: { proId: identity.userId } }
    }),
    prisma.payout.count({
      where: { proId: identity.userId, status: { in: [PayoutStatus.PENDING, PayoutStatus.PROCESSING] } }
    })
  ]);

  if (heldEscrow > 0 || pendingPayouts > 0) {
    return NextResponse.json(
      {
        error:
          "Tienes pagos en proceso de liberación o payouts pendientes. No puedes desconectar MercadoPago hasta que se completen.",
        heldEscrow,
        pendingPayouts
      },
      { status: 409 }
    );
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
