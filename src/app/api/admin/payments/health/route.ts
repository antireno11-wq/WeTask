import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin-access";
import { checkMercadoPagoHealth } from "@/lib/payments/providers/mercadopago";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // ADM-03: re-valida rol admin contra DB (no confía sólo en el rol de la cookie).
  const auth = await requireAdminRequest(req);
  if (!auth.ok) return auth.response;

  const health = await checkMercadoPagoHealth();
  const status = health.provider.ok ? 200 : 503;

  return NextResponse.json(
    {
      gateway: "MERCADOPAGO",
      checkedAt: new Date().toISOString(),
      ...health
    },
    { status }
  );
}
