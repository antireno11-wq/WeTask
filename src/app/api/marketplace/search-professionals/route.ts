import { NextRequest, NextResponse } from "next/server";
import { distanceKm, geocodeAddress } from "@/lib/geo";
import { COVERAGE_UNAVAILABLE_MESSAGE, inferCommuneFromAddress, normalizeCommune, taskerServesCommune } from "@/lib/communes";
import { ensureMarketplaceDemoData } from "@/lib/marketplace-demo-data";
import { prisma } from "@/lib/prisma";
import { marketplaceSearchProsSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await ensureMarketplaceDemoData();

    const input = marketplaceSearchProsSchema.parse({
      city: req.nextUrl.searchParams.get("city") ?? undefined,
      commune: req.nextUrl.searchParams.get("commune") ?? undefined,
      postalCode: req.nextUrl.searchParams.get("postalCode") ?? undefined,
      street: req.nextUrl.searchParams.get("street") ?? undefined,
      latitude: req.nextUrl.searchParams.get("latitude") ?? undefined,
      longitude: req.nextUrl.searchParams.get("longitude") ?? undefined,
      categoryId: req.nextUrl.searchParams.get("categoryId") ?? undefined,
      serviceId: req.nextUrl.searchParams.get("serviceId") ?? undefined,
      date: req.nextUrl.searchParams.get("date") ?? undefined,
      limit: req.nextUrl.searchParams.get("limit") ?? undefined
    });

    const clientCommune =
      normalizeCommune(input.commune) ??
      inferCommuneFromAddress(`${input.street ?? ""}, ${input.city ?? ""}, Chile`);

    if (!clientCommune) {
      return NextResponse.json(
        {
          error: COVERAGE_UNAVAILABLE_MESSAGE
        },
        { status: 400 }
      );
    }

    const customerCoords =
      typeof input.latitude === "number" && typeof input.longitude === "number"
        ? { lat: input.latitude, lng: input.longitude }
        : geocodeAddress({
            city: input.city,
            postalCode: input.postalCode,
            street: input.street,
            commune: clientCommune
          });

    const startDate = input.date ?? new Date();

    const profiles = await prisma.professionalProfile.findMany({
      where: {
        isVerified: true,
        coverageCity: { equals: input.city, mode: "insensitive" },
        user: { role: "PRO" },
        taskerServices:
          input.serviceId || input.categoryId
            ? {
                some: {
                  isActive: true,
                  serviceId: input.serviceId ?? undefined,
                  categoryId: input.categoryId ?? undefined
                }
              }
            : undefined
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            cleaningOnboarding: {
              select: {
                serviceCommunes: true,
                baseCommune: true
              }
            }
          }
        },
        slots: {
          where: {
            isAvailable: true,
            startsAt: { gte: startDate },
            OR: input.serviceId ? [{ serviceId: null }, { serviceId: input.serviceId }] : undefined,
            service: input.categoryId && !input.serviceId ? { categoryId: input.categoryId } : undefined
          },
          orderBy: [{ startsAt: "asc" }],
          take: 12,
          include: { service: { select: { id: true, name: true } } }
        }
      }
    });

    const matched = profiles
      .map((profile) => {
        const servesCommune = taskerServesCommune(
          {
            serviceCommunes: profile.user.cleaningOnboarding?.serviceCommunes,
            coverageComuna: profile.coverageComuna ?? profile.user.cleaningOnboarding?.baseCommune
          },
          clientCommune
        );
        if (!servesCommune) return null;

        if (profile.coverageLatitude == null || profile.coverageLongitude == null) return null;

        const distance = distanceKm(customerCoords, {
          lat: profile.coverageLatitude,
          lng: profile.coverageLongitude
        });

        if (distance > profile.serviceRadiusKm) {
          return null;
        }

        return {
          ...profile,
          distanceKm: Number(distance.toFixed(2)),
          nextAvailableAt: profile.slots[0]?.startsAt ?? null
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .filter((item) => item.slots.length > 0)
      .sort((a, b) => {
        if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;

        const aTime = a.nextAvailableAt ? new Date(a.nextAvailableAt).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.nextAvailableAt ? new Date(b.nextAvailableAt).getTime() : Number.MAX_SAFE_INTEGER;
        if (aTime !== bTime) return aTime - bTime;

        const ratingDiff = Number(b.ratingAvg) - Number(a.ratingAvg);
        if (ratingDiff !== 0) return ratingDiff;

        const aRate = a.hourlyRateFromClp ?? Number.MAX_SAFE_INTEGER;
        const bRate = b.hourlyRateFromClp ?? Number.MAX_SAFE_INTEGER;
        return aRate - bRate;
      })
      .slice(0, input.limit);

    return NextResponse.json({
      customerLocation: {
        city: input.city,
        commune: clientCommune,
        postalCode: input.postalCode,
        coordinates: customerCoords
      },
      professionals: matched
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo buscar profesionales por direccion",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
