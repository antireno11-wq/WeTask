import { BookingStatus, UserRole } from "@prisma/client";
import { safeErrorDetail } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { notifyOnTheWay } from "@/lib/notification-events";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const VALID_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.ACCEPTED,
  BookingStatus.IN_PROGRESS
];

/**
 * El tasker avisa "voy en camino". No cambia status del booking, solo
 * setea onTheWayAt y notifica al cliente (in-app + email).
 * Idempotente: si ya estaba seteado en los últimos 60min, devuelve OK
 * sin re-notificar.
 */
export async function POST(req: NextRequest, context: { params: { bookingId: string } }) {
  try {
    const identity = getRequestIdentity(req);
    if (!identity.userId || !hasRole(identity.role, [UserRole.PRO, UserRole.ADMIN])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: context.params.bookingId },
      include: {
        customer: { select: { id: true, fullName: true, email: true } },
        pro: { select: { id: true, fullName: true, email: true } }
      }
    });
    if (!booking) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });

    if (identity.role === UserRole.PRO && identity.userId !== booking.proId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    if (!VALID_STATUSES.includes(booking.status)) {
      return NextResponse.json(
        { error: "Solo podés avisar que vas en camino en reservas confirmadas." },
        { status: 409 }
      );
    }

    const recentThreshold = new Date(Date.now() - 60 * 60 * 1000);
    if (booking.onTheWayAt && booking.onTheWayAt > recentThreshold) {
      return NextResponse.json({ ok: true, deduped: true, onTheWayAt: booking.onTheWayAt }, { status: 200 });
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { onTheWayAt: new Date() }
    });

    if (booking.customer && booking.pro) {
      await notifyOnTheWay({
        customer: {
          userId: booking.customer.id,
          email: booking.customer.email,
          fullName: booking.customer.fullName,
          role: "CUSTOMER"
        },
        pro: {
          userId: booking.pro.id,
          email: booking.pro.email,
          fullName: booking.pro.fullName,
          role: "PRO"
        },
        bookingId: booking.id,
        scheduledAt: booking.scheduledAt
      });
    }

    return NextResponse.json({ ok: true, onTheWayAt: updated.onTheWayAt }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo notificar", detail: safeErrorDetail(error) },
      { status: 500 }
    );
  }
}
