"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MarketNav } from "@/components/market-nav";

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

function clp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
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

export default function ProDetailPage() {
  const params = useParams<{ proId: string }>();
  const [date, setDate] = useState(dateInputDefault());
  const [selectedDay, setSelectedDay] = useState("");
  const [expandedAbout, setExpandedAbout] = useState(false);

  const [data, setData] = useState<ProfessionalDetail | null>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
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

        if (!proRes.ok || !proBody.professional) {
          throw new Error(proBody.detail || proBody.error || "No se pudo cargar perfil");
        }

        if (!availabilityRes.ok || !availabilityBody.slots) {
          throw new Error(availabilityBody.detail || availabilityBody.error || "No se pudo cargar disponibilidad");
        }

        setData(proBody.professional);
        setSlots(availabilityBody.slots);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inesperado");
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
    const base = data?.bio?.trim();
    const fallback =
      "Importante: aunque el calendario muestre franjas ocupadas, consulta disponibilidad. Disponemos de equipo rotativo y adaptamos horarios según tipo de servicio. Trabajamos en limpieza general, apoyo en hogar y servicios especiales bajo cotización.";
    return base && base.length > 30 ? `${fallback} ${base}` : fallback;
  }, [data?.bio]);

  const aboutPreview = aboutText.length > 340 ? `${aboutText.slice(0, 340)}...` : aboutText;

  const rating = Number(data?.ratingAvg || 0);
  const qualityScore = Math.min(5, Math.max(4, rating + 0.1));
  const friendlinessScore = Math.min(5, Math.max(4, rating + 0.2));
  const professionalismScore = Math.min(5, Math.max(4, rating + 0.15));
  const punctualityScore = Math.min(5, Math.max(4, rating + 0.1));

  return (
    <main className="page market-shell">
      <MarketNav />
      {loading ? <p className="empty">Cargando perfil...</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}

      {data ? (
        <section className="we-pro-detail-layout">
          <div className="we-pro-detail-main">
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
                <h2>Disponibilidad</h2>
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
                {initials(data.user.fullName)}
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
                Ver disponibilidad
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
