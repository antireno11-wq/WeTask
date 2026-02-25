"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MarketNav } from "@/components/market-nav";

type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  services: Array<{ id: string }>;
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
        setCategories(data.categories);
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
          <p>Primero elige una categoria para ver profesionales disponibles.</p>
        </div>
      </section>

      {loading ? <p className="empty">Cargando categorias...</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}

      <section className="service-grid">
        {categories.map((category) => (
          <Link key={category.id} href={`/servicios/${category.slug}`} className="service-card module-link">
            <strong>{category.name}</strong>
            <span>{category.description ?? "Servicios disponibles en esta categoria."}</span>
            <span>{category.services.length} servicios</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
