import { PayoutStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set<string>(Object.values(PayoutStatus));

/**
 * Cola operacional de payouts (G5). Lista payouts por status para que el admin
 * VEA los que fallaron o quedaron atascados. Default: FAILED + PROCESSING
 * (los que requieren atención). Antes esto era invisible: los FAILED se
 * escribían pero ninguna pantalla los leía.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdminRequest(req);
  if (!admin.ok) return admin.response;

  const statusParam = req.nextUrl.searchParams.get("status");
  const statuses = statusParam
    ? statusParam
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((s) => VALID_STATUSES.has(s))
    : [PayoutStatus.FAILED, PayoutStatus.PROCESSING];

  const payouts = await prisma.payout.findMany({
    where: statuses.length > 0 ? { status: { in: statuses as PayoutStatus[] } } : undefined,
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: {
      pro: { select: { id: true, fullName: true, email: true } },
      booking: {
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          totalPriceClp: true,
          scheduledAt: true,
          service: { select: { name: true } },
          payment: { select: { escrowStatus: true, providerStatus: true } }
        }
      }
    }
  });

  // Conteo por status para badges.
  const counts = await prisma.payout.groupBy({
    by: ["status"],
    _count: { _all: true }
  });

  return NextResponse.json(
    {
      ok: true,
      filter: statuses,
      counts: counts.reduce<Record<string, number>>((acc, c) => {
        acc[c.status] = c._count._all;
        return acc;
      }, {}),
      payouts
    },
    { status: 200 }
  );
}
