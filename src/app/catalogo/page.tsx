"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { MarketNav } from "@/components/market-nav";

type Service = {
  id: string;
  slug: string;
  name: string;
  description: string;
  basePriceClp: number;
  durationMin: number;
};

type Category = {
  id: string;
  slug: string;
  name: string;
  minHours: number;
  slotMinutes: number;
  services: Service[];
};

function clp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

export default function CatalogoPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/marketplace/catalog");
        const data = (await response.json()) as { categories?: Category[]; error?: string; detail?: string };
        if (!response.ok || !data.categories) {
          throw new Error(data.detail || data.error || "No se pudo cargar catalogo");
        }
        setCategories(data.categories);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inesperado");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return categories;
    return categories
      .map((category) => ({
        ...category,
        services: category.services.filter(
          (service) => service.name.toLowerCase().includes(term) || service.description.toLowerCase().includes(term)
        )
      }))
      .filter((category) => category.services.length > 0 || category.name.toLowerCase().includes(term));
  }, [categories, query]);

  return (
    <main className="page market-shell">
      <MarketNav />
      <section className="panel">
        <div className="panel-head">
          <h2>Catalogo de servicios</h2>
          <p>Filtro por nombre o descripcion.</p>
        </div>
        <label>
          Buscar
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ej: limpieza, electrica, jardineria" />
        </label>
      </section>

      {loading ? <p className="empty">Cargando catalogo...</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}

      {filtered.map((category) => (
        <section key={category.id} className="panel">
          <div className="panel-head">
            <h2>{category.name}</h2>
            <p>
              Minimo {category.minHours}h · Bloques de {category.slotMinutes} min
            </p>
          </div>
          <div className="service-grid">
            {category.services.map((service) => (
              <article key={service.id} className="service-card active">
                <strong>{service.name}</strong>
                <span>{service.description}</span>
                <span>
                  Desde {clp(service.basePriceClp)} / hora · Duracion base {service.durationMin} min
                </span>
                <Link className="cta small" href={`/reservar?serviceId=${service.id}`}>
                  Reservar
                </Link>
              </article>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
