"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MarketNav } from "@/components/market-nav";

type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  services: Array<{ id: string; basePriceClp: number }>;
};

const VISIBLE_CATEGORY_SLUGS = ["limpieza", "maestro-polifuncional", "clases-colegio"] as const;

export default function ServiciosPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/marketplace/catalog");
        const data = (await response.json()) as { categories?: Category[]; error?: string; detail?: string };
        if (!response.ok || !data.categories) {
          throw new Error(data.detail || data.error || "No se pudieron cargar las categorias");
        }

        const visible = data.categories.filter((category) => VISIBLE_CATEGORY_SLUGS.includes(category.slug as (typeof VISIBLE_CATEGORY_SLUGS)[number]));
        setCategories(visible);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inesperado");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <main className="page market-shell">
      <MarketNav />
      <section className="panel">
        <div className="panel-head">
          <h2>Servicios</h2>
          <p>Partimos simple: limpieza, maestro y clases.</p>
        </div>
      </section>

      {loading ? <p className="empty">Cargando categorias...</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}

      <section className="service-grid">
        {categories.map((category) => (
          <Link key={category.id} href={`/services/${category.slug}`} className="service-card module-link">
            <strong>{category.slug === "clases-colegio" ? "Clases" : category.name}</strong>
            <span>{category.description ?? "Servicios disponibles en esta categoria."}</span>
            <span>
              {category.services.length > 0
                ? `Desde ${new Intl.NumberFormat("es-CL", {
                    style: "currency",
                    currency: "CLP",
                    maximumFractionDigits: 0
                  }).format(Math.min(...category.services.map((service) => service.basePriceClp)))}`
                : "Precio por definir"}
            </span>
          </Link>
        ))}
      </section>
    </main>
  );
}
