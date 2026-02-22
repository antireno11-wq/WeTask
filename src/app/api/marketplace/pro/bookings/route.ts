import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const identity = getRequestIdentity(req);

    if (!hasRole(identity.role, [UserRole.PRO, UserRole.ADMIN])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const proId = req.nextUrl.searchParams.get("proId") ?? identity.userId;
    if (!proId) {
      return NextResponse.json({ error: "proId requerido" }, { status: 400 });
    }

    if (identity.role === UserRole.PRO && identity.userId && identity.userId !== proId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const bookings = await prisma.booking.findMany({
      where: { proId },
      include: {
        service: { select: { id: true, name: true } },
        customer: { select: { id: true, fullName: true, email: true } },
        extras: true,
        payout: true
      },
      orderBy: [{ scheduledAt: "asc" }],
      take: 50
    });

    return NextResponse.json({ bookings }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudieron listar reservas del profesional",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
