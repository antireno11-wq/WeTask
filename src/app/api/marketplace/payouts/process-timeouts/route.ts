import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin-access";
import { recordAdminAction } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";

const HOLD_HOURS = 24;

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminRequest(req);
    if (!admin.ok) return admin.response;

    const cutoff = new Date(Date.now() - HOLD_HOURS * 60 * 60 * 1000);

    const bookings = await prisma.booking.findMany({
      where: {
        status: "AWAITING_CUSTOMER_CONFIRMATION",
        paymentStatus: "PAID",
        payout: { is: null },
        updatedAt: { lte: cutoff }
      },
      include: {
        payout: true,
        disputes: {
          where: { status: { in: ["OPEN", "IN_REVIEW"] } },
          select: { id: true }
        }
      }
    });

    const eligible = bookings.filter((booking) => booking.disputes.length === 0 && booking.proId);

    const created = [] as { bookingId: string; payoutId: string; amountClp: number }[];

    for (const booking of eligible) {
      const payoutAmount = Math.max(booking.totalPriceClp - booking.platformFeeClp, 0);
      const payout = await prisma.payout.create({
        data: {
          bookingId: booking.id,
          proId: booking.proId!,
          amountClp: payoutAmount,
          status: "PENDING"
        }
      });

      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: "PAYOUT_SCHEDULED" }
      });

      await prisma.notification.createMany({
        data: [
          {
            userId: booking.proId!,
            bookingId: booking.id,
            title: "Payout programado automáticamente",
            body: "No hubo reclamo dentro del plazo. Tu pago quedó programado para el próximo ciclo automático de WeTask."
          },
          {
            userId: booking.customerId,
            bookingId: booking.id,
            title: "Servicio cerrado sin reclamo",
            body: "Se cumplió el plazo de revisión y el pago del profesional quedó programado automáticamente."
          }
        ]
      });

      created.push({ bookingId: booking.id, payoutId: payout.id, amountClp: payout.amountClp });
    }

    if (created.length > 0) {
      await recordAdminAction({
        actorId: admin.identity.userId,
        action: "payouts.process_timeouts",
        target: { type: "PayoutBatch" },
        after: {
          holdHours: HOLD_HOURS,
          reviewed: bookings.length,
          created: created.length,
          payouts: created
        }
      });
    }

    return NextResponse.json(
      {
        ok: true,
        holdHours: HOLD_HOURS,
        reviewed: bookings.length,
        created: created.length,
        payouts: created
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudieron procesar los payouts automáticos",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
