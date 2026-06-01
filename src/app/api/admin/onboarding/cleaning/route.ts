import { CleaningOnboardingStatus, Prisma } from "@prisma/client";
import { logError, logger, safeErrorDetail } from "@/lib/logger";
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
    logError("tasker-admin.status_email", error, { to: params.to, subject: params.subject });
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

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  const admin = await requireAdminRequest(req);
  if (!admin.ok) return admin.response;

  const status = req.nextUrl.searchParams.get("status") ?? undefined;
  const order = req.nextUrl.searchParams.get("order") === "asc" ? "asc" : "desc";
  const view = req.nextUrl.searchParams.get("view") === "validated" ? "validated" : "queue";
  const search = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const cursor = req.nextUrl.searchParams.get("cursor") ?? null;
  const pageSizeRaw = Number(req.nextUrl.searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE);
  const pageSize = Number.isFinite(pageSizeRaw) ? Math.min(Math.max(pageSizeRaw, 10), MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;

  const validStatuses = [
    CleaningOnboardingStatus.BORRADOR,
    CleaningOnboardingStatus.PENDIENTE_REVISION,
    CleaningOnboardingStatus.REQUIERE_CORRECCION,
    CleaningOnboardingStatus.APROBADO,
    CleaningOnboardingStatus.ACTIVO
  ];
  const normalizedStatusFilter = status && validStatuses.includes(status as CleaningOnboardingStatus) ? (status as CleaningOnboardingStatus) : null;

  const queueStatusFilter: Prisma.CleaningOnboardingWhereInput = normalizedStatusFilter
    ? { status: normalizedStatusFilter }
    : {
        status: {
          in: [
            CleaningOnboardingStatus.BORRADOR,
            CleaningOnboardingStatus.PENDIENTE_REVISION,
            CleaningOnboardingStatus.REQUIERE_CORRECCION
          ]
        }
      };

  const validatedStatusFilter: Prisma.CleaningOnboardingWhereInput = {
    OR: [
      { status: { in: [CleaningOnboardingStatus.APROBADO, CleaningOnboardingStatus.ACTIVO] } },
      { user: { professionalProfile: { is: { isVerified: true } } } }
    ]
  };

  const searchFilter: Prisma.CleaningOnboardingWhereInput | null = search
    ? {
        OR: [
          { documentId: { contains: search, mode: "insensitive" } },
          {
            user: {
              OR: [
                { fullName: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { phone: { contains: search } }
              ]
            }
          }
        ]
      }
    : null;

  const baseWhere = view === "validated" ? validatedStatusFilter : queueStatusFilter;
  const where: Prisma.CleaningOnboardingWhereInput = searchFilter
    ? { AND: [baseWhere, searchFilter] }
    : baseWhere;

  const items = await prisma.cleaningOnboarding.findMany({
    where,
    orderBy: [{ submittedAt: order }, { createdAt: order }, { id: "asc" }],
    take: pageSize + 1,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          professionalProfile: {
            select: {
              id: true,
              isVerified: true,
              verificationStatus: true,
              coverageComuna: true,
              hourlyRateFromClp: true
            }
          }
        }
      }
    }
  });

  const professionalProfileIds = items
    .map((item) => item.user.professionalProfile?.id)
    .filter((value): value is string => Boolean(value));

  const activeServicesByProfile = professionalProfileIds.length
    ? await prisma.taskerService.groupBy({
        by: ["professionalProfileId"],
        where: {
          professionalProfileId: { in: professionalProfileIds },
          isActive: true
        },
        _count: {
          _all: true
        }
      })
    : [];

  const activeServicesCountMap = new Map(
    activeServicesByProfile.map((item) => [item.professionalProfileId, item._count._all])
  );

  const hasMore = items.length > pageSize;
  const visibleItems = hasMore ? items.slice(0, pageSize) : items;
  const nextCursor = hasMore ? visibleItems[visibleItems.length - 1]?.id ?? null : null;

  const normalizedItems = visibleItems
    .map((item) => {
      const activeTaskerServicesCount = item.user.professionalProfile?.id
        ? activeServicesCountMap.get(item.user.professionalProfile.id) ?? 0
        : 0;
      const publication = getTaskerPublicationState({
        onboarding: {
          status: item.status,
          currentStep: item.currentStep,
          submittedAt: item.submittedAt,
          categorySlug: item.categorySlug,
          baseCommune: item.baseCommune,
          serviceCommunes: item.serviceCommunes,
          hourlyRateClp: item.hourlyRateClp
        },
        profile: item.user.professionalProfile
          ? {
              isVerified: item.user.professionalProfile.isVerified,
              coverageComuna: item.user.professionalProfile.coverageComuna,
              hourlyRateFromClp: item.user.professionalProfile.hourlyRateFromClp
            }
          : null,
        activeTaskerServicesCount
      });

      const normalizedStatus =
        view === "validated" && item.user.professionalProfile?.isVerified
          ? publication.canAppearInSearch || item.activatedAt
            ? CleaningOnboardingStatus.ACTIVO
            : CleaningOnboardingStatus.APROBADO
          : item.status;

      return {
        ...item,
        status: normalizedStatus
      };
    })
    .filter((item) => {
      if (!normalizedStatusFilter) return true;
      if (
        view === "validated" &&
        normalizedStatusFilter !== CleaningOnboardingStatus.APROBADO &&
        normalizedStatusFilter !== CleaningOnboardingStatus.ACTIVO
      ) {
        return true;
      }
      return item.status === normalizedStatusFilter;
    });

  return NextResponse.json({ items: normalizedItems, view, nextCursor }, { status: 200 });
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

      const updated = await prisma.$transaction(async (tx) => {
        const onboardingUpdate = await tx.cleaningOnboarding.update({
          where: { id: input.onboardingId },
          data: {
            status: CleaningOnboardingStatus.REQUIERE_CORRECCION,
            reviewedAt: new Date(),
            adminReviewNotes: notes
          }
        });
        await tx.onboardingReviewEvent.create({
          data: {
            onboardingId: input.onboardingId!,
            actorId: admin.identity.userId,
            action: "request_correction",
            notes,
            statusBefore: onboarding.status,
            statusAfter: CleaningOnboardingStatus.REQUIERE_CORRECCION
          }
        });
        return onboardingUpdate;
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
      const updated = await prisma.$transaction(async (tx) => {
        const onboardingUpdate = await tx.cleaningOnboarding.update({
          where: { id: input.onboardingId },
          data: {
            status: CleaningOnboardingStatus.PENDIENTE_REVISION,
            adminReviewNotes: input.notes?.trim() || null
          }
        });
        await tx.onboardingReviewEvent.create({
          data: {
            onboardingId: input.onboardingId!,
            actorId: admin.identity.userId,
            action: "set_pending",
            notes: input.notes?.trim() || null,
            statusBefore: onboarding.status,
            statusAfter: CleaningOnboardingStatus.PENDIENTE_REVISION
          }
        });
        return onboardingUpdate;
      });
      return NextResponse.json({ ok: true, onboarding: updated }, { status: 200 });
    }

    if (input.action === "approve") {
      try {
        const updated = await prisma.$transaction(async (tx) => {
          const onboardingUpdate = await tx.cleaningOnboarding.update({
            where: { id: input.onboardingId },
            data: {
              status: CleaningOnboardingStatus.APROBADO,
              reviewedAt: new Date(),
              approvedAt: new Date(),
              adminReviewNotes: input.notes?.trim() || null
            }
          });

          const sync = await syncTaskerMarketplaceServicesFromOnboarding(onboarding.userId, tx);
          if (sync.updated === 0 && sync.reason !== "synced") {
            throw new Error(`marketplace_sync_failed:${sync.reason}`);
          }

          await tx.onboardingReviewEvent.create({
            data: {
              onboardingId: input.onboardingId!,
              actorId: admin.identity.userId,
              action: "approve",
              notes: input.notes?.trim() || null,
              statusBefore: onboarding.status,
              statusAfter: CleaningOnboardingStatus.APROBADO
            }
          });

          return onboardingUpdate;
        });

        // Chequear si el tasker ya conectó MercadoPago. Si no, ajustamos el copy
        // para empujarlo a hacerlo: sin esto su perfil no recibe reservas pagadas.
        const proUserState = await prisma.user.findUnique({
          where: { id: onboarding.userId },
          select: { mpAccountStatus: true }
        });
        const mpConnected = proUserState?.mpAccountStatus === "ACTIVE";

        await notifyTaskerStatusChange({
          to: onboarding.user.email,
          fullName: onboarding.user.fullName,
          subject: mpConnected
            ? "WeTask: tu perfil fue aprobado"
            : "WeTask: tu perfil fue aprobado — falta conectar MercadoPago",
          title: "Tu perfil fue aprobado",
          message: mpConnected
            ? "Tu validación interna fue aprobada por el equipo de WeTask. Ya pasaste la revisión y tu perfil está listo para la activación final dentro de la plataforma."
            : "Tu validación interna fue aprobada por el equipo de WeTask. Para empezar a recibir reservas pagadas necesitás conectar tu cuenta de MercadoPago desde tu panel — sin esto tu perfil no aparece en búsqueda.",
          ctaLabel: mpConnected ? "Ver mi perfil" : "Conectar MercadoPago",
          ctaPath: "/pro"
        });

        // Notificación in-app (siempre crear)
        await prisma.notification.create({
          data: {
            userId: onboarding.userId,
            title: mpConnected ? "Tu perfil fue aprobado" : "Aprobado — falta conectar MercadoPago",
            body: mpConnected
              ? "El equipo aprobó tu perfil. Pronto vas a recibir tu primera reserva."
              : "Tu perfil fue aprobado. Para empezar a recibir reservas pagadas conectá tu cuenta MercadoPago en /pro."
          }
        });

        return NextResponse.json({ ok: true, onboarding: updated }, { status: 200 });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "";
        if (msg.startsWith("marketplace_sync_failed:")) {
          const reason = msg.replace("marketplace_sync_failed:", "");
          return NextResponse.json(
            { error: "No se pudo preparar el servicio marketplace al aprobar.", reason },
            { status: 409 }
          );
        }
        throw error;
      }
    }

    if (input.action === "delete_record") {
      await prisma.$transaction(async (tx) => {
        await tx.adminAuditLog.create({
          data: {
            actorId: admin.identity.userId,
            action: "onboarding.delete_record",
            targetType: "CleaningOnboarding",
            targetId: input.onboardingId!,
            beforeJson: {
              status: onboarding.status,
              userId: onboarding.userId,
              userEmail: onboarding.user.email,
              userFullName: onboarding.user.fullName,
              notes: input.notes?.trim() || null
            }
          }
        });
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

    try {
      const result = await prisma.$transaction(async (tx) => {
        const marketplaceSync = await syncTaskerMarketplaceServicesFromOnboarding(onboarding.userId, tx);
        if (marketplaceSync.updated === 0 && marketplaceSync.reason !== "synced") {
          throw new Error(`marketplace_sync_failed:${marketplaceSync.reason}`);
        }

        const activationUser = await tx.user.findUnique({
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
          ? await tx.taskerService.count({
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
          throw new Error(`missing_requirements:${activationMissingRequirements.join(",")}`);
        }

        const updated = await tx.cleaningOnboarding.update({
          where: { id: input.onboardingId },
          data: {
            status: CleaningOnboardingStatus.ACTIVO,
            activatedAt: new Date(),
            adminReviewNotes: input.notes?.trim() || onboarding.adminReviewNotes || null
          }
        });

        const syncResult = await syncTaskerAvailabilitySlotsFromOnboarding(onboarding.userId, 6, tx);

        await tx.onboardingReviewEvent.create({
          data: {
            onboardingId: input.onboardingId!,
            actorId: admin.identity.userId,
            action: "activate",
            notes: input.notes?.trim() || null,
            statusBefore: onboarding.status,
            statusAfter: CleaningOnboardingStatus.ACTIVO
          }
        });

        return { updated, marketplaceSync, syncResult };
      });

      logger.info(
        {
          onboardingId: input.onboardingId,
          userId: onboarding.userId,
          syncedServices: result.marketplaceSync.updated,
          createdSlots: result.syncResult.created,
          publication: result.syncResult.publication,
          reason: result.syncResult.reason
        },
        "tasker activation audit"
      );

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

      return NextResponse.json({ ok: true, onboarding: result.updated }, { status: 200 });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      if (msg.startsWith("marketplace_sync_failed:")) {
        const reason = msg.replace("marketplace_sync_failed:", "");
        return NextResponse.json(
          { error: "No se pudo preparar el servicio marketplace del tasker.", reason },
          { status: 409 }
        );
      }
      if (msg.startsWith("missing_requirements:")) {
        const reqs = msg.replace("missing_requirements:", "").split(",");
        return NextResponse.json(
          {
            error: "El tasker no cumple las condiciones para publicarse.",
            missingRequirements: reqs
          },
          { status: 409 }
        );
      }
      throw error;
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo actualizar onboarding",
        detail: safeErrorDetail(error)
      },
      { status: 400 }
    );
  }
}
