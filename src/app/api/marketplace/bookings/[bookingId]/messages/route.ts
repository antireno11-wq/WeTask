import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import {
  canShareContactDetails,
  messageContainsRestrictedContactInfo,
  PRE_CONFIRMATION_CHAT_BLOCK_MESSAGE
} from "@/lib/chat-safety";
import { prisma } from "@/lib/prisma";

const messageSchema = z.object({
  body: z.string().min(1).max(1000),
  imageUrl: z.string().url().optional()
});

async function canAccessBooking(identityUserId: string | null, role: UserRole | null, bookingId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return { ok: false, booking: null };
  if (role === UserRole.ADMIN) return { ok: true, booking };
  if (role === UserRole.CUSTOMER && identityUserId === booking.customerId) return { ok: true, booking };
  if (role === UserRole.PRO && identityUserId === booking.proId) return { ok: true, booking };
  return { ok: false, booking };
}

export async function GET(req: NextRequest, context: { params: { bookingId: string } }) {
  try {
    const identity = getRequestIdentity(req);
    if (!hasRole(identity.role, [UserRole.ADMIN, UserRole.CUSTOMER, UserRole.PRO])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const access = await canAccessBooking(identity.userId, identity.role, context.params.bookingId);
    if (!access.ok) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const messages = await prisma.message.findMany({
      where: { bookingId: context.params.bookingId },
      orderBy: [{ createdAt: "asc" }],
      include: { sender: { select: { id: true, fullName: true, role: true } } }
    });

    return NextResponse.json({ messages }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudieron cargar mensajes",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest, context: { params: { bookingId: string } }) {
  try {
    const identity = getRequestIdentity(req);
    if (!hasRole(identity.role, [UserRole.CUSTOMER, UserRole.PRO, UserRole.ADMIN]) || !identity.userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const access = await canAccessBooking(identity.userId, identity.role, context.params.bookingId);
    if (!access.ok) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    if (!access.booking) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });

    const body = await req.json();
    const input = messageSchema.parse(body);

    if (!canShareContactDetails(access.booking.status) && messageContainsRestrictedContactInfo(input.body)) {
      return NextResponse.json({ error: PRE_CONFIRMATION_CHAT_BLOCK_MESSAGE }, { status: 400 });
    }

    const message = await prisma.message.create({
      data: {
        bookingId: context.params.bookingId,
        senderId: identity.userId,
        body: input.body,
        imageUrl: input.imageUrl
      },
      include: { sender: { select: { id: true, fullName: true, role: true } } }
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo enviar mensaje",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
