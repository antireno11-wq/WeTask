import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { marketplaceProReviewCreateSchema } from "@/lib/validators";

export async function POST(req: NextRequest, context: { params: { bookingId: string } }) {
  try {
    const identity = getRequestIdentity(req);

    if (!hasRole(identity.role, [UserRole.PRO, UserRole.ADMIN])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const input = marketplaceProReviewCreateSchema.parse({ ...body, bookingId: context.params.bookingId });

    const booking = await prisma.booking.findUnique({
      where: { id: input.bookingId },
      select: {
        id: true,
        proId: true,
        customerId: true,
        status: true,
        proReviewRating: true,
        proReviewComment: true
      }
    });

    if (!booking) {
      return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
    }

    if (identity.role === UserRole.PRO && identity.userId !== booking.proId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    if (booking.status !== "COMPLETED") {
      return NextResponse.json({ error: "Solo puedes reseñar clientes en reservas finalizadas" }, { status: 400 });
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        proReviewRating: input.rating,
        proReviewComment: input.comment,
        proReviewedAt: new Date()
      },
      select: {
        id: true,
        proReviewRating: true,
        proReviewComment: true,
        proReviewedAt: true
      }
    });

    return NextResponse.json({ review: updatedBooking }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo guardar la reseña del cliente",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
