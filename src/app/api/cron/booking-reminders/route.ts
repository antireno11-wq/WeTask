import { BookingStatus, Prisma } from "@prisma/client";
import { logError, safeErrorDetail } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { recordAdminAction } from "@/lib/audit-log";
import { notifyBookingReminder } from "@/lib/notification-events";
import { prisma } from "@/lib/prisma";
import { assertQStashRequest } from "@/lib/qstash";

export const dynamic = "force-dynamic";

const WINDOW_MINUTES = 30; // ventana de tolerancia para no perder reservas

const REMINDER_WINDOWS = [
  { hoursUntil: 24, marker: "REMINDER_24H", sentField: "reminder24hSentAt" },
  { hoursUntil: 1, marker: "REMINDER_1H", sentField: "reminder1hSentAt" }
] as const;

/**
 * Cron handler invocado por QStash cada 15 minutos.
 * Encuentra reservas CONFIRMED/ACCEPTED/IN_PROGRESS que arrancan en
 * ~24h o ~1h y dispara recordatorios in-app + email tanto al cliente
 * como al tasker. Idempotencia simple: revisa si ya existe Notification
 * con título conocido para ese booking en las últimas 6h, y si sí, skip.
 */
export async function POST(req: NextRequest) {
  const verdict = await assertQStashRequest(req);
  if (!verdict.ok) return verdict.response as NextResponse;

  const now = new Date();
  let totalSent = 0;
  let totalSkipped = 0;
  const details: Array<{ bookingId: string; hoursUntil: number; sent: number }> = [];

  try {
    for (const window of REMINDER_WINDOWS) {
      const targetMs = now.getTime() + window.hoursUntil * 60 * 60 * 1000;
      const lowerBound = new Date(targetMs - WINDOW_MINUTES * 60 * 1000);
      const upperBound = new Date(targetMs + WINDOW_MINUTES * 60 * 1000);

      const bookings = await prisma.booking.findMany({
        where: {
          status: {
            in: [BookingStatus.CONFIRMED, BookingStatus.ACCEPTED, BookingStatus.IN_PROGRESS]
          },
          scheduledAt: { gte: lowerBound, lte: upperBound },
          // BOOK-12: idempotencia persistente — sólo los que aún no recibieron este recordatorio.
          [window.sentField]: null
        },
        include: {
          customer: { select: { id: true, fullName: true, email: true } },
          pro: { select: { id: true, fullName: true, email: true } },
          service: { select: { name: true } }
        }
      });

      for (const booking of bookings) {
        // BOOK-12: marcamos el flag ANTES de notificar (claim atómico) para que dos
        // ejecuciones solapadas del cron no envíen el mismo recordatorio dos veces.
        const claim = await prisma.booking.updateMany({
          where: { id: booking.id, [window.sentField]: null },
          data: { [window.sentField]: now }
        });
        if (claim.count === 0) {
          totalSkipped += 1;
          continue;
        }

        const bookingCtx = {
          id: booking.id,
          serviceName: booking.service?.name ?? "Tu servicio",
          scheduledAt: booking.scheduledAt,
          address: [booking.addressLine1, booking.comuna].filter(Boolean).join(", "),
          totalClp: booking.totalPriceClp
        };

        let sentForBooking = 0;

        try {
          await notifyBookingReminder({
            recipient: {
              userId: booking.customer.id,
              email: booking.customer.email,
              fullName: booking.customer.fullName,
              role: "CUSTOMER"
            },
            booking: bookingCtx,
            hoursUntil: window.hoursUntil
          });
          sentForBooking += 1;
        } catch (err) {
          logError("cron-reminders.customer_notify", err, { bookingId: booking.id });
        }

        if (booking.pro) {
          try {
            await notifyBookingReminder({
              recipient: {
                userId: booking.pro.id,
                email: booking.pro.email,
                fullName: booking.pro.fullName,
                role: "PRO"
              },
              booking: bookingCtx,
              hoursUntil: window.hoursUntil
            });
            sentForBooking += 1;
          } catch (err) {
            logError("cron-reminders.pro_notify", err, { bookingId: booking.id });
          }
        }

        totalSent += sentForBooking;
        details.push({
          bookingId: booking.id,
          hoursUntil: window.hoursUntil,
          sent: sentForBooking
        });
      }
    }

    if (totalSent > 0 || details.length > 0) {
      await recordAdminAction({
        actorId: null,
        action: "cron.booking_reminders",
        target: { type: "NotificationBatch" },
        after: { totalSent, totalSkipped, details } as unknown as Prisma.InputJsonValue
      }).catch(() => null);
    }

    return NextResponse.json(
      { ok: true, sent: totalSent, skipped: totalSkipped, details },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Error en cron de recordatorios",
        detail: safeErrorDetail(error)
      },
      { status: 500 }
    );
  }
}
