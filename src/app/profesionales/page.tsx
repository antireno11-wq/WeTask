"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MarketNav } from "@/components/market-nav";

type Service = {
  id: string;
  name: string;
};

type Professional = {
  id: string;
  userId: string;
  isVerified: boolean;
  ratingAvg: number;
  ratingsCount: number;
  coverageCity: string | null;
  hourlyRateFromClp: number | null;
  user: {
    id: string;
    fullName: string;
    email: string;
  };
  slots: Array<{
    startsAt: string;
  }>;
};

type AvailabilitySlot = {
  id: string;
  startsAt: string;
  endsAt: string;
  professionalProfile: {
    user: {
      id: string;
      fullName: string;
    };
  };
  service: {
    id: string;
    name: string;
  } | null;
};

function clp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

function dateText(value?: string) {
  if (!value) return "Sin disponibilidad";
  return new Date(value).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
}

function dateInputDefault(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export default function ProfesionalesPage() {
  const [city, setCity] = useState("Santiago");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(dateInputDefault());
  const [verified, setVerified] = useState(true);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const presetServiceId = params.get("serviceId") ?? "";
    if (presetServiceId) setServiceId(presetServiceId);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        const catalogRes = await fetch("/api/marketplace/catalog");
        const catalogData = (await catalogRes.json()) as {
          categories?: Array<{ services: Array<{ id: string; name: string }> }>;
          error?: string;
          detail?: string;
        };
        if (!catalogRes.ok || !catalogData.categories) {
          throw new Error(catalogData.detail || catalogData.error || "No se pudo cargar catalogo");
        }

        const flatServices = catalogData.categories.flatMap((category) => category.services);
        setServices(flatServices);

        const prosParams = new URLSearchParams({ city, limit: "30" });
        if (verified) prosParams.set("verified", "true");
        if (serviceId) prosParams.set("serviceId", serviceId);

        const availParams = new URLSearchParams({ city, limit: "120", days: "7", date });
        if (serviceId) availParams.set("serviceId", serviceId);

        const [prosRes, availabilityRes] = await Promise.all([
          fetch(`/api/marketplace/pros?${prosParams.toString()}`),
          fetch(`/api/marketplace/availability?${availParams.toString()}`)
        ]);

        const prosData = (await prosRes.json()) as { professionals?: Professional[]; error?: string; detail?: string };
        const availabilityData = (await availabilityRes.json()) as {
          slots?: AvailabilitySlot[];
          error?: string;
          detail?: string;
        };

        if (!prosRes.ok || !prosData.professionals) {
          throw new Error(prosData.detail || prosData.error || "No se pudo cargar profesionales");
        }

        if (!availabilityRes.ok || !availabilityData.slots) {
          throw new Error(availabilityData.detail || availabilityData.error || "No se pudo cargar disponibilidad");
        }

        setProfessionals(prosData.professionals);
        setSlots(availabilityData.slots);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inesperado");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [city, verified, serviceId, date]);

  const groupedSlots = useMemo(() => {
    const groups = new Map<string, AvailabilitySlot[]>();
    for (const slot of slots) {
      const key = new Date(slot.startsAt).toLocaleDateString("es-CL", { weekday: "short", day: "2-digit", month: "2-digit" });
      const prev = groups.get(key) ?? [];
      prev.push(slot);
      groups.set(key, prev);
    }
    return Array.from(groups.entries());
  }, [slots]);

  return (
    <main className="page market-shell">
      <MarketNav />
      <section className="panel">
        <div className="panel-head">
          <h2>Profesionales y disponibilidad</h2>
          <p>Filtra por servicio y fecha exacta para ver quien puede ir.</p>
        </div>
        <div className="query-row query-calendar">
          <label>
            Ciudad
            <input value={city} onChange={(e) => setCity(e.target.value)} />
          </label>
          <label>
            Servicio
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <option value="">Todos</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fecha
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            Verificado
            <select value={verified ? "yes" : "no"} onChange={(e) => setVerified(e.target.value === "yes")}>
              <option value="yes">Solo verificados</option>
              <option value="no">Todos</option>
            </select>
          </label>
        </div>
      </section>

      <section className="panel map-panel">
        <div className="panel-head">
          <h2>Mapa de cobertura Santiago</h2>
          <p>Santiago Centro, Providencia, Ñuñoa, Las Condes y comunas cercanas.</p>
        </div>
        <iframe
          title="Mapa de Santiago"
          className="santiago-map"
          loading="lazy"
          src="https://www.openstreetmap.org/export/embed.html?bbox=-70.76%2C-33.55%2C-70.52%2C-33.34&layer=mapnik&marker=-33.4489%2C-70.6693"
        />
      </section>

      {loading ? <p className="empty">Cargando profesionales...</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}

      <section className="list">
        {professionals.map((pro) => (
          <article className="booking-card" key={pro.id}>
            <div className="booking-head">
              <h3>{pro.user.fullName}</h3>
              <span className={`status ${pro.isVerified ? "status-completed" : "status-pending"}`}>
                {pro.isVerified ? "Verificado" : "No verificado"}
              </span>
            </div>
            <p>
              <strong>Rating:</strong> {Number(pro.ratingAvg || 0).toFixed(1)} ({pro.ratingsCount} reseñas)
            </p>
            <p>
              <strong>Precio/hora:</strong> {pro.hourlyRateFromClp ? clp(pro.hourlyRateFromClp) : "Por definir"}
            </p>
            <p>
              <strong>Zona:</strong> {pro.coverageCity ?? "No definida"}
            </p>
            <p>
              <strong>Proxima disponibilidad:</strong> {dateText(pro.slots[0]?.startsAt)}
            </p>
            <div className="cta-row">
              <Link className="cta small" href={`/profesionales/${pro.userId}`}>
                Ver calendario
              </Link>
              <Link className="cta ghost small" href={`/reservar?proId=${pro.userId}${serviceId ? `&serviceId=${serviceId}` : ""}`}>
                Reservar
              </Link>
            </div>
          </article>
        ))}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Calendario general del servicio</h2>
          <p>Disponibilidad por fecha y profesional.</p>
        </div>
        <div className="calendar-grid">
          {groupedSlots.length === 0 ? (
            <p className="empty">Sin disponibilidad para los filtros seleccionados.</p>
          ) : (
            groupedSlots.map(([day, daySlots]) => (
              <article className="calendar-day" key={day}>
                <h3>{day}</h3>
                <ul>
                  {daySlots.slice(0, 8).map((slot) => (
                    <li key={slot.id}>
                      {new Date(slot.startsAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })} -{" "}
                      {slot.professionalProfile.user.fullName}
                    </li>
                  ))}
                </ul>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
