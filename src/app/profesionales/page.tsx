"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MarketNav } from "@/components/market-nav";

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

function clp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

function dateText(value?: string) {
  if (!value) return "Sin disponibilidad";
  return new Date(value).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
}

export default function ProfesionalesPage() {
  const [city, setCity] = useState("Madrid");
  const [verified, setVerified] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [professionals, setProfessionals] = useState<Professional[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({ city, limit: "30" });
        if (verified) params.set("verified", "true");
        const response = await fetch(`/api/marketplace/pros?${params.toString()}`);
        const data = (await response.json()) as { professionals?: Professional[]; error?: string; detail?: string };
        if (!response.ok || !data.professionals) {
          throw new Error(data.detail || data.error || "No se pudo cargar profesionales");
        }
        setProfessionals(data.professionals);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inesperado");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [city, verified]);

  return (
    <main className="page market-shell">
      <MarketNav />
      <section className="panel">
        <div className="panel-head">
          <h2>Listado de profesionales</h2>
        </div>
        <div className="query-row query-pros">
          <label>
            Ciudad
            <input value={city} onChange={(e) => setCity(e.target.value)} />
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
                Ver perfil
              </Link>
              <Link className="cta ghost small" href={`/reservar?proId=${pro.userId}`}>
                Reservar
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
