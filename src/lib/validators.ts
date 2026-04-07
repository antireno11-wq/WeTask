import { BookingStatus } from "@prisma/client";
import { z } from "zod";
import {
  CLEANING_EXPERIENCE_TYPES,
  CLEANING_LANGUAGE_OPTIONS,
  CLEANING_SERVICE_TYPES,
  CLEANING_TRAINING_TOPICS,
  CLEANING_WEEK_DAYS
} from "@/lib/cleaning-onboarding";
import {
  CLEANING_SCOPE_SERVICE_OPTIONS,
  CLEANING_TASK_EXCLUDED_OPTIONS,
  CLEANING_TASK_INCLUDED_OPTIONS
} from "@/lib/cleaning-scope";
import {
  BABYSITTER_AGE_RANGE_OPTIONS,
  BABYSITTER_SCOPE_SERVICE_OPTIONS,
  BABYSITTER_TASK_EXCLUDED_OPTIONS,
  BABYSITTER_TASK_INCLUDED_OPTIONS
} from "@/lib/babysitter-scope";
import {
  CHEF_SCOPE_SERVICE_OPTIONS
} from "@/lib/chef-scope";
import {
  TRAINER_MODE_OPTIONS,
  TRAINER_SCOPE_SERVICE_OPTIONS,
  TRAINER_TASK_EXCLUDED_OPTIONS,
  TRAINER_TASK_INCLUDED_OPTIONS
} from "@/lib/trainer-scope";
import {
  TEACHER_LEVEL_OPTIONS,
  TEACHER_MODE_OPTIONS,
  TEACHER_SCOPE_SERVICE_OPTIONS,
  TEACHER_TASK_EXCLUDED_OPTIONS,
  TEACHER_TASK_INCLUDED_OPTIONS
} from "@/lib/teacher-scope";
import {
  PET_SCOPE_ANIMAL_OPTIONS,
  PET_SCOPE_SERVICE_OPTIONS,
  PET_TASK_EXCLUDED_OPTIONS,
  PET_TASK_INCLUDED_OPTIONS
} from "@/lib/pet-scope";
import {
  MAKEUP_SCOPE_SERVICE_OPTIONS,
  MAKEUP_TASK_EXCLUDED_OPTIONS,
  MAKEUP_TASK_INCLUDED_OPTIONS
} from "@/lib/makeup-scope";
import {
  IRONING_SCOPE_SERVICE_OPTIONS,
  IRONING_TASK_EXCLUDED_OPTIONS,
  IRONING_TASK_INCLUDED_OPTIONS
} from "@/lib/ironing-scope";
import { isActiveMvpCommune, normalizeCommune } from "@/lib/communes";

const activeCommuneInputSchema = z
  .string()
  .min(2)
  .refine((value) => isActiveMvpCommune(value), "Comuna fuera de cobertura MVP")
  .transform((value) => normalizeCommune(value) ?? value);

const cleaningScopeServiceEnum = z.enum(CLEANING_SCOPE_SERVICE_OPTIONS.map((option) => option.value) as [string, ...string[]]);
const cleaningIncludedTaskEnum = z.enum(CLEANING_TASK_INCLUDED_OPTIONS.map((option) => option.value) as [string, ...string[]]);
const cleaningExcludedTaskEnum = z.enum(CLEANING_TASK_EXCLUDED_OPTIONS.map((option) => option.value) as [string, ...string[]]);
const babysitterScopeServiceEnum = z.enum(BABYSITTER_SCOPE_SERVICE_OPTIONS.map((option) => option.value) as [string, ...string[]]);
const babysitterAgeRangeEnum = z.enum(BABYSITTER_AGE_RANGE_OPTIONS.map((option) => option.value) as [string, ...string[]]);
const babysitterIncludedTaskEnum = z.enum(BABYSITTER_TASK_INCLUDED_OPTIONS.map((option) => option.value) as [string, ...string[]]);
const babysitterExcludedTaskEnum = z.enum(BABYSITTER_TASK_EXCLUDED_OPTIONS.map((option) => option.value) as [string, ...string[]]);
const chefScopeServiceEnum = z.enum(CHEF_SCOPE_SERVICE_OPTIONS.map((option) => option.value) as [string, ...string[]]);
const trainerScopeServiceEnum = z.enum(TRAINER_SCOPE_SERVICE_OPTIONS.map((option) => option.value) as [string, ...string[]]);
const trainerModeEnum = z.enum(TRAINER_MODE_OPTIONS.map((option) => option.value) as [string, ...string[]]);
const trainerIncludedTaskEnum = z.enum(TRAINER_TASK_INCLUDED_OPTIONS.map((option) => option.value) as [string, ...string[]]);
const trainerExcludedTaskEnum = z.enum(TRAINER_TASK_EXCLUDED_OPTIONS.map((option) => option.value) as [string, ...string[]]);
const teacherScopeServiceEnum = z.enum(TEACHER_SCOPE_SERVICE_OPTIONS.map((option) => option.value) as [string, ...string[]]);
const teacherLevelEnum = z.enum(TEACHER_LEVEL_OPTIONS.map((option) => option.value) as [string, ...string[]]);
const teacherModeEnum = z.enum(TEACHER_MODE_OPTIONS.map((option) => option.value) as [string, ...string[]]);
const teacherIncludedTaskEnum = z.enum(TEACHER_TASK_INCLUDED_OPTIONS.map((option) => option.value) as [string, ...string[]]);
const teacherExcludedTaskEnum = z.enum(TEACHER_TASK_EXCLUDED_OPTIONS.map((option) => option.value) as [string, ...string[]]);
const petScopeServiceEnum = z.enum(PET_SCOPE_SERVICE_OPTIONS.map((option) => option.value) as [string, ...string[]]);
const petScopeAnimalEnum = z.enum(PET_SCOPE_ANIMAL_OPTIONS.map((option) => option.value) as [string, ...string[]]);
const petIncludedTaskEnum = z.enum(PET_TASK_INCLUDED_OPTIONS.map((option) => option.value) as [string, ...string[]]);
const petExcludedTaskEnum = z.enum(PET_TASK_EXCLUDED_OPTIONS.map((option) => option.value) as [string, ...string[]]);
const makeupScopeServiceEnum = z.enum(MAKEUP_SCOPE_SERVICE_OPTIONS.map((option) => option.value) as [string, ...string[]]);
const makeupIncludedTaskEnum = z.enum(MAKEUP_TASK_INCLUDED_OPTIONS.map((option) => option.value) as [string, ...string[]]);
const makeupExcludedTaskEnum = z.enum(MAKEUP_TASK_EXCLUDED_OPTIONS.map((option) => option.value) as [string, ...string[]]);
const ironingScopeServiceEnum = z.enum(IRONING_SCOPE_SERVICE_OPTIONS.map((option) => option.value) as [string, ...string[]]);
const ironingIncludedTaskEnum = z.enum(IRONING_TASK_INCLUDED_OPTIONS.map((option) => option.value) as [string, ...string[]]);
const ironingExcludedTaskEnum = z.enum(IRONING_TASK_EXCLUDED_OPTIONS.map((option) => option.value) as [string, ...string[]]);

export const createBookingSchema = z.object({
  customerId: z.string().min(1),
  serviceId: z.string().min(1),
  scheduledAt: z.coerce.date(),
  addressLine1: z.string().min(5),
  comuna: activeCommuneInputSchema,
  region: z.string().min(2),
  notes: z.string().max(500).optional()
});

export const listBookingsQuerySchema = z
  .object({
    customerId: z.string().min(1).optional(),
    proId: z.string().min(1).optional(),
    status: z.nativeEnum(BookingStatus).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20)
  })
  .refine((value) => value.customerId || value.proId, {
    message: "Debes indicar customerId o proId"
  });

export const updateBookingStatusSchema = z.object({
  status: z.nativeEnum(BookingStatus),
  proId: z.string().min(1).optional()
});

export const publicCreateBookingSchema = z.object({
  fullName: z.string().min(3),
  email: z.string().email(),
  phone: z.string().min(7).max(20).optional(),
  serviceId: z.string().min(1),
  scheduledAt: z.coerce.date(),
  addressLine1: z.string().min(5),
  comuna: activeCommuneInputSchema,
  region: z.string().min(2),
  notes: z.string().max(500).optional()
});

export const publicBookingsQuerySchema = z.object({
  email: z.string().email(),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

export const marketplaceListProsQuerySchema = z.object({
  categoryId: z.string().optional(),
  serviceId: z.string().optional(),
  city: z.string().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  verified: z.coerce.boolean().optional(),
  maxHourlyRateClp: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

export const marketplaceCreateBookingSchema = z.object({
  customerId: z.string().min(1),
  serviceId: z.string().min(1),
  proId: z.string().min(1).optional(),
  slotId: z.string().min(1).optional(),
  autoAssign: z.boolean().optional().default(false),
  startsAt: z.coerce.date(),
  hours: z.coerce.number().int().min(1).max(8),
  address: z.object({
    street: z.string().min(5),
    commune: activeCommuneInputSchema,
    city: z.string().min(2),
    postalCode: z.string().min(4).max(10),
    region: z.string().min(2).optional()
  }),
  details: z.string().max(1000).optional(),
  extras: z
    .object({
      materials: z.boolean().optional().default(false),
      urgency: z.boolean().optional().default(false),
      travelFeeClp: z.coerce.number().int().min(0).optional().default(0)
    })
    .optional()
    .default({ materials: false, urgency: false, travelFeeClp: 0 })
});

export const marketplaceBookingStatusUpdateSchema = z.object({
  status: z.nativeEnum(BookingStatus)
});

export const marketplaceReviewCreateSchema = z.object({
  bookingId: z.string().min(1),
  authorId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  punctuality: z.coerce.number().int().min(1).max(5).optional(),
  quality: z.coerce.number().int().min(1).max(5).optional(),
  communication: z.coerce.number().int().min(1).max(5).optional(),
  comment: z.string().trim().min(8, "Escribe un comentario de al menos 8 caracteres.").max(800)
});

export const marketplaceProReviewCreateSchema = z.object({
  bookingId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().min(8, "Escribe un comentario de al menos 8 caracteres.").max(800)
});

export const marketplaceAdminFeeSchema = z.object({
  categoryId: z.string().min(1),
  basePlatformFeePct: z.coerce.number().min(0).max(100),
  minHours: z.coerce.number().int().min(1).max(8),
  slotMinutes: z.coerce.number().int().refine((v) => v === 30 || v === 60, "slotMinutes debe ser 30 o 60")
});

export const marketplaceAvailabilityQuerySchema = z.object({
  serviceId: z.string().optional(),
  proId: z.string().optional(),
  city: z.string().optional(),
  date: z.coerce.date().optional(),
  days: z.coerce.number().int().min(1).max(14).default(7),
  limit: z.coerce.number().int().min(1).max(200).default(100)
});

export const marketplaceSearchProsSchema = z.object({
  city: z.string().min(2),
  commune: activeCommuneInputSchema.optional(),
  postalCode: z.string().min(4).max(10).optional(),
  street: z.string().min(3).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  categoryId: z.string().min(1).optional(),
  serviceId: z.string().min(1).optional(),
  classSubject: z.string().min(1).max(120).optional(),
  classMusicType: z.string().min(1).max(120).optional(),
  classMode: z.enum(["presencial", "online", "flexible"]).optional(),
  classLevel: z.string().min(1).max(120).optional(),
  classFrequency: z.string().min(1).max(120).optional(),
  classNotes: z.string().max(1000).optional(),
  tasks: z.preprocess(
    (value) => {
      if (typeof value !== "string") return [];
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    },
    z.array(z.string().min(1)).optional().default([])
  ),
  date: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

export const marketplaceProProfileUpdateSchema = z.object({
  proId: z.string().min(1).optional(),
  avatarUrl: z
    .string()
    .startsWith("data:")
    .max(8_000_000, "Archivo demasiado grande para el MVP")
    .refine((value) => /^data:image\/(png|jpe?g);base64,/i.test(value), {
      message: "Debe ser una imagen JPG o PNG"
    })
    .optional()
    .nullable(),
  avatarPositionX: z.coerce.number().min(0).max(100).optional().nullable(),
  avatarPositionY: z.coerce.number().min(0).max(100).optional().nullable(),
  bio: z.string().max(600).optional().nullable(),
  profilePhotoUrl: z
    .string()
    .startsWith("data:")
    .max(8_000_000, "Archivo demasiado grande para el MVP")
    .refine((value) => /^data:image\/(png|jpe?g);base64,/i.test(value), {
      message: "Debe ser una imagen JPG o PNG"
    })
    .optional()
    .nullable(),
  coverageStreet: z.string().min(3).max(180).optional().nullable(),
  coverageComuna: activeCommuneInputSchema.optional().nullable(),
  serviceCommunes: z.array(activeCommuneInputSchema).min(1).optional().nullable(),
  coverageCity: z.string().min(2).max(120).optional().nullable(),
  coveragePostal: z.string().min(4).max(12).optional().nullable(),
  coverageLatitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  coverageLongitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  serviceRadiusKm: z.coerce.number().int().min(2).max(60).optional(),
  hourlyRateFromClp: z.coerce.number().int().min(5000).max(200000).optional().nullable()
});

export const taskerAdditionalCategorySchema = z.object({
  categorySlug: z.string().min(2).max(120),
  hourlyRateClp: z.coerce.number().int().min(5000).max(200000),
  minBookingHours: z.coerce.number().int().min(1).max(12).optional(),
  serviceCommunes: z.array(activeCommuneInputSchema).min(1),
  scopeData: z.any(),
  bio: z.string().max(600).optional().nullable(),
  coverageStreet: z.string().min(3).max(180).optional().nullable(),
  coverageComuna: activeCommuneInputSchema.optional().nullable(),
  coverageCity: z.string().min(2).max(120).optional().nullable(),
  coveragePostal: z.string().min(4).max(12).optional().nullable(),
  coverageLatitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  coverageLongitude: z.coerce.number().min(-180).max(180).optional().nullable()
});

export const marketplaceProSlotCreateSchema = z.object({
  proId: z.string().min(1).optional(),
  serviceId: z.string().min(1).optional().nullable(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date()
});

export const marketplaceProSlotUpdateSchema = z.object({
  isAvailable: z.boolean()
});

export const serviceLeadCreateSchema = z.object({
  fullName: z.string().min(3).max(120),
  phone: z.string().min(7).max(30),
  comuna: z.string().min(2).max(120),
  serviceNeeded: z.string().min(2).max(120),
  problemDescription: z.string().min(10).max(1000),
  source: z.string().max(100).optional()
});

const dataUrlSchema = z
  .string()
  .startsWith("data:")
  .max(8_000_000, "Archivo demasiado grande para el MVP");

const imageDataUrlSchema = dataUrlSchema.refine((value) => /^data:image\/(png|jpe?g);base64,/i.test(value), {
  message: "Debe ser una imagen JPG o PNG"
});

const pdfOrImageDataUrlSchema = dataUrlSchema.refine(
  (value) => /^data:(application\/pdf|image\/(png|jpe?g));base64,/i.test(value),
  {
    message: "Debe ser PDF o imagen"
  }
);

function isValidChileanRut(value: string) {
  const clean = value.replace(/\./g, "").replace(/-/g, "").toUpperCase();
  if (!/^\d{7,8}[0-9K]$/.test(clean)) return false;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  let sum = 0;
  let multiplier = 2;

  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  const expected = remainder === 11 ? "0" : remainder === 10 ? "K" : String(remainder);
  return dv === expected;
}

const chileanRutSchema = z
  .string()
  .trim()
  .min(8)
  .max(16)
  .refine((value) => isValidChileanRut(value), "RUT chileno inválido");

const chileanMobilePhoneSchema = z
  .string()
  .trim()
  .regex(/^\+569\d{8}$/, "Ingresa un teléfono chileno válido con formato +569XXXXXXXX");

export const technicianRegistrationSchema = z.object({
  fullName: z.string().min(3).max(120),
  rut: z.string().min(8).max(16),
  birthDate: z.coerce.date(),
  phone: z.string().min(7).max(30),
  email: z.string().email(),
  commune: activeCommuneInputSchema,
  address: z.string().min(5).max(180),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),

  specialties: z.array(z.string().min(2)).min(1),
  yearsExperience: z.coerce.number().int().min(0).max(60),
  description: z.string().min(20).max(1500),
  certificationsText: z.string().max(1200).optional(),
  certificationFiles: z.array(pdfOrImageDataUrlSchema).max(8).optional().default([]),

  portfolioImages: z.array(imageDataUrlSchema).min(3).max(6),

  criminalRecordFile: pdfOrImageDataUrlSchema,
  identityDocument: imageDataUrlSchema,
  identitySelfie: imageDataUrlSchema,
  affidavitAccepted: z.boolean().refine((v) => v, { message: "Debes aceptar la declaración jurada" }),

  availableCommunes: z.array(activeCommuneInputSchema).min(1),
  coverageRadiusKm: z.coerce.number().int().min(1).max(80),
  availabilitySchedule: z.string().min(3).max(600),
  transportType: z.enum(["auto", "moto", "bicicleta", "transporte_publico"]),
  references: z.string().max(800).optional(),
  source: z.string().max(120).optional()
});

export const adminTechnicianReviewSchema = z.object({
  technicianId: z.string().min(1),
  action: z.enum(["approve", "reject", "request_info"]),
  reviewNotes: z.string().max(1000).optional()
});

const hhmmSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato horario inválido (HH:mm)");

const cleaningAvailabilityBlockSchema = z
  .object({
    day: z.enum(CLEANING_WEEK_DAYS),
    start: hhmmSchema,
    end: hhmmSchema
  })
  .refine((value) => value.end > value.start, {
    message: "El bloque horario debe tener hora de término mayor que inicio"
  });

export const cleaningOnboardingStartSchema = z.object({
  fullName: z.string().min(3).max(120),
  phone: chileanMobilePhoneSchema,
  email: z.string().email(),
  password: z.string().min(8).max(120).optional(),
  authProvider: z.enum(["EMAIL", "GOOGLE", "APPLE"]).default("EMAIL"),
  categorySlug: z.string().min(2).max(120).optional(),
  baseCommune: activeCommuneInputSchema,
  acceptTerms: z.boolean().optional().default(false),
  profilePhotoUrl: imageDataUrlSchema.optional(),
  profilePhotoPositionX: z.coerce.number().min(0).max(100).optional(),
  profilePhotoPositionY: z.coerce.number().min(0).max(100).optional(),
  documentId: chileanRutSchema.optional(),
  referenceAddress: z.string().min(5).max(240).optional()
});

export const cleaningOnboardingStage2Schema = z.object({
  profilePhotoUrl: imageDataUrlSchema,
  shortDescription: z.string().min(20).max(700),
  yearsExperience: z.coerce.number().int().min(0).max(60),
  workMode: z.enum(["SOLO", "EQUIPO"]),
  experienceTypes: z.array(z.enum(CLEANING_EXPERIENCE_TYPES)).min(1),
  referenceAddress: z.string().min(5).max(240)
});

export const cleaningOnboardingStage3Schema = z.object({
  offeredServices: z.array(z.enum(CLEANING_SERVICE_TYPES)).min(1),
  acceptsHomesWithPets: z.boolean(),
  acceptsHomesWithChildren: z.boolean(),
  acceptsHomesWithElderly: z.boolean(),
  worksWithClientProducts: z.boolean(),
  bringsOwnProducts: z.boolean(),
  bringsOwnTools: z.boolean(),
  languages: z.array(z.enum(CLEANING_LANGUAGE_OPTIONS)).max(5).optional().default([])
});

export const cleaningOnboardingStage4Schema = z.object({
  baseCommune: activeCommuneInputSchema,
  referenceAddress: z.string().min(5).max(240),
  serviceCommunes: z.array(activeCommuneInputSchema).min(1),
  coverageLatitude: z.coerce.number().min(-90).max(90),
  coverageLongitude: z.coerce.number().min(-180).max(180),
  maxTravelKm: z.coerce.number().int().min(1).max(80),
  chargesTravelExtra: z.boolean()
});

export const cleaningOnboardingStage5Schema = z.object({
  availabilityMode: z.enum(["FIJA", "VARIABLE"]),
  availabilityBlocks: z.array(cleaningAvailabilityBlockSchema).min(1).max(42),
  maxServicesPerDay: z.coerce.number().int().min(1).max(12),
  acceptsUrgentBookings: z.boolean()
});

export const cleaningOnboardingStage6Schema = z.object({
  hourlyRateClp: z.coerce.number().int().min(5000).max(200000),
  minBookingHours: z.coerce.number().int().min(1).max(12),
  weekendSurchargePct: z.coerce.number().int().min(0).max(100),
  holidaySurchargePct: z.coerce.number().int().min(0).max(100),
  remoteCommuneSurchargeClp: z.coerce.number().int().min(0).max(50000),
  hasDeepCleaningRate: z.boolean().optional().default(false),
  deepCleaningHourlyRateClp: z.coerce.number().int().min(5000).max(250000).optional().nullable()
});

export const cleaningOnboardingStage7Schema = z.object({
  documentId: z.string().trim().min(6).max(24),
  birthDate: z.coerce.date().max(new Date(), "Fecha de nacimiento inválida"),
  nationality: z.string().min(2).max(80),
  migrationStatus: z.string().max(120).optional().nullable(),
  emergencyContactName: z.string().min(3).max(120),
  emergencyContactPhone: z.string().min(7).max(30),
  workReferences: z.string().min(8).max(1400),
  identityDocumentFile: imageDataUrlSchema.optional(),
  identityDocumentFrontFile: imageDataUrlSchema,
  identityDocumentBackFile: imageDataUrlSchema,
  identitySelfieFile: imageDataUrlSchema,
  criminalRecordFile: pdfOrImageDataUrlSchema,
  bankAccountHolder: z.string().min(3).max(120),
  bankAccountHolderRut: z.string().trim().min(6).max(24),
  bankName: z.string().min(2).max(120),
  bankAccountType: z.enum(["cuenta_corriente", "cuenta_vista", "cuenta_rut", "cuenta_ahorro"]),
  bankAccountNumber: z.string().min(4).max(40),
  billingType: z.enum(["boleta_honorarios", "persona_natural"])
});

export const cleaningOnboardingStage8Schema = z
  .object({
    completedTopics: z.array(z.enum(CLEANING_TRAINING_TOPICS)).min(CLEANING_TRAINING_TOPICS.length),
    acceptsCancellationPolicy: z.boolean().refine((v) => v, { message: "Debes aceptar política de cancelación" }),
    acceptsServiceProtocol: z.boolean().refine((v) => v, { message: "Debes aceptar protocolo de servicio" }),
    acceptsDataProcessing: z.boolean().refine((v) => v, { message: "Debes autorizar tratamiento de datos" }),
    confirmsCleaningScope: z.boolean().refine((v) => v, { message: "Debes confirmar alcance del servicio" })
  })
  .refine((value) => {
    const selected = new Set(value.completedTopics);
    return CLEANING_TRAINING_TOPICS.every((topic) => selected.has(topic));
  }, "Debes completar todos los puntos de la capacitación");

export const cleaningOnboardingSaveSchema = z.object({
  step: z.coerce.number().int().min(3).max(11),
  payload: z.record(z.any())
});

export const taskerOnboardingStep3Schema = z.object({
  fullName: z.string().min(3).max(120),
  email: z.string().email(),
  phone: chileanMobilePhoneSchema,
  documentId: chileanRutSchema,
  referenceAddress: z.string().min(5).max(240),
  baseCommune: activeCommuneInputSchema,
  profilePhotoUrl: imageDataUrlSchema
});

export const taskerOnboardingStep4Schema = z.object({
  baseCommune: activeCommuneInputSchema,
  serviceCommunes: z.array(activeCommuneInputSchema).min(1)
});

export const taskerOnboardingStep5Schema = z.object({
  categorySlug: z.string().min(2).max(120)
});

export const taskerOnboardingStep6Schema = z.object({
  yearsExperience: z.coerce.number().int().min(1).max(11),
  workMode: z.enum(["SOLO", "EQUIPO"])
});

export const taskerOnboardingStep7Schema = z.object({
  offeredServices: z.array(z.string().min(1)).min(1),
  experienceTypes: z.array(z.string().min(1)).optional().default([]),
  cleaningScope: z
    .object({
      services_offered: z.array(cleaningScopeServiceEnum).min(1),
      tasks_included: z.array(cleaningIncludedTaskEnum).min(1),
      tasks_excluded: z.array(cleaningExcludedTaskEnum).optional().default([]),
      special_conditions: z.string().max(600).optional().default("")
    })
    .optional()
    .nullable(),
  petScope: z
    .object({
      services_offered: z.array(petScopeServiceEnum).min(1),
      animals_accepted: z.array(petScopeAnimalEnum).min(1),
      accepts_large_pets: z.boolean().optional().nullable(),
      tasks_included: z.array(petIncludedTaskEnum).min(1),
      tasks_excluded: z.array(petExcludedTaskEnum).optional().default([]),
      special_conditions: z.string().max(600).optional().default("")
    })
    .optional()
    .nullable(),
  makeupScope: z
    .object({
      services_offered: z.array(makeupScopeServiceEnum).min(1),
      includes_kit: z.boolean().optional().nullable(),
      tasks_included: z.array(makeupIncludedTaskEnum).min(1),
      tasks_excluded: z.array(makeupExcludedTaskEnum).optional().default([]),
      special_conditions: z.string().max(600).optional().default("")
    })
    .optional()
    .nullable(),
  ironingScope: z
    .object({
      services_offered: z.array(ironingScopeServiceEnum).min(1),
      delicate_clothes: z.boolean().optional().nullable(),
      tasks_included: z.array(ironingIncludedTaskEnum).optional().default([]),
      tasks_excluded: z.array(ironingExcludedTaskEnum).optional().default([]),
      special_conditions: z.string().max(600).optional().default("")
    })
    .optional()
    .nullable(),
  babysitterScope: z
    .object({
      services_offered: z.array(babysitterScopeServiceEnum).min(1),
      age_ranges: z.array(babysitterAgeRangeEnum).min(1),
      first_aid: z.boolean().optional().nullable(),
      multi_child: z.boolean().optional().nullable(),
      tasks_included: z.array(babysitterIncludedTaskEnum).min(1),
      tasks_excluded: z.array(babysitterExcludedTaskEnum).optional().default([]),
      special_conditions: z.string().max(600).optional().default("")
    })
    .optional()
    .nullable(),
  chefScope: z
    .object({
      services_offered: z.array(chefScopeServiceEnum).min(1),
      tasks_included: z.array(z.never()).optional().default([]),
      tasks_excluded: z.array(z.never()).optional().default([]),
      special_conditions: z.string().max(600).optional().default("")
    })
    .optional()
    .nullable(),
  trainerScope: z
    .object({
      services_offered: z.array(trainerScopeServiceEnum).min(1),
      modes: z.array(trainerModeEnum).min(1),
      brings_equipment: z.boolean().optional().nullable(),
      tasks_included: z.array(trainerIncludedTaskEnum).min(1),
      tasks_excluded: z.array(trainerExcludedTaskEnum).optional().default([]),
      special_conditions: z.string().max(600).optional().default("")
    })
    .optional()
    .nullable(),
  teacherScope: z
    .object({
      services_offered: z.array(teacherScopeServiceEnum).min(1),
      levels: z.array(teacherLevelEnum).min(1),
      modes: z.array(teacherModeEnum).min(1),
      tasks_included: z.array(teacherIncludedTaskEnum).min(1),
      tasks_excluded: z.array(teacherExcludedTaskEnum).optional().default([]),
      special_conditions: z.string().max(600).optional().default("")
    })
    .optional()
    .nullable(),
  acceptsHomesWithPets: z.boolean().optional().nullable(),
  acceptsHomesWithChildren: z.boolean().optional().nullable(),
  acceptsHomesWithElderly: z.boolean().optional().nullable(),
  worksWithClientProducts: z.boolean().optional().nullable(),
  bringsOwnProducts: z.boolean().optional().nullable(),
  bringsOwnTools: z.boolean().optional().nullable()
});

export const taskerOnboardingStep8Schema = z.object({
  availabilityMode: z.enum(["FIJA", "VARIABLE"]).default("FIJA"),
  availabilityBlocks: z.array(cleaningAvailabilityBlockSchema).min(1).max(21)
});

const taskerServiceRateSchema = z.object({
  serviceSlug: z.string().min(1),
  hourlyRateClp: z.coerce.number().int().min(5000).max(200000)
});

export const taskerOnboardingStep9Schema = z.object({
  hourlyRateClp: z.coerce.number().int().min(5000).max(200000),
  serviceRates: z.array(taskerServiceRateSchema).optional().default([]),
  minBookingHours: z.coerce.number().int().min(1).max(12),
  weekendSurchargePct: z.coerce.number().int().min(0).max(100),
  holidaySurchargePct: z.coerce.number().int().min(0).max(100),
  remoteCommuneSurchargeClp: z.coerce.number().int().min(0).max(50000).optional().default(0)
});

export const taskerOnboardingStep10Schema = z.object({
  bankAccountHolder: z.string().min(3).max(120),
  bankAccountHolderRut: chileanRutSchema,
  bankName: z.string().min(2).max(120),
  bankAccountType: z.enum(["cuenta_corriente", "cuenta_vista", "cuenta_rut", "cuenta_ahorro"]),
  bankAccountNumber: z.string().regex(/^\d+$/, "La cuenta debe contener solo números").min(4).max(40),
  identityDocumentFrontFile: imageDataUrlSchema,
  identityDocumentBackFile: imageDataUrlSchema,
  criminalRecordFile: pdfOrImageDataUrlSchema
});

export const taskerOnboardingStep11Schema = z.object({
  acceptTerms: z.boolean().refine((v) => v, { message: "Debes aceptar los términos y condiciones" })
});

export const cleaningOnboardingPhoneSendSchema = z.object({
  phone: chileanMobilePhoneSchema.optional()
});

export const cleaningOnboardingPhoneVerifySchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Código inválido")
});

export const cleaningOnboardingAdminActionSchema = z.object({
  onboardingId: z.string().min(1).optional(),
  action: z.enum(["request_correction", "approve", "activate", "set_pending", "delete_record", "clear_all"]),
  notes: z.string().max(1200).optional()
});
