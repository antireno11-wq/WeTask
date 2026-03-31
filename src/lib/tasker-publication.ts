import { CleaningOnboardingStatus, Prisma } from "@prisma/client";
import { isChefServiceSlug } from "@/lib/chef-service-types";
import { CLEANING_WEEK_DAYS } from "@/lib/cleaning-onboarding";
import { isCleaningServiceSlug } from "@/lib/cleaning-service-types";
import { normalizeCommune, normalizeCommuneList } from "@/lib/communes";
import { prisma } from "@/lib/prisma";
import {
  extractOfferedServicesForTaskerCategory,
  getCoreServiceForTaskerCategory,
  getMarketplaceCategorySlugForTaskerCategory,
  normalizeTaskerCategorySlug
} from "@/lib/tasker-category-profiles";

type AvailabilityBlock = {
  day: string;
  start: string;
  end: string;
};

type PublicationCheckInput = {
  onboarding: {
    status: CleaningOnboardingStatus;
    currentStep: number;
    submittedAt: Date | null;
    categorySlug: string | null;
    baseCommune: string | null;
    serviceCommunes: Prisma.JsonValue | null;
    hourlyRateClp: number | null;
  } | null;
  profile: {
    isVerified: boolean;
    coverageComuna: string | null;
    hourlyRateFromClp: number | null;
  } | null;
  activeTaskerServicesCount: number;
};

const WEEK_DAY_INDEX = new Map(
  CLEANING_WEEK_DAYS.map((day, index) => [
    day,
    index === 6 ? 0 : index + 1
  ])
);

function toAvailabilityBlocks(value: Prisma.JsonValue | null): AvailabilityBlock[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is AvailabilityBlock => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as AvailabilityBlock;
    return (
      typeof candidate.day === "string" &&
      typeof candidate.start === "string" &&
      typeof candidate.end === "string" &&
      WEEK_DAY_INDEX.has(candidate.day as (typeof CLEANING_WEEK_DAYS)[number]) &&
      /^\d{2}:\d{2}$/.test(candidate.start) &&
      /^\d{2}:\d{2}$/.test(candidate.end) &&
      candidate.end > candidate.start
    );
  });
}

function mergeDateAndTime(date: Date, hhmm: string) {
  const [hours, minutes] = hhmm.split(":").map(Number);
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

export function buildUpcomingSlotsFromBlocks(blocksInput: Prisma.JsonValue | null, weeks = 6, anchorDate = new Date()) {
  const blocks = toAvailabilityBlocks(blocksInput);
  if (blocks.length === 0) return [];

  const now = new Date(anchorDate);
  const slots: Array<{ startsAt: Date; endsAt: Date }> = [];

    for (let weekOffset = 0; weekOffset < weeks; weekOffset += 1) {
    for (const block of blocks) {
      const weekday = WEEK_DAY_INDEX.get(block.day as (typeof CLEANING_WEEK_DAYS)[number]);
      if (weekday == null) continue;

      const baseDate = new Date(now);
      const dayDelta = (weekday - baseDate.getDay() + 7) % 7;
      baseDate.setDate(baseDate.getDate() + dayDelta + weekOffset * 7);

      const startsAt = mergeDateAndTime(baseDate, block.start);
      const endsAt = mergeDateAndTime(baseDate, block.end);

      if (startsAt <= now || endsAt <= startsAt) continue;
      slots.push({ startsAt, endsAt });
    }
  }

  return slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export function getTaskerPublicationState(input: PublicationCheckInput) {
  const status =
    input.onboarding?.status === CleaningOnboardingStatus.ACTIVO
      ? "active"
      : input.onboarding?.status === CleaningOnboardingStatus.APROBADO
        ? "approved"
        : input.onboarding?.status === CleaningOnboardingStatus.PENDIENTE_REVISION
          ? "pending_review"
          : input.onboarding?.status === CleaningOnboardingStatus.REQUIERE_CORRECCION
            ? "requires_correction"
            : "draft";

  const onboardingCompleted = Boolean(input.onboarding && input.onboarding.currentStep >= 12 && input.onboarding.submittedAt);
  const published = status === "active" && input.profile?.isVerified === true;
  const hasCategory = Boolean(input.onboarding?.categorySlug?.trim()) && input.activeTaskerServicesCount > 0;
  const hasCommune =
    normalizeCommuneList(input.onboarding?.serviceCommunes).length > 0 ||
    Boolean(normalizeCommune(input.onboarding?.baseCommune)) ||
    Boolean(normalizeCommune(input.profile?.coverageComuna));
  const hasRate = Number(input.profile?.hourlyRateFromClp ?? input.onboarding?.hourlyRateClp ?? 0) > 0;

  const missingRequirements: string[] = [];
  if (!onboardingCompleted) missingRequirements.push("onboarding_completed");
  if (!published) missingRequirements.push("published");
  if (status !== "active") missingRequirements.push("status_active");
  if (!hasCategory) missingRequirements.push("category");
  if (!hasCommune) missingRequirements.push("commune");
  if (!hasRate) missingRequirements.push("hourly_rate");

  return {
    onboardingCompleted,
    published,
    status,
    hasCategory,
    hasCommune,
    hasRate,
    canAppearInSearch: missingRequirements.length === 0,
    missingRequirements
  };
}

function getOnboardingServiceSlugs(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

async function syncTaskerServicesForCategory(input: {
  professionalProfileId: string;
  categorySlug: string;
  hourlyRateClp: number | null;
  minBookingHours: number | null | undefined;
  offeredServices: string[];
}) {
  const normalizedCategorySlug = normalizeTaskerCategorySlug(input.categorySlug);
  const selectedCoreService = getCoreServiceForTaskerCategory(normalizedCategorySlug);
  if (!normalizedCategorySlug || !selectedCoreService) {
    return { updated: 0, reason: "missing_core_service" as const };
  }

  const category = await prisma.category.findFirst({
    where: {
      isActive: true,
      slug: getMarketplaceCategorySlugForTaskerCategory(normalizedCategorySlug) ?? undefined
    },
    orderBy: [{ slug: "asc" }]
  });
  if (!category) {
    return { updated: 0, reason: "missing_category" as const };
  }

  const selectedServices =
    normalizedCategorySlug === "limpieza"
      ? input.offeredServices.filter((item) => isCleaningServiceSlug(item))
      : normalizedCategorySlug === "chef"
        ? input.offeredServices.filter((item) => isChefServiceSlug(item))
        : [];

  const services = selectedServices.length
    ? await prisma.service.findMany({
        where: {
          categoryId: category.id,
          isActive: true,
          slug: { in: selectedServices }
        },
        orderBy: [{ basePriceClp: "asc" }]
      })
    : await prisma.service.findMany({
        where: {
          categoryId: category.id,
          isActive: true,
          OR: [
            { slug: { contains: selectedCoreService.slug } },
            { name: { contains: selectedCoreService.label, mode: "insensitive" } }
          ]
        },
        orderBy: [{ basePriceClp: "asc" }]
      });

  if (services.length === 0) {
    return { updated: 0, reason: "missing_services" as const, categoryId: category.id };
  }

  let updated = 0;
  for (const service of services) {
    await prisma.taskerService.upsert({
      where: {
        professionalProfileId_serviceId: {
          professionalProfileId: input.professionalProfileId,
          serviceId: service.id
        }
      },
      create: {
        professionalProfileId: input.professionalProfileId,
        categoryId: category.id,
        serviceId: service.id,
        priceClp: input.hourlyRateClp ?? service.basePriceClp,
        minBooking: input.minBookingHours ?? category.minHours,
        isActive: true
      },
      update: {
        categoryId: category.id,
        priceClp: input.hourlyRateClp ?? service.basePriceClp,
        minBooking: input.minBookingHours ?? category.minHours,
        isActive: true
      }
    });
    updated += 1;
  }

  await prisma.taskerService.updateMany({
    where: {
      professionalProfileId: input.professionalProfileId,
      categoryId: category.id,
      serviceId: { notIn: services.map((service) => service.id) }
    },
    data: { isActive: false }
  });

  return {
    updated,
    reason: "synced" as const,
    categoryId: category.id,
    serviceIds: services.map((service) => service.id)
  };
}

export async function syncTaskerMarketplaceServicesFromOnboarding(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      cleaningOnboarding: {
        select: {
          categorySlug: true,
          offeredServices: true,
          hourlyRateClp: true,
          minBookingHours: true,
          profilePhotoUrl: true,
          shortDescription: true,
          referenceAddress: true,
          baseCommune: true,
          coverageLatitude: true,
          coverageLongitude: true,
          maxTravelKm: true
        }
      },
      professionalProfile: {
        select: {
          id: true
        }
      }
    }
  });

  const onboarding = user?.cleaningOnboarding;
  if (!onboarding?.categorySlug) {
    return { updated: 0, reason: "missing_onboarding_category" as const };
  }

  const profile = await prisma.professionalProfile.upsert({
    where: { userId },
    create: {
      userId,
      avatarUrl: onboarding.profilePhotoUrl,
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
      avatarUrl: onboarding.profilePhotoUrl ?? undefined,
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

  const mainSync = await syncTaskerServicesForCategory({
    professionalProfileId: profile.id,
    categorySlug: onboarding.categorySlug,
    hourlyRateClp: onboarding.hourlyRateClp,
    minBookingHours: onboarding.minBookingHours,
    offeredServices: getOnboardingServiceSlugs(onboarding.offeredServices)
  });

  const additionalCategories = await prisma.taskerCategoryProfile.findMany({
    where: {
      professionalProfileId: profile.id,
      isActive: true
    },
    select: {
      categorySlug: true,
      hourlyRateClp: true,
      minBookingHours: true,
      scopeData: true
    }
  });

  let updated = mainSync.updated;
  for (const item of additionalCategories) {
    const sync = await syncTaskerServicesForCategory({
      professionalProfileId: profile.id,
      categorySlug: item.categorySlug,
      hourlyRateClp: item.hourlyRateClp,
      minBookingHours: item.minBookingHours,
      offeredServices: extractOfferedServicesForTaskerCategory(item.categorySlug, item.scopeData)
    });
    updated += sync.updated;
  }

  return {
    updated,
    reason: "synced" as const,
    profileId: profile.id
  };
}

export async function syncTaskerAvailabilitySlotsFromOnboarding(userId: string, weeks = 6) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
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
          hourlyRateClp: true,
          availabilityBlocks: true
        }
      }
    }
  });

  const activeTaskerServicesCount = user?.professionalProfile
    ? await prisma.taskerService.count({
        where: {
          professionalProfileId: user.professionalProfile.id,
          isActive: true
        }
      })
    : 0;

  const publication = getTaskerPublicationState({
    onboarding: user?.cleaningOnboarding ?? null,
    profile: user?.professionalProfile ?? null,
    activeTaskerServicesCount
  });

  if (!user?.professionalProfile || !user.cleaningOnboarding) {
    return { created: 0, publication, reason: "missing_profile_or_onboarding" };
  }

  if (!publication.canAppearInSearch) {
    return { created: 0, publication, reason: "not_publishable" };
  }

  const generatedSlots = buildUpcomingSlotsFromBlocks(user.cleaningOnboarding.availabilityBlocks, weeks);
  if (generatedSlots.length === 0) {
    return { created: 0, publication, reason: "no_availability_blocks" };
  }

  const existingSlots = await prisma.availabilitySlot.findMany({
    where: {
      professionalProfileId: user.professionalProfile.id,
      startsAt: { gte: new Date() }
    },
    select: {
      startsAt: true,
      endsAt: true
    }
  });

  const existingKeys = new Set(existingSlots.map((slot) => `${slot.startsAt.toISOString()}-${slot.endsAt.toISOString()}`));
  const newSlots = generatedSlots.filter(
    (slot) => !existingKeys.has(`${slot.startsAt.toISOString()}-${slot.endsAt.toISOString()}`)
  );

  if (newSlots.length === 0) {
    return { created: 0, publication, reason: "already_synced" };
  }

  await prisma.availabilitySlot.createMany({
    data: newSlots.map((slot) => ({
      professionalProfileId: user.professionalProfile!.id,
      serviceId: null,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      isAvailable: true
    }))
  });

  return { created: newSlots.length, publication, reason: "created" };
}
