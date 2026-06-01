import { UserRole } from "@prisma/client";
import { safeErrorDetail } from "@/lib/logger";
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
        proReviewComment: true,
        proReviewedAt: true
      }
    });

    if (!booking) {
      return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
    }

    if (identity.role === UserRole.PRO && identity.userId !== booking.proId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // BOOK-04: permitido desde PAYOUT_SCHEDULED (cliente ya confirmó) o COMPLETED.
    if (booking.status !== "COMPLETED" && booking.status !== "PAYOUT_SCHEDULED") {
      return NextResponse.json({ error: "Solo puedes reseñar clientes en reservas finalizadas" }, { status: 400 });
    }

    if (booking.proReviewedAt) {
      return NextResponse.json(
        { error: "Ya enviaste tu reseña para esta reserva" },
        { status: 409 }
      );
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
        detail: safeErrorDetail(error)
      },
      { status: 400 }
    );
  }
}
