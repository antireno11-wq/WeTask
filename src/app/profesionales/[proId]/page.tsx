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

function dateInputDefault(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export default function ProDetailPage() {
  const params = useParams<{ proId: string }>();
  const [date, setDate] = useState(dateInputDefault());

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
          fetch(`/api/marketplace/availability?proId=${params.proId}&date=${date}&days=7&limit=80`)
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
      {loading ? <p className="empty">Cargando perfil...</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}

      {data ? (
        <>
          <section className="panel">
            <div className="panel-head">
              <h2>{data.user.fullName}</h2>
              <p>
                Rating {Number(data.ratingAvg || 0).toFixed(1)} · {data.ratingsCount} reseñas · {data.isVerified ? "Verificado" : "No verificado"}
              </p>
            </div>
            <p>{data.bio ?? "Sin descripcion"}</p>
            <p>
              <strong>Cobertura:</strong> {data.coverageCity ?? "N/A"} ({data.coveragePostal ?? "N/A"})
            </p>
            <p>
              <strong>Valor hora:</strong> {data.hourlyRateFromClp ? clp(data.hourlyRateFromClp) : "Por definir"}
            </p>
            <p>
              <strong>Contacto:</strong> {data.user.email} {data.user.phone ? `· ${data.user.phone}` : ""}
            </p>
            <div className="cta-row">
              <Link className="cta" href={`/reservar?proId=${data.userId}`}>
                Reservar con este profesional
              </Link>
              <label>
                Fecha
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </label>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Calendario del profesional</h2>
              <p>Disponibilidad detallada por dia y bloque horario.</p>
            </div>
            <div className="calendar-grid">
              {groupedSlots.length === 0 ? (
                <p className="empty">No hay horarios disponibles para esa fecha.</p>
              ) : (
                groupedSlots.map(([day, daySlots]) => (
                  <article className="calendar-day" key={day}>
                    <h3>{day}</h3>
                    <ul>
                      {daySlots.map((slot) => (
                        <li key={slot.id}>
                          {new Date(slot.startsAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })} -{" "}
                          {new Date(slot.endsAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                          {slot.service ? ` · ${slot.service.name}` : " · General"}
                        </li>
                      ))}
                    </ul>
                  </article>
                ))
              )}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
