import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createDisputeSchema = z.object({
  bookingId: z.string().min(1),
  openedById: z.string().min(1),
  reason: z.string().min(5).max(1000)
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
        reason: input.reason,
        status: "OPEN"
      }
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
