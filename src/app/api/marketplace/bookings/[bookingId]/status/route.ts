import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { marketplaceBookingStatusUpdateSchema } from "@/lib/validators";

export async function PATCH(req: NextRequest, context: { params: { bookingId: string } }) {
  try {
    const identity = getRequestIdentity(req);

    if (!hasRole(identity.role, [UserRole.ADMIN, UserRole.PRO])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const input = marketplaceBookingStatusUpdateSchema.parse(body);

    const booking = await prisma.booking.findUnique({ where: { id: context.params.bookingId } });

    if (!booking) {
      return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
    }

    if (identity.role === UserRole.PRO && identity.userId && booking.proId !== identity.userId) {
      return NextResponse.json({ error: "Solo puedes actualizar tus propias reservas" }, { status: 403 });
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: input.status }
    });

    return NextResponse.json({ booking: updated }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo actualizar el estado",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
