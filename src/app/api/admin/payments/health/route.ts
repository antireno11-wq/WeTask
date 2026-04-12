import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { checkMercadoPagoHealth } from "@/lib/payments/providers/mercadopago";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const identity = getRequestIdentity(req);
  if (!hasRole(identity.role, [UserRole.ADMIN])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

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
