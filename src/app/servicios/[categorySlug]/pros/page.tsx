"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MarketNav } from "@/components/market-nav";

type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  services: Array<{ id: string; name: string; basePriceClp: number }>;
};

type Professional = {
  id: string;
  userId: string;
  ratingAvg: number;
  ratingsCount: number;
  hourlyRateFromClp: number | null;
  distanceKm: number;
  coverageCity: string | null;
  serviceRadiusKm: number;
  user: { fullName: string };
  slots: Array<{ id: string; startsAt: string }>;
};

type SortBy = "best" | "near" | "cheap";

type AvailabilityFilter = "all" | "today" | "week";

function clp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

function starsText(value: number) {
  const rounded = Math.max(1, Math.min(5, Math.round(value || 0)));
  return `${"★".repeat(rounded)}${"☆".repeat(5 - rounded)}`;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() ?? "")
    .join("");
}

export default function ServiceProsPage() {
  const params = useParams<{ categorySlug: string }>();
  const search = useSearchParams();
  const categorySlug = params?.categorySlug ?? "";

  const [category, setCategory] = useState<Category | null>(null);
  const [allPros, setAllPros] = useState<Professional[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>("best");
  const [availability, setAvailability] = useState<AvailabilityFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notifyMessage, setNotifyMessage] = useState("");

  const address = search.get("address") ?? "";
  const comuna = search.get("comuna") ?? "";
  const city = search.get("city") ?? "Santiago";
  const postalCode = search.get("postalCode") ?? "7500000";

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        setNotifyMessage("");

        const catalogRes = await fetch("/api/marketplace/catalog");
        const catalogData = (await catalogRes.json()) as { categories?: Category[]; error?: string; detail?: string };
        if (!catalogRes.ok || !catalogData.categories) {
          throw new Error(catalogData.detail || catalogData.error || "No se pudo cargar catalogo");
        }

        const match = catalogData.categories.find((item) => item.slug === categorySlug) ?? null;
        if (!match) throw new Error("Categoria no encontrada");
        setCategory(match);

        const qs = new URLSearchParams({
          city,
          postalCode,
          categoryId: match.id,
          limit: "40"
        });
        const streetQuery = `${address}${comuna ? `, ${comuna}` : ""}`.trim();
        if (streetQuery) qs.set("street", streetQuery);

        const prosRes = await fetch(`/api/marketplace/search-professionals?${qs.toString()}`);
        const prosData = (await prosRes.json()) as { professionals?: Professional[]; error?: string; detail?: string };
        if (!prosRes.ok || !prosData.professionals) {
          throw new Error(prosData.detail || prosData.error || "No se pudieron cargar profesionales");
        }

        setAllPros(prosData.professionals);

        if (prosData.professionals.length === 0) {
          setNotifyMessage("Aun no tenemos cobertura en esta direccion. Puedes activar aviso cuando haya profesionales.");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inesperado");
      } finally {
        setLoading(false);
      }
    };

    if (categorySlug) void load();
  }, [address, categorySlug, city, comuna, postalCode]);

  const professionals = useMemo(() => {
    let filtered = [...allPros];

    if (availability !== "all") {
      const now = new Date();
      const end = new Date();
      if (availability === "today") {
        end.setHours(23, 59, 59, 999);
      } else {
        end.setDate(end.getDate() + 7);
      }

      filtered = filtered.filter((pro) =>
        pro.slots.some((slot) => {
          const startsAt = new Date(slot.startsAt);
          return startsAt >= now && startsAt <= end;
        })
      );
    }

    if (sortBy === "near") {
      filtered.sort((a, b) => a.distanceKm - b.distanceKm);
    } else if (sortBy === "cheap") {
      filtered.sort((a, b) => (a.hourlyRateFromClp ?? Number.MAX_SAFE_INTEGER) - (b.hourlyRateFromClp ?? Number.MAX_SAFE_INTEGER));
    } else {
      filtered.sort((a, b) => {
        const scoreA = Number(a.ratingAvg) * 100 + a.ratingsCount;
        const scoreB = Number(b.ratingAvg) * 100 + b.ratingsCount;
        return scoreB - scoreA;
      });
    }

    return filtered;
  }, [allPros, availability, sortBy]);

  return (
    <main className="page market-shell">
      <MarketNav />

      <section className="panel">
        <div className="panel-head">
          <h2>{category?.name ?? "Servicio"}</h2>
          <p>
            Direccion: {address || "Sin direccion"}
            {comuna ? `, ${comuna}` : ""} · {city}
          </p>
        </div>

        <div className="query-row">
          <label>
            Ordenar por
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortBy)}>
              <option value="best">Mejor valorado</option>
              <option value="near">Mas cercano</option>
              <option value="cheap">Mas economico</option>
            </select>
          </label>
          <label>
            Disponibilidad
            <select value={availability} onChange={(event) => setAvailability(event.target.value as AvailabilityFilter)}>
              <option value="all">Todas</option>
              <option value="today">Disponible hoy</option>
              <option value="week">Disponible esta semana</option>
            </select>
          </label>
        </div>

        <div className="cta-row">
          <Link href={`/services/${categorySlug}?address=${encodeURIComponent(address)}&comuna=${encodeURIComponent(comuna)}&city=${encodeURIComponent(city)}&postalCode=${encodeURIComponent(postalCode)}`} className="cta ghost small">
            Cambiar direccion
          </Link>
          <button type="button" className="cta ghost small" onClick={() => setNotifyMessage("Te avisaremos cuando haya cobertura en tu zona.")}>Avisarme cuando haya</button>
        </div>
      </section>

      {loading ? <p className="empty">Buscando profesionales...</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}
      {notifyMessage ? <p className="feedback ok">{notifyMessage}</p> : null}

      <section className="pro-card-grid">
        {professionals.map((pro) => (
          <article className="booking-card" key={pro.id}>
            <div className="pro-card-top">
              <div className="pro-avatar" aria-hidden>
                {initials(pro.user.fullName)}
              </div>
              <div>
                <h3>{pro.user.fullName}</h3>
                <p>
                  {starsText(Number(pro.ratingAvg || 0))} {Number(pro.ratingAvg || 0).toFixed(1)} ({pro.ratingsCount})
                </p>
              </div>
            </div>

            <p>
              <strong>Precio:</strong> {pro.hourlyRateFromClp ? clp(pro.hourlyRateFromClp) : "Por definir"}
            </p>
            <p>
              <strong>Servicios realizados:</strong> {Math.max(0, pro.ratingsCount * 3)}
            </p>
            <p>
              <strong>Distancia aprox:</strong> {pro.distanceKm.toFixed(1)} km
            </p>
            <p>
              <strong>Cobertura:</strong> {pro.coverageCity ?? "Santiago"} · radio {pro.serviceRadiusKm} km
            </p>

            <div className="cta-row">
              <Link className="cta small" href={`/pro/${pro.userId}`}>
                Ver perfil
              </Link>
              <Link
                className="cta ghost small"
                href={`/booking/new?proId=${pro.userId}${category?.services[0] ? `&serviceId=${category.services[0].id}` : ""}&address=${encodeURIComponent(address)}&city=${encodeURIComponent(city)}&postalCode=${encodeURIComponent(postalCode)}`}
              >
                Reservar
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
