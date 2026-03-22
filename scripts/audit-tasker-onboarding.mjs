import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function logStep(title, payload) {
  console.log(`\n[tasker-audit] ${title}`);
  if (payload !== undefined) {
    console.dir(payload, { depth: null });
  }
}

async function ensureRole(code, label) {
  return prisma.role.upsert({
    where: { code },
    update: { label },
    create: { code, label }
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está configurado. No se puede auditar la base real.");
  }

  const email = `audit-tasker-${Date.now()}@wetask.cl`;
  const passwordHash = await bcrypt.hash("AuditTasker2026!", 10);

  const rolePro = await ensureRole("PRO", "Tasker");

  const category = await prisma.category.upsert({
    where: { slug: "limpieza" },
    update: {
      name: "Limpieza",
      isActive: true,
      minHours: 2,
      slotMinutes: 60
    },
    create: {
      slug: "limpieza",
      name: "Limpieza",
      description: "Limpieza de casas y departamentos",
      minHours: 2,
      slotMinutes: 60,
      basePlatformFeePct: 12,
      urgencyFeeClp: 8000,
      materialFeeDefaultClp: 5000,
      isActive: true
    }
  });

  const service = await prisma.service.upsert({
    where: { slug: "limpieza-hogar" },
    update: {
      name: "Limpieza estándar",
      isActive: true,
      categoryId: category.id
    },
    create: {
      slug: "limpieza-hogar",
      name: "Limpieza estándar",
      description: "Mantención general del hogar",
      basePriceClp: 22000,
      durationMin: 60,
      isActive: true,
      categoryId: category.id
    }
  });

  const nextMonday = new Date();
  const delta = ((1 - nextMonday.getDay() + 7) % 7) || 7;
  nextMonday.setDate(nextMonday.getDate() + delta);
  nextMonday.setHours(9, 0, 0, 0);

  const slotEnd = new Date(nextMonday);
  slotEnd.setHours(13, 0, 0, 0);

  const user = await prisma.user.create({
    data: {
      email,
      fullName: "Tasker Auditoría Demo",
      phone: "+56912345678",
      role: "PRO",
      passwordHash,
      emailVerifiedAt: new Date(),
      termsAcceptedAt: new Date(),
      roleAssignments: {
        create: {
          roleId: rolePro.id
        }
      },
      professionalProfile: {
        create: {
          avatarUrl: "data:image/png;base64,aQ==",
          bio: "Tasker de prueba para auditoría del onboarding.",
          isVerified: true,
          verificationStatus: "APPROVED",
          coverageStreet: "Paseo Lo Matta 1610",
          coverageComuna: "Vitacura",
          coverageCity: "Santiago",
          coverageLatitude: -33.387,
          coverageLongitude: -70.574,
          serviceRadiusKm: 15,
          hourlyRateFromClp: 15000
        }
      },
      cleaningOnboarding: {
        create: {
          status: "ACTIVO",
          currentStep: 12,
          categorySlug: "limpieza",
          baseCommune: "Vitacura",
          referenceAddress: "Paseo Lo Matta 1610",
          documentId: "12.345.678-5",
          profilePhotoUrl: "data:image/png;base64,aQ==",
          yearsExperience: 3,
          workMode: "SOLO",
          offeredServices: ["limpieza-hogar"],
          cleaningScope: {
            services_offered: ["limpieza-hogar"],
            tasks_included: ["barrer", "aspirar", "trapear", "limpiar_banos"],
            tasks_excluded: ["limpieza_en_altura"],
            special_conditions: "Caso auditado por script."
          },
          serviceCommunes: ["Vitacura"],
          coverageLatitude: -33.387,
          coverageLongitude: -70.574,
          maxTravelKm: 15,
          availabilityMode: "FIJA",
          availabilityBlocks: [{ day: "lunes", start: "09:00", end: "13:00" }],
          hourlyRateClp: 15000,
          minBookingHours: 2,
          weekendSurchargePct: 0,
          holidaySurchargePct: 0,
          phoneValidatedAt: new Date(),
          identityDocumentFrontFile: "data:image/png;base64,aQ==",
          identityDocumentBackFile: "data:image/png;base64,aQ==",
          criminalRecordFile: "data:application/pdf;base64,aQ==",
          bankAccountHolder: "Tasker Auditoría Demo",
          bankAccountHolderRut: "12.345.678-5",
          bankName: "BancoEstado",
          bankAccountType: "Cuenta RUT",
          bankAccountNumber: "12345678",
          acceptsCancellationPolicy: true,
          acceptsServiceProtocol: true,
          acceptsDataProcessing: true,
          confirmsCleaningScope: true,
          submittedAt: new Date(),
          approvedAt: new Date(),
          activatedAt: new Date()
        }
      }
    },
    include: {
      professionalProfile: true,
      cleaningOnboarding: true
    }
  });

  await prisma.taskerService.create({
    data: {
      professionalProfileId: user.professionalProfile.id,
      categoryId: category.id,
      serviceId: service.id,
      priceClp: 15000,
      minBooking: 2,
      isActive: true
    }
  });

  await prisma.availabilitySlot.create({
    data: {
      professionalProfileId: user.professionalProfile.id,
      serviceId: null,
      startsAt: nextMonday,
      endsAt: slotEnd,
      isAvailable: true
    }
  });

  logStep("tasker creado", {
    userId: user.id,
    email: user.email,
    onboardingStatus: user.cleaningOnboarding.status,
    currentStep: user.cleaningOnboarding.currentStep
  });

  const stored = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      professionalProfile: true,
      cleaningOnboarding: true
    }
  });

  logStep("persistencia verificada", {
    hasUser: Boolean(stored),
    hasProfile: Boolean(stored?.professionalProfile),
    hasOnboarding: Boolean(stored?.cleaningOnboarding),
    onboardingStatus: stored?.cleaningOnboarding?.status,
    commune: stored?.cleaningOnboarding?.baseCommune,
    hourlyRate: stored?.cleaningOnboarding?.hourlyRateClp
  });

  const searchCandidates = await prisma.professionalProfile.findMany({
    where: {
      isVerified: true,
      user: { role: "PRO" },
      taskerServices: {
        some: {
          serviceId: service.id,
          isActive: true
        }
      }
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          cleaningOnboarding: {
            select: {
              status: true,
              currentStep: true,
              baseCommune: true,
              serviceCommunes: true,
              submittedAt: true
            }
          }
        }
      },
      slots: {
        where: {
          isAvailable: true,
          startsAt: { gte: new Date() }
        }
      }
    }
  });

  const found = searchCandidates.find((candidate) => candidate.user.id === user.id);

  logStep("resultado de búsqueda", {
    totalCandidates: searchCandidates.length,
    foundInSearch: Boolean(found),
    foundUserId: found?.user.id ?? null,
    foundSlots: found?.slots.length ?? 0,
    foundCommune: found?.user.cleaningOnboarding?.baseCommune ?? null
  });
}

main()
  .catch((error) => {
    console.error("[tasker-audit] error");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
