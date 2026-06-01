import { CleaningOnboardingStatus, PaymentStatus, PayoutStatus, TicketStatus } from "@prisma/client";
import { safeErrorDetail } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type DailyBucket = {
  date: string; // YYYY-MM-DD
  bookings: number;
  revenueClp: number;
};

/**
 * KPIs del dashboard admin:
 * - todayBookings: bookings creados hoy
 * - todayRevenueClp: suma de Payment.amountClp PAID creados hoy
 * - pendingTaskersReview: CleaningOnboarding PENDIENTE_REVISION
 * - pendingTaskersCorrection: CleaningOnboarding REQUIERE_CORRECCION
 * - openDisputes: DisputeTicket OPEN + IN_REVIEW
 * - pendingPayouts: Payout PENDING + PROCESSING
 * - last7Days: array de 7 días con {date, bookings, revenueClp}
 *
 * Reusable desde el page server-rendered o desde widgets con polling.
 * Cacheable a 60s vía Cache-Control si se quisiera.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdminRequest(req);
  if (!admin.ok) return admin.response;

  try {
    const now = new Date();
    const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const today = startOfDay(now);
    const sevenDaysAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);

    const [
      todayBookings,
      todayRevenue,
      pendingTaskersReview,
      pendingTaskersCorrection,
      openDisputes,
      pendingPayouts,
      failedPayouts,
      last7DaysBookings,
      last7DaysPayments
    ] = await Promise.all([
      prisma.booking.count({ where: { createdAt: { gte: today } } }),
      prisma.payment.aggregate({
        where: { status: PaymentStatus.PAID, createdAt: { gte: today } },
        _sum: { amountClp: true }
      }),
      prisma.cleaningOnboarding.count({
        where: { status: CleaningOnboardingStatus.PENDIENTE_REVISION }
      }),
      prisma.cleaningOnboarding.count({
        where: { status: CleaningOnboardingStatus.REQUIERE_CORRECCION }
      }),
      prisma.disputeTicket.count({
        where: { status: { in: [TicketStatus.OPEN, TicketStatus.IN_REVIEW] } }
      }),
      prisma.payout.count({
        where: { status: { in: [PayoutStatus.PENDING, PayoutStatus.PROCESSING] } }
      }),
      // G5: payouts fallidos requieren atención del operador.
      prisma.payout.count({ where: { status: PayoutStatus.FAILED } }),
      prisma.booking.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true }
      }),
      prisma.payment.findMany({
        where: { status: PaymentStatus.PAID, createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true, amountClp: true }
      })
    ]);

    const dailyMap = new Map<string, DailyBucket>();
    for (let i = 0; i < 7; i += 1) {
      const day = new Date(today.getTime() - (6 - i) * 24 * 60 * 60 * 1000);
      const key = day.toISOString().slice(0, 10);
      dailyMap.set(key, { date: key, bookings: 0, revenueClp: 0 });
    }
    for (const booking of last7DaysBookings) {
      const key = booking.createdAt.toISOString().slice(0, 10);
      const bucket = dailyMap.get(key);
      if (bucket) bucket.bookings += 1;
    }
    for (const payment of last7DaysPayments) {
      const key = payment.createdAt.toISOString().slice(0, 10);
      const bucket = dailyMap.get(key);
      if (bucket) bucket.revenueClp += payment.amountClp;
    }
    const last7Days = Array.from(dailyMap.values());

    return NextResponse.json(
      {
        todayBookings,
        todayRevenueClp: todayRevenue._sum.amountClp ?? 0,
        pendingTaskersReview,
        pendingTaskersCorrection,
        openDisputes,
        pendingPayouts,
        failedPayouts,
        last7Days
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudieron calcular stats",
        detail: safeErrorDetail(error)
      },
      { status: 500 }
    );
  }
}
