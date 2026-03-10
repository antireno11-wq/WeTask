import { CleaningOnboardingStatus, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function missing(value: unknown) {
  if (value == null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function listMissingFields(onboarding: Awaited<ReturnType<typeof prisma.cleaningOnboarding.findUnique>>) {
  if (!onboarding) return ["onboarding"];

  const required: Array<[string, unknown]> = [
    ["baseCommune", onboarding.baseCommune],
    ["profilePhotoUrl", onboarding.profilePhotoUrl],
    ["shortDescription", onboarding.shortDescription],
    ["yearsExperience", onboarding.yearsExperience],
    ["workMode", onboarding.workMode],
    ["experienceTypes", onboarding.experienceTypes],
    ["offeredServices", onboarding.offeredServices],
    ["acceptsHomesWithPets", onboarding.acceptsHomesWithPets],
    ["acceptsHomesWithChildren", onboarding.acceptsHomesWithChildren],
    ["worksWithClientProducts", onboarding.worksWithClientProducts],
    ["bringsOwnProducts", onboarding.bringsOwnProducts],
    ["bringsOwnTools", onboarding.bringsOwnTools],
    ["serviceCommunes", onboarding.serviceCommunes],
    ["maxTravelKm", onboarding.maxTravelKm],
    ["chargesTravelExtra", onboarding.chargesTravelExtra],
    ["availabilityMode", onboarding.availabilityMode],
    ["availabilityBlocks", onboarding.availabilityBlocks],
    ["maxServicesPerDay", onboarding.maxServicesPerDay],
    ["acceptsUrgentBookings", onboarding.acceptsUrgentBookings],
    ["hourlyRateClp", onboarding.hourlyRateClp],
    ["minBookingHours", onboarding.minBookingHours],
    ["weekendSurchargePct", onboarding.weekendSurchargePct],
    ["holidaySurchargePct", onboarding.holidaySurchargePct],
    ["remoteCommuneSurchargeClp", onboarding.remoteCommuneSurchargeClp],
    ["identityDocumentFile", onboarding.identityDocumentFile],
    ["identitySelfieFile", onboarding.identitySelfieFile],
    ["criminalRecordFile", onboarding.criminalRecordFile],
    ["bankAccountHolder", onboarding.bankAccountHolder],
    ["bankName", onboarding.bankName],
    ["bankAccountType", onboarding.bankAccountType],
    ["bankAccountNumber", onboarding.bankAccountNumber],
    ["phoneValidatedAt", onboarding.phoneValidatedAt],
    ["trainingTopics", onboarding.trainingTopics],
    ["trainingCompletedAt", onboarding.trainingCompletedAt]
  ];

  return required.filter(([, value]) => missing(value)).map(([field]) => field);
}

export async function POST(req: NextRequest) {
  try {
    const identity = getRequestIdentity(req);
    if (!hasRole(identity.role, [UserRole.PRO, UserRole.ADMIN]) || !identity.userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const onboarding = await prisma.cleaningOnboarding.findUnique({ where: { userId: identity.userId } });
    const missingFields = listMissingFields(onboarding);
    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: "Faltan campos obligatorios antes de enviar a revision",
          missingFields
        },
        { status: 400 }
      );
    }

    const updated = await prisma.cleaningOnboarding.update({
      where: { userId: identity.userId },
      data: {
        status: CleaningOnboardingStatus.PENDIENTE_REVISION,
        currentStep: 9,
        submittedAt: new Date(),
        adminReviewNotes: null
      }
    });

    return NextResponse.json({ ok: true, onboarding: updated }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo enviar perfil a revision",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
