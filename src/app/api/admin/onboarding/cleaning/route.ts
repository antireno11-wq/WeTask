import { CleaningOnboardingStatus, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin-access";
import { normalizeCommuneList } from "@/lib/communes";
import { buildTaskerStatusEmailTemplate, sendPlatformEmail } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import {
  getTaskerPublicationState,
  syncTaskerAvailabilitySlotsFromOnboarding,
  syncTaskerMarketplaceServicesFromOnboarding
} from "@/lib/tasker-publication";
import { cleaningOnboardingAdminActionSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") || process.env.APP_URL?.replace(/\/+$/, "") || "https://wetask.cl";
}

async function notifyTaskerStatusChange(params: {
  to: string;
  fullName: string;
  subject: string;
  title: string;
  message: string;
  ctaLabel: string;
  ctaPath: string;
}) {
  try {
    const appUrl = getAppUrl();
    const ctaUrl = `${appUrl}${params.ctaPath}`;
    await sendPlatformEmail({
      to: params.to,
      subject: params.subject,
      text: [`Hola ${params.fullName},`, "", params.message, "", `${params.ctaLabel}: ${ctaUrl}`, "", "Equipo WeTask"].join("\n"),
      html: buildTaskerStatusEmailTemplate({
        fullName: params.fullName,
        title: params.title,
        message: params.message,
        ctaLabel: params.ctaLabel,
        ctaUrl
      })
    });
  } catch (error) {
    console.error("[tasker-admin] status email failed", {
      to: params.to,
      subject: params.subject,
      detail: error instanceof Error ? error.message : "Error desconocido"
    });
  }
}

async function deleteOnboardingAndProfessionalData(tx: Prisma.TransactionClient, userId: string, onboardingId?: string) {
  const profile = await tx.professionalProfile.findUnique({
    where: { userId },
    select: { id: true }
  });

  if (profile) {
    await tx.taskerService.deleteMany({
      where: { professionalProfileId: profile.id }
    });
    await tx.availabilitySlot.deleteMany({
      where: { professionalProfileId: profile.id }
    });
    await tx.professionalProfile.delete({
      where: { userId }
    });
  }

  if (onboardingId) {
    await tx.cleaningOnboarding.delete({
      where: { id: onboardingId }
    });
    return;
  }

  await tx.cleaningOnboarding.deleteMany({
    where: { userId }
  });
}

export async function GET(req: NextRequest) {
  const admin = await requireAdminRequest(req);
  if (!admin.ok) return admin.response;

  const status = req.nextUrl.searchParams.get("status") ?? undefined;
  const order = req.nextUrl.searchParams.get("order") === "asc" ? "asc" : "desc";

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
    orderBy: [{ submittedAt: order }, { createdAt: order }],
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
  const admin = await requireAdminRequest(req);
  if (!admin.ok) return admin.response;

  try {
    const body = await req.json();
    const input = cleaningOnboardingAdminActionSchema.parse(body);

    if (input.action === "clear_all") {
      const allOnboardings = await prisma.cleaningOnboarding.findMany({
        select: { id: true, userId: true }
      });

      await prisma.$transaction(async (tx) => {
        for (const item of allOnboardings) {
          await deleteOnboardingAndProfessionalData(tx, item.userId, item.id);
        }
      });

      return NextResponse.json(
        {
          ok: true,
          message: "Se eliminaron todas las inscripciones anteriores."
        },
        { status: 200 }
      );
    }

    if (!input.onboardingId) {
      return NextResponse.json({ error: "onboardingId requerido" }, { status: 400 });
    }

    const onboarding = await prisma.cleaningOnboarding.findUnique({
      where: { id: input.onboardingId },
      include: {
        user: {
          select: {
            fullName: true,
            email: true
          }
        }
      }
    });
    if (!onboarding) {
      return NextResponse.json({ error: "Onboarding no encontrado" }, { status: 404 });
    }

    if (input.action === "request_correction") {
      const notes = input.notes?.trim();
      if (!notes) {
        return NextResponse.json({ error: "Debes indicar la causa del rechazo o corrección." }, { status: 400 });
      }

      const updated = await prisma.cleaningOnboarding.update({
        where: { id: input.onboardingId },
        data: {
          status: CleaningOnboardingStatus.REQUIERE_CORRECCION,
          reviewedAt: new Date(),
          adminReviewNotes: notes
        }
      });

      await sendPlatformEmail({
        to: onboarding.user.email,
        subject: "WeTask: tu perfil requiere correcciones",
        text: [
          `Hola ${onboarding.user.fullName},`,
          "",
          "Revisamos tu validación interna en WeTask y por ahora no pudimos aprobar tu perfil.",
          "",
          "Motivo indicado por el equipo:",
          notes,
          "",
          "Por favor entra nuevamente a la plataforma, corrige la información solicitada y vuelve a enviar tu perfil a revisión.",
          "",
          "Equipo WeTask"
        ].join("\n")
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

      await notifyTaskerStatusChange({
        to: onboarding.user.email,
        fullName: onboarding.user.fullName,
        subject: "WeTask: tu perfil fue aprobado",
        title: "Tu perfil fue aprobado",
        message:
          "Tu validación interna fue aprobada por el equipo de WeTask. Ya pasaste la revisión y tu perfil está listo para la activación final dentro de la plataforma.",
        ctaLabel: "Ver mi perfil",
        ctaPath: "/pro"
      });

      return NextResponse.json({ ok: true, onboarding: updated }, { status: 200 });
    }

    if (input.action === "delete_record") {
      await prisma.$transaction(async (tx) => {
        await deleteOnboardingAndProfessionalData(tx, onboarding.userId, input.onboardingId);
      });

      return NextResponse.json(
        {
          ok: true,
          message: "El registro del profesional fue eliminado correctamente."
        },
        { status: 200 }
      );
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

    const marketplaceSync = await syncTaskerMarketplaceServicesFromOnboarding(onboarding.userId);
    if (marketplaceSync.updated === 0 && marketplaceSync.reason !== "synced") {
      return NextResponse.json(
        { error: "No se pudo preparar el servicio marketplace del tasker.", reason: marketplaceSync.reason },
        { status: 409 }
      );
    }

    const activationUser = await prisma.user.findUnique({
      where: { id: onboarding.userId },
      select: {
        professionalProfile: {
          select: {
            id: true,
            isVerified: true,
            coverageComuna: true,
            hourlyRateFromClp: true
          }
        },
        cleaningOnboarding: {
          select: {
            status: true,
            currentStep: true,
            submittedAt: true,
            categorySlug: true,
            baseCommune: true,
            serviceCommunes: true,
            hourlyRateClp: true
          }
        }
      }
    });

    const activeTaskerServicesCount = activationUser?.professionalProfile
      ? await prisma.taskerService.count({
          where: {
            professionalProfileId: activationUser.professionalProfile.id,
            isActive: true
          }
        })
      : 0;

    const publication = getTaskerPublicationState({
      onboarding: activationUser?.cleaningOnboarding ?? null,
      profile: activationUser?.professionalProfile ?? null,
      activeTaskerServicesCount
    });
    const activationMissingRequirements = publication.missingRequirements.filter(
      (item) => item !== "published" && item !== "status_active"
    );
    if (activationMissingRequirements.length > 0) {
      return NextResponse.json(
        {
          error: "El tasker no cumple las condiciones para publicarse.",
          missingRequirements: activationMissingRequirements
        },
        { status: 409 }
      );
    }

    const updated = await prisma.cleaningOnboarding.update({
      where: { id: input.onboardingId },
      data: {
        status: CleaningOnboardingStatus.ACTIVO,
        activatedAt: new Date(),
        adminReviewNotes: input.notes?.trim() || onboarding.adminReviewNotes || null
      }
    });

    const syncResult = await syncTaskerAvailabilitySlotsFromOnboarding(onboarding.userId);
    console.info("[tasker-admin] activation audit", {
      onboardingId: input.onboardingId,
      userId: onboarding.userId,
      createdSlots: syncResult.created,
      publication: syncResult.publication,
      reason: syncResult.reason
    });

    await notifyTaskerStatusChange({
      to: onboarding.user.email,
      fullName: onboarding.user.fullName,
      subject: "WeTask: tu perfil ya está activo",
      title: "Ya puedes trabajar en WeTask",
      message:
        "Tu perfil ya fue activado y desde ahora puedes aparecer en la plataforma, recibir solicitudes y gestionar tus reservas desde tu panel de tasker.",
      ctaLabel: "Ir a mi panel",
      ctaPath: "/pro"
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
