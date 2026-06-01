import { NextRequest, NextResponse } from "next/server";
import { ensureMarketplaceDemoData } from "@/lib/marketplace-demo-data";
import { prisma } from "@/lib/prisma";
import { marketplaceListProsQuerySchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

function buildSlotFiltersForCategory(categoryId?: string, serviceId?: string) {
  if (serviceId) {
    return [{ serviceId: null }, { serviceId }];
  }

  if (categoryId) {
    return [{ serviceId: null }, { service: { categoryId } }];
  }

  return undefined;
}

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

    const slotFilters = buildSlotFiltersForCategory(input.categoryId, input.serviceId);

    const profiles = await prisma.professionalProfile.findMany({
      where: {
        // PRO-04: este endpoint es público — sólo mostramos pros verificados y activos,
        // nunca perfiles a medio aprobar. El query param `verified` ya no puede relajarlo.
        isVerified: true,
        verificationStatus: "ACTIVE",
        ratingAvg: input.minRating ? { gte: input.minRating } : undefined,
        coverageCity: input.city ? { equals: input.city, mode: "insensitive" } : undefined,
        hourlyRateFromClp: input.maxHourlyRateClp ? { lte: input.maxHourlyRateClp } : undefined,
        slots:
          input.categoryId && !input.serviceId
            ? {
                some: {
                  isAvailable: true,
                  startsAt: { gte: new Date() },
                  OR: slotFilters
                }
              }
            : undefined,
        user: { role: "PRO" }
      },
      orderBy: [{ isVerified: "desc" }, { ratingAvg: "desc" }, { ratingsCount: "desc" }],
      take: input.limit,
      include: {
        // PRO-04: no exponer email en el listado público.
        user: { select: { id: true, fullName: true } },
        taskerServices: {
          where: {
            isActive: true,
            serviceId: input.serviceId ?? undefined,
            categoryId: input.categoryId ?? undefined
          },
          select: {
            priceClp: true
          }
        },
        slots: {
          where: {
            isAvailable: true,
            startsAt: { gte: new Date() },
            OR: slotFilters
          },
          orderBy: [{ startsAt: "asc" }],
          take: 6,
          select: { startsAt: true, endsAt: true, serviceId: true, service: { select: { id: true, name: true } } }
        }
      }
    });
    const normalized = profiles.map((profile) => ({
      ...profile,
      hourlyRateFromClp: profile.taskerServices[0]?.priceClp ?? profile.hourlyRateFromClp
    }));
    return NextResponse.json({ professionals: normalized }, { status: 200 });
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
