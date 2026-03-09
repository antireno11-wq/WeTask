"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { MarketNav } from "@/components/market-nav";

type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  services: Array<{ id: string; name: string; basePriceClp: number }>;
};

function clp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

export default function ServicioCategoriaPage() {
  const params = useParams<{ categorySlug: string }>();
  const categorySlug = params?.categorySlug ?? "";
  const router = useRouter();
  const query = useSearchParams();

  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [coverageNote, setCoverageNote] = useState("");

  const [address, setAddress] = useState({
    street: query.get("address") ?? "",
    comuna: query.get("comuna") ?? "",
    city: query.get("city") ?? "Santiago",
    postalCode: query.get("postalCode") ?? "7500000"
  });

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
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inesperado");
      } finally {
        setLoading(false);
      }
    };
    if (categorySlug) void load();
  }, [categorySlug]);

  const serviceNames = useMemo(() => category?.services.map((item) => item.name) ?? [], [category]);

  const minPrice = useMemo(() => {
    if (!category || category.services.length === 0) return null;
    return Math.min(...category.services.map((item) => item.basePriceClp));
  }, [category]);

  const openPros = (event: FormEvent) => {
    event.preventDefault();
    if (!category) return;
    if (!address.city.trim() || !address.postalCode.trim() || !address.street.trim()) {
      setCoverageNote("Completa direccion, comuna y ciudad para validar cobertura.");
      return;
    }

    const qs = new URLSearchParams({
      address: address.street.trim(),
      comuna: address.comuna.trim(),
      city: address.city.trim(),
      postalCode: address.postalCode.trim()
    });

    router.push(`/services/${category.slug}/pros?${qs.toString()}`);
  };

  return (
    <main className="page market-shell">
      <MarketNav />

      <section className="panel">
        {loading ? <p className="empty">Cargando categoria...</p> : null}
        {error ? <p className="feedback error">{error}</p> : null}

        {category ? (
          <>
            <div className="panel-head">
              <h2>{category.name}</h2>
              <p>{category.description ?? "Encuentra profesionales verificados para este servicio."}</p>
            </div>

            <p>
              <strong>Precio desde:</strong> {minPrice ? clp(minPrice) : "Por definir"}
            </p>

            <div className="chips">
              {serviceNames.map((name) => (
                <span key={name} className="chip">
                  {name}
                </span>
              ))}
            </div>

            <form className="grid-form" onSubmit={openPros}>
              <label className="full">
                Direccion
                <input
                  value={address.street}
                  onChange={(event) => setAddress((prev) => ({ ...prev, street: event.target.value }))}
                  placeholder="Calle y numero"
                  required
                />
              </label>
              <label>
                Comuna
                <input
                  value={address.comuna}
                  onChange={(event) => setAddress((prev) => ({ ...prev, comuna: event.target.value }))}
                  placeholder="Providencia"
                />
              </label>
              <label>
                Ciudad
                <input
                  value={address.city}
                  onChange={(event) => setAddress((prev) => ({ ...prev, city: event.target.value }))}
                  required
                />
              </label>
              <label>
                Codigo postal
                <input
                  value={address.postalCode}
                  onChange={(event) => setAddress((prev) => ({ ...prev, postalCode: event.target.value }))}
                  required
                />
              </label>
              <div className="cta-row service-category-actions">
                <button type="submit" className="cta">
                  Ver profesionales disponibles
                </button>
                <Link href="/services" className="cta small">
                  Ver todas las categorias
                </Link>
              </div>
            </form>

            {coverageNote ? <p className="feedback error">{coverageNote}</p> : null}

            <p className="minimal-note">Si no hay cobertura en tu zona podras activar “Avisarme cuando haya”.</p>
          </>
        ) : null}
      </section>
    </main>
  );
}
