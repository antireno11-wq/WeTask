import { NextRequest, NextResponse } from "next/server";
import { recordAdminAction } from "@/lib/audit-log";
import { reconcilePendingPayments } from "@/lib/payouts-processor";
import { assertQStashRequest } from "@/lib/qstash";

export const dynamic = "force-dynamic";

/**
 * Cron handler invocado por QStash cada hora.
 *
 * Re-pregunta a MercadoPago el estado real de los Payment.status="PENDING"
 * más viejos que 10 minutos. Sincroniza Payment + Booking + libera slot
 * si el pago resultó FAILED. Necesario porque algunos webhooks se pueden
 * perder en producción.
 */
export async function POST(req: NextRequest) {
  const verdict = await assertQStashRequest(req);
  if (!verdict.ok) return verdict.response as NextResponse;

  try {
    const result = await reconcilePendingPayments();

    if (result.updated > 0 || result.failed > 0) {
      await recordAdminAction({
        actorId: null,
        action: "cron.reconcile_payments",
        target: { type: "PaymentBatch" },
        after: result
      }).catch(() => null);
    }

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Error reconciliando pagos",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 500 }
    );
  }
}
