"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MarketNav } from "@/components/market-nav";
import { CORE_CATEGORY_SLUGS, CORE_SERVICES } from "@/lib/core-services";

type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  services: Array<{ id: string; basePriceClp: number }>;
};

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

        const labelByCategorySlug = new Map<string, string>(CORE_SERVICES.map((service) => [service.categorySlug, service.label]));
        const visibleSlugSet = new Set<string>(CORE_CATEGORY_SLUGS);
        const orderBySlug = new Map<string, number>(CORE_CATEGORY_SLUGS.map((slug, index) => [slug, index]));
        const visible = data.categories
          .filter((category) => visibleSlugSet.has(category.slug))
          .sort((a, b) => (orderBySlug.get(a.slug) ?? 999) - (orderBySlug.get(b.slug) ?? 999))
          .map((category) => ({
            ...category,
            name: labelByCategorySlug.get(category.slug) ?? category.name
          }));
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
          <p>Servicios activos para el MVP: limpieza, mascotas, babysitter, profesor particular, personal trainer y planchado.</p>
        </div>
      </section>

      {loading ? <p className="empty">Cargando categorias...</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}

      <section className="service-grid">
        {categories.map((category) => (
          <Link key={category.id} href={`/services/${category.slug}`} className="service-card module-link">
            <strong>{category.name}</strong>
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
