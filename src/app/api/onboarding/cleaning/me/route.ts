import { CleaningOnboardingStatus, Prisma, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  cleaningOnboardingSaveSchema,
  cleaningOnboardingStage2Schema,
  cleaningOnboardingStage3Schema,
  cleaningOnboardingStage4Schema,
  cleaningOnboardingStage5Schema,
  cleaningOnboardingStage6Schema,
  cleaningOnboardingStage7Schema,
  cleaningOnboardingStage8Schema
} from "@/lib/validators";

export const dynamic = "force-dynamic";

type Identity = ReturnType<typeof getRequestIdentity>;

function resolveTargetUserId(req: NextRequest, identity: Identity) {
  const queryUserId = req.nextUrl.searchParams.get("userId") ?? undefined;
  if (identity.role === UserRole.ADMIN && queryUserId) return queryUserId;
  return identity.userId ?? undefined;
}

async function ensureOnboardingForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      phone: true,
      professionalProfile: { select: { coverageComuna: true } },
      cleaningOnboarding: true
    }
  });

  if (!user || user.role !== UserRole.PRO) {
    throw new Error("Profesional no encontrado");
  }

  if (user.cleaningOnboarding) {
    return user.cleaningOnboarding;
  }

  return prisma.cleaningOnboarding.create({
    data: {
      userId,
      status: CleaningOnboardingStatus.BORRADOR,
      currentStep: 1,
      baseCommune: user.professionalProfile?.coverageComuna ?? null
    }
  });
}

function denyLockedOnboarding(status: CleaningOnboardingStatus, identityRole: UserRole | null) {
  if (identityRole === UserRole.ADMIN) return null;
  if (status === CleaningOnboardingStatus.PENDIENTE_REVISION) {
    return "Tu perfil esta pendiente de revision. Espera evaluacion del equipo o contacto de soporte.";
  }
  if (status === CleaningOnboardingStatus.APROBADO || status === CleaningOnboardingStatus.ACTIVO) {
    return "Tu perfil ya fue aprobado. Si necesitas cambios, contacta a soporte.";
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const identity = getRequestIdentity(req);
    if (!hasRole(identity.role, [UserRole.PRO, UserRole.ADMIN])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const userId = resolveTargetUserId(req, identity);
    if (!userId) return NextResponse.json({ error: "userId requerido" }, { status: 400 });

    if (identity.role === UserRole.PRO && identity.userId !== userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const onboarding = await ensureOnboardingForUser(userId);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, email: true, phone: true, role: true }
    });

    return NextResponse.json({ onboarding, user }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo cargar onboarding",
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

    const userId = resolveTargetUserId(req, identity);
    if (!userId) return NextResponse.json({ error: "userId requerido" }, { status: 400 });
    if (identity.role === UserRole.PRO && identity.userId !== userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const input = cleaningOnboardingSaveSchema.parse(body);

    const onboarding = await ensureOnboardingForUser(userId);
    const deniedReason = denyLockedOnboarding(onboarding.status, identity.role);
    if (deniedReason) {
      return NextResponse.json({ error: deniedReason }, { status: 409 });
    }

    let data: Prisma.CleaningOnboardingUpdateInput = {};

    if (input.step === 2) {
      const parsed = cleaningOnboardingStage2Schema.parse(input.payload);
      data = {
        profilePhotoUrl: parsed.profilePhotoUrl,
        shortDescription: parsed.shortDescription.trim(),
        yearsExperience: parsed.yearsExperience,
        workMode: parsed.workMode,
        experienceTypes: parsed.experienceTypes,
        currentStep: Math.max(onboarding.currentStep, 3)
      };
    }

    if (input.step === 3) {
      const parsed = cleaningOnboardingStage3Schema.parse(input.payload);
      data = {
        offeredServices: parsed.offeredServices,
        acceptsHomesWithPets: parsed.acceptsHomesWithPets,
        acceptsHomesWithChildren: parsed.acceptsHomesWithChildren,
        worksWithClientProducts: parsed.worksWithClientProducts,
        bringsOwnProducts: parsed.bringsOwnProducts,
        bringsOwnTools: parsed.bringsOwnTools,
        currentStep: Math.max(onboarding.currentStep, 4)
      };
    }

    if (input.step === 4) {
      const parsed = cleaningOnboardingStage4Schema.parse(input.payload);
      data = {
        baseCommune: parsed.baseCommune.trim(),
        serviceCommunes: parsed.serviceCommunes,
        maxTravelKm: parsed.maxTravelKm,
        chargesTravelExtra: parsed.chargesTravelExtra,
        currentStep: Math.max(onboarding.currentStep, 5)
      };
    }

    if (input.step === 5) {
      const parsed = cleaningOnboardingStage5Schema.parse(input.payload);
      data = {
        availabilityMode: parsed.availabilityMode,
        availabilityBlocks: parsed.availabilityBlocks,
        maxServicesPerDay: parsed.maxServicesPerDay,
        acceptsUrgentBookings: parsed.acceptsUrgentBookings,
        currentStep: Math.max(onboarding.currentStep, 6)
      };
    }

    if (input.step === 6) {
      const parsed = cleaningOnboardingStage6Schema.parse(input.payload);
      data = {
        hourlyRateClp: parsed.hourlyRateClp,
        minBookingHours: parsed.minBookingHours,
        weekendSurchargePct: parsed.weekendSurchargePct,
        holidaySurchargePct: parsed.holidaySurchargePct,
        remoteCommuneSurchargeClp: parsed.remoteCommuneSurchargeClp,
        deepCleaningHourlyRateClp: parsed.hasDeepCleaningRate ? parsed.deepCleaningHourlyRateClp ?? null : null,
        currentStep: Math.max(onboarding.currentStep, 7)
      };
    }

    if (input.step === 7) {
      const parsed = cleaningOnboardingStage7Schema.parse(input.payload);
      data = {
        identityDocumentFile: parsed.identityDocumentFile,
        identitySelfieFile: parsed.identitySelfieFile,
        criminalRecordFile: parsed.criminalRecordFile,
        bankAccountHolder: parsed.bankAccountHolder.trim(),
        bankName: parsed.bankName.trim(),
        bankAccountType: parsed.bankAccountType,
        bankAccountNumber: parsed.bankAccountNumber.trim(),
        currentStep: Math.max(onboarding.currentStep, 8)
      };
    }

    if (input.step === 8) {
      const parsed = cleaningOnboardingStage8Schema.parse(input.payload);
      data = {
        trainingTopics: parsed.completedTopics,
        trainingCompletedAt: new Date(),
        currentStep: Math.max(onboarding.currentStep, 9)
      };
    }

    const updated = await prisma.cleaningOnboarding.update({
      where: { userId },
      data
    });

    if (input.step === 4) {
      const payload = cleaningOnboardingStage4Schema.parse(input.payload);
      await prisma.professionalProfile.upsert({
        where: { userId },
        create: {
          userId,
          coverageComuna: payload.baseCommune,
          coverageCity: "Santiago",
          serviceRadiusKm: payload.maxTravelKm
        },
        update: {
          coverageComuna: payload.baseCommune,
          serviceRadiusKm: payload.maxTravelKm
        }
      });
    }

    if (input.step === 6) {
      const payload = cleaningOnboardingStage6Schema.parse(input.payload);
      await prisma.professionalProfile.upsert({
        where: { userId },
        create: {
          userId,
          hourlyRateFromClp: payload.hourlyRateClp,
          serviceRadiusKm: 8
        },
        update: {
          hourlyRateFromClp: payload.hourlyRateClp
        }
      });
    }

    return NextResponse.json({ ok: true, onboarding: updated }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo guardar etapa de onboarding",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
