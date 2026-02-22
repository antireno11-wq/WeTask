import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { marketplaceReviewCreateSchema } from "@/lib/validators";

export async function POST(req: NextRequest) {
  try {
    const identity = getRequestIdentity(req);

    if (!hasRole(identity.role, [UserRole.CUSTOMER, UserRole.ADMIN])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const input = marketplaceReviewCreateSchema.parse(body);

    if (identity.role === UserRole.CUSTOMER && identity.userId && identity.userId !== input.authorId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: input.bookingId },
      include: { pro: true }
    });

    if (!booking) {
      return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
    }

    if (booking.status !== "COMPLETED") {
      return NextResponse.json({ error: "Solo puedes reseñar reservas finalizadas" }, { status: 400 });
    }

    if (booking.customerId !== input.authorId) {
      return NextResponse.json({ error: "Solo el cliente de la reserva puede reseñar" }, { status: 403 });
    }

    const review = await prisma.review.create({
      data: {
        bookingId: input.bookingId,
        authorId: input.authorId,
        rating: input.rating,
        punctuality: input.punctuality,
        quality: input.quality,
        communication: input.communication,
        comment: input.comment
      }
    });

    if (booking.proId) {
      const stats = await prisma.review.aggregate({
        where: { booking: { proId: booking.proId } },
        _avg: { rating: true },
        _count: { rating: true }
      });

      await prisma.professionalProfile.updateMany({
        where: { userId: booking.proId },
        data: {
          ratingAvg: stats._avg.rating ?? 0,
          ratingsCount: stats._count.rating
        }
      });
    }

    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo crear la reseña",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
