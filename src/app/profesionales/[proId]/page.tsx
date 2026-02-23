"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
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
  slots: Array<{
    id: string;
    startsAt: string;
    endsAt: string;
    service: { id: string; name: string } | null;
  }>;
};

export default function ProDetailPage() {
  const params = useParams<{ proId: string }>();
  const [data, setData] = useState<ProfessionalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/marketplace/pros/${params.proId}`);
        const body = (await response.json()) as { professional?: ProfessionalDetail; error?: string; detail?: string };
        if (!response.ok || !body.professional) {
          throw new Error(body.detail || body.error || "No se pudo cargar perfil");
        }
        setData(body.professional);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inesperado");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [params.proId]);

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
              <strong>Contacto:</strong> {data.user.email} {data.user.phone ? `· ${data.user.phone}` : ""}
            </p>
            <Link className="cta" href={`/reservar?proId=${data.userId}`}>
              Reservar con este profesional
            </Link>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Disponibilidad</h2>
            </div>
            <div className="list">
              {data.slots.map((slot) => (
                <article key={slot.id} className="booking-card">
                  <p>
                    <strong>Inicio:</strong> {new Date(slot.startsAt).toLocaleString("es-ES")}
                  </p>
                  <p>
                    <strong>Fin:</strong> {new Date(slot.endsAt).toLocaleString("es-ES")}
                  </p>
                  <p>
                    <strong>Servicio:</strong> {slot.service?.name ?? "General"}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
