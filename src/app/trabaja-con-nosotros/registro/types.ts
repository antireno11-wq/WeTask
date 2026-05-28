import type { ActiveMvpCommune } from "@/lib/communes";
import type { ChefServiceSlug } from "@/lib/chef-service-types";
import type { CleaningServiceSlug } from "@/lib/cleaning-service-types";
import type { BabysitterAgeRangeSlug, BabysitterScopeData, BabysitterScopeServiceSlug } from "@/lib/babysitter-scope";
import type { ChefScopeData } from "@/lib/chef-scope";
import type { CleaningScopeData } from "@/lib/cleaning-scope";
import type { IroningScopeData } from "@/lib/ironing-scope";
import type { MakeupScopeData } from "@/lib/makeup-scope";
import type { PetScopeData, PetScopeServiceSlug } from "@/lib/pet-scope";
import type { TeacherLevelSlug, TeacherScopeData, TeacherScopeServiceSlug } from "@/lib/teacher-scope";
import type { TrainerModeSlug, TrainerScopeData, TrainerScopeServiceSlug } from "@/lib/trainer-scope";

export type SessionPayload = {
  userId: string;
  fullName?: string | null;
  email?: string | null;
  role: "CUSTOMER" | "PRO" | "ADMIN";
  authProvider?: "EMAIL" | "GOOGLE" | "APPLE";
  emailVerified?: boolean;
  termsAccepted?: boolean;
};

export type OnboardingPayload = {
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

export type OnboardingServiceRate = {
  serviceSlug: string;
  hourlyRateClp: number;
};

export type AddressValidationResponse = {
  valid?: boolean;
  skipped?: boolean;
  normalizedAddress?: string;
  commune?: string | null;
  isActiveCommune?: boolean;
  location?: { lat?: number | null; lng?: number | null };
  error?: string;
  detail?: string;
};

export type DayKey = "lunes" | "martes" | "miercoles" | "jueves" | "viernes" | "sabado" | "domingo";

export type AvailabilityBlock = {
  day: DayKey;
  start: string;
  end: string;
};

export type CategorySlug =
  | "limpieza"
  | "mascotas"
  | "babysitter"
  | "profesor-particular"
  | "personal-trainer"
  | "chef"
  | "maquillaje"
  | "planchado";

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type DraftState = {
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
  babysitterAgeRange: BabysitterAgeRangeSlug;
  babysitterFirstAid: boolean | null;
  babysitterMultiChild: boolean | null;
  babysitterScope: BabysitterScopeData;
  teacherSubject: TeacherScopeServiceSlug;
  teacherLevel: TeacherLevelSlug;
  teacherMode: "presencial" | "online" | "ambas";
  teacherScope: TeacherScopeData;
  trainerServiceType: TrainerScopeServiceSlug;
  trainerMode: TrainerModeSlug;
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

export type CleaningScopeScreen = 1 | 2 | 3 | 4 | 5;
export type PetScopeScreen = 1 | 2 | 3 | 4 | 5 | 6;
export type MakeupScopeScreen = 1 | 2 | 3 | 4 | 5;
export type IroningScopeScreen = 1 | 2 | 3 | 4 | 5;
export type BabysitterScopeScreen = 1 | 2 | 3 | 4 | 5 | 6;
export type ChefScopeScreen = 1;
export type TeacherScopeScreen = 1 | 2 | 3 | 4 | 5 | 6;
export type TrainerScopeScreen = 1 | 2 | 3 | 4 | 5 | 6;

export type MissingFieldItem = {
  field: string;
  label: string;
  step: WizardStep;
};

export type UploadKind =
  | "identity_front"
  | "identity_back"
  | "identity_selfie"
  | "criminal_record"
  | "profile_photo"
  | "chat_image"
  | "dispute_evidence";
