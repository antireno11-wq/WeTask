import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { updateBookingStatusSchema } from "@/lib/validators";

export async function PATCH(req: NextRequest, context: { params: { bookingId: string } }) {
  try {
    const body = await req.json();
    const input = updateBookingStatusSchema.parse(body);

    const booking = await prisma.booking.findUnique({
      where: { id: context.params.bookingId }
    });

    if (!booking) {
      return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
    }

    if (input.proId) {
      const pro = await prisma.user.findUnique({ where: { id: input.proId } });
      if (!pro || pro.role !== UserRole.PRO) {
        return NextResponse.json({ error: "Prestador no válido" }, { status: 400 });
      }
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: context.params.bookingId },
      data: {
        status: input.status,
        proId: input.proId ?? booking.proId
      }
    });

    return NextResponse.json({ booking: updatedBooking }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo actualizar la reserva",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
