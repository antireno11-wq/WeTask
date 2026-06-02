import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin-access";
import { recordAdminAction } from "@/lib/audit-log";
import { processBookingsForPayout } from "@/lib/payouts-processor";

export const dynamic = "force-dynamic";

/**
 * Disparador manual del procesamiento de payouts (mismo flujo que el
 * cron de QStash en /api/cron/process-bookings). Sirve como botón
 * "ejecutar ahora" para el admin desde el back-office.
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdminRequest(req);
  if (!admin.ok) return admin.response;

  try {
    const result = await processBookingsForPayout();

    if (result.scheduled > 0 || result.paidOut > 0 || result.failed > 0) {
      await recordAdminAction({
        actorId: admin.identity.userId,
        action: "payouts.process_timeouts_manual",
        target: { type: "PayoutBatch" },
        after: result
      });
    }

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudieron procesar los payouts automáticos",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 500 }
    );
  }
}
