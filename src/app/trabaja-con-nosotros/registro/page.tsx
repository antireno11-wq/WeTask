"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { MarketNav } from "@/components/market-nav";
import { geocodeAddress } from "@/lib/geo";
import { CORE_SERVICES, type CoreTaskerServiceSlug } from "@/lib/core-services";
import {
  CHILE_TOP_COMMUNES,
  CLEANING_LANGUAGE_OPTIONS,
  CLEANING_STATUS_LABELS,
  CLEANING_TRAINING_TOPICS,
  CLEANING_WEEK_DAYS
} from "@/lib/cleaning-onboarding";

type SessionPayload = {
  userId: string;
  fullName?: string | null;
  email?: string | null;
  role: "CUSTOMER" | "PRO" | "ADMIN";
};

type OnboardingPayload = {
  id: string;
  status: "BORRADOR" | "PENDIENTE_REVISION" | "REQUIERE_CORRECCION" | "APROBADO" | "ACTIVO";
  currentStep: number;
  baseCommune: string | null;
  referenceAddress: string | null;
  documentId: string | null;
  birthDate: string | null;
  nationality: string | null;
  migrationStatus: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  workReferences: string | null;
  profilePhotoUrl: string | null;
  shortDescription: string | null;
  yearsExperience: number | null;
  workMode: "SOLO" | "EQUIPO" | null;
  experienceTypes: unknown;
  offeredServices: unknown;
  acceptsHomesWithPets: boolean | null;
  acceptsHomesWithChildren: boolean | null;
  acceptsHomesWithElderly: boolean | null;
  worksWithClientProducts: boolean | null;
  bringsOwnProducts: boolean | null;
  bringsOwnTools: boolean | null;
  languages: unknown;
  serviceCommunes: unknown;
  coverageLatitude: number | null;
  coverageLongitude: number | null;
  maxTravelKm: number | null;
  chargesTravelExtra: boolean | null;
  availabilityMode: "FIJA" | "VARIABLE" | null;
  availabilityBlocks: unknown;
  maxServicesPerDay: number | null;
  acceptsUrgentBookings: boolean | null;
  hourlyRateClp: number | null;
  minBookingHours: number | null;
  weekendSurchargePct: number | null;
  holidaySurchargePct: number | null;
  remoteCommuneSurchargeClp: number | null;
  deepCleaningHourlyRateClp: number | null;
  identityDocumentFile: string | null;
  identityDocumentFrontFile: string | null;
  identityDocumentBackFile: string | null;
  identitySelfieFile: string | null;
  criminalRecordFile: string | null;
  bankAccountHolder: string | null;
  bankAccountHolderRut: string | null;
  bankName: string | null;
  bankAccountType: string | null;
  bankAccountNumber: string | null;
  billingType: string | null;
  phoneValidatedAt: string | null;
  trainingTopics: unknown;
  trainingCompletedAt: string | null;
  acceptsCancellationPolicy: boolean | null;
  acceptsServiceProtocol: boolean | null;
  acceptsDataProcessing: boolean | null;
  confirmsCleaningScope: boolean | null;
  submittedAt: string | null;
  adminReviewNotes: string | null;
};

type AvailabilityBlock = {
  day: (typeof CLEANING_WEEK_DAYS)[number];
  start: string;
  end: string;
};

type TaskerServiceSlug = CoreTaskerServiceSlug;

const TASKER_SERVICE_OPTIONS: ReadonlyArray<{ slug: TaskerServiceSlug; label: string }> = CORE_SERVICES.map((service) => ({
  slug: service.slug,
  label: service.label
}));

const EXPERIENCE_OPTIONS_BY_SERVICE: Record<TaskerServiceSlug, string[]> = {
  limpieza: ["casas", "departamentos", "oficinas_pequenas", "airbnb", "limpieza_profunda", "planchado"],
  mascotas: ["cuidado_mascotas", "paseo_perros", "casas", "departamentos"],
  babysitter: ["cuidado_infantil", "casas", "departamentos", "airbnb"],
  "profesor-particular": ["clases_escolares", "clases_musica", "clases_idiomas", "clases_online"],
  "personal-trainer": ["entrenamiento_funcional", "casas", "departamentos"],
  chef: ["cocina_hogar", "eventos", "meal_prep", "dietas_especiales"],
  planchado: ["planchado", "casas", "departamentos"]
};

const OFFERED_SERVICES_BY_SERVICE: Record<TaskerServiceSlug, string[]> = {
  limpieza: [
    "limpieza_general",
    "limpieza_profunda",
    "limpieza_recurrente",
    "limpieza_puntual",
    "planchado",
    "orden_organizacion",
    "lavado_loza",
    "limpieza_oficina_pequena",
    "post_evento"
  ],
  mascotas: ["paseo_perros", "cuidado_mascotas"],
  babysitter: ["babysitter_horas"],
  "profesor-particular": ["profesor_particular", "clases_apoyo_escolar", "clases_musica", "clases_idiomas", "clases_online"],
  "personal-trainer": ["personal_trainer"],
  chef: ["chef_a_domicilio", "preparacion_menu", "cocina_eventos", "meal_prep"],
  planchado: ["planchado_por_hora", "orden_organizacion"]
};

const DYNAMIC_QUESTION_LABELS: Record<
  TaskerServiceSlug,
  {
    first: string;
    second: string;
    third: string;
    products: string;
    ownProducts: string;
    ownTools: string;
  }
> = {
  limpieza: {
    first: "Acepto casas con mascotas",
    second: "Acepto hogares con ninos",
    third: "Acepto hogares con adultos mayores",
    products: "Trabajo con productos del cliente",
    ownProducts: "Llevo productos propios",
    ownTools: "Llevo implementos propios"
  },
  mascotas: {
    first: "Acepto hogares con mascotas grandes",
    second: "Acepto hogares con ninos",
    third: "Acepto hogares con adultos mayores",
    products: "Trabajo con implementos del cliente",
    ownProducts: "Llevo snacks o insumos propios para mascotas",
    ownTools: "Llevo correa o implementos propios"
  },
  babysitter: {
    first: "Acepto hogares con mascotas",
    second: "Acepto ninos pequenos",
    third: "Acepto apoyo con adultos mayores en casa",
    products: "Trabajo con implementos del hogar",
    ownProducts: "Llevo materiales de apoyo (cuentos/juegos)",
    ownTools: "Llevo implementos propios para actividades"
  },
  "profesor-particular": {
    first: "Acepto clases en hogares con mascotas",
    second: "Acepto clases para ninos",
    third: "Acepto clases para adultos mayores",
    products: "Trabajo con material del alumno",
    ownProducts: "Llevo material de apoyo",
    ownTools: "Llevo implementos propios para la clase"
  },
  "personal-trainer": {
    first: "Acepto entrenar en hogares con mascotas",
    second: "Acepto entrenar ninos y adolescentes",
    third: "Acepto entrenar adultos mayores",
    products: "Trabajo con implementos del cliente",
    ownProducts: "Llevo rutinas y material de apoyo",
    ownTools: "Llevo implementos deportivos propios"
  },
  chef: {
    first: "Acepto cocinar en hogares con mascotas",
    second: "Acepto preparar menus para ninos",
    third: "Acepto preparar menus para adultos mayores",
    products: "Trabajo con insumos del cliente",
    ownProducts: "Puedo llevar algunos insumos propios",
    ownTools: "Llevo utensilios y herramientas de cocina"
  },
  planchado: {
    first: "Acepto hogares con mascotas",
    second: "Acepto hogares con ninos",
    third: "Acepto hogares con adultos mayores",
    products: "Trabajo con productos del cliente",
    ownProducts: "Llevo productos propios para planchado",
    ownTools: "Llevo implementos propios"
  }
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function calculateMapRadiusPixels(km: number, lat: number, zoom: number) {
  const meters = Math.max(0, km) * 1000;
  const metersPerPixel = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
  if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) return 0;
  return meters / metersPerPixel;
}

function estimateZoomForRadius(km: number, lat: number) {
  const meters = Math.max(0.5, km) * 1000;
  const targetRadiusPx = 120;
  const metersPerPixel = meters / targetRadiusPx;
  const zoom = Math.log2((156543.03392 * Math.cos((lat * Math.PI) / 180)) / metersPerPixel);
  return clamp(Math.round(zoom), 10, 18);
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

function toAvailabilityBlocks(value: unknown): AvailabilityBlock[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const block = item as { day?: string; start?: string; end?: string };
      if (!block.day || !block.start || !block.end) return null;
      if (!CLEANING_WEEK_DAYS.includes(block.day as (typeof CLEANING_WEEK_DAYS)[number])) return null;
      return {
        day: block.day as (typeof CLEANING_WEEK_DAYS)[number],
        start: block.start,
        end: block.end
      };
    })
    .filter(Boolean) as AvailabilityBlock[];
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer archivo"));
    reader.readAsDataURL(file);
  });
}

export default function CleaningOnboardingPage() {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingPayload | null>(null);
  const [activeStep, setActiveStep] = useState(1);
  const [selectedService, setSelectedService] = useState<TaskerServiceSlug>("limpieza");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const [regFullName, setRegFullName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regTerms, setRegTerms] = useState(false);

  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [yearsExperience, setYearsExperience] = useState(2);
  const [workMode, setWorkMode] = useState<"SOLO" | "EQUIPO">("SOLO");
  const [experienceTypes, setExperienceTypes] = useState<string[]>([]);
  const [referenceAddress, setReferenceAddress] = useState("");

  const [offeredServices, setOfferedServices] = useState<string[]>([]);
  const [acceptsHomesWithPets, setAcceptsHomesWithPets] = useState(true);
  const [acceptsHomesWithChildren, setAcceptsHomesWithChildren] = useState(true);
  const [acceptsHomesWithElderly, setAcceptsHomesWithElderly] = useState(true);
  const [worksWithClientProducts, setWorksWithClientProducts] = useState(true);
  const [bringsOwnProducts, setBringsOwnProducts] = useState(false);
  const [bringsOwnTools, setBringsOwnTools] = useState(false);
  const [languages, setLanguages] = useState<string[]>(["espanol"]);

  const [baseCommune, setBaseCommune] = useState("Las Condes");
  const [serviceCommunes, setServiceCommunes] = useState<string[]>([]);
  const [communeToAdd, setCommuneToAdd] = useState<string>(CHILE_TOP_COMMUNES[0] ?? "Las Condes");
  const [coverageLatitude, setCoverageLatitude] = useState("-33.448900");
  const [coverageLongitude, setCoverageLongitude] = useState("-70.669300");
  const [addressValidationState, setAddressValidationState] = useState<"idle" | "validating" | "verified" | "fallback">("idle");
  const [validatedAddress, setValidatedAddress] = useState("");
  const [mapZoom, setMapZoom] = useState(14);
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [maxTravelKm, setMaxTravelKm] = useState(12);
  const [chargesTravelExtra, setChargesTravelExtra] = useState(false);

  const [availabilityMode, setAvailabilityMode] = useState<"FIJA" | "VARIABLE">("FIJA");
  const [availabilityBlocks, setAvailabilityBlocks] = useState<AvailabilityBlock[]>([{ day: "lunes", start: "09:00", end: "13:00" }]);
  const [maxServicesPerDay, setMaxServicesPerDay] = useState(3);
  const [acceptsUrgentBookings, setAcceptsUrgentBookings] = useState(false);

  const [hourlyRateClp, setHourlyRateClp] = useState(12000);
  const [minBookingHours, setMinBookingHours] = useState(2);
  const [weekendSurchargePct, setWeekendSurchargePct] = useState(15);
  const [holidaySurchargePct, setHolidaySurchargePct] = useState(25);
  const [remoteCommuneSurchargeClp, setRemoteCommuneSurchargeClp] = useState(4000);
  const [hasDeepCleaningRate, setHasDeepCleaningRate] = useState(false);
  const [deepCleaningHourlyRateClp, setDeepCleaningHourlyRateClp] = useState(15000);

  const [documentId, setDocumentId] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [nationality, setNationality] = useState("chilena");
  const [migrationStatus, setMigrationStatus] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [workReferences, setWorkReferences] = useState("");
  const [identityDocumentFrontFile, setIdentityDocumentFrontFile] = useState("");
  const [identityDocumentBackFile, setIdentityDocumentBackFile] = useState("");
  const [identitySelfieFile, setIdentitySelfieFile] = useState("");
  const [criminalRecordFile, setCriminalRecordFile] = useState("");
  const [bankAccountHolder, setBankAccountHolder] = useState("");
  const [bankAccountHolderRut, setBankAccountHolderRut] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountType, setBankAccountType] = useState("cuenta_corriente");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [billingType, setBillingType] = useState("persona_natural");
  const [phoneCode, setPhoneCode] = useState("");

  const [completedTopics, setCompletedTopics] = useState<string[]>([]);
  const [acceptsCancellationPolicy, setAcceptsCancellationPolicy] = useState(false);
  const [acceptsServiceProtocol, setAcceptsServiceProtocol] = useState(false);
  const [acceptsDataProcessing, setAcceptsDataProcessing] = useState(false);
  const [confirmsCleaningScope, setConfirmsCleaningScope] = useState(false);

  const phoneValidated = Boolean(onboarding?.phoneValidatedAt);

  const parsedMapLat = Number(coverageLatitude);
  const parsedMapLng = Number(coverageLongitude);
  const geocodedCenter = useMemo(
    () =>
      geocodeAddress({
        city: "Santiago",
        postalCode: "7500000",
        street: `${referenceAddress} ${baseCommune}`.trim(),
        fallback: { lat: -33.4489, lng: -70.6693 }
      }),
    [referenceAddress, baseCommune]
  );
  const mapLat = clamp(
    Number.isFinite(parsedMapLat) ? parsedMapLat : geocodedCenter.lat,
    -90,
    90
  );
  const mapLng = clamp(
    Number.isFinite(parsedMapLng) ? parsedMapLng : geocodedCenter.lng,
    -180,
    180
  );
  const radiusPx = calculateMapRadiusPixels(maxTravelKm, mapLat, mapZoom);
  const mapEmbedUrl = `https://maps.google.com/maps?hl=es&q=${encodeURIComponent(`${mapLat},${mapLng}`)}&z=${mapZoom}&t=m&output=embed`;

  useEffect(() => {
    if (!referenceAddress.trim()) {
      setCoverageLatitude(geocodedCenter.lat.toFixed(6));
      setCoverageLongitude(geocodedCenter.lng.toFixed(6));
      setAddressValidationState("idle");
      setValidatedAddress("");
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setAddressValidationState("validating");
      setValidatedAddress("");
      try {
        const query = `${referenceAddress}, ${baseCommune}, Santiago, Chile`;
        const response = await fetch(`/api/maps/validate-address?address=${encodeURIComponent(query)}`, {
          signal: controller.signal
        });
        const data = (await response.json()) as {
          valid?: boolean;
          skipped?: boolean;
          normalizedAddress?: string;
          location?: { lat?: number | null; lng?: number | null };
        };

        if (!response.ok || !data.valid) {
          setAddressValidationState("fallback");
          return;
        }

        if (data.location?.lat != null && data.location?.lng != null) {
          setCoverageLatitude(Number(data.location.lat).toFixed(6));
          setCoverageLongitude(Number(data.location.lng).toFixed(6));
          setMapZoom(estimateZoomForRadius(maxTravelKm, Number(data.location.lat)));
        }

        setValidatedAddress((data.normalizedAddress || query).trim());
        setAddressValidationState(data.skipped ? "fallback" : "verified");
      } catch {
        if (!controller.signal.aborted) {
          setAddressValidationState("fallback");
        }
      }
    }, 500);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [baseCommune, geocodedCenter.lat, geocodedCenter.lng, maxTravelKm, referenceAddress]);

  useEffect(() => {
    const query = referenceAddress.trim();
    if (query.length < 4) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      setAutocompleteLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setAutocompleteLoading(true);
      try {
        const response = await fetch(`/api/maps/autocomplete?input=${encodeURIComponent(`${query}, ${baseCommune}, Santiago, Chile`)}`, {
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
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [baseCommune, referenceAddress]);

  useEffect(() => {
    if (addressValidationState !== "verified") return;
    setMapZoom(estimateZoomForRadius(maxTravelKm, mapLat));
  }, [addressValidationState, mapLat, maxTravelKm]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const service = params.get("service");
    if (!service) return;
    const selected = TASKER_SERVICE_OPTIONS.find((item) => item.slug === service);
    if (selected) setSelectedService(selected.slug);
  }, []);

  const selectedServiceLabel =
    TASKER_SERVICE_OPTIONS.find((item) => item.slug === selectedService)?.label ?? "Limpieza";
  const activeExperienceOptions = EXPERIENCE_OPTIONS_BY_SERVICE[selectedService];
  const activeOfferedServices = OFFERED_SERVICES_BY_SERVICE[selectedService];
  const activeDynamicLabels = DYNAMIC_QUESTION_LABELS[selectedService];

  useEffect(() => {
    setExperienceTypes((current) => current.filter((item) => activeExperienceOptions.includes(item)));
    setOfferedServices((current) => current.filter((item) => activeOfferedServices.includes(item)));
  }, [activeExperienceOptions, activeOfferedServices]);

  const hydrateFromOnboarding = (next: OnboardingPayload) => {
    setOnboarding(next);
    setBaseCommune(next.baseCommune ?? "Las Condes");

    setProfilePhotoUrl(next.profilePhotoUrl ?? "");
    setShortDescription(next.shortDescription ?? "");
    setYearsExperience(next.yearsExperience ?? 2);
    setWorkMode(next.workMode ?? "SOLO");
    setExperienceTypes(toStringArray(next.experienceTypes));
    setReferenceAddress(next.referenceAddress ?? "");

    setOfferedServices(toStringArray(next.offeredServices));
    setAcceptsHomesWithPets(next.acceptsHomesWithPets ?? true);
    setAcceptsHomesWithChildren(next.acceptsHomesWithChildren ?? true);
    setAcceptsHomesWithElderly(next.acceptsHomesWithElderly ?? true);
    setWorksWithClientProducts(next.worksWithClientProducts ?? true);
    setBringsOwnProducts(next.bringsOwnProducts ?? false);
    setBringsOwnTools(next.bringsOwnTools ?? false);
    setLanguages(toStringArray(next.languages).length > 0 ? toStringArray(next.languages) : ["espanol"]);

    const loadedCommunes = toStringArray(next.serviceCommunes);
    setServiceCommunes(loadedCommunes);
    if (loadedCommunes.length > 0) {
      setCommuneToAdd(loadedCommunes[0]);
    }
    if (next.coverageLatitude != null && next.coverageLongitude != null) {
      setCoverageLatitude(next.coverageLatitude.toFixed(6));
      setCoverageLongitude(next.coverageLongitude.toFixed(6));
      setAddressValidationState("verified");
    } else {
      setCoverageLatitude("-33.448900");
      setCoverageLongitude("-70.669300");
      setAddressValidationState("idle");
    }
    setMaxTravelKm(next.maxTravelKm ?? 12);
    setChargesTravelExtra(next.chargesTravelExtra ?? false);

    setAvailabilityMode(next.availabilityMode ?? "FIJA");
    setAvailabilityBlocks(toAvailabilityBlocks(next.availabilityBlocks).length > 0 ? toAvailabilityBlocks(next.availabilityBlocks) : [{ day: "lunes", start: "09:00", end: "13:00" }]);
    setMaxServicesPerDay(next.maxServicesPerDay ?? 3);
    setAcceptsUrgentBookings(next.acceptsUrgentBookings ?? false);

    setHourlyRateClp(next.hourlyRateClp ?? 12000);
    setMinBookingHours(next.minBookingHours ?? 2);
    setWeekendSurchargePct(next.weekendSurchargePct ?? 15);
    setHolidaySurchargePct(next.holidaySurchargePct ?? 25);
    setRemoteCommuneSurchargeClp(next.remoteCommuneSurchargeClp ?? 4000);
    setHasDeepCleaningRate((next.deepCleaningHourlyRateClp ?? 0) > 0);
    setDeepCleaningHourlyRateClp(next.deepCleaningHourlyRateClp ?? 15000);

    setDocumentId(next.documentId ?? "");
    setBirthDate(next.birthDate ? new Date(next.birthDate).toISOString().slice(0, 10) : "");
    setNationality(next.nationality ?? "chilena");
    setMigrationStatus(next.migrationStatus ?? "");
    setEmergencyContactName(next.emergencyContactName ?? "");
    setEmergencyContactPhone(next.emergencyContactPhone ?? "");
    setWorkReferences(next.workReferences ?? "");
    setIdentityDocumentFrontFile(next.identityDocumentFrontFile ?? next.identityDocumentFile ?? "");
    setIdentityDocumentBackFile(next.identityDocumentBackFile ?? "");
    setIdentitySelfieFile(next.identitySelfieFile ?? "");
    setCriminalRecordFile(next.criminalRecordFile ?? "");
    setBankAccountHolder(next.bankAccountHolder ?? "");
    setBankAccountHolderRut(next.bankAccountHolderRut ?? "");
    setBankName(next.bankName ?? "");
    setBankAccountType(next.bankAccountType ?? "cuenta_corriente");
    setBankAccountNumber(next.bankAccountNumber ?? "");
    setBillingType(next.billingType ?? "persona_natural");

    setCompletedTopics(toStringArray(next.trainingTopics));
    setAcceptsCancellationPolicy(Boolean(next.acceptsCancellationPolicy));
    setAcceptsServiceProtocol(Boolean(next.acceptsServiceProtocol));
    setAcceptsDataProcessing(Boolean(next.acceptsDataProcessing));
    setConfirmsCleaningScope(Boolean(next.confirmsCleaningScope));
    setActiveStep(Math.min(9, Math.max(2, next.currentStep ?? 2)));
  };

  const loadSessionAndOnboarding = async () => {
    setLoading(true);
    try {
      const sessionRes = await fetch("/api/auth/session");
      const sessionData = (await sessionRes.json()) as { session?: SessionPayload | null };
      const nextSession = sessionData.session ?? null;
      setSession(nextSession);

      if (nextSession?.role === "PRO" && nextSession.userId) {
        const onboardingRes = await fetch("/api/onboarding/cleaning/me");
        const onboardingData = (await onboardingRes.json()) as {
          onboarding?: OnboardingPayload;
          user?: { fullName?: string | null; email?: string | null; phone?: string | null };
          error?: string;
          detail?: string;
        };
        if (!onboardingRes.ok || !onboardingData.onboarding) {
          throw new Error(onboardingData.detail || onboardingData.error || "No se pudo cargar onboarding");
        }
        hydrateFromOnboarding(onboardingData.onboarding);
        if (onboardingData.user?.fullName) setRegFullName(onboardingData.user.fullName);
        if (onboardingData.user?.email) setRegEmail(onboardingData.user.email);
        if (onboardingData.user?.phone) setRegPhone(onboardingData.user.phone);
      } else {
        setActiveStep(1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSessionAndOnboarding();
  }, []);

  const toggleInList = (value: string, list: string[], setter: (next: string[]) => void) => {
    if (list.includes(value)) setter(list.filter((item) => item !== value));
    else setter([...list, value]);
  };

  const selectSuggestedAddress = (value: string) => {
    setReferenceAddress(value);
    setAddressSuggestions([]);
    setShowSuggestions(false);
  };

  const uploadAsDataUrl = async (file: File | null, setter: (value: string) => void) => {
    if (!file) return;
    const content = await fileToDataUrl(file);
    setter(content);
  };

  const registerStage1 = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFeedback("");
    setError("");
    try {
      const response = await fetch("/api/onboarding/cleaning/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: regFullName,
          phone: regPhone,
          email: regEmail,
          password: regPassword,
          authProvider: "EMAIL",
          baseCommune,
          acceptTerms: regTerms
        })
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        detail?: string;
        emailVerificationRequired?: boolean;
        verificationTokenPreview?: string;
      };
      if (!response.ok || !data.ok) throw new Error(data.detail || data.error || "No se pudo crear cuenta");

      setFeedback(
        data.emailVerificationRequired
          ? `Cuenta creada. Verifica tu email para seguridad.${data.verificationTokenPreview ? ` Token dev: ${data.verificationTokenPreview}` : ""}`
          : "Cuenta creada. Continuemos con tu onboarding profesional."
      );
      await loadSessionAndOnboarding();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  const saveStep = async (step: number) => {
    setSaving(true);
    setFeedback("");
    setError("");

    try {
      let payload: Record<string, unknown> = {};

      if (step === 2) {
        payload = {
          profilePhotoUrl,
          shortDescription,
          yearsExperience,
          workMode,
          experienceTypes,
          referenceAddress
        };
      }

      if (step === 3) {
        payload = {
          offeredServices,
          acceptsHomesWithPets,
          acceptsHomesWithChildren,
          acceptsHomesWithElderly,
          worksWithClientProducts,
          bringsOwnProducts,
          bringsOwnTools,
          languages
        };
      }

      if (step === 4) {
        const lat = Number(coverageLatitude);
        const lng = Number(coverageLongitude);
        if (!referenceAddress.trim()) {
          throw new Error("Ingresa una direccion para definir la cobertura.");
        }
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          throw new Error("Debes seleccionar una ubicacion valida en el mapa.");
        }
        payload = {
          baseCommune,
          referenceAddress,
          serviceCommunes,
          coverageLatitude: lat,
          coverageLongitude: lng,
          maxTravelKm,
          chargesTravelExtra
        };
      }

      if (step === 5) {
        payload = {
          availabilityMode,
          availabilityBlocks,
          maxServicesPerDay,
          acceptsUrgentBookings
        };
      }

      if (step === 6) {
        payload = {
          hourlyRateClp,
          minBookingHours,
          weekendSurchargePct,
          holidaySurchargePct,
          remoteCommuneSurchargeClp,
          hasDeepCleaningRate,
          deepCleaningHourlyRateClp: hasDeepCleaningRate ? deepCleaningHourlyRateClp : null
        };
      }

      if (step === 7) {
        payload = {
          documentId,
          birthDate,
          nationality,
          migrationStatus,
          emergencyContactName,
          emergencyContactPhone,
          workReferences,
          identityDocumentFrontFile,
          identityDocumentBackFile,
          identitySelfieFile,
          criminalRecordFile,
          bankAccountHolder,
          bankAccountHolderRut,
          bankName,
          bankAccountType,
          bankAccountNumber,
          billingType
        };
      }

      if (step === 8) {
        payload = {
          completedTopics,
          acceptsCancellationPolicy,
          acceptsServiceProtocol,
          acceptsDataProcessing,
          confirmsCleaningScope
        };
      }

      const response = await fetch("/api/onboarding/cleaning/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step, payload })
      });

      const data = (await response.json()) as { ok?: boolean; error?: string; detail?: string; onboarding?: OnboardingPayload };
      if (!response.ok || !data.ok || !data.onboarding) throw new Error(data.detail || data.error || "No se pudo guardar etapa");

      hydrateFromOnboarding(data.onboarding);
      setActiveStep(Math.min(9, Math.max(activeStep + 1, data.onboarding.currentStep)));
      setFeedback("Etapa guardada correctamente.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  const sendPhoneCode = async () => {
    setSaving(true);
    setFeedback("");
    setError("");
    try {
      const response = await fetch("/api/onboarding/cleaning/phone/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: regPhone || undefined })
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; detail?: string; codePreview?: string };
      if (!response.ok || !data.ok) throw new Error(data.detail || data.error || "No se pudo enviar codigo");
      setFeedback(data.codePreview ? `Codigo enviado. Token dev: ${data.codePreview}` : "Codigo enviado a tu telefono.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  const verifyPhoneCode = async () => {
    setSaving(true);
    setFeedback("");
    setError("");
    try {
      const response = await fetch("/api/onboarding/cleaning/phone/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: phoneCode })
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; detail?: string; onboarding?: OnboardingPayload };
      if (!response.ok || !data.ok || !data.onboarding) throw new Error(data.detail || data.error || "No se pudo validar telefono");
      hydrateFromOnboarding(data.onboarding);
      setFeedback("Telefono validado correctamente.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  const submitForReview = async () => {
    setSaving(true);
    setFeedback("");
    setError("");
    try {
      const response = await fetch("/api/onboarding/cleaning/submit", { method: "POST" });
      const data = (await response.json()) as { ok?: boolean; error?: string; detail?: string; missingFields?: string[]; onboarding?: OnboardingPayload };
      if (!response.ok || !data.ok) {
        const missingFieldsText = data.missingFields?.length ? ` Faltan: ${data.missingFields.join(", ")}` : "";
        throw new Error((data.detail || data.error || "No se pudo enviar a revision") + missingFieldsText);
      }
      if (data.onboarding) hydrateFromOnboarding(data.onboarding);
      setFeedback("Perfil enviado a revision manual. Te avisaremos cuando quede aprobado.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="page market-shell">
        <MarketNav />
        <section className="panel">
          <p className="empty">Cargando onboarding...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page market-shell">
      <MarketNav />

      <section className="panel mvp-lead-panel">
        <div className="panel-head">
          <h2>Onboarding profesional · {selectedServiceLabel}</h2>
          <p>Completa el onboarding de arriba hacia abajo para activar tu perfil y comenzar a recibir reservas.</p>
        </div>

        {onboarding ? (
          <p className="minimal-note">
            Estado actual: <strong>{CLEANING_STATUS_LABELS[onboarding.status]}</strong>
            {onboarding.adminReviewNotes ? ` · Nota admin: ${onboarding.adminReviewNotes}` : ""}
          </p>
        ) : null}

        {selectedService !== "limpieza" ? (
          <p className="minimal-note">
            Seleccionaste <strong>{selectedServiceLabel}</strong>. Las preguntas de experiencia y servicios se adaptan a esta especialidad.
          </p>
        ) : null}

        {activeStep === 1 ? (
          <form className="grid-form" onSubmit={registerStage1}>
            <label>
              Nombre completo
              <input value={regFullName} onChange={(event) => setRegFullName(event.target.value)} required />
            </label>
            <label>
              Telefono
              <input value={regPhone} onChange={(event) => setRegPhone(event.target.value)} required />
            </label>
            <label>
              Email
              <input type="email" value={regEmail} onChange={(event) => setRegEmail(event.target.value)} required />
            </label>
            <label>
              Contrasena
              <input type="password" value={regPassword} onChange={(event) => setRegPassword(event.target.value)} minLength={8} required />
            </label>
            <div className="full inline-option-row">
              <label className="inline-check-option">
                <input type="checkbox" checked={regTerms} onChange={(event) => setRegTerms(event.target.checked)} required />
                <span>
                  Acepto los{" "}
                  <Link href="/legal#terminos" target="_blank" rel="noreferrer">
                    terminos y condiciones
                  </Link>
                </span>
              </label>
            </div>
            <div className="cta-row full">
              <button type="submit" className="cta" disabled={saving}>
                {saving ? "Creando cuenta..." : "Continuar onboarding"}
              </button>
            </div>
          </form>
        ) : null}

        {session && session.role !== "PRO" && activeStep > 1 ? (
          <p className="feedback error">Tu cuenta actual no es de profesional. Inicia sesion como tasker para continuar.</p>
        ) : null}

        {session?.role === "PRO" ? (
          <div className="grid-form">
            <h3 className="full">1. Perfil profesional</h3>
            <label>
              Foto de perfil
              <input type="file" accept="image/png,image/jpeg" onChange={(event) => void uploadAsDataUrl(event.target.files?.[0] ?? null, setProfilePhotoUrl)} />
            </label>
            <label className="full">
              Descripcion corta
              <textarea value={shortDescription} onChange={(event) => setShortDescription(event.target.value)} />
            </label>
            <label>
              Anos de experiencia
              <input type="number" min={0} max={60} value={yearsExperience} onChange={(event) => setYearsExperience(Number(event.target.value) || 0)} />
            </label>
            <label>
              Modalidad
              <select value={workMode} onChange={(event) => setWorkMode(event.target.value as "SOLO" | "EQUIPO") }>
                <option value="SOLO">Trabajo sola/o</option>
                <option value="EQUIPO">Trabajo en equipo</option>
              </select>
            </label>
            <div className="full">
              <p className="field-label">Tipo de experiencia</p>
              <div className="inline-checks">
                {activeExperienceOptions.map((item) => (
                  <label key={item}>
                    <input type="checkbox" checked={experienceTypes.includes(item)} onChange={() => toggleInList(item, experienceTypes, setExperienceTypes)} />
                    {item.replace(/_/g, " ")}
                  </label>
                ))}
              </div>
            </div>
            <label className="full">
              Direccion referencial
              <input value={referenceAddress} onChange={(event) => setReferenceAddress(event.target.value)} placeholder="Ej: Av. Apoquindo 1234, depto 45" />
            </label>
            <div className="cta-row full">
              <button type="button" className="cta" onClick={() => void saveStep(2)} disabled={saving}>
                {saving ? "Guardando..." : "Guardar perfil profesional"}
              </button>
            </div>
          </div>
        ) : null}

        {session?.role === "PRO" ? (
          <div className="grid-form">
            <h3 className="full">2. Servicios que ofreces</h3>
            <div className="full">
              <p className="field-label">Servicios ofrecidos</p>
              <div className="inline-checks">
                {activeOfferedServices.map((item) => (
                  <label key={item}>
                    <input type="checkbox" checked={offeredServices.includes(item)} onChange={() => toggleInList(item, offeredServices, setOfferedServices)} />
                    {item.replace(/_/g, " ")}
                  </label>
                ))}
              </div>
            </div>
            <div className="full inline-options-stack">
              <label className="inline-check-option">
                <input type="checkbox" checked={acceptsHomesWithPets} onChange={(event) => setAcceptsHomesWithPets(event.target.checked)} />
                <span>{activeDynamicLabels.first}</span>
              </label>
              <label className="inline-check-option">
                <input type="checkbox" checked={acceptsHomesWithChildren} onChange={(event) => setAcceptsHomesWithChildren(event.target.checked)} />
                <span>{activeDynamicLabels.second}</span>
              </label>
              <label className="inline-check-option">
                <input type="checkbox" checked={acceptsHomesWithElderly} onChange={(event) => setAcceptsHomesWithElderly(event.target.checked)} />
                <span>{activeDynamicLabels.third}</span>
              </label>
              <label className="inline-check-option">
                <input type="checkbox" checked={worksWithClientProducts} onChange={(event) => setWorksWithClientProducts(event.target.checked)} />
                <span>{activeDynamicLabels.products}</span>
              </label>
              <label className="inline-check-option">
                <input type="checkbox" checked={bringsOwnProducts} onChange={(event) => setBringsOwnProducts(event.target.checked)} />
                <span>{activeDynamicLabels.ownProducts}</span>
              </label>
              <label className="inline-check-option">
                <input type="checkbox" checked={bringsOwnTools} onChange={(event) => setBringsOwnTools(event.target.checked)} />
                <span>{activeDynamicLabels.ownTools}</span>
              </label>
            </div>
            <div className="full">
              <p className="field-label">Idiomas</p>
              <div className="inline-checks">
                {CLEANING_LANGUAGE_OPTIONS.map((item) => (
                  <label key={item}>
                    <input type="checkbox" checked={languages.includes(item)} onChange={() => toggleInList(item, languages, setLanguages)} />
                    {item}
                  </label>
                ))}
              </div>
            </div>
            <div className="cta-row full">
              <button type="button" className="cta" onClick={() => void saveStep(3)} disabled={saving}>
                {saving ? "Guardando..." : "Guardar servicios"}
              </button>
            </div>
          </div>
        ) : null}

        {session?.role === "PRO" ? (
          <div className="grid-form">
            <h3 className="full">3. Cobertura geografica</h3>
            <label>
              Radio maximo de desplazamiento (km)
              <input type="number" min={1} max={80} value={maxTravelKm} onChange={(event) => setMaxTravelKm(Number(event.target.value) || 1)} />
            </label>
            <label className="full">
              Direccion base para mapa de cobertura
              <input
                value={referenceAddress}
                onChange={(event) => {
                  setReferenceAddress(event.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => {
                  if (addressSuggestions.length > 0) setShowSuggestions(true);
                }}
                onBlur={() => {
                  setTimeout(() => setShowSuggestions(false), 120);
                }}
                placeholder="Ej: Av. Apoquindo 1234"
                autoComplete="off"
              />
              {showSuggestions && addressSuggestions.length > 0 ? (
                <div className="address-suggestions">
                  {addressSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="address-suggestion-btn"
                      onMouseDown={() => selectSuggestedAddress(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              ) : null}
              {autocompleteLoading ? <small className="input-hint">Buscando direcciones en Google...</small> : null}
              <small className="input-hint">
                {addressValidationState === "idle" ? "Escribe una direccion para ubicar tu casa en el mapa." : null}
                {addressValidationState === "validating" ? "Validando direccion..." : null}
                {addressValidationState === "verified"
                  ? "Direccion validada por Google Maps."
                  : null}
                {addressValidationState === "fallback"
                  ? "No hubo validacion exacta de Google. Usamos una ubicacion estimada por comuna."
                  : null}
              </small>
            </label>
            <label>
              Comuna de referencia
              <select value={baseCommune} onChange={(event) => setBaseCommune(event.target.value)}>
                {CHILE_TOP_COMMUNES.map((commune) => (
                  <option key={commune} value={commune}>
                    {commune}
                  </option>
                ))}
              </select>
            </label>
            {addressValidationState === "verified" && validatedAddress ? (
              <p className="address-confirmation full">
                Direccion confirmada: <strong>{validatedAddress}</strong>
              </p>
            ) : null}
            {addressValidationState === "fallback" ? (
              <p className="address-warning full">No se pudo confirmar exacto con Google Maps. Revisa calle y numeracion.</p>
            ) : null}
            <div className="full">
              <p className="field-label">Comunas donde atiendes</p>
              <div className="commune-picker-row">
                <select value={communeToAdd} onChange={(event) => setCommuneToAdd(event.target.value)}>
                  {CHILE_TOP_COMMUNES.map((commune) => (
                    <option key={commune} value={commune}>
                      {commune}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="cta ghost small compact-btn"
                  onClick={() =>
                    setServiceCommunes((current) => (current.includes(communeToAdd) ? current : [...current, communeToAdd]))
                  }
                >
                  Agregar comuna
                </button>
              </div>
              <div className="commune-chip-list">
                {serviceCommunes.length === 0 ? <span className="commune-empty">Aun no agregas comunas.</span> : null}
                {serviceCommunes.map((commune) => (
                  <span key={commune} className="commune-chip">
                    {commune}
                    <button
                      type="button"
                      onClick={() => setServiceCommunes((current) => current.filter((item) => item !== commune))}
                      aria-label={`Quitar ${commune}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
            <article className="coverage-map-card full">
              <header className="coverage-map-head">
                <h3>Mapa en tiempo real de tu zona de servicio</h3>
                <p>La casa marca tu direccion base. Usa + y - para acercar o alejar el mapa.</p>
              </header>
              <div className="coverage-map-toolbar">
                <button type="button" className="map-zoom-btn" onClick={() => setMapZoom((current) => Math.max(11, current - 1))} aria-label="Alejar mapa">
                  -
                </button>
                <span>Zoom {mapZoom}</span>
                <button type="button" className="map-zoom-btn" onClick={() => setMapZoom((current) => Math.min(18, current + 1))} aria-label="Acercar mapa">
                  +
                </button>
              </div>
              <div className="coverage-map-wrap">
                <div className="coverage-map-interactive">
                  <iframe
                    title="Mapa cobertura profesional"
                    className="coverage-map-frame"
                    src={mapEmbedUrl}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                  <div className="coverage-pin coverage-pin-center">
                    <span
                      className="coverage-pin-radius"
                      style={{ width: `${radiusPx * 2}px`, height: `${radiusPx * 2}px` }}
                    />
                    <span
                      className="coverage-pin-dot"
                      style={{
                        width: "26px",
                        height: "26px",
                        display: "grid",
                        placeItems: "center",
                        fontSize: "12px",
                        background: "#0f7cab"
                      }}
                    >
                      🏠
                    </span>
                  </div>
                </div>
              </div>
              <p className="coverage-meta">
                Coordenadas base: {mapLat.toFixed(6)}, {mapLng.toFixed(6)} · Radio activo: {maxTravelKm} km
              </p>
            </article>
            <div className="full inline-option-row">
              <label className="inline-check-option">
                <input type="checkbox" checked={chargesTravelExtra} onChange={(event) => setChargesTravelExtra(event.target.checked)} />
                <span>Cobro extra por traslado</span>
              </label>
            </div>
            <div className="cta-row full">
              <button type="button" className="cta" onClick={() => void saveStep(4)} disabled={saving}>
                {saving ? "Guardando..." : "Guardar cobertura"}
              </button>
            </div>
          </div>
        ) : null}

        {session?.role === "PRO" ? (
          <div className="grid-form">
            <h3 className="full">4. Disponibilidad</h3>
            <label>
              Tipo de disponibilidad
              <select value={availabilityMode} onChange={(event) => setAvailabilityMode(event.target.value as "FIJA" | "VARIABLE") }>
                <option value="FIJA">Fija</option>
                <option value="VARIABLE">Variable</option>
              </select>
            </label>
            <label>
              Maximo servicios por dia
              <input type="number" min={1} max={12} value={maxServicesPerDay} onChange={(event) => setMaxServicesPerDay(Number(event.target.value) || 1)} />
            </label>
            <label className="full">
              Bloques horarios
              <div className="list">
                {availabilityBlocks.map((block, index) => (
                  <article key={`${block.day}-${index}`} className="module-card">
                    <div className="query-row query-availability">
                      <label>
                        Dia
                        <select
                          value={block.day}
                          onChange={(event) => {
                            const next = [...availabilityBlocks];
                            next[index] = { ...next[index], day: event.target.value as (typeof CLEANING_WEEK_DAYS)[number] };
                            setAvailabilityBlocks(next);
                          }}
                        >
                          {CLEANING_WEEK_DAYS.map((day) => (
                            <option key={day} value={day}>
                              {day}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Inicio
                        <input
                          type="time"
                          value={block.start}
                          onChange={(event) => {
                            const next = [...availabilityBlocks];
                            next[index] = { ...next[index], start: event.target.value };
                            setAvailabilityBlocks(next);
                          }}
                        />
                      </label>
                      <label>
                        Termino
                        <input
                          type="time"
                          value={block.end}
                          onChange={(event) => {
                            const next = [...availabilityBlocks];
                            next[index] = { ...next[index], end: event.target.value };
                            setAvailabilityBlocks(next);
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        className="cta ghost small compact-btn"
                        onClick={() => setAvailabilityBlocks((current) => current.filter((_, blockIndex) => blockIndex !== index))}
                        disabled={availabilityBlocks.length === 1}
                      >
                        Quitar
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </label>
            <div className="cta-row full">
              <button
                type="button"
                className="cta ghost small compact-btn"
                onClick={() =>
                  setAvailabilityBlocks((current) => [...current, { day: "lunes", start: "14:00", end: "18:00" }])
                }
              >
                Agregar bloque
              </button>
            </div>
            <div className="full inline-option-row">
              <label className="inline-check-option">
                <input type="checkbox" checked={acceptsUrgentBookings} onChange={(event) => setAcceptsUrgentBookings(event.target.checked)} />
                <span>Acepto reservas urgentes</span>
              </label>
            </div>
            <div className="cta-row full">
              <button type="button" className="cta" onClick={() => void saveStep(5)} disabled={saving}>
                {saving ? "Guardando..." : "Guardar disponibilidad"}
              </button>
            </div>
          </div>
        ) : null}

        {session?.role === "PRO" ? (
          <div className="grid-form">
            <h3 className="full">5. Tarifas</h3>
            <label>
              Tarifa por hora (CLP)
              <input type="number" min={5000} value={hourlyRateClp} onChange={(event) => setHourlyRateClp(Number(event.target.value) || 5000)} />
            </label>
            <label>
              Minimo de horas por reserva
              <input type="number" min={1} max={12} value={minBookingHours} onChange={(event) => setMinBookingHours(Number(event.target.value) || 1)} />
            </label>
            <label>
              Recargo fin de semana (%)
              <input type="number" min={0} max={100} value={weekendSurchargePct} onChange={(event) => setWeekendSurchargePct(Number(event.target.value) || 0)} />
            </label>
            <label>
              Recargo festivos (%)
              <input type="number" min={0} max={100} value={holidaySurchargePct} onChange={(event) => setHolidaySurchargePct(Number(event.target.value) || 0)} />
            </label>
            <label>
              Recargo comuna lejana (CLP)
              <input
                type="number"
                min={0}
                value={remoteCommuneSurchargeClp}
                onChange={(event) => setRemoteCommuneSurchargeClp(Number(event.target.value) || 0)}
              />
            </label>
            <label className="full">
              <div className="inline-checks">
                <label>
                  <input type="checkbox" checked={hasDeepCleaningRate} onChange={(event) => setHasDeepCleaningRate(event.target.checked)} />
                  Tengo precio distinto para limpieza profunda
                </label>
              </div>
            </label>
            {hasDeepCleaningRate ? (
              <label>
                Tarifa limpieza profunda (CLP/h)
                <input
                  type="number"
                  min={5000}
                  value={deepCleaningHourlyRateClp}
                  onChange={(event) => setDeepCleaningHourlyRateClp(Number(event.target.value) || 5000)}
                />
              </label>
            ) : null}
            <div className="cta-row full">
              <button type="button" className="cta" onClick={() => void saveStep(6)} disabled={saving}>
                {saving ? "Guardando..." : "Guardar tarifas"}
              </button>
            </div>
          </div>
        ) : null}

        {session?.role === "PRO" ? (
          <div className="grid-form">
            <h3 className="full">6. Verificacion y pagos</h3>
            <label>
              RUT o documento
              <input value={documentId} onChange={(event) => setDocumentId(event.target.value)} placeholder="12.345.678-9" />
            </label>
            <label>
              Fecha de nacimiento
              <input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
            </label>
            <label>
              Nacionalidad
              <input value={nationality} onChange={(event) => setNationality(event.target.value)} />
            </label>
            <label>
              Situacion migratoria (si aplica)
              <input value={migrationStatus} onChange={(event) => setMigrationStatus(event.target.value)} placeholder="Residencia definitiva / temporal" />
            </label>
            <label>
              Contacto de emergencia (nombre)
              <input value={emergencyContactName} onChange={(event) => setEmergencyContactName(event.target.value)} />
            </label>
            <label>
              Contacto de emergencia (telefono)
              <input value={emergencyContactPhone} onChange={(event) => setEmergencyContactPhone(event.target.value)} />
            </label>
            <label className="full">
              Referencias laborales o personales
              <textarea value={workReferences} onChange={(event) => setWorkReferences(event.target.value)} placeholder="Nombre, relacion y telefono de al menos una referencia" />
            </label>
            <label>
              Cedula (frente)
              <input type="file" accept="image/png,image/jpeg" onChange={(event) => void uploadAsDataUrl(event.target.files?.[0] ?? null, setIdentityDocumentFrontFile)} />
            </label>
            <label>
              Cedula (reverso)
              <input type="file" accept="image/png,image/jpeg" onChange={(event) => void uploadAsDataUrl(event.target.files?.[0] ?? null, setIdentityDocumentBackFile)} />
            </label>
            <label>
              Selfie de validacion
              <input type="file" accept="image/png,image/jpeg" onChange={(event) => void uploadAsDataUrl(event.target.files?.[0] ?? null, setIdentitySelfieFile)} />
            </label>
            <label>
              Certificado de antecedentes
              <input type="file" accept="application/pdf,image/png,image/jpeg" onChange={(event) => void uploadAsDataUrl(event.target.files?.[0] ?? null, setCriminalRecordFile)} />
            </label>
            <label>
              Titular cuenta bancaria
              <input value={bankAccountHolder} onChange={(event) => setBankAccountHolder(event.target.value)} />
            </label>
            <label>
              RUT titular cuenta
              <input value={bankAccountHolderRut} onChange={(event) => setBankAccountHolderRut(event.target.value)} />
            </label>
            <label>
              Banco
              <input value={bankName} onChange={(event) => setBankName(event.target.value)} />
            </label>
            <label>
              Tipo de cuenta
              <select value={bankAccountType} onChange={(event) => setBankAccountType(event.target.value)}>
                <option value="cuenta_corriente">Cuenta corriente</option>
                <option value="cuenta_vista">Cuenta vista</option>
                <option value="cuenta_rut">Cuenta RUT</option>
                <option value="cuenta_ahorro">Cuenta ahorro</option>
              </select>
            </label>
            <label>
              Numero de cuenta
              <input value={bankAccountNumber} onChange={(event) => setBankAccountNumber(event.target.value)} />
            </label>
            <label>
              Tipo de facturacion
              <select value={billingType} onChange={(event) => setBillingType(event.target.value)}>
                <option value="persona_natural">Persona natural</option>
                <option value="boleta_honorarios">Emito boleta</option>
              </select>
            </label>

            <label>
              Telefono para validacion
              <input value={regPhone} onChange={(event) => setRegPhone(event.target.value)} placeholder="+56 9 ..." />
            </label>

            <label>
              Codigo de telefono
              <input value={phoneCode} onChange={(event) => setPhoneCode(event.target.value)} maxLength={6} placeholder="123456" />
            </label>

            <div className="cta-row full">
              <button type="button" className="cta ghost small" onClick={() => void sendPhoneCode()} disabled={saving}>
                Enviar codigo
              </button>
              <button type="button" className="cta ghost small" onClick={() => void verifyPhoneCode()} disabled={saving || phoneCode.length !== 6}>
                Verificar telefono
              </button>
              <span className="minimal-note">Telefono validado: {phoneValidated ? "si" : "no"}</span>
            </div>

            <div className="cta-row full">
              <button type="button" className="cta" onClick={() => void saveStep(7)} disabled={saving}>
                {saving ? "Guardando..." : "Guardar verificacion"}
              </button>
            </div>
          </div>
        ) : null}

        {session?.role === "PRO" ? (
          <div className="grid-form">
            <h3 className="full">7. Capacitacion y politicas</h3>
            <div className="full">
              <p className="field-label">Mini induccion obligatoria</p>
              <div className="inline-checks">
                {CLEANING_TRAINING_TOPICS.map((topic) => (
                  <label key={topic}>
                    <input
                      type="checkbox"
                      checked={completedTopics.includes(topic)}
                      onChange={() => toggleInList(topic, completedTopics, setCompletedTopics)}
                    />
                    {topic.replace(/_/g, " ")}
                  </label>
                ))}
              </div>
            </div>
            <div className="full inline-options-stack">
              <label className="inline-check-option">
                <input type="checkbox" checked={acceptsCancellationPolicy} onChange={(event) => setAcceptsCancellationPolicy(event.target.checked)} />
                <span>Acepto politica de cancelacion</span>
              </label>
              <label className="inline-check-option">
                <input type="checkbox" checked={acceptsServiceProtocol} onChange={(event) => setAcceptsServiceProtocol(event.target.checked)} />
                <span>Acepto protocolo de servicio</span>
              </label>
              <label className="inline-check-option">
                <input type="checkbox" checked={acceptsDataProcessing} onChange={(event) => setAcceptsDataProcessing(event.target.checked)} />
                <span>Autorizo tratamiento de datos</span>
              </label>
              <label className="inline-check-option">
                <input type="checkbox" checked={confirmsCleaningScope} onChange={(event) => setConfirmsCleaningScope(event.target.checked)} />
                <span>Confirmo que entiendo que incluye y que no incluye una limpieza</span>
              </label>
            </div>
            <div className="cta-row full">
              <button type="button" className="cta" onClick={() => void saveStep(8)} disabled={saving}>
                {saving ? "Guardando..." : "Guardar capacitacion"}
              </button>
            </div>
          </div>
        ) : null}

        {session?.role === "PRO" ? (
          <div className="grid-form">
            <div className="full module-card">
              <h3>8. Revision y activacion</h3>
              <p>
                Estado actual: <strong>{onboarding ? CLEANING_STATUS_LABELS[onboarding.status] : "borrador"}</strong>
              </p>
              <p>El perfil no se activa automaticamente. Un administrador debe revisarlo y activarlo manualmente.</p>
              {onboarding?.submittedAt ? <p>Enviado a revision: {new Date(onboarding.submittedAt).toLocaleString("es-CL")}</p> : null}
              {onboarding?.adminReviewNotes ? <p>Observaciones: {onboarding.adminReviewNotes}</p> : null}
            </div>
            <div className="cta-row full">
              <button type="button" className="cta" onClick={() => void submitForReview()} disabled={saving}>
                {saving ? "Enviando..." : "Enviar a revision"}
              </button>
            </div>
          </div>
        ) : null}

        {feedback ? <p className="feedback ok">{feedback}</p> : null}
        {error ? <p className="feedback error">{error}</p> : null}
      </section>
    </main>
  );
}
