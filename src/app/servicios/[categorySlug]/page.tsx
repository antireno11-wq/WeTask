"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MarketNav } from "@/components/market-nav";

type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  services: Array<{ id: string; name: string }>;
};

type Professional = {
  id: string;
  userId: string;
  isVerified: boolean;
  ratingAvg: number;
  ratingsCount: number;
  coverageCity: string | null;
  coverageComuna: string | null;
  serviceRadiusKm: number;
  hourlyRateFromClp: number | null;
  user: { fullName: string };
  slots: Array<{ startsAt: string; service: { id: string; name: string } | null }>;
};

function clp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

export default function ServicioCategoriaPage() {
  const params = useParams<{ categorySlug: string }>();
  const categorySlug = params?.categorySlug ?? "";

  const [category, setCategory] = useState<Category | null>(null);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const catalogRes = await fetch("/api/marketplace/catalog");
        const catalogData = (await catalogRes.json()) as { categories?: Category[]; error?: string; detail?: string };
        if (!catalogRes.ok || !catalogData.categories) {
          throw new Error(catalogData.detail || catalogData.error || "No se pudieron cargar las categorias");
        }

        const match = catalogData.categories.find((item) => item.slug === categorySlug) ?? null;
        if (!match) {
          throw new Error("Categoria no encontrada");
        }
        setCategory(match);

        const prosRes = await fetch(`/api/marketplace/pros?categoryId=${match.id}&city=Santiago&verified=true&limit=30`);
        const prosData = (await prosRes.json()) as { professionals?: Professional[]; error?: string; detail?: string };
        if (!prosRes.ok || !prosData.professionals) {
          throw new Error(prosData.detail || prosData.error || "No se pudieron cargar profesionales");
        }
        setProfessionals(prosData.professionals);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inesperado");
      } finally {
        setLoading(false);
      }
    };
    if (categorySlug) void load();
  }, [categorySlug]);

  const serviceNames = useMemo(() => category?.services.map((item) => item.name) ?? [], [category]);

  return (
    <main className="page market-shell">
      <MarketNav />

      <section className="panel">
        <div className="panel-head">
          <h2>{category?.name ?? "Categoria"}</h2>
          <p>{category?.description ?? "Profesionales disponibles para esta categoria."}</p>
        </div>
        <div className="chips">
          {serviceNames.map((name) => (
            <span key={name} className="chip">
              {name}
            </span>
          ))}
        </div>
        <div className="cta-row">
          <Link href="/servicios" className="cta ghost small">
            Volver a categorias
          </Link>
        </div>
      </section>

      {loading ? <p className="empty">Cargando profesionales...</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}

      {!loading && !error && professionals.length === 0 ? (
        <p className="empty">No hay profesionales activos en esta categoria por ahora.</p>
      ) : null}

      <section className="pro-card-grid">
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
              <strong>Zona:</strong> {pro.coverageComuna ?? "Sin comuna"} · {pro.coverageCity ?? "Sin ciudad"}
            </p>
            <p>
              <strong>Precio/hora:</strong> {pro.hourlyRateFromClp ? clp(pro.hourlyRateFromClp) : "Por definir"}
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
