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
  coverageLatitude: number | null;
  coverageLongitude: number | null;
  serviceRadiusKm: number;
  hourlyRateFromClp: number | null;
  user: {
    id: string;
    fullName: string;
    email: string;
  };
  slots: Array<{
    startsAt: string;
    service: {
      id: string;
      name: string;
    } | null;
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

const MAP_BOUNDS = {
  minLat: -33.58,
  maxLat: -33.34,
  minLng: -70.82,
  maxLng: -70.5
};

function professionalTypeFromSlots(slots: Professional["slots"]): string {
  const serviceNames = Array.from(new Set(slots.map((slot) => slot.service?.name).filter(Boolean)));
  if (serviceNames.length === 0) return "Servicio general";
  return serviceNames.slice(0, 2).join(" · ");
}

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

function toMapPosition(lat: number, lng: number): { x: number; y: number } {
  const rawX = ((lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng)) * 100;
  const rawY = (1 - (lat - MAP_BOUNDS.minLat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * 100;
  const x = Math.min(98, Math.max(2, rawX));
  const y = Math.min(98, Math.max(2, rawY));
  return { x, y };
}

export default function ProfesionalesPage() {
  const [city, setCity] = useState("Santiago");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(dateInputDefault());
  const [verified, setVerified] = useState(true);
  const [selectedDay, setSelectedDay] = useState("");

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

  const groupedPros = useMemo(() => {
    const map = new Map<string, Professional[]>();
    for (const pro of professionals) {
      const key = professionalTypeFromSlots(pro.slots);
      const prev = map.get(key) ?? [];
      prev.push(pro);
      map.set(key, prev);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [professionals]);
  const mapEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${MAP_BOUNDS.minLng}%2C${MAP_BOUNDS.minLat}%2C${MAP_BOUNDS.maxLng}%2C${MAP_BOUNDS.maxLat}&layer=mapnik`;

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
          <h2>Mapa de profesionales en Santiago</h2>
          <p>Cada punto muestra ubicacion base y radio de cobertura.</p>
        </div>
        <div className="pro-map-canvas" role="img" aria-label="Mapa de cobertura Santiago">
          <iframe
            title="Mapa base de Santiago"
            src={mapEmbedUrl}
            loading="lazy"
            className="pro-map-layer"
            referrerPolicy="no-referrer-when-downgrade"
          />
          {professionals
            .filter((pro) => pro.coverageLatitude !== null && pro.coverageLongitude !== null)
            .map((pro) => {
              const pos = toMapPosition(pro.coverageLatitude!, pro.coverageLongitude!);
              const radiusPx = Math.max(16, pro.serviceRadiusKm * 2.3);
              return (
                <Link
                  key={pro.id}
                  className="pro-marker"
                  href={`/profesionales/${pro.userId}`}
                  title={`${pro.user.fullName} · radio ${pro.serviceRadiusKm} km`}
                  style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                >
                  <span className="pro-marker-radius" style={{ width: radiusPx, height: radiusPx }} />
                  <span className="pro-marker-dot" />
                  <span className="pro-marker-name">{pro.user.fullName.split(" ")[0]}</span>
                </Link>
              );
            })}
        </div>
      </section>

      {loading ? <p className="empty">Cargando profesionales...</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}

      {groupedPros.map(([groupName, groupPros]) => (
        <section key={groupName} className="panel">
          <div className="panel-head">
            <h2>{groupName}</h2>
            <p>{groupPros.length} profesionales en esta especialidad.</p>
          </div>
          <div className="pro-card-grid">
            {groupPros.map((pro) => (
              <article className="booking-card" key={pro.id}>
                <div className="booking-head">
                  <h3>{pro.user.fullName}</h3>
                  <span className={`status ${pro.isVerified ? "status-completed" : "status-pending"}`}>
                    {pro.isVerified ? "Verificado" : "No verificado"}
                  </span>
                </div>
                <p>
                  <strong>Especialidad:</strong> {professionalTypeFromSlots(pro.slots)}
                </p>
                <p>
                  <strong>Rating:</strong> {Number(pro.ratingAvg || 0).toFixed(1)} ({pro.ratingsCount} reseñas)
                </p>
                <p>
                  <strong>Precio/hora:</strong> {pro.hourlyRateFromClp ? clp(pro.hourlyRateFromClp) : "Por definir"}
                </p>
                <p>
                  <strong>Zona:</strong> {pro.coverageCity ?? "No definida"} · Radio {pro.serviceRadiusKm} km
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
          </div>
        </section>
      ))}

      <section className="panel">
        <div className="panel-head">
          <h2>Calendario general del servicio</h2>
          <p>Haz click en dia y luego en un bloque para reservar.</p>
        </div>

        <div className="day-tabs">
          {dayGroups.map(([day]) => (
            <button
              key={day}
              type="button"
              className={`day-tab ${selectedDay === day ? "active" : ""}`}
              onClick={() => setSelectedDay(day)}
            >
              {new Date(`${day}T00:00:00`).toLocaleDateString("es-CL", { weekday: "short", day: "2-digit", month: "2-digit" })}
            </button>
          ))}
        </div>

        <div className="calendar-slot-grid">
          {selectedSlots.length === 0 ? (
            <p className="empty">Sin bloques disponibles para ese dia.</p>
          ) : (
            selectedSlots.map((slot) => (
              <Link
                className="slot-btn"
                key={slot.id}
                href={`/reservar?proId=${slot.professionalProfile.user.id}${slot.service ? `&serviceId=${slot.service.id}` : ""}&startsAt=${encodeURIComponent(slot.startsAt)}`}
              >
                {new Date(slot.startsAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })} · {slot.professionalProfile.user.fullName}
              </Link>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
