import { NextRequest, NextResponse } from "next/server";
import { hardDeleteExpiredAccounts } from "@/lib/account-cleanup-processor";
import { recordAdminAction } from "@/lib/audit-log";
import { assertQStashRequest } from "@/lib/qstash";

export const dynamic = "force-dynamic";

/**
 * Cron QStash diario.
 *
 * Anonimiza cuentas cuyo grace de eliminación (30d desde DELETE /api/me/account)
 * venció. No borra la fila User para preservar Payment/Booking según
 * retención contable chilena (DL 825 art. 58, 6 años).
 */
export async function POST(req: NextRequest) {
  const verdict = await assertQStashRequest(req);
  if (!verdict.ok) return verdict.response as NextResponse;

  try {
    const result = await hardDeleteExpiredAccounts();

    if (result.anonymized > 0 || result.failed > 0) {
      await recordAdminAction({
        actorId: null,
        action: "cron.hard_delete_accounts",
        target: { type: "UserBatch" },
        after: result
      }).catch(() => null);
    }

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Error procesando hard-delete",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 500 }
    );
  }
}
