"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AuthHeroNav } from "@/components/auth-hero-nav";
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
  acceptsHomesWithPets: boolean | null;
  acceptsHomesWithChildren: boolean | null;
  acceptsHomesWithElderly: boolean | null;
  worksWithClientProducts: boolean | null;
  bringsOwnProducts: boolean | null;
  bringsOwnTools: boolean | null;
  serviceCommunes: unknown;
  availabilityBlocks: unknown;
  hourlyRateClp: number | null;
  minBookingHours: number | null;
  weekendSurchargePct: number | null;
  holidaySurchargePct: number | null;
  remoteCommuneSurchargeClp: number | null;
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
  cleaningType: "hogar" | "profunda" | "post_mudanza";
  cleaningBringsProducts: boolean | null;
  cleaningBringsEquipment: boolean | null;
  petServiceType: "paseo_perros" | "cuidado_casa_cliente" | "cuidado_en_tu_casa";
  petAnimals: Array<"perros" | "gatos">;
  petLargePets: boolean | null;
  babysitterAgeRange: "0_2" | "3_6" | "7_plus";
  babysitterFirstAid: boolean | null;
  babysitterMultiChild: boolean | null;
  teacherSubject: "matematicas" | "ingles" | "lenguaje" | "ciencias" | "otra";
  teacherLevel: "basica" | "media" | "universitario";
  teacherMode: "presencial" | "online" | "ambas";
  chefServiceType: Array<"comida_diaria" | "eventos" | "meal_prep">;
  chefCuisineType: "casera" | "saludable" | "gourmet";
  makeupType: Array<"social" | "eventos" | "novias">;
  makeupKit: boolean | null;
  ironingType: "casa_cliente" | "retiro_entrega";
  ironingDelicate: boolean | null;
  ironingPricing: "por_hora" | "por_prenda";
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
  acceptedTerms: boolean;
};

const TOTAL_STEPS = 12;
const STORAGE_KEY = "wetask_tasker_wizard_v2";
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
  { slug: "chef", label: "Chef", icon: "👨‍🍳", description: "Comida diaria, eventos y meal prep semanal." },
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
const SUBMIT_REQUIRED_FIELD_LABELS: Record<string, string> = {
  categorySlug: "Categoría de servicio (Paso 5)",
  phoneValidatedAt: "Teléfono verificado (Paso 2)",
  profilePhotoUrl: "Foto de perfil (Paso 3)",
  baseCommune: "Comuna donde vive (Paso 3)",
  referenceAddress: "Dirección validada (Paso 3)",
  documentId: "RUT (Paso 3)",
  yearsExperience: "Años de experiencia (Paso 6)",
  workMode: "Cómo trabajas (Paso 6)",
  offeredServices: "Preguntas específicas de tu categoría (Paso 7)",
  serviceCommunes: "Comunas de cobertura (Paso 4)",
  coverageLatitude: "Ubicación validada desde la dirección (Paso 3)",
  coverageLongitude: "Ubicación validada desde la dirección (Paso 3)",
  availabilityBlocks: "Disponibilidad semanal (Paso 8)",
  hourlyRateClp: "Tarifa por hora (Paso 9)",
  minBookingHours: "Mínimo de horas por servicio (Paso 9)",
  weekendSurchargePct: "Recargo fin de semana configurado (Paso 9)",
  holidaySurchargePct: "Recargo festivos configurado (Paso 9)",
  bankAccountHolder: "Nombre del titular de la cuenta (Paso 10)",
  bankAccountHolderRut: "RUT del titular de la cuenta (Paso 10)",
  bankName: "Banco (Paso 10)",
  bankAccountType: "Tipo de cuenta (Paso 10)",
  bankAccountNumber: "Número de cuenta (Paso 10)",
  acceptsCancellationPolicy: "Aceptación de términos y condiciones (Paso 11)",
  acceptsServiceProtocol: "Aceptación de términos y condiciones (Paso 11)",
  acceptsDataProcessing: "Aceptación de términos y condiciones (Paso 11)",
  confirmsCleaningScope: "Aceptación de términos y condiciones (Paso 11)"
};

function currentWeekDayKey(): DayKey {
  const jsDay = new Date().getDay();
  const map: DayKey[] = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  return map[jsDay] ?? "lunes";
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

function normalizeChefServiceTypes(value: unknown): Array<"comida_diaria" | "eventos" | "meal_prep"> {
  const allowed = new Set(["comida_diaria", "eventos", "meal_prep"]);
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is "comida_diaria" | "eventos" | "meal_prep" => typeof item === "string" && allowed.has(item)
    );
  }
  if (typeof value === "string" && allowed.has(value)) {
    return [value as "comida_diaria" | "eventos" | "meal_prep"];
  }
  return ["comida_diaria"];
}

function createInitialDraft(): DraftState {
  return {
    phone: "",
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
    cleaningType: "hogar",
    cleaningBringsProducts: null,
    cleaningBringsEquipment: null,
    petServiceType: "paseo_perros",
    petAnimals: ["perros"],
    petLargePets: null,
    babysitterAgeRange: "0_2",
    babysitterFirstAid: null,
    babysitterMultiChild: null,
    teacherSubject: "matematicas",
    teacherLevel: "basica",
    teacherMode: "presencial",
    chefServiceType: ["comida_diaria"],
    chefCuisineType: "casera",
    makeupType: ["social"],
    makeupKit: null,
    ironingType: "casa_cliente",
    ironingDelicate: null,
    ironingPricing: "por_hora",
    availabilityBlocks: [{ day: "lunes", start: "09:00", end: "13:00" }],
    hourlyRate: "15000",
    minimumHours: "2",
    hasWeekendSurcharge: false,
    weekendSurchargePct: "20",
    hasHolidaySurcharge: false,
    holidaySurchargePct: "20",
    bankName: BANK_OPTIONS[0],
    bankAccountType: "cuenta_corriente",
    bankAccountNumber: "",
    bankOwnerRut: "",
    acceptedTerms: false
  };
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
        offeredServices: [
          draft.cleaningType === "hogar"
            ? "limpieza_general"
            : draft.cleaningType === "profunda"
              ? "limpieza_profunda"
              : "post_evento"
        ],
        experienceTypes: [draft.cleaningType],
        worksWithClientProducts: false,
        bringsOwnProducts: draft.cleaningBringsProducts,
        bringsOwnTools: draft.cleaningBringsEquipment
      };
    case "mascotas":
      return {
        offeredServices: [draft.petServiceType],
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
    case "chef":
      return {
        offeredServices: draft.chefServiceType,
        experienceTypes: [draft.chefCuisineType],
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
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitMissingFields, setSubmitMissingFields] = useState<string[]>([]);
  const [smsPreview, setSmsPreview] = useState("");
  const [selectedAvailabilityDay, setSelectedAvailabilityDay] = useState<DayKey>(currentWeekDayKey);
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedFromAutocomplete, setSelectedFromAutocomplete] = useState(false);
  const [validatingAddress, setValidatingAddress] = useState(false);
  const [addressValidationMessage, setAddressValidationMessage] = useState("");
  const [addressValidationError, setAddressValidationError] = useState("");

  const chicureoSelected = draft.homeCommune === "Chicureo" || draft.coverageCommunes.includes("Chicureo");
  const selectedCategoryLabel = CATEGORY_OPTIONS.find((option) => option.slug === draft.category)?.label ?? "Limpieza";
  const progressPercent = Math.round((activeStep / TOTAL_STEPS) * 100);
  const addressQuery = useMemo(() => [draft.address.trim(), "Santiago", "Chile"].filter(Boolean).join(", "), [draft.address]);
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
        chefServiceType: normalizeChefServiceTypes(parsed.chefServiceType),
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

  const hydrateFromServer = (nextOnboarding: OnboardingPayload, user?: { fullName?: string | null; email?: string | null; phone?: string | null }) => {
    const { firstName, lastName } = splitFullName(user?.fullName ?? session?.fullName ?? "");
    setOnboarding(nextOnboarding);
    setDraft((current) => ({
      ...current,
      phone: user?.phone ?? current.phone,
      phoneVerified: Boolean(nextOnboarding.phoneValidatedAt),
      firstName: firstName || current.firstName,
      lastName: lastName || current.lastName,
      email: user?.email ?? current.email,
      rut: nextOnboarding.documentId ?? current.rut,
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
      yearsExperience: nextOnboarding.yearsExperience ? String(Math.min(nextOnboarding.yearsExperience, 10)) : current.yearsExperience,
      workMode: nextOnboarding.workMode ?? current.workMode,
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
      bankName: nextOnboarding.bankName ?? current.bankName,
      bankAccountType: (nextOnboarding.bankAccountType as DraftState["bankAccountType"]) ?? current.bankAccountType,
      bankAccountNumber: nextOnboarding.bankAccountNumber ?? current.bankAccountNumber,
      bankOwnerRut: nextOnboarding.bankAccountHolderRut ?? current.bankOwnerRut,
      acceptedTerms: Boolean(nextOnboarding.acceptsCancellationPolicy && nextOnboarding.acceptsDataProcessing)
    }));

    if (nextOnboarding.submittedAt || ["PENDIENTE_REVISION", "APROBADO", "ACTIVO"].includes(nextOnboarding.status)) {
      setActiveStep(12);
      return;
    }

    const nextStep = Math.max(1, Math.min(11, nextOnboarding.currentStep || 1)) as WizardStep;
    setActiveStep(nextStep >= 3 ? nextStep : 3);
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
            user?: { fullName?: string | null; email?: string | null; phone?: string | null };
            error?: string;
            detail?: string;
          };
          if (!onboardingResponse.ok || !onboardingData.onboarding) {
            throw new Error(onboardingData.detail || onboardingData.error || "No se pudo cargar el registro");
          }
          hydrateFromServer(onboardingData.onboarding, onboardingData.user);
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

  const validateHomeAddress = async () => {
    if (!draft.address.trim()) {
      setAddressValidationError("Ingresa tu dirección antes de corroborarla con Google.");
      setAddressValidationMessage("");
      return false;
    }

    setValidatingAddress(true);
    setAddressValidationError("");
    setAddressValidationMessage("");

    try {
      const response = await fetch(`/api/maps/validate-address?address=${encodeURIComponent(addressQuery)}`);
      const data = (await response.json()) as AddressValidationResponse;
      if (!response.ok || !data.valid) {
        throw new Error(data.detail || data.error || "No pudimos validar esa dirección con Google.");
      }

      const detectedCommune = normalizeCommune(data.commune ?? "") ?? inferCommuneFromAddress(data.normalizedAddress ?? addressQuery);
      if (!detectedCommune) {
        throw new Error("No pudimos identificar una comuna válida a partir de esa dirección.");
      }

      setDraft((current) => ({
        ...current,
        address: data.normalizedAddress ?? current.address,
        homeCommune: detectedCommune
      }));
      setAddressValidationMessage(
        data.skipped
          ? `Comuna completada automáticamente: ${detectedCommune}.`
          : `Dirección corroborada con Google y comuna completada: ${detectedCommune}.`
      );
      return true;
    } catch (eventualError) {
      setAddressValidationError(eventualError instanceof Error ? eventualError.message : "No pudimos validar esa dirección.");
      return false;
    } finally {
      setValidatingAddress(false);
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
    setSaving(true);
    setError("");
    setFeedback("");
    setSmsPreview("");
    try {
      const response = await fetch("/api/onboarding/public/phone/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: draft.phone.trim() })
      });
      const data = (await response.json()) as { ok?: boolean; codePreview?: string; error?: string; detail?: string };
      if (!response.ok || !data.ok) throw new Error(data.detail || data.error || "No se pudo enviar el codigo");
      setFeedback("Codigo enviado por SMS.");
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
      const response = await fetch("/api/onboarding/public/phone/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: draft.smsCode.trim() })
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; detail?: string };
      if (!response.ok || !data.ok) throw new Error(data.detail || data.error || "No se pudo verificar el telefono");
      setDraft((current) => ({ ...current, phoneVerified: true }));
      setFeedback("Telefono verificado correctamente.");
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

  const continueStep2 = async () => {
    if (!draft.phone.trim()) {
      setError("Ingresa tu telefono para continuar.");
      return;
    }
    if (!draft.phoneVerified) {
      setError("Debes verificar tu telefono antes de continuar.");
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
      setError("Ingresa un RUT chileno valido.");
      return;
    }
    if (!draft.address.trim()) {
      setError("Ingresa tu direccion.");
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

  const continueStep7 = async () => {
    const payload = buildStep7Payload(draft);
    if (!payload.offeredServices || payload.offeredServices.length === 0) {
      setError("Responde las preguntas de tu categoria para continuar.");
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
      setError("Configura al menos un bloque horario valido.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await persistServerStep(8, { availabilityBlocks: validBlocks });
      setActiveStep(9);
    } catch (eventualError) {
      setError(eventualError instanceof Error ? eventualError.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  const continueStep9 = async () => {
    if (!draft.hourlyRate.trim() || !draft.minimumHours.trim()) {
      setError("Completa tu tarifa y minimo de horas.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await persistServerStep(9, {
        hourlyRateClp: Number(draft.hourlyRate),
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
    if (!isValidRut(draft.bankOwnerRut)) {
      setError("Ingresa un RUT titular valido.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await persistServerStep(10, {
        bankAccountHolder: `${draft.firstName.trim()} ${draft.lastName.trim()}`.trim(),
        bankAccountHolderRut: draft.bankOwnerRut.trim(),
        bankName: draft.bankName,
        bankAccountType: draft.bankAccountType,
        bankAccountNumber: draft.bankAccountNumber.trim()
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
      setError("Debes aceptar los terminos y condiciones para finalizar.");
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
          setSubmitMissingFields(data.missingFields.map((field) => SUBMIT_REQUIRED_FIELD_LABELS[field] ?? `${field} (pendiente)`));
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

  const updateAvailabilityBlock = (index: number, patch: Partial<AvailabilityBlock>) => {
    setDraft((current) => ({
      ...current,
      availabilityBlocks: current.availabilityBlocks.map((block, blockIndex) => (blockIndex === index ? { ...block, ...patch } : block))
    }));
  };

  const addAvailabilityBlock = (day: DayKey) => {
    setDraft((current) => ({
      ...current,
      availabilityBlocks: [...current.availabilityBlocks, { day, start: "14:00", end: "18:00" }]
    }));
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
              <span className="onboarding-progress-label">{progressPercent}%</span>
            </div>
            <div className="onboarding-progress-track" aria-hidden>
              <div className="onboarding-progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>

            {feedback ? <p className="feedback ok">{feedback}</p> : null}
            {error ? <p className="feedback error">{error}</p> : null}
            {submitMissingFields.length > 0 ? (
              <div className="onboarding-missing-card">
                <strong>Faltan estos datos antes de enviar tu perfil:</strong>
                <ul>
                  {submitMissingFields.map((field) => (
                    <li key={field}>{field}</li>
                  ))}
                </ul>
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
                  <input value={draft.phone} onChange={(event) => updateDraft("phone", event.target.value)} placeholder="+56 9 XXXXXXXX" />
                </label>
                <div className="auth-flow-actions">
                  <button type="button" className="cta ghost" onClick={sendPhoneCode} disabled={saving}>
                    {saving ? "Enviando..." : "Enviar código"}
                  </button>
                </div>
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
                    <input value={draft.rut} onChange={(event) => updateDraft("rut", event.target.value)} placeholder="12.345.678-5" />
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
                    <div className="address-inline-actions">
                      <button className="cta ghost small" type="button" onClick={() => void validateHomeAddress()} disabled={validatingAddress}>
                        {validatingAddress ? "Corroborando..." : "Corroborar con Google"}
                      </button>
                    </div>
                  </label>
                  <label>
                    Comuna donde vive
                    <select value={draft.homeCommune} onChange={(event) => updateDraft("homeCommune", event.target.value as ActiveMvpCommune)}>
                      {COMMUNE_OPTIONS.map((commune) => (
                        <option key={commune} value={commune}>
                          {commune}
                        </option>
                      ))}
                    </select>
                    <p className="input-hint">Se rellena automáticamente según la dirección que elijas y corroboras con Google.</p>
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
                    <label>
                      Tipo de limpieza
                      <select value={draft.cleaningType} onChange={(event) => updateDraft("cleaningType", event.target.value as DraftState["cleaningType"])}>
                        <option value="hogar">Hogar</option>
                        <option value="profunda">Profunda</option>
                        <option value="post_mudanza">Post mudanza</option>
                      </select>
                    </label>
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
                  </div>
                ) : null}

                {draft.category === "mascotas" ? (
                  <div className="grid-form auth-flow-form">
                    <label>
                      Tipo de servicio
                      <select value={draft.petServiceType} onChange={(event) => updateDraft("petServiceType", event.target.value as DraftState["petServiceType"])}>
                        <option value="paseo_perros">Paseo de perros</option>
                        <option value="cuidado_casa_cliente">Cuidado en casa del cliente</option>
                        <option value="cuidado_en_tu_casa">Cuidado en tu casa</option>
                      </select>
                    </label>
                    <div className="full">
                      <p className="field-label">Animales</p>
                      <div className="onboarding-checkbox-grid onboarding-checkbox-grid-compact">
                        {(["perros", "gatos"] as const).map((animal) => (
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

                {draft.category === "chef" ? (
                  <div className="grid-form auth-flow-form">
                    <div className="full">
                      <p className="field-label">Tipo de servicio</p>
                      <div className="inline-checks">
                        {[
                          { value: "comida_diaria", label: "Comida diaria" },
                          { value: "eventos", label: "Eventos" },
                          { value: "meal_prep", label: "Meal prep semanal" }
                        ].map((option) => (
                          <label key={option.value}>
                            <input
                              type="checkbox"
                              checked={draft.chefServiceType.includes(option.value as "comida_diaria" | "eventos" | "meal_prep")}
                              onChange={(event) => {
                                updateDraft(
                                  "chefServiceType",
                                  event.target.checked
                                    ? Array.from(new Set([...draft.chefServiceType, option.value as "comida_diaria" | "eventos" | "meal_prep"]))
                                    : draft.chefServiceType.filter((item) => item !== option.value)
                                );
                              }}
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <label>
                      Tipo de cocina
                      <select value={draft.chefCuisineType} onChange={(event) => updateDraft("chefCuisineType", event.target.value as DraftState["chefCuisineType"])}>
                        <option value="casera">Casera</option>
                        <option value="saludable">Saludable</option>
                        <option value="gourmet">Gourmet</option>
                      </select>
                    </label>
                    <div className="full auth-flow-note-card">
                      <strong>Cocina en casa del cliente</strong>
                      <span>En WeTask, el servicio de chef se considera siempre realizado en casa del cliente.</span>
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
                  <button type="button" className="cta ghost" onClick={previousStep}>
                    Volver
                  </button>
                  <button type="button" className="cta" onClick={continueStep7} disabled={saving}>
                    {saving ? "Guardando..." : "Continuar"}
                  </button>
                </div>
              </div>
            ) : null}

            {activeStep === 8 ? (
              <div className="onboarding-screen">
                <h3>Disponibilidad</h3>
                <div className="pro-availability-shell onboarding-availability-shell">
                  <aside className="pro-availability-sidebar">
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
                        <strong>Semanal</strong>
                        <p>estos horarios se repiten cada semana</p>
                      </article>
                    </div>

                    <div className="availability-composer-card">
                      <div className="availability-composer-head">
                        <div>
                          <p className="availability-eyebrow">Nuevo bloque</p>
                          <h3>{selectedDayConfig?.label ?? "Selecciona un día"}</h3>
                        </div>
                        <span className="availability-selected-pill">Disponibilidad recurrente</span>
                      </div>

                      <p className="input-hint">
                        Elige un día del planner y agrega uno o varios bloques para mostrar cuándo quieres recibir reservas.
                      </p>

                      <div className="cta-row availability-form-actions">
                        <button type="button" className="cta" onClick={() => addAvailabilityBlock(selectedDayConfig?.key ?? "lunes")}>
                          Agregar bloque a {selectedDayConfig?.label ?? "este día"}
                        </button>
                      </div>
                    </div>
                  </aside>

                  <div className="availability-board-card">
                    <div className="availability-board-head">
                      <div>
                        <p className="availability-eyebrow">Planner semanal</p>
                        <h3>Selecciona un día y edita sus horarios</h3>
                      </div>
                      <span className="availability-board-chip">{totalAvailabilityBlocks} bloque(s) en total</span>
                    </div>

                    <div className="availability-weekdays">
                      {DAY_OPTIONS.map((day) => (
                        <span key={day.key}>{day.label.slice(0, 3)}</span>
                      ))}
                    </div>

                    <div className="onboarding-week-grid">
                      {groupedBlocks.map((day) => {
                        const isSelected = day.key === selectedAvailabilityDay;
                        return (
                          <button
                            key={day.key}
                            type="button"
                            className={`availability-day-card onboarding-week-card ${isSelected ? "selected" : ""}`}
                            onClick={() => setSelectedAvailabilityDay(day.key)}
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

                    <div className="availability-task-panel">
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
                                <input
                                  type="time"
                                  value={block.start}
                                  onChange={(event) => updateAvailabilityBlock(block.index, { start: event.target.value })}
                                />
                                <span>–</span>
                                <input
                                  type="time"
                                  value={block.end}
                                  onChange={(event) => updateAvailabilityBlock(block.index, { end: event.target.value })}
                                />
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
                <div className="grid-form auth-flow-form">
                  <label>
                    Tarifa por hora
                    <input value={draft.hourlyRate} onChange={(event) => updateDraft("hourlyRate", event.target.value.replace(/\D/g, ""))} placeholder="15000" />
                  </label>
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
                      <input
                        value={draft.weekendSurchargePct}
                        onChange={(event) => updateDraft("weekendSurchargePct", event.target.value.replace(/\D/g, ""))}
                        placeholder="20"
                      />
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
                      <input
                        value={draft.holidaySurchargePct}
                        onChange={(event) => updateDraft("holidaySurchargePct", event.target.value.replace(/\D/g, ""))}
                        placeholder="20"
                      />
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
                    />
                  </label>
                  <label>
                    RUT titular
                    <input value={draft.bankOwnerRut} onChange={(event) => updateDraft("bankOwnerRut", event.target.value)} placeholder="12.345.678-5" />
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
