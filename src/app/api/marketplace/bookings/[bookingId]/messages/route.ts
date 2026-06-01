import { UserRole } from "@prisma/client";
import { safeErrorDetail } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import {
  canShareContactDetails,
  messageContainsRestrictedContactInfo,
  PRE_CONFIRMATION_CHAT_BLOCK_MESSAGE
} from "@/lib/chat-safety";
import { prisma } from "@/lib/prisma";
import { rateLimit, tooManyRequestsResponse } from "@/lib/rate-limit";

const messageSchema = z.object({
  body: z.string().min(1).max(1000),
  imageUrl: z.string().url().optional()
});

async function canAccessBooking(identityUserId: string | null, role: UserRole | null, bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: { select: { id: true, fullName: true } },
      pro: { select: { id: true, fullName: true } },
      service: { select: { name: true } }
    }
  });
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
        detail: safeErrorDetail(error)
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

    // BOOK-15: limita el spam de mensajes por usuario+reserva.
    const rl = await rateLimit("chat.message", `${identity.userId}:${context.params.bookingId}`, "20/m");
    if (!rl.success) return tooManyRequestsResponse(rl) as unknown as NextResponse;

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

    const recipientId =
      identity.userId === access.booking.customerId
        ? access.booking.proId
        : identity.userId === access.booking.proId
        ? access.booking.customerId
        : null;

    if (recipientId) {
      await prisma.notification.create({
        data: {
          userId: recipientId,
          bookingId: context.params.bookingId,
          title: "Nuevo mensaje en tu reserva",
          body: `${message.sender.fullName} te escribió sobre ${access.booking.service?.name ?? "tu servicio"}.`
        }
      });
    }

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo enviar mensaje",
        detail: safeErrorDetail(error)
      },
      { status: 400 }
    );
  }
}
