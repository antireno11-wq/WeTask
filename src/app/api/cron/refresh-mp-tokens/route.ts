import { NextRequest, NextResponse } from "next/server";
import { refreshExpiringMpTokens } from "@/lib/account-cleanup-processor";
import { recordAdminAction } from "@/lib/audit-log";
import { assertQStashRequest } from "@/lib/qstash";

export const dynamic = "force-dynamic";

/**
 * Cron QStash diario.
 *
 * Refresca access tokens MP que vencen en los próximos 7 días. Sin esto,
 * los pagos vía Marketplace fallan silenciosamente cuando el token de un
 * tasker aprobado expira (TTL típico 6 meses). Si el refresh falla,
 * marca la cuenta DISABLED y notifica al tasker para que reconecte.
 */
export async function POST(req: NextRequest) {
  const verdict = await assertQStashRequest(req);
  if (!verdict.ok) return verdict.response as NextResponse;

  try {
    const result = await refreshExpiringMpTokens();

    if (result.refreshed > 0 || result.disabled > 0 || result.failed > 0) {
      await recordAdminAction({
        actorId: null,
        action: "cron.refresh_mp_tokens",
        target: { type: "UserBatch" },
        after: result
      }).catch(() => null);
    }

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Error refrescando tokens MP",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 500 }
    );
  }
}
