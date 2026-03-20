import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { normalizeCommuneList } from "@/lib/communes";
import { prisma } from "@/lib/prisma";
import { marketplaceProProfileUpdateSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

function authorizedProId(req: NextRequest, identity: { userId: string | null; role: UserRole | null }) {
  const queryProId = req.nextUrl.searchParams.get("proId") ?? undefined;
  const targetProId = queryProId ?? identity.userId ?? undefined;
  if (!targetProId) return { error: "proId requerido" };
  if (identity.role === UserRole.PRO && identity.userId !== targetProId) return { error: "No autorizado" };
  return { targetProId };
}

export async function GET(req: NextRequest) {
  try {
    const identity = getRequestIdentity(req);
    if (!hasRole(identity.role, [UserRole.PRO, UserRole.ADMIN])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const auth = authorizedProId(req, identity);
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.error === "No autorizado" ? 403 : 400 });

    const user = await prisma.user.findUnique({
      where: { id: auth.targetProId },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        professionalProfile: {
          select: {
            id: true,
            avatarUrl: true,
            bio: true,
            isVerified: true,
            verificationStatus: true,
            coverageStreet: true,
            coverageComuna: true,
            coverageCity: true,
            coveragePostal: true,
            coverageLatitude: true,
            coverageLongitude: true,
            serviceRadiusKm: true,
            hourlyRateFromClp: true
          }
        },
        cleaningOnboarding: {
          select: {
            categorySlug: true,
            profilePhotoUrl: true,
            availabilityMode: true,
            availabilityBlocks: true,
            serviceCommunes: true,
            baseCommune: true
          }
        }
      }
    });

    if (!user || user.role !== UserRole.PRO) {
      return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });
    }

    const taskerServices = user.professionalProfile
      ? await prisma.taskerService.findMany({
          where: {
            professionalProfileId: user.professionalProfile.id,
            isActive: true
          },
          orderBy: [{ createdAt: "asc" }],
          select: {
            service: {
              select: {
                id: true,
                name: true
              }
            }
          }
        })
      : [];

    return NextResponse.json(
      {
        user: { id: user.id, fullName: user.fullName, email: user.email },
        profile: user.professionalProfile,
        categorySlug: user.cleaningOnboarding?.categorySlug ?? null,
        profilePhotoUrl: user.cleaningOnboarding?.profilePhotoUrl ?? user.professionalProfile?.avatarUrl ?? null,
        availabilityMode: user.cleaningOnboarding?.availabilityMode ?? null,
        availabilityBlocks: user.cleaningOnboarding?.availabilityBlocks ?? [],
        serviceCommunes: normalizeCommuneList(user.cleaningOnboarding?.serviceCommunes),
        baseCommune: user.cleaningOnboarding?.baseCommune ?? user.professionalProfile?.coverageComuna ?? null,
        taskerServices: taskerServices.map((item) => item.service)
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo cargar perfil del profesional",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const identity = getRequestIdentity(req);
    if (!hasRole(identity.role, [UserRole.PRO, UserRole.ADMIN])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const input = marketplaceProProfileUpdateSchema.parse(body);

    const targetProId = input.proId ?? identity.userId;
    if (!targetProId) {
      return NextResponse.json({ error: "proId requerido" }, { status: 400 });
    }

    if (identity.role === UserRole.PRO && identity.userId !== targetProId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({ where: { id: targetProId }, select: { role: true } });
    if (!user || user.role !== UserRole.PRO) {
      return NextResponse.json({ error: "Profesional no válido" }, { status: 400 });
    }

    const profile = await prisma.professionalProfile.upsert({
      where: { userId: targetProId },
      create: {
        userId: targetProId,
        bio: input.bio ?? null,
        coverageStreet: input.coverageStreet ?? null,
        coverageComuna: input.coverageComuna ?? null,
        coverageCity: input.coverageCity ?? null,
        coveragePostal: input.coveragePostal ?? null,
        coverageLatitude: input.coverageLatitude ?? null,
        coverageLongitude: input.coverageLongitude ?? null,
        serviceRadiusKm: input.serviceRadiusKm ?? 8,
        hourlyRateFromClp: input.hourlyRateFromClp ?? null
      },
      update: {
        bio: input.bio,
        coverageStreet: input.coverageStreet,
        coverageComuna: input.coverageComuna,
        coverageCity: input.coverageCity,
        coveragePostal: input.coveragePostal,
        coverageLatitude: input.coverageLatitude,
        coverageLongitude: input.coverageLongitude,
        serviceRadiusKm: input.serviceRadiusKm,
        hourlyRateFromClp: input.hourlyRateFromClp
      }
    });

    const normalizedServiceCommunes = input.serviceCommunes ? normalizeCommuneList(input.serviceCommunes) : null;
    if (normalizedServiceCommunes && normalizedServiceCommunes.length > 0) {
      const nextBaseCommune = input.coverageComuna ?? normalizedServiceCommunes[0] ?? null;
      await prisma.cleaningOnboarding.upsert({
        where: { userId: targetProId },
        create: {
          userId: targetProId,
          currentStep: 4,
          baseCommune: nextBaseCommune,
          serviceCommunes: normalizedServiceCommunes
        },
        update: {
          baseCommune: nextBaseCommune ?? undefined,
          serviceCommunes: normalizedServiceCommunes
        }
      });
    }

    return NextResponse.json({ profile, serviceCommunes: normalizedServiceCommunes ?? [] }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo actualizar perfil del profesional",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
