import { NextRequest, NextResponse } from "next/server";
import { ensureMarketplaceDemoData } from "@/lib/marketplace-demo-data";
import { prisma } from "@/lib/prisma";
import { marketplaceListProsQuerySchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await ensureMarketplaceDemoData();

    const searchParams = req.nextUrl.searchParams;
    const input = marketplaceListProsQuerySchema.parse({
      categoryId: searchParams.get("categoryId") ?? undefined,
      serviceId: searchParams.get("serviceId") ?? undefined,
      city: searchParams.get("city") ?? undefined,
      minRating: searchParams.get("minRating") ?? undefined,
      verified: searchParams.get("verified") ?? undefined,
      maxHourlyRateClp: searchParams.get("maxHourlyRateClp") ?? undefined,
      limit: searchParams.get("limit") ?? undefined
    });

    const profiles = await prisma.professionalProfile.findMany({
      where: {
        isVerified: input.verified,
        ratingAvg: input.minRating ? { gte: input.minRating } : undefined,
        coverageCity: input.city ? { equals: input.city, mode: "insensitive" } : undefined,
        hourlyRateFromClp: input.maxHourlyRateClp ? { lte: input.maxHourlyRateClp } : undefined,
        slots:
          input.categoryId && !input.serviceId
            ? {
                some: {
                  isAvailable: true,
                  startsAt: { gte: new Date() },
                  service: { categoryId: input.categoryId }
                }
              }
            : undefined,
        user: { role: "PRO" }
      },
      orderBy: [{ isVerified: "desc" }, { ratingAvg: "desc" }, { ratingsCount: "desc" }],
      take: input.limit,
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        slots: {
          where: {
            isAvailable: true,
            startsAt: { gte: new Date() },
            OR: input.serviceId ? [{ serviceId: null }, { serviceId: input.serviceId }] : undefined,
            service: input.categoryId && !input.serviceId ? { categoryId: input.categoryId } : undefined
          },
          orderBy: [{ startsAt: "asc" }],
          take: 6,
          select: { startsAt: true, endsAt: true, serviceId: true, service: { select: { id: true, name: true } } }
        }
      }
    });
    return NextResponse.json({ professionals: profiles }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudieron listar profesionales",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
