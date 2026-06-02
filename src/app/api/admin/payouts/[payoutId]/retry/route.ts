import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin-access";
import { recordAdminAction } from "@/lib/audit-log";
import { retryPayoutForBooking } from "@/lib/payouts-processor";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Reintenta un payout puntual (G5). El admin lo dispara desde la cola de
 * payouts fallidos/atascados.
 */
export async function POST(req: NextRequest, context: { params: { payoutId: string } }) {
  const admin = await requireAdminRequest(req);
  if (!admin.ok) return admin.response;

  try {
    const payout = await prisma.payout.findUnique({ where: { id: context.params.payoutId } });
    if (!payout) {
      return NextResponse.json({ error: "Payout no encontrado" }, { status: 404 });
    }

    const before = { status: payout.status };
    const result = await retryPayoutForBooking(payout.bookingId);

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.reason }, { status: 409 });
    }

    await recordAdminAction({
      actorId: admin.identity.userId,
      action: "payouts.retry",
      target: { type: "Payout", id: payout.id },
      before,
      after: result.booking ?? { reprocessed: true }
    });

    return NextResponse.json({ ok: true, result: result.booking ?? null }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo reintentar el payout",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 500 }
    );
  }
}
