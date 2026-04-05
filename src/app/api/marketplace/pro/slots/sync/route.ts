import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { syncTaskerAvailabilitySlotsFromOnboarding } from "@/lib/tasker-publication";

export const dynamic = "force-dynamic";

function resolveTargetProId(req: NextRequest, identity: { userId: string | null; role: UserRole | null }, bodyProId?: string) {
  const queryProId = req.nextUrl.searchParams.get("proId") ?? undefined;
  const targetProId = bodyProId ?? queryProId ?? identity.userId ?? undefined;
  if (!targetProId) return { error: "proId requerido" } as const;
  if (identity.role === UserRole.PRO && identity.userId !== targetProId) return { error: "No autorizado" } as const;
  return { targetProId } as const;
}

export async function POST(req: NextRequest) {
  try {
    const identity = getRequestIdentity(req);
    if (!hasRole(identity.role, [UserRole.PRO, UserRole.ADMIN])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as { proId?: string };
    const resolved = resolveTargetProId(req, identity, body.proId);
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.error === "No autorizado" ? 403 : 400 });
    }

    const result = await syncTaskerAvailabilitySlotsFromOnboarding(resolved.targetProId, 8);
    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo sincronizar la disponibilidad semanal",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
