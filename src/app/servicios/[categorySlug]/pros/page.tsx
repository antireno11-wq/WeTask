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

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() ?? "")
    .join("");
}

function profileSnippet(categoryName: string) {
  return `Profesional verificado para ${categoryName.toLowerCase()}, con agenda activa y servicios a domicilio en tu zona.`;
}

function localYmd(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function timeToMinutes(value: string) {
  const [hh, mm] = value.split(":").map((chunk) => Number(chunk));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
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
  const comuna = search.get("comuna") ?? search.get("commune") ?? "";
  const city = search.get("city") ?? "Santiago";
  const requestedDate = search.get("requestedDate") ?? "";
  const requestedTime = search.get("requestedTime") ?? "";
  const requestedMinutes = requestedTime ? timeToMinutes(requestedTime) : null;
  const requestedIso = useMemo(() => {
    if (!requestedDate || !requestedTime) return undefined;
    const parsed = new Date(`${requestedDate}T${requestedTime}:00`);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return parsed.toISOString();
  }, [requestedDate, requestedTime]);

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
          categoryId: match.id,
          limit: "40"
        });
        if (address.trim()) qs.set("street", address.trim());
        if (comuna) qs.set("commune", comuna);
        if (requestedIso) qs.set("date", requestedIso);

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
  }, [address, categorySlug, city, comuna, requestedIso]);

  const professionals = useMemo(() => {
    let filtered = [...allPros];

    if (requestedDate && requestedMinutes != null) {
      filtered = filtered.filter((pro) =>
        pro.slots.some((slot) => {
          const startsAt = new Date(slot.startsAt);
          const sameDay = localYmd(startsAt) === requestedDate;
          const slotMinutes = startsAt.getHours() * 60 + startsAt.getMinutes();
          return sameDay && slotMinutes >= requestedMinutes;
        })
      );
    }

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
  }, [allPros, availability, requestedDate, requestedMinutes, sortBy]);

  return (
    <main className="page market-shell">
      <MarketNav />

      <section className="panel">
        <div className="panel-head">
          <h2>
            {category?.name ?? "Servicio"} en {comuna || city}
          </h2>
          <p>
            {address || "Sin direccion"}
            {comuna ? `, ${comuna}` : ""} · {city}
          </p>
          {requestedDate && requestedTime ? (
            <p>
              Horario solicitado: <strong>{requestedDate}</strong> a las <strong>{requestedTime}</strong>
            </p>
          ) : null}
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
          <Link
            href={`/services/${categorySlug}?address=${encodeURIComponent(address)}&comuna=${encodeURIComponent(comuna)}&city=${encodeURIComponent(city)}&requestedDate=${encodeURIComponent(requestedDate)}&requestedTime=${encodeURIComponent(requestedTime)}`}
            className="cta ghost small"
          >
            Cambiar direccion y horario
          </Link>
          <button type="button" className="cta ghost small" onClick={() => setNotifyMessage("Te avisaremos cuando haya cobertura en tu zona.")}>
            Avisarme cuando haya
          </button>
        </div>
      </section>

      {loading ? <p className="empty">Buscando profesionales...</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}
      {notifyMessage ? <p className="feedback ok">{notifyMessage}</p> : null}
      {!loading && !error && professionals.length === 0 ? (
        <p className="feedback error">No encontramos taskers en esa zona y horario. Prueba otro horario o direccion.</p>
      ) : null}

      <section className="we-results-list">
        {professionals.map((pro) => (
          <article className="we-pro-card" key={pro.id}>
            <div className="we-pro-main">
              <div className="we-pro-avatar" aria-hidden>
                {initials(pro.user.fullName)}
              </div>

              <div className="we-pro-content">
                <div className="we-pro-title-row">
                  <h3>{pro.user.fullName}</h3>
                  <span className="we-verified-badge">Verificado</span>
                </div>

                <p className="we-pro-rating-line">
                  <span className="we-star">★</span> {Number(pro.ratingAvg || 0).toFixed(1)} ({pro.ratingsCount}) · {Math.max(8, pro.ratingsCount * 3)} servicios
                </p>

                <div className="we-pro-tags">
                  <span className="we-tag">Equipo de trabajo</span>
                  <span className="we-tag">Agenda actualizada</span>
                  <span className="we-tag">Radio {pro.serviceRadiusKm} km</span>
                </div>

                <p className="we-pro-snippet">{profileSnippet(category?.name ?? "servicios")}</p>

                <div className="cta-row we-pro-actions">
                  <Link className="cta small" href={`/profesionales/${pro.userId}`}>
                    Ver perfil
                  </Link>
                  <Link
                    className="cta small"
                    href={`/profesionales/${pro.userId}?date=${encodeURIComponent(requestedDate || localYmd(new Date()))}#availability`}
                  >
                    Ver agenda
                  </Link>
                </div>
              </div>
            </div>

            <aside className="we-pro-price">
              <strong>{pro.hourlyRateFromClp ? clp(pro.hourlyRateFromClp) : "Por definir"}</strong>
              <span>por hora</span>
              <small>{pro.distanceKm.toFixed(1)} km</small>
            </aside>
          </article>
        ))}
      </section>
    </main>
  );
}
