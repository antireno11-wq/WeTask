import { NextRequest, NextResponse } from "next/server";
import { safeErrorDetail } from "@/lib/logger";
import { ensureMarketplaceDemoData } from "@/lib/marketplace-demo-data";
import { prisma } from "@/lib/prisma";
import { marketplaceAvailabilityQuerySchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await ensureMarketplaceDemoData();

    const searchParams = req.nextUrl.searchParams;
    const input = marketplaceAvailabilityQuerySchema.parse({
      serviceId: searchParams.get("serviceId") ?? undefined,
      proId: searchParams.get("proId") ?? undefined,
      city: searchParams.get("city") ?? undefined,
      date: searchParams.get("date") ?? undefined,
      days: searchParams.get("days") ?? undefined,
      limit: searchParams.get("limit") ?? undefined
    });

    const now = new Date();
    const startsAt = input.date && input.date.getTime() > now.getTime() ? input.date : now;
    const endsAt = new Date(startsAt.getTime() + input.days * 24 * 60 * 60 * 1000);

    const slots = await prisma.availabilitySlot.findMany({
      where: {
        isAvailable: true,
        startsAt: { gte: startsAt, lt: endsAt },
        professionalProfile: {
          userId: input.proId,
          coverageCity: input.city ? { equals: input.city, mode: "insensitive" } : undefined,
          user: {
            role: "PRO",
            mpAccountStatus: "ACTIVE"
          }
        },
        // Combinamos dos filtros OR usando AND para no colisionar.
        AND: [
          // Excluir slots con hold vigente de OTRO usuario (5min mientras paga).
          { OR: [{ holdExpiresAt: null }, { holdExpiresAt: { lt: now } }] },
          // Filtrar por serviceId si viene.
          input.serviceId
            ? { OR: [{ serviceId: null }, { serviceId: input.serviceId }] }
            : {}
        ]
      },
      include: {
        professionalProfile: {
          include: {
            user: { select: { id: true, fullName: true, email: true } }
          }
        },
        service: { select: { id: true, name: true } }
      },
      orderBy: [{ startsAt: "asc" }],
      take: input.limit
    });

    return NextResponse.json({ slots }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo cargar disponibilidad",
        detail: safeErrorDetail(error)
      },
      { status: 400 }
    );
  }
}
