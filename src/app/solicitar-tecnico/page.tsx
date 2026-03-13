"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { MarketNav } from "@/components/market-nav";
import { CORE_CATEGORY_SLUGS, CORE_SERVICES } from "@/lib/core-services";

type CatalogCategory = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  services: Array<{ id: string; name: string; basePriceClp: number }>;
};

type ApiProfessional = {
  id: string;
  userId: string;
  ratingAvg: number;
  ratingsCount: number;
  hourlyRateFromClp: number | null;
  distanceKm?: number;
  coverageCity: string | null;
  serviceRadiusKm: number;
  user: { fullName: string };
  slots?: Array<{ id: string; startsAt: string }>;
};

type TaskerCard = {
  id: string;
  userId: string;
  fullName: string;
  ratingAvg: number;
  ratingsCount: number;
  hourlyRateFromClp: number | null;
  distanceKm: number | null;
  coverageCity: string | null;
  serviceRadiusKm: number;
  nextSlotAt: string | null;
};

const FALLBACK_TASKERS: Omit<TaskerCard, "id" | "userId">[] = [
  {
    fullName: "Camila Rojas",
    ratingAvg: 4.9,
    ratingsCount: 52,
    hourlyRateFromClp: 14000,
    distanceKm: 1.4,
    coverageCity: "Santiago",
    serviceRadiusKm: 12,
    nextSlotAt: null
  },
  {
    fullName: "Matías Araya",
    ratingAvg: 4.8,
    ratingsCount: 37,
    hourlyRateFromClp: 13000,
    distanceKm: 2.1,
    coverageCity: "Santiago",
    serviceRadiusKm: 10,
    nextSlotAt: null
  },
  {
    fullName: "Valentina Muñoz",
    ratingAvg: 5,
    ratingsCount: 24,
    hourlyRateFromClp: 16000,
    distanceKm: 3,
    coverageCity: "Santiago",
    serviceRadiusKm: 14,
    nextSlotAt: null
  }
];

const serviceMetaBySlug = new Map<string, { label: string; icon: string }>(
  CORE_SERVICES.map((service) => [service.categorySlug, { label: service.label, icon: service.icon }])
);
const serviceOrderBySlug = new Map<string, number>(CORE_CATEGORY_SLUGS.map((slug, index) => [slug, index]));

function clp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function todayYmd() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeTasker(pro: ApiProfessional, index = 0): TaskerCard {
  const nearestSlot = pro.slots?.[0]?.startsAt ?? null;
  return {
    id: pro.id,
    userId: pro.userId,
    fullName: pro.user.fullName,
    ratingAvg: Number(pro.ratingAvg || 0),
    ratingsCount: Number(pro.ratingsCount || 0),
    hourlyRateFromClp: pro.hourlyRateFromClp ?? null,
    distanceKm: typeof pro.distanceKm === "number" ? pro.distanceKm : Number((1.2 + index * 0.8).toFixed(1)),
    coverageCity: pro.coverageCity,
    serviceRadiusKm: pro.serviceRadiusKm,
    nextSlotAt: nearestSlot
  };
}

export default function SolicitarTecnicoPage() {
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [address, setAddress] = useState("");
  const [serviceDate, setServiceDate] = useState(todayYmd());
  const city = "Santiago";

  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingSamples, setLoadingSamples] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [searchTaskers, setSearchTaskers] = useState<TaskerCard[]>([]);
  const [sampleTaskers, setSampleTaskers] = useState<TaskerCard[]>([]);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId]
  );

  const selectedCategoryName = selectedCategory ? serviceMetaBySlug.get(selectedCategory.slug)?.label ?? selectedCategory.name : "Servicio";
  const selectedCategoryIcon = selectedCategory ? serviceMetaBySlug.get(selectedCategory.slug)?.icon ?? "🛠️" : "🛠️";

  const visibleTaskers = hasSearched && searchTaskers.length > 0 ? searchTaskers : sampleTaskers;
  const showingExamples = !hasSearched || searchTaskers.length === 0;

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        setLoadingCatalog(true);
        setError("");

        const response = await fetch("/api/marketplace/catalog");
        const data = (await response.json()) as { categories?: CatalogCategory[]; error?: string; detail?: string };

        if (!response.ok || !data.categories) {
          throw new Error(data.detail || data.error || "No se pudo cargar el catálogo");
        }

        const visibleSlugSet = new Set<string>(CORE_CATEGORY_SLUGS);
        const ordered = data.categories
          .filter((category) => visibleSlugSet.has(category.slug))
          .sort((a, b) => (serviceOrderBySlug.get(a.slug) ?? 999) - (serviceOrderBySlug.get(b.slug) ?? 999));

        setCategories(ordered);
        if (ordered[0]) {
          setSelectedCategoryId((prev) => prev || ordered[0].id);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inesperado");
      } finally {
        setLoadingCatalog(false);
      }
    };

    void loadCatalog();
  }, []);

  useEffect(() => {
    const loadSamples = async () => {
      if (!selectedCategoryId) return;

      try {
        setLoadingSamples(true);
        const params = new URLSearchParams({
          city,
          categoryId: selectedCategoryId,
          verified: "true",
          limit: "6"
        });

        const response = await fetch(`/api/marketplace/pros?${params.toString()}`);
        const data = (await response.json()) as { professionals?: ApiProfessional[]; error?: string; detail?: string };

        if (!response.ok || !data.professionals) {
          throw new Error(data.detail || data.error || "No se pudieron cargar taskers de ejemplo");
        }

        const normalized = data.professionals.map((pro, index) => normalizeTasker(pro, index));
        if (normalized.length > 0) {
          setSampleTaskers(normalized);
          return;
        }

        setSampleTaskers(
          FALLBACK_TASKERS.map((item, index) => ({
            ...item,
            id: `fallback-${index}`,
            userId: `fallback-${index}`
          }))
        );
      } catch {
        setSampleTaskers(
          FALLBACK_TASKERS.map((item, index) => ({
            ...item,
            id: `fallback-${index}`,
            userId: `fallback-${index}`
          }))
        );
      } finally {
        setLoadingSamples(false);
      }
    };

    void loadSamples();
  }, [city, selectedCategoryId]);

  const searchTaskersByAddress = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setHasSearched(true);

    if (!selectedCategoryId) {
      setError("Selecciona un servicio para buscar taskers.");
      return;
    }

    if (!address.trim()) {
      setError("Ingresa una dirección para buscar taskers.");
      return;
    }

    try {
      setLoadingSearch(true);
      const params = new URLSearchParams({
        city,
        street: address.trim(),
        categoryId: selectedCategoryId,
        date: serviceDate,
        limit: "12"
      });

      const response = await fetch(`/api/marketplace/search-professionals?${params.toString()}`);
      const data = (await response.json()) as { professionals?: ApiProfessional[]; error?: string; detail?: string };

      if (!response.ok || !data.professionals) {
        throw new Error(data.detail || data.error || "No se pudieron buscar taskers");
      }

      const normalized = data.professionals.map((pro, index) => normalizeTasker(pro, index));
      setSearchTaskers(normalized);

      if (normalized.length === 0) {
        setMessage("No encontramos taskers en esa dirección todavía. Te mostramos ejemplos de cómo se vería.");
      } else {
        setMessage(`${normalized.length} tasker(s) encontrados para ${selectedCategoryName}.`);
      }
    } catch (e) {
      setSearchTaskers([]);
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoadingSearch(false);
    }
  };

  const prosHref = selectedCategory
    ? `/services/${selectedCategory.slug}/pros?city=${encodeURIComponent(city)}&address=${encodeURIComponent(address)}&requestedDate=${encodeURIComponent(serviceDate)}`
    : "/services";

  return (
    <main className="page market-shell">
      <MarketNav />

      <section className="panel">
        <div className="panel-head">
          <h2>Buscar un servicio</h2>
          <p>Elige el tipo de servicio, la fecha y la dirección para ver taskers disponibles en tu zona.</p>
        </div>

        <form className="service-search-form" onSubmit={searchTaskersByAddress}>
          <div className="service-search-row">
            <label>
              Tipo de servicio
              <select
                value={selectedCategoryId}
                onChange={(event) => {
                  setSelectedCategoryId(event.target.value);
                  setHasSearched(false);
                  setSearchTaskers([]);
                  setMessage("");
                }}
                disabled={loadingCatalog}
                required
              >
                {categories.length === 0 ? <option value="">Cargando servicios...</option> : null}
                {categories.map((category) => {
                  const meta = serviceMetaBySlug.get(category.slug);
                  return (
                    <option key={category.id} value={category.id}>
                      {meta?.icon ?? "🛠️"} {meta?.label ?? category.name}
                    </option>
                  );
                })}
              </select>
            </label>

            <label>
              Fecha del servicio
              <input type="date" value={serviceDate} min={todayYmd()} onChange={(event) => setServiceDate(event.target.value)} required />
            </label>

            <label>
              Dirección
              <input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Ej: Av. Providencia 1234, Providencia"
                required
              />
            </label>

            <button type="submit" className="cta" disabled={loadingSearch || loadingCatalog}>
              {loadingSearch ? "Buscando..." : "Buscar taskers"}
            </button>
          </div>
          <p className="service-search-meta">
            Ciudad de búsqueda: <strong>{city}</strong> · Fecha seleccionada: <strong>{serviceDate}</strong>
          </p>
        </form>

        {message ? <p className="feedback ok">{message}</p> : null}
        {error ? <p className="feedback error">{error}</p> : null}
      </section>

      <section className="panel">
        <div className="taskers-head">
          <h3>
            {selectedCategoryIcon} {showingExamples ? "Taskers de ejemplo" : "Taskers disponibles"}
          </h3>
          <p>{showingExamples ? `Vista previa para ${selectedCategoryName.toLowerCase()}.` : "Resultados según servicio y dirección."}</p>
        </div>

        {loadingSamples && !hasSearched ? <p className="empty">Cargando taskers de ejemplo...</p> : null}
        {loadingSearch ? <p className="empty">Buscando taskers en tu zona...</p> : null}

        <div className="we-results-list">
          {visibleTaskers.map((tasker) => (
            <article className="we-pro-card" key={`${tasker.id}-${tasker.userId}`}>
              <div className="we-pro-main">
                <div className="we-pro-avatar" aria-hidden>
                  {initials(tasker.fullName)}
                </div>

                <div className="we-pro-content">
                  <div className="we-pro-title-row">
                    <h3>{tasker.fullName}</h3>
                    <span className="we-verified-badge">Verificado</span>
                  </div>

                  <p className="we-pro-rating-line">
                    <span className="we-star">★</span> {tasker.ratingAvg.toFixed(1)} ({tasker.ratingsCount} reseñas)
                  </p>

                  <div className="we-pro-tags">
                    <span className="we-tag">Servicio a domicilio</span>
                    <span className="we-tag">Cobertura {tasker.serviceRadiusKm} km</span>
                    <span className="we-tag">{tasker.coverageCity ?? city}</span>
                  </div>

                  <p className="we-pro-snippet">Perfil apto para {selectedCategoryName.toLowerCase()} con agenda activa y valoración alta.</p>

                  <div className="cta-row we-pro-actions">
                    <Link href={prosHref} className="cta small">
                      Ver disponibilidad
                    </Link>
                    <Link href="/services" className="cta ghost small">
                      Más servicios
                    </Link>
                  </div>
                </div>
              </div>

              <aside className="we-pro-price">
                <strong>{tasker.hourlyRateFromClp ? clp(tasker.hourlyRateFromClp) : "A coordinar"}</strong>
                <span>por hora</span>
                <small>{tasker.distanceKm != null ? `${tasker.distanceKm.toFixed(1)} km` : "Distancia referencial"}</small>
              </aside>
            </article>
          ))}
        </div>

        {!loadingCatalog && visibleTaskers.length === 0 ? (
          <p className="empty">Aún no hay taskers para mostrar en este servicio.</p>
        ) : null}
      </section>
    </main>
  );
}
