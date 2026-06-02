import { BookingStatus, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import {
  canTransition,
  InvalidBookingTransitionError
} from "@/lib/booking-state-machine";
import { notifyCheckedIn } from "@/lib/notification-events";
import { prisma } from "@/lib/prisma";
import { isStorageKey } from "@/lib/storage/r2";

export const dynamic = "force-dynamic";

const STORAGE_KEY_REGEX = /^users\/[a-zA-Z0-9_-]+\/check_in_photo\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/i;

const checkInSchema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  photoKey: z
    .string()
    .max(300)
    .optional()
    .refine(
      (value) => !value || isStorageKey(value) || STORAGE_KEY_REGEX.test(value),
      "photoKey debe ser una storage key válida"
    )
});

const VALID_STATUSES_FOR_CHECK_IN: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.ACCEPTED,
  BookingStatus.IN_PROGRESS
];

/**
 * El tasker marca llegada. Persiste timestamp + geo opcional + foto opcional.
 * Si el booking está en CONFIRMED/ACCEPTED, transiciona a IN_PROGRESS.
 * Idempotente: si ya hay checkInAt no lo sobrescribe.
 */
export async function POST(req: NextRequest, context: { params: { bookingId: string } }) {
  try {
    const identity = getRequestIdentity(req);
    if (!identity.userId || !hasRole(identity.role, [UserRole.PRO, UserRole.ADMIN])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    let input: z.infer<typeof checkInSchema>;
    try {
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      input = checkInSchema.parse(body);
    } catch (err) {
      return NextResponse.json(
        { error: "Datos de check-in inválidos", detail: err instanceof Error ? err.message : "bad_request" },
        { status: 400 }
      );
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
    if (!VALID_STATUSES_FOR_CHECK_IN.includes(booking.status)) {
      return NextResponse.json(
        { error: "Solo podés hacer check-in en reservas confirmadas.", from: booking.status },
        { status: 409 }
      );
    }
    if (booking.paymentStatus !== "PAID") {
      return NextResponse.json({ error: "El pago debe estar confirmado antes del check-in." }, { status: 409 });
    }

    const alreadyCheckedIn = Boolean(booking.checkInAt);
    const now = new Date();
    const nextStatus =
      booking.status === BookingStatus.IN_PROGRESS
        ? BookingStatus.IN_PROGRESS
        : canTransition(booking.status, BookingStatus.IN_PROGRESS, "PRO")
          ? BookingStatus.IN_PROGRESS
          : booking.status;

    try {
      const updated = await prisma.$transaction(async (tx) => {
        return tx.booking.update({
          where: { id: booking.id },
          data: {
            checkInAt: alreadyCheckedIn ? booking.checkInAt : now,
            checkInLat: alreadyCheckedIn ? booking.checkInLat : input.lat ?? null,
            checkInLng: alreadyCheckedIn ? booking.checkInLng : input.lng ?? null,
            checkInPhotoKey: input.photoKey ?? booking.checkInPhotoKey ?? null,
            status: nextStatus
          },
          select: {
            id: true,
            status: true,
            checkInAt: true,
            checkInLat: true,
            checkInLng: true,
            checkInPhotoKey: true
          }
        });
      });

      if (!alreadyCheckedIn && booking.customer && booking.pro) {
        await notifyCheckedIn({
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
          checkInAt: now
        });
      }

      return NextResponse.json({ ok: true, booking: updated }, { status: 200 });
    } catch (err) {
      if (err instanceof InvalidBookingTransitionError) {
        return NextResponse.json(
          { error: `Transición inválida ${err.from} → ${err.to}` },
          { status: 409 }
        );
      }
      throw err;
    }
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo registrar el check-in", detail: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
