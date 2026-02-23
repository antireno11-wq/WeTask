import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, context: { params: { bookingId: string } }) {
  try {
    const identity = getRequestIdentity(req);
    if (!hasRole(identity.role, [UserRole.PRO, UserRole.ADMIN])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const booking = await prisma.booking.findUnique({ where: { id: context.params.bookingId } });
    if (!booking) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });

    if (!booking.proId) return NextResponse.json({ error: "Reserva sin profesional asignado" }, { status: 400 });

    if (identity.role === UserRole.PRO && identity.userId !== booking.proId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    if (booking.status !== "COMPLETED") {
      return NextResponse.json({ error: "El payout se solicita solo para reservas finalizadas" }, { status: 400 });
    }

    const existing = await prisma.payout.findUnique({ where: { bookingId: booking.id } });
    if (existing) {
      return NextResponse.json({ payout: existing }, { status: 200 });
    }

    const payoutAmount = Math.max(booking.totalPriceClp - booking.platformFeeClp, 0);

    const payout = await prisma.payout.create({
      data: {
        bookingId: booking.id,
        proId: booking.proId,
        amountClp: payoutAmount,
        status: "PENDING"
      }
    });

    return NextResponse.json({ payout }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo solicitar payout",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
