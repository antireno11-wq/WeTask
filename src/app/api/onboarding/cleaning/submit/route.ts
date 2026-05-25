import { CleaningOnboardingStatus, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { normalizeBabysitterScope } from "@/lib/babysitter-scope";
import { normalizeChefScope } from "@/lib/chef-scope";
import { normalizeCleaningScope } from "@/lib/cleaning-scope";
import { normalizeIroningScope } from "@/lib/ironing-scope";
import { normalizeMakeupScope } from "@/lib/makeup-scope";
import { notifyOnboardingSubmitted } from "@/lib/notification-events";
import { buildAdminTaskerReviewEmailTemplate, sendPlatformEmail } from "@/lib/notifications";
import { normalizePetScope } from "@/lib/pet-scope";
import { normalizeTeacherScope } from "@/lib/teacher-scope";
import { normalizeTrainerScope } from "@/lib/trainer-scope";
import { prisma } from "@/lib/prisma";
import {
  taskerOnboardingStep3Schema,
  taskerOnboardingStep4Schema,
  taskerOnboardingStep5Schema,
  taskerOnboardingStep6Schema,
  taskerOnboardingStep7Schema,
  taskerOnboardingStep8Schema,
  taskerOnboardingStep9Schema,
  taskerOnboardingStep10Schema,
  taskerOnboardingStep11Schema
} from "@/lib/validators";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  limpieza: "Limpieza",
  mascotas: "Paseo y cuidado de mascotas",
  babysitter: "Babysitter",
  "profesor-particular": "Profesor particular",
  "personal-trainer": "Personal trainer",
  chef: "Chef",
  maquillaje: "Maquillaje",
  planchado: "Planchado"
};

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

  if (onboarding.categorySlug === "mascotas") {
    const petScope = normalizePetScope(onboarding.petScope);
    required.splice(8, 0, [
      "petScope",
      petScope.services_offered.length > 0 && petScope.animals_accepted.length > 0 && petScope.tasks_included.length > 0 ? petScope : null
    ]);
  }

  if (onboarding.categorySlug === "maquillaje") {
    const makeupScope = normalizeMakeupScope(onboarding.makeupScope);
    required.splice(8, 0, [
      "makeupScope",
      makeupScope.services_offered.length > 0 && makeupScope.tasks_included.length > 0 ? makeupScope : null
    ]);
  }

  if (onboarding.categorySlug === "planchado") {
    const ironingScope = normalizeIroningScope(onboarding.ironingScope);
    required.splice(8, 0, [
      "ironingScope",
      ironingScope.services_offered.length > 0 && ironingScope.tasks_included.length > 0 ? ironingScope : null
    ]);
  }

  if (onboarding.categorySlug === "babysitter") {
    const babysitterScope = normalizeBabysitterScope(onboarding.babysitterScope);
    required.splice(8, 0, [
      "babysitterScope",
      babysitterScope.services_offered.length > 0 && babysitterScope.age_ranges.length > 0 && babysitterScope.tasks_included.length > 0
        ? babysitterScope
        : null
    ]);
  }

  if (onboarding.categorySlug === "chef") {
    const chefScope = normalizeChefScope(onboarding.chefScope);
    required.splice(8, 0, [
      "chefScope",
      chefScope.services_offered.length > 0 ? chefScope : null
    ]);
  }

  if (onboarding.categorySlug === "personal-trainer") {
    const trainerScope = normalizeTrainerScope(onboarding.trainerScope);
    required.splice(8, 0, [
      "trainerScope",
      trainerScope.services_offered.length > 0 && trainerScope.modes.length > 0 && trainerScope.tasks_included.length > 0 ? trainerScope : null
    ]);
  }

  if (onboarding.categorySlug === "profesor-particular") {
    const teacherScope = normalizeTeacherScope(onboarding.teacherScope);
    required.splice(8, 0, [
      "teacherScope",
      teacherScope.services_offered.length > 0 &&
      teacherScope.levels.length > 0 &&
      teacherScope.modes.length > 0 &&
      teacherScope.tasks_included.length > 0
        ? teacherScope
        : null
    ]);
  }

  return required.filter(([, value]) => missing(value)).map(([field]) => field);
}

function getStepPayload(step: number, onboarding: any, user: any) {
  switch (step) {
    case 3:
      return {
        fullName: user?.fullName,
        email: user?.email,
        phone: user?.phone,
        documentId: onboarding?.documentId,
        referenceAddress: onboarding?.referenceAddress,
        baseCommune: onboarding?.baseCommune,
        profilePhotoUrl: onboarding?.profilePhotoUrl
      };
    case 4:
      return {
        baseCommune: onboarding?.baseCommune,
        serviceCommunes: onboarding?.serviceCommunes
      };
    case 5:
      return {
        categorySlug: onboarding?.categorySlug
      };
    case 6:
      return {
        yearsExperience: onboarding?.yearsExperience,
        workMode: onboarding?.workMode
      };
    case 7:
      return {
        offeredServices: onboarding?.offeredServices,
        experienceTypes: onboarding?.experienceTypes,
        cleaningScope: onboarding?.cleaningScope,
        petScope: onboarding?.petScope,
        makeupScope: onboarding?.makeupScope,
        ironingScope: onboarding?.ironingScope,
        babysitterScope: onboarding?.babysitterScope,
        chefScope: onboarding?.chefScope,
        trainerScope: onboarding?.trainerScope,
        teacherScope: onboarding?.teacherScope,
        acceptsHomesWithPets: onboarding?.acceptsHomesWithPets,
        acceptsHomesWithChildren: onboarding?.acceptsHomesWithChildren,
        acceptsHomesWithElderly: onboarding?.acceptsHomesWithElderly,
        worksWithClientProducts: onboarding?.worksWithClientProducts,
        bringsOwnProducts: onboarding?.bringsOwnProducts,
        bringsOwnTools: onboarding?.bringsOwnTools
      };
    case 8:
      return {
        availabilityMode: onboarding?.availabilityMode ?? "FIJA",
        availabilityBlocks: onboarding?.availabilityBlocks
      };
    case 9:
      return {
        hourlyRateClp: onboarding?.hourlyRateClp,
        serviceRates: onboarding?.serviceRates ?? [],
        minBookingHours: onboarding?.minBookingHours,
        weekendSurchargePct: onboarding?.weekendSurchargePct,
        holidaySurchargePct: onboarding?.holidaySurchargePct,
        remoteCommuneSurchargeClp: onboarding?.remoteCommuneSurchargeClp ?? 0
      };
    case 10:
      return {
        bankAccountHolder: onboarding?.bankAccountHolder,
        bankAccountHolderRut: onboarding?.bankAccountHolderRut,
        bankName: onboarding?.bankName,
        bankAccountType: onboarding?.bankAccountType,
        bankAccountNumber: onboarding?.bankAccountNumber,
        identityDocumentFrontFile: onboarding?.identityDocumentFrontFile,
        identityDocumentBackFile: onboarding?.identityDocumentBackFile,
        criminalRecordFile: onboarding?.criminalRecordFile
      };
    case 11:
      return {
        acceptTerms: (onboarding?.acceptsCancellationPolicy && onboarding?.acceptsServiceProtocol && onboarding?.acceptsDataProcessing && onboarding?.confirmsCleaningScope) || false
      };
    default:
      throw new Error(`Paso ${step} no soportado para validación individual`);
  }
}

function getStepValidator(step: number) {
  switch (step) {
    case 3: return taskerOnboardingStep3Schema;
    case 4: return taskerOnboardingStep4Schema;
    case 5: return taskerOnboardingStep5Schema;
    case 6: return taskerOnboardingStep6Schema;
    case 7: return taskerOnboardingStep7Schema;
    case 8: return taskerOnboardingStep8Schema;
    case 9: return taskerOnboardingStep9Schema;
    case 10: return taskerOnboardingStep10Schema;
    case 11: return taskerOnboardingStep11Schema;
    default:
      throw new Error(`Paso ${step} no soportado para validación individual`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const identity = getRequestIdentity(req);
    if (!hasRole(identity.role, [UserRole.PRO, UserRole.ADMIN]) || !identity.userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Empty body allowed for legacy full submissions
    }
    const step = body?.step ? Number(body.step) : undefined;

    const onboarding = await prisma.cleaningOnboarding.findUnique({
      where: { userId: identity.userId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            roleAssignments: {
              select: {
                role: {
                  select: {
                    code: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!onboarding) {
      return NextResponse.json({ error: "Onboarding no encontrado" }, { status: 404 });
    }

    // Step-by-step dry-run validation request
    if (step != null) {
      try {
        const payload = getStepPayload(step, onboarding, onboarding.user);
        const validator = getStepValidator(step);
        const result = validator.safeParse(payload);
        if (!result.success) {
          return NextResponse.json({
            ok: false,
            errors: result.error.flatten().fieldErrors
          }, { status: 400 });
        }
        return NextResponse.json({ ok: true }, { status: 200 });
      } catch (err) {
        return NextResponse.json({
          error: err instanceof Error ? err.message : "Error de validación del paso"
        }, { status: 400 });
      }
    }
    const missingFields = listMissingFields(onboarding);
    if (missingFields.length > 0) {
      console.warn("[tasker-onboarding] submit blocked", {
        userId: identity.userId,
        missingFields
      });
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

    // Notificación in-app + email al tasker "estamos revisando"
    if (identity.userId) {
      const taskerUser = await prisma.user.findUnique({
        where: { id: identity.userId },
        select: { id: true, fullName: true, email: true }
      });
      if (taskerUser) {
        await notifyOnboardingSubmitted({
          taskerUserId: taskerUser.id,
          taskerEmail: taskerUser.email,
          taskerName: taskerUser.fullName
        });
      }
    }

    console.info("[tasker-onboarding] submitted for review", {
      userId: identity.userId,
      onboardingId: updated.id,
      status: updated.status,
      currentStep: updated.currentStep
    });

    const adminEmailsFromEnv = (process.env.ADMIN_ONBOARDING_ALERT_EMAILS ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    const primaryAdminEmail = process.env.PRIMARY_ADMIN_EMAIL?.trim().toLowerCase();

    const adminUsers = await prisma.user.findMany({
      where: {
        OR: [{ role: UserRole.ADMIN }, { roleAssignments: { some: { role: { code: UserRole.ADMIN } } } }]
      },
      select: { email: true }
    });

    const recipientEmails = Array.from(
      new Set([
        ...adminEmailsFromEnv,
        ...(primaryAdminEmail ? [primaryAdminEmail] : []),
        ...(adminUsers.map((item) => item.email?.trim().toLowerCase()).filter(Boolean) as string[])
      ])
    );
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || process.env.APP_URL?.replace(/\/+$/, "") || "https://wetask.cl";
    const reviewUrl = `${appUrl}/admin/onboarding-limpieza`;
    const categoryLabel = CATEGORY_LABELS[updated.categorySlug] ?? updated.categorySlug;
    const taskerName = onboarding?.user.fullName?.trim() || "Tasker nuevo";
    const taskerEmail = onboarding?.user.email?.trim() || "Sin email";
    const commune = updated.baseCommune?.trim() || "Sin comuna";

    if (recipientEmails.length > 0) {
      const results = await Promise.allSettled(
        recipientEmails.map((email) =>
          sendPlatformEmail({
            to: email,
            subject: `Nuevo tasker para revisión: ${taskerName}`,
            text:
              `Hay un nuevo tasker esperando validación en WeTask.\n\n` +
              `Nombre: ${taskerName}\n` +
              `Email: ${taskerEmail}\n` +
              `Categoría: ${categoryLabel}\n` +
              `Comuna base: ${commune}\n\n` +
              `Revisa la cola aquí: ${reviewUrl}`,
            html: buildAdminTaskerReviewEmailTemplate({
              taskerName,
              taskerEmail,
              categoryLabel,
              commune,
              reviewUrl
            })
          })
        )
      );

      const failures = results
        .map((result, index) => ({ result, email: recipientEmails[index] }))
        .filter((item) => item.result.status === "rejected")
        .map((item) => ({
          email: item.email,
          reason: item.result.status === "rejected" ? String(item.result.reason) : ""
        }));

      console.info("[tasker-onboarding] review alert emails processed", {
        onboardingId: updated.id,
        recipients: recipientEmails,
        sentCount: recipientEmails.length - failures.length,
        failedCount: failures.length,
        failures
      });
    } else {
      console.warn("[tasker-onboarding] no review alert recipients configured", {
        onboardingId: updated.id,
        primaryAdminEmailConfigured: Boolean(primaryAdminEmail),
        adminUsersFound: adminUsers.length,
        alertEnvConfigured: adminEmailsFromEnv.length > 0
      });
    }

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
