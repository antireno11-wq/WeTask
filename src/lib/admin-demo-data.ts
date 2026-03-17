import { CleaningAvailabilityMode, CleaningOnboardingStatus, CleaningWorkMode, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const DEMO_PASSWORD_HASH = "$2a$12$LX3eD21fpfkg/xsBDNBrkeBrgQdo9iLcWaG1jOOMonHmBMChElxva";
const DEMO_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn1l1QAAAAASUVORK5CYII=";

type AdminDemoOnboarding = {
  email: string;
  fullName: string;
  phone: string;
  status: CleaningOnboardingStatus;
  baseCommune: string;
  address: string;
  coordinates: { lat: number; lng: number };
  rate: number;
  minHours: number;
  yearsExperience: number;
  description: string;
  serviceCommunes: string[];
  submittedAt: Date;
  reviewedAt?: Date;
  approvedAt?: Date;
  activatedAt?: Date;
  adminReviewNotes?: string;
  createProfessionalProfile?: boolean;
};

async function ensureRoleAssignment(userId: string, code: UserRole, label: string) {
  const role = await prisma.role.upsert({
    where: { code },
    update: { label },
    create: { code, label }
  });

  await prisma.userRoleAssignment.upsert({
    where: { userId_roleId: { userId, roleId: role.id } },
    update: {},
    create: { userId, roleId: role.id }
  });
}

export async function ensureAdminCleaningDemoData() {
  const existing = await prisma.cleaningOnboarding.count({
    where: {
      OR: [{ status: CleaningOnboardingStatus.PENDIENTE_REVISION }, { status: CleaningOnboardingStatus.REQUIERE_CORRECCION }, { status: CleaningOnboardingStatus.APROBADO }]
    }
  });

  if (existing >= 3) return;

  const now = new Date();
  const demoOnboardings: AdminDemoOnboarding[] = [
    {
      email: "demo.revision.javiera@wetask.cl",
      fullName: "Javiera Soto",
      phone: "+56981112233",
      status: CleaningOnboardingStatus.PENDIENTE_REVISION,
      baseCommune: "Las Condes",
      address: "Av. Apoquindo 2450",
      coordinates: { lat: -33.4162, lng: -70.5891 },
      rate: 15000,
      minHours: 2,
      yearsExperience: 4,
      description: "Especialista en limpieza de hogares, con foco en orden, puntualidad y buena atención al cliente.",
      serviceCommunes: ["Las Condes", "Vitacura", "Providencia"],
      submittedAt: new Date(now.getTime() - 1000 * 60 * 60 * 6)
    },
    {
      email: "demo.revision.macarena@wetask.cl",
      fullName: "Macarena Díaz",
      phone: "+56982223344",
      status: CleaningOnboardingStatus.REQUIERE_CORRECCION,
      baseCommune: "Providencia",
      address: "Antonio Varas 980",
      coordinates: { lat: -33.4321, lng: -70.6166 },
      rate: 16000,
      minHours: 3,
      yearsExperience: 6,
      description: "Limpieza profunda y apoyo recurrente para departamentos, con experiencia trabajando con mascotas.",
      serviceCommunes: ["Providencia", "Ñuñoa", "La Reina"],
      submittedAt: new Date(now.getTime() - 1000 * 60 * 60 * 20),
      reviewedAt: new Date(now.getTime() - 1000 * 60 * 60 * 8),
      adminReviewNotes: "Falta una foto más nítida del reverso del carnet y aclarar el recargo por traslado."
    },
    {
      email: "demo.revision.felipe@wetask.cl",
      fullName: "Felipe Araya",
      phone: "+56983334455",
      status: CleaningOnboardingStatus.APROBADO,
      baseCommune: "Vitacura",
      address: "Av. Vitacura 5120",
      coordinates: { lat: -33.3924, lng: -70.5757 },
      rate: 17000,
      minHours: 2,
      yearsExperience: 5,
      description: "Servicio prolijo para limpieza general, planchado y apoyo en hogares con niños o adultos mayores.",
      serviceCommunes: ["Vitacura", "Lo Barnechea", "Las Condes"],
      submittedAt: new Date(now.getTime() - 1000 * 60 * 60 * 30),
      reviewedAt: new Date(now.getTime() - 1000 * 60 * 60 * 18),
      approvedAt: new Date(now.getTime() - 1000 * 60 * 60 * 18)
    },
    {
      email: "demo.revision.daniela@wetask.cl",
      fullName: "Daniela Fuentes",
      phone: "+56984445566",
      status: CleaningOnboardingStatus.ACTIVO,
      baseCommune: "Ñuñoa",
      address: "Av. Irarrázaval 2555",
      coordinates: { lat: -33.4566, lng: -70.6041 },
      rate: 14500,
      minHours: 2,
      yearsExperience: 3,
      description: "Limpieza recurrente y mantención semanal con excelente evaluación de clientes y rápida respuesta.",
      serviceCommunes: ["Ñuñoa", "Providencia", "La Reina"],
      submittedAt: new Date(now.getTime() - 1000 * 60 * 60 * 48),
      reviewedAt: new Date(now.getTime() - 1000 * 60 * 60 * 36),
      approvedAt: new Date(now.getTime() - 1000 * 60 * 60 * 36),
      activatedAt: new Date(now.getTime() - 1000 * 60 * 60 * 24),
      createProfessionalProfile: true
    }
  ];

  for (const demo of demoOnboardings) {
    const user = await prisma.user.upsert({
      where: { email: demo.email },
      update: {
        fullName: demo.fullName,
        phone: demo.phone,
        role: UserRole.PRO,
        authProvider: "EMAIL",
        passwordHash: DEMO_PASSWORD_HASH,
        emailVerifiedAt: now,
        termsAcceptedAt: now
      },
      create: {
        email: demo.email,
        fullName: demo.fullName,
        phone: demo.phone,
        role: UserRole.PRO,
        authProvider: "EMAIL",
        passwordHash: DEMO_PASSWORD_HASH,
        emailVerifiedAt: now,
        termsAcceptedAt: now
      }
    });

    await ensureRoleAssignment(user.id, UserRole.PRO, "Tasker");

    await prisma.cleaningOnboarding.upsert({
      where: { userId: user.id },
      update: {
        status: demo.status,
        currentStep: 11,
        categorySlug: "limpieza",
        baseCommune: demo.baseCommune,
        referenceAddress: demo.address,
        documentId: "18.765.432-1",
        birthDate: new Date("1992-06-15T00:00:00.000Z"),
        nationality: "Chilena",
        emergencyContactName: "Contacto de emergencia",
        emergencyContactPhone: "+56990001122",
        workReferences: "Referencias disponibles a solicitud.",
        profilePhotoUrl: DEMO_IMAGE,
        shortDescription: demo.description,
        yearsExperience: demo.yearsExperience,
        workMode: CleaningWorkMode.SOLO,
        experienceTypes: ["hogar", "profunda", "recurrente"],
        offeredServices: ["limpieza_general", "limpieza_profunda"],
        acceptsHomesWithPets: true,
        acceptsHomesWithChildren: true,
        acceptsHomesWithElderly: true,
        worksWithClientProducts: true,
        bringsOwnProducts: true,
        bringsOwnTools: true,
        languages: ["Español"],
        serviceCommunes: demo.serviceCommunes,
        coverageLatitude: demo.coordinates.lat,
        coverageLongitude: demo.coordinates.lng,
        maxTravelKm: 10,
        chargesTravelExtra: false,
        availabilityMode: CleaningAvailabilityMode.FIJA,
        availabilityBlocks: [
          { day: "Lunes", ranges: [{ start: "09:00", end: "13:00" }, { start: "14:00", end: "18:00" }] },
          { day: "Miércoles", ranges: [{ start: "09:00", end: "13:00" }] },
          { day: "Viernes", ranges: [{ start: "10:00", end: "16:00" }] }
        ],
        maxServicesPerDay: 3,
        acceptsUrgentBookings: true,
        hourlyRateClp: demo.rate,
        minBookingHours: demo.minHours,
        weekendSurchargePct: 20,
        holidaySurchargePct: 25,
        identityDocumentFrontFile: DEMO_IMAGE,
        identityDocumentBackFile: DEMO_IMAGE,
        criminalRecordFile: DEMO_IMAGE,
        bankAccountHolder: demo.fullName,
        bankAccountHolderRut: "18765432-1",
        bankName: "BancoEstado",
        bankAccountType: "Cuenta RUT",
        bankAccountNumber: "18765432",
        phoneValidatedAt: now,
        acceptsCancellationPolicy: true,
        acceptsServiceProtocol: true,
        acceptsDataProcessing: true,
        confirmsCleaningScope: true,
        submittedAt: demo.submittedAt,
        reviewedAt: demo.reviewedAt ?? null,
        approvedAt: demo.approvedAt ?? null,
        activatedAt: demo.activatedAt ?? null,
        adminReviewNotes: demo.adminReviewNotes ?? null
      },
      create: {
        userId: user.id,
        status: demo.status,
        currentStep: 11,
        categorySlug: "limpieza",
        baseCommune: demo.baseCommune,
        referenceAddress: demo.address,
        documentId: "18.765.432-1",
        birthDate: new Date("1992-06-15T00:00:00.000Z"),
        nationality: "Chilena",
        emergencyContactName: "Contacto de emergencia",
        emergencyContactPhone: "+56990001122",
        workReferences: "Referencias disponibles a solicitud.",
        profilePhotoUrl: DEMO_IMAGE,
        shortDescription: demo.description,
        yearsExperience: demo.yearsExperience,
        workMode: CleaningWorkMode.SOLO,
        experienceTypes: ["hogar", "profunda", "recurrente"],
        offeredServices: ["limpieza_general", "limpieza_profunda"],
        acceptsHomesWithPets: true,
        acceptsHomesWithChildren: true,
        acceptsHomesWithElderly: true,
        worksWithClientProducts: true,
        bringsOwnProducts: true,
        bringsOwnTools: true,
        languages: ["Español"],
        serviceCommunes: demo.serviceCommunes,
        coverageLatitude: demo.coordinates.lat,
        coverageLongitude: demo.coordinates.lng,
        maxTravelKm: 10,
        chargesTravelExtra: false,
        availabilityMode: CleaningAvailabilityMode.FIJA,
        availabilityBlocks: [
          { day: "Lunes", ranges: [{ start: "09:00", end: "13:00" }, { start: "14:00", end: "18:00" }] },
          { day: "Miércoles", ranges: [{ start: "09:00", end: "13:00" }] },
          { day: "Viernes", ranges: [{ start: "10:00", end: "16:00" }] }
        ],
        maxServicesPerDay: 3,
        acceptsUrgentBookings: true,
        hourlyRateClp: demo.rate,
        minBookingHours: demo.minHours,
        weekendSurchargePct: 20,
        holidaySurchargePct: 25,
        identityDocumentFrontFile: DEMO_IMAGE,
        identityDocumentBackFile: DEMO_IMAGE,
        criminalRecordFile: DEMO_IMAGE,
        bankAccountHolder: demo.fullName,
        bankAccountHolderRut: "18765432-1",
        bankName: "BancoEstado",
        bankAccountType: "Cuenta RUT",
        bankAccountNumber: "18765432",
        phoneValidatedAt: now,
        acceptsCancellationPolicy: true,
        acceptsServiceProtocol: true,
        acceptsDataProcessing: true,
        confirmsCleaningScope: true,
        submittedAt: demo.submittedAt,
        reviewedAt: demo.reviewedAt ?? null,
        approvedAt: demo.approvedAt ?? null,
        activatedAt: demo.activatedAt ?? null,
        adminReviewNotes: demo.adminReviewNotes ?? null
      }
    });

    if (demo.createProfessionalProfile) {
      await prisma.professionalProfile.upsert({
        where: { userId: user.id },
        update: {
          isVerified: true,
          verificationStatus: "APPROVED",
          coverageStreet: demo.address,
          coverageComuna: demo.baseCommune,
          coverageCity: "Santiago",
          coverageLatitude: demo.coordinates.lat,
          coverageLongitude: demo.coordinates.lng,
          serviceRadiusKm: 10,
          hourlyRateFromClp: demo.rate,
          bio: demo.description
        },
        create: {
          userId: user.id,
          isVerified: true,
          verificationStatus: "APPROVED",
          coverageStreet: demo.address,
          coverageComuna: demo.baseCommune,
          coverageCity: "Santiago",
          coverageLatitude: demo.coordinates.lat,
          coverageLongitude: demo.coordinates.lng,
          serviceRadiusKm: 10,
          hourlyRateFromClp: demo.rate,
          bio: demo.description
        }
      });
    }
  }
}
