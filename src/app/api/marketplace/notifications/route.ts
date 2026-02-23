import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const identity = getRequestIdentity(req);
    if (!hasRole(identity.role, [UserRole.CUSTOMER, UserRole.PRO, UserRole.ADMIN])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const userId = req.nextUrl.searchParams.get("userId") ?? identity.userId;
    if (!userId) {
      return NextResponse.json({ error: "userId requerido" }, { status: 400 });
    }

    if (identity.role !== UserRole.ADMIN && identity.userId !== userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }],
      take: 30
    });

    return NextResponse.json({ notifications }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudieron cargar notificaciones",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
