import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendBookingStatusEmailToCustomer } from "@/lib/booking-status-email";
import { getRequestIdentity, hasRole } from "@/lib/auth";
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

    const ticket = await prisma.disputeTicket.create({
      data: {
        bookingId: input.bookingId,
        openedById: input.openedById,
        category: input.category,
        reason: input.reason,
        evidence: input.evidence,
        status: "OPEN"
      }
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "DISPUTE" }
    });

    const notifyIds = [booking.customerId, booking.proId].filter(Boolean) as string[];
    if (notifyIds.length > 0) {
      await prisma.notification.createMany({
        data: notifyIds.map((userId) => ({
          userId,
          bookingId: booking.id,
          title: "Disputa abierta",
          body: "El pago quedó retenido mientras WeTask revisa el caso."
        }))
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
