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

const sampleComments = [
  { name: "Jose", time: "hace 1 mes", text: "Mucha seriedad y profesionalismo." },
  { name: "Maria", time: "hace 1 mes", text: "Perfecto, muy puntuales y ordenados." },
  { name: "Victor", time: "hace 1 mes", text: "Como siempre, trato impecable." }
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
  const baseCommune = onboarding?.baseCommune ?? data?.coverageCity ?? "Santiago";
  const maxTravelKm = onboarding?.maxTravelKm ?? data?.serviceRadiusKm ?? 10;

  return (
    <main className="page market-shell">
      <MarketNav />
      {loading ? <p className="empty">Cargando perfil...</p> : null}
      {notice ? <p className="feedback ok">{notice}</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}

      {data ? (
        <section className="we-pro-detail-layout">
          <div className="we-pro-detail-main">
            <article className="panel">
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
                  <h3>Comuna base</h3>
                  <p>{baseCommune}</p>
                </div>
                <div>
                  <h3>Cobertura</h3>
                  <p>{maxTravelKm} km</p>
                </div>
                <div>
                  <h3>Tipos de experiencia</h3>
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

            <article className="panel">
              <h2>Sobre mi</h2>
              <p>{expandedAbout ? aboutText : aboutPreview}</p>
              {aboutText.length > 340 ? (
                <button type="button" className="we-text-link" onClick={() => setExpandedAbout((prev) => !prev)}>
                  {expandedAbout ? "Ver menos" : "Ver mas"}
                </button>
              ) : null}
            </article>

            <article className="panel">
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

            <article className="panel">
              <h2>Informacion de interes</h2>
              <div className="we-info-grid">
                <div>
                  <h3>¿Cuanta experiencia tienes como limpiador/a?</h3>
                  <p>6-10 años de experiencia</p>
                </div>
                <div>
                  <h3>Tipos de limpieza</h3>
                  <p>Limpieza general, limpieza a fondo, post-obra, ventanas y tapicería.</p>
                </div>
                <div>
                  <h3>Tareas complementarias</h3>
                  <p>Planchar, lavar ropa, cocina ligera y apoyo puntual en hogar.</p>
                </div>
                <div>
                  <h3>¿Que busca en WeTask?</h3>
                  <p>Llenar agenda con clientes recurrentes y servicios de calidad.</p>
                </div>
              </div>
            </article>

            <article id="availability" className="panel">
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

            <article className="panel">
              <h2>Valoracion de los clientes</h2>
              <p className="we-score-big">{rating.toFixed(1)} · Excepcional ({data.ratingsCount} valoraciones)</p>
              <div className="we-metrics-grid">
                <p>Servicio: {rating.toFixed(1)}</p>
                <p>Calidad / Precio: {qualityScore.toFixed(1)}</p>
                <p>Amabilidad: {friendlinessScore.toFixed(1)}</p>
                <p>Profesionalidad: {professionalismScore.toFixed(1)}</p>
                <p>Puntualidad: {punctualityScore.toFixed(1)}</p>
              </div>
              <div className="we-comments-list">
                {sampleComments.map((comment) => (
                  <article key={comment.name + comment.time} className="we-comment-item">
                    <p>
                      <strong>{comment.name}</strong> · {comment.time}
                    </p>
                    <p>{comment.text}</p>
                  </article>
                ))}
              </div>
            </article>

            <article className="panel">
              <h2>Garantia WeTask</h2>
              <p>Hasta confirmar que el servicio fue correcto, el pago permanece protegido en plataforma.</p>
              <ul className="we-check-list">
                <li>Garantia de reembolso</li>
                <li>Atencion 365 dias</li>
                <li>Pago protegido</li>
              </ul>
            </article>

            <article className="panel">
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

            <article className="panel">
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

            <article className="panel">
              <h2>¿Podemos ayudarte?</h2>
              <p>Si tienes dudas del servicio, horario o materiales, escríbenos antes de reservar.</p>
              <button type="button" className="cta small">
                Enviar mensaje
              </button>
            </article>
          </div>

          <aside className="panel we-pro-sticky-card">
            <div className="we-sticky-head">
              <div className="we-pro-avatar large" aria-hidden>
                {profilePhotoUrl ? <img src={profilePhotoUrl} alt="" className="we-pro-avatar-image" /> : initials(data.user.fullName)}
              </div>
              <div>
                <h3>{data.user.fullName}</h3>
                <p>
                  <span className="we-star">★</span> {rating.toFixed(1)} ({data.ratingsCount} valoraciones)
                </p>
              </div>
            </div>

            <p className="we-sticky-price">{data.hourlyRateFromClp ? clp(data.hourlyRateFromClp) : "Por definir"}/h</p>
            <p className="we-sticky-meta">
              {data.coverageCity ?? "Santiago"} · Radio {data.serviceRadiusKm} km
            </p>

            <div className="cta-row">
              <a href="#availability" className="cta small">
                Ver agenda
              </a>
              <Link className="cta small" href={`/booking/new?proId=${data.userId}`}>
                Reservar ahora
              </Link>
            </div>

            <p className="minimal-note">Para protegerte, usa siempre WeTask para contratar y comunicarte.</p>
          </aside>
        </section>
      ) : null}
    </main>
  );
}
