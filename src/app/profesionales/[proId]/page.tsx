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

function clp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

function starsText(value: number) {
  const rounded = Math.max(1, Math.min(5, Math.round(value || 0)));
  return `${"★".repeat(rounded)}${"☆".repeat(5 - rounded)}`;
}

function dateInputDefault(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export default function ProDetailPage() {
  const params = useParams<{ proId: string }>();
  const [date, setDate] = useState(dateInputDefault());
  const [selectedDay, setSelectedDay] = useState("");

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
    load();
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

  return (
    <main className="page market-shell">
      <MarketNav />
      {loading ? <p className="empty">Cargando perfil...</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}

      {data ? (
        <>
          <section className="panel">
            <div className="panel-head">
              <h2>{data.user.fullName}</h2>
              <p>
                {starsText(Number(data.ratingAvg || 0))} {Number(data.ratingAvg || 0).toFixed(1)} · {data.ratingsCount} reseñas ·{" "}
                {data.isVerified ? "Verificado" : "No verificado"}
              </p>
            </div>
            <p>{data.bio ?? "Sin descripcion"}</p>
            <p>
              <strong>Cobertura:</strong> {data.coverageCity ?? "N/A"} ({data.coveragePostal ?? "N/A"}) · Radio {data.serviceRadiusKm} km
            </p>
            <p>
              <strong>Valor hora:</strong> {data.hourlyRateFromClp ? clp(data.hourlyRateFromClp) : "Por definir"}
            </p>
            <p>
              <strong>Contacto:</strong> {data.user.email} {data.user.phone ? `· ${data.user.phone}` : ""}
            </p>
            <div className="cta-row">
              <label>
                Desde fecha
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </label>
              <Link className="cta" href={`/reservar?proId=${data.userId}`}>
                Ir a reservar
              </Link>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Calendario clickeable</h2>
              <p>Selecciona el dia y luego el bloque horario disponible.</p>
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
                <p className="empty">No hay horarios disponibles en ese dia.</p>
              ) : (
                selectedSlots.map((slot) => (
                  <Link
                    key={slot.id}
                    className="slot-btn"
                    href={`/reservar?proId=${data.userId}${slot.service ? `&serviceId=${slot.service.id}` : ""}&startsAt=${encodeURIComponent(slot.startsAt)}`}
                  >
                    {new Date(slot.startsAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })} -{" "}
                    {new Date(slot.endsAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                    {slot.service ? ` · ${slot.service.name}` : ""}
                  </Link>
                ))
              )}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
