"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthHeroNav } from "@/components/auth-hero-nav";
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
    <main className="auth-flow-screen auth-flow-screen-scroll">
      <div className="auth-flow-backdrop" aria-hidden />
      <div className="login-screen-content">
        <AuthHeroNav />

        <section className="auth-flow-shell auth-flow-shell-wide">
          <div className="auth-flow-copy">
            <p className="auth-flow-kicker">Servicios WeTask</p>
            <h1>Reserva ayuda confiable para lo que necesitas hoy.</h1>
            <p>
              Explora nuestras categorías activas y entra directo al servicio que quieras contratar con cobertura real, precio visible y pago protegido.
            </p>

            <div className="auth-flow-copy-list">
              <div className="auth-flow-meta-card">
                <strong>Servicios activos</strong>
                <span>Limpieza, mascotas, babysitter, profesor particular, personal trainer, chef, maquillaje y planchado.</span>
              </div>
              <div className="auth-flow-meta-card">
                <strong>Flujo simple</strong>
                <span>Elige categoría, agrega tu dirección y revisa disponibilidad de profesionales en tu zona.</span>
              </div>
            </div>
          </div>

          <section className="auth-flow-panel auth-flow-panel-wide">
            <div className="panel-head auth-flow-panel-head">
              <h2>Servicios disponibles</h2>
              <p>Partimos con las categorías más pedidas para validar la experiencia WeTask.</p>
            </div>

            {loading ? <p className="empty">Cargando categorías...</p> : null}
            {error ? <p className="feedback error">{error}</p> : null}

            <div className="services-showcase-grid">
              {categories.map((category) => (
                <Link key={category.id} href={`/services/${category.slug}`} className="services-showcase-card">
                  <div
                    className="services-showcase-media"
                    style={{ backgroundImage: `url("${serviceByCategorySlug.get(category.slug)?.image ?? ""}")` }}
                    aria-hidden
                  />
                  <div className="services-showcase-copy">
                    <strong>
                      {serviceByCategorySlug.get(category.slug)?.icon ?? "🛠️"} {category.name}
                    </strong>
                    <span>{category.description ?? "Servicios disponibles en esta categoría."}</span>
                    <small>
                      {category.services.length > 0
                        ? `Desde ${new Intl.NumberFormat("es-CL", {
                            style: "currency",
                            currency: "CLP",
                            maximumFractionDigits: 0
                          }).format(Math.min(...category.services.map((service) => service.basePriceClp)))}`
                        : "Precio por definir"}
                    </small>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
