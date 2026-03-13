import { CleaningOnboardingStatus, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { normalizeCommuneList } from "@/lib/communes";
import { prisma } from "@/lib/prisma";
import { cleaningOnboardingAdminActionSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

function deny() {
  return NextResponse.json({ error: "No autorizado" }, { status: 403 });
}

async function ensureCleaningTaskerService(userId: string) {
  const onboarding = await prisma.cleaningOnboarding.findUnique({ where: { userId } });
  if (!onboarding) return;
  const serviceCommunes = normalizeCommuneList(onboarding.serviceCommunes);
  if (serviceCommunes.length === 0) {
    throw new Error("El tasker no tiene comunas de servicio configuradas");
  }

  const profile = await prisma.professionalProfile.upsert({
    where: { userId },
    create: {
      userId,
      bio: onboarding.shortDescription,
      isVerified: true,
      verificationStatus: "APPROVED",
      coverageStreet: onboarding.referenceAddress,
      coverageComuna: onboarding.baseCommune,
      coverageCity: "Santiago",
      coverageLatitude: onboarding.coverageLatitude,
      coverageLongitude: onboarding.coverageLongitude,
      serviceRadiusKm: onboarding.maxTravelKm ?? 8,
      hourlyRateFromClp: onboarding.hourlyRateClp
    },
    update: {
      bio: onboarding.shortDescription,
      isVerified: true,
      verificationStatus: "APPROVED",
      coverageStreet: onboarding.referenceAddress,
      coverageComuna: onboarding.baseCommune,
      coverageLatitude: onboarding.coverageLatitude ?? undefined,
      coverageLongitude: onboarding.coverageLongitude ?? undefined,
      serviceRadiusKm: onboarding.maxTravelKm ?? undefined,
      hourlyRateFromClp: onboarding.hourlyRateClp
    }
  });

  const category = await prisma.category.findFirst({
    where: {
      isActive: true,
      OR: [{ slug: { contains: "limpieza" } }, { name: { contains: "Limpieza", mode: "insensitive" } }]
    },
    orderBy: [{ slug: "asc" }]
  });
  if (!category) return;

  const mainService = await prisma.service.findFirst({
    where: {
      categoryId: category.id,
      isActive: true,
      OR: [{ slug: { contains: "limpieza" } }, { name: { contains: "Limpieza", mode: "insensitive" } }]
    },
    orderBy: [{ basePriceClp: "asc" }]
  });
  if (!mainService) return;

  await prisma.taskerService.upsert({
    where: {
      professionalProfileId_serviceId: {
        professionalProfileId: profile.id,
        serviceId: mainService.id
      }
    },
    create: {
      professionalProfileId: profile.id,
      categoryId: category.id,
      serviceId: mainService.id,
      priceClp: onboarding.hourlyRateClp ?? mainService.basePriceClp,
      minBooking: onboarding.minBookingHours ?? category.minHours,
      isActive: true
    },
    update: {
      priceClp: onboarding.hourlyRateClp ?? mainService.basePriceClp,
      minBooking: onboarding.minBookingHours ?? category.minHours,
      isActive: true
    }
  });
}

export async function GET(req: NextRequest) {
  const identity = getRequestIdentity(req);
  if (!hasRole(identity.role, UserRole.ADMIN)) return deny();

  const status = req.nextUrl.searchParams.get("status") ?? undefined;

  const items = await prisma.cleaningOnboarding.findMany({
    where:
      status &&
      [
        CleaningOnboardingStatus.BORRADOR,
        CleaningOnboardingStatus.PENDIENTE_REVISION,
        CleaningOnboardingStatus.REQUIERE_CORRECCION,
        CleaningOnboardingStatus.APROBADO,
        CleaningOnboardingStatus.ACTIVO
      ].includes(status as CleaningOnboardingStatus)
        ? { status: status as CleaningOnboardingStatus }
        : undefined,
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    take: 300,
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          professionalProfile: {
            select: {
              isVerified: true,
              verificationStatus: true
            }
          }
        }
      }
    }
  });

  return NextResponse.json({ items }, { status: 200 });
}

export async function PATCH(req: NextRequest) {
  const identity = getRequestIdentity(req);
  if (!hasRole(identity.role, UserRole.ADMIN)) return deny();

  try {
    const body = await req.json();
    const input = cleaningOnboardingAdminActionSchema.parse(body);

    const onboarding = await prisma.cleaningOnboarding.findUnique({ where: { id: input.onboardingId } });
    if (!onboarding) {
      return NextResponse.json({ error: "Onboarding no encontrado" }, { status: 404 });
    }

    if (input.action === "request_correction") {
      const updated = await prisma.cleaningOnboarding.update({
        where: { id: input.onboardingId },
        data: {
          status: CleaningOnboardingStatus.REQUIERE_CORRECCION,
          reviewedAt: new Date(),
          adminReviewNotes: input.notes?.trim() || "Requiere ajustes antes de aprobar"
        }
      });
      return NextResponse.json({ ok: true, onboarding: updated }, { status: 200 });
    }

    if (input.action === "set_pending") {
      const updated = await prisma.cleaningOnboarding.update({
        where: { id: input.onboardingId },
        data: {
          status: CleaningOnboardingStatus.PENDIENTE_REVISION,
          adminReviewNotes: input.notes?.trim() || null
        }
      });
      return NextResponse.json({ ok: true, onboarding: updated }, { status: 200 });
    }

    if (input.action === "approve") {
      const updated = await prisma.cleaningOnboarding.update({
        where: { id: input.onboardingId },
        data: {
          status: CleaningOnboardingStatus.APROBADO,
          reviewedAt: new Date(),
          approvedAt: new Date(),
          adminReviewNotes: input.notes?.trim() || null
        }
      });
      return NextResponse.json({ ok: true, onboarding: updated }, { status: 200 });
    }

    if (onboarding.status !== CleaningOnboardingStatus.APROBADO) {
      return NextResponse.json({ error: "Solo perfiles aprobados se pueden activar" }, { status: 409 });
    }
    if (normalizeCommuneList(onboarding.serviceCommunes).length === 0) {
      return NextResponse.json(
        { error: "El tasker debe seleccionar al menos una comuna activa antes de activarse." },
        { status: 409 }
      );
    }

    await ensureCleaningTaskerService(onboarding.userId);

    const updated = await prisma.cleaningOnboarding.update({
      where: { id: input.onboardingId },
      data: {
        status: CleaningOnboardingStatus.ACTIVO,
        activatedAt: new Date(),
        adminReviewNotes: input.notes?.trim() || onboarding.adminReviewNotes || null
      }
    });

    return NextResponse.json({ ok: true, onboarding: updated }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo actualizar onboarding",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
