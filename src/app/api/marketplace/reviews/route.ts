import { UserRole } from "@prisma/client";
import { safeErrorDetail } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { notifyReviewReceived } from "@/lib/notification-events";
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
      include: {
        pro: { select: { id: true, fullName: true, email: true } },
        customer: { select: { fullName: true } },
        service: { select: { name: true } }
      }
    });

    if (!booking) {
      return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
    }

    // BOOK-04: el servicio puede estar en PAYOUT_SCHEDULED (cliente ya confirmó, escrow aún
    // no liberado) o COMPLETED. En ambos el trabajo terminó y la reseña es válida.
    if (booking.status !== "COMPLETED" && booking.status !== "PAYOUT_SCHEDULED") {
      return NextResponse.json({ error: "Solo puedes reseñar reservas finalizadas" }, { status: 400 });
    }

    if (booking.customerId !== input.authorId) {
      return NextResponse.json({ error: "Solo el cliente de la reserva puede reseñar" }, { status: 403 });
    }

    // Crear review + recomputar rating del pro dentro de la misma transacción
    // (fix race condition del audit).
    const review = await prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
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
        const stats = await tx.review.aggregate({
          where: { booking: { proId: booking.proId } },
          _avg: { rating: true },
          _count: { rating: true }
        });
        await tx.professionalProfile.updateMany({
          where: { userId: booking.proId },
          data: {
            ratingAvg: stats._avg.rating ?? 0,
            ratingsCount: stats._count.rating
          }
        });
      }

      return created;
    });

    if (booking.proId && booking.pro) {
      await notifyReviewReceived({
        pro: {
          userId: booking.pro.id,
          email: booking.pro.email,
          fullName: booking.pro.fullName,
          role: "PRO"
        },
        customerName: booking.customer.fullName,
        serviceName: booking.service?.name ?? "el servicio",
        rating: input.rating,
        comment: input.comment ?? null,
        bookingId: input.bookingId
      });
    }

    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo crear la reseña",
        detail: safeErrorDetail(error)
      },
      { status: 400 }
    );
  }
}
