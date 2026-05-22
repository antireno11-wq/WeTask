"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AuthHeroNav } from "@/components/auth-hero-nav";
import {
  CHEF_SERVICE_DEFINITIONS,
  type ChefServiceDefinition,
  type ChefServiceSlug,
  getChefServiceDefinition,
  isChefServiceRateWithinRange,
  isChefServiceSlug
} from "@/lib/chef-service-types";
import {
  CHEF_SCOPE_SERVICE_OPTIONS,
  emptyChefScope,
  getChefScopeServiceLabel,
  normalizeChefScope,
  type ChefScopeData
} from "@/lib/chef-scope";
import {
  ACTIVE_CLEANING_SERVICE_SLUGS,
  CLEANING_SERVICE_DEFINITIONS,
  type CleaningServiceDefinition,
  type CleaningServiceSlug,
  isActiveCleaningServiceSlug,
  isCleaningServiceSlug
} from "@/lib/cleaning-service-types";
import {
  CLEANING_SCOPE_SERVICE_OPTIONS,
  CLEANING_TASK_EXCLUDED_OPTIONS,
  CLEANING_TASK_INCLUDED_OPTIONS,
  emptyCleaningScope,
  getCleaningExcludedTaskLabel,
  getCleaningIncludedTaskLabel,
  getCleaningScopeServiceLabel,
  normalizeCleaningScope,
  type CleaningScopeData,
  type CleaningScopeServiceSlug,
  type CleaningTaskExcludedSlug,
  type CleaningTaskIncludedSlug
} from "@/lib/cleaning-scope";
import {
  BABYSITTER_AGE_RANGE_OPTIONS,
  BABYSITTER_SCOPE_SERVICE_OPTIONS,
  BABYSITTER_TASK_EXCLUDED_OPTIONS,
  BABYSITTER_TASK_INCLUDED_OPTIONS,
  emptyBabysitterScope,
  getBabysitterAgeRangeLabel,
  getBabysitterExcludedTaskLabel,
  getBabysitterIncludedTaskLabel,
  getBabysitterServiceLabel,
  normalizeBabysitterScope,
  type BabysitterAgeRangeSlug,
  type BabysitterScopeData,
  type BabysitterScopeServiceSlug
} from "@/lib/babysitter-scope";
import {
  TRAINER_MODE_OPTIONS,
  TRAINER_SCOPE_SERVICE_OPTIONS,
  TRAINER_TASK_EXCLUDED_OPTIONS,
  TRAINER_TASK_INCLUDED_OPTIONS,
  emptyTrainerScope,
  getTrainerExcludedTaskLabel,
  getTrainerIncludedTaskLabel,
  getTrainerModeLabel,
  getTrainerServiceLabel,
  normalizeTrainerScope,
  type TrainerModeSlug,
  type TrainerScopeData,
  type TrainerScopeServiceSlug
} from "@/lib/trainer-scope";
import {
  TEACHER_LEVEL_OPTIONS,
  TEACHER_MODE_OPTIONS,
  TEACHER_SCOPE_SERVICE_OPTIONS,
  TEACHER_TASK_EXCLUDED_OPTIONS,
  TEACHER_TASK_INCLUDED_OPTIONS,
  emptyTeacherScope,
  getTeacherExcludedTaskLabel,
  getTeacherIncludedTaskLabel,
  getTeacherLevelLabel,
  getTeacherModeLabel,
  getTeacherServiceLabel,
  normalizeTeacherScope,
  type TeacherLevelSlug,
  type TeacherModeSlug,
  type TeacherScopeData,
  type TeacherScopeServiceSlug
} from "@/lib/teacher-scope";
import {
  PET_SCOPE_SERVICE_OPTIONS,
  PET_TASK_EXCLUDED_OPTIONS,
  PET_TASK_INCLUDED_OPTIONS,
  emptyPetScope,
  getPetExcludedTaskLabel,
  getPetIncludedTaskLabel,
  getPetScopeAnimalLabel,
  getPetScopeServiceLabel,
  isPetScopeServiceSlug,
  normalizePetScope,
  type PetScopeData,
  type PetScopeServiceSlug
} from "@/lib/pet-scope";
import {
  MAKEUP_SCOPE_SERVICE_OPTIONS,
  MAKEUP_TASK_EXCLUDED_OPTIONS,
  MAKEUP_TASK_INCLUDED_OPTIONS,
  emptyMakeupScope,
  getMakeupExcludedTaskLabel,
  getMakeupIncludedTaskLabel,
  getMakeupServiceLabel,
  normalizeMakeupScope,
  type MakeupScopeData
} from "@/lib/makeup-scope";
import {
  IRONING_SCOPE_SERVICE_OPTIONS,
  IRONING_TASK_EXCLUDED_OPTIONS,
  IRONING_TASK_INCLUDED_OPTIONS,
  emptyIroningScope,
  getIroningExcludedTaskLabel,
  getIroningIncludedTaskLabel,
  getIroningServiceLabel,
  normalizeIroningScope,
  type IroningScopeData
} from "@/lib/ironing-scope";
import { ACTIVE_MVP_COMMUNES, inferCommuneFromAddress, normalizeCommune, type ActiveMvpCommune } from "@/lib/communes";

type SessionPayload = {
  userId: string;
  fullName?: string | null;
  email?: string | null;
  role: "CUSTOMER" | "PRO" | "ADMIN";
  authProvider?: "EMAIL" | "GOOGLE" | "APPLE";
  emailVerified?: boolean;
  termsAccepted?: boolean;
};

type OnboardingPayload = {
  id: string;
  status: "BORRADOR" | "PENDIENTE_REVISION" | "REQUIERE_CORRECCION" | "APROBADO" | "ACTIVO";
  currentStep: number;
  categorySlug: string;
  baseCommune: string | null;
  referenceAddress: string | null;
  documentId: string | null;
  profilePhotoUrl: string | null;
  yearsExperience: number | null;
  workMode: "SOLO" | "EQUIPO" | null;
  offeredServices: unknown;
  experienceTypes: unknown;
  cleaningScope: unknown;
  petScope: unknown;
  makeupScope: unknown;
  ironingScope: unknown;
  babysitterScope: unknown;
  chefScope: unknown;
  trainerScope: unknown;
  teacherScope: unknown;
  acceptsHomesWithPets: boolean | null;
  acceptsHomesWithChildren: boolean | null;
  acceptsHomesWithElderly: boolean | null;
  worksWithClientProducts: boolean | null;
  bringsOwnProducts: boolean | null;
  bringsOwnTools: boolean | null;
  serviceCommunes: unknown;
  availabilityMode: "FIJA" | "VARIABLE" | null;
  availabilityBlocks: unknown;
  hourlyRateClp: number | null;
  minBookingHours: number | null;
  weekendSurchargePct: number | null;
  holidaySurchargePct: number | null;
  remoteCommuneSurchargeClp: number | null;
  identityDocumentFrontFile: string | null;
  identityDocumentBackFile: string | null;
  criminalRecordFile: string | null;
  bankAccountHolder: string | null;
  bankAccountHolderRut: string | null;
  bankName: string | null;
  bankAccountType: string | null;
  bankAccountNumber: string | null;
  phoneValidatedAt: string | null;
  acceptsCancellationPolicy: boolean | null;
  acceptsServiceProtocol: boolean | null;
  acceptsDataProcessing: boolean | null;
  confirmsCleaningScope: boolean | null;
  submittedAt: string | null;
  adminReviewNotes: string | null;
};

type OnboardingServiceRate = {
  serviceSlug: string;
  hourlyRateClp: number;
};

type AddressValidationResponse = {
  valid?: boolean;
  skipped?: boolean;
  normalizedAddress?: string;
  commune?: string | null;
  isActiveCommune?: boolean;
  location?: { lat?: number | null; lng?: number | null };
  error?: string;
  detail?: string;
};

type AvailabilityBlock = {
  day: DayKey;
  start: string;
  end: string;
};

type CategorySlug =
  | "limpieza"
  | "mascotas"
  | "babysitter"
  | "profesor-particular"
  | "personal-trainer"
  | "chef"
  | "maquillaje"
  | "planchado";

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

type DayKey = "lunes" | "martes" | "miercoles" | "jueves" | "viernes" | "sabado" | "domingo";

type DraftState = {
  phone: string;
  smsCode: string;
  phoneVerified: boolean;
  firstName: string;
  lastName: string;
  email: string;
  rut: string;
  address: string;
  homeCommune: ActiveMvpCommune;
  profilePhotoUrl: string;
  coverageCommunes: ActiveMvpCommune[];
  category: CategorySlug;
  yearsExperience: string;
  workMode: "SOLO" | "EQUIPO";
  cleaningServices: CleaningServiceSlug[];
  cleaningServiceRates: Partial<Record<CleaningServiceSlug, string>>;
  cleaningScope: CleaningScopeData;
  chefServiceType: ChefServiceSlug[];
  chefServiceRates: Partial<Record<ChefServiceSlug, string>>;
  chefScope: ChefScopeData;
  cleaningBringsProducts: boolean | null;
  cleaningBringsEquipment: boolean | null;
  petServiceType: PetScopeServiceSlug[];
  petAnimals: Array<"perros" | "gatos">;
  petLargePets: boolean | null;
  petScope: PetScopeData;
  makeupScope: MakeupScopeData;
  ironingScope: IroningScopeData;
  babysitterAgeRange: "0_2" | "3_6" | "7_plus";
  babysitterFirstAid: boolean | null;
  babysitterMultiChild: boolean | null;
  babysitterScope: BabysitterScopeData;
  teacherSubject: TeacherScopeServiceSlug;
  teacherLevel: TeacherLevelSlug;
  teacherMode: "presencial" | "online" | "ambas";
  teacherScope: TeacherScopeData;
  trainerServiceType: "funcional" | "fuerza" | "perdida_peso" | "movilidad";
  trainerMode: "presencial" | "online" | "ambas";
  trainerBringsEquipment: boolean | null;
  trainerScope: TrainerScopeData;
  makeupType: MakeupScopeData["services_offered"];
  makeupKit: boolean | null;
  ironingType: "casa_cliente" | "retiro_entrega";
  ironingDelicate: boolean | null;
  ironingPricing: "por_hora" | "por_prenda";
  availabilityMode: "FIJA" | "VARIABLE";
  availabilityBlocks: AvailabilityBlock[];
  hourlyRate: string;
  minimumHours: string;
  hasWeekendSurcharge: boolean;
  weekendSurchargePct: string;
  hasHolidaySurcharge: boolean;
  holidaySurchargePct: string;
  bankName: string;
  bankAccountType: "cuenta_corriente" | "cuenta_vista" | "cuenta_rut" | "cuenta_ahorro";
  bankAccountNumber: string;
  bankOwnerRut: string;
  identityDocumentFrontFile: string;
  identityDocumentBackFile: string;
  criminalRecordFile: string;
  acceptedTerms: boolean;
};

type CleaningScopeScreen = 1 | 2 | 3 | 4 | 5;
type PetScopeScreen = 1 | 2 | 3 | 4 | 5 | 6;
type MakeupScopeScreen = 1 | 2 | 3 | 4 | 5;
type IroningScopeScreen = 1 | 2 | 3 | 4 | 5;
type BabysitterScopeScreen = 1 | 2 | 3 | 4 | 5 | 6;
type ChefScopeScreen = 1;
type TeacherScopeScreen = 1 | 2 | 3 | 4 | 5 | 6;
type TrainerScopeScreen = 1 | 2 | 3 | 4 | 5 | 6;
type MissingFieldItem = {
  field: string;
  label: string;
  step: WizardStep;
};

const TOTAL_STEPS = 12;
const STORAGE_KEY = "wetask_tasker_wizard_v2";
const CHILE_MOBILE_PREFIX = "+569";
const COMMUNE_OPTIONS: ActiveMvpCommune[] = [
  "Vitacura",
  "Lo Barnechea",
  "Chicureo",
  "Las Condes",
  "Providencia",
  "La Reina",
  "Ñuñoa"
];
const CATEGORY_OPTIONS: Array<{ slug: CategorySlug; label: string; icon: string; description: string }> = [
  { slug: "limpieza", label: "Limpieza", icon: "🧹", description: "Limpieza hogar, profunda y post mudanza." },
  { slug: "mascotas", label: "Cuidado de mascotas", icon: "🐾", description: "Paseos y cuidado diario para perros y gatos." },
  { slug: "babysitter", label: "Babysitter", icon: "👶", description: "Cuidado infantil responsable en casa del cliente." },
  { slug: "profesor-particular", label: "Profesor particular", icon: "📚", description: "Clases personalizadas presenciales u online." },
  { slug: "personal-trainer", label: "Personal trainer", icon: "🏋️", description: "Entrenamiento personalizado según objetivo y modalidad." },
  { slug: "chef", label: "Chef", icon: "👨‍🍳", description: "Cocina gourmet, casera, repostería, eventos y cumpleaños." },
  { slug: "maquillaje", label: "Maquillaje", icon: "💄", description: "Servicios sociales, eventos y novias." },
  { slug: "planchado", label: "Planchado", icon: "👕", description: "Planchado en casa o con retiro y entrega." }
];
const BANK_OPTIONS = [
  "Banco de Chile",
  "BancoEstado",
  "Santander",
  "BCI",
  "Scotiabank",
  "Itaú",
  "Banco Security",
  "Banco Consorcio",
  "Banco Falabella",
  "Banco Ripley",
  "Banco Internacional"
] as const;
const DAY_OPTIONS: Array<{ key: DayKey; label: string }> = [
  { key: "lunes", label: "Lunes" },
  { key: "martes", label: "Martes" },
  { key: "miercoles", label: "Miércoles" },
  { key: "jueves", label: "Jueves" },
  { key: "viernes", label: "Viernes" },
  { key: "sabado", label: "Sábado" },
  { key: "domingo", label: "Domingo" }
];
const AVAILABILITY_TIME_OPTIONS = Array.from({ length: 31 }, (_, index) => {
  const hour = 7 + Math.floor(index / 2);
  const minutes = index % 2 === 0 ? "00" : "30";
  return `${String(hour).padStart(2, "0")}:${minutes}`;
});
const ONBOARDING_STEP_ITEMS: Array<{ step: WizardStep; label: string }> = [
  { step: 1, label: "Inicio" },
  { step: 2, label: "Teléfono" },
  { step: 3, label: "Perfil" },
  { step: 4, label: "Cobertura" },
  { step: 5, label: "Categoría" },
  { step: 6, label: "Experiencia" },
  { step: 7, label: "Servicio" },
  { step: 8, label: "Disponibilidad" },
  { step: 9, label: "Tarifas" },
  { step: 10, label: "Banco" },
  { step: 11, label: "Términos" }
];
const SUBMIT_REQUIRED_FIELDS: Record<string, { label: string; step: WizardStep }> = {
  categorySlug: { label: "Categoría de servicio", step: 5 },
  phoneValidatedAt: { label: "Teléfono verificado", step: 2 },
  profilePhotoUrl: { label: "Foto de perfil", step: 3 },
  baseCommune: { label: "Comuna donde vive", step: 3 },
  referenceAddress: { label: "Dirección validada", step: 3 },
  documentId: { label: "RUT", step: 3 },
  yearsExperience: { label: "Años de experiencia", step: 6 },
  workMode: { label: "Cómo trabajas", step: 6 },
  offeredServices: { label: "Preguntas específicas de tu categoría", step: 7 },
  cleaningScope: { label: "Alcance del servicio de limpieza", step: 7 },
  petScope: { label: "Alcance del servicio de mascotas", step: 7 },
  makeupScope: { label: "Alcance del servicio de maquillaje", step: 7 },
  ironingScope: { label: "Alcance del servicio de planchado", step: 7 },
  babysitterScope: { label: "Alcance del servicio de babysitter", step: 7 },
  chefScope: { label: "Alcance del servicio de chef", step: 7 },
  teacherScope: { label: "Alcance del servicio de profesor particular", step: 7 },
  trainerScope: { label: "Alcance del servicio de personal trainer", step: 7 },
  serviceCommunes: { label: "Comunas de cobertura", step: 4 },
  coverageLatitude: { label: "Ubicación validada desde la dirección", step: 3 },
  coverageLongitude: { label: "Ubicación validada desde la dirección", step: 3 },
  availabilityBlocks: { label: "Disponibilidad semanal", step: 8 },
  hourlyRateClp: { label: "Tarifa por hora", step: 9 },
  minBookingHours: { label: "Mínimo de horas por servicio", step: 9 },
  weekendSurchargePct: { label: "Recargo fin de semana configurado", step: 9 },
  holidaySurchargePct: { label: "Recargo festivos configurado", step: 9 },
  identityDocumentFrontFile: { label: "Foto frontal del carnet", step: 10 },
  identityDocumentBackFile: { label: "Foto trasera del carnet", step: 10 },
  criminalRecordFile: { label: "Certificado de antecedentes", step: 10 },
  bankAccountHolder: { label: "Nombre del titular de la cuenta", step: 10 },
  bankAccountHolderRut: { label: "RUT del titular de la cuenta", step: 10 },
  bankName: { label: "Banco", step: 10 },
  bankAccountType: { label: "Tipo de cuenta", step: 10 },
  bankAccountNumber: { label: "Número de cuenta", step: 10 },
  acceptsCancellationPolicy: { label: "Aceptación de términos y condiciones", step: 11 },
  acceptsServiceProtocol: { label: "Aceptación de términos y condiciones", step: 11 },
  acceptsDataProcessing: { label: "Aceptación de términos y condiciones", step: 11 },
  confirmsCleaningScope: { label: "Aceptación de términos y condiciones", step: 11 }
};

function currentWeekDayKey(): DayKey {
  const jsDay = new Date().getDay();
  const map: DayKey[] = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  return map[jsDay] ?? "lunes";
}

function normalizeChileanMobileInput(rawValue: string) {
  const digits = rawValue.replace(/\D/g, "");
  let localDigits = digits;

  if (localDigits.startsWith("56")) {
    localDigits = localDigits.slice(2);
  }
  if (localDigits.startsWith("9")) {
    localDigits = localDigits.slice(1);
  }

  return `${CHILE_MOBILE_PREFIX}${localDigits.slice(0, 8)}`;
}

function isValidChileanMobilePhone(value: string) {
  return /^\+569\d{8}$/.test(normalizeChileanMobileInput(value));
}

function formatRutInput(rawRut: string) {
  const clean = rawRut.replace(/[^0-9kK]/g, "").toUpperCase().slice(0, 9);
  if (!clean) return "";
  if (clean.length === 1) return clean;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formattedBody}-${dv}`;
}

function extractRutBody(rawRut: string) {
  const clean = rawRut.replace(/[^0-9kK]/g, "").toUpperCase();
  return clean.length > 1 ? clean.slice(0, -1) : "";
}

function formatClp(value: number) {
  return new Intl.NumberFormat("es-CL").format(value);
}

function getPricingGuide(draft: DraftState) {
  const baseByCategory: Record<CategorySlug, { min: number; max: number; note: string }> = {
    limpieza: { min: 12000, max: 16000, note: "Referencia habitual para limpieza estándar en comunas del MVP." },
    mascotas: { min: 10000, max: 14000, note: "Útil para paseos, visitas y cuidado básico por hora." },
    babysitter: { min: 12000, max: 18000, note: "Suele variar según experiencia, cantidad de niños y horario." },
    "profesor-particular": { min: 15000, max: 25000, note: "Las clases especializadas y universitarias suelen cobrar más." },
    "personal-trainer": { min: 18000, max: 30000, note: "Depende del tipo de entrenamiento, modalidad e implementos." },
    chef: { min: 18000, max: 42000, note: "Varía según el tipo de cocina, la cantidad de personas y la complejidad del servicio." },
    maquillaje: { min: 18000, max: 30000, note: "Novias y eventos suelen estar en el tramo alto." },
    planchado: { min: 10000, max: 14000, note: "Se recomienda cobrar por hora según volumen y delicadeza." }
  };

  const base = baseByCategory[draft.category];
  let min = base.min;
  let max = base.max;
  const extras: string[] = [];

  if (draft.category === "limpieza") {
    min = Math.min(...CLEANING_SERVICE_DEFINITIONS.map((service) => service.recommendedMinClp));
    max = Math.max(...CLEANING_SERVICE_DEFINITIONS.map((service) => service.recommendedMaxClp));
    extras.push("En limpieza puedes definir una tarifa distinta por hora para cada tipo de servicio que ofrezcas.");
    if (draft.cleaningBringsProducts) extras.push("Si incluyes productos, normalmente puedes cobrar un poco más en todos tus tipos de limpieza.");
    if (draft.cleaningBringsEquipment) extras.push("Si llevas aspiradora o equipo propio, también puedes posicionarte en el tramo alto.");
  }

  if (draft.category === "maquillaje" && draft.makeupKit) {
    min += 3000;
    max += 5000;
    extras.push("Si incluyes tu kit de maquillaje, conviene cobrar un extra por hora.");
  }

  if (draft.category === "personal-trainer" && draft.trainerBringsEquipment) {
    min += 3000;
    max += 5000;
    extras.push("Si llevas implementos o equipamiento, puedes posicionarte en la parte alta del rango.");
  }

  if (draft.category === "chef") {
    const chefDefinitions = selectedChefServiceDefinitions(draft);
    if (chefDefinitions.length > 0) {
      min = Math.min(...chefDefinitions.map((service) => service.recommendedMinClp));
      max = Math.max(...chefDefinitions.map((service) => service.recommendedMaxClp));
      extras.push("En Chef a domicilio defines un precio por servicio dentro del rango permitido por WeTask.");
    }
  }

  return {
    title: CATEGORY_OPTIONS.find((option) => option.slug === draft.category)?.label ?? "Servicio",
    min,
    max,
    note: base.note,
    extras
  };
}

function normalizeCleaningServiceSlugs(value: unknown): CleaningServiceSlug[] {
  if (Array.isArray(value)) {
    const items = value.filter(
      (item): item is CleaningServiceSlug =>
        typeof item === "string" && isCleaningServiceSlug(item) && isActiveCleaningServiceSlug(item)
    );
    return items.length > 0 ? Array.from(new Set(items)) : [...ACTIVE_CLEANING_SERVICE_SLUGS];
  }
  if (typeof value === "string" && isCleaningServiceSlug(value) && isActiveCleaningServiceSlug(value)) {
    return [value];
  }
  return [...ACTIVE_CLEANING_SERVICE_SLUGS];
}

function selectedCleaningServiceDefinitions(draft: DraftState): CleaningServiceDefinition[] {
  return CLEANING_SERVICE_DEFINITIONS.filter((service) => draft.cleaningServices.includes(service.slug));
}

function deriveCleaningServicesFromScope(scope: CleaningScopeData): CleaningServiceSlug[] {
  const derived = scope.services_offered.filter(isCleaningServiceSlug);
  return derived.length > 0 ? Array.from(new Set(derived)) : [...ACTIVE_CLEANING_SERVICE_SLUGS];
}

function selectedChefServiceDefinitions(draft: DraftState): ChefServiceDefinition[] {
  return CHEF_SERVICE_DEFINITIONS.filter((service) => draft.chefServiceType.includes(service.slug));
}

function normalizeMakeupTypes(value: unknown): MakeupScopeData["services_offered"] {
  const legacyMap: Record<string, MakeupScopeData["services_offered"][number]> = {
    social: "social_evento",
    eventos: "fiesta",
    novias: "novia",
    natural: "natural",
    social_evento: "social_evento",
    noche: "noche",
    fiesta: "fiesta",
    novia: "novia",
    produccion_fotos: "produccion_fotos",
    otro: "otro"
  };

  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return Array.from(
    new Set(
      values
        .filter((item): item is string => typeof item === "string")
        .map((item) => legacyMap[item])
        .filter((item): item is MakeupScopeData["services_offered"][number] => Boolean(item))
    )
  );
}

function normalizeChefServiceTypes(value: unknown): ChefServiceSlug[] {
  if (Array.isArray(value)) {
    const items = value.filter((item): item is ChefServiceSlug => typeof item === "string" && isChefServiceSlug(item));
    return items.length > 0 ? Array.from(new Set(items)) : [];
  }
  if (typeof value === "string" && isChefServiceSlug(value)) {
    return [value];
  }
  return [];
}

function normalizePetServiceTypes(value: unknown): PetScopeServiceSlug[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is PetScopeServiceSlug => typeof item === "string" && isPetScopeServiceSlug(item));
  }
  if (typeof value === "string" && isPetScopeServiceSlug(value)) {
    return [value];
  }
  return [];
}

function createInitialDraft(): DraftState {
  return {
    phone: CHILE_MOBILE_PREFIX,
    smsCode: "",
    phoneVerified: false,
    firstName: "",
    lastName: "",
    email: "",
    rut: "",
    address: "",
    homeCommune: "Las Condes",
    profilePhotoUrl: "",
    coverageCommunes: ["Las Condes"],
    category: "limpieza",
    yearsExperience: "1",
    workMode: "SOLO",
    cleaningServices: [...ACTIVE_CLEANING_SERVICE_SLUGS],
    cleaningServiceRates: {},
    cleaningScope: {
      ...emptyCleaningScope(),
      services_offered: [...ACTIVE_CLEANING_SERVICE_SLUGS]
    },
    chefServiceType: [],
    chefServiceRates: {},
    chefScope: emptyChefScope(),
    cleaningBringsProducts: null,
    cleaningBringsEquipment: null,
    petServiceType: [],
    petAnimals: [],
    petLargePets: null,
    petScope: emptyPetScope(),
    makeupScope: emptyMakeupScope(),
    ironingScope: emptyIroningScope(),
    babysitterAgeRange: "0_2",
    babysitterFirstAid: null,
    babysitterMultiChild: null,
    babysitterScope: emptyBabysitterScope(),
    teacherSubject: "matematicas",
    teacherLevel: "basica",
    teacherMode: "presencial",
    teacherScope: emptyTeacherScope(),
    trainerServiceType: "funcional",
    trainerMode: "presencial",
    trainerBringsEquipment: null,
    trainerScope: emptyTrainerScope(),
    makeupType: [],
    makeupKit: null,
    ironingType: "casa_cliente",
    ironingDelicate: null,
    ironingPricing: "por_hora",
    availabilityMode: "FIJA",
    availabilityBlocks: [{ day: "lunes", start: "09:00", end: "13:00" }],
    hourlyRate: "15000",
    minimumHours: "2",
    hasWeekendSurcharge: false,
    weekendSurchargePct: "20",
    hasHolidaySurcharge: false,
    holidaySurchargePct: "20",
    identityDocumentFrontFile: "",
    identityDocumentBackFile: "",
    criminalRecordFile: "",
    bankName: BANK_OPTIONS[0],
    bankAccountType: "cuenta_corriente",
    bankAccountNumber: "",
    bankOwnerRut: "",
    acceptedTerms: false
  };
}

function createFreshDraft(presetService: CategorySlug | null): DraftState {
  const nextDraft = createInitialDraft();
  if (presetService) {
    nextDraft.category = presetService;
  }
  return nextDraft;
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" ")
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

const UPLOAD_KINDS = [
  "identity_front",
  "identity_back",
  "identity_selfie",
  "criminal_record",
  "profile_photo",
  "chat_image",
  "dispute_evidence"
] as const;
type UploadKind = (typeof UPLOAD_KINDS)[number];

/**
 * Sube un archivo (File o data URL) a object storage vía presigned URL.
 * Devuelve la storage key (e.g. "users/<id>/<kind>/<uuid>.jpg").
 * Si el servidor responde 503 (storage no configurado), retorna null y deja
 * que el caller use el data URL como fallback legacy.
 */
async function uploadAssetViaPresign(input: {
  source: File | { dataUrl: string; contentType: string };
  kind: UploadKind;
}): Promise<string | null> {
  let blob: Blob;
  let contentType: string;
  let sizeBytes: number;

  if (input.source instanceof File) {
    blob = input.source;
    contentType = input.source.type || "application/octet-stream";
    sizeBytes = input.source.size;
  } else {
    const match = input.source.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error("Data URL inválido para subir");
    contentType = match[1] || input.source.contentType;
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    blob = new Blob([bytes], { type: contentType });
    sizeBytes = blob.size;
  }

  const presignResponse = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: input.kind, contentType, sizeBytes })
  });

  if (presignResponse.status === 503) {
    return null; // storage not configured; caller decides fallback
  }

  if (!presignResponse.ok) {
    const detail = await presignResponse.json().catch(() => ({}));
    throw new Error(detail?.error || `No se pudo preparar la carga (${presignResponse.status})`);
  }

  const { uploadUrl, key } = (await presignResponse.json()) as { uploadUrl: string; key: string };

  const putResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob
  });

  if (!putResponse.ok) {
    throw new Error(`El archivo no se pudo subir al almacenamiento (${putResponse.status})`);
  }

  return key;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo procesar la foto"));
    image.src = src;
  });
}

async function createCenteredProfilePhoto(dataUrl: string, focusX: number, focusY: number) {
  if (!dataUrl) return dataUrl;
  const image = await loadImageElement(dataUrl);
  const size = 720;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return dataUrl;

  const scale = Math.max(size / image.width, size / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const normalizedX = Math.min(100, Math.max(0, focusX));
  const normalizedY = Math.min(100, Math.max(0, focusY));
  const offsetX = (size - drawWidth) * (normalizedX / 100);
  const offsetY = (size - drawHeight) * (normalizedY / 100);

  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  return canvas.toDataURL("image/jpeg", 0.92);
}

function normalizeRut(rawRut: string) {
  return rawRut.replace(/\./g, "").replace(/-/g, "").toUpperCase();
}

function isValidRut(rawRut: string) {
  const clean = normalizeRut(rawRut);
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

function toAvailabilityBlocks(value: unknown): AvailabilityBlock[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as { day?: string; start?: string; end?: string };
      if (!candidate.day || !candidate.start || !candidate.end) return null;
      if (!DAY_OPTIONS.some((day) => day.key === candidate.day)) return null;
      return {
        day: candidate.day as DayKey,
        start: candidate.start,
        end: candidate.end
      };
    })
    .filter(Boolean) as AvailabilityBlock[];
}

function buildStep7Payload(draft: DraftState) {
  switch (draft.category) {
    case "limpieza":
      return {
        offeredServices: draft.cleaningServices,
        experienceTypes: draft.cleaningServices,
        cleaningScope: draft.cleaningScope,
        worksWithClientProducts: false,
        bringsOwnProducts: draft.cleaningBringsProducts,
        bringsOwnTools: draft.cleaningBringsEquipment
      };
    case "mascotas":
      return {
        offeredServices: draft.petServiceType,
        experienceTypes: draft.petAnimals,
        petScope: {
          ...draft.petScope,
          services_offered: draft.petServiceType,
          animals_accepted: draft.petAnimals,
          accepts_large_pets: draft.petLargePets
        },
        acceptsHomesWithPets: draft.petLargePets
      };
    case "babysitter":
      return {
        offeredServices: draft.babysitterScope.services_offered,
        experienceTypes: draft.babysitterScope.age_ranges,
        babysitterScope: {
          ...draft.babysitterScope,
          age_ranges: draft.babysitterScope.age_ranges,
          first_aid: draft.babysitterFirstAid,
          multi_child: draft.babysitterMultiChild
        },
        bringsOwnTools: draft.babysitterFirstAid,
        acceptsHomesWithChildren: draft.babysitterMultiChild
      };
    case "profesor-particular":
      return {
        offeredServices: draft.teacherScope.services_offered,
        experienceTypes: [...draft.teacherScope.levels, ...draft.teacherScope.modes],
        teacherScope: {
          ...draft.teacherScope
        }
      };
    case "personal-trainer":
      return {
        offeredServices: draft.trainerScope.services_offered,
        experienceTypes: draft.trainerScope.modes,
        trainerScope: {
          ...draft.trainerScope,
          brings_equipment: draft.trainerBringsEquipment
        },
        bringsOwnTools: draft.trainerBringsEquipment
      };
    case "chef":
      return {
        offeredServices: draft.chefScope.services_offered,
        experienceTypes: draft.chefScope.services_offered,
        chefScope: {
          ...draft.chefScope
        },
        worksWithClientProducts: true
      };
    case "maquillaje":
      return {
        offeredServices: draft.makeupScope.services_offered,
        makeupScope: {
          ...draft.makeupScope,
          includes_kit: draft.makeupKit
        },
        bringsOwnProducts: draft.makeupKit,
        worksWithClientProducts: true
      };
    case "planchado":
      return {
        offeredServices: draft.ironingScope.services_offered,
        experienceTypes: ["por_hora"],
        ironingScope: {
          ...draft.ironingScope,
          delicate_clothes: draft.ironingDelicate
        },
        bringsOwnTools: draft.ironingDelicate
      };
    default:
      return { offeredServices: ["limpieza_general"] };
  }
}

function OnboardingLoadingScreen() {
  return (
    <main className="auth-flow-screen">
      <div className="auth-flow-backdrop" aria-hidden />
      <div className="login-screen-content">
        <AuthHeroNav />
        <section className="auth-flow-shell auth-flow-shell-wide">
          <div className="auth-flow-copy">
            <p className="auth-flow-kicker">Registro tasker</p>
            <h1>Estamos preparando tu registro.</h1>
            <p>En unos segundos podrás completar tu perfil profesional en WeTask.</p>
          </div>
          <section className="auth-flow-panel auth-flow-panel-wide">
            <p className="empty">Cargando registro...</p>
          </section>
        </section>
      </div>
    </main>
  );
}

function CleaningOnboardingPageContent() {
  const searchParams = useSearchParams();
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingPayload | null>(null);
  const [draft, setDraft] = useState<DraftState>(createInitialDraft);
  const [activeStep, setActiveStep] = useState<WizardStep>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitMissingFields, setSubmitMissingFields] = useState<MissingFieldItem[]>([]);
  const [smsPreview, setSmsPreview] = useState("");
  const [cleaningScopeScreen, setCleaningScopeScreen] = useState<CleaningScopeScreen>(1);
  const [petScopeScreen, setPetScopeScreen] = useState<PetScopeScreen>(1);
  const [makeupScopeScreen, setMakeupScopeScreen] = useState<MakeupScopeScreen>(1);
  const [ironingScopeScreen, setIroningScopeScreen] = useState<IroningScopeScreen>(1);
  const [babysitterScopeScreen, setBabysitterScopeScreen] = useState<BabysitterScopeScreen>(1);
  const [chefScopeScreen, setChefScopeScreen] = useState<ChefScopeScreen>(1);
  const [teacherScopeScreen, setTeacherScopeScreen] = useState<TeacherScopeScreen>(1);
  const [trainerScopeScreen, setTrainerScopeScreen] = useState<TrainerScopeScreen>(1);
  const [selectedAvailabilityDay, setSelectedAvailabilityDay] = useState<DayKey>(currentWeekDayKey);
  const [bulkAvailabilityDays, setBulkAvailabilityDays] = useState<DayKey[]>([currentWeekDayKey()]);
  const [newAvailabilityStart, setNewAvailabilityStart] = useState("14:00");
  const [newAvailabilityEnd, setNewAvailabilityEnd] = useState("18:00");
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedFromAutocomplete, setSelectedFromAutocomplete] = useState(false);
  const [validatingAddress, setValidatingAddress] = useState(false);
  const [addressValidationMessage, setAddressValidationMessage] = useState("");
  const [addressValidationError, setAddressValidationError] = useState("");
  const [coverageCommuneSelection, setCoverageCommuneSelection] = useState<ActiveMvpCommune>(COMMUNE_OPTIONS[0]);
  const [photoFocus, setPhotoFocus] = useState({ x: 50, y: 34 });
  const [photoDragging, setPhotoDragging] = useState(false);
  const addressValidationRequestRef = useRef(0);
  const availabilityTaskPanelRef = useRef<HTMLDivElement | null>(null);
  const photoPreviewRef = useRef<HTMLDivElement | null>(null);

  const chicureoSelected = draft.homeCommune === "Chicureo" || draft.coverageCommunes.includes("Chicureo");
  const selectedCategoryLabel = CATEGORY_OPTIONS.find((option) => option.slug === draft.category)?.label ?? "Limpieza";
  const cleaningScopeServicesPreview = draft.cleaningScope.services_offered.map(getCleaningScopeServiceLabel);
  const cleaningScopeIncludedPreview = draft.cleaningScope.tasks_included.map(getCleaningIncludedTaskLabel);
  const cleaningScopeExcludedPreview = draft.cleaningScope.tasks_excluded.map(getCleaningExcludedTaskLabel);
  const petScopeServicesPreview = draft.petServiceType.map(getPetScopeServiceLabel);
  const petScopeAnimalsPreview = draft.petAnimals.map(getPetScopeAnimalLabel);
  const petScopeIncludedPreview = draft.petScope.tasks_included.map(getPetIncludedTaskLabel);
  const petScopeExcludedPreview = draft.petScope.tasks_excluded.map(getPetExcludedTaskLabel);
  const makeupScopeServicesPreview = draft.makeupScope.services_offered.map(getMakeupServiceLabel);
  const makeupScopeIncludedPreview = draft.makeupScope.tasks_included.map(getMakeupIncludedTaskLabel);
  const makeupScopeExcludedPreview = draft.makeupScope.tasks_excluded.map(getMakeupExcludedTaskLabel);
  const ironingScopeServicesPreview = draft.ironingScope.services_offered.map(getIroningServiceLabel);
  const babysitterScopeServicesPreview = draft.babysitterScope.services_offered.map(getBabysitterServiceLabel);
  const babysitterScopeAgePreview = draft.babysitterScope.age_ranges.map(getBabysitterAgeRangeLabel);
  const babysitterScopeIncludedPreview = draft.babysitterScope.tasks_included.map(getBabysitterIncludedTaskLabel);
  const babysitterScopeExcludedPreview = draft.babysitterScope.tasks_excluded.map(getBabysitterExcludedTaskLabel);
  const chefScopeServicesPreview = draft.chefScope.services_offered.map(getChefScopeServiceLabel);
  const teacherScopeServicesPreview = draft.teacherScope.services_offered.map(getTeacherServiceLabel);
  const teacherScopeLevelsPreview = draft.teacherScope.levels.map(getTeacherLevelLabel);
  const teacherScopeModesPreview = draft.teacherScope.modes.map(getTeacherModeLabel);
  const teacherScopeIncludedPreview = draft.teacherScope.tasks_included.map(getTeacherIncludedTaskLabel);
  const teacherScopeExcludedPreview = draft.teacherScope.tasks_excluded.map(getTeacherExcludedTaskLabel);
  const trainerScopeServicesPreview = draft.trainerScope.services_offered.map(getTrainerServiceLabel);
  const trainerScopeModesPreview = draft.trainerScope.modes.map(getTrainerModeLabel);
  const trainerScopeIncludedPreview = draft.trainerScope.tasks_included.map(getTrainerIncludedTaskLabel);
  const trainerScopeExcludedPreview = draft.trainerScope.tasks_excluded.map(getTrainerExcludedTaskLabel);
  const pricingGuide = useMemo(() => getPricingGuide(draft), [draft]);
  const progressPercent = Math.round((activeStep / TOTAL_STEPS) * 100);
  const addressQuery = useMemo(() => [draft.address.trim(), "Santiago", "Chile"].filter(Boolean).join(", "), [draft.address]);
  const petSupportsCats = draft.petServiceType.some((item) => item !== "paseo_perros");
  const petAnimalOptions = (petSupportsCats ? ["perros", "gatos"] : ["perros"]) as Array<"perros" | "gatos">;
  const presetService = useMemo(() => {
    const service = searchParams.get("service");
    return CATEGORY_OPTIONS.some((option) => option.slug === service) ? (service as CategorySlug) : null;
  }, [searchParams]);
  const explicitNewCategoryFlow = useMemo(() => searchParams.get("mode") === "new-category", [searchParams]);
  const isAdditionalCategoryFlow = Boolean(presetService && explicitNewCategoryFlow);

  useEffect(() => {
    if (presetService) return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as Partial<DraftState> & { activeStep?: WizardStep };
      setDraft((current) => ({
        ...current,
        ...parsed,
        phone: normalizeChileanMobileInput(parsed.phone ?? current.phone),
        rut: formatRutInput(parsed.rut ?? current.rut),
        bankOwnerRut: formatRutInput(parsed.bankOwnerRut ?? current.bankOwnerRut),
        cleaningServices: normalizeCleaningServiceSlugs(parsed.cleaningServices),
        cleaningScope: normalizeCleaningScope(parsed.cleaningScope ?? current.cleaningScope),
        cleaningServiceRates:
          parsed.cleaningServiceRates && typeof parsed.cleaningServiceRates === "object"
            ? (parsed.cleaningServiceRates as Partial<Record<CleaningServiceSlug, string>>)
            : current.cleaningServiceRates,
        chefServiceType: normalizeChefServiceTypes(parsed.chefServiceType),
        chefScope: normalizeChefScope(parsed.chefScope ?? current.chefScope),
        chefServiceRates:
          parsed.chefServiceRates && typeof parsed.chefServiceRates === "object"
            ? (parsed.chefServiceRates as Partial<Record<ChefServiceSlug, string>>)
            : current.chefServiceRates,
        petServiceType: normalizePetServiceTypes(parsed.petServiceType),
        petScope: normalizePetScope(parsed.petScope ?? current.petScope),
        makeupScope: normalizeMakeupScope(parsed.makeupScope ?? current.makeupScope),
        ironingScope: normalizeIroningScope(parsed.ironingScope ?? current.ironingScope),
        babysitterScope: normalizeBabysitterScope(parsed.babysitterScope ?? current.babysitterScope),
        teacherScope: normalizeTeacherScope(parsed.teacherScope ?? current.teacherScope),
        trainerScope: normalizeTrainerScope(parsed.trainerScope ?? current.trainerScope),
        makeupType: normalizeMakeupTypes(parsed.makeupType)
      }));
      if (parsed.activeStep && parsed.activeStep >= 1 && parsed.activeStep <= 12) {
        setActiveStep(parsed.activeStep);
      }
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...draft, activeStep }));
  }, [draft, activeStep]);

  useEffect(() => {
    if (selectedFromAutocomplete) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      setAutocompleteLoading(false);
      return;
    }

    if (draft.address.trim().length < 4) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      setAutocompleteLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setAutocompleteLoading(true);
      try {
        const response = await fetch(`/api/maps/autocomplete?input=${encodeURIComponent(addressQuery)}`, {
          signal: controller.signal
        });
        const data = (await response.json()) as { predictions?: string[] };
        if (!response.ok) {
          setAddressSuggestions([]);
          setShowSuggestions(false);
          return;
        }
        const suggestions = Array.isArray(data.predictions) ? data.predictions : [];
        setAddressSuggestions(suggestions);
        setShowSuggestions(suggestions.length > 0);
      } catch {
        if (!controller.signal.aborted) {
          setAddressSuggestions([]);
          setShowSuggestions(false);
        }
      } finally {
        if (!controller.signal.aborted) {
          setAutocompleteLoading(false);
        }
      }
    }, 320);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [addressQuery, draft.address, selectedFromAutocomplete]);

  useEffect(() => {
    if (activeStep !== 3) return;
    if (draft.address.trim().length < 4) {
      setAddressValidationMessage("");
      setAddressValidationError("");
      return;
    }

    const timer = setTimeout(() => {
      void validateHomeAddress({ silent: true });
    }, 650);

    return () => clearTimeout(timer);
  }, [activeStep, addressQuery]);

  useEffect(() => {
    if (!presetService) return;
    setDraft((current) => ({ ...current, category: presetService }));
  }, [presetService]);

  useEffect(() => {
    if (activeStep !== 2) return;
    if (session?.role !== "PRO") return;
    setDraft((current) => (current.phoneVerified ? current : { ...current, phoneVerified: true }));
    setError("");
    setFeedback("");
    setActiveStep(3);
  }, [activeStep, session?.role]);

  useEffect(() => {
    if (presetService && activeStep === 5) {
      setActiveStep(6);
    }
  }, [activeStep, presetService]);

  useEffect(() => {
    if (draft.category === "planchado" && draft.ironingPricing !== "por_hora") {
      setDraft((current) => ({ ...current, ironingPricing: "por_hora" }));
    }
  }, [draft.category, draft.ironingPricing]);

  useEffect(() => {
    if (draft.availabilityMode !== "FIJA") {
      setDraft((current) => ({ ...current, availabilityMode: "FIJA" }));
    }
  }, [draft.availabilityMode]);

  useEffect(() => {
    const nextRut = formatRutInput(draft.rut);
    if (nextRut === draft.bankOwnerRut) return;
    setDraft((current) => ({ ...current, bankOwnerRut: nextRut }));
  }, [draft.bankOwnerRut, draft.rut]);

  useEffect(() => {
    if (draft.bankAccountType !== "cuenta_rut") return;
    const rutBody = extractRutBody(draft.bankOwnerRut);
    setDraft((current) => {
      if (current.bankAccountType !== "cuenta_rut") return current;
      if (current.bankAccountNumber === rutBody) return current;
      return {
        ...current,
        bankAccountNumber: rutBody
      };
    });
  }, [draft.bankAccountType, draft.bankOwnerRut]);

  useEffect(() => {
    const normalizedServices = normalizePetServiceTypes(draft.petServiceType);
    const supportsCats = normalizedServices.some((item) => item !== "paseo_perros");
    const filteredAnimals = draft.petAnimals.filter((animal): animal is "perros" | "gatos" => supportsCats || animal === "perros");
    const nextAnimals: Array<"perros" | "gatos"> = filteredAnimals;
    const servicesChanged = normalizedServices.join("|") !== draft.petServiceType.join("|");
    const animalsChanged = nextAnimals.join("|") !== draft.petAnimals.join("|");
    const petScopeChanged =
      normalizedServices.join("|") !== draft.petScope.services_offered.join("|") ||
      nextAnimals.join("|") !== draft.petScope.animals_accepted.join("|") ||
      draft.petLargePets !== draft.petScope.accepts_large_pets;
    if (!servicesChanged && !animalsChanged && !petScopeChanged) return;
    setDraft((current) => ({
      ...current,
      petServiceType: normalizedServices,
      petAnimals: nextAnimals,
      petScope: {
        ...current.petScope,
        services_offered: normalizedServices,
        animals_accepted: nextAnimals,
        accepts_large_pets: current.petLargePets
      }
    }));
  }, [draft.petAnimals, draft.petLargePets, draft.petScope.animals_accepted, draft.petScope.services_offered, draft.petScope.accepts_large_pets, draft.petServiceType]);

  useEffect(() => {
    if (draft.category !== "maquillaje") return;
    const scope = draft.makeupScope;
    const normalizedServices = normalizeMakeupTypes(scope.services_offered);
    const servicesChanged = normalizedServices.join("|") !== draft.makeupType.join("|");
    const kitChanged = scope.includes_kit !== draft.makeupKit;

    if (!servicesChanged && !kitChanged) return;

    setDraft((current) => ({
      ...current,
      makeupType: normalizeMakeupTypes(current.makeupScope.services_offered),
      makeupKit: current.makeupScope.includes_kit
    }));
  }, [draft.category, draft.makeupKit, draft.makeupScope, draft.makeupType]);

  useEffect(() => {
    if (draft.category !== "planchado") return;
    const scope = draft.ironingScope;
    const nextType = scope.services_offered[0] ?? draft.ironingType;
    const nextDelicate = scope.delicate_clothes;
    const fieldsChanged = nextType !== draft.ironingType || nextDelicate !== draft.ironingDelicate;

    if (!fieldsChanged) return;

    setDraft((current) => ({
      ...current,
      ironingType: current.ironingScope.services_offered[0] ?? current.ironingType,
      ironingDelicate: current.ironingScope.delicate_clothes
    }));
  }, [draft.category, draft.ironingDelicate, draft.ironingScope, draft.ironingType]);

  useEffect(() => {
    if (draft.category !== "babysitter") return;
    const scope = draft.babysitterScope;
    const nextAgeRange = scope.age_ranges[0] ?? draft.babysitterAgeRange;
    const nextFirstAid = scope.first_aid;
    const nextMultiChild = scope.multi_child;
    const fieldsChanged =
      nextAgeRange !== draft.babysitterAgeRange ||
      nextFirstAid !== draft.babysitterFirstAid ||
      nextMultiChild !== draft.babysitterMultiChild;

    if (!fieldsChanged) return;

    setDraft((current) => ({
      ...current,
      babysitterAgeRange: current.babysitterScope.age_ranges[0] ?? current.babysitterAgeRange,
      babysitterFirstAid: current.babysitterScope.first_aid,
      babysitterMultiChild: current.babysitterScope.multi_child
    }));
  }, [draft.babysitterAgeRange, draft.babysitterFirstAid, draft.babysitterMultiChild, draft.babysitterScope, draft.category]);

  useEffect(() => {
    if (draft.category !== "chef") return;
    const scope = draft.chefScope;
    const normalizedServices = normalizeChefServiceTypes(scope.services_offered);
    const nextService = normalizedServices[0] ?? draft.chefServiceType[0] ?? null;
    const servicesChanged =
      normalizedServices.join("|") !== draft.chefServiceType.join("|") ||
      (nextService != null && nextService !== draft.chefServiceType[0]);

    if (!servicesChanged) return;

    setDraft((current) => ({
      ...current,
      chefServiceType: normalizeChefServiceTypes(current.chefScope.services_offered)
    }));
  }, [draft.category, draft.chefScope, draft.chefServiceType]);

  useEffect(() => {
    if (draft.category !== "profesor-particular") return;
    const scope = draft.teacherScope;
    const nextSubject = scope.services_offered[0] ?? draft.teacherSubject;
    const nextLevel = scope.levels[0] ?? draft.teacherLevel;
    const nextMode = scope.modes.length > 1 ? "ambas" : scope.modes[0] ?? draft.teacherMode;
    const fieldsChanged =
      nextSubject !== draft.teacherSubject ||
      nextLevel !== draft.teacherLevel ||
      nextMode !== draft.teacherMode;

    if (!fieldsChanged) return;

    setDraft((current) => ({
      ...current,
      teacherSubject: current.teacherScope.services_offered[0] ?? current.teacherSubject,
      teacherLevel: current.teacherScope.levels[0] ?? current.teacherLevel,
      teacherMode:
        current.teacherScope.modes.length > 1
          ? "ambas"
          : current.teacherScope.modes[0] ?? current.teacherMode
    }));
  }, [draft.category, draft.teacherLevel, draft.teacherMode, draft.teacherScope, draft.teacherSubject]);

  useEffect(() => {
    if (draft.category !== "personal-trainer") return;
    const scope = draft.trainerScope;
    const nextService = scope.services_offered[0] ?? draft.trainerServiceType;
    const nextMode = scope.modes[0] ?? draft.trainerMode;
    const nextEquipment = scope.brings_equipment;
    const fieldsChanged =
      nextService !== draft.trainerServiceType ||
      nextMode !== draft.trainerMode ||
      nextEquipment !== draft.trainerBringsEquipment;

    if (!fieldsChanged) return;

    setDraft((current) => ({
      ...current,
      trainerServiceType: current.trainerScope.services_offered[0] ?? current.trainerServiceType,
      trainerMode: current.trainerScope.modes[0] ?? current.trainerMode,
      trainerBringsEquipment: current.trainerScope.brings_equipment
    }));
  }, [draft.category, draft.trainerBringsEquipment, draft.trainerMode, draft.trainerScope, draft.trainerServiceType]);

  useEffect(() => {
    if (draft.category !== "limpieza") return;
    const derivedServices = deriveCleaningServicesFromScope(draft.cleaningScope);
    const scopeServicesChanged = derivedServices.join("|") !== draft.cleaningServices.join("|");
    const normalizedServices = normalizeCleaningServiceSlugs(draft.cleaningServices);
    const targetServices = scopeServicesChanged ? derivedServices : normalizedServices;
    const nextRates = targetServices.reduce<Partial<Record<CleaningServiceSlug, string>>>((acc, slug) => {
      acc[slug] = draft.cleaningServiceRates[slug] ?? "";
      return acc;
    }, {});
    const servicesChanged = normalizedServices.join("|") !== draft.cleaningServices.join("|");
    const ratesChanged = JSON.stringify(nextRates) !== JSON.stringify(draft.cleaningServiceRates);
    if (!servicesChanged && !ratesChanged && !scopeServicesChanged) return;
    setDraft((current) => ({
      ...current,
      cleaningServices: targetServices,
      cleaningServiceRates: nextRates
    }));
  }, [draft.category, draft.cleaningScope, draft.cleaningServiceRates, draft.cleaningServices]);

  useEffect(() => {
    if (draft.category !== "chef") return;
    const normalizedServices = normalizeChefServiceTypes(
      draft.chefScope.services_offered.length > 0 ? draft.chefScope.services_offered : draft.chefServiceType
    );
    const nextRates = normalizedServices.reduce<Partial<Record<ChefServiceSlug, string>>>((acc, slug) => {
      acc[slug] = draft.chefServiceRates[slug] ?? "";
      return acc;
    }, {});
    const servicesChanged = normalizedServices.join("|") !== draft.chefServiceType.join("|");
    const ratesChanged = JSON.stringify(nextRates) !== JSON.stringify(draft.chefServiceRates);
    const scopeChanged = normalizedServices.join("|") !== draft.chefScope.services_offered.join("|");
    if (!servicesChanged && !ratesChanged && !scopeChanged) return;
    setDraft((current) => ({
      ...current,
      chefServiceType: normalizedServices,
      chefScope: {
        ...current.chefScope,
        services_offered: normalizedServices
      },
      chefServiceRates: nextRates
    }));
  }, [draft.category, draft.chefScope, draft.chefServiceRates, draft.chefServiceType]);

  useEffect(() => {
    if (activeStep !== 7 || draft.category !== "limpieza") {
      setCleaningScopeScreen(1);
    }
  }, [activeStep, draft.category]);

  useEffect(() => {
    if (activeStep !== 7 || draft.category !== "mascotas") {
      setPetScopeScreen(1);
    }
  }, [activeStep, draft.category]);

  useEffect(() => {
    if (activeStep !== 7 || draft.category !== "maquillaje") {
      setMakeupScopeScreen(1);
    }
  }, [activeStep, draft.category]);

  useEffect(() => {
    if (activeStep !== 7 || draft.category !== "planchado") {
      setIroningScopeScreen(1);
    }
  }, [activeStep, draft.category]);

  useEffect(() => {
    if (activeStep !== 7 || draft.category !== "babysitter") {
      setBabysitterScopeScreen(1);
    }
  }, [activeStep, draft.category]);

  useEffect(() => {
    if (activeStep !== 7 || draft.category !== "chef") {
      setChefScopeScreen(1);
    }
  }, [activeStep, draft.category]);

  useEffect(() => {
    if (activeStep !== 7 || draft.category !== "profesor-particular") {
      setTeacherScopeScreen(1);
    }
  }, [activeStep, draft.category]);

  useEffect(() => {
    if (activeStep !== 7 || draft.category !== "personal-trainer") {
      setTrainerScopeScreen(1);
    }
  }, [activeStep, draft.category]);

  const hydrateFromServer = (nextOnboarding: OnboardingPayload, user?: { fullName?: string | null; email?: string | null; phone?: string | null }) => {
    const { firstName, lastName } = splitFullName(user?.fullName ?? session?.fullName ?? "");
    const isNewCategoryFlow = Boolean(presetService && (explicitNewCategoryFlow || presetService !== nextOnboarding.categorySlug));
    setOnboarding(nextOnboarding);

    if (isNewCategoryFlow && presetService) {
      const baseDraft = createFreshDraft(presetService);
      setDraft({
        ...baseDraft,
        phone: normalizeChileanMobileInput(user?.phone ?? baseDraft.phone),
        phoneVerified: Boolean(nextOnboarding.phoneValidatedAt),
        firstName: firstName || baseDraft.firstName,
        lastName: lastName || baseDraft.lastName,
        email: user?.email ?? baseDraft.email,
        rut: formatRutInput(nextOnboarding.documentId ?? baseDraft.rut),
        address: nextOnboarding.referenceAddress ?? baseDraft.address,
        homeCommune: (nextOnboarding.baseCommune as ActiveMvpCommune) ?? baseDraft.homeCommune,
        profilePhotoUrl: nextOnboarding.profilePhotoUrl ?? baseDraft.profilePhotoUrl,
        coverageCommunes:
          Array.isArray(nextOnboarding.serviceCommunes) && nextOnboarding.serviceCommunes.length > 0
            ? (nextOnboarding.serviceCommunes as ActiveMvpCommune[])
            : baseDraft.coverageCommunes,
        yearsExperience: nextOnboarding.yearsExperience ? String(Math.min(nextOnboarding.yearsExperience, 10)) : baseDraft.yearsExperience,
        workMode: nextOnboarding.workMode ?? baseDraft.workMode,
        availabilityMode: nextOnboarding.availabilityMode ?? baseDraft.availabilityMode,
        availabilityBlocks:
          toAvailabilityBlocks(nextOnboarding.availabilityBlocks).length > 0
            ? toAvailabilityBlocks(nextOnboarding.availabilityBlocks)
            : baseDraft.availabilityBlocks,
        bankName: nextOnboarding.bankName ?? baseDraft.bankName,
        bankAccountType: (nextOnboarding.bankAccountType as DraftState["bankAccountType"]) ?? baseDraft.bankAccountType,
        bankAccountNumber: nextOnboarding.bankAccountNumber ?? baseDraft.bankAccountNumber,
        bankOwnerRut: formatRutInput(nextOnboarding.bankAccountHolderRut ?? baseDraft.bankOwnerRut),
        acceptedTerms: false
      });
      setFeedback(`Estás configurando una nueva categoría tasker: ${CATEGORY_OPTIONS.find((option) => option.slug === presetService)?.label ?? presetService}.`);
      setActiveStep(6);
      return;
    }

    setDraft((current) => ({
      ...current,
      phone: normalizeChileanMobileInput(user?.phone ?? current.phone),
      phoneVerified: Boolean(nextOnboarding.phoneValidatedAt),
      firstName: firstName || current.firstName,
      lastName: lastName || current.lastName,
      email: user?.email ?? current.email,
      rut: formatRutInput(nextOnboarding.documentId ?? current.rut),
      address: nextOnboarding.referenceAddress ?? current.address,
      homeCommune: (nextOnboarding.baseCommune as ActiveMvpCommune) ?? current.homeCommune,
      profilePhotoUrl: nextOnboarding.profilePhotoUrl ?? current.profilePhotoUrl,
      coverageCommunes:
        Array.isArray(nextOnboarding.serviceCommunes) && nextOnboarding.serviceCommunes.length > 0
          ? (nextOnboarding.serviceCommunes as ActiveMvpCommune[])
          : current.coverageCommunes,
      category: (CATEGORY_OPTIONS.some((option) => option.slug === nextOnboarding.categorySlug)
        ? nextOnboarding.categorySlug
        : current.category) as CategorySlug,
      cleaningServices:
        nextOnboarding.categorySlug === "limpieza" ? normalizeCleaningServiceSlugs(nextOnboarding.offeredServices) : current.cleaningServices,
      cleaningScope: nextOnboarding.categorySlug === "limpieza" ? normalizeCleaningScope(nextOnboarding.cleaningScope) : current.cleaningScope,
      petServiceType:
        nextOnboarding.categorySlug === "mascotas"
          ? normalizePetServiceTypes(normalizePetScope(nextOnboarding.petScope).services_offered.length > 0 ? normalizePetScope(nextOnboarding.petScope).services_offered : nextOnboarding.offeredServices)
          : current.petServiceType,
      petAnimals:
        nextOnboarding.categorySlug === "mascotas"
          ? (() => {
              const normalizedPetScope = normalizePetScope(nextOnboarding.petScope);
              if (normalizedPetScope.animals_accepted.length > 0) return normalizedPetScope.animals_accepted;
              if (Array.isArray(nextOnboarding.experienceTypes)) {
                return nextOnboarding.experienceTypes.filter((item): item is "perros" | "gatos" => item === "perros" || item === "gatos");
              }
              return current.petAnimals;
            })()
          : current.petAnimals,
      petLargePets:
        nextOnboarding.categorySlug === "mascotas"
          ? normalizePetScope(nextOnboarding.petScope).accepts_large_pets ?? nextOnboarding.acceptsHomesWithPets ?? current.petLargePets
          : current.petLargePets,
      petScope: nextOnboarding.categorySlug === "mascotas" ? normalizePetScope(nextOnboarding.petScope) : current.petScope,
      makeupScope:
        nextOnboarding.categorySlug === "maquillaje"
          ? (() => {
              const normalizedScope = normalizeMakeupScope(nextOnboarding.makeupScope);
              if (normalizedScope.services_offered.length > 0 || normalizedScope.tasks_included.length > 0) {
                return normalizedScope;
              }
              return {
                ...normalizedScope,
                services_offered: normalizeMakeupTypes(nextOnboarding.offeredServices),
                includes_kit: nextOnboarding.bringsOwnProducts ?? current.makeupKit
              };
            })()
          : current.makeupScope,
      ironingScope:
        nextOnboarding.categorySlug === "planchado"
          ? (() => {
              const normalizedScope = normalizeIroningScope(nextOnboarding.ironingScope);
              if (normalizedScope.services_offered.length > 0 || normalizedScope.tasks_included.length > 0) {
                return normalizedScope;
              }
              return {
                ...normalizedScope,
                services_offered: Array.isArray(nextOnboarding.offeredServices)
                  ? nextOnboarding.offeredServices.filter(
                      (item): item is "casa_cliente" | "retiro_entrega" => item === "casa_cliente" || item === "retiro_entrega"
                    )
                  : [],
                delicate_clothes: nextOnboarding.bringsOwnTools ?? current.ironingDelicate
              };
            })()
          : current.ironingScope,
      babysitterScope:
        nextOnboarding.categorySlug === "babysitter"
          ? (() => {
              const normalizedScope = normalizeBabysitterScope(nextOnboarding.babysitterScope);
              if (
                normalizedScope.services_offered.length > 0 ||
                normalizedScope.age_ranges.length > 0 ||
                normalizedScope.tasks_included.length > 0
              ) {
                return normalizedScope;
              }
              return {
                ...normalizedScope,
                services_offered: Array.isArray(nextOnboarding.offeredServices)
                  ? nextOnboarding.offeredServices.filter(
                      (item): item is BabysitterScopeServiceSlug =>
                        typeof item === "string" &&
                        BABYSITTER_SCOPE_SERVICE_OPTIONS.some((option) => option.value === item)
                    )
                  : [],
                age_ranges: Array.isArray(nextOnboarding.experienceTypes)
                  ? nextOnboarding.experienceTypes.filter(
                      (item): item is BabysitterAgeRangeSlug =>
                        typeof item === "string" &&
                        BABYSITTER_AGE_RANGE_OPTIONS.some((option) => option.value === item)
                    )
                  : [],
                first_aid: nextOnboarding.bringsOwnTools ?? current.babysitterFirstAid,
                multi_child: nextOnboarding.acceptsHomesWithChildren ?? current.babysitterMultiChild
              };
            })()
          : current.babysitterScope,
      chefScope:
        nextOnboarding.categorySlug === "chef"
          ? (() => {
              const normalizedScope = normalizeChefScope(nextOnboarding.chefScope);
              if (normalizedScope.services_offered.length > 0 || normalizedScope.tasks_included.length > 0) {
                return normalizedScope;
              }
              return {
                ...normalizedScope,
                services_offered: normalizeChefServiceTypes(nextOnboarding.offeredServices)
              };
            })()
          : current.chefScope,
      teacherScope:
        nextOnboarding.categorySlug === "profesor-particular"
          ? (() => {
              const normalizedScope = normalizeTeacherScope(nextOnboarding.teacherScope);
              if (
                normalizedScope.services_offered.length > 0 ||
                normalizedScope.levels.length > 0 ||
                normalizedScope.modes.length > 0 ||
                normalizedScope.tasks_included.length > 0
              ) {
                return normalizedScope;
              }
              return {
                ...normalizedScope,
                services_offered: Array.isArray(nextOnboarding.offeredServices)
                  ? nextOnboarding.offeredServices.filter(
                      (item): item is TeacherScopeServiceSlug =>
                        typeof item === "string" &&
                        TEACHER_SCOPE_SERVICE_OPTIONS.some((option) => option.value === item)
                    )
                  : [],
                levels: Array.isArray(nextOnboarding.experienceTypes)
                  ? nextOnboarding.experienceTypes.filter(
                      (item): item is TeacherLevelSlug =>
                        typeof item === "string" &&
                        TEACHER_LEVEL_OPTIONS.some((option) => option.value === item)
                    )
                  : [],
                modes: Array.isArray(nextOnboarding.experienceTypes)
                  ? nextOnboarding.experienceTypes.filter(
                      (item): item is TeacherModeSlug =>
                        typeof item === "string" &&
                        TEACHER_MODE_OPTIONS.some((option) => option.value === item)
                    )
                  : []
              };
            })()
          : current.teacherScope,
      trainerScope:
        nextOnboarding.categorySlug === "personal-trainer"
          ? (() => {
              const normalizedScope = normalizeTrainerScope(nextOnboarding.trainerScope);
              if (
                normalizedScope.services_offered.length > 0 ||
                normalizedScope.modes.length > 0 ||
                normalizedScope.tasks_included.length > 0
              ) {
                return normalizedScope;
              }
              return {
                ...normalizedScope,
                services_offered: Array.isArray(nextOnboarding.offeredServices)
                  ? nextOnboarding.offeredServices.filter(
                      (item): item is TrainerScopeServiceSlug =>
                        typeof item === "string" &&
                        TRAINER_SCOPE_SERVICE_OPTIONS.some((option) => option.value === item)
                    )
                  : [],
                modes: Array.isArray(nextOnboarding.experienceTypes)
                  ? nextOnboarding.experienceTypes.filter(
                      (item): item is TrainerModeSlug =>
                        typeof item === "string" &&
                        TRAINER_MODE_OPTIONS.some((option) => option.value === item)
                    )
                  : [],
                brings_equipment: nextOnboarding.bringsOwnTools ?? current.trainerBringsEquipment
              };
            })()
          : current.trainerScope,
      chefServiceType: nextOnboarding.categorySlug === "chef" ? normalizeChefServiceTypes(nextOnboarding.offeredServices) : current.chefServiceType,
      makeupType: nextOnboarding.categorySlug === "maquillaje" ? normalizeMakeupTypes(nextOnboarding.offeredServices) : current.makeupType,
      makeupKit:
        nextOnboarding.categorySlug === "maquillaje"
          ? normalizeMakeupScope(nextOnboarding.makeupScope).includes_kit ?? nextOnboarding.bringsOwnProducts ?? current.makeupKit
          : current.makeupKit,
      ironingType:
        nextOnboarding.categorySlug === "planchado"
          ? normalizeIroningScope(nextOnboarding.ironingScope).services_offered[0] ?? current.ironingType
          : current.ironingType,
      ironingDelicate:
        nextOnboarding.categorySlug === "planchado"
          ? normalizeIroningScope(nextOnboarding.ironingScope).delicate_clothes ?? nextOnboarding.bringsOwnTools ?? current.ironingDelicate
          : current.ironingDelicate,
      babysitterAgeRange:
        nextOnboarding.categorySlug === "babysitter"
          ? normalizeBabysitterScope(nextOnboarding.babysitterScope).age_ranges[0] ?? current.babysitterAgeRange
          : current.babysitterAgeRange,
      babysitterFirstAid:
        nextOnboarding.categorySlug === "babysitter"
          ? normalizeBabysitterScope(nextOnboarding.babysitterScope).first_aid ?? nextOnboarding.bringsOwnTools ?? current.babysitterFirstAid
          : current.babysitterFirstAid,
      babysitterMultiChild:
        nextOnboarding.categorySlug === "babysitter"
          ? normalizeBabysitterScope(nextOnboarding.babysitterScope).multi_child ??
            nextOnboarding.acceptsHomesWithChildren ??
            current.babysitterMultiChild
          : current.babysitterMultiChild,
      teacherSubject:
        nextOnboarding.categorySlug === "profesor-particular"
          ? normalizeTeacherScope(nextOnboarding.teacherScope).services_offered[0] ?? current.teacherSubject
          : current.teacherSubject,
      teacherLevel:
        nextOnboarding.categorySlug === "profesor-particular"
          ? normalizeTeacherScope(nextOnboarding.teacherScope).levels[0] ?? current.teacherLevel
          : current.teacherLevel,
      teacherMode:
        nextOnboarding.categorySlug === "profesor-particular"
          ? (() => {
              const modes = normalizeTeacherScope(nextOnboarding.teacherScope).modes;
              if (modes.length > 1) return "ambas";
              return modes[0] ?? current.teacherMode;
            })()
          : current.teacherMode,
      trainerServiceType:
        nextOnboarding.categorySlug === "personal-trainer"
          ? normalizeTrainerScope(nextOnboarding.trainerScope).services_offered[0] ?? current.trainerServiceType
          : current.trainerServiceType,
      trainerMode:
        nextOnboarding.categorySlug === "personal-trainer"
          ? normalizeTrainerScope(nextOnboarding.trainerScope).modes[0] ?? current.trainerMode
          : current.trainerMode,
      trainerBringsEquipment:
        nextOnboarding.categorySlug === "personal-trainer"
          ? normalizeTrainerScope(nextOnboarding.trainerScope).brings_equipment ?? nextOnboarding.bringsOwnTools ?? current.trainerBringsEquipment
          : current.trainerBringsEquipment,
      yearsExperience: nextOnboarding.yearsExperience ? String(Math.min(nextOnboarding.yearsExperience, 10)) : current.yearsExperience,
      workMode: nextOnboarding.workMode ?? current.workMode,
      availabilityMode: nextOnboarding.availabilityMode ?? current.availabilityMode,
      availabilityBlocks:
        toAvailabilityBlocks(nextOnboarding.availabilityBlocks).length > 0
          ? toAvailabilityBlocks(nextOnboarding.availabilityBlocks)
          : current.availabilityBlocks,
      hourlyRate: nextOnboarding.hourlyRateClp ? String(nextOnboarding.hourlyRateClp) : current.hourlyRate,
      minimumHours: nextOnboarding.minBookingHours ? String(nextOnboarding.minBookingHours) : current.minimumHours,
      hasWeekendSurcharge: Boolean((nextOnboarding.weekendSurchargePct ?? 0) > 0),
      weekendSurchargePct: nextOnboarding.weekendSurchargePct != null ? String(nextOnboarding.weekendSurchargePct) : current.weekendSurchargePct,
      hasHolidaySurcharge: Boolean((nextOnboarding.holidaySurchargePct ?? 0) > 0),
      holidaySurchargePct: nextOnboarding.holidaySurchargePct != null ? String(nextOnboarding.holidaySurchargePct) : current.holidaySurchargePct,
      identityDocumentFrontFile: nextOnboarding.identityDocumentFrontFile ?? current.identityDocumentFrontFile,
      identityDocumentBackFile: nextOnboarding.identityDocumentBackFile ?? current.identityDocumentBackFile,
      criminalRecordFile: nextOnboarding.criminalRecordFile ?? current.criminalRecordFile,
      bankName: nextOnboarding.bankName ?? current.bankName,
      bankAccountType: (nextOnboarding.bankAccountType as DraftState["bankAccountType"]) ?? current.bankAccountType,
      bankAccountNumber: nextOnboarding.bankAccountNumber ?? current.bankAccountNumber,
      bankOwnerRut: formatRutInput(nextOnboarding.bankAccountHolderRut ?? current.bankOwnerRut),
      acceptedTerms: Boolean(nextOnboarding.acceptsCancellationPolicy && nextOnboarding.acceptsDataProcessing)
    }));

    if (nextOnboarding.submittedAt || ["PENDIENTE_REVISION", "APROBADO", "ACTIVO"].includes(nextOnboarding.status)) {
      setActiveStep(12);
      return;
    }

    const nextStep = Math.max(1, Math.min(11, nextOnboarding.currentStep || 1)) as WizardStep;
    setActiveStep(nextStep);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const sessionResponse = await fetch("/api/auth/session");
        const sessionData = (await sessionResponse.json()) as { session?: SessionPayload | null };
        const nextSession = sessionData.session ?? null;
        setSession(nextSession);

        if (nextSession?.role === "PRO") {
          const onboardingResponse = await fetch("/api/onboarding/cleaning/me");
          const onboardingData = (await onboardingResponse.json()) as {
            onboarding?: OnboardingPayload;
            serviceRates?: OnboardingServiceRate[];
            user?: { fullName?: string | null; email?: string | null; phone?: string | null };
            error?: string;
            detail?: string;
          };
          if (!onboardingResponse.ok || !onboardingData.onboarding) {
            throw new Error(onboardingData.detail || onboardingData.error || "No se pudo cargar el registro");
          }
          hydrateFromServer(onboardingData.onboarding, onboardingData.user);
          const isNewCategoryFlow = Boolean(
            presetService && (explicitNewCategoryFlow || presetService !== onboardingData.onboarding.categorySlug)
          );
          if (!isNewCategoryFlow && Array.isArray(onboardingData.serviceRates) && onboardingData.serviceRates.length > 0) {
            const serviceRates = onboardingData.serviceRates;
            setDraft((current) => ({
              ...current,
              cleaningServiceRates: serviceRates.reduce<Partial<Record<CleaningServiceSlug, string>>>((acc, item) => {
                if (isCleaningServiceSlug(item.serviceSlug)) {
                  acc[item.serviceSlug] = String(item.hourlyRateClp);
                }
                return acc;
              }, { ...current.cleaningServiceRates }),
              chefServiceRates: serviceRates.reduce<Partial<Record<ChefServiceSlug, string>>>((acc, item) => {
                if (isChefServiceSlug(item.serviceSlug)) {
                  acc[item.serviceSlug] = String(item.hourlyRateClp);
                }
                return acc;
              }, { ...current.chefServiceRates }),
              hourlyRate: serviceRates.find((item) => isCleaningServiceSlug(item.serviceSlug) && item.serviceSlug === "limpieza-hogar")?.hourlyRateClp?.toString() ??
                serviceRates.find((item) => isChefServiceSlug(item.serviceSlug) && item.serviceSlug === "meal-prep-semanal")?.hourlyRateClp?.toString() ??
                serviceRates[0]?.hourlyRateClp?.toString() ??
                current.hourlyRate
            }));
          }
        }
      } catch (eventualError) {
        setError(eventualError instanceof Error ? eventualError.message : "Error inesperado");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [explicitNewCategoryFlow, presetService, session?.fullName]);

  const updateDraft = <K extends keyof DraftState>(key: K, value: DraftState[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const selectAddressSuggestion = (suggestion: string) => {
    const detectedCommune = normalizeCommune(suggestion) ?? inferCommuneFromAddress(suggestion);
    setDraft((current) => ({
      ...current,
      address: suggestion,
      homeCommune: detectedCommune ?? current.homeCommune
    }));
    setSelectedFromAutocomplete(true);
    setAddressSuggestions([]);
    setShowSuggestions(false);
    setAddressValidationMessage("");
    setAddressValidationError("");
  };

  const validateHomeAddress = async ({
    silent = false,
    addressValue = draft.address.trim(),
    addressQueryValue = [draft.address.trim(), "Santiago", "Chile"].filter(Boolean).join(", ")
  }: {
    silent?: boolean;
    addressValue?: string;
    addressQueryValue?: string;
  } = {}) => {
    if (!addressValue) {
      if (!silent) {
        setAddressValidationError("Ingresa tu dirección antes de continuar.");
      }
      setAddressValidationMessage("");
      return false;
    }

    const validationId = addressValidationRequestRef.current + 1;
    addressValidationRequestRef.current = validationId;
    setValidatingAddress(true);
    if (!silent) {
      setAddressValidationError("");
      setAddressValidationMessage("");
    }

    try {
      const response = await fetch(`/api/maps/validate-address?address=${encodeURIComponent(addressQueryValue)}`);
      const data = (await response.json()) as AddressValidationResponse;
      if (!response.ok || !data.valid) {
        throw new Error(data.detail || data.error || "No pudimos validar esa dirección con Google.");
      }

      const detectedCommune = normalizeCommune(data.commune ?? "") ?? inferCommuneFromAddress(data.normalizedAddress ?? addressQueryValue);
      if (!detectedCommune) {
        throw new Error("No pudimos identificar una comuna válida a partir de esa dirección.");
      }

      setDraft((current) => ({
        ...current,
        address: current.address.trim() === addressValue ? data.normalizedAddress ?? current.address : current.address,
        homeCommune: current.address.trim() === addressValue ? detectedCommune : current.homeCommune
      }));
      setAddressValidationError("");
      setAddressValidationMessage(data.skipped ? `Comuna detectada automáticamente: ${detectedCommune}.` : `Dirección corroborada automáticamente con Google: ${detectedCommune}.`);
      return true;
    } catch (eventualError) {
      if (!silent) {
        setAddressValidationError(eventualError instanceof Error ? eventualError.message : "No pudimos validar esa dirección.");
      }
      return false;
    } finally {
      if (validationId === addressValidationRequestRef.current) {
        setValidatingAddress(false);
      }
    }
  };

  const persistServerStep = async (step: number, payload: Record<string, unknown>) => {
    const response = await fetch("/api/onboarding/cleaning/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step, payload })
    });
    const data = (await response.json()) as { ok?: boolean; onboarding?: OnboardingPayload; error?: string; detail?: string };
    if (!response.ok || !data.ok || !data.onboarding) {
      throw new Error(data.detail || data.error || "No se pudo guardar el paso");
    }
    setOnboarding(data.onboarding);
  };

  const phoneVerificationBasePath =
    session?.role === "PRO" || session?.role === "ADMIN" ? "/api/onboarding/cleaning/phone" : "/api/onboarding/public/phone";

  const sendPhoneCode = async () => {
    if (!isValidChileanMobilePhone(draft.phone)) {
      setError("Ingresa tu teléfono con formato +569 y 8 números.");
      return;
    }
    setSaving(true);
    setError("");
    setFeedback("");
    setSmsPreview("");
    try {
      const response = await fetch(`${phoneVerificationBasePath}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: draft.phone.trim() })
      });
      const data = (await response.json()) as { ok?: boolean; codePreview?: string; error?: string; detail?: string };
      if (!response.ok || !data.ok) throw new Error(data.detail || data.error || "No se pudo enviar el código");
      setFeedback("Código enviado por SMS.");
      setSmsPreview(data.codePreview ?? "");
    } catch (eventualError) {
      setError(eventualError instanceof Error ? eventualError.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  const verifyPhoneCode = async () => {
    setSaving(true);
    setError("");
    setFeedback("");
    try {
      const response = await fetch(`${phoneVerificationBasePath}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: draft.smsCode.trim() })
      });
      const data = (await response.json()) as { ok?: boolean; onboarding?: OnboardingPayload; error?: string; detail?: string };
      if (!response.ok || !data.ok) throw new Error(data.detail || data.error || "No se pudo verificar el teléfono");
      if (data.onboarding) {
        setOnboarding(data.onboarding);
      }
      setDraft((current) => ({ ...current, phoneVerified: true }));
      setFeedback("Teléfono verificado correctamente.");
      setActiveStep(3);
    } catch (eventualError) {
      setError(eventualError instanceof Error ? eventualError.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  const continueStep1 = () => {
    setError("");
    setFeedback("");
    if (session?.role === "PRO" || draft.phoneVerified || Boolean(onboarding?.phoneValidatedAt)) {
      setActiveStep(3);
      return;
    }
    setActiveStep(2);
  };

  const resetOnboarding = async () => {
    const shouldReset = window.confirm(
      "Esto borrará el avance guardado de este registro y te llevará de vuelta al inicio. ¿Quieres continuar?"
    );
    if (!shouldReset) return;

    setResetting(true);
    setError("");
    setFeedback("");
    setSubmitMissingFields([]);
    setSmsPreview("");
    setAddressSuggestions([]);
    setShowSuggestions(false);
    setSelectedFromAutocomplete(false);
    setAddressValidationMessage("");
    setAddressValidationError("");

    try {
      if (session?.role === "PRO") {
        const response = await fetch("/api/onboarding/cleaning/me", { method: "DELETE" });
        const data = (await response.json()) as { ok?: boolean; error?: string; detail?: string };
        if (!response.ok || !data.ok) {
          throw new Error(data.detail || data.error || "No se pudo reiniciar el registro");
        }
      }

      window.localStorage.removeItem(STORAGE_KEY);
      setDraft(createFreshDraft(presetService));
      setOnboarding(null);
      setActiveStep(1);
      setSelectedAvailabilityDay(currentWeekDayKey());
      setFeedback("Reiniciamos tu registro. Ahora puedes probar el flujo desde cero.");
    } catch (eventualError) {
      setError(eventualError instanceof Error ? eventualError.message : "Error inesperado");
    } finally {
      setResetting(false);
    }
  };

  const continueStep2 = async () => {
    if (!isValidChileanMobilePhone(draft.phone)) {
      setError("Ingresa tu teléfono con formato +569 y 8 números.");
      return;
    }
    if (!draft.phoneVerified) {
      setError("Debes verificar tu teléfono antes de continuar.");
      return;
    }
    setError("");
    setFeedback("");
    setActiveStep(3);
  };

  const continueStep3 = async () => {
    if (!draft.firstName.trim() || !draft.lastName.trim()) {
      setError("Completa nombre y apellido.");
      return;
    }
    if (!draft.email.trim()) {
      setError("Completa tu email.");
      return;
    }
    if (!isValidRut(draft.rut)) {
      setError("Ingresa un RUT chileno válido.");
      return;
    }
    if (!draft.address.trim()) {
      setError("Ingresa tu dirección.");
      return;
    }
    if (!draft.profilePhotoUrl) {
      setError("La foto de perfil es obligatoria.");
      return;
    }

    setSaving(true);
    setError("");
    setFeedback("");
    try {
      const normalizedProfilePhoto = await createCenteredProfilePhoto(draft.profilePhotoUrl, photoFocus.x, photoFocus.y);
      if (normalizedProfilePhoto && normalizedProfilePhoto !== draft.profilePhotoUrl) {
        setDraft((current) => ({ ...current, profilePhotoUrl: normalizedProfilePhoto }));
      }

      let profilePhotoFinal = normalizedProfilePhoto || draft.profilePhotoUrl;
      if (profilePhotoFinal && profilePhotoFinal.startsWith("data:")) {
        try {
          const uploadedKey = await uploadAssetViaPresign({
            source: { dataUrl: profilePhotoFinal, contentType: "image/jpeg" },
            kind: "profile_photo"
          });
          if (uploadedKey) {
            // Persist the storage key server-side, but keep the local data URL
            // in the draft so the in-session preview keeps working without
            // additional fetches. On reload the server returns the key and the
            // preview falls back to a placeholder.
            profilePhotoFinal = uploadedKey;
          }
        } catch (uploadError) {
          console.warn("[onboarding] profile_photo upload failed, keeping data url", uploadError);
        }
      }

      const addressOk = await validateHomeAddress();
      if (!addressOk) return;

      if (session?.role === "PRO") {
        await persistServerStep(3, {
          fullName: `${draft.firstName.trim()} ${draft.lastName.trim()}`,
          email: draft.email.trim().toLowerCase(),
          phone: draft.phone.trim(),
          documentId: draft.rut.trim(),
          referenceAddress: draft.address.trim(),
          baseCommune: draft.homeCommune,
          profilePhotoUrl: profilePhotoFinal
        });
      } else {
        const response = await fetch("/api/onboarding/cleaning/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: `${draft.firstName.trim()} ${draft.lastName.trim()}`,
            email: draft.email.trim().toLowerCase(),
            phone: draft.phone.trim(),
            categorySlug: draft.category,
            baseCommune: draft.homeCommune,
            referenceAddress: draft.address.trim(),
            documentId: draft.rut.trim(),
            profilePhotoUrl: profilePhotoFinal
          })
        });
        const data = (await response.json()) as {
          session?: SessionPayload;
          onboarding?: OnboardingPayload;
          error?: string;
          detail?: string;
        };
        if (!response.ok || !data.session || !data.onboarding) {
          throw new Error(data.detail || data.error || "No se pudo iniciar el registro");
        }
        setSession(data.session);
        if (draft.phoneVerified && !data.onboarding.phoneValidatedAt) {
          const claimResponse = await fetch("/api/onboarding/cleaning/phone/claim", { method: "POST" });
          const claimData = (await claimResponse.json()) as { ok?: boolean; onboarding?: OnboardingPayload; error?: string; detail?: string };
          if (claimResponse.ok && claimData.ok && claimData.onboarding) {
            setOnboarding(claimData.onboarding);
          } else {
            setOnboarding(data.onboarding);
          }
        } else {
          setOnboarding(data.onboarding);
        }
      }
      setActiveStep(4);
    } catch (eventualError) {
      setError(eventualError instanceof Error ? eventualError.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  const continueStep4 = async () => {
    if (draft.coverageCommunes.length === 0) {
      setError("Selecciona al menos una comuna de cobertura.");
      return;
    }
    setSaving(true);
    setError("");
    setFeedback("");
    try {
      await persistServerStep(4, {
        baseCommune: draft.homeCommune,
        serviceCommunes: draft.coverageCommunes
      });
      if (presetService) {
        await persistServerStep(5, { categorySlug: draft.category });
        setActiveStep(6);
      } else {
        setActiveStep(5);
      }
    } catch (eventualError) {
      setError(eventualError instanceof Error ? eventualError.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  const continueStep5 = async () => {
    setSaving(true);
    setError("");
    try {
      await persistServerStep(5, { categorySlug: draft.category });
      setActiveStep(6);
    } catch (eventualError) {
      setError(eventualError instanceof Error ? eventualError.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  const continueStep6 = async () => {
    setSaving(true);
    setError("");
    try {
      await persistServerStep(6, {
        yearsExperience: draft.yearsExperience === "10+" ? 11 : Number(draft.yearsExperience),
        workMode: draft.workMode
      });
      setActiveStep(7);
    } catch (eventualError) {
      setError(eventualError instanceof Error ? eventualError.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  const continueCleaningScopeScreen = () => {
    if (cleaningScopeScreen === 1 && draft.cleaningScope.services_offered.length === 0) {
      setError("Selecciona al menos un servicio de limpieza que sí ofreces.");
      return;
    }
    if (cleaningScopeScreen === 2 && draft.cleaningScope.tasks_included.length === 0) {
      setError("Selecciona al menos una tarea que sí realizas.");
      return;
    }
    setError("");
    setCleaningScopeScreen((current) => (Math.min(5, current + 1) as CleaningScopeScreen));
  };

  const previousCleaningScopeScreen = () => {
    setError("");
    setCleaningScopeScreen((current) => (Math.max(1, current - 1) as CleaningScopeScreen));
  };

  const continuePetScopeScreen = () => {
    if (petScopeScreen === 1 && draft.petServiceType.length === 0) {
      setError("Selecciona al menos un servicio de mascotas que sí ofreces.");
      return;
    }
    if (petScopeScreen === 2 && draft.petAnimals.length === 0) {
      setError("Selecciona al menos un tipo de mascota con el que sí trabajas.");
      return;
    }
    if (petScopeScreen === 3 && draft.petScope.tasks_included.length === 0) {
      setError("Selecciona al menos una tarea que sí realizas.");
      return;
    }
    setError("");
    setPetScopeScreen((current) => (Math.min(6, current + 1) as PetScopeScreen));
  };

  const previousPetScopeScreen = () => {
    setError("");
    setPetScopeScreen((current) => (Math.max(1, current - 1) as PetScopeScreen));
  };

  const continueMakeupScopeScreen = () => {
    if (makeupScopeScreen === 1 && draft.makeupScope.services_offered.length === 0) {
      setError("Selecciona al menos un tipo de maquillaje que ofreces.");
      return;
    }
    if (makeupScopeScreen === 2 && draft.makeupScope.tasks_included.length === 0) {
      setError("Selecciona al menos una tarea que sí realizas.");
      return;
    }
    setError("");
    setMakeupScopeScreen((current) => (Math.min(5, current + 1) as MakeupScopeScreen));
  };

  const previousMakeupScopeScreen = () => {
    setError("");
    setMakeupScopeScreen((current) => (Math.max(1, current - 1) as MakeupScopeScreen));
  };

  const continueIroningScopeScreen = () => {
    if (ironingScopeScreen === 1 && draft.ironingScope.services_offered.length === 0) {
      setError("Selecciona al menos una modalidad de planchado que ofreces.");
      return;
    }
    setError("");
    setIroningScopeScreen((current) => (Math.min(5, current + 1) as IroningScopeScreen));
  };

  const previousIroningScopeScreen = () => {
    setError("");
    setIroningScopeScreen((current) => (Math.max(1, current - 1) as IroningScopeScreen));
  };

  const continueBabysitterScopeScreen = () => {
    if (babysitterScopeScreen === 1 && draft.babysitterScope.services_offered.length === 0) {
      setError("Selecciona al menos un servicio de babysitter que sí ofreces.");
      return;
    }
    if (babysitterScopeScreen === 2 && draft.babysitterScope.age_ranges.length === 0) {
      setError("Selecciona al menos un rango de edad con el que sí trabajas.");
      return;
    }
    if (babysitterScopeScreen === 3 && draft.babysitterScope.tasks_included.length === 0) {
      setError("Selecciona al menos una tarea que sí realizas.");
      return;
    }
    setError("");
    setBabysitterScopeScreen((current) => (Math.min(6, current + 1) as BabysitterScopeScreen));
  };

  const previousBabysitterScopeScreen = () => {
    setError("");
    setBabysitterScopeScreen((current) => (Math.max(1, current - 1) as BabysitterScopeScreen));
  };

  const continueChefScopeScreen = () => {
    if (draft.chefScope.services_offered.length === 0) {
      setError("Selecciona al menos un tipo de servicio de chef que ofreces.");
      return;
    }
    setError("");
    void continueStep7();
  };

  const previousChefScopeScreen = () => {
    setError("");
    previousStep();
  };

  const continueTeacherScopeScreen = () => {
    if (teacherScopeScreen === 1 && draft.teacherScope.services_offered.length === 0) {
      setError("Selecciona al menos una asignatura que ofreces.");
      return;
    }
    if (teacherScopeScreen === 2 && draft.teacherScope.levels.length === 0) {
      setError("Selecciona al menos un nivel con el que trabajas.");
      return;
    }
    if (teacherScopeScreen === 2 && draft.teacherScope.modes.length === 0) {
      setError("Selecciona al menos una modalidad de clases.");
      return;
    }
    if (teacherScopeScreen === 3 && draft.teacherScope.tasks_included.length === 0) {
      setError("Selecciona al menos una tarea que sí realizas.");
      return;
    }
    setError("");
    setTeacherScopeScreen((current) => (Math.min(6, current + 1) as TeacherScopeScreen));
  };

  const previousTeacherScopeScreen = () => {
    setError("");
    setTeacherScopeScreen((current) => (Math.max(1, current - 1) as TeacherScopeScreen));
  };

  const continueTrainerScopeScreen = () => {
    if (trainerScopeScreen === 1 && draft.trainerScope.services_offered.length === 0) {
      setError("Selecciona al menos un tipo de entrenamiento que ofreces.");
      return;
    }
    if (trainerScopeScreen === 2 && draft.trainerScope.modes.length === 0) {
      setError("Selecciona al menos una modalidad en la que trabajas.");
      return;
    }
    if (trainerScopeScreen === 3 && draft.trainerScope.tasks_included.length === 0) {
      setError("Selecciona al menos una tarea que sí realizas.");
      return;
    }
    setError("");
    setTrainerScopeScreen((current) => (Math.min(6, current + 1) as TrainerScopeScreen));
  };

  const previousTrainerScopeScreen = () => {
    setError("");
    setTrainerScopeScreen((current) => (Math.max(1, current - 1) as TrainerScopeScreen));
  };

  const continueStep7 = async () => {
    const payload = buildStep7Payload(draft);
    if (!payload.offeredServices || payload.offeredServices.length === 0) {
      setError("Responde las preguntas de tu categoría para continuar.");
      return;
    }
    if (draft.category === "limpieza") {
      if (draft.cleaningScope.services_offered.length === 0) {
        setError("Selecciona al menos un servicio de limpieza que ofreces.");
        return;
      }
      if (draft.cleaningScope.tasks_included.length === 0) {
        setError("Selecciona al menos una tarea que sí realizas.");
        return;
      }
    }
    if (draft.category === "mascotas" && draft.petAnimals.length === 0) {
      setError("Selecciona al menos un tipo de mascota para continuar.");
      return;
    }
    if (draft.category === "mascotas" && draft.petServiceType.length === 0) {
      setError("Selecciona al menos un servicio de mascotas que ofreces.");
      return;
    }
    if (draft.category === "mascotas" && draft.petScope.tasks_included.length === 0) {
      setError("Selecciona al menos una tarea que sí realizas.");
      return;
    }
    if (draft.category === "maquillaje" && draft.makeupScope.services_offered.length === 0) {
      setError("Selecciona al menos un tipo de maquillaje que ofreces.");
      return;
    }
    if (draft.category === "maquillaje" && draft.makeupScope.tasks_included.length === 0) {
      setError("Selecciona al menos una tarea que sí realizas.");
      return;
    }
    if (draft.category === "planchado" && draft.ironingScope.services_offered.length === 0) {
      setError("Selecciona al menos una modalidad de planchado que ofreces.");
      return;
    }
    if (draft.category === "babysitter" && draft.babysitterScope.services_offered.length === 0) {
      setError("Selecciona al menos un servicio de babysitter que ofreces.");
      return;
    }
    if (draft.category === "babysitter" && draft.babysitterScope.age_ranges.length === 0) {
      setError("Selecciona al menos un rango de edad con el que trabajas.");
      return;
    }
    if (draft.category === "babysitter" && draft.babysitterScope.tasks_included.length === 0) {
      setError("Selecciona al menos una tarea que sí realizas.");
      return;
    }
    if (draft.category === "chef" && draft.chefScope.services_offered.length === 0) {
      setError("Selecciona al menos un tipo de servicio de chef que ofreces.");
      return;
    }
    if (draft.category === "profesor-particular" && draft.teacherScope.services_offered.length === 0) {
      setError("Selecciona al menos una asignatura que ofreces.");
      return;
    }
    if (draft.category === "profesor-particular" && draft.teacherScope.levels.length === 0) {
      setError("Selecciona al menos un nivel con el que trabajas.");
      return;
    }
    if (draft.category === "profesor-particular" && draft.teacherScope.modes.length === 0) {
      setError("Selecciona al menos una modalidad de clases.");
      return;
    }
    if (draft.category === "profesor-particular" && draft.teacherScope.tasks_included.length === 0) {
      setError("Selecciona al menos una tarea que sí realizas.");
      return;
    }
    if (draft.category === "personal-trainer" && draft.trainerScope.services_offered.length === 0) {
      setError("Selecciona al menos un tipo de entrenamiento que ofreces.");
      return;
    }
    if (draft.category === "personal-trainer" && draft.trainerScope.modes.length === 0) {
      setError("Selecciona al menos una modalidad en la que trabajas.");
      return;
    }
    if (draft.category === "personal-trainer" && draft.trainerScope.tasks_included.length === 0) {
      setError("Selecciona al menos una tarea que sí realizas.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await persistServerStep(7, payload);
      setActiveStep(8);
    } catch (eventualError) {
      setError(eventualError instanceof Error ? eventualError.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  const continueStep8 = async () => {
    const validBlocks = draft.availabilityBlocks.filter((block) => block.start && block.end && block.end > block.start);
    if (validBlocks.length === 0) {
      setError("Configura al menos un bloque horario válido.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await persistServerStep(8, { availabilityMode: "FIJA", availabilityBlocks: validBlocks });
      setActiveStep(9);
    } catch (eventualError) {
      setError(eventualError instanceof Error ? eventualError.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  const continueStep9 = async () => {
    const cleaningRates =
      draft.category === "limpieza"
        ? selectedCleaningServiceDefinitions(draft).map((service) => ({
            serviceSlug: service.slug,
            hourlyRateClp: Number(draft.cleaningServiceRates[service.slug] || 0)
          }))
        : [];
    const chefRates =
      draft.category === "chef"
        ? selectedChefServiceDefinitions(draft).map((service) => ({
            serviceSlug: service.slug,
            hourlyRateClp: Number(draft.chefServiceRates[service.slug] || 0)
          }))
        : [];
    const categoryRates = draft.category === "limpieza" ? cleaningRates : draft.category === "chef" ? chefRates : [];

    if (draft.category === "chef") {
      const invalidChefRate = chefRates.find((item) => !isChefServiceRateWithinRange(item.serviceSlug, item.hourlyRateClp));
      if (invalidChefRate) {
        const service = getChefServiceDefinition(invalidChefRate.serviceSlug);
        setError(
          service
            ? `${service.name} debe quedar entre $${formatClp(service.recommendedMinClp)} y $${formatClp(service.recommendedMaxClp)}.`
            : "Uno de los precios de chef está fuera del rango permitido."
        );
        return;
      }
    }

    if (
      ((draft.category === "limpieza" || draft.category === "chef") && categoryRates.some((item) => !item.hourlyRateClp)) ||
      (draft.category !== "limpieza" && draft.category !== "chef" && !draft.hourlyRate.trim()) ||
      (draft.category !== "chef" && !draft.minimumHours.trim())
    ) {
      setError("Completa tu tarifa y mínimo de horas.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const fallbackRate =
        draft.category === "limpieza"
          ? cleaningRates.find((item) => item.serviceSlug === "limpieza-hogar")?.hourlyRateClp ??
            cleaningRates[0]?.hourlyRateClp ??
            Number(draft.hourlyRate || 0)
          : draft.category === "chef"
            ? chefRates.find((item) => item.serviceSlug === "meal-prep-semanal")?.hourlyRateClp ??
              chefRates[0]?.hourlyRateClp ??
              Number(draft.hourlyRate || 0)
            : Number(draft.hourlyRate);
      await persistServerStep(9, {
        hourlyRateClp: fallbackRate,
        serviceRates: categoryRates,
        minBookingHours: draft.category === "chef" ? 1 : Number(draft.minimumHours),
        weekendSurchargePct: draft.hasWeekendSurcharge ? Number(draft.weekendSurchargePct || 0) : 0,
        holidaySurchargePct: draft.hasHolidaySurcharge ? Number(draft.holidaySurchargePct || 0) : 0,
        remoteCommuneSurchargeClp: chicureoSelected ? 5000 : 0
      });
      setActiveStep(10);
    } catch (eventualError) {
      setError(eventualError instanceof Error ? eventualError.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  const continueStep10 = async () => {
    const ownerRut = formatRutInput(draft.rut);
    if (!isValidRut(ownerRut)) {
      setError("Ingresa un RUT válido al inicio del registro.");
      return;
    }
    if (!draft.identityDocumentFrontFile || !draft.identityDocumentBackFile || !draft.criminalRecordFile) {
      setError("Debes subir carnet por delante, carnet por atrás y certificado de antecedentes.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await persistServerStep(10, {
        bankAccountHolder: `${draft.firstName.trim()} ${draft.lastName.trim()}`.trim(),
        bankAccountHolderRut: ownerRut,
        bankName: draft.bankName,
        bankAccountType: draft.bankAccountType,
        bankAccountNumber: draft.bankAccountNumber.trim(),
        identityDocumentFrontFile: draft.identityDocumentFrontFile,
        identityDocumentBackFile: draft.identityDocumentBackFile,
        criminalRecordFile: draft.criminalRecordFile
      });
      setActiveStep(11);
    } catch (eventualError) {
      setError(eventualError instanceof Error ? eventualError.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  const finalizeRegistration = async () => {
    if (!draft.acceptedTerms) {
      setError("Debes aceptar los términos y condiciones para finalizar.");
      return;
    }
    setSaving(true);
    setError("");
    setFeedback("");
    setSubmitMissingFields([]);
    try {
      await persistServerStep(11, { acceptTerms: true });
      const response = await fetch("/api/onboarding/cleaning/submit", { method: "POST" });
      const data = (await response.json()) as { ok?: boolean; onboarding?: OnboardingPayload; error?: string; detail?: string; missingFields?: string[] };
      if (!response.ok || !data.ok || !data.onboarding) {
        if (Array.isArray(data.missingFields) && data.missingFields.length > 0) {
          setSubmitMissingFields(
            data.missingFields.map((field) => ({
              field,
              label: SUBMIT_REQUIRED_FIELDS[field]?.label ?? field,
              step: SUBMIT_REQUIRED_FIELDS[field]?.step ?? 11
            }))
          );
          throw new Error("Aún faltan campos obligatorios antes de enviar tu perfil a revisión.");
        }
        throw new Error(data.detail || data.error || "No se pudo finalizar el registro");
      }
      setOnboarding(data.onboarding);
      setActiveStep(12);
      setFeedback("Registro completado. Tu perfil será revisado antes de activarse.");
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (eventualError) {
      setError(eventualError instanceof Error ? eventualError.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  const selectAllCoverageCommunes = () => {
    setDraft((current) => ({
      ...current,
      coverageCommunes: [...COMMUNE_OPTIONS]
    }));
  };

  const addCoverageCommune = () => {
    setDraft((current) => {
      if (current.coverageCommunes.includes(coverageCommuneSelection)) return current;
      return {
        ...current,
        coverageCommunes: [...current.coverageCommunes, coverageCommuneSelection]
      };
    });
  };

  const removeCoverageCommune = (commune: ActiveMvpCommune) => {
    setDraft((current) => ({
      ...current,
      coverageCommunes: current.coverageCommunes.filter((item) => item !== commune)
    }));
  };

  const updatePhotoFocusFromPointer = (clientX: number, clientY: number) => {
    const preview = photoPreviewRef.current;
    if (!preview) return;
    const rect = preview.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));
    setPhotoFocus({ x, y });
  };

  const startPhotoDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setPhotoDragging(true);
    updatePhotoFocusFromPointer(event.clientX, event.clientY);
  };

  const movePhotoDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!photoDragging) return;
    updatePhotoFocusFromPointer(event.clientX, event.clientY);
  };

  const stopPhotoDrag = () => {
    setPhotoDragging(false);
  };

  const revealAvailabilityDetail = (focusFirstInput = false) => {
    window.setTimeout(() => {
      const panel = availabilityTaskPanelRef.current;
      if (!panel) return;
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
      if (focusFirstInput) {
        const firstField = panel.querySelector<HTMLElement>("select");
        firstField?.focus();
      }
    }, 80);
  };

  const selectAvailabilityDay = (day: DayKey) => {
    setSelectedAvailabilityDay(day);
    setBulkAvailabilityDays((current) => (current.includes(day) ? current : Array.from(new Set([...current, day]))));
    revealAvailabilityDetail(false);
  };

  const toggleBulkAvailabilityDay = (day: DayKey) => {
    setBulkAvailabilityDays((current) => {
      if (current.includes(day)) {
        const next = current.filter((item) => item !== day);
        return next.length > 0 ? next : [day];
      }
      return [...current, day];
    });
  };

  const updateAvailabilityBlock = (index: number, patch: Partial<AvailabilityBlock>) => {
    setDraft((current) => ({
      ...current,
      availabilityBlocks: current.availabilityBlocks.map((block, blockIndex) => (blockIndex === index ? { ...block, ...patch } : block))
    }));
  };

  const addAvailabilityBlock = (days: DayKey[]) => {
    const uniqueDays = Array.from(new Set(days));
    const start = newAvailabilityStart;
    const end = newAvailabilityEnd;
    if (uniqueDays.length === 0) {
      setError("Selecciona al menos un día para crear el bloque.");
      return;
    }
    if (!start || !end || end <= start) {
      setError("Define un rango horario válido para crear el bloque.");
      return;
    }
    setError("");
    setSelectedAvailabilityDay(uniqueDays[0]);
    setDraft((current) => ({
      ...current,
      availabilityBlocks: [
        ...current.availabilityBlocks,
        ...uniqueDays
          .filter(
            (day) => !current.availabilityBlocks.some((block) => block.day === day && block.start === start && block.end === end)
          )
          .map((day) => ({ day, start, end }))
      ]
    }));
    revealAvailabilityDetail(true);
  };

  const removeAvailabilityBlock = (index: number) => {
    setDraft((current) => ({
      ...current,
      availabilityBlocks: current.availabilityBlocks.filter((_, blockIndex) => blockIndex !== index)
    }));
  };

  const groupedBlocks = useMemo(
    () =>
      DAY_OPTIONS.map((day) => ({
        ...day,
        blocks: draft.availabilityBlocks
          .map((block, index) => ({ ...block, index }))
          .filter((block) => block.day === day.key)
      })),
    [draft.availabilityBlocks]
  );
  const selectedDayConfig = useMemo(
    () => groupedBlocks.find((day) => day.key === selectedAvailabilityDay) ?? groupedBlocks[0],
    [groupedBlocks, selectedAvailabilityDay]
  );
  const activeAvailabilityDays = useMemo(() => groupedBlocks.filter((day) => day.blocks.length > 0).length, [groupedBlocks]);
  const totalAvailabilityBlocks = draft.availabilityBlocks.length;
  const maxAccessibleStep = useMemo(() => {
    if (isAdditionalCategoryFlow) {
      if (activeStep === 12) return 11 as WizardStep;
      return Math.min(activeStep, 11) as WizardStep;
    }
    const persistedStep = Math.max(1, Math.min(11, onboarding?.currentStep ?? 1));
    if (activeStep === 12) {
      return 11 as WizardStep;
    }
    return Math.max(persistedStep, Math.min(activeStep, 11)) as WizardStep;
  }, [activeStep, isAdditionalCategoryFlow, onboarding?.currentStep]);

  const jumpToStep = (step: WizardStep) => {
    if (step > maxAccessibleStep || saving || resetting) return;
    setError("");
    setFeedback("");
    setSubmitMissingFields([]);
    setActiveStep(step);
  };

  const previousStep = () => {
    if (activeStep <= 1) return;
    setError("");
    setFeedback("");
    setSubmitMissingFields([]);
    setActiveStep((current) => Math.max(1, current - 1) as WizardStep);
  };

  if (loading) {
    return <OnboardingLoadingScreen />;
  }

  return (
    <main className="auth-flow-screen auth-flow-screen-scroll">
      <div className="auth-flow-backdrop" aria-hidden />

      <div className="login-screen-content">
        <AuthHeroNav />

        <section className="auth-flow-shell auth-flow-shell-wide">
          <div className="auth-flow-copy">
            <p className="auth-flow-kicker">Registro de taskers</p>
            <h1>Completa tu registro en 3 a 4 minutos.</h1>
            <p>Trabaja con clientes en tu comuna, configura tu disponibilidad y recibe pagos seguros por tus servicios en WeTask.</p>

            <div className="auth-flow-copy-list">
              <div className="auth-flow-meta-card">
                <strong>Tiempo objetivo</strong>
                <span>3–4 minutos para completar el flujo base y enviarlo a revisión.</span>
              </div>
              <div className="auth-flow-meta-card">
                <strong>Guardado por paso</strong>
                <span>Desde que creas tu cuenta, cada avance queda persistido automáticamente.</span>
              </div>
            </div>

            {onboarding?.adminReviewNotes ? (
              <div className="auth-flow-status">
                <strong>{onboarding.status}</strong>
                <span>{onboarding.adminReviewNotes}</span>
              </div>
            ) : null}
          </div>

          <section className="auth-flow-panel auth-flow-panel-wide onboarding-panel">
            <div className="onboarding-progress-head">
              <div>
                <p className="onboarding-step-kicker">Paso {activeStep} de {TOTAL_STEPS}</p>
                <h2>{activeStep === 12 ? "Registro completado" : "Trabaja con WeTask"}</h2>
              </div>
              <div className="onboarding-progress-meta">
                <span className="onboarding-progress-label">{progressPercent}%</span>
                {(activeStep > 1 || onboarding || session?.role === "PRO") && activeStep < 12 ? (
                  <button type="button" className="cta ghost small" onClick={resetOnboarding} disabled={resetting || saving}>
                    {resetting ? "Reiniciando..." : "Empezar de cero"}
                  </button>
                ) : null}
              </div>
            </div>
            <div className="onboarding-progress-track" aria-hidden>
              <div className="onboarding-progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="onboarding-step-nav" aria-label="Navegación por pasos del onboarding">
              {ONBOARDING_STEP_ITEMS.map((item) => {
                const isActive = activeStep === item.step;
                const isDone = item.step < activeStep || (!isAdditionalCategoryFlow && item.step <= (onboarding?.currentStep ?? 1));
                const isLocked = item.step > maxAccessibleStep;

                return (
                  <button
                    key={item.step}
                    type="button"
                    className={`onboarding-step-nav-item${isActive ? " active" : ""}${isDone ? " done" : ""}`}
                    onClick={() => jumpToStep(item.step)}
                    disabled={isLocked || saving || resetting}
                    aria-current={isActive ? "step" : undefined}
                  >
                    <span>Paso {item.step}</span>
                    <strong>{item.label}</strong>
                  </button>
                );
              })}
            </div>

            {feedback ? <p className="feedback ok">{feedback}</p> : null}
            {error ? <p className="feedback error">{error}</p> : null}
            {submitMissingFields.length > 0 ? (
              <div className="onboarding-missing-card">
                <strong>Faltan estos datos antes de enviar tu perfil:</strong>
                <div className="onboarding-missing-actions">
                  {submitMissingFields.map((item) => (
                    <button
                      key={item.field}
                      type="button"
                      className="onboarding-missing-link"
                      onClick={() => jumpToStep(item.step)}
                    >
                      {item.label} (Paso {item.step})
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {activeStep === 1 ? (
              <div className="onboarding-screen">
                <h3>Trabaja con WeTask</h3>
                <p>Conecta con clientes en tu comuna y recibe pagos seguros por tus servicios.</p>
                <div className="auth-flow-actions">
                  <button type="button" className="cta" onClick={continueStep1}>
                    Comenzar registro
                  </button>
                </div>
              </div>
            ) : null}

            {activeStep === 2 ? (
              <div className="onboarding-screen">
                <h3>Verificación de teléfono</h3>
                <label>
                  Teléfono
                  <div className="onboarding-inline-action-row">
                    <input
                      value={draft.phone}
                      onChange={(event) => {
                        const nextPhone = normalizeChileanMobileInput(event.target.value);
                        setDraft((current) => ({
                          ...current,
                          phone: nextPhone,
                          phoneVerified: false,
                          smsCode: ""
                        }));
                        setSmsPreview("");
                      }}
                      inputMode="numeric"
                      maxLength={13}
                      placeholder="+56912345678"
                    />
                    <button type="button" className="cta ghost small" onClick={sendPhoneCode} disabled={saving}>
                      {saving ? "Enviando..." : "Enviar código"}
                    </button>
                  </div>
                  <p className="input-hint">El prefijo `+569` queda fijo. Solo debes ingresar los 8 números restantes.</p>
                </label>
                <label>
                  Código SMS
                  <input value={draft.smsCode} onChange={(event) => updateDraft("smsCode", event.target.value)} placeholder="123456" maxLength={6} />
                </label>
                {smsPreview ? <p className="onboarding-dev-note">Código dev: <strong>{smsPreview}</strong></p> : null}
                <div className="auth-flow-actions">
                  <button type="button" className="cta" onClick={verifyPhoneCode} disabled={saving}>
                    {saving ? "Verificando..." : "Validar código"}
                  </button>
                  <button type="button" className="cta ghost" onClick={previousStep}>
                    Volver
                  </button>
                  <button type="button" className="cta ghost" onClick={continueStep2}>
                    Continuar
                  </button>
                </div>
              </div>
            ) : null}

            {activeStep === 3 ? (
              <div className="onboarding-screen">
                <div className="tasker-role-banner">
                  <strong>Perfil tasker</strong>
                  <span>Esta información será la base pública de tu perfil en WeTask.</span>
                </div>
                <h3>Datos personales + foto</h3>
                <div className="grid-form auth-flow-form">
                  <label>
                    Nombre
                    <input value={draft.firstName} onChange={(event) => updateDraft("firstName", event.target.value)} />
                  </label>
                  <label>
                    Apellido
                    <input value={draft.lastName} onChange={(event) => updateDraft("lastName", event.target.value)} />
                  </label>
                  <label>
                    Email
                    <input type="email" value={draft.email} onChange={(event) => updateDraft("email", event.target.value)} />
                  </label>
                  <label>
                    RUT
                    <input
                      value={draft.rut}
                      onChange={(event) => updateDraft("rut", formatRutInput(event.target.value))}
                      placeholder="12.345.678-5"
                    />
                  </label>
                  <label className="full tasker-address-field">
                    Dirección
                    <div className="address-autocomplete-shell">
                      <input
                        className="tasker-address-input"
                        value={draft.address}
                        onChange={(event) => {
                          setSelectedFromAutocomplete(false);
                          setAddressValidationMessage("");
                          setAddressValidationError("");
                          updateDraft("address", event.target.value);
                        }}
                        onFocus={() => setShowSuggestions(addressSuggestions.length > 0)}
                        placeholder="Av. Apoquindo 1234"
                      />
                      {showSuggestions && addressSuggestions.length > 0 ? (
                        <div className="address-suggestions">
                          {addressSuggestions.map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              className="address-suggestion-btn"
                              onClick={() => selectAddressSuggestion(suggestion)}
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {autocompleteLoading ? <p className="input-hint">Buscando direcciones en Google...</p> : null}
                    <p className="input-hint">{validatingAddress ? "Validando tu dirección automáticamente." : "La comuna se detecta automáticamente desde la dirección."}</p>
                  </label>
                  <label className="full">
                    Foto de perfil
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        const content = await fileToDataUrl(file);
                        setPhotoFocus({ x: 50, y: 34 });
                        updateDraft("profilePhotoUrl", content);
                      }}
                    />
                    <p className="input-hint">Mueve la foto con el mouse o con el dedo dentro del marco para dejar tu rostro centrado.</p>
                  </label>
                  {draft.profilePhotoUrl ? (
                    <div className="full tasker-photo-editor">
                      <div
                        ref={photoPreviewRef}
                        className={`tasker-photo-preview ${photoDragging ? "dragging" : ""}`}
                        onPointerDown={startPhotoDrag}
                        onPointerMove={movePhotoDrag}
                        onPointerUp={stopPhotoDrag}
                        onPointerCancel={stopPhotoDrag}
                        onPointerLeave={stopPhotoDrag}
                      >
                        <img
                          src={draft.profilePhotoUrl}
                          alt="Vista previa de foto de perfil"
                          style={{ objectPosition: `${photoFocus.x}% ${photoFocus.y}%` }}
                        />
                      </div>
                      <div className="tasker-photo-editor-copy">
                        <strong>Vista previa del perfil</strong>
                        <span>La imagen se guardará recortada en formato cuadrado, centrada según la posición que elijas.</span>
                      </div>
                    </div>
                  ) : null}
                </div>
                {addressValidationMessage ? <p className="feedback ok">{addressValidationMessage}</p> : null}
                {addressValidationError ? <p className="feedback error">{addressValidationError}</p> : null}
                {draft.homeCommune === "Chicureo" ? <p className="onboarding-warning">Chicureo puede tener recargo por distancia.</p> : null}
                <div className="auth-flow-actions">
                  <button type="button" className="cta ghost" onClick={previousStep}>
                    Volver
                  </button>
                  <button type="button" className="cta" onClick={continueStep3} disabled={saving}>
                    {saving ? "Guardando..." : "Continuar"}
                  </button>
                </div>
              </div>
            ) : null}

            {activeStep === 4 ? (
              <div className="onboarding-screen">
                <h3>{draft.category === "babysitter" ? "¿En qué comunas activas de WeTask quieres trabajar como babysitter?" : "¿En qué comunas quieres trabajar?"}</h3>
                <p className="input-hint">
                  {draft.category === "babysitter"
                    ? "Estas comunas están definidas por WeTask. Solo puedes seleccionar dentro de esta cobertura y no agregar zonas manualmente."
                    : "Selecciona solo comunas activas definidas por WeTask para tu cobertura."}
                </p>
                <div className="commune-selector-panel">
                  <div className="commune-picker-row">
                    <select value={coverageCommuneSelection} onChange={(event) => setCoverageCommuneSelection(event.target.value as ActiveMvpCommune)}>
                      {COMMUNE_OPTIONS.map((commune) => (
                        <option key={commune} value={commune}>
                          {commune}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="cta ghost small" onClick={addCoverageCommune}>
                      Agregar comuna
                    </button>
                  </div>
                  <div className="cta-row">
                    <button type="button" className="cta ghost small" onClick={selectAllCoverageCommunes}>
                      Seleccionar todas
                    </button>
                  </div>
                  <div className="commune-chip-list-frame">
                    <p className="coverage-map-tag-head">Comunas guardadas</p>
                    {draft.coverageCommunes.length > 0 ? (
                      <div className="commune-chip-list" aria-label="Comunas seleccionadas">
                        {draft.coverageCommunes.map((commune) => (
                          <span key={commune} className="commune-chip">
                            {commune}
                            <button type="button" aria-label={`Quitar ${commune}`} onClick={() => removeCoverageCommune(commune)}>
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="commune-empty">Todavía no agregas comunas de trabajo.</p>
                    )}
                  </div>
                </div>
                {chicureoSelected ? <p className="onboarding-warning">Chicureo puede tener recargo por distancia.</p> : null}
                <div className="auth-flow-actions">
                  <button type="button" className="cta ghost" onClick={previousStep}>
                    Volver
                  </button>
                  <button type="button" className="cta" onClick={continueStep4} disabled={saving}>
                    {saving ? "Guardando..." : "Continuar"}
                  </button>
                </div>
              </div>
            ) : null}

            {activeStep === 5 && !presetService ? (
              <div className="onboarding-screen">
                <h3>Categoría de servicio</h3>
                <div className="auth-service-grid">
                  {CATEGORY_OPTIONS.map((option) => (
                    <label key={option.slug} className={`auth-service-card ${draft.category === option.slug ? "active" : ""}`}>
                      <input
                        type="radio"
                        name="category"
                        checked={draft.category === option.slug}
                        onChange={() => updateDraft("category", option.slug)}
                      />
                      <span className="auth-service-icon" aria-hidden>
                        {option.icon}
                      </span>
                      <strong>{option.label}</strong>
                      <span>{option.description}</span>
                    </label>
                  ))}
                </div>
                <div className="auth-flow-actions">
                  <button type="button" className="cta ghost" onClick={previousStep}>
                    Volver
                  </button>
                  <button type="button" className="cta" onClick={continueStep5} disabled={saving}>
                    {saving ? "Guardando..." : "Continuar"}
                  </button>
                </div>
              </div>
            ) : null}

            {activeStep === 6 ? (
              <div className="onboarding-screen">
                <h3>Información profesional</h3>
                <div className="grid-form auth-flow-form">
                  <label>
                    Años de experiencia
                    <select value={draft.yearsExperience} onChange={(event) => updateDraft("yearsExperience", event.target.value)}>
                      {["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "10+"].map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    ¿Cómo trabajas?
                    <select value={draft.workMode} onChange={(event) => updateDraft("workMode", event.target.value as "SOLO" | "EQUIPO")}>
                      <option value="SOLO">Solo</option>
                      <option value="EQUIPO">Con equipo</option>
                    </select>
                  </label>
                </div>
                <div className="auth-flow-actions">
                  <button type="button" className="cta ghost" onClick={previousStep}>
                    Volver
                  </button>
                  <button type="button" className="cta" onClick={continueStep6} disabled={saving}>
                    {saving ? "Guardando..." : "Continuar"}
                  </button>
                </div>
              </div>
            ) : null}

            {activeStep === 7 ? (
              <div className="onboarding-screen">
                <h3>Preguntas específicas: {selectedCategoryLabel}</h3>

                {draft.category === "limpieza" ? (
                  <div className="grid-form auth-flow-form">
                    <div className="full onboarding-step-mini-progress">
                      <span className={cleaningScopeScreen >= 1 ? "active" : ""}>Servicios</span>
                      <span className={cleaningScopeScreen >= 2 ? "active" : ""}>Sí realiza</span>
                      <span className={cleaningScopeScreen >= 3 ? "active" : ""}>No realiza</span>
                      <span className={cleaningScopeScreen >= 4 ? "active" : ""}>Condiciones</span>
                      <span className={cleaningScopeScreen >= 5 ? "active" : ""}>Revisión</span>
                    </div>

                    {cleaningScopeScreen === 1 ? (
                      <div className="full">
                        <p className="field-label">¿Qué tipos de limpieza aceptas?</p>
                        <p className="input-hint">
                          Esto define en qué búsquedas vas a aparecer. El alcance real de tareas lo completas en los pasos siguientes.
                        </p>
                        <div className="auth-service-grid auth-service-grid-cleaning">
                          {CLEANING_SCOPE_SERVICE_OPTIONS.map((service) => (
                            <label
                              key={service.value}
                              className={`auth-service-card auth-service-card-scope ${draft.cleaningScope.services_offered.includes(service.value) ? "active" : ""}`}
                            >
                              <input
                                type="checkbox"
                                checked={draft.cleaningScope.services_offered.includes(service.value)}
                                onChange={(event) =>
                                  setDraft((current) => ({
                                    ...current,
                                    cleaningScope: {
                                      ...current.cleaningScope,
                                      services_offered: event.target.checked
                                        ? Array.from(new Set([...current.cleaningScope.services_offered, service.value]))
                                        : current.cleaningScope.services_offered.filter((item) => item !== service.value)
                                    }
                                  }))
                                }
                              />
                              <strong>{service.label}</strong>
                              <span>{service.description}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {cleaningScopeScreen === 2 ? (
                      <div className="full">
                        <p className="field-label">¿Qué tareas sí realizas?</p>
                        <p className="input-hint">Esto se mostrará en tu perfil y se usará para filtrar reservas con tareas específicas.</p>
                        <div className="onboarding-task-checklist">
                          <div className="onboarding-task-checklist-head">
                            <span>Lista de tareas</span>
                            <span>Sí realizo</span>
                          </div>
                          {CLEANING_TASK_INCLUDED_OPTIONS.map((task) => (
                            <label
                              key={task.value}
                              className={`onboarding-task-checklist-row ${draft.cleaningScope.tasks_included.includes(task.value) ? "checked" : ""}`}
                            >
                              <span className="onboarding-task-checklist-label">{task.label}</span>
                              <span className="onboarding-task-checklist-control">
                                <span className="onboarding-task-checklist-box" aria-hidden />
                              <input
                                type="checkbox"
                                checked={draft.cleaningScope.tasks_included.includes(task.value)}
                                onChange={(event) =>
                                  setDraft((current) => ({
                                    ...current,
                                    cleaningScope: {
                                      ...current.cleaningScope,
                                      tasks_included: event.target.checked
                                        ? Array.from(new Set([...current.cleaningScope.tasks_included, task.value]))
                                        : current.cleaningScope.tasks_included.filter((item) => item !== task.value)
                                    }
                                  }))
                                }
                              />
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {cleaningScopeScreen === 3 ? (
                      <div className="full">
                        <p className="field-label">¿Qué tareas no realizas?</p>
                        <p className="input-hint">Así evitamos malos entendidos y ayudamos a prevenir disputas antes de la reserva.</p>
                        <div className="onboarding-task-checklist">
                          <div className="onboarding-task-checklist-head onboarding-task-checklist-head-warning">
                            <span>Lista de tareas</span>
                            <span>No realizo</span>
                          </div>
                          {CLEANING_TASK_EXCLUDED_OPTIONS.map((task) => (
                            <label
                              key={task.value}
                              className={`onboarding-task-checklist-row onboarding-task-checklist-row-warning ${draft.cleaningScope.tasks_excluded.includes(task.value) ? "checked" : ""}`}
                            >
                              <span className="onboarding-task-checklist-label">{task.label}</span>
                              <span className="onboarding-task-checklist-control">
                                <span className="onboarding-task-checklist-box" aria-hidden />
                              <input
                                type="checkbox"
                                checked={draft.cleaningScope.tasks_excluded.includes(task.value)}
                                onChange={(event) =>
                                  setDraft((current) => ({
                                    ...current,
                                    cleaningScope: {
                                      ...current.cleaningScope,
                                      tasks_excluded: event.target.checked
                                        ? Array.from(new Set([...current.cleaningScope.tasks_excluded, task.value]))
                                        : current.cleaningScope.tasks_excluded.filter((item) => item !== task.value)
                                    }
                                  }))
                                }
                              />
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {cleaningScopeScreen === 4 ? (
                      <>
                        <label className="full">
                          Condiciones especiales de tu servicio
                          <textarea
                            value={draft.cleaningScope.special_conditions}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                cleaningScope: {
                                  ...current.cleaningScope,
                                  special_conditions: event.target.value
                                }
                              }))
                            }
                            placeholder="Ejemplo: Solo realizo aseo general, no profundo. No trabajo en altura. No muevo muebles pesados."
                            rows={5}
                          />
                          <span className="input-hint">Escribe cualquier condición importante que el cliente deba saber antes de reservar.</span>
                        </label>
                      </>
                    ) : null}

                    {cleaningScopeScreen === 5 ? (
                      <>
                        <div className="full auth-flow-note-card">
                          <strong>Revisa tu perfil</strong>
                          <span>Así verán tu alcance base de servicio los clientes y el motor de matching.</span>
                        </div>
                        <div className="full onboarding-scope-review-grid">
                          <article className="auth-flow-note-card">
                            <strong>Tipos de limpieza que aceptas</strong>
                            <span>{cleaningScopeServicesPreview.length > 0 ? cleaningScopeServicesPreview.join(", ") : "Sin información aún."}</span>
                          </article>
                          <article className="auth-flow-note-card">
                            <strong>Tareas que sí realiza</strong>
                            <span>{cleaningScopeIncludedPreview.length > 0 ? cleaningScopeIncludedPreview.join(", ") : "Sin información aún."}</span>
                          </article>
                          <article className="auth-flow-note-card">
                            <strong>Tareas que no realiza</strong>
                            <span>{cleaningScopeExcludedPreview.length > 0 ? cleaningScopeExcludedPreview.join(", ") : "No marcaste exclusiones."}</span>
                          </article>
                          <article className="auth-flow-note-card">
                            <strong>Condiciones especiales</strong>
                            <span>{draft.cleaningScope.special_conditions.trim() || "No agregaste condiciones especiales."}</span>
                          </article>
                        </div>
                        <label>
                          ¿Llevas productos de limpieza?
                          <select
                            value={draft.cleaningBringsProducts == null ? "" : draft.cleaningBringsProducts ? "si" : "no"}
                            onChange={(event) => updateDraft("cleaningBringsProducts", event.target.value === "si")}
                          >
                            <option value="">Selecciona</option>
                            <option value="si">Sí</option>
                            <option value="no">No</option>
                          </select>
                        </label>
                        <label>
                          ¿Llevas aspiradora o equipos?
                          <select
                            value={draft.cleaningBringsEquipment == null ? "" : draft.cleaningBringsEquipment ? "si" : "no"}
                            onChange={(event) => updateDraft("cleaningBringsEquipment", event.target.value === "si")}
                          >
                            <option value="">Selecciona</option>
                            <option value="si">Sí</option>
                            <option value="no">No</option>
                          </select>
                        </label>
                      </>
                    ) : null}
                  </div>
                ) : null}

                {draft.category === "mascotas" ? (
                  <div className="grid-form auth-flow-form">
                    <div className="full onboarding-scope-progress">
                      <span className={petScopeScreen >= 1 ? "active" : ""}>Servicios</span>
                      <span className={petScopeScreen >= 2 ? "active" : ""}>Mascotas</span>
                      <span className={petScopeScreen >= 3 ? "active" : ""}>Sí realiza</span>
                      <span className={petScopeScreen >= 4 ? "active" : ""}>No realiza</span>
                      <span className={petScopeScreen >= 5 ? "active" : ""}>Condiciones</span>
                      <span className={petScopeScreen >= 6 ? "active" : ""}>Revisión</span>
                    </div>

                    {petScopeScreen === 1 ? (
                      <div className="full">
                        <p className="field-label">¿Qué servicios de mascotas ofreces?</p>
                        <div className="auth-service-grid auth-service-grid-cleaning">
                          {PET_SCOPE_SERVICE_OPTIONS.map((service) => (
                            <label key={service.value} className={`auth-service-card auth-service-card-scope ${draft.petServiceType.includes(service.value) ? "active" : ""}`}>
                              <input
                                type="checkbox"
                                checked={draft.petServiceType.includes(service.value)}
                                onChange={(event) => {
                                  setDraft((current) => ({
                                    ...current,
                                    petServiceType: event.target.checked
                                      ? Array.from(new Set([...current.petServiceType, service.value]))
                                      : current.petServiceType.filter((item) => item !== service.value)
                                  }));
                                }}
                              />
                              <strong>{service.label}</strong>
                              <span>{service.description}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {petScopeScreen === 2 ? (
                      <>
                        <div className="full">
                          <p className="field-label">¿Con qué mascotas trabajas?</p>
                          <div className="onboarding-checkbox-grid onboarding-checkbox-grid-compact">
                            {petAnimalOptions.map((animal) => (
                              <label key={animal} className="onboarding-check-card">
                                <input
                                  type="checkbox"
                                  checked={draft.petAnimals.includes(animal)}
                                  onChange={() =>
                                    updateDraft(
                                      "petAnimals",
                                      draft.petAnimals.includes(animal) ? draft.petAnimals.filter((item) => item !== animal) : [...draft.petAnimals, animal]
                                    )
                                  }
                                />
                                <span>{animal === "perros" ? "Perros" : "Gatos"}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <label>
                          ¿Aceptas mascotas grandes?
                          <select
                            value={draft.petLargePets == null ? "" : draft.petLargePets ? "si" : "no"}
                            onChange={(event) =>
                              updateDraft("petLargePets", event.target.value === "" ? null : event.target.value === "si")
                            }
                          >
                            <option value="">Selecciona</option>
                            <option value="si">Sí</option>
                            <option value="no">No</option>
                          </select>
                        </label>
                      </>
                    ) : null}

                    {petScopeScreen === 3 ? (
                      <div className="full">
                        <p className="field-label">¿Qué tareas sí realizas?</p>
                        <div className="onboarding-task-checklist">
                          {PET_TASK_INCLUDED_OPTIONS.map((task) => (
                            <label key={task.value} className={`onboarding-task-checklist-row ${draft.petScope.tasks_included.includes(task.value) ? "checked" : ""}`}>
                              <div>
                                <strong>{task.label}</strong>
                              </div>
                              <span className="onboarding-task-checklist-control">
                                <input
                                  type="checkbox"
                                  checked={draft.petScope.tasks_included.includes(task.value)}
                                  onChange={(event) => {
                                    setDraft((current) => ({
                                      ...current,
                                      petScope: {
                                        ...current.petScope,
                                        tasks_included: event.target.checked
                                          ? Array.from(new Set([...current.petScope.tasks_included, task.value]))
                                          : current.petScope.tasks_included.filter((item) => item !== task.value)
                                      }
                                    }));
                                  }}
                                />
                                <span className="onboarding-task-checklist-box" aria-hidden />
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {petScopeScreen === 4 ? (
                      <div className="full">
                        <p className="field-label">¿Qué tareas no realizas?</p>
                        <div className="onboarding-task-checklist">
                          {PET_TASK_EXCLUDED_OPTIONS.map((task) => (
                            <label
                              key={task.value}
                              className={`onboarding-task-checklist-row onboarding-task-checklist-row-warning ${draft.petScope.tasks_excluded.includes(task.value) ? "checked" : ""}`}
                            >
                              <div>
                                <strong>{task.label}</strong>
                              </div>
                              <span className="onboarding-task-checklist-control">
                                <input
                                  type="checkbox"
                                  checked={draft.petScope.tasks_excluded.includes(task.value)}
                                  onChange={(event) => {
                                    setDraft((current) => ({
                                      ...current,
                                      petScope: {
                                        ...current.petScope,
                                        tasks_excluded: event.target.checked
                                          ? Array.from(new Set([...current.petScope.tasks_excluded, task.value]))
                                          : current.petScope.tasks_excluded.filter((item) => item !== task.value)
                                      }
                                    }));
                                  }}
                                />
                                <span className="onboarding-task-checklist-box" aria-hidden />
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {petScopeScreen === 5 ? (
                      <div className="full">
                        <label>
                          Condiciones especiales de tu servicio
                          <textarea
                            value={draft.petScope.special_conditions}
                            rows={4}
                            placeholder="Ejemplo: no recibo más de dos mascotas a la vez, no hago traslados en auto y prefiero perros con correa."
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                petScope: {
                                  ...current.petScope,
                                  special_conditions: event.target.value
                                }
                              }))
                            }
                          />
                        </label>
                      </div>
                    ) : null}

                    {petScopeScreen === 6 ? (
                      <div className="full onboarding-scope-review-grid">
                        <div className="auth-flow-note-card">
                          <strong>Servicios ofrecidos</strong>
                          <span>{petScopeServicesPreview.length > 0 ? petScopeServicesPreview.join(", ") : "Sin información aún."}</span>
                        </div>
                        <div className="auth-flow-note-card">
                          <strong>Mascotas aceptadas</strong>
                          <span>{petScopeAnimalsPreview.length > 0 ? petScopeAnimalsPreview.join(", ") : "Sin información aún."}</span>
                        </div>
                        <div className="auth-flow-note-card">
                          <strong>Tareas que sí realiza</strong>
                          <span>{petScopeIncludedPreview.length > 0 ? petScopeIncludedPreview.join(", ") : "Sin información aún."}</span>
                        </div>
                        <div className="auth-flow-note-card">
                          <strong>Tareas que no realiza</strong>
                          <span>{petScopeExcludedPreview.length > 0 ? petScopeExcludedPreview.join(", ") : "No marcaste exclusiones."}</span>
                        </div>
                        <div className="auth-flow-note-card">
                          <strong>Mascotas grandes</strong>
                          <span>{draft.petLargePets == null ? "No informado." : draft.petLargePets ? "Sí acepta" : "No acepta"}</span>
                        </div>
                        <div className="auth-flow-note-card">
                          <strong>Condiciones especiales</strong>
                          <span>{draft.petScope.special_conditions.trim() || "No agregaste condiciones especiales."}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {draft.category === "babysitter" ? (
                  <div className="grid-form auth-flow-form">
                    <div className="full onboarding-scope-progress">
                      <span className={babysitterScopeScreen >= 1 ? "active" : ""}>Servicios</span>
                      <span className={babysitterScopeScreen >= 2 ? "active" : ""}>Edades</span>
                      <span className={babysitterScopeScreen >= 3 ? "active" : ""}>Sí realiza</span>
                      <span className={babysitterScopeScreen >= 4 ? "active" : ""}>No realiza</span>
                      <span className={babysitterScopeScreen >= 5 ? "active" : ""}>Condiciones</span>
                      <span className={babysitterScopeScreen >= 6 ? "active" : ""}>Revisión</span>
                    </div>

                    {babysitterScopeScreen === 1 ? (
                      <div className="full">
                        <p className="field-label">¿Qué servicios de babysitter ofreces?</p>
                        <div className="auth-service-grid auth-service-grid-cleaning">
                          {BABYSITTER_SCOPE_SERVICE_OPTIONS.map((service) => (
                            <label
                              key={service.value}
                              className={`auth-service-card auth-service-card-scope ${draft.babysitterScope.services_offered.includes(service.value) ? "active" : ""}`}
                            >
                              <input
                                type="checkbox"
                                checked={draft.babysitterScope.services_offered.includes(service.value)}
                                onChange={(event) => {
                                  setDraft((current) => ({
                                    ...current,
                                    babysitterScope: {
                                      ...current.babysitterScope,
                                      services_offered: event.target.checked
                                        ? Array.from(new Set([...current.babysitterScope.services_offered, service.value]))
                                        : current.babysitterScope.services_offered.filter((item) => item !== service.value)
                                    }
                                  }));
                                }}
                              />
                              <strong>{service.label}</strong>
                              <span>{service.description}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {babysitterScopeScreen === 2 ? (
                      <>
                        <div className="full">
                          <p className="field-label">¿Con qué edades trabajas?</p>
                          <div className="onboarding-checkbox-grid onboarding-checkbox-grid-compact">
                            {BABYSITTER_AGE_RANGE_OPTIONS.map((option) => (
                              <label key={option.value} className="onboarding-check-card">
                                <input
                                  type="checkbox"
                                  checked={draft.babysitterScope.age_ranges.includes(option.value)}
                                  onChange={() =>
                                    setDraft((current) => ({
                                      ...current,
                                      babysitterScope: {
                                        ...current.babysitterScope,
                                        age_ranges: current.babysitterScope.age_ranges.includes(option.value)
                                          ? current.babysitterScope.age_ranges.filter((item) => item !== option.value)
                                          : [...current.babysitterScope.age_ranges, option.value]
                                      }
                                    }))
                                  }
                                />
                                <span>{option.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <label>
                          ¿Sabes primeros auxilios?
                          <select
                            value={draft.babysitterScope.first_aid == null ? "" : draft.babysitterScope.first_aid ? "si" : "no"}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                babysitterScope: {
                                  ...current.babysitterScope,
                                  first_aid: event.target.value === "" ? null : event.target.value === "si"
                                }
                              }))
                            }
                          >
                            <option value="">Selecciona</option>
                            <option value="si">Sí</option>
                            <option value="no">No</option>
                          </select>
                        </label>
                        <label>
                          ¿Puedes cuidar más de un niño?
                          <select
                            value={draft.babysitterScope.multi_child == null ? "" : draft.babysitterScope.multi_child ? "si" : "no"}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                babysitterScope: {
                                  ...current.babysitterScope,
                                  multi_child: event.target.value === "" ? null : event.target.value === "si"
                                }
                              }))
                            }
                          >
                            <option value="">Selecciona</option>
                            <option value="si">Sí</option>
                            <option value="no">No</option>
                          </select>
                        </label>
                      </>
                    ) : null}

                    {babysitterScopeScreen === 3 ? (
                      <div className="full">
                        <p className="field-label">¿Qué tareas sí realizas?</p>
                        <div className="onboarding-task-checklist">
                          {BABYSITTER_TASK_INCLUDED_OPTIONS.map((task) => (
                            <label key={task.value} className={`onboarding-task-checklist-row ${draft.babysitterScope.tasks_included.includes(task.value) ? "checked" : ""}`}>
                              <div>
                                <strong>{task.label}</strong>
                              </div>
                              <span className="onboarding-task-checklist-control">
                                <input
                                  type="checkbox"
                                  checked={draft.babysitterScope.tasks_included.includes(task.value)}
                                  onChange={(event) => {
                                    setDraft((current) => ({
                                      ...current,
                                      babysitterScope: {
                                        ...current.babysitterScope,
                                        tasks_included: event.target.checked
                                          ? Array.from(new Set([...current.babysitterScope.tasks_included, task.value]))
                                          : current.babysitterScope.tasks_included.filter((item) => item !== task.value)
                                      }
                                    }));
                                  }}
                                />
                                <span className="onboarding-task-checklist-box" aria-hidden />
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {babysitterScopeScreen === 4 ? (
                      <div className="full">
                        <p className="field-label">¿Qué tareas no realizas?</p>
                        <div className="onboarding-task-checklist">
                          {BABYSITTER_TASK_EXCLUDED_OPTIONS.map((task) => (
                            <label
                              key={task.value}
                              className={`onboarding-task-checklist-row onboarding-task-checklist-row-warning ${draft.babysitterScope.tasks_excluded.includes(task.value) ? "checked" : ""}`}
                            >
                              <div>
                                <strong>{task.label}</strong>
                              </div>
                              <span className="onboarding-task-checklist-control">
                                <input
                                  type="checkbox"
                                  checked={draft.babysitterScope.tasks_excluded.includes(task.value)}
                                  onChange={(event) => {
                                    setDraft((current) => ({
                                      ...current,
                                      babysitterScope: {
                                        ...current.babysitterScope,
                                        tasks_excluded: event.target.checked
                                          ? Array.from(new Set([...current.babysitterScope.tasks_excluded, task.value]))
                                          : current.babysitterScope.tasks_excluded.filter((item) => item !== task.value)
                                      }
                                    }));
                                  }}
                                />
                                <span className="onboarding-task-checklist-box" aria-hidden />
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {babysitterScopeScreen === 5 ? (
                      <div className="full">
                        <label>
                          Condiciones especiales de tu servicio
                          <textarea
                            value={draft.babysitterScope.special_conditions}
                            rows={4}
                            placeholder="Ejemplo: no trabajo después de las 22:00, no hago traslados en auto y prefiero máximo dos niños por reserva."
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                babysitterScope: {
                                  ...current.babysitterScope,
                                  special_conditions: event.target.value
                                }
                              }))
                            }
                          />
                        </label>
                      </div>
                    ) : null}

                    {babysitterScopeScreen === 6 ? (
                      <div className="full onboarding-scope-review-grid">
                        <div className="auth-flow-note-card">
                          <strong>Servicios ofrecidos</strong>
                          <span>{babysitterScopeServicesPreview.length > 0 ? babysitterScopeServicesPreview.join(", ") : "Sin información aún."}</span>
                        </div>
                        <div className="auth-flow-note-card">
                          <strong>Edades con las que trabaja</strong>
                          <span>{babysitterScopeAgePreview.length > 0 ? babysitterScopeAgePreview.join(", ") : "Sin información aún."}</span>
                        </div>
                        <div className="auth-flow-note-card">
                          <strong>Tareas que sí realiza</strong>
                          <span>{babysitterScopeIncludedPreview.length > 0 ? babysitterScopeIncludedPreview.join(", ") : "Sin información aún."}</span>
                        </div>
                        <div className="auth-flow-note-card">
                          <strong>Tareas que no realiza</strong>
                          <span>{babysitterScopeExcludedPreview.length > 0 ? babysitterScopeExcludedPreview.join(", ") : "No marcaste exclusiones."}</span>
                        </div>
                        <div className="auth-flow-note-card">
                          <strong>Primeros auxilios</strong>
                          <span>{draft.babysitterScope.first_aid == null ? "No informado." : draft.babysitterScope.first_aid ? "Sí" : "No"}</span>
                        </div>
                        <div className="auth-flow-note-card">
                          <strong>Más de un niño</strong>
                          <span>{draft.babysitterScope.multi_child == null ? "No informado." : draft.babysitterScope.multi_child ? "Sí" : "No"}</span>
                        </div>
                        <div className="auth-flow-note-card">
                          <strong>Condiciones especiales</strong>
                          <span>{draft.babysitterScope.special_conditions.trim() || "No agregaste condiciones especiales."}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {draft.category === "profesor-particular" ? (
                  <div className="grid-form auth-flow-form">
                    <div className="full onboarding-scope-progress">
                      <span className={teacherScopeScreen >= 1 ? "active" : ""}>Asignaturas</span>
                      <span className={teacherScopeScreen >= 2 ? "active" : ""}>Nivel y modalidad</span>
                      <span className={teacherScopeScreen >= 3 ? "active" : ""}>Sí realiza</span>
                      <span className={teacherScopeScreen >= 4 ? "active" : ""}>No realiza</span>
                      <span className={teacherScopeScreen >= 5 ? "active" : ""}>Condiciones</span>
                      <span className={teacherScopeScreen >= 6 ? "active" : ""}>Revisión</span>
                    </div>

                    {teacherScopeScreen === 1 ? (
                      <div className="full">
                        <p className="field-label">¿Qué asignaturas ofreces?</p>
                        <div className="auth-service-grid auth-service-grid-cleaning">
                          {TEACHER_SCOPE_SERVICE_OPTIONS.map((service) => (
                            <label
                              key={service.value}
                              className={`auth-service-card auth-service-card-scope ${draft.teacherScope.services_offered.includes(service.value) ? "active" : ""}`}
                            >
                              <input
                                type="checkbox"
                                checked={draft.teacherScope.services_offered.includes(service.value)}
                                onChange={(event) => {
                                  setDraft((current) => ({
                                    ...current,
                                    teacherScope: {
                                      ...current.teacherScope,
                                      services_offered: event.target.checked
                                        ? Array.from(new Set([...current.teacherScope.services_offered, service.value]))
                                        : current.teacherScope.services_offered.filter((item) => item !== service.value)
                                    }
                                  }));
                                }}
                              />
                              <strong>{service.label}</strong>
                              <span>{service.description}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {teacherScopeScreen === 2 ? (
                      <>
                        <div className="full">
                          <p className="field-label">¿Con qué niveles trabajas?</p>
                          <div className="onboarding-checkbox-grid onboarding-checkbox-grid-compact">
                            {TEACHER_LEVEL_OPTIONS.map((option) => (
                              <label key={option.value} className="onboarding-check-card">
                                <input
                                  type="checkbox"
                                  checked={draft.teacherScope.levels.includes(option.value)}
                                  onChange={() =>
                                    setDraft((current) => ({
                                      ...current,
                                      teacherScope: {
                                        ...current.teacherScope,
                                        levels: current.teacherScope.levels.includes(option.value)
                                          ? current.teacherScope.levels.filter((item) => item !== option.value)
                                          : [...current.teacherScope.levels, option.value]
                                      }
                                    }))
                                  }
                                />
                                <span>{option.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="full">
                          <p className="field-label">¿En qué modalidad haces clases?</p>
                          <div className="onboarding-checkbox-grid onboarding-checkbox-grid-compact">
                            {TEACHER_MODE_OPTIONS.map((option) => (
                              <label key={option.value} className="onboarding-check-card">
                                <input
                                  type="checkbox"
                                  checked={draft.teacherScope.modes.includes(option.value)}
                                  onChange={() =>
                                    setDraft((current) => ({
                                      ...current,
                                      teacherScope: {
                                        ...current.teacherScope,
                                        modes: current.teacherScope.modes.includes(option.value)
                                          ? current.teacherScope.modes.filter((item) => item !== option.value)
                                          : [...current.teacherScope.modes, option.value]
                                      }
                                    }))
                                  }
                                />
                                <span>{option.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : null}

                    {teacherScopeScreen === 3 ? (
                      <div className="full">
                        <p className="field-label">¿Qué tareas sí realizas?</p>
                        <div className="onboarding-task-checklist">
                          {TEACHER_TASK_INCLUDED_OPTIONS.map((task) => (
                            <label key={task.value} className={`onboarding-task-checklist-row ${draft.teacherScope.tasks_included.includes(task.value) ? "checked" : ""}`}>
                              <div>
                                <strong>{task.label}</strong>
                              </div>
                              <span className="onboarding-task-checklist-control">
                                <input
                                  type="checkbox"
                                  checked={draft.teacherScope.tasks_included.includes(task.value)}
                                  onChange={(event) => {
                                    setDraft((current) => ({
                                      ...current,
                                      teacherScope: {
                                        ...current.teacherScope,
                                        tasks_included: event.target.checked
                                          ? Array.from(new Set([...current.teacherScope.tasks_included, task.value]))
                                          : current.teacherScope.tasks_included.filter((item) => item !== task.value)
                                      }
                                    }));
                                  }}
                                />
                                <span className="onboarding-task-checklist-box" aria-hidden />
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {teacherScopeScreen === 4 ? (
                      <div className="full">
                        <p className="field-label">¿Qué tareas no realizas?</p>
                        <div className="onboarding-task-checklist">
                          {TEACHER_TASK_EXCLUDED_OPTIONS.map((task) => (
                            <label
                              key={task.value}
                              className={`onboarding-task-checklist-row onboarding-task-checklist-row-warning ${draft.teacherScope.tasks_excluded.includes(task.value) ? "checked" : ""}`}
                            >
                              <div>
                                <strong>{task.label}</strong>
                              </div>
                              <span className="onboarding-task-checklist-control">
                                <input
                                  type="checkbox"
                                  checked={draft.teacherScope.tasks_excluded.includes(task.value)}
                                  onChange={(event) => {
                                    setDraft((current) => ({
                                      ...current,
                                      teacherScope: {
                                        ...current.teacherScope,
                                        tasks_excluded: event.target.checked
                                          ? Array.from(new Set([...current.teacherScope.tasks_excluded, task.value]))
                                          : current.teacherScope.tasks_excluded.filter((item) => item !== task.value)
                                      }
                                    }));
                                  }}
                                />
                                <span className="onboarding-task-checklist-box" aria-hidden />
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {teacherScopeScreen === 5 ? (
                      <div className="full">
                        <label>
                          Condiciones especiales de tu servicio
                          <textarea
                            value={draft.teacherScope.special_conditions}
                            rows={4}
                            placeholder="Ejemplo: solo hago clases individuales, no preparo PAES y no hago clases grupales."
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                teacherScope: {
                                  ...current.teacherScope,
                                  special_conditions: event.target.value
                                }
                              }))
                            }
                          />
                        </label>
                      </div>
                    ) : null}

                    {teacherScopeScreen === 6 ? (
                      <div className="full onboarding-scope-review-grid">
                        <div className="auth-flow-note-card">
                          <strong>Asignaturas</strong>
                          <span>{teacherScopeServicesPreview.length > 0 ? teacherScopeServicesPreview.join(", ") : "Sin información aún."}</span>
                        </div>
                        <div className="auth-flow-note-card">
                          <strong>Niveles</strong>
                          <span>{teacherScopeLevelsPreview.length > 0 ? teacherScopeLevelsPreview.join(", ") : "Sin información aún."}</span>
                        </div>
                        <div className="auth-flow-note-card">
                          <strong>Modalidades</strong>
                          <span>{teacherScopeModesPreview.length > 0 ? teacherScopeModesPreview.join(", ") : "Sin información aún."}</span>
                        </div>
                        <div className="auth-flow-note-card">
                          <strong>Tareas que sí realiza</strong>
                          <span>{teacherScopeIncludedPreview.length > 0 ? teacherScopeIncludedPreview.join(", ") : "Sin información aún."}</span>
                        </div>
                        <div className="auth-flow-note-card">
                          <strong>Tareas que no realiza</strong>
                          <span>{teacherScopeExcludedPreview.length > 0 ? teacherScopeExcludedPreview.join(", ") : "No marcaste exclusiones."}</span>
                        </div>
                        <div className="auth-flow-note-card">
                          <strong>Condiciones especiales</strong>
                          <span>{draft.teacherScope.special_conditions.trim() || "No agregaste condiciones especiales."}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {draft.category === "personal-trainer" ? (
                  <div className="grid-form auth-flow-form">
                    <div className="full onboarding-scope-progress">
                      <span className={trainerScopeScreen >= 1 ? "active" : ""}>Servicios</span>
                      <span className={trainerScopeScreen >= 2 ? "active" : ""}>Modalidad</span>
                      <span className={trainerScopeScreen >= 3 ? "active" : ""}>Sí realiza</span>
                      <span className={trainerScopeScreen >= 4 ? "active" : ""}>No realiza</span>
                      <span className={trainerScopeScreen >= 5 ? "active" : ""}>Condiciones</span>
                      <span className={trainerScopeScreen >= 6 ? "active" : ""}>Revisión</span>
                    </div>

                    {trainerScopeScreen === 1 ? (
                      <div className="full">
                        <p className="field-label">¿Qué tipos de entrenamiento ofreces?</p>
                        <div className="auth-service-grid auth-service-grid-cleaning">
                          {TRAINER_SCOPE_SERVICE_OPTIONS.map((service) => (
                            <label
                              key={service.value}
                              className={`auth-service-card auth-service-card-scope ${draft.trainerScope.services_offered.includes(service.value) ? "active" : ""}`}
                            >
                              <input
                                type="checkbox"
                                checked={draft.trainerScope.services_offered.includes(service.value)}
                                onChange={(event) => {
                                  setDraft((current) => ({
                                    ...current,
                                    trainerScope: {
                                      ...current.trainerScope,
                                      services_offered: event.target.checked
                                        ? Array.from(new Set([...current.trainerScope.services_offered, service.value]))
                                        : current.trainerScope.services_offered.filter((item) => item !== service.value)
                                    }
                                  }));
                                }}
                              />
                              <strong>{service.label}</strong>
                              <span>{service.description}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {trainerScopeScreen === 2 ? (
                      <>
                        <div className="full">
                          <p className="field-label">¿En qué modalidad trabajas?</p>
                          <div className="onboarding-checkbox-grid onboarding-checkbox-grid-compact">
                            {TRAINER_MODE_OPTIONS.map((option) => (
                              <label key={option.value} className="onboarding-check-card">
                                <input
                                  type="checkbox"
                                  checked={draft.trainerScope.modes.includes(option.value)}
                                  onChange={() =>
                                    setDraft((current) => ({
                                      ...current,
                                      trainerScope: {
                                        ...current.trainerScope,
                                        modes: current.trainerScope.modes.includes(option.value)
                                          ? current.trainerScope.modes.filter((item) => item !== option.value)
                                          : [...current.trainerScope.modes, option.value]
                                      }
                                    }))
                                  }
                                />
                                <span>{option.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <label>
                          ¿Llevas implementos o equipamiento?
                          <select
                            value={draft.trainerScope.brings_equipment == null ? "" : draft.trainerScope.brings_equipment ? "si" : "no"}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                trainerScope: {
                                  ...current.trainerScope,
                                  brings_equipment: event.target.value === "" ? null : event.target.value === "si"
                                }
                              }))
                            }
                          >
                            <option value="">Selecciona</option>
                            <option value="si">Sí</option>
                            <option value="no">No</option>
                          </select>
                        </label>
                      </>
                    ) : null}

                    {trainerScopeScreen === 3 ? (
                      <div className="full">
                        <p className="field-label">¿Qué tareas sí realizas?</p>
                        <div className="onboarding-task-checklist">
                          {TRAINER_TASK_INCLUDED_OPTIONS.map((task) => (
                            <label key={task.value} className={`onboarding-task-checklist-row ${draft.trainerScope.tasks_included.includes(task.value) ? "checked" : ""}`}>
                              <div>
                                <strong>{task.label}</strong>
                              </div>
                              <span className="onboarding-task-checklist-control">
                                <input
                                  type="checkbox"
                                  checked={draft.trainerScope.tasks_included.includes(task.value)}
                                  onChange={(event) => {
                                    setDraft((current) => ({
                                      ...current,
                                      trainerScope: {
                                        ...current.trainerScope,
                                        tasks_included: event.target.checked
                                          ? Array.from(new Set([...current.trainerScope.tasks_included, task.value]))
                                          : current.trainerScope.tasks_included.filter((item) => item !== task.value)
                                      }
                                    }));
                                  }}
                                />
                                <span className="onboarding-task-checklist-box" aria-hidden />
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {trainerScopeScreen === 4 ? (
                      <div className="full">
                        <p className="field-label">¿Qué tareas no realizas?</p>
                        <div className="onboarding-task-checklist">
                          {TRAINER_TASK_EXCLUDED_OPTIONS.map((task) => (
                            <label
                              key={task.value}
                              className={`onboarding-task-checklist-row onboarding-task-checklist-row-warning ${draft.trainerScope.tasks_excluded.includes(task.value) ? "checked" : ""}`}
                            >
                              <div>
                                <strong>{task.label}</strong>
                              </div>
                              <span className="onboarding-task-checklist-control">
                                <input
                                  type="checkbox"
                                  checked={draft.trainerScope.tasks_excluded.includes(task.value)}
                                  onChange={(event) => {
                                    setDraft((current) => ({
                                      ...current,
                                      trainerScope: {
                                        ...current.trainerScope,
                                        tasks_excluded: event.target.checked
                                          ? Array.from(new Set([...current.trainerScope.tasks_excluded, task.value]))
                                          : current.trainerScope.tasks_excluded.filter((item) => item !== task.value)
                                      }
                                    }));
                                  }}
                                />
                                <span className="onboarding-task-checklist-box" aria-hidden />
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {trainerScopeScreen === 5 ? (
                      <div className="full">
                        <label>
                          Condiciones especiales de tu servicio
                          <textarea
                            value={draft.trainerScope.special_conditions}
                            rows={4}
                            placeholder="Ejemplo: trabajo solo con adultos, necesito espacio mínimo para entrenar y no hago rehabilitación de lesiones."
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                trainerScope: {
                                  ...current.trainerScope,
                                  special_conditions: event.target.value
                                }
                              }))
                            }
                          />
                        </label>
                      </div>
                    ) : null}

                    {trainerScopeScreen === 6 ? (
                      <div className="full onboarding-scope-review-grid">
                        <div className="auth-flow-note-card">
                          <strong>Tipos de entrenamiento</strong>
                          <span>{trainerScopeServicesPreview.length > 0 ? trainerScopeServicesPreview.join(", ") : "Sin información aún."}</span>
                        </div>
                        <div className="auth-flow-note-card">
                          <strong>Modalidades</strong>
                          <span>{trainerScopeModesPreview.length > 0 ? trainerScopeModesPreview.join(", ") : "Sin información aún."}</span>
                        </div>
                        <div className="auth-flow-note-card">
                          <strong>Tareas que sí realiza</strong>
                          <span>{trainerScopeIncludedPreview.length > 0 ? trainerScopeIncludedPreview.join(", ") : "Sin información aún."}</span>
                        </div>
                        <div className="auth-flow-note-card">
                          <strong>Tareas que no realiza</strong>
                          <span>{trainerScopeExcludedPreview.length > 0 ? trainerScopeExcludedPreview.join(", ") : "No marcaste exclusiones."}</span>
                        </div>
                        <div className="auth-flow-note-card">
                          <strong>Lleva equipamiento</strong>
                          <span>{draft.trainerScope.brings_equipment == null ? "No informado." : draft.trainerScope.brings_equipment ? "Sí" : "No"}</span>
                        </div>
                        <div className="auth-flow-note-card">
                          <strong>Condiciones especiales</strong>
                          <span>{draft.trainerScope.special_conditions.trim() || "No agregaste condiciones especiales."}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {draft.category === "chef" ? (
                  <div className="grid-form auth-flow-form">
                    <div className="full">
                      <p className="field-label">¿Qué servicios de chef quieres ofrecer?</p>
                      <div className="auth-service-grid auth-service-grid-cleaning">
                        {CHEF_SERVICE_DEFINITIONS.map((service) => (
                          <label
                            key={service.slug}
                            className={`auth-service-card auth-service-card-scope ${draft.chefScope.services_offered.includes(service.slug) ? "active" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={draft.chefScope.services_offered.includes(service.slug)}
                              onChange={(event) => {
                                setDraft((current) => ({
                                  ...current,
                                  chefScope: {
                                    ...current.chefScope,
                                    services_offered: event.target.checked
                                      ? Array.from(new Set([...current.chefScope.services_offered, service.slug]))
                                      : current.chefScope.services_offered.filter((item) => item !== service.slug)
                                  }
                                }));
                              }}
                            />
                            <strong>{service.name}</strong>
                            <span>{service.forClients}</span>
                            <span>Duración estimada: {service.estimatedDurationLabel}</span>
                            <span>
                              Rango WeTask: <strong>${formatClp(service.recommendedMinClp)}</strong> a <strong>${formatClp(service.recommendedMaxClp)}</strong>
                            </span>
                            <span>Incluye: {service.includes.join(", ")}.</span>
                          </label>
                        ))}
                      </div>
                      <div className="auth-flow-note-card" style={{ marginTop: 16 }}>
                        <strong>Servicios estandarizados por WeTask</strong>
                        <span>El cliente verá estos servicios con duración estimada, qué incluye y un precio claro desde tu valor configurado.</span>
                      </div>
                    </div>

                    <div className="full">
                      <label>
                        Información importante para el cliente
                        <textarea
                          value={draft.chefScope.special_conditions}
                          rows={4}
                          placeholder="Ejemplo: los insumos se coordinan por separado, necesito cocina despejada y acceso a horno o parrilla según el servicio."
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              chefScope: {
                                ...current.chefScope,
                                special_conditions: event.target.value
                              }
                            }))
                          }
                        />
                      </label>
                    </div>

                    <div className="full onboarding-scope-review-grid">
                      <div className="auth-flow-note-card">
                        <strong>Servicios elegidos</strong>
                        <span>{chefScopeServicesPreview.length > 0 ? chefScopeServicesPreview.join(", ") : "Sin información aún."}</span>
                      </div>
                      <div className="auth-flow-note-card">
                        <strong>Modelo de precios</strong>
                        <span>En el siguiente paso definirás un precio por servicio dentro del rango permitido por WeTask.</span>
                      </div>
                      <div className="auth-flow-note-card">
                        <strong>Información importante</strong>
                        <span>{draft.chefScope.special_conditions.trim() || "No agregaste observaciones por ahora."}</span>
                      </div>
                    </div>
                  </div>
                ) : null}

                {draft.category === "maquillaje" ? (
                  <div className="grid-form auth-flow-form">
                    <div className="full onboarding-scope-progress">
                      <span className={makeupScopeScreen >= 1 ? "active" : ""}>Servicios</span>
                      <span className={makeupScopeScreen >= 2 ? "active" : ""}>Sí realiza</span>
                      <span className={makeupScopeScreen >= 3 ? "active" : ""}>No realiza</span>
                      <span className={makeupScopeScreen >= 4 ? "active" : ""}>Condiciones</span>
                      <span className={makeupScopeScreen >= 5 ? "active" : ""}>Revisión</span>
                    </div>

                    {makeupScopeScreen === 1 ? (
                      <>
                        <div className="full">
                          <p className="field-label">¿Qué tipos de maquillaje ofreces?</p>
                          <div className="auth-service-grid auth-service-grid-cleaning">
                            {MAKEUP_SCOPE_SERVICE_OPTIONS.map((option) => (
                              <label
                                key={option.value}
                                className={`auth-service-card auth-service-card-scope ${draft.makeupScope.services_offered.includes(option.value) ? "active" : ""}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={draft.makeupScope.services_offered.includes(option.value)}
                                  onChange={(event) => {
                                    setDraft((current) => ({
                                      ...current,
                                      makeupScope: {
                                        ...current.makeupScope,
                                        services_offered: event.target.checked
                                          ? Array.from(new Set([...current.makeupScope.services_offered, option.value]))
                                          : current.makeupScope.services_offered.filter((item) => item !== option.value)
                                      }
                                    }));
                                  }}
                                />
                                <strong>{option.label}</strong>
                                <span>{option.description}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="full auth-flow-note-card">
                          <strong>Atención a domicilio</strong>
                          <span>En WeTask, maquillaje se considera siempre un servicio a domicilio.</span>
                        </div>
                      </>
                    ) : null}

                    {makeupScopeScreen === 2 ? (
                      <>
                        <div className="full">
                          <p className="field-label">¿Qué tareas sí realizas?</p>
                          <div className="onboarding-task-checklist">
                            {MAKEUP_TASK_INCLUDED_OPTIONS.map((task) => (
                              <label key={task.value} className={`onboarding-task-checklist-row ${draft.makeupScope.tasks_included.includes(task.value) ? "checked" : ""}`}>
                                <div>
                                  <strong>{task.label}</strong>
                                </div>
                                <span className="onboarding-task-checklist-control">
                                  <input
                                    type="checkbox"
                                    checked={draft.makeupScope.tasks_included.includes(task.value)}
                                    onChange={(event) => {
                                      setDraft((current) => ({
                                        ...current,
                                        makeupScope: {
                                          ...current.makeupScope,
                                          tasks_included: event.target.checked
                                            ? Array.from(new Set([...current.makeupScope.tasks_included, task.value]))
                                            : current.makeupScope.tasks_included.filter((item) => item !== task.value)
                                        }
                                      }));
                                    }}
                                  />
                                  <span className="onboarding-task-checklist-box" aria-hidden />
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <label>
                          ¿Incluye kit de maquillaje?
                          <select
                            value={draft.makeupScope.includes_kit == null ? "" : draft.makeupScope.includes_kit ? "si" : "no"}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                makeupScope: {
                                  ...current.makeupScope,
                                  includes_kit: event.target.value === "" ? null : event.target.value === "si"
                                }
                              }))
                            }
                          >
                            <option value="">Selecciona</option>
                            <option value="si">Sí</option>
                            <option value="no">No</option>
                          </select>
                        </label>
                      </>
                    ) : null}

                    {makeupScopeScreen === 3 ? (
                      <div className="full">
                        <p className="field-label">¿Qué tareas no realizas?</p>
                        <div className="onboarding-task-checklist">
                          {MAKEUP_TASK_EXCLUDED_OPTIONS.map((task) => (
                            <label
                              key={task.value}
                              className={`onboarding-task-checklist-row onboarding-task-checklist-row-warning ${draft.makeupScope.tasks_excluded.includes(task.value) ? "checked" : ""}`}
                            >
                              <div>
                                <strong>{task.label}</strong>
                              </div>
                              <span className="onboarding-task-checklist-control">
                                <input
                                  type="checkbox"
                                  checked={draft.makeupScope.tasks_excluded.includes(task.value)}
                                  onChange={(event) => {
                                    setDraft((current) => ({
                                      ...current,
                                      makeupScope: {
                                        ...current.makeupScope,
                                        tasks_excluded: event.target.checked
                                          ? Array.from(new Set([...current.makeupScope.tasks_excluded, task.value]))
                                          : current.makeupScope.tasks_excluded.filter((item) => item !== task.value)
                                      }
                                    }));
                                  }}
                                />
                                <span className="onboarding-task-checklist-box" aria-hidden />
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {makeupScopeScreen === 4 ? (
                      <div className="full">
                        <label>
                          Condiciones especiales de tu servicio
                          <textarea
                            value={draft.makeupScope.special_conditions}
                            rows={4}
                            placeholder="Ejemplo: las pruebas de novia se agendan aparte, no hago grupos grandes y el traslado fuera de comuna tiene recargo."
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                makeupScope: {
                                  ...current.makeupScope,
                                  special_conditions: event.target.value
                                }
                              }))
                            }
                          />
                        </label>
                      </div>
                    ) : null}

                    {makeupScopeScreen === 5 ? (
                      <div className="full onboarding-scope-review-grid">
                        <div className="auth-flow-note-card">
                          <strong>Tipos de maquillaje</strong>
                          <span>{makeupScopeServicesPreview.length > 0 ? makeupScopeServicesPreview.join(", ") : "Sin información aún."}</span>
                        </div>
                        <div className="auth-flow-note-card">
                          <strong>Tareas que sí realiza</strong>
                          <span>{makeupScopeIncludedPreview.length > 0 ? makeupScopeIncludedPreview.join(", ") : "Sin información aún."}</span>
                        </div>
                        <div className="auth-flow-note-card">
                          <strong>Tareas que no realiza</strong>
                          <span>{makeupScopeExcludedPreview.length > 0 ? makeupScopeExcludedPreview.join(", ") : "No marcaste exclusiones."}</span>
                        </div>
                        <div className="auth-flow-note-card">
                          <strong>Incluye kit</strong>
                          <span>{draft.makeupScope.includes_kit == null ? "No informado." : draft.makeupScope.includes_kit ? "Sí" : "No"}</span>
                        </div>
                        <div className="auth-flow-note-card">
                          <strong>Condiciones especiales</strong>
                          <span>{draft.makeupScope.special_conditions.trim() || "No agregaste condiciones especiales."}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {draft.category === "planchado" ? (
                  <div className="grid-form auth-flow-form">
                    <div className="full service-prep-card service-prep-card-tight">
                      <div className="panel-head">
                        <h3>Modalidad de tu servicio</h3>
                        <p>Define cómo quieres trabajar este servicio. En WeTask el planchado se publica solo por hora.</p>
                      </div>

                      <div className="auth-service-grid auth-service-grid-cleaning">
                        {IRONING_SCOPE_SERVICE_OPTIONS.map((option) => (
                          <label
                            key={option.value}
                            className={`auth-service-card auth-service-card-scope ${draft.ironingScope.services_offered.includes(option.value) ? "active" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={draft.ironingScope.services_offered.includes(option.value)}
                              onChange={(event) => {
                                setDraft((current) => ({
                                  ...current,
                                  ironingScope: {
                                    ...current.ironingScope,
                                    services_offered: event.target.checked
                                      ? Array.from(new Set([...current.ironingScope.services_offered, option.value]))
                                      : current.ironingScope.services_offered.filter((item) => item !== option.value)
                                  }
                                }));
                              }}
                            />
                            <strong>{option.label}</strong>
                            <span>{option.description}</span>
                          </label>
                        ))}
                      </div>

                      <div className="service-duration-toggles">
                        <label className={`onboarding-check-card ${draft.ironingScope.delicate_clothes === true ? "active" : ""}`}>
                          <input
                            type="checkbox"
                            checked={draft.ironingScope.delicate_clothes === true}
                            onChange={() =>
                              setDraft((current) => ({
                                ...current,
                                ironingScope: {
                                  ...current.ironingScope,
                                  delicate_clothes: current.ironingScope.delicate_clothes === true ? false : true
                                }
                              }))
                            }
                          />
                          <span>También tomo ropa delicada</span>
                        </label>
                      </div>

                      <div className="auth-flow-note-card auth-flow-note-card-compact">
                        <strong>Cómo se publica</strong>
                        <span>Este servicio se publica siempre por hora. Más adelante podrás editar tu valor por hora desde tu perfil.</span>
                      </div>

                      <div className="auth-flow-note-card auth-flow-note-card-compact">
                        <strong>Resumen</strong>
                        <span>{ironingScopeServicesPreview.length > 0 ? ironingScopeServicesPreview.join(", ") : "Selecciona al menos una modalidad para continuar."}</span>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="auth-flow-actions">
                  {draft.category === "limpieza" && cleaningScopeScreen > 1 ? (
                    <button type="button" className="cta ghost" onClick={previousCleaningScopeScreen}>
                      Volver
                    </button>
                  ) : draft.category === "mascotas" && petScopeScreen > 1 ? (
                    <button type="button" className="cta ghost" onClick={previousPetScopeScreen}>
                      Volver
                    </button>
                  ) : draft.category === "maquillaje" && makeupScopeScreen > 1 ? (
                    <button type="button" className="cta ghost" onClick={previousMakeupScopeScreen}>
                      Volver
                    </button>
                  ) : draft.category === "babysitter" && babysitterScopeScreen > 1 ? (
                    <button type="button" className="cta ghost" onClick={previousBabysitterScopeScreen}>
                      Volver
                    </button>
                  ) : draft.category === "profesor-particular" && teacherScopeScreen > 1 ? (
                    <button type="button" className="cta ghost" onClick={previousTeacherScopeScreen}>
                      Volver
                    </button>
                  ) : draft.category === "personal-trainer" && trainerScopeScreen > 1 ? (
                    <button type="button" className="cta ghost" onClick={previousTrainerScopeScreen}>
                      Volver
                    </button>
                  ) : (
                    <button type="button" className="cta ghost" onClick={previousStep}>
                      Volver
                    </button>
                  )}
                  {draft.category === "limpieza" && cleaningScopeScreen < 5 ? (
                    <button type="button" className="cta" onClick={continueCleaningScopeScreen}>
                      Siguiente
                    </button>
                  ) : draft.category === "mascotas" && petScopeScreen < 6 ? (
                    <button type="button" className="cta" onClick={continuePetScopeScreen}>
                      Siguiente
                    </button>
                  ) : draft.category === "maquillaje" && makeupScopeScreen < 5 ? (
                    <button type="button" className="cta" onClick={continueMakeupScopeScreen}>
                      Siguiente
                    </button>
                  ) : draft.category === "babysitter" && babysitterScopeScreen < 6 ? (
                    <button type="button" className="cta" onClick={continueBabysitterScopeScreen}>
                      Siguiente
                    </button>
                  ) : draft.category === "profesor-particular" && teacherScopeScreen < 6 ? (
                    <button type="button" className="cta" onClick={continueTeacherScopeScreen}>
                      Siguiente
                    </button>
                  ) : draft.category === "personal-trainer" && trainerScopeScreen < 6 ? (
                    <button type="button" className="cta" onClick={continueTrainerScopeScreen}>
                      Siguiente
                    </button>
                  ) : (
                    <button type="button" className="cta" onClick={continueStep7} disabled={saving}>
                      {saving ? "Guardando..." : "Continuar"}
                    </button>
                  )}
                </div>
              </div>
            ) : null}

            {activeStep === 8 ? (
              <div className="onboarding-screen">
                <h3>Disponibilidad</h3>
                <div className="pro-availability-shell onboarding-availability-shell">
                  <div className="pro-availability-overview">
                    <article className="availability-stat-card tone-indigo">
                      <span>Bloques semanales</span>
                      <strong>{totalAvailabilityBlocks}</strong>
                      <p>franjas recurrentes activas</p>
                    </article>
                    <article className="availability-stat-card tone-peach">
                      <span>Días activos</span>
                      <strong>{activeAvailabilityDays}</strong>
                      <p>jornadas con horarios publicados</p>
                    </article>
                    <article className="availability-stat-card tone-sky">
                      <span>Horarios del día</span>
                      <strong>{selectedDayConfig?.blocks.length ?? 0}</strong>
                      <p>bloque(s) en {selectedDayConfig?.label.toLowerCase() ?? "tu día"}</p>
                    </article>
                  </div>

                  <div className="availability-board-card onboarding-board-card">
                    <div className="availability-board-head">
                      <div>
                        <p className="availability-eyebrow">Resumen semanal</p>
                        <h3>Así se va a ver tu semana base</h3>
                      </div>
                      <span className="availability-board-chip">{totalAvailabilityBlocks} bloque(s) que se repiten</span>
                    </div>

                    <div className="onboarding-week-grid">
                      {groupedBlocks.map((day) => {
                        const isSelected = day.key === selectedAvailabilityDay;
                        return (
                          <button
                            key={day.key}
                            type="button"
                            className={`availability-day-card onboarding-week-card ${isSelected ? "selected" : ""}`}
                            onClick={() => selectAvailabilityDay(day.key)}
                          >
                            <span className="availability-day-number">{day.label}</span>
                            <span className="availability-day-meta">
                              {day.blocks.length > 0 ? `${day.blocks.length} bloque(s)` : "Sin bloques"}
                            </span>
                            <span className="availability-day-dots" aria-hidden>
                              {day.blocks.length > 0 ? <span className="availability-dot free" /> : <span className="availability-dot" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="availability-task-panel" ref={availabilityTaskPanelRef} tabIndex={-1}>
                      <div className="availability-task-head">
                        <div>
                          <p className="availability-eyebrow">Editar un día</p>
                          <h4>{selectedDayConfig?.label ?? "Sin día seleccionado"}</h4>
                        </div>
                        <span className="availability-selected-pill">{selectedDayConfig?.blocks.length ?? 0} bloque(s)</span>
                      </div>

                      {!selectedDayConfig || selectedDayConfig.blocks.length === 0 ? (
                        <div className="availability-empty-state">
                          <strong>No tienes horarios cargados para este día.</strong>
                          <p>Puedes agregar un bloque nuevo para empezar a recibir reservas en esta jornada.</p>
                        </div>
                      ) : (
                        <div className="availability-task-list">
                          {selectedDayConfig.blocks.map((block) => (
                            <article key={block.index} className="availability-task-item open onboarding-task-item">
                              <div className="availability-task-copy">
                                <strong>Bloque horario</strong>
                                <p>Define desde qué hora hasta qué hora quieres estar disponible.</p>
                              </div>
                              <div className="onboarding-time-row">
                                <select value={block.start} onChange={(event) => updateAvailabilityBlock(block.index, { start: event.target.value })}>
                                  {AVAILABILITY_TIME_OPTIONS.map((time) => (
                                    <option key={time} value={time}>
                                      {time}
                                    </option>
                                  ))}
                                </select>
                                <span>–</span>
                                <select value={block.end} onChange={(event) => updateAvailabilityBlock(block.index, { end: event.target.value })}>
                                  {AVAILABILITY_TIME_OPTIONS.map((time) => (
                                    <option key={time} value={time}>
                                      {time}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="availability-task-actions">
                                <button type="button" className="cta ghost small" onClick={() => removeAvailabilityBlock(block.index)}>
                                  Quitar
                                </button>
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <aside className="pro-availability-sidebar">
                    <div className="availability-composer-card">
                      <div className="availability-composer-head">
                        <div>
                          <p className="availability-eyebrow">Tu semana de trabajo</p>
                          <h3>{bulkAvailabilityDays.length > 1 ? `${bulkAvailabilityDays.length} días seleccionados` : selectedDayConfig?.label ?? "Selecciona uno o más días"}</h3>
                        </div>
                        <span className="availability-selected-pill">Se repite cada semana</span>
                      </div>

                      <p className="input-hint">
                        Marca los días que trabajas, elige un rango horario y crea tu semana base. Estos horarios se repetirán todas las
                        semanas y luego podrás bloquear fechas puntuales desde tu perfil si algún día no quieres trabajar.
                      </p>

                      <div className="availability-day-toggle-grid">
                        {DAY_OPTIONS.map((day) => (
                          <button
                            key={day.key}
                            type="button"
                            className={`availability-day-toggle ${bulkAvailabilityDays.includes(day.key) ? "active" : ""}`}
                            onClick={() => toggleBulkAvailabilityDay(day.key)}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>

                      <div className="onboarding-time-row">
                        <select value={newAvailabilityStart} onChange={(event) => setNewAvailabilityStart(event.target.value)}>
                          {AVAILABILITY_TIME_OPTIONS.map((time) => (
                            <option key={time} value={time}>
                              {time}
                            </option>
                          ))}
                        </select>
                        <span>–</span>
                        <select value={newAvailabilityEnd} onChange={(event) => setNewAvailabilityEnd(event.target.value)}>
                          {AVAILABILITY_TIME_OPTIONS.map((time) => (
                            <option key={time} value={time}>
                              {time}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="cta-row availability-form-actions">
                        <button type="button" className="cta" onClick={() => addAvailabilityBlock(bulkAvailabilityDays)}>
                          Agregar bloque a {bulkAvailabilityDays.length > 1 ? `${bulkAvailabilityDays.length} días` : selectedDayConfig?.label ?? "este día"}
                        </button>
                      </div>
                    </div>
                  </aside>
                </div>
                <div className="auth-flow-actions">
                  <button type="button" className="cta ghost" onClick={previousStep}>
                    Volver
                  </button>
                  <button type="button" className="cta" onClick={continueStep8} disabled={saving}>
                    {saving ? "Guardando..." : "Continuar"}
                  </button>
                </div>
              </div>
            ) : null}

            {activeStep === 9 ? (
              <div className="onboarding-screen">
                <h3>Tarifas</h3>
                <div className="auth-flow-note-card">
                  <strong>Referencia para {pricingGuide.title}</strong>
                  <span>
                    {draft.category === "chef"
                      ? (
                        <>
                          En Chef a domicilio trabajas con servicios estandarizados por WeTask. Cada uno tiene un rango permitido entre{" "}
                          <strong>${formatClp(pricingGuide.min)}</strong> y <strong>${formatClp(pricingGuide.max)}</strong> por servicio.
                        </>
                      )
                      : (
                        <>
                          En WeTask, para este servicio suele funcionar un rango de <strong>${formatClp(pricingGuide.min)}</strong> a{" "}
                          <strong>${formatClp(pricingGuide.max)}</strong> por hora.
                        </>
                      )}
                  </span>
                  <span>{pricingGuide.note}</span>
                  {pricingGuide.extras.length > 0 ? (
                    <span>{pricingGuide.extras.join(" ")}</span>
                  ) : null}
                </div>
                <div className="grid-form auth-flow-form">
                  {draft.category === "limpieza" ? (
                    <div className="full cleaning-rate-grid">
                      {selectedCleaningServiceDefinitions(draft).map((service) => (
                        <label key={service.slug} className="auth-flow-note-card cleaning-rate-card">
                          <strong>{service.name}</strong>
                          <span>{service.description}</span>
                          <span>
                            Rango sugerido: <strong>${formatClp(service.recommendedMinClp)}</strong> a{" "}
                            <strong>${formatClp(service.recommendedMaxClp)}</strong> por hora.
                          </span>
                          <input
                            value={draft.cleaningServiceRates[service.slug] ?? ""}
                            onChange={(event) => {
                              const value = event.target.value.replace(/\D/g, "");
                              setDraft((current) => ({
                                ...current,
                                cleaningServiceRates: {
                                  ...current.cleaningServiceRates,
                                  [service.slug]: value
                                },
                                hourlyRate: service.slug === "limpieza-hogar" ? value : current.hourlyRate
                              }));
                            }}
                            placeholder={String(service.recommendedMinClp)}
                          />
                        </label>
                      ))}
                    </div>
                  ) : draft.category === "chef" ? (
                    <div className="full cleaning-rate-grid">
                      {selectedChefServiceDefinitions(draft).map((service) => (
                        <label key={service.slug} className="auth-flow-note-card cleaning-rate-card">
                          <strong>{service.name}</strong>
                          <span>{service.forClients}</span>
                          <span>
                            Incluye: {service.includes.join(", ")}.
                          </span>
                          <span>Duración estimada: {service.estimatedDurationLabel}</span>
                          <span>
                            Rango permitido: <strong>${formatClp(service.recommendedMinClp)}</strong> a{" "}
                            <strong>${formatClp(service.recommendedMaxClp)}</strong> por servicio.
                          </span>
                          <input
                            value={draft.chefServiceRates[service.slug] ?? ""}
                            onChange={(event) => {
                              const value = event.target.value.replace(/\D/g, "");
                              setDraft((current) => ({
                                ...current,
                                chefServiceRates: {
                                  ...current.chefServiceRates,
                                  [service.slug]: value
                                },
                                hourlyRate: service.slug === "meal-prep-semanal" ? value : current.hourlyRate
                              }));
                            }}
                            placeholder={String(service.recommendedMinClp)}
                          />
                          <small className="input-hint">Tu precio debe quedar dentro de ese rango para publicar este servicio.</small>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <label>
                      Tarifa por hora
                      <input value={draft.hourlyRate} onChange={(event) => updateDraft("hourlyRate", event.target.value.replace(/\D/g, ""))} placeholder="15000" />
                    </label>
                  )}
                  {draft.category !== "chef" ? (
                    <label>
                      Mínimo de horas por servicio
                      <input value={draft.minimumHours} onChange={(event) => updateDraft("minimumHours", event.target.value.replace(/\D/g, ""))} placeholder="2" />
                    </label>
                  ) : null}
                  <label>
                    Recargo fin de semana
                    <select value={draft.hasWeekendSurcharge ? "si" : "no"} onChange={(event) => updateDraft("hasWeekendSurcharge", event.target.value === "si")}>
                      <option value="no">No</option>
                      <option value="si">Sí</option>
                    </select>
                  </label>
                  {draft.hasWeekendSurcharge ? (
                    <label>
                      Porcentaje fin de semana
                      <div className="input-with-suffix">
                        <input
                          value={draft.weekendSurchargePct}
                          onChange={(event) => updateDraft("weekendSurchargePct", event.target.value.replace(/\D/g, ""))}
                          placeholder="20"
                        />
                        <span>%</span>
                      </div>
                    </label>
                  ) : null}
                  <label>
                    Recargo festivos
                    <select value={draft.hasHolidaySurcharge ? "si" : "no"} onChange={(event) => updateDraft("hasHolidaySurcharge", event.target.value === "si")}>
                      <option value="no">No</option>
                      <option value="si">Sí</option>
                    </select>
                  </label>
                  {draft.hasHolidaySurcharge ? (
                    <label>
                      Porcentaje festivos
                      <div className="input-with-suffix">
                        <input
                          value={draft.holidaySurchargePct}
                          onChange={(event) => updateDraft("holidaySurchargePct", event.target.value.replace(/\D/g, ""))}
                          placeholder="20"
                        />
                        <span>%</span>
                      </div>
                    </label>
                  ) : null}
                </div>
                {chicureoSelected ? <p className="onboarding-warning">Se aplicará un recargo fijo sugerido para Chicureo.</p> : null}
                <div className="auth-flow-actions">
                  <button type="button" className="cta ghost" onClick={previousStep}>
                    Volver
                  </button>
                  <button type="button" className="cta" onClick={continueStep9} disabled={saving}>
                    {saving ? "Guardando..." : "Continuar"}
                  </button>
                </div>
              </div>
            ) : null}

            {activeStep === 10 ? (
              <div className="onboarding-screen">
                <h3>Cuenta bancaria</h3>
                <div className="auth-flow-note-card">
                  <strong>Verificación manual del perfil</strong>
                  <span>
                    Hoy la verificación del tasker sigue siendo manual. Para revisar tu perfil necesitamos el carnet por ambos lados y
                    tu certificado de antecedentes.
                  </span>
                </div>
                <div className="grid-form auth-flow-form">
                  <label>
                    Banco
                    <select value={draft.bankName} onChange={(event) => updateDraft("bankName", event.target.value)}>
                      {BANK_OPTIONS.map((bank) => (
                        <option key={bank} value={bank}>
                          {bank}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Tipo de cuenta
                    <select
                      value={draft.bankAccountType}
                      onChange={(event) => updateDraft("bankAccountType", event.target.value as DraftState["bankAccountType"])}
                    >
                      <option value="cuenta_corriente">Cuenta Corriente</option>
                      <option value="cuenta_vista">Cuenta Vista</option>
                      <option value="cuenta_rut">Cuenta RUT</option>
                      <option value="cuenta_ahorro">Cuenta de Ahorro</option>
                    </select>
                  </label>
                  <label>
                    Número de cuenta
                    <input
                      value={draft.bankAccountNumber}
                      onChange={(event) => updateDraft("bankAccountNumber", event.target.value.replace(/\D/g, ""))}
                      placeholder="Solo números"
                      readOnly={draft.bankAccountType === "cuenta_rut"}
                    />
                    {draft.bankAccountType === "cuenta_rut" ? (
                      <p className="input-hint">Para Cuenta RUT usamos automáticamente tu RUT sin dígito verificador.</p>
                    ) : null}
                  </label>
                  <label className="full">
                    Carnet por delante
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        try {
                          const key = await uploadAssetViaPresign({ source: file, kind: "identity_front" });
                          if (key) {
                            updateDraft("identityDocumentFrontFile", key);
                          } else {
                            const content = await fileToDataUrl(file);
                            updateDraft("identityDocumentFrontFile", content);
                          }
                        } catch (err) {
                          alert(err instanceof Error ? err.message : "No se pudo subir el archivo");
                        }
                      }}
                    />
                    {draft.identityDocumentFrontFile ? <p className="input-hint">Archivo cargado correctamente.</p> : null}
                  </label>
                  <label className="full">
                    Carnet por atrás
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        try {
                          const key = await uploadAssetViaPresign({ source: file, kind: "identity_back" });
                          if (key) {
                            updateDraft("identityDocumentBackFile", key);
                          } else {
                            const content = await fileToDataUrl(file);
                            updateDraft("identityDocumentBackFile", content);
                          }
                        } catch (err) {
                          alert(err instanceof Error ? err.message : "No se pudo subir el archivo");
                        }
                      }}
                    />
                    {draft.identityDocumentBackFile ? <p className="input-hint">Archivo cargado correctamente.</p> : null}
                  </label>
                  <label className="full">
                    Certificado de antecedentes
                    <input
                      type="file"
                      accept=".pdf,image/png,image/jpeg"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        try {
                          const key = await uploadAssetViaPresign({ source: file, kind: "criminal_record" });
                          if (key) {
                            updateDraft("criminalRecordFile", key);
                          } else {
                            const content = await fileToDataUrl(file);
                            updateDraft("criminalRecordFile", content);
                          }
                        } catch (err) {
                          alert(err instanceof Error ? err.message : "No se pudo subir el archivo");
                        }
                      }}
                    />
                    {draft.criminalRecordFile ? <p className="input-hint">Archivo cargado correctamente.</p> : null}
                  </label>
                  <label>
                    RUT del titular
                    <input value={formatRutInput(draft.rut)} readOnly />
                    <p className="input-hint">Usamos automáticamente el mismo RUT que ingresaste al inicio del registro.</p>
                  </label>
                </div>
                <div className="auth-flow-actions">
                  <button type="button" className="cta ghost" onClick={previousStep}>
                    Volver
                  </button>
                  <button type="button" className="cta" onClick={continueStep10} disabled={saving}>
                    {saving ? "Guardando..." : "Continuar"}
                  </button>
                </div>
              </div>
            ) : null}

            {activeStep === 11 ? (
              <div className="onboarding-screen">
                <h3>Términos y condiciones</h3>
                <label className="auth-flow-checkbox">
                  <input type="checkbox" checked={draft.acceptedTerms} onChange={(event) => updateDraft("acceptedTerms", event.target.checked)} />
                  <span>Acepto los términos y condiciones de WeTask</span>
                </label>
                <div className="auth-flow-actions">
                  <button type="button" className="cta ghost" onClick={previousStep}>
                    Volver
                  </button>
                  <button type="button" className="cta" onClick={finalizeRegistration} disabled={saving}>
                    {saving ? "Finalizando..." : "Finalizar registro"}
                  </button>
                </div>
              </div>
            ) : null}

            {activeStep === 12 ? (
              <div className="onboarding-screen onboarding-success-screen">
                <h3>Registro completado</h3>
                <p>Tu perfil será revisado antes de activarse en la plataforma.</p>
                {onboarding?.adminReviewNotes ? <p className="onboarding-warning">{onboarding.adminReviewNotes}</p> : null}
                <div className="auth-flow-actions">
                  <Link href="/pro" className="cta">
                    Ir a mi perfil
                  </Link>
                </div>
              </div>
            ) : null}
          </section>
        </section>
      </div>
    </main>
  );
}

export default function CleaningOnboardingPage() {
  return (
    <Suspense fallback={<OnboardingLoadingScreen />}>
      <CleaningOnboardingPageContent />
    </Suspense>
  );
}
