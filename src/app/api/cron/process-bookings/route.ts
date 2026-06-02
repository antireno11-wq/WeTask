import { NextRequest, NextResponse } from "next/server";
import { recordAdminAction } from "@/lib/audit-log";
import { processBookingsForPayout } from "@/lib/payouts-processor";
import { assertQStashRequest } from "@/lib/qstash";

export const dynamic = "force-dynamic";

/**
 * Cron handler invocado por QStash cada hora (configurar schedule en
 * el dashboard de Upstash apuntando a https://<dominio>/api/cron/process-bookings).
 *
 * En desarrollo se puede llamar sin firma; en producción es obligatorio
 * QSTASH_CURRENT_SIGNING_KEY o devuelve 401.
 */
export async function POST(req: NextRequest) {
  const verdict = await assertQStashRequest(req);
  if (!verdict.ok) return verdict.response as NextResponse;

  try {
    const result = await processBookingsForPayout();

    if (result.scheduled > 0 || result.paidOut > 0 || result.failed > 0) {
      await recordAdminAction({
        actorId: null,
        action: "cron.process_bookings",
        target: { type: "PayoutBatch" },
        after: result
      }).catch(() => null);
    }

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Error procesando bookings",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 500 }
    );
  }
}
