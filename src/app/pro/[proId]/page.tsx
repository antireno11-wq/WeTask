"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MarketNav } from "@/components/market-nav";

type CleaningOnboardingSummary = {
  profilePhotoUrl: string | null;
  shortDescription: string | null;
  yearsExperience: number | null;
  workMode: "SOLO" | "EQUIPO" | null;
  categorySlug: string | null;
  offeredServices: unknown;
  experienceTypes: unknown;
  languages: unknown;
  baseCommune: string | null;
  maxTravelKm: number | null;
};

type ProfessionalDetail = {
  id: string;
  userId: string;
  bio: string | null;
  isVerified: boolean;
  ratingAvg: number;
  ratingsCount: number;
  coverageCity: string | null;
  coveragePostal: string | null;
  coverageLatitude: number | null;
  coverageLongitude: number | null;
  serviceRadiusKm: number;
  hourlyRateFromClp: number | null;
  user: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    cleaningOnboarding: CleaningOnboardingSummary | null;
  };
};

type AvailabilitySlot = {
  id: string;
  startsAt: string;
  endsAt: string;
  service: { id: string; name: string } | null;
};

type SampleReview = {
  name: string;
  time: string;
  serviceLabel: string;
  overall: number;
  punctuality: number;
  communication: number;
  quality: number;
  wouldBookAgain: boolean;
  text: string;
};

const galleryImages = [
  "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=900&q=80"
];

const faqItems = [
  "¿Qué incluye la limpieza estándar?",
  "¿Puede realizar tareas adicionales como planchar o cocinar?",
  "¿Qué pasa si no tengo materiales de limpieza?",
  "¿Puedo reservar de forma semanal?",
  "¿Qué significa reserva mínima?"
];

const sampleComments: SampleReview[] = [
  {
    name: "Josefa R.",
    time: "hace 6 dias",
    serviceLabel: "Limpieza profunda",
    overall: 5,
    punctuality: 5,
    communication: 5,
    quality: 5,
    wouldBookAgain: true,
    text: "Llegó puntual, explicó todo antes de empezar y dejó la cocina impecable. La volvería a reservar sin dudar."
  },
  {
    name: "Martin P.",
    time: "hace 2 semanas",
    serviceLabel: "Limpieza general",
    overall: 4,
    punctuality: 5,
    communication: 4,
    quality: 4,
    wouldBookAgain: true,
    text: "Muy buena experiencia. Ordenó bien los espacios y mantuvo una comunicación clara durante toda la visita."
  },
  {
    name: "Carolina S.",
    time: "hace 1 mes",
    serviceLabel: "Orden y organizacion",
    overall: 5,
    punctuality: 4,
    communication: 5,
    quality: 5,
    wouldBookAgain: true,
    text: "Fue muy profesional y cuidadosa con mis cosas. Se nota la experiencia y el trato amable con el cliente."
  }
];

const demoOfferedServices = ["Limpieza general", "Limpieza profunda", "Planchado", "Orden y organización"];
const demoExperienceTypes = ["Casas", "Departamentos", "Oficinas pequeñas"];
const demoLanguages = ["Español"];

function clp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

function isValidYmd(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function dateInputDefault(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() ?? "")
    .join("");
}

function labelize(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function toLabelList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const cleaned = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map(labelize);
  return cleaned.length > 0 ? cleaned : fallback;
}

function categoryLabel(value: string | null | undefined) {
  switch (value) {
    case "limpieza":
      return "Limpieza";
    case "mascotas":
      return "Cuidado de mascotas";
    case "babysitter":
      return "Babysitter";
    case "profesor-particular":
      return "Profesor particular";
    case "personal-trainer":
      return "Personal trainer";
    case "chef":
      return "Chef";
    case "maquillaje":
      return "Maquillaje";
    case "planchado":
      return "Planchado";
    default:
      return "Servicios a domicilio";
  }
}

function renderStars(value: number) {
  return Array.from({ length: 5 }, (_, index) => (index < Math.round(value) ? "★" : "☆")).join("");
}

function taskerRoleLabel(value: string | null | undefined) {
  switch (value) {
    case "limpieza":
      return "Tasker de limpieza";
    case "mascotas":
      return "Tasker de paseo y cuidado de mascotas";
    case "babysitter":
      return "Tasker de babysitting";
    case "profesor-particular":
      return "Tasker de clases particulares";
    case "personal-trainer":
      return "Tasker de personal training";
    case "chef":
      return "Tasker chef a domicilio";
    case "maquillaje":
      return "Tasker de maquillaje";
    case "planchado":
      return "Tasker de planchado";
    default:
      return "Tasker de servicios a domicilio";
  }
}

function buildDemoProfessional(proId: string): ProfessionalDetail {
  const cleanId = proId.replace(/[-_]/g, " ").trim();
  const fallbackName = cleanId.length > 0 ? labelize(cleanId) : "Tasker WeTask";

  return {
    id: `demo-profile-${proId}`,
    userId: proId,
    bio: "Tasker con experiencia comprobada en servicios a domicilio, enfoque en puntualidad y resultados de calidad.",
    isVerified: true,
    ratingAvg: 4.9,
    ratingsCount: 47,
    coverageCity: "Santiago",
    coveragePostal: "7500000",
    coverageLatitude: -33.4489,
    coverageLongitude: -70.6693,
    serviceRadiusKm: 12,
    hourlyRateFromClp: 15000,
    user: {
      id: proId,
      fullName: fallbackName,
      email: "tasker@wetask.cl",
      phone: "+56 9 5555 5555",
      cleaningOnboarding: {
        profilePhotoUrl: null,
        shortDescription: "Perfil profesional con foco en limpieza del hogar, atención cordial y cumplimiento de horarios.",
        yearsExperience: 7,
        workMode: "SOLO",
        categorySlug: "limpieza",
        offeredServices: demoOfferedServices,
        experienceTypes: demoExperienceTypes,
        languages: demoLanguages,
        baseCommune: "Santiago",
        maxTravelKm: 12
      }
    }
  };
}

function buildDemoSlots(baseDate: string, proId: string): AvailabilitySlot[] {
  const start = new Date(`${baseDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return [];

  const slots: AvailabilitySlot[] = [];
  const windows = [
    [9, 0, 11, 0],
    [12, 0, 14, 0],
    [16, 0, 18, 0]
  ];

  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    for (let i = 0; i < windows.length; i += 1) {
      const [startH, startM, endH, endM] = windows[i];
      const startsAt = new Date(start);
      startsAt.setDate(start.getDate() + dayOffset);
      startsAt.setHours(startH, startM, 0, 0);

      const endsAt = new Date(start);
      endsAt.setDate(start.getDate() + dayOffset);
      endsAt.setHours(endH, endM, 0, 0);

      slots.push({
        id: `demo-slot-${proId}-${dayOffset}-${i}`,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        service: { id: "demo-service", name: "Servicio a domicilio" }
      });
    }
  }

  return slots;
}

export default function ProDetailPage() {
  const params = useParams<{ proId: string }>();
  const searchParams = useSearchParams();
  const requestedDate = searchParams.get("date");
  const initialDate = isValidYmd(requestedDate) ? requestedDate! : dateInputDefault();
  const [date, setDate] = useState(initialDate);
  const [selectedDay, setSelectedDay] = useState(initialDate);
  const [expandedAbout, setExpandedAbout] = useState(false);

  const [data, setData] = useState<ProfessionalDetail | null>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        setNotice("");

        const [proRes, availabilityRes] = await Promise.all([
          fetch(`/api/marketplace/pros/${params.proId}`),
          fetch(`/api/marketplace/availability?proId=${params.proId}&date=${date}&days=10&limit=120`)
        ]);

        const proBody = (await proRes.json()) as { professional?: ProfessionalDetail; error?: string; detail?: string };
        const availabilityBody = (await availabilityRes.json()) as {
          slots?: Array<AvailabilitySlot>;
          error?: string;
          detail?: string;
        };

        let resolvedProfile: ProfessionalDetail;
        if (!proRes.ok || !proBody.professional) {
          resolvedProfile = buildDemoProfessional(params.proId);
          setNotice("Mostrando un perfil referencial para visualizar cómo se verá el tasker.");
        } else {
          resolvedProfile = proBody.professional;
        }

        let resolvedSlots: AvailabilitySlot[] = [];
        if (!availabilityRes.ok || !availabilityBody.slots) {
          resolvedSlots = buildDemoSlots(date, params.proId);
          setNotice((prev) =>
            prev
              ? `${prev} También cargamos una agenda de ejemplo.`
              : "Mostrando una agenda referencial para que puedas ver los días disponibles."
          );
        } else {
          resolvedSlots = availabilityBody.slots;
        }

        if (resolvedSlots.length === 0) {
          resolvedSlots = buildDemoSlots(date, params.proId);
        }

        setData(resolvedProfile);
        setSlots(resolvedSlots);
      } catch {
        setData(buildDemoProfessional(params.proId));
        setSlots(buildDemoSlots(date, params.proId));
        setNotice("No fue posible cargar todos los datos en vivo. Te mostramos una vista de ejemplo.");
        setError("");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [params.proId, date]);

  const dayGroups = useMemo(() => {
    const map = new Map<string, AvailabilitySlot[]>();
    for (const slot of slots) {
      const key = slot.startsAt.slice(0, 10);
      const prev = map.get(key) ?? [];
      prev.push(slot);
      map.set(key, prev);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [slots]);

  useEffect(() => {
    if (!selectedDay && dayGroups[0]) {
      setSelectedDay(dayGroups[0][0]);
    }
    if (selectedDay && !dayGroups.some(([day]) => day === selectedDay)) {
      setSelectedDay(dayGroups[0]?.[0] ?? "");
    }
  }, [dayGroups, selectedDay]);

  const selectedSlots = useMemo(() => dayGroups.find(([day]) => day === selectedDay)?.[1] ?? [], [dayGroups, selectedDay]);

  const aboutText = useMemo(() => {
    const base = data?.bio?.trim() || data?.user.cleaningOnboarding?.shortDescription?.trim();
    const fallback =
      "Importante: aunque el calendario muestre franjas ocupadas, consulta disponibilidad. Disponemos de equipo rotativo y adaptamos horarios según tipo de servicio. Trabajamos en limpieza general, apoyo en hogar y servicios especiales bajo cotización.";
    return base && base.length > 30 ? `${fallback} ${base}` : fallback;
  }, [data?.bio, data?.user.cleaningOnboarding?.shortDescription]);

  const aboutPreview = aboutText.length > 340 ? `${aboutText.slice(0, 340)}...` : aboutText;

  const rating = Number(data?.ratingAvg || 0);
  const qualityScore = Math.min(5, Math.max(4, rating + 0.1));
  const friendlinessScore = Math.min(5, Math.max(4, rating + 0.2));
  const professionalismScore = Math.min(5, Math.max(4, rating + 0.15));
  const punctualityScore = Math.min(5, Math.max(4, rating + 0.1));
  const onboarding = data?.user.cleaningOnboarding ?? null;
  const profilePhotoUrl = onboarding?.profilePhotoUrl?.trim() || "";
  const summaryDescription =
    onboarding?.shortDescription?.trim() ||
    "Tasker con experiencia en servicios a domicilio, buena valoración y agenda activa durante la semana.";
  const experienceYears = onboarding?.yearsExperience ?? 6;
  const offeredServices = toLabelList(onboarding?.offeredServices, demoOfferedServices);
  const experienceTypes = toLabelList(onboarding?.experienceTypes, demoExperienceTypes);
  const languages = toLabelList(onboarding?.languages, demoLanguages);
  const workModeLabel = onboarding?.workMode === "EQUIPO" ? "Trabajo en equipo" : "Trabajo individual";
  const categoryName = categoryLabel(onboarding?.categorySlug);
  const taskerRole = taskerRoleLabel(onboarding?.categorySlug);
  const focusLabel = onboarding?.categorySlug === "mascotas" ? "Tipos de mascota" : "Especialidades";
  const serviceLabel = onboarding?.categorySlug === "limpieza" ? "Servicios de limpieza" : "Servicios que ofrece";
  const goalText =
    onboarding?.categorySlug === "mascotas"
      ? "Cuidar mascotas con confianza, constancia y buena comunicación con cada familia."
      : onboarding?.categorySlug === "chef"
        ? "Llenar agenda con servicios bien coordinados y experiencias de calidad en cada visita."
        : onboarding?.categorySlug === "maquillaje"
          ? "Construir una agenda estable con clientas recurrentes y servicios bien evaluados."
          : "Llenar agenda con clientes recurrentes y servicios de calidad.";

  return (
    <main className="auth-flow-screen auth-flow-screen-scroll market-shell-auth">
      <div className="auth-flow-backdrop" aria-hidden />

      <div className="login-screen-content market-shell-auth-content">
        <MarketNav />

        {data ? (
          <>
            <section className="auth-flow-shell auth-flow-shell-wide client-dashboard-hero">
              <div className="auth-flow-copy client-dashboard-copy">
                <p className="auth-flow-kicker">Tasker verificado</p>
                <h1>{data.user.fullName}</h1>
                <p
                  style={{
                    margin: "14px 0 0",
                    fontSize: "1.04rem",
                    fontWeight: 800,
                    color: "#ffddb9",
                    letterSpacing: "0.01em"
                  }}
                >
                  {taskerRole}
                </p>
                <p>{summaryDescription}</p>

                <div className="auth-flow-copy-list client-dashboard-summary">
                  <div className="auth-flow-meta-card">
                    <strong>{categoryName}</strong>
                    <span>{offeredServices.join(", ")}</span>
                  </div>
                  <div className="auth-flow-meta-card">
                    <strong>Experiencia</strong>
                    <span>{experienceYears} años de experiencia en servicios a domicilio.</span>
                  </div>
                  <div className="auth-flow-meta-card">
                    <strong>Disponibilidad</strong>
                    <span>{dayGroups.length} día(s) con agenda visible para reserva.</span>
                  </div>
                </div>
              </div>

              <section className="auth-flow-panel auth-flow-panel-wide client-dashboard-profile-panel we-pro-sticky-card">
                <div className="we-sticky-head">
                  <div className="we-pro-avatar large" aria-hidden>
                    {profilePhotoUrl ? <img src={profilePhotoUrl} alt="" className="we-pro-avatar-image" /> : initials(data.user.fullName)}
                  </div>
                  <div>
                    <h3>{data.user.fullName}</h3>
                    <p
                      style={{
                        margin: "4px 0 0",
                        color: "#264d7a",
                        fontWeight: 800
                      }}
                    >
                      {taskerRole}
                    </p>
                    <p>
                      <span className="we-star">★</span> {rating.toFixed(1)} ({data.ratingsCount} valoraciones)
                    </p>
                  </div>
                </div>

                <p className="we-sticky-price">{data.hourlyRateFromClp ? clp(data.hourlyRateFromClp) : "Por definir"}/h</p>
                <p className="we-sticky-meta">{data.coverageCity ?? "Santiago"} · {workModeLabel}</p>

                <div className="cta-row">
                  <a href="#availability" className="cta small">
                    Ver agenda
                  </a>
                  <Link className="cta small" href={`/booking/new?proId=${data.userId}`}>
                    Reservar ahora
                  </Link>
                </div>

                <p className="minimal-note">Para protegerte, usa siempre WeTask para contratar y comunicarte.</p>
              </section>
            </section>

            <div className="page client-dashboard-sections">
              {loading ? <p className="empty">Cargando perfil...</p> : null}
              {notice ? <p className="feedback ok">{notice}</p> : null}
              {error ? <p className="feedback error">{error}</p> : null}

              <section className="we-pro-detail-layout">
                <div className="we-pro-detail-main">
                  <article className="auth-flow-panel client-dashboard-section">
                    <h2>Perfil del tasker</h2>
                    <p>{summaryDescription}</p>
                    <div className="we-info-grid we-profile-quick-grid">
                      <div>
                        <h3>Experiencia</h3>
                        <p>{experienceYears} años</p>
                      </div>
                      <div>
                        <h3>Modalidad</h3>
                        <p>{workModeLabel}</p>
                      </div>
                      <div>
                        <h3>Categoría</h3>
                        <p>{categoryName}</p>
                      </div>
                      <div>
                        <h3>{focusLabel}</h3>
                        <p>{experienceTypes.join(", ")}</p>
                      </div>
                      <div>
                        <h3>Idiomas</h3>
                        <p>{languages.join(", ")}</p>
                      </div>
                    </div>
                    <div className="we-pro-tags">
                      {offeredServices.map((service) => (
                        <span key={service} className="we-tag">
                          {service}
                        </span>
                      ))}
                    </div>
                  </article>

                  <article className="auth-flow-panel client-dashboard-section">
                    <h2>Sobre mi</h2>
                    <p>{expandedAbout ? aboutText : aboutPreview}</p>
                    {aboutText.length > 340 ? (
                      <button type="button" className="we-text-link" onClick={() => setExpandedAbout((prev) => !prev)}>
                        {expandedAbout ? "Ver menos" : "Ver mas"}
                      </button>
                    ) : null}
                  </article>

                  <article className="auth-flow-panel client-dashboard-section">
                    <div className="we-section-head">
                      <h2>Galeria</h2>
                      <button type="button" className="we-text-link">
                        Ver galeria
                      </button>
                    </div>
                    <div className="we-gallery-strip">
                      {galleryImages.map((image, index) => (
                        <figure key={image} className="we-gallery-item">
                          <span className="we-gallery-pic" style={{ backgroundImage: `url(${image})` }} aria-hidden />
                          <figcaption>gallery {index + 1}</figcaption>
                        </figure>
                      ))}
                    </div>
                  </article>

                  <article className="auth-flow-panel client-dashboard-section">
                    <h2>Informacion de interes</h2>
                    <div className="we-info-grid">
                      <div>
                        <h3>¿Cuánta experiencia tiene?</h3>
                        <p>{experienceYears} años trabajando en servicios a domicilio.</p>
                      </div>
                      <div>
                        <h3>{serviceLabel}</h3>
                        <p>{offeredServices.join(", ")}</p>
                      </div>
                      <div>
                        <h3>{focusLabel}</h3>
                        <p>{experienceTypes.join(", ")}</p>
                      </div>
                      <div>
                        <h3>¿Qué busca en WeTask?</h3>
                        <p>{goalText}</p>
                      </div>
                    </div>
                  </article>

                  <article id="availability" className="auth-flow-panel client-dashboard-section">
                    <div className="we-section-head">
                      <h2>Agenda y disponibilidad</h2>
                      <label>
                        Desde fecha
                        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
                      </label>
                    </div>

                    <div className="day-tabs">
                      {dayGroups.map(([day]) => (
                        <button
                          key={day}
                          type="button"
                          className={`day-tab ${selectedDay === day ? "active" : ""}`}
                          onClick={() => setSelectedDay(day)}
                        >
                          {new Date(`${day}T00:00:00`).toLocaleDateString("es-CL", {
                            weekday: "short",
                            day: "2-digit",
                            month: "2-digit"
                          })}
                        </button>
                      ))}
                    </div>

                    <div className="calendar-slot-grid">
                      {selectedSlots.length === 0 ? (
                        <p className="empty">No hay horarios disponibles en ese dia.</p>
                      ) : (
                        selectedSlots.map((slot) => (
                          <Link
                            key={slot.id}
                            className="slot-btn"
                            href={`/booking/new?proId=${data.userId}${slot.service ? `&serviceId=${slot.service.id}` : ""}&startsAt=${encodeURIComponent(slot.startsAt)}`}
                          >
                            {new Date(slot.startsAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })} -{" "}
                            {new Date(slot.endsAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                          </Link>
                        ))
                      )}
                    </div>
                  </article>

                  <article className="auth-flow-panel client-dashboard-section">
                    <h2>Valoracion de los clientes</h2>
                    <p className="we-score-big">{rating.toFixed(1)} · Excepcional ({data.ratingsCount} valoraciones)</p>
                    <div className="we-metrics-grid">
                      <p>Servicio: {rating.toFixed(1)}</p>
                      <p>Calidad / Precio: {qualityScore.toFixed(1)}</p>
                      <p>Amabilidad: {friendlinessScore.toFixed(1)}</p>
                      <p>Profesionalidad: {professionalismScore.toFixed(1)}</p>
                      <p>Puntualidad: {punctualityScore.toFixed(1)}</p>
                    </div>
                    <div
                      className="we-comments-list"
                      style={{ display: "grid", gap: "16px", marginTop: "18px" }}
                    >
                      {sampleComments.map((comment) => (
                        <article
                          key={comment.name + comment.time}
                          className="we-comment-item"
                          style={{
                            border: "1px solid #d6e3f2",
                            borderRadius: "22px",
                            padding: "18px 20px",
                            background: "linear-gradient(180deg, #ffffff 0%, #f7fbff 100%)",
                            boxShadow: "0 12px 30px rgba(16, 44, 84, 0.08)"
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: "12px",
                              alignItems: "flex-start",
                              flexWrap: "wrap"
                            }}
                          >
                            <div style={{ display: "grid", gap: "4px" }}>
                              <p style={{ margin: 0, color: "#203a63" }}>
                                <strong>{comment.name}</strong> · {comment.time}
                              </p>
                              <p style={{ margin: 0, color: "#58708f", fontSize: "0.92rem" }}>{comment.serviceLabel}</p>
                            </div>
                            <div style={{ display: "grid", justifyItems: "end", gap: "4px" }}>
                              <strong style={{ color: "#f59e0b", fontSize: "1.05rem", letterSpacing: "0.08em" }}>
                                {renderStars(comment.overall)}
                              </strong>
                              <span style={{ color: "#203a63", fontWeight: 700 }}>{comment.overall.toFixed(1)} / 5</span>
                            </div>
                          </div>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                              gap: "10px",
                              marginTop: "14px"
                            }}
                          >
                            <div
                              style={{
                                padding: "10px 12px",
                                borderRadius: "16px",
                                background: "#edf5ff",
                                color: "#203a63"
                              }}
                            >
                              <strong style={{ display: "block", fontSize: "0.82rem" }}>Puntualidad</strong>
                              <span>{comment.punctuality.toFixed(1)} / 5</span>
                            </div>
                            <div
                              style={{
                                padding: "10px 12px",
                                borderRadius: "16px",
                                background: "#fef4e8",
                                color: "#203a63"
                              }}
                            >
                              <strong style={{ display: "block", fontSize: "0.82rem" }}>Comunicacion</strong>
                              <span>{comment.communication.toFixed(1)} / 5</span>
                            </div>
                            <div
                              style={{
                                padding: "10px 12px",
                                borderRadius: "16px",
                                background: "#eefaf2",
                                color: "#203a63"
                              }}
                            >
                              <strong style={{ display: "block", fontSize: "0.82rem" }}>Calidad del servicio</strong>
                              <span>{comment.quality.toFixed(1)} / 5</span>
                            </div>
                          </div>

                          <p style={{ margin: "14px 0 0", color: "#385170", lineHeight: 1.6 }}>{comment.text}</p>

                          <p style={{ margin: "12px 0 0", color: "#1f6a43", fontWeight: 700 }}>
                            {comment.wouldBookAgain ? "Lo volveria a contratar" : "No volveria a contratar"}
                          </p>
                        </article>
                      ))}
                    </div>
                  </article>

                  <article className="auth-flow-panel client-dashboard-section">
                    <h2>Garantia WeTask</h2>
                    <p>Hasta confirmar que el servicio fue correcto, el pago permanece protegido en plataforma.</p>
                    <ul className="we-check-list">
                      <li>Garantia de reembolso</li>
                      <li>Atencion 365 dias</li>
                      <li>Pago protegido</li>
                    </ul>
                  </article>

                  <article className="auth-flow-panel client-dashboard-section">
                    <h2>Preguntas frecuentes</h2>
                    <div className="we-faq-list">
                      {faqItems.map((item) => (
                        <details key={item}>
                          <summary>{item}</summary>
                          <p>Este profesional responde por chat y confirma los detalles antes del servicio.</p>
                        </details>
                      ))}
                    </div>
                  </article>

                  <article className="auth-flow-panel client-dashboard-section">
                    <h2>Politica de cancelacion</h2>
                    <div className="we-cancel-table">
                      <div>
                        <strong>Antelacion</strong>
                        <span>Hasta 24h</span>
                        <span>24h a 4h</span>
                        <span>4h a 45min</span>
                        <span>45min a inicio</span>
                      </div>
                      <div>
                        <strong>% de reembolso</strong>
                        <span>Cancelacion gratuita</span>
                        <span>75% del importe</span>
                        <span>50% del importe</span>
                        <span>35% del importe</span>
                      </div>
                    </div>
                  </article>

                  <article className="auth-flow-panel client-dashboard-section">
                    <h2>¿Podemos ayudarte?</h2>
                    <p>Si tienes dudas del servicio, horario o materiales, escríbenos antes de reservar.</p>
                    <button type="button" className="cta small">
                      Enviar mensaje
                    </button>
                  </article>
                </div>
              </section>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
