"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { AuthHeroNav } from "@/components/auth-hero-nav";
import {
  CHEF_SERVICE_DEFINITIONS,
  type ChefServiceDefinition,
  type ChefServiceSlug,
  isChefServiceSlug
} from "@/lib/chef-service-types";
import {
  CLEANING_SERVICE_DEFINITIONS,
  type CleaningServiceDefinition,
  type CleaningServiceSlug,
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
  cleaningBringsProducts: boolean | null;
  cleaningBringsEquipment: boolean | null;
  petServiceType: Array<"paseo_perros" | "cuidado_casa_cliente" | "cuidado_en_tu_casa">;
  petAnimals: Array<"perros" | "gatos">;
  petLargePets: boolean | null;
  babysitterAgeRange: "0_2" | "3_6" | "7_plus";
  babysitterFirstAid: boolean | null;
  babysitterMultiChild: boolean | null;
  teacherSubject: "matematicas" | "ingles" | "lenguaje" | "ciencias" | "otra";
  teacherLevel: "basica" | "media" | "universitario";
  teacherMode: "presencial" | "online" | "ambas";
  trainerServiceType: "funcional" | "fuerza" | "perdida_peso" | "movilidad";
  trainerMode: "presencial" | "online" | "ambas";
  trainerBringsEquipment: boolean | null;
  makeupType: Array<"social" | "eventos" | "novias">;
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
      extras.push("En chef puedes definir una tarifa distinta por hora para cada tipo de servicio que ofrezcas.");
    }
    if (draft.chefServiceType.includes("cocina-gourmet")) {
      extras.push("Cocina gourmet suele quedar en la parte alta del rango por presentación y complejidad.");
    }
    if (draft.chefServiceType.includes("cocina-eventos") || draft.chefServiceType.includes("cumpleanos")) {
      extras.push("Eventos y cumpleaños suelen requerir más coordinación, por lo que pueden cobrar más por hora.");
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
    const items = value.filter((item): item is CleaningServiceSlug => typeof item === "string" && isCleaningServiceSlug(item));
    return items.length > 0 ? Array.from(new Set(items)) : ["limpieza-hogar"];
  }
  if (typeof value === "string" && isCleaningServiceSlug(value)) {
    return [value];
  }
  return ["limpieza-hogar"];
}

function selectedCleaningServiceDefinitions(draft: DraftState): CleaningServiceDefinition[] {
  return CLEANING_SERVICE_DEFINITIONS.filter((service) => draft.cleaningServices.includes(service.slug));
}

function deriveCleaningServicesFromScope(scope: CleaningScopeData): CleaningServiceSlug[] {
  const derived = scope.services_offered.filter(isCleaningServiceSlug);
  return derived.length > 0 ? Array.from(new Set(derived)) : ["limpieza-hogar"];
}

function selectedChefServiceDefinitions(draft: DraftState): ChefServiceDefinition[] {
  return CHEF_SERVICE_DEFINITIONS.filter((service) => draft.chefServiceType.includes(service.slug));
}

function normalizeMakeupTypes(value: unknown): Array<"social" | "eventos" | "novias"> {
  const allowed = new Set(["social", "eventos", "novias"]);
  if (Array.isArray(value)) {
    return value.filter((item): item is "social" | "eventos" | "novias" => typeof item === "string" && allowed.has(item));
  }
  if (typeof value === "string" && allowed.has(value)) {
    return [value as "social" | "eventos" | "novias"];
  }
  return ["social"];
}

function normalizeChefServiceTypes(value: unknown): ChefServiceSlug[] {
  if (Array.isArray(value)) {
    const items = value.filter((item): item is ChefServiceSlug => typeof item === "string" && isChefServiceSlug(item));
    return items.length > 0 ? Array.from(new Set(items)) : ["cocina-casera"];
  }
  if (typeof value === "string" && isChefServiceSlug(value)) {
    return [value];
  }
  return ["cocina-casera"];
}

function normalizePetServiceTypes(value: unknown): Array<"paseo_perros" | "cuidado_casa_cliente" | "cuidado_en_tu_casa"> {
  const allowed = new Set(["paseo_perros", "cuidado_casa_cliente", "cuidado_en_tu_casa"]);
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is "paseo_perros" | "cuidado_casa_cliente" | "cuidado_en_tu_casa" => typeof item === "string" && allowed.has(item)
    );
  }
  if (typeof value === "string" && allowed.has(value)) {
    return [value as "paseo_perros" | "cuidado_casa_cliente" | "cuidado_en_tu_casa"];
  }
  return ["paseo_perros"];
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
    cleaningServices: ["limpieza-hogar"],
    cleaningServiceRates: { "limpieza-hogar": "" },
    cleaningScope: emptyCleaningScope(),
    chefServiceType: ["cocina-casera"],
    chefServiceRates: { "cocina-casera": "" },
    cleaningBringsProducts: null,
    cleaningBringsEquipment: null,
    petServiceType: ["paseo_perros"],
    petAnimals: ["perros"],
    petLargePets: null,
    babysitterAgeRange: "0_2",
    babysitterFirstAid: null,
    babysitterMultiChild: null,
    teacherSubject: "matematicas",
    teacherLevel: "basica",
    teacherMode: "presencial",
    trainerServiceType: "funcional",
    trainerMode: "presencial",
    trainerBringsEquipment: null,
    makeupType: ["social"],
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
        acceptsHomesWithPets: draft.petLargePets
      };
    case "babysitter":
      return {
        offeredServices: ["babysitter_horas"],
        experienceTypes: [draft.babysitterAgeRange],
        bringsOwnTools: draft.babysitterFirstAid,
        acceptsHomesWithChildren: draft.babysitterMultiChild
      };
    case "profesor-particular":
      return {
        offeredServices: [draft.teacherSubject],
        experienceTypes: [draft.teacherLevel, draft.teacherMode]
      };
    case "personal-trainer":
      return {
        offeredServices: [draft.trainerServiceType],
        experienceTypes: [draft.trainerMode],
        bringsOwnTools: draft.trainerBringsEquipment
      };
    case "chef":
      return {
        offeredServices: draft.chefServiceType,
        experienceTypes: draft.chefServiceType,
        worksWithClientProducts: true
      };
    case "maquillaje":
      return {
        offeredServices: draft.makeupType,
        bringsOwnProducts: draft.makeupKit,
        worksWithClientProducts: true
      };
    case "planchado":
      return {
        offeredServices: [draft.ironingType],
        experienceTypes: ["por_hora"],
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
  const addressValidationRequestRef = useRef(0);
  const availabilityTaskPanelRef = useRef<HTMLDivElement | null>(null);

  const chicureoSelected = draft.homeCommune === "Chicureo" || draft.coverageCommunes.includes("Chicureo");
  const selectedCategoryLabel = CATEGORY_OPTIONS.find((option) => option.slug === draft.category)?.label ?? "Limpieza";
  const cleaningScopeServicesPreview = draft.cleaningScope.services_offered.map(getCleaningScopeServiceLabel);
  const cleaningScopeIncludedPreview = draft.cleaningScope.tasks_included.map(getCleaningIncludedTaskLabel);
  const cleaningScopeExcludedPreview = draft.cleaningScope.tasks_excluded.map(getCleaningExcludedTaskLabel);
  const pricingGuide = useMemo(() => getPricingGuide(draft), [draft]);
  const progressPercent = Math.round((activeStep / TOTAL_STEPS) * 100);
  const addressQuery = useMemo(() => [draft.address.trim(), "Santiago", "Chile"].filter(Boolean).join(", "), [draft.address]);
  const petSupportsCats = draft.petServiceType.some((item) => item !== "paseo_perros");
  const petAnimalOptions = (petSupportsCats ? ["perros", "gatos"] : ["perros"]) as Array<"perros" | "gatos">;
  const presetService = useMemo(() => {
    const service = searchParams.get("service");
    return CATEGORY_OPTIONS.some((option) => option.slug === service) ? (service as CategorySlug) : null;
  }, [searchParams]);

  useEffect(() => {
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
        chefServiceRates:
          parsed.chefServiceRates && typeof parsed.chefServiceRates === "object"
            ? (parsed.chefServiceRates as Partial<Record<ChefServiceSlug, string>>)
            : current.chefServiceRates,
        petServiceType: normalizePetServiceTypes(parsed.petServiceType),
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
    const nextAnimals: Array<"perros" | "gatos"> = filteredAnimals.length > 0 ? filteredAnimals : ["perros"];
    const servicesChanged = normalizedServices.join("|") !== draft.petServiceType.join("|");
    const animalsChanged = nextAnimals.join("|") !== draft.petAnimals.join("|");
    if (!servicesChanged && !animalsChanged) return;
    setDraft((current) => ({
      ...current,
      petServiceType: normalizedServices,
      petAnimals: nextAnimals
    }));
  }, [draft.petAnimals, draft.petServiceType]);

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
    const normalizedServices = normalizeChefServiceTypes(draft.chefServiceType);
    const nextRates = normalizedServices.reduce<Partial<Record<ChefServiceSlug, string>>>((acc, slug) => {
      acc[slug] = draft.chefServiceRates[slug] ?? "";
      return acc;
    }, {});
    const servicesChanged = normalizedServices.join("|") !== draft.chefServiceType.join("|");
    const ratesChanged = JSON.stringify(nextRates) !== JSON.stringify(draft.chefServiceRates);
    if (!servicesChanged && !ratesChanged) return;
    setDraft((current) => ({
      ...current,
      chefServiceType: normalizedServices,
      chefServiceRates: nextRates
    }));
  }, [draft.category, draft.chefServiceRates, draft.chefServiceType]);

  useEffect(() => {
    if (activeStep !== 7 || draft.category !== "limpieza") {
      setCleaningScopeScreen(1);
    }
  }, [activeStep, draft.category]);

  const hydrateFromServer = (nextOnboarding: OnboardingPayload, user?: { fullName?: string | null; email?: string | null; phone?: string | null }) => {
    const { firstName, lastName } = splitFullName(user?.fullName ?? session?.fullName ?? "");
    setOnboarding(nextOnboarding);
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
      chefServiceType: nextOnboarding.categorySlug === "chef" ? normalizeChefServiceTypes(nextOnboarding.offeredServices) : current.chefServiceType,
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
          if (Array.isArray(onboardingData.serviceRates) && onboardingData.serviceRates.length > 0) {
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
                serviceRates.find((item) => isChefServiceSlug(item.serviceSlug) && item.serviceSlug === "cocina-casera")?.hourlyRateClp?.toString() ??
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
  }, []);

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
      const response = await fetch("/api/onboarding/cleaning/phone/send", {
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
      const response = await fetch("/api/onboarding/cleaning/phone/verify", {
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
          profilePhotoUrl: draft.profilePhotoUrl
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
            profilePhotoUrl: draft.profilePhotoUrl
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
        setOnboarding(data.onboarding);
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
      await persistServerStep(8, { availabilityMode: draft.availabilityMode, availabilityBlocks: validBlocks });
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

    if (
      ((draft.category === "limpieza" || draft.category === "chef") && categoryRates.some((item) => !item.hourlyRateClp)) ||
      (draft.category !== "limpieza" && draft.category !== "chef" && !draft.hourlyRate.trim()) ||
      !draft.minimumHours.trim()
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
            ? chefRates.find((item) => item.serviceSlug === "cocina-casera")?.hourlyRateClp ??
              chefRates[0]?.hourlyRateClp ??
              Number(draft.hourlyRate || 0)
            : Number(draft.hourlyRate);
      await persistServerStep(9, {
        hourlyRateClp: fallbackRate,
        serviceRates: categoryRates,
        minBookingHours: Number(draft.minimumHours),
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

  const toggleCoverageCommune = (commune: ActiveMvpCommune) => {
    setDraft((current) => {
      const exists = current.coverageCommunes.includes(commune);
      return {
        ...current,
        coverageCommunes: exists ? current.coverageCommunes.filter((item) => item !== commune) : [...current.coverageCommunes, commune]
      };
    });
  };

  const selectAllCoverageCommunes = () => {
    setDraft((current) => ({
      ...current,
      coverageCommunes: [...COMMUNE_OPTIONS]
    }));
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
    const persistedStep = Math.max(1, Math.min(11, onboarding?.currentStep ?? 1));
    if (activeStep === 12) {
      return 11 as WizardStep;
    }
    return Math.max(persistedStep, Math.min(activeStep, 11)) as WizardStep;
  }, [activeStep, onboarding?.currentStep]);

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
                const isDone = item.step < activeStep || item.step <= (onboarding?.currentStep ?? 1);
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
                  <label className="full">
                    Dirección
                    <input
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
                    {autocompleteLoading ? <p className="input-hint">Buscando direcciones en Google...</p> : null}
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
                    <p className="input-hint">
                      {validatingAddress
                        ? "Estamos corroborando esta dirección con Google automáticamente."
                        : "La comuna se detecta automáticamente a partir de la dirección que ingreses."}
                    </p>
                  </label>
                  <label>
                    Foto de perfil
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        const content = await fileToDataUrl(file);
                        updateDraft("profilePhotoUrl", content);
                      }}
                    />
                  </label>
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
                <h3>¿En qué comunas quieres trabajar?</h3>
                <div className="auth-flow-actions">
                  <button type="button" className="cta ghost small" onClick={selectAllCoverageCommunes}>
                    Todas
                  </button>
                </div>
                <div className="onboarding-checkbox-grid">
                  {COMMUNE_OPTIONS.map((commune) => (
                    <label key={commune} className="onboarding-check-card">
                      <input
                        type="checkbox"
                        checked={draft.coverageCommunes.includes(commune)}
                        onChange={() => toggleCoverageCommune(commune)}
                      />
                      <span>{commune}</span>
                    </label>
                  ))}
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
                    <div className="full">
                      <p className="field-label">Tipo de servicio</p>
                      <div className="inline-checks">
                        {[
                          { value: "paseo_perros", label: "Paseo de perros" },
                          { value: "cuidado_casa_cliente", label: "Cuidado en casa del cliente" },
                          { value: "cuidado_en_tu_casa", label: "Cuidado en mi casa" }
                        ].map((option) => (
                          <label key={option.value}>
                            <input
                              type="checkbox"
                              checked={draft.petServiceType.includes(
                                option.value as "paseo_perros" | "cuidado_casa_cliente" | "cuidado_en_tu_casa"
                              )}
                              onChange={(event) => {
                                updateDraft(
                                  "petServiceType",
                                  event.target.checked
                                    ? Array.from(
                                        new Set([
                                          ...draft.petServiceType,
                                          option.value as "paseo_perros" | "cuidado_casa_cliente" | "cuidado_en_tu_casa"
                                        ])
                                      )
                                    : draft.petServiceType.filter((item) => item !== option.value)
                                );
                              }}
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="full">
                      <p className="field-label">Animales</p>
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
                        onChange={(event) => updateDraft("petLargePets", event.target.value === "si")}
                      >
                        <option value="">Selecciona</option>
                        <option value="si">Sí</option>
                        <option value="no">No</option>
                      </select>
                    </label>
                  </div>
                ) : null}

                {draft.category === "babysitter" ? (
                  <div className="grid-form auth-flow-form">
                    <label>
                      Edad mínima de niños
                      <select value={draft.babysitterAgeRange} onChange={(event) => updateDraft("babysitterAgeRange", event.target.value as DraftState["babysitterAgeRange"])}>
                        <option value="0_2">0-2 años</option>
                        <option value="3_6">3-6 años</option>
                        <option value="7_plus">7+</option>
                      </select>
                    </label>
                    <label>
                      ¿Sabes primeros auxilios?
                      <select
                        value={draft.babysitterFirstAid == null ? "" : draft.babysitterFirstAid ? "si" : "no"}
                        onChange={(event) => updateDraft("babysitterFirstAid", event.target.value === "si")}
                      >
                        <option value="">Selecciona</option>
                        <option value="si">Sí</option>
                        <option value="no">No</option>
                      </select>
                    </label>
                    <label>
                      ¿Puedes cuidar más de un niño?
                      <select
                        value={draft.babysitterMultiChild == null ? "" : draft.babysitterMultiChild ? "si" : "no"}
                        onChange={(event) => updateDraft("babysitterMultiChild", event.target.value === "si")}
                      >
                        <option value="">Selecciona</option>
                        <option value="si">Sí</option>
                        <option value="no">No</option>
                      </select>
                    </label>
                  </div>
                ) : null}

                {draft.category === "profesor-particular" ? (
                  <div className="grid-form auth-flow-form">
                    <label>
                      Asignatura
                      <select value={draft.teacherSubject} onChange={(event) => updateDraft("teacherSubject", event.target.value as DraftState["teacherSubject"])}>
                        <option value="matematicas">Matemáticas</option>
                        <option value="ingles">Inglés</option>
                        <option value="lenguaje">Lenguaje</option>
                        <option value="ciencias">Ciencias</option>
                        <option value="otra">Otra</option>
                      </select>
                    </label>
                    <label>
                      Nivel
                      <select value={draft.teacherLevel} onChange={(event) => updateDraft("teacherLevel", event.target.value as DraftState["teacherLevel"])}>
                        <option value="basica">Básica</option>
                        <option value="media">Media</option>
                        <option value="universitario">Universitario</option>
                      </select>
                    </label>
                    <label>
                      Modalidad
                      <select value={draft.teacherMode} onChange={(event) => updateDraft("teacherMode", event.target.value as DraftState["teacherMode"])}>
                        <option value="presencial">Presencial</option>
                        <option value="online">Online</option>
                        <option value="ambas">Ambas</option>
                      </select>
                    </label>
                  </div>
                ) : null}

                {draft.category === "personal-trainer" ? (
                  <div className="grid-form auth-flow-form">
                    <label>
                      Tipo de entrenamiento
                      <select
                        value={draft.trainerServiceType}
                        onChange={(event) => updateDraft("trainerServiceType", event.target.value as DraftState["trainerServiceType"])}
                      >
                        <option value="funcional">Funcional</option>
                        <option value="fuerza">Fuerza</option>
                        <option value="perdida_peso">Pérdida de peso</option>
                        <option value="movilidad">Movilidad</option>
                      </select>
                    </label>
                    <label>
                      Modalidad
                      <select value={draft.trainerMode} onChange={(event) => updateDraft("trainerMode", event.target.value as DraftState["trainerMode"])}>
                        <option value="presencial">Presencial</option>
                        <option value="online">Online</option>
                        <option value="ambas">Ambas</option>
                      </select>
                    </label>
                    <label>
                      ¿Llevas implementos o equipamiento?
                      <select
                        value={draft.trainerBringsEquipment == null ? "" : draft.trainerBringsEquipment ? "si" : "no"}
                        onChange={(event) => updateDraft("trainerBringsEquipment", event.target.value === "si")}
                      >
                        <option value="">Selecciona</option>
                        <option value="si">Sí</option>
                        <option value="no">No</option>
                      </select>
                    </label>
                  </div>
                ) : null}

                {draft.category === "chef" ? (
                  <div className="grid-form auth-flow-form">
                    <div className="full">
                      <p className="field-label">Tipos de servicio que quieres ofrecer</p>
                      <div className="auth-service-grid auth-service-grid-cleaning">
                        {CHEF_SERVICE_DEFINITIONS.map((service) => (
                          <label key={service.slug} className={`auth-service-card ${draft.chefServiceType.includes(service.slug) ? "active" : ""}`}>
                            <input
                              type="checkbox"
                              checked={draft.chefServiceType.includes(service.slug)}
                              onChange={(event) => {
                                setDraft((current) => ({
                                  ...current,
                                  chefServiceType: event.target.checked
                                    ? Array.from(new Set([...current.chefServiceType, service.slug]))
                                    : current.chefServiceType.filter((item) => item !== service.slug)
                                }));
                              }}
                            />
                            <strong>{service.name}</strong>
                            <span>{service.description}</span>
                            <span>{service.forClients}</span>
                            <span>
                              Incluye: <strong>{service.includes.slice(0, 3).join(", ")}</strong>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="full auth-flow-note-card">
                      <strong>Cocina en casa del cliente</strong>
                      <span>En WeTask, chef se considera siempre un servicio realizado en casa del cliente.</span>
                    </div>
                  </div>
                ) : null}

                {draft.category === "maquillaje" ? (
                  <div className="grid-form auth-flow-form">
                    <div className="full">
                      <p className="field-label">Tipo</p>
                      <div className="inline-checks">
                        {[
                          { value: "social", label: "Social" },
                          { value: "eventos", label: "Eventos" },
                          { value: "novias", label: "Novias" }
                        ].map((option) => (
                          <label key={option.value}>
                            <input
                              type="checkbox"
                              checked={draft.makeupType.includes(option.value as "social" | "eventos" | "novias")}
                              onChange={(event) => {
                                updateDraft(
                                  "makeupType",
                                  event.target.checked
                                    ? Array.from(new Set([...draft.makeupType, option.value as "social" | "eventos" | "novias"]))
                                    : draft.makeupType.filter((item) => item !== option.value)
                                );
                              }}
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="full auth-flow-note-card">
                      <strong>Atención a domicilio</strong>
                      <span>En WeTask, maquillaje se considera siempre un servicio a domicilio.</span>
                    </div>
                    <label>
                      ¿Incluye kit de maquillaje?
                      <select
                        value={draft.makeupKit == null ? "" : draft.makeupKit ? "si" : "no"}
                        onChange={(event) => updateDraft("makeupKit", event.target.value === "si")}
                      >
                        <option value="">Selecciona</option>
                        <option value="si">Sí</option>
                        <option value="no">No</option>
                      </select>
                    </label>
                  </div>
                ) : null}

                {draft.category === "planchado" ? (
                  <div className="grid-form auth-flow-form">
                    <label>
                      Tipo de servicio
                      <select value={draft.ironingType} onChange={(event) => updateDraft("ironingType", event.target.value as DraftState["ironingType"])}>
                        <option value="casa_cliente">En casa del cliente</option>
                        <option value="retiro_entrega">Retiro y entrega</option>
                      </select>
                    </label>
                    <label>
                      ¿Planchas ropa delicada?
                      <select
                        value={draft.ironingDelicate == null ? "" : draft.ironingDelicate ? "si" : "no"}
                        onChange={(event) => updateDraft("ironingDelicate", event.target.value === "si")}
                      >
                        <option value="">Selecciona</option>
                        <option value="si">Sí</option>
                        <option value="no">No</option>
                      </select>
                    </label>
                    <label>
                      Cobro
                      <input value="Por hora" readOnly />
                    </label>
                  </div>
                ) : null}

                <div className="auth-flow-actions">
                  {draft.category === "limpieza" && cleaningScopeScreen > 1 ? (
                    <button type="button" className="cta ghost" onClick={previousCleaningScopeScreen}>
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
                      <span>Bloques</span>
                      <strong>{totalAvailabilityBlocks}</strong>
                      <p>horarios configurados en la semana</p>
                    </article>
                    <article className="availability-stat-card tone-peach">
                      <span>Días activos</span>
                      <strong>{activeAvailabilityDays}</strong>
                      <p>con disponibilidad cargada</p>
                    </article>
                    <article className="availability-stat-card tone-sky">
                      <span>Día elegido</span>
                      <strong>{selectedDayConfig?.blocks.length ?? 0}</strong>
                      <p>bloque(s) en {selectedDayConfig?.label.toLowerCase() ?? "tu día"}</p>
                    </article>
                    <article className="availability-stat-card tone-mint">
                      <span>Modo</span>
                      <strong>{draft.availabilityMode === "VARIABLE" ? "Mensual" : "Semanal"}</strong>
                      <p>
                        {draft.availabilityMode === "VARIABLE"
                          ? "puedes ajustar estos horarios mes a mes"
                          : "estos horarios se repiten cada semana"}
                      </p>
                    </article>
                  </div>

                  <div className="availability-board-card onboarding-board-card">
                    <div className="availability-board-head">
                      <div>
                        <p className="availability-eyebrow">
                          {draft.availabilityMode === "VARIABLE" ? "Planner mensual" : "Planner semanal"}
                        </p>
                        <h3>Selecciona un día y edita sus horarios</h3>
                      </div>
                      <span className="availability-board-chip">{totalAvailabilityBlocks} bloque(s) en total</span>
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
                          <p className="availability-eyebrow">Detalle del día</p>
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
                          <p className="availability-eyebrow">Nuevo bloque</p>
                          <h3>{bulkAvailabilityDays.length > 1 ? `${bulkAvailabilityDays.length} días seleccionados` : selectedDayConfig?.label ?? "Selecciona un día"}</h3>
                        </div>
                        <span className="availability-selected-pill">
                          {draft.availabilityMode === "VARIABLE" ? "Disponibilidad mensual" : "Disponibilidad recurrente"}
                        </span>
                      </div>

                      <div className="availability-mode-tabs" role="tablist" aria-label="Modo de disponibilidad">
                        <button
                          type="button"
                          className={`availability-mode-tab ${draft.availabilityMode === "FIJA" ? "active" : ""}`}
                          aria-pressed={draft.availabilityMode === "FIJA"}
                          onClick={() => updateDraft("availabilityMode", "FIJA")}
                        >
                          Semanal
                        </button>
                        <button
                          type="button"
                          className={`availability-mode-tab ${draft.availabilityMode === "VARIABLE" ? "active" : ""}`}
                          aria-pressed={draft.availabilityMode === "VARIABLE"}
                          onClick={() => updateDraft("availabilityMode", "VARIABLE")}
                        >
                          Mensual
                        </button>
                      </div>

                      <p className="input-hint">
                        {draft.availabilityMode === "VARIABLE"
                          ? "Elige un día del planner y arma una pauta flexible que puedas ajustar cada mes según tu agenda."
                          : "Puedes marcar varios días y crear el mismo bloque horario para todos de una sola vez."}
                      </p>

                      <div className="onboarding-checkbox-grid onboarding-checkbox-grid-compact">
                        {DAY_OPTIONS.map((day) => (
                          <label key={day.key} className="onboarding-check-card onboarding-check-card-compact">
                            <input
                              type="checkbox"
                              checked={bulkAvailabilityDays.includes(day.key)}
                              onChange={() => toggleBulkAvailabilityDay(day.key)}
                            />
                            <span>{day.label}</span>
                          </label>
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
                    En WeTask, para este servicio suele funcionar un rango de <strong>${formatClp(pricingGuide.min)}</strong> a{" "}
                    <strong>${formatClp(pricingGuide.max)}</strong> por hora.
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
                            Rango sugerido: <strong>${formatClp(service.recommendedMinClp)}</strong> a{" "}
                            <strong>${formatClp(service.recommendedMaxClp)}</strong> por hora.
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
                                hourlyRate: service.slug === "cocina-casera" ? value : current.hourlyRate
                              }));
                            }}
                            placeholder={String(service.recommendedMinClp)}
                          />
                        </label>
                      ))}
                    </div>
                  ) : (
                    <label>
                      Tarifa por hora
                      <input value={draft.hourlyRate} onChange={(event) => updateDraft("hourlyRate", event.target.value.replace(/\D/g, ""))} placeholder="15000" />
                    </label>
                  )}
                  <label>
                    Mínimo de horas por servicio
                    <input value={draft.minimumHours} onChange={(event) => updateDraft("minimumHours", event.target.value.replace(/\D/g, ""))} placeholder="2" />
                  </label>
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
                        const content = await fileToDataUrl(file);
                        updateDraft("identityDocumentFrontFile", content);
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
                        const content = await fileToDataUrl(file);
                        updateDraft("identityDocumentBackFile", content);
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
                        const content = await fileToDataUrl(file);
                        updateDraft("criminalRecordFile", content);
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
