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
  const serviceByCategorySlug = new Map<string, { image: string; icon: string }>(
    CORE_SERVICES.map((service) => [service.categorySlug, { image: service.image, icon: service.icon }])
  );

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/marketplace/catalog");
        const data = (await response.json()) as { categories?: Category[]; error?: string; detail?: string };
        if (!response.ok || !data.categories) {
          throw new Error(data.detail || data.error || "No se pudieron cargar las categorías");
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
          <div className="services-page-copy">
            <p>En WeTask puedes encontrar personas confiables para ayudarte con tareas del día a día.</p>
            <p>Estos son algunos de los servicios activos en nuestra etapa inicial:</p>
            <ul>
              <li>🧹 Limpieza del hogar - ayuda para mantener tu casa ordenada y limpia.</li>
              <li>🐶 Cuidado de mascotas - paseos, cuidado por horas o visitas a domicilio.</li>
              <li>👶 Babysitter - cuidado responsable de niños cuando lo necesites.</li>
              <li>📚 Profesor particular - apoyo escolar y clases personalizadas.</li>
              <li>💪 Personal trainer - entrenamiento físico adaptado a tus objetivos.</li>
              <li>👨‍🍳 Chef - menús personalizados y cocina en tu domicilio.</li>
              <li>💄 Maquillaje - looks para eventos, celebraciones y ocasiones especiales.</li>
              <li>👕 Planchado - ayuda con ropa y tareas domésticas específicas.</li>
            </ul>
            <p>
              Estamos comenzando con estos servicios y iremos agregando más categorías a medida que crezca la comunidad.
            </p>
          </div>
        </div>
      </section>

      {loading ? <p className="empty">Cargando categorías...</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}

      <section className="service-grid services-page-grid">
        {categories.map((category) => (
          <Link key={category.id} href={`/services/${category.slug}`} className="service-card services-list-card module-link">
            <div
              className="services-list-card-media"
              style={{ backgroundImage: `url("${serviceByCategorySlug.get(category.slug)?.image ?? ""}")` }}
              aria-hidden
            />
            <strong className="services-list-card-title">
              {serviceByCategorySlug.get(category.slug)?.icon ?? "🛠️"} {category.name}
            </strong>
            <span>{category.description ?? "Servicios disponibles en esta categoría."}</span>
            <span className="services-list-card-price">
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
