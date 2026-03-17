import { CleaningOnboardingStatus, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { normalizeCleaningScope } from "@/lib/cleaning-scope";
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
    ["categorySlug", onboarding.categorySlug],
    ["phoneValidatedAt", onboarding.phoneValidatedAt],
    ["profilePhotoUrl", onboarding.profilePhotoUrl],
    ["baseCommune", onboarding.baseCommune],
    ["referenceAddress", onboarding.referenceAddress],
    ["documentId", onboarding.documentId],
    ["yearsExperience", onboarding.yearsExperience],
    ["workMode", onboarding.workMode],
    ["offeredServices", onboarding.offeredServices],
    ["serviceCommunes", onboarding.serviceCommunes],
    ["coverageLatitude", onboarding.coverageLatitude],
    ["coverageLongitude", onboarding.coverageLongitude],
    ["availabilityBlocks", onboarding.availabilityBlocks],
    ["hourlyRateClp", onboarding.hourlyRateClp],
    ["minBookingHours", onboarding.minBookingHours],
    ["weekendSurchargePct", onboarding.weekendSurchargePct],
    ["holidaySurchargePct", onboarding.holidaySurchargePct],
    ["identityDocumentFrontFile", onboarding.identityDocumentFrontFile],
    ["identityDocumentBackFile", onboarding.identityDocumentBackFile],
    ["criminalRecordFile", onboarding.criminalRecordFile],
    ["bankAccountHolder", onboarding.bankAccountHolder],
    ["bankAccountHolderRut", onboarding.bankAccountHolderRut],
    ["bankName", onboarding.bankName],
    ["bankAccountType", onboarding.bankAccountType],
    ["bankAccountNumber", onboarding.bankAccountNumber],
    ["acceptsCancellationPolicy", onboarding.acceptsCancellationPolicy],
    ["acceptsServiceProtocol", onboarding.acceptsServiceProtocol],
    ["acceptsDataProcessing", onboarding.acceptsDataProcessing],
    ["confirmsCleaningScope", onboarding.confirmsCleaningScope]
  ];

  if (onboarding.categorySlug === "limpieza") {
    const cleaningScope = normalizeCleaningScope(onboarding.cleaningScope);
    required.splice(8, 0, [
      "cleaningScope",
      cleaningScope.services_offered.length > 0 && cleaningScope.tasks_included.length > 0 ? cleaningScope : null
    ]);
  }

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
          error: "Faltan campos obligatorios antes de enviar a revisión",
          missingFields
        },
        { status: 400 }
      );
    }

    const updated = await prisma.cleaningOnboarding.update({
      where: { userId: identity.userId },
      data: {
        status: CleaningOnboardingStatus.PENDIENTE_REVISION,
        currentStep: Math.max(onboarding?.currentStep ?? 1, 12),
        submittedAt: new Date(),
        adminReviewNotes: null
      }
    });

    return NextResponse.json({ ok: true, onboarding: updated }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo enviar perfil a revisión",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
