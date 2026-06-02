import { BookingStatus, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendBookingStatusEmailToCustomer } from "@/lib/booking-status-email";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import {
  assertTransition,
  type BookingActor,
  InvalidBookingTransitionError
} from "@/lib/booking-state-machine";
import { notifyDisputeOpened } from "@/lib/notification-events";
import { prisma } from "@/lib/prisma";

const createDisputeSchema = z.object({
  bookingId: z.string().min(1),
  openedById: z.string().min(1),
  category: z.string().min(2).max(120).optional(),
  reason: z.string().min(5).max(1000),
  evidence: z
    .array(
      z.object({
        name: z.string().min(1).max(180),
        type: z.string().min(1).max(120),
        size: z.number().int().min(1).max(2_000_000),
        dataUrl: z.string().min(20).max(3_000_000)
      })
    )
    .max(3)
    .optional()
});

export async function POST(req: NextRequest) {
  try {
    const identity = getRequestIdentity(req);
    if (!hasRole(identity.role, [UserRole.CUSTOMER, UserRole.PRO, UserRole.ADMIN])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const input = createDisputeSchema.parse(body);

    if (identity.role !== UserRole.ADMIN && identity.userId !== input.openedById) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const booking = await prisma.booking.findUnique({ where: { id: input.bookingId } });
    if (!booking) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });

    const allowed = booking.customerId === input.openedById || booking.proId === input.openedById || identity.role === UserRole.ADMIN;
    if (!allowed) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const actor: BookingActor =
      identity.role === UserRole.ADMIN
        ? "ADMIN"
        : identity.userId === booking.customerId
          ? "CUSTOMER"
          : "PRO";
    try {
      assertTransition(booking.status, BookingStatus.DISPUTE, actor);
    } catch (transitionError) {
      if (transitionError instanceof InvalidBookingTransitionError) {
        return NextResponse.json(
          { error: "Esta reserva no permite abrir un reclamo en su estado actual.", from: transitionError.from },
          { status: 409 }
        );
      }
      throw transitionError;
    }

    // Ventana de reclamo: solo se puede disputar dentro de los N días desde que
    // el tasker cerró el servicio (checkOutAt). Pasado ese plazo el servicio se
    // considera cerrado y no se aceptan disputas (G9). El admin no tiene límite.
    const DISPUTE_WINDOW_DAYS = Number(process.env.DISPUTE_WINDOW_DAYS) || 3;
    if (identity.role !== UserRole.ADMIN && booking.checkOutAt) {
      const windowEndMs = booking.checkOutAt.getTime() + DISPUTE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
      if (Date.now() > windowEndMs) {
        return NextResponse.json(
          { error: `El plazo para abrir un reclamo (${DISPUTE_WINDOW_DAYS} días desde el servicio) ya venció.` },
          { status: 409 }
        );
      }
    }

    const dueDateAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

    const ticket = await prisma.disputeTicket.create({
      data: {
        bookingId: input.bookingId,
        openedById: input.openedById,
        category: input.category,
        reason: input.reason,
        evidence: input.evidence,
        status: "OPEN",
        dueDateAt
      }
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.DISPUTE }
    });

    // Notificaciones in-app + email vía helper centralizado.
    const parties = await prisma.user.findMany({
      where: { id: { in: [booking.customerId, booking.proId].filter(Boolean) as string[] } },
      select: { id: true, fullName: true, email: true }
    });
    const customerUser = parties.find((u) => u.id === booking.customerId);
    const proUser = parties.find((u) => u.id === booking.proId);

    if (customerUser) {
      await notifyDisputeOpened({
        customer: {
          userId: customerUser.id,
          email: customerUser.email,
          fullName: customerUser.fullName,
          role: "CUSTOMER"
        },
        pro: proUser
          ? { userId: proUser.id, email: proUser.email, fullName: proUser.fullName, role: "PRO" }
          : null,
        bookingId: booking.id,
        reason: input.reason
      });
    }

    void sendBookingStatusEmailToCustomer({
      bookingId: booking.id,
      previousStatus: booking.status,
      nextStatus: "DISPUTE"
    });

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo crear disputa",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
