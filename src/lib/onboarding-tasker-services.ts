import { CleaningOnboardingStatus } from "@prisma/client";
import { isChefServiceSlug } from "@/lib/chef-service-types";
import { isCleaningServiceSlug } from "@/lib/cleaning-service-types";
import { findCoreServiceByOnboardingCategory } from "@/lib/core-services";
import { prisma } from "@/lib/prisma";

export async function syncTaskerServicesFromOnboarding(userId: string) {
  const onboarding = await prisma.cleaningOnboarding.findUnique({
    where: { userId },
    select: {
      userId: true,
      status: true,
      categorySlug: true,
      offeredServices: true,
      profilePhotoUrl: true,
      shortDescription: true,
      referenceAddress: true,
      baseCommune: true,
      coverageLatitude: true,
      coverageLongitude: true,
      maxTravelKm: true,
      hourlyRateClp: true,
      minBookingHours: true
    }
  });

  if (!onboarding) {
    return { ok: false, reason: "missing_onboarding", syncedServices: 0 };
  }

  const selectedCoreService = findCoreServiceByOnboardingCategory(onboarding.categorySlug);
  if (!selectedCoreService) {
    return { ok: false, reason: "missing_core_service", syncedServices: 0 };
  }

  const category = await prisma.category.findFirst({
    where: {
      isActive: true,
      slug: selectedCoreService.categorySlug
    },
    orderBy: [{ slug: "asc" }]
  });

  if (!category) {
    return { ok: false, reason: "missing_category", syncedServices: 0 };
  }

  const profile = await prisma.professionalProfile.upsert({
    where: { userId },
    create: {
      userId,
      avatarUrl: onboarding.profilePhotoUrl,
      bio: onboarding.shortDescription,
      isVerified:
        onboarding.status === CleaningOnboardingStatus.APROBADO || onboarding.status === CleaningOnboardingStatus.ACTIVO,
      verificationStatus:
        onboarding.status === CleaningOnboardingStatus.ACTIVO
          ? "ACTIVE"
          : onboarding.status === CleaningOnboardingStatus.APROBADO
            ? "APPROVED"
            : "PENDING_REVIEW",
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
      isVerified:
        onboarding.status === CleaningOnboardingStatus.APROBADO || onboarding.status === CleaningOnboardingStatus.ACTIVO,
      verificationStatus:
        onboarding.status === CleaningOnboardingStatus.ACTIVO
          ? "ACTIVE"
          : onboarding.status === CleaningOnboardingStatus.APROBADO
            ? "APPROVED"
            : "PENDING_REVIEW",
      coverageStreet: onboarding.referenceAddress,
      coverageComuna: onboarding.baseCommune,
      coverageLatitude: onboarding.coverageLatitude ?? undefined,
      coverageLongitude: onboarding.coverageLongitude ?? undefined,
      serviceRadiusKm: onboarding.maxTravelKm ?? undefined,
      hourlyRateFromClp: onboarding.hourlyRateClp
    }
  });

  const selectedOnboardingServices =
    Array.isArray(onboarding.offeredServices) && onboarding.categorySlug === "limpieza"
      ? onboarding.offeredServices.filter((item): item is string => typeof item === "string" && isCleaningServiceSlug(item))
      : Array.isArray(onboarding.offeredServices) && onboarding.categorySlug === "chef"
        ? onboarding.offeredServices.filter((item): item is string => typeof item === "string" && isChefServiceSlug(item))
        : [];

  const services = selectedOnboardingServices.length
    ? await prisma.service.findMany({
        where: {
          categoryId: category.id,
          isActive: true,
          slug: { in: selectedOnboardingServices }
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
    return { ok: false, reason: "missing_services", syncedServices: 0 };
  }

  const existingTaskerServices = await prisma.taskerService.findMany({
    where: {
      professionalProfileId: profile.id,
      serviceId: { in: services.map((service) => service.id) }
    },
    select: {
      serviceId: true,
      priceClp: true
    }
  });
  const existingPriceMap = new Map(existingTaskerServices.map((item) => [item.serviceId, item.priceClp]));

  for (const service of services) {
    await prisma.taskerService.upsert({
      where: {
        professionalProfileId_serviceId: {
          professionalProfileId: profile.id,
          serviceId: service.id
        }
      },
      create: {
        professionalProfileId: profile.id,
        categoryId: category.id,
        serviceId: service.id,
        priceClp: existingPriceMap.get(service.id) ?? onboarding.hourlyRateClp ?? service.basePriceClp,
        minBooking: onboarding.minBookingHours ?? category.minHours,
        isActive: true
      },
      update: {
        categoryId: category.id,
        priceClp: existingPriceMap.get(service.id) ?? onboarding.hourlyRateClp ?? service.basePriceClp,
        minBooking: onboarding.minBookingHours ?? category.minHours,
        isActive: true
      }
    });
  }

  await prisma.taskerService.updateMany({
    where: {
      professionalProfileId: profile.id,
      categoryId: category.id,
      serviceId: { notIn: services.map((service) => service.id) }
    },
    data: { isActive: false }
  });

  const fallbackRate = Math.min(...services.map((service) => existingPriceMap.get(service.id) ?? onboarding.hourlyRateClp ?? service.basePriceClp));
  await prisma.professionalProfile.update({
    where: { userId },
    data: { hourlyRateFromClp: fallbackRate }
  });

  return {
    ok: true,
    reason: "synced",
    syncedServices: services.length,
    categorySlug: selectedCoreService.slug,
    categoryRecordSlug: selectedCoreService.categorySlug
  };
}
