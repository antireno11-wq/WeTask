import { UserRole } from "@prisma/client";
import { logger, safeErrorDetail } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { supportsBabysitterRequestedTasks } from "@/lib/babysitter-scope";
import { supportsChefRequestedTasks } from "@/lib/chef-scope";
import { supportsCleaningRequestedTasks } from "@/lib/cleaning-scope";
import { distanceKm, geocodeAddress } from "@/lib/geo";
import { supportsIroningRequestedTasks } from "@/lib/ironing-scope";
import { supportsMakeupRequestedTasks } from "@/lib/makeup-scope";
import { COVERAGE_UNAVAILABLE_MESSAGE, inferCommuneFromAddress, normalizeCommune, taskerServesCommune } from "@/lib/communes";
import { ensureMarketplaceDemoData } from "@/lib/marketplace-demo-data";
import { supportsPetRequestedTasks } from "@/lib/pet-scope";
import { prisma } from "@/lib/prisma";
import {
  canPublishTaskerCategoryProfile,
  getCoreServiceForTaskerCategory,
  normalizeTaskerCategorySlug,
  supportsRequestedTasksForTaskerCategory
} from "@/lib/tasker-category-profiles";
import {
  getTaskerPublicationState,
  syncTaskerAvailabilitySlotsFromOnboarding,
  syncTaskerMarketplaceServicesFromOnboarding
} from "@/lib/tasker-publication";
import { matchesTeacherFilters, supportsTeacherRequestedTasks } from "@/lib/teacher-scope";
import { supportsTrainerRequestedTasks } from "@/lib/trainer-scope";
import { hasAssignedRole } from "@/lib/user-roles";
import { marketplaceSearchProsSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

const LEGACY_SEARCH_PUBLICATION_REQUIREMENTS = new Set(["onboarding_completed", "published", "status_active"]);

function buildSlotFiltersForCategory(categoryId?: string, serviceId?: string) {
  if (serviceId) {
    return [{ serviceId: null }, { serviceId }];
  }

  if (categoryId) {
    return [{ serviceId: null }, { service: { categoryId } }];
  }

  return undefined;
}

function supportsRequestedTasksByCategory(
  categorySlug: string | null | undefined,
  scopes: {
    cleaningScope?: unknown;
    petScope?: unknown;
    babysitterScope?: unknown;
    trainerScope?: unknown;
    teacherScope?: unknown;
    chefScope?: unknown;
    makeupScope?: unknown;
    ironingScope?: unknown;
  },
  requestedTasks: string[]
) {
  if (requestedTasks.length === 0) return true;

  switch (categorySlug) {
    case "limpieza":
      return supportsCleaningRequestedTasks(scopes.cleaningScope, requestedTasks);
    case "mascotas":
      return supportsPetRequestedTasks(scopes.petScope, requestedTasks);
    case "babysitter":
      return supportsBabysitterRequestedTasks(scopes.babysitterScope, requestedTasks);
    case "personal-trainer":
      return supportsTrainerRequestedTasks(scopes.trainerScope, requestedTasks);
    case "profesor-particular":
      return supportsTeacherRequestedTasks(scopes.teacherScope, requestedTasks);
    case "chef":
      return supportsChefRequestedTasks(scopes.chefScope, requestedTasks);
    case "maquillaje":
      return supportsMakeupRequestedTasks(scopes.makeupScope, requestedTasks);
    case "planchado":
      return supportsIroningRequestedTasks(scopes.ironingScope, requestedTasks);
    default:
      return true;
  }
}

export async function GET(req: NextRequest) {
  try {
    await ensureMarketplaceDemoData();

    const input = marketplaceSearchProsSchema.parse({
      city: req.nextUrl.searchParams.get("city") ?? undefined,
      commune: req.nextUrl.searchParams.get("commune") ?? undefined,
      postalCode: req.nextUrl.searchParams.get("postalCode") ?? undefined,
      street: req.nextUrl.searchParams.get("street") ?? undefined,
      latitude: req.nextUrl.searchParams.get("latitude") ?? undefined,
      longitude: req.nextUrl.searchParams.get("longitude") ?? undefined,
      categoryId: req.nextUrl.searchParams.get("categoryId") ?? undefined,
      serviceId: req.nextUrl.searchParams.get("serviceId") ?? undefined,
      classSubject: req.nextUrl.searchParams.get("classSubject") ?? undefined,
      classMusicType: req.nextUrl.searchParams.get("classMusicType") ?? undefined,
      classMode: req.nextUrl.searchParams.get("classMode") ?? undefined,
      classLevel: req.nextUrl.searchParams.get("classLevel") ?? undefined,
      classFrequency: req.nextUrl.searchParams.get("classFrequency") ?? undefined,
      classNotes: req.nextUrl.searchParams.get("classNotes") ?? undefined,
      tasks: req.nextUrl.searchParams.get("tasks") ?? undefined,
      date: req.nextUrl.searchParams.get("date") ?? undefined,
      limit: req.nextUrl.searchParams.get("limit") ?? undefined
    });

    const clientCommune =
      normalizeCommune(input.commune) ??
      inferCommuneFromAddress(`${input.street ?? ""}, ${input.city ?? ""}, Chile`);

    const [requestedService, requestedCategory] = await Promise.all([
      input.serviceId
        ? prisma.service.findUnique({
            where: { id: input.serviceId },
            select: { id: true, category: { select: { slug: true } } }
          })
        : null,
      input.categoryId
        ? prisma.category.findUnique({
            where: { id: input.categoryId },
            select: { id: true, slug: true }
          })
        : null
    ]);

    const requestedCategorySlug = normalizeTaskerCategorySlug(requestedService?.category?.slug ?? requestedCategory?.slug ?? null);
    const onlineTeacherSearch =
      requestedCategorySlug === "profesor-particular" &&
      (input.classMode === "online" || input.classMode === "flexible");

    if (!clientCommune && !onlineTeacherSearch) {
      return NextResponse.json(
        {
          error: COVERAGE_UNAVAILABLE_MESSAGE
        },
        { status: 400 }
      );
    }

    const customerCoords =
      typeof input.latitude === "number" && typeof input.longitude === "number"
        ? { lat: input.latitude, lng: input.longitude }
        : onlineTeacherSearch
          ? null
          : geocodeAddress({
              city: input.city,
              postalCode: input.postalCode,
              street: input.street,
              commune: clientCommune ?? undefined
            });

    const slotFilters = buildSlotFiltersForCategory(input.categoryId, input.serviceId);

    if (requestedCategorySlug) {
      const requestedCoreService = getCoreServiceForTaskerCategory(requestedCategorySlug);
      if (requestedCoreService) {
        const onboardingsToSync = await prisma.cleaningOnboarding.findMany({
          where: {
            categorySlug: requestedCoreService.slug,
            status: "ACTIVO"
          },
          select: { userId: true }
        });

        for (const onboarding of onboardingsToSync) {
          const syncResult = await syncTaskerMarketplaceServicesFromOnboarding(onboarding.userId);
          if (syncResult.updated > 0 || syncResult.reason === "synced") {
            logger.info(
              {
                userId: onboarding.userId,
                categorySlug: requestedCoreService.slug,
                syncedServices: syncResult.updated,
                reason: syncResult.reason
              },
              "tasker-search: synced tasker services from onboarding"
            );
          }
        }
      }
    }
    const now = new Date();
    const startDate = input.date && input.date.getTime() > now.getTime() ? input.date : now;

    const profiles = await prisma.professionalProfile.findMany({
      where: {
        isVerified: true,
        user: {
          mpAccountStatus: "ACTIVE",
          OR: [{ role: UserRole.PRO }, { roleAssignments: { some: { role: { code: UserRole.PRO } } } }]
        },
        slots:
          input.categoryId && !input.serviceId
            ? {
                some: {
                  isAvailable: true,
                  startsAt: { gte: startDate },
                  OR: slotFilters
                }
              }
            : undefined,
        taskerServices:
          input.serviceId || input.categoryId
            ? {
                some: {
                  isActive: true,
                  serviceId: input.serviceId ?? undefined,
                  categoryId: input.categoryId ?? undefined
                }
              }
            : undefined
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            roleAssignments: {
              select: {
                role: {
                  select: {
                    code: true
                  }
                }
              }
            },
            cleaningOnboarding: {
              select: {
                categorySlug: true,
                profilePhotoUrl: true,
                profilePhotoPositionX: true,
                profilePhotoPositionY: true,
                cleaningScope: true,
                petScope: true,
                babysitterScope: true,
                trainerScope: true,
                teacherScope: true,
                chefScope: true,
                makeupScope: true,
                ironingScope: true,
                serviceCommunes: true,
                baseCommune: true,
                status: true,
                currentStep: true,
                submittedAt: true,
                hourlyRateClp: true,
                availabilityBlocks: true
              }
            }
          }
        },
        categoryProfiles: {
          where: { isActive: true },
          orderBy: [{ createdAt: "asc" }]
        },
        taskerServices: {
          where: {
            isActive: true
          },
          select: {
            priceClp: true,
            serviceId: true,
            categoryId: true,
            category: {
              select: {
                slug: true
              }
            }
          }
        },
        slots: {
          where: {
            isAvailable: true,
            startsAt: { gte: startDate },
            OR: slotFilters
          },
          orderBy: [{ startsAt: "asc" }],
          take: 12,
          include: { service: { select: { id: true, name: true } } }
        }
      }
    });

    const filterStats = {
      notPublishable: 0,
      communeMismatch: 0,
      tasksMismatch: 0,
      noAvailability: 0
    };

    const matched = (
      await Promise.all(
        profiles.map(async (profile) => {
          if (!hasAssignedRole(profile.user, "PRO")) {
            filterStats.notPublishable += 1;
            return null;
          }

          let activeTaskerServices = profile.taskerServices;
          const hasRequestedTaskerService =
            !input.serviceId && !input.categoryId
              ? activeTaskerServices.length > 0
              : activeTaskerServices.some((taskerService) => {
                  if (input.serviceId) return taskerService.serviceId === input.serviceId;
                  if (input.categoryId) return taskerService.categoryId === input.categoryId;
                  return true;
                });

          if (activeTaskerServices.length === 0 || !hasRequestedTaskerService) {
            const serviceSync = await syncTaskerMarketplaceServicesFromOnboarding(profile.user.id);
            if (serviceSync.updated > 0) {
              logger.info(
                {
                  userId: profile.user.id,
                  updatedServices: serviceSync.updated,
                  reason: serviceSync.reason
                },
                "tasker-search: synced onboarding services"
              );
              activeTaskerServices = await prisma.taskerService.findMany({
                where: {
                  professionalProfileId: profile.id,
                  isActive: true
                },
                select: {
                  priceClp: true,
                  serviceId: true,
                  categoryId: true,
                  category: {
                    select: {
                      slug: true
                    }
                  }
                }
              });
              profile.taskerServices = activeTaskerServices;
            }
          }

          const publication = getTaskerPublicationState({
            onboarding: profile.user.cleaningOnboarding,
            profile: {
              isVerified: profile.isVerified,
              coverageComuna: profile.coverageComuna,
              hourlyRateFromClp: profile.hourlyRateFromClp
            },
            activeTaskerServicesCount: activeTaskerServices.length
          });

          const canUseLegacyVerifiedFallback =
            profile.isVerified &&
            activeTaskerServices.length > 0 &&
            publication.missingRequirements.length > 0 &&
            publication.missingRequirements.every((requirement) => LEGACY_SEARCH_PUBLICATION_REQUIREMENTS.has(requirement));

          if (!publication.canAppearInSearch && !canUseLegacyVerifiedFallback) {
            filterStats.notPublishable += 1;
            return null;
          }

          const matchedTaskerServices = activeTaskerServices.filter((taskerService) => {
            if (input.serviceId) return taskerService.serviceId === input.serviceId;
            if (input.categoryId) return taskerService.categoryId === input.categoryId;
            return true;
          });
          if ((input.serviceId || input.categoryId) && matchedTaskerServices.length === 0) {
            filterStats.notPublishable += 1;
            return null;
          }

          const onboardingCategorySlug = normalizeTaskerCategorySlug(profile.user.cleaningOnboarding?.categorySlug);
          const selectedCategorySlug =
            requestedCategorySlug ??
            normalizeTaskerCategorySlug(matchedTaskerServices[0]?.category?.slug ?? activeTaskerServices[0]?.category?.slug ?? null);
          const selectedAdditionalCategory =
            selectedCategorySlug && selectedCategorySlug !== onboardingCategorySlug
              ? profile.categoryProfiles.find((item) => normalizeTaskerCategorySlug(item.categorySlug) === selectedCategorySlug) ?? null
              : null;

          if (requestedCategorySlug && requestedCategorySlug !== onboardingCategorySlug) {
            if (!selectedAdditionalCategory || !canPublishTaskerCategoryProfile(selectedAdditionalCategory)) {
              filterStats.notPublishable += 1;
              return null;
            }
          }

          if (profile.slots.length === 0 && profile.user.cleaningOnboarding?.availabilityBlocks) {
            const syncResult = await syncTaskerAvailabilitySlotsFromOnboarding(profile.user.id);
            if (syncResult.created > 0) {
              logger.info(
                { userId: profile.user.id, createdSlots: syncResult.created },
                "tasker-search: synced onboarding availability"
              );
              profile.slots = await prisma.availabilitySlot.findMany({
                where: {
                  professionalProfileId: profile.id,
                  isAvailable: true,
                  startsAt: { gte: startDate },
                  OR: slotFilters
                },
                orderBy: [{ startsAt: "asc" }],
                take: 12,
                include: { service: { select: { id: true, name: true } } }
              });
            }
          }

          const communeSource =
            selectedAdditionalCategory && canPublishTaskerCategoryProfile(selectedAdditionalCategory)
              ? {
                  serviceCommunes: selectedAdditionalCategory.serviceCommunes,
                  coverageComuna: profile.coverageComuna ?? profile.user.cleaningOnboarding?.baseCommune
                }
              : {
                  serviceCommunes: profile.user.cleaningOnboarding?.serviceCommunes,
                  coverageComuna: profile.coverageComuna ?? profile.user.cleaningOnboarding?.baseCommune
                };

          const servesCommune =
            onlineTeacherSearch && !clientCommune
              ? true
              : taskerServesCommune(
                  {
                    serviceCommunes: communeSource.serviceCommunes,
                    coverageComuna: communeSource.coverageComuna
                  },
                  clientCommune
                );
          if (!servesCommune) {
            filterStats.communeMismatch += 1;
            return null;
          }

          if (
            input.tasks.length > 0 &&
            !(
              selectedAdditionalCategory && canPublishTaskerCategoryProfile(selectedAdditionalCategory)
                ? supportsRequestedTasksForTaskerCategory(selectedAdditionalCategory.categorySlug, selectedAdditionalCategory.scopeData, input.tasks)
                : supportsRequestedTasksByCategory(profile.user.cleaningOnboarding?.categorySlug, profile.user.cleaningOnboarding ?? {}, input.tasks)
            )
          ) {
            filterStats.tasksMismatch += 1;
            return null;
          }

          if (selectedCategorySlug === "profesor-particular") {
            const teacherScopeSource =
              selectedAdditionalCategory && canPublishTaskerCategoryProfile(selectedAdditionalCategory)
                ? selectedAdditionalCategory.scopeData
                : profile.user.cleaningOnboarding?.teacherScope;

            const matchesStructuredTeacherFilters = matchesTeacherFilters(teacherScopeSource, {
              subject: input.classSubject ?? null,
              musicType: input.classMusicType ?? null,
              mode: input.classMode === "flexible" ? null : input.classMode ?? null,
              level: input.classLevel ?? null
            });

            if (!matchesStructuredTeacherFilters) {
              filterStats.tasksMismatch += 1;
              return null;
            }
          }

          const distance =
            customerCoords && profile.coverageLatitude != null && profile.coverageLongitude != null
              ? distanceKm(customerCoords, {
                  lat: profile.coverageLatitude,
                  lng: profile.coverageLongitude
                })
              : null;

          if (profile.slots.length === 0) {
            filterStats.noAvailability += 1;
            return null;
          }

          return {
            ...profile,
            taskerServices: matchedTaskerServices.length > 0 ? matchedTaskerServices : activeTaskerServices,
            hourlyRateFromClp:
              matchedTaskerServices[0]?.priceClp ??
              selectedAdditionalCategory?.hourlyRateClp ??
              activeTaskerServices[0]?.priceClp ??
              profile.hourlyRateFromClp,
            distanceKm: typeof distance === "number" ? Number(distance.toFixed(2)) : null,
            nextAvailableAt: profile.slots[0]?.startsAt ?? null,
            matchedCategorySlug: selectedCategorySlug
          };
        })
      )
    )
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .filter((item) => item.slots.length > 0)
      .sort((a, b) => {
        const distanceA = typeof a.distanceKm === "number" ? a.distanceKm : Number.MAX_SAFE_INTEGER;
        const distanceB = typeof b.distanceKm === "number" ? b.distanceKm : Number.MAX_SAFE_INTEGER;
        if (distanceA !== distanceB) return distanceA - distanceB;

        const aTime = a.nextAvailableAt ? new Date(a.nextAvailableAt).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.nextAvailableAt ? new Date(b.nextAvailableAt).getTime() : Number.MAX_SAFE_INTEGER;
        if (aTime !== bTime) return aTime - bTime;

        const ratingDiff = Number(b.ratingAvg) - Number(a.ratingAvg);
        if (ratingDiff !== 0) return ratingDiff;

        const aRate = a.hourlyRateFromClp ?? Number.MAX_SAFE_INTEGER;
        const bRate = b.hourlyRateFromClp ?? Number.MAX_SAFE_INTEGER;
        return aRate - bRate;
      })
      .slice(0, input.limit);

    logger.info(
      {
        categoryId: input.categoryId ?? null,
        serviceId: input.serviceId ?? null,
        classSubject: input.classSubject ?? null,
        classMusicType: input.classMusicType ?? null,
        classMode: input.classMode ?? null,
        classLevel: input.classLevel ?? null,
        commune: clientCommune,
        requestedTasks: input.tasks,
        profilesLoaded: profiles.length,
        matched: matched.length,
        filtered: filterStats
      },
      "tasker-search audit"
    );

    return NextResponse.json({
      customerLocation: {
        city: input.city,
        commune: clientCommune,
        postalCode: input.postalCode,
        coordinates: customerCoords
      },
      professionals: matched
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo buscar profesionales por dirección",
        detail: safeErrorDetail(error)
      },
      { status: 400 }
    );
  }
}
