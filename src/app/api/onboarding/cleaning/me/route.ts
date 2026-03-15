import { CleaningOnboardingStatus, Prisma, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { geocodeAddress } from "@/lib/geo";
import { CLEANING_WEEK_DAYS } from "@/lib/cleaning-onboarding";
import { normalizeCommune, normalizeCommuneList } from "@/lib/communes";
import {
  PUBLIC_ONBOARDING_PHONE_COOKIE,
  PUBLIC_ONBOARDING_PHONE_VERIFIED_COOKIE
} from "@/lib/onboarding-phone";
import { prisma } from "@/lib/prisma";
import {
  cleaningOnboardingSaveSchema,
  taskerOnboardingStep10Schema,
  taskerOnboardingStep11Schema,
  taskerOnboardingStep3Schema,
  taskerOnboardingStep4Schema,
  taskerOnboardingStep5Schema,
  taskerOnboardingStep6Schema,
  taskerOnboardingStep7Schema,
  taskerOnboardingStep8Schema,
  taskerOnboardingStep9Schema
} from "@/lib/validators";

export const dynamic = "force-dynamic";

type Identity = ReturnType<typeof getRequestIdentity>;

function resolveTargetUserId(req: NextRequest, identity: Identity) {
  const queryUserId = req.nextUrl.searchParams.get("userId") ?? undefined;
  if (identity.role === UserRole.ADMIN && queryUserId) return queryUserId;
  return identity.userId ?? undefined;
}

function normalizeOnboardingCommunes(baseCommune: string, serviceCommunes: string[]) {
  const normalizedBase = normalizeCommune(baseCommune) ?? "Las Condes";
  const normalizedSet = new Set(normalizeCommuneList(serviceCommunes));
  normalizedSet.add(normalizedBase);
  return {
    baseCommune: normalizedBase,
    serviceCommunes: Array.from(normalizedSet)
  };
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

    if (input.step === 3) {
      const parsed = taskerOnboardingStep3Schema.parse(input.payload);
      const existingByEmail = await prisma.user.findFirst({
        where: {
          email: parsed.email.trim().toLowerCase(),
          NOT: { id: userId }
        },
        select: { id: true }
      });
      if (existingByEmail) {
        return NextResponse.json({ error: "Ese email ya esta registrado con otra cuenta" }, { status: 409 });
      }

      data = {
        profilePhotoUrl: parsed.profilePhotoUrl,
        documentId: parsed.documentId.trim(),
        baseCommune: parsed.baseCommune,
        referenceAddress: parsed.referenceAddress.trim(),
        currentStep: Math.max(onboarding.currentStep, 4)
      };

      const coords = geocodeAddress({
        city: "Santiago",
        street: parsed.referenceAddress.trim(),
        commune: parsed.baseCommune
      });

      await prisma.user.update({
        where: { id: userId },
        data: {
          fullName: parsed.fullName.trim(),
          email: parsed.email.trim().toLowerCase(),
          phone: parsed.phone.trim()
        }
      });

      await prisma.professionalProfile.upsert({
        where: { userId },
        create: {
          userId,
          coverageStreet: parsed.referenceAddress.trim(),
          coverageComuna: parsed.baseCommune,
          coverageCity: "Santiago",
          coverageLatitude: coords.lat,
          coverageLongitude: coords.lng,
          serviceRadiusKm: 8
        },
        update: {
          coverageStreet: parsed.referenceAddress.trim(),
          coverageComuna: parsed.baseCommune,
          coverageCity: "Santiago",
          coverageLatitude: coords.lat,
          coverageLongitude: coords.lng
        }
      });
    }

    if (input.step === 4) {
      const parsed = taskerOnboardingStep4Schema.parse(input.payload);
      const normalizedCoverage = normalizeOnboardingCommunes(parsed.baseCommune, parsed.serviceCommunes);
      const coords = geocodeAddress({
        city: "Santiago",
        street: onboarding.referenceAddress ?? normalizedCoverage.baseCommune,
        commune: normalizedCoverage.baseCommune
      });
      data = {
        baseCommune: normalizedCoverage.baseCommune,
        serviceCommunes: normalizedCoverage.serviceCommunes,
        coverageLatitude: coords.lat,
        coverageLongitude: coords.lng,
        maxTravelKm: 15,
        chargesTravelExtra: normalizedCoverage.serviceCommunes.includes("Chicureo"),
        remoteCommuneSurchargeClp: normalizedCoverage.serviceCommunes.includes("Chicureo") ? 5000 : 0,
        currentStep: Math.max(onboarding.currentStep, 5)
      };
    }

    if (input.step === 5) {
      const parsed = taskerOnboardingStep5Schema.parse(input.payload);
      data = {
        categorySlug: parsed.categorySlug.trim(),
        currentStep: Math.max(onboarding.currentStep, 6)
      };
    }

    if (input.step === 6) {
      const parsed = taskerOnboardingStep6Schema.parse(input.payload);
      data = {
        yearsExperience: parsed.yearsExperience === 11 ? 10 : parsed.yearsExperience,
        workMode: parsed.workMode,
        currentStep: Math.max(onboarding.currentStep, 7)
      };
    }

    if (input.step === 7) {
      const parsed = taskerOnboardingStep7Schema.parse(input.payload);
      data = {
        offeredServices: parsed.offeredServices,
        experienceTypes: parsed.experienceTypes,
        acceptsHomesWithPets: parsed.acceptsHomesWithPets ?? null,
        acceptsHomesWithChildren: parsed.acceptsHomesWithChildren ?? null,
        acceptsHomesWithElderly: parsed.acceptsHomesWithElderly ?? null,
        worksWithClientProducts: parsed.worksWithClientProducts ?? null,
        bringsOwnProducts: parsed.bringsOwnProducts ?? null,
        bringsOwnTools: parsed.bringsOwnTools ?? null,
        currentStep: Math.max(onboarding.currentStep, 8)
      };
    }

    if (input.step === 8) {
      const parsed = taskerOnboardingStep8Schema.parse(input.payload);
      const uniqueBlocks = parsed.availabilityBlocks.filter((block, index, blocks) => {
        const key = `${block.day}-${block.start}-${block.end}`;
        return blocks.findIndex((candidate) => `${candidate.day}-${candidate.start}-${candidate.end}` === key) === index;
      });

      data = {
        availabilityMode: "FIJA",
        availabilityBlocks: uniqueBlocks,
        maxServicesPerDay: 3,
        acceptsUrgentBookings: false,
        currentStep: Math.max(onboarding.currentStep, 9)
      };
    }

    if (input.step === 9) {
      const parsed = taskerOnboardingStep9Schema.parse(input.payload);
      data = {
        hourlyRateClp: parsed.hourlyRateClp,
        minBookingHours: parsed.minBookingHours,
        weekendSurchargePct: parsed.weekendSurchargePct,
        holidaySurchargePct: parsed.holidaySurchargePct,
        remoteCommuneSurchargeClp: parsed.remoteCommuneSurchargeClp,
        deepCleaningHourlyRateClp: null,
        currentStep: Math.max(onboarding.currentStep, 10)
      };
    }

    if (input.step === 10) {
      const parsed = taskerOnboardingStep10Schema.parse(input.payload);
      data = {
        bankAccountHolder: parsed.bankAccountHolder.trim(),
        bankAccountHolderRut: parsed.bankAccountHolderRut.trim(),
        bankName: parsed.bankName.trim(),
        bankAccountType: parsed.bankAccountType,
        bankAccountNumber: parsed.bankAccountNumber.trim(),
        identityDocumentFrontFile: parsed.identityDocumentFrontFile,
        identityDocumentBackFile: parsed.identityDocumentBackFile,
        criminalRecordFile: parsed.criminalRecordFile,
        billingType: "persona_natural",
        currentStep: Math.max(onboarding.currentStep, 11)
      };
    }

    if (input.step === 11) {
      taskerOnboardingStep11Schema.parse(input.payload);
      data = {
        acceptsCancellationPolicy: true,
        acceptsServiceProtocol: true,
        acceptsDataProcessing: true,
        confirmsCleaningScope: true,
        trainingTopics: CLEANING_WEEK_DAYS,
        trainingCompletedAt: new Date(),
        currentStep: Math.max(onboarding.currentStep, 12)
      };

      await prisma.user.update({
        where: { id: userId },
        data: { termsAcceptedAt: new Date() }
      });
    }

    const updated = await prisma.cleaningOnboarding.update({
      where: { userId },
      data
    });

    if (input.step === 4 || input.step === 9) {
      await prisma.professionalProfile.upsert({
        where: { userId },
        create: {
          userId,
          coverageStreet: updated.referenceAddress,
          coverageComuna: updated.baseCommune,
          coverageCity: "Santiago",
          coverageLatitude: updated.coverageLatitude,
          coverageLongitude: updated.coverageLongitude,
          serviceRadiusKm: updated.maxTravelKm ?? 15,
          hourlyRateFromClp: updated.hourlyRateClp
        },
        update: {
          coverageStreet: updated.referenceAddress ?? undefined,
          coverageComuna: updated.baseCommune ?? undefined,
          coverageCity: "Santiago",
          coverageLatitude: updated.coverageLatitude ?? undefined,
          coverageLongitude: updated.coverageLongitude ?? undefined,
          serviceRadiusKm: updated.maxTravelKm ?? undefined,
          hourlyRateFromClp: updated.hourlyRateClp ?? undefined
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

export async function DELETE(req: NextRequest) {
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

    const onboarding = await prisma.cleaningOnboarding.findUnique({
      where: { userId },
      select: { id: true, status: true }
    });

    if (
      onboarding &&
      (onboarding.status === CleaningOnboardingStatus.APROBADO || onboarding.status === CleaningOnboardingStatus.ACTIVO)
    ) {
      return NextResponse.json(
        { error: "Tu perfil ya esta aprobado o activo. Si necesitas reiniciarlo, contacta a soporte." },
        { status: 409 }
      );
    }

    if (onboarding) {
      await prisma.cleaningOnboarding.delete({ where: { userId } });
    }

    const response = NextResponse.json({ ok: true, reset: true }, { status: 200 });
    response.cookies.set(PUBLIC_ONBOARDING_PHONE_COOKIE, "", { maxAge: 0, path: "/" });
    response.cookies.set(PUBLIC_ONBOARDING_PHONE_VERIFIED_COOKIE, "", { maxAge: 0, path: "/" });
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo reiniciar onboarding",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
