import { BookingStatus, Prisma, UserRole } from "@prisma/client";
import { safeErrorDetail } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { normalizeCommuneList } from "@/lib/communes";
import { prisma } from "@/lib/prisma";
import {
  extractExperienceTypesForTaskerCategory,
  extractOfferedServicesForTaskerCategory,
  getMarketplaceCategorySlugForTaskerCategory,
  normalizeTaskerCategorySlug,
  validateScopeForTaskerCategory
} from "@/lib/tasker-category-profiles";
import { syncTaskerMarketplaceServicesFromOnboarding } from "@/lib/tasker-publication";
import { taskerAdditionalCategorySchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

function resolveTargetProId(req: NextRequest, identity: { userId: string | null; role: UserRole | null }) {
  const targetProId = req.nextUrl.searchParams.get("proId") ?? identity.userId;
  if (!targetProId) return { error: "proId requerido" as const };
  if (identity.role === UserRole.PRO && identity.userId !== targetProId) {
    return { error: "No autorizado" as const };
  }
  return { targetProId };
}

export async function GET(req: NextRequest) {
  try {
    const identity = getRequestIdentity(req);
    if (!hasRole(identity.role, [UserRole.PRO, UserRole.ADMIN])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const auth = resolveTargetProId(req, identity);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.error === "No autorizado" ? 403 : 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.targetProId },
      select: {
        cleaningOnboarding: {
          select: {
            categorySlug: true,
            serviceCommunes: true,
            hourlyRateClp: true
          }
        },
        professionalProfile: {
          select: {
            id: true,
            categoryProfiles: {
              where: { isActive: true },
              orderBy: [{ createdAt: "asc" }]
            }
          }
        }
      }
    });

    if (!user?.professionalProfile) {
      return NextResponse.json({ error: "Tasker no encontrado" }, { status: 404 });
    }

    return NextResponse.json(
      {
        primaryCategorySlug: normalizeTaskerCategorySlug(user.cleaningOnboarding?.categorySlug ?? null),
        baseServiceCommunes: normalizeCommuneList(user.cleaningOnboarding?.serviceCommunes),
        baseHourlyRateClp: user.cleaningOnboarding?.hourlyRateClp ?? null,
        categories: user.professionalProfile.categoryProfiles
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudieron cargar las categorías del tasker",
        detail: safeErrorDetail(error)
      },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const identity = getRequestIdentity(req);
    if (!hasRole(identity.role, [UserRole.PRO, UserRole.ADMIN])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const auth = resolveTargetProId(req, identity);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.error === "No autorizado" ? 403 : 400 });
    }

    const body = await req.json();
    const parsed = taskerAdditionalCategorySchema.parse(body);
    const normalizedCategorySlug = normalizeTaskerCategorySlug(parsed.categorySlug);
    const validatedScope = validateScopeForTaskerCategory(normalizedCategorySlug, parsed.scopeData);
    if (!validatedScope.ok) {
      return NextResponse.json({ error: validatedScope.error }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.targetProId },
      select: {
        cleaningOnboarding: {
          select: {
            categorySlug: true
          }
        },
        professionalProfile: {
          select: {
            id: true
          }
        }
      }
    });

    if (!user?.professionalProfile) {
      return NextResponse.json({ error: "Tasker no encontrado" }, { status: 404 });
    }

    if (normalizeTaskerCategorySlug(user.cleaningOnboarding?.categorySlug ?? null) === normalizedCategorySlug) {
      return NextResponse.json({ error: "Esa ya es tu categoría principal del onboarding" }, { status: 400 });
    }

    const serviceCommunes = normalizeCommuneList(parsed.serviceCommunes);
    const categoryProfile = await prisma.taskerCategoryProfile.upsert({
      where: {
        professionalProfileId_categorySlug: {
          professionalProfileId: user.professionalProfile.id,
          categorySlug: normalizedCategorySlug ?? parsed.categorySlug
        }
      },
      create: {
        professionalProfileId: user.professionalProfile.id,
        categorySlug: normalizedCategorySlug ?? parsed.categorySlug,
        hourlyRateClp: parsed.hourlyRateClp,
        minBookingHours: parsed.minBookingHours ?? 1,
        serviceCommunes,
        offeredServices: extractOfferedServicesForTaskerCategory(normalizedCategorySlug, validatedScope.scope),
        experienceTypes: extractExperienceTypesForTaskerCategory(normalizedCategorySlug, validatedScope.scope),
        scopeData: validatedScope.scope as Prisma.InputJsonValue,
        isActive: true,
        completedAt: new Date()
      },
      update: {
        hourlyRateClp: parsed.hourlyRateClp,
        minBookingHours: parsed.minBookingHours ?? 1,
        serviceCommunes,
        offeredServices: extractOfferedServicesForTaskerCategory(normalizedCategorySlug, validatedScope.scope),
        experienceTypes: extractExperienceTypesForTaskerCategory(normalizedCategorySlug, validatedScope.scope),
        scopeData: validatedScope.scope as Prisma.InputJsonValue,
        isActive: true,
        completedAt: new Date()
      }
    });

    await syncTaskerMarketplaceServicesFromOnboarding(auth.targetProId);

    return NextResponse.json({ categoryProfile }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo guardar la categoría adicional",
        detail: safeErrorDetail(error)
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

    const auth = resolveTargetProId(req, identity);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.error === "No autorizado" ? 403 : 400 });
    }

    const categorySlug = normalizeTaskerCategorySlug(req.nextUrl.searchParams.get("categorySlug"));
    if (!categorySlug) {
      return NextResponse.json({ error: "categorySlug requerido" }, { status: 400 });
    }

    const profile = await prisma.professionalProfile.findUnique({
      where: { userId: auth.targetProId },
      select: { id: true }
    });
    if (!profile) {
      return NextResponse.json({ error: "Tasker no encontrado" }, { status: 404 });
    }

    const marketplaceCategorySlug = getMarketplaceCategorySlugForTaskerCategory(categorySlug);
    const category = marketplaceCategorySlug
      ? await prisma.category.findUnique({ where: { slug: marketplaceCategorySlug }, select: { id: true } })
      : null;

    // PRO-12: no permitir desactivar una categoría con reservas activas en sus servicios
    // (dejaría reservas huérfanas respecto a su servicio/precio).
    if (category) {
      const activeBookings = await prisma.booking.count({
        where: {
          proId: auth.targetProId,
          service: { categoryId: category.id },
          status: {
            in: [
              BookingStatus.PENDING_PAYMENT,
              BookingStatus.CONFIRMED,
              BookingStatus.ACCEPTED,
              BookingStatus.IN_PROGRESS,
              BookingStatus.AWAITING_CUSTOMER_CONFIRMATION,
              BookingStatus.PAYOUT_SCHEDULED,
              BookingStatus.DISPUTE
            ]
          }
        }
      });
      if (activeBookings > 0) {
        return NextResponse.json(
          {
            error: "No puedes desactivar esta categoría: tienes reservas activas en sus servicios.",
            activeBookings
          },
          { status: 409 }
        );
      }
    }

    await prisma.taskerCategoryProfile.updateMany({
      where: {
        professionalProfileId: profile.id,
        categorySlug
      },
      data: {
        isActive: false
      }
    });

    if (category) {
      await prisma.taskerService.updateMany({
        where: {
          professionalProfileId: profile.id,
          categoryId: category.id
        },
        data: {
          isActive: false
        }
      });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo desactivar la categoría adicional",
        detail: safeErrorDetail(error)
      },
      { status: 400 }
    );
  }
}
