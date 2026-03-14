import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { ensureMarketplaceDemoData } from "@/lib/marketplace-demo-data";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await ensureMarketplaceDemoData();

    const identity = getRequestIdentity(req);

    if (!hasRole(identity.role, [UserRole.CUSTOMER, UserRole.ADMIN])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const customerId = req.nextUrl.searchParams.get("customerId") ?? identity.userId;
    if (!customerId) {
      return NextResponse.json({ error: "customerId requerido" }, { status: 400 });
    }

    if (identity.role === UserRole.CUSTOMER && identity.userId && identity.userId !== customerId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const bookings = await prisma.booking.findMany({
      where: { customerId },
      include: {
        service: { select: { id: true, name: true } },
        pro: { select: { id: true, fullName: true } },
        extras: true,
        payment: true,
        review: { select: { id: true, rating: true, comment: true } }
      },
      orderBy: [{ scheduledAt: "desc" }],
      take: 50
    });

    return NextResponse.json({ bookings }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudieron listar reservas del cliente",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
