"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { MarketNav } from "@/components/market-nav";
import {
  CHILE_TOP_COMMUNES,
  CLEANING_EXPERIENCE_TYPES,
  CLEANING_ONBOARDING_STEPS,
  CLEANING_SERVICE_TYPES,
  CLEANING_TRAINING_TOPICS,
  CLEANING_WEEK_DAYS,
  CLEANING_STATUS_LABELS
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
  profilePhotoUrl: string | null;
  shortDescription: string | null;
  yearsExperience: number | null;
  workMode: "SOLO" | "EQUIPO" | null;
  experienceTypes: unknown;
  offeredServices: unknown;
  acceptsHomesWithPets: boolean | null;
  acceptsHomesWithChildren: boolean | null;
  worksWithClientProducts: boolean | null;
  bringsOwnProducts: boolean | null;
  bringsOwnTools: boolean | null;
  serviceCommunes: unknown;
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
  identitySelfieFile: string | null;
  criminalRecordFile: string | null;
  bankAccountHolder: string | null;
  bankName: string | null;
  bankAccountType: string | null;
  bankAccountNumber: string | null;
  phoneValidatedAt: string | null;
  trainingTopics: unknown;
  trainingCompletedAt: string | null;
  submittedAt: string | null;
  adminReviewNotes: string | null;
};

type AvailabilityBlock = {
  day: (typeof CLEANING_WEEK_DAYS)[number];
  start: string;
  end: string;
};

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const [regFullName, setRegFullName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regAuthProvider, setRegAuthProvider] = useState<"EMAIL" | "GOOGLE" | "APPLE">("EMAIL");
  const [regBaseCommune, setRegBaseCommune] = useState("Las Condes");
  const [regTerms, setRegTerms] = useState(false);

  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [yearsExperience, setYearsExperience] = useState(2);
  const [workMode, setWorkMode] = useState<"SOLO" | "EQUIPO">("SOLO");
  const [experienceTypes, setExperienceTypes] = useState<string[]>([]);

  const [offeredServices, setOfferedServices] = useState<string[]>([]);
  const [acceptsHomesWithPets, setAcceptsHomesWithPets] = useState(true);
  const [acceptsHomesWithChildren, setAcceptsHomesWithChildren] = useState(true);
  const [worksWithClientProducts, setWorksWithClientProducts] = useState(true);
  const [bringsOwnProducts, setBringsOwnProducts] = useState(false);
  const [bringsOwnTools, setBringsOwnTools] = useState(false);

  const [baseCommune, setBaseCommune] = useState("Las Condes");
  const [serviceCommunes, setServiceCommunes] = useState<string[]>([]);
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

  const [identityDocumentFile, setIdentityDocumentFile] = useState("");
  const [identitySelfieFile, setIdentitySelfieFile] = useState("");
  const [criminalRecordFile, setCriminalRecordFile] = useState("");
  const [bankAccountHolder, setBankAccountHolder] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountType, setBankAccountType] = useState("cuenta_corriente");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [phoneCode, setPhoneCode] = useState("");

  const [completedTopics, setCompletedTopics] = useState<string[]>([]);

  const phoneValidated = Boolean(onboarding?.phoneValidatedAt);
  const canAccessStep = useMemo(() => {
    if (!session || session.role !== "PRO") return 1;
    return Math.max(2, onboarding?.currentStep ?? 2);
  }, [onboarding?.currentStep, session]);

  const hydrateFromOnboarding = (next: OnboardingPayload) => {
    setOnboarding(next);
    setBaseCommune(next.baseCommune ?? "Las Condes");

    setProfilePhotoUrl(next.profilePhotoUrl ?? "");
    setShortDescription(next.shortDescription ?? "");
    setYearsExperience(next.yearsExperience ?? 2);
    setWorkMode(next.workMode ?? "SOLO");
    setExperienceTypes(toStringArray(next.experienceTypes));

    setOfferedServices(toStringArray(next.offeredServices));
    setAcceptsHomesWithPets(next.acceptsHomesWithPets ?? true);
    setAcceptsHomesWithChildren(next.acceptsHomesWithChildren ?? true);
    setWorksWithClientProducts(next.worksWithClientProducts ?? true);
    setBringsOwnProducts(next.bringsOwnProducts ?? false);
    setBringsOwnTools(next.bringsOwnTools ?? false);

    setServiceCommunes(toStringArray(next.serviceCommunes));
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

    setIdentityDocumentFile(next.identityDocumentFile ?? "");
    setIdentitySelfieFile(next.identitySelfieFile ?? "");
    setCriminalRecordFile(next.criminalRecordFile ?? "");
    setBankAccountHolder(next.bankAccountHolder ?? "");
    setBankName(next.bankName ?? "");
    setBankAccountType(next.bankAccountType ?? "cuenta_corriente");
    setBankAccountNumber(next.bankAccountNumber ?? "");

    setCompletedTopics(toStringArray(next.trainingTopics));
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
          password: regAuthProvider === "EMAIL" ? regPassword : undefined,
          authProvider: regAuthProvider,
          baseCommune: regBaseCommune,
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
          experienceTypes
        };
      }

      if (step === 3) {
        payload = {
          offeredServices,
          acceptsHomesWithPets,
          acceptsHomesWithChildren,
          worksWithClientProducts,
          bringsOwnProducts,
          bringsOwnTools
        };
      }

      if (step === 4) {
        payload = {
          baseCommune,
          serviceCommunes,
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
          identityDocumentFile,
          identitySelfieFile,
          criminalRecordFile,
          bankAccountHolder,
          bankName,
          bankAccountType,
          bankAccountNumber
        };
      }

      if (step === 8) {
        payload = {
          completedTopics
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

  const stepButtons = (
    <div className="cta-row full">
      {activeStep > 1 ? (
        <button type="button" className="cta ghost" onClick={() => setActiveStep((current) => Math.max(1, current - 1))} disabled={saving}>
          Volver
        </button>
      ) : null}
      {activeStep >= 2 && activeStep <= 8 ? (
        <button type="button" className="cta" onClick={() => void saveStep(activeStep)} disabled={saving}>
          {saving ? "Guardando..." : "Guardar y continuar"}
        </button>
      ) : null}
    </div>
  );

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
          <h2>Onboarding profesional de limpieza</h2>
          <p>Completa las 9 etapas para activar tu perfil y comenzar a recibir reservas por hora.</p>
        </div>

        <div className="inline-checks">
          {CLEANING_ONBOARDING_STEPS.map((item) => (
            <button
              key={item.step}
              type="button"
              className={item.step === activeStep ? "cta small" : "cta ghost small"}
              onClick={() => setActiveStep(item.step)}
              disabled={item.step > canAccessStep}
            >
              {item.step}. {item.label}
            </button>
          ))}
        </div>

        {onboarding ? (
          <p className="minimal-note">
            Estado actual: <strong>{CLEANING_STATUS_LABELS[onboarding.status]}</strong>
            {onboarding.adminReviewNotes ? ` · Nota admin: ${onboarding.adminReviewNotes}` : ""}
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
              Tipo de acceso
              <select value={regAuthProvider} onChange={(event) => setRegAuthProvider(event.target.value as "EMAIL" | "GOOGLE" | "APPLE") }>
                <option value="EMAIL">Email + contrasena</option>
                <option value="GOOGLE">Google</option>
                <option value="APPLE">Apple</option>
              </select>
            </label>
            {regAuthProvider === "EMAIL" ? (
              <label>
                Contrasena
                <input type="password" value={regPassword} onChange={(event) => setRegPassword(event.target.value)} minLength={8} required />
              </label>
            ) : null}
            <label>
              Comuna base
              <select value={regBaseCommune} onChange={(event) => setRegBaseCommune(event.target.value)}>
                {CHILE_TOP_COMMUNES.map((commune) => (
                  <option key={commune} value={commune}>
                    {commune}
                  </option>
                ))}
              </select>
            </label>
            <label className="full">
              <div className="inline-checks">
                <label>
                  <input type="checkbox" checked={regTerms} onChange={(event) => setRegTerms(event.target.checked)} required />
                  Acepto terminos y condiciones
                </label>
              </div>
            </label>
            <div className="cta-row full">
              <button type="submit" className="cta" disabled={saving}>
                {saving ? "Creando cuenta..." : "Continuar onboarding"}
              </button>
              <Link href="/ingresar/tasker" className="cta ghost">
                Ya tengo cuenta
              </Link>
            </div>
          </form>
        ) : null}

        {session && session.role !== "PRO" && activeStep > 1 ? (
          <p className="feedback error">Tu cuenta actual no es de profesional. Inicia sesion como tasker para continuar.</p>
        ) : null}

        {session?.role === "PRO" && activeStep === 2 ? (
          <div className="grid-form">
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
            <label className="full">
              Tipo de experiencia
              <div className="inline-checks">
                {CLEANING_EXPERIENCE_TYPES.map((item) => (
                  <label key={item}>
                    <input type="checkbox" checked={experienceTypes.includes(item)} onChange={() => toggleInList(item, experienceTypes, setExperienceTypes)} />
                    {item.replace(/_/g, " ")}
                  </label>
                ))}
              </div>
            </label>
            {stepButtons}
          </div>
        ) : null}

        {session?.role === "PRO" && activeStep === 3 ? (
          <div className="grid-form">
            <label className="full">
              Servicios ofrecidos
              <div className="inline-checks">
                {CLEANING_SERVICE_TYPES.map((item) => (
                  <label key={item}>
                    <input type="checkbox" checked={offeredServices.includes(item)} onChange={() => toggleInList(item, offeredServices, setOfferedServices)} />
                    {item.replace(/_/g, " ")}
                  </label>
                ))}
              </div>
            </label>
            <label>
              <div className="inline-checks">
                <label>
                  <input type="checkbox" checked={acceptsHomesWithPets} onChange={(event) => setAcceptsHomesWithPets(event.target.checked)} />
                  Acepto casas con mascotas
                </label>
              </div>
            </label>
            <label>
              <div className="inline-checks">
                <label>
                  <input type="checkbox" checked={acceptsHomesWithChildren} onChange={(event) => setAcceptsHomesWithChildren(event.target.checked)} />
                  Acepto hogares con ninos
                </label>
              </div>
            </label>
            <label>
              <div className="inline-checks">
                <label>
                  <input type="checkbox" checked={worksWithClientProducts} onChange={(event) => setWorksWithClientProducts(event.target.checked)} />
                  Trabajo con productos del cliente
                </label>
              </div>
            </label>
            <label>
              <div className="inline-checks">
                <label>
                  <input type="checkbox" checked={bringsOwnProducts} onChange={(event) => setBringsOwnProducts(event.target.checked)} />
                  Llevo productos propios
                </label>
              </div>
            </label>
            <label>
              <div className="inline-checks">
                <label>
                  <input type="checkbox" checked={bringsOwnTools} onChange={(event) => setBringsOwnTools(event.target.checked)} />
                  Llevo implementos propios
                </label>
              </div>
            </label>
            {stepButtons}
          </div>
        ) : null}

        {session?.role === "PRO" && activeStep === 4 ? (
          <div className="grid-form">
            <label>
              Comuna base
              <input value={baseCommune} onChange={(event) => setBaseCommune(event.target.value)} />
            </label>
            <label>
              Radio maximo de desplazamiento (km)
              <input type="number" min={1} max={80} value={maxTravelKm} onChange={(event) => setMaxTravelKm(Number(event.target.value) || 1)} />
            </label>
            <label className="full">
              Comunas donde atiendes
              <div className="inline-checks">
                {CHILE_TOP_COMMUNES.map((item) => (
                  <label key={item}>
                    <input type="checkbox" checked={serviceCommunes.includes(item)} onChange={() => toggleInList(item, serviceCommunes, setServiceCommunes)} />
                    {item}
                  </label>
                ))}
              </div>
            </label>
            <label className="full">
              <div className="inline-checks">
                <label>
                  <input type="checkbox" checked={chargesTravelExtra} onChange={(event) => setChargesTravelExtra(event.target.checked)} />
                  Cobro extra por traslado
                </label>
              </div>
            </label>
            {stepButtons}
          </div>
        ) : null}

        {session?.role === "PRO" && activeStep === 5 ? (
          <div className="grid-form">
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
                    <div className="query-row query-single">
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
                        className="cta ghost small"
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
                className="cta ghost small"
                onClick={() =>
                  setAvailabilityBlocks((current) => [...current, { day: "lunes", start: "14:00", end: "18:00" }])
                }
              >
                Agregar bloque
              </button>
            </div>
            <label className="full">
              <div className="inline-checks">
                <label>
                  <input type="checkbox" checked={acceptsUrgentBookings} onChange={(event) => setAcceptsUrgentBookings(event.target.checked)} />
                  Acepto reservas urgentes
                </label>
              </div>
            </label>
            {stepButtons}
          </div>
        ) : null}

        {session?.role === "PRO" && activeStep === 6 ? (
          <div className="grid-form">
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
            {stepButtons}
          </div>
        ) : null}

        {session?.role === "PRO" && activeStep === 7 ? (
          <div className="grid-form">
            <label>
              Documento identidad
              <input type="file" accept="application/pdf,image/png,image/jpeg" onChange={(event) => void uploadAsDataUrl(event.target.files?.[0] ?? null, setIdentityDocumentFile)} />
            </label>
            <label>
              Selfie validacion
              <input type="file" accept="image/png,image/jpeg" onChange={(event) => void uploadAsDataUrl(event.target.files?.[0] ?? null, setIdentitySelfieFile)} />
            </label>
            <label>
              Certificado antecedentes
              <input type="file" accept="application/pdf,image/png,image/jpeg" onChange={(event) => void uploadAsDataUrl(event.target.files?.[0] ?? null, setCriminalRecordFile)} />
            </label>
            <label>
              Titular cuenta bancaria
              <input value={bankAccountHolder} onChange={(event) => setBankAccountHolder(event.target.value)} />
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

            {stepButtons}
          </div>
        ) : null}

        {session?.role === "PRO" && activeStep === 8 ? (
          <div className="grid-form">
            <label className="full">
              Mini induccion obligatoria
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
            </label>
            {stepButtons}
          </div>
        ) : null}

        {session?.role === "PRO" && activeStep === 9 ? (
          <div className="grid-form">
            <div className="full module-card">
              <h3>Revision y activacion</h3>
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
