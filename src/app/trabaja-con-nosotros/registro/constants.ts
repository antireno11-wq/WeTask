import type { ActiveMvpCommune } from "@/lib/communes";
import type {
  AvailabilityBlock,
  CategorySlug,
  DayKey,
  DraftState,
  WizardStep
} from "./types";

import { ACTIVE_CLEANING_SERVICE_SLUGS } from "@/lib/cleaning-service-types";
import {
  emptyBabysitterScope
} from "@/lib/babysitter-scope";
import { emptyChefScope } from "@/lib/chef-scope";
import { emptyCleaningScope } from "@/lib/cleaning-scope";
import { emptyIroningScope } from "@/lib/ironing-scope";
import { emptyMakeupScope } from "@/lib/makeup-scope";
import { emptyPetScope } from "@/lib/pet-scope";
import { emptyTeacherScope } from "@/lib/teacher-scope";
import { emptyTrainerScope } from "@/lib/trainer-scope";

export const TOTAL_STEPS = 12;
export const STORAGE_KEY = "wetask_tasker_wizard_v2";
export const CHILE_MOBILE_PREFIX = "+569";

export const COMMUNE_OPTIONS: ActiveMvpCommune[] = [
  "Vitacura",
  "Lo Barnechea",
  "Chicureo",
  "Las Condes",
  "Providencia",
  "La Reina",
  "Ñuñoa"
];

export const CATEGORY_OPTIONS: Array<{ slug: CategorySlug; label: string; icon: string; description: string }> = [
  { slug: "limpieza", label: "Limpieza", icon: "🧹", description: "Limpieza hogar, profunda y post mudanza." },
  { slug: "mascotas", label: "Cuidado de mascotas", icon: "🐾", description: "Paseos y cuidado diario para perros y gatos." },
  { slug: "babysitter", label: "Babysitter", icon: "👶", description: "Cuidado infantil responsable en casa del cliente." },
  { slug: "profesor-particular", label: "Profesor particular", icon: "📚", description: "Clases personalizadas presenciales u online." },
  { slug: "personal-trainer", label: "Personal trainer", icon: "🏋️", description: "Entrenamiento personalizado según objetivo y modalidad." },
  { slug: "chef", label: "Chef", icon: "👨‍🍳", description: "Cocina gourmet, casera, repostería, eventos y cumpleaños." },
  { slug: "maquillaje", label: "Maquillaje", icon: "💄", description: "Servicios sociales, eventos y novias." },
  { slug: "planchado", label: "Planchado", icon: "👕", description: "Planchado en casa o con retiro y entrega." }
];

export const BANK_OPTIONS = [
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

export const DAY_OPTIONS: Array<{ key: DayKey; label: string }> = [
  { key: "lunes", label: "Lunes" },
  { key: "martes", label: "Martes" },
  { key: "miercoles", label: "Miércoles" },
  { key: "jueves", label: "Jueves" },
  { key: "viernes", label: "Viernes" },
  { key: "sabado", label: "Sábado" },
  { key: "domingo", label: "Domingo" }
];

export const AVAILABILITY_TIME_OPTIONS = Array.from({ length: 31 }, (_, index) => {
  const hour = 7 + Math.floor(index / 2);
  const minutes = index % 2 === 0 ? "00" : "30";
  return `${String(hour).padStart(2, "0")}:${minutes}`;
});

export const ONBOARDING_STEP_ITEMS: Array<{ step: WizardStep; label: string }> = [
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

export const SUBMIT_REQUIRED_FIELDS: Record<string, { label: string; step: WizardStep }> = {
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

export const UPLOAD_KINDS = [
  "identity_front",
  "identity_back",
  "identity_selfie",
  "criminal_record",
  "profile_photo",
  "chat_image",
  "dispute_evidence"
] as const;

export function createInitialDraft(): DraftState {
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

export function createFreshDraft(presetService: CategorySlug | null): DraftState {
  const nextDraft = createInitialDraft();
  if (presetService) {
    nextDraft.category = presetService;
  }
  return nextDraft;
}
