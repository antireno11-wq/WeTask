"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MarketNav } from "@/components/market-nav";
import { BABYSITTER_TASK_INCLUDED_OPTIONS } from "@/lib/babysitter-scope";
import { CHEF_TASK_INCLUDED_OPTIONS } from "@/lib/chef-scope";
import { copyCleaningEstimateParams, parseCleaningRecommendedHours, parseCleaningServiceSlug } from "@/lib/cleaning-duration-estimator";
import { CLEANING_TASK_INCLUDED_OPTIONS, getCleaningTaskOptionsForService } from "@/lib/cleaning-scope";
import { IRONING_TASK_INCLUDED_OPTIONS } from "@/lib/ironing-scope";
import { MAKEUP_TASK_INCLUDED_OPTIONS } from "@/lib/makeup-scope";
import { PET_TASK_INCLUDED_OPTIONS } from "@/lib/pet-scope";
import { TEACHER_TASK_INCLUDED_OPTIONS } from "@/lib/teacher-scope";
import { TRAINER_TASK_INCLUDED_OPTIONS } from "@/lib/trainer-scope";

type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  services: Array<{ id: string; slug: string; name: string; basePriceClp: number }>;
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
  cleaningScope?: unknown;
  user: { fullName: string };
  slots: Array<{ id: string; startsAt: string }>;
};

type SortBy = "best" | "near" | "cheap";
type AvailabilityFilter = "all" | "today" | "week";
type TaskFilterOption = { value: string; label: string };

const TASK_FILTER_OPTIONS_BY_CATEGORY: Record<string, TaskFilterOption[]> = {
  limpieza: [...CLEANING_TASK_INCLUDED_OPTIONS],
  mascotas: [...PET_TASK_INCLUDED_OPTIONS],
  babysitter: [...BABYSITTER_TASK_INCLUDED_OPTIONS],
  "personal-trainer": [...TRAINER_TASK_INCLUDED_OPTIONS],
  "profesor-particular": [...TEACHER_TASK_INCLUDED_OPTIONS],
  chef: [...CHEF_TASK_INCLUDED_OPTIONS],
  maquillaje: [...MAKEUP_TASK_INCLUDED_OPTIONS],
  planchado: [...IRONING_TASK_INCLUDED_OPTIONS]
};

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
  const [usedCategoryFallback, setUsedCategoryFallback] = useState(false);

  const address = search.get("address") ?? "";
  const apartment = search.get("apartment") ?? "";
  const reference = search.get("reference") ?? "";
  const comuna = search.get("comuna") ?? search.get("commune") ?? "";
  const city = search.get("city") ?? "Santiago";
  const requestedDate = search.get("requestedDate") ?? "";
  const requestedTime = search.get("requestedTime") ?? "";
  const categoryTaskOptions = useMemo(() => TASK_FILTER_OPTIONS_BY_CATEGORY[categorySlug] ?? [], [categorySlug]);
  const initialRequestedTasks = (search.get("tasks") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => categoryTaskOptions.some((option) => option.value === item));
  const [selectedTasks, setSelectedTasks] = useState<string[]>(initialRequestedTasks);
  const selectedServiceId = search.get("serviceId") ?? "";
  const recommendedHours = parseCleaningRecommendedHours(search.get("recommendedHours"));
  const estimatedMinHours = search.get("estimatedMinHours") ?? "";
  const estimatedMaxHours = search.get("estimatedMaxHours") ?? "";
  const requestedMinutes = requestedTime ? timeToMinutes(requestedTime) : null;
  const requestedIso = useMemo(() => {
    if (!requestedDate || !requestedTime) return undefined;
    const parsed = new Date(`${requestedDate}T${requestedTime}:00`);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return parsed.toISOString();
  }, [requestedDate, requestedTime]);
  const contextQuery = useMemo(() => {
    const qs = new URLSearchParams();
    if (address) qs.set("address", address);
    if (apartment) qs.set("apartment", apartment);
    if (reference) qs.set("reference", reference);
    if (comuna) qs.set("comuna", comuna);
    if (city) qs.set("city", city);
    if (requestedDate) qs.set("date", requestedDate);
    if (requestedTime) qs.set("requestedTime", requestedTime);
    if (selectedServiceId) qs.set("serviceId", selectedServiceId);
    if (selectedTasks.length > 0) qs.set("tasks", selectedTasks.join(","));
    copyCleaningEstimateParams(search, qs);
    return qs.toString();
  }, [address, apartment, city, comuna, reference, requestedDate, requestedTime, search, selectedServiceId, selectedTasks]);
  const selectedService = useMemo(
    () => category?.services.find((service) => service.id === selectedServiceId) ?? null,
    [category, selectedServiceId]
  );
  const selectedCleaningServiceSlug = useMemo(() => parseCleaningServiceSlug(selectedService?.slug), [selectedService?.slug]);
  const availableTaskOptions = useMemo(() => {
    if (categorySlug !== "limpieza") return categoryTaskOptions;
    return getCleaningTaskOptionsForService(selectedCleaningServiceSlug);
  }, [categorySlug, categoryTaskOptions, selectedCleaningServiceSlug]);

  useEffect(() => {
    setSelectedTasks((current) => current.filter((item) => availableTaskOptions.some((option) => option.value === item)));
  }, [availableTaskOptions]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        setNotifyMessage("");
        setUsedCategoryFallback(false);

        const catalogRes = await fetch("/api/marketplace/catalog");
        const catalogData = (await catalogRes.json()) as { categories?: Category[]; error?: string; detail?: string };
        if (!catalogRes.ok || !catalogData.categories) {
          throw new Error(catalogData.detail || catalogData.error || "No se pudo cargar catálogo");
        }

        const match = catalogData.categories.find((item) => item.slug === categorySlug) ?? null;
        if (!match) throw new Error("Categoria no encontrada");
        setCategory(match);

        const fetchProfessionals = async (strictServiceFilter: boolean) => {
          const qs = new URLSearchParams({
            city,
            categoryId: match.id,
            limit: "40"
          });
          if (strictServiceFilter && selectedServiceId) qs.set("serviceId", selectedServiceId);
          if (address.trim()) qs.set("street", address.trim());
          if (comuna) qs.set("commune", comuna);
          if (requestedIso) qs.set("date", requestedIso);
          if (selectedTasks.length > 0) qs.set("tasks", selectedTasks.join(","));

          const response = await fetch(`/api/marketplace/search-professionals?${qs.toString()}`);
          const data = (await response.json()) as { professionals?: Professional[]; error?: string; detail?: string };
          if (!response.ok || !data.professionals) {
            throw new Error(data.detail || data.error || "No se pudieron cargar profesionales");
          }
          return data.professionals;
        };

        let nextProfessionals = await fetchProfessionals(true);

        if (nextProfessionals.length === 0 && selectedServiceId) {
          nextProfessionals = await fetchProfessionals(false);
          if (nextProfessionals.length > 0) {
            setUsedCategoryFallback(true);
            setNotifyMessage(
              `No encontramos taskers publicados para ese tipo exacto todavía, así que te mostramos profesionales disponibles de ${match.name.toLowerCase()} en tu comuna.`
            );
          }
        }

        setAllPros(nextProfessionals);

        if (nextProfessionals.length === 0) {
          setNotifyMessage("Aún no tenemos cobertura en esta dirección. Puedes activar aviso cuando haya profesionales.");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inesperado");
      } finally {
        setLoading(false);
      }
    };

    if (categorySlug) void load();
  }, [address, categorySlug, city, comuna, requestedIso, selectedServiceId, selectedTasks]);

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

  const toggleTask = (task: string) => {
    setSelectedTasks((current) => (current.includes(task) ? current.filter((item) => item !== task) : [...current, task]));
  };

  return (
    <main className="auth-flow-screen auth-flow-screen-scroll market-shell-auth">
      <div className="auth-flow-backdrop" aria-hidden />
      <div className="login-screen-content market-shell-auth-content">
        <MarketNav />

        <section className="auth-flow-shell auth-flow-shell-wide service-pros-shell">
          <div className="auth-flow-copy service-pros-copy">
            <p className="auth-flow-kicker">Profesionales disponibles</p>
            <h1>{category?.name ?? "Servicio"} en {comuna || city}</h1>
            <p>
              {selectedService ? `Mostrando resultados para ${selectedService.name.toLowerCase()}. ` : ""}
              Compara perfiles, agenda y precios antes de confirmar tu reserva.
            </p>

            <div className="auth-flow-copy-list">
              <div className="auth-flow-meta-card">
                <strong>Dirección</strong>
                <span>
                  {address || "Sin dirección"}
                  {comuna ? `, ${comuna}` : ""}
                </span>
              </div>
              <div className="auth-flow-meta-card">
                <strong>Detalles</strong>
                <span>
                  {apartment ? `Depto ${apartment}` : "Sin depto"}
                  {reference ? ` · Ref. ${reference}` : ""}
                </span>
              </div>
              <div className="auth-flow-meta-card">
                <strong>Horario</strong>
                <span>{requestedDate && requestedTime ? `${requestedDate} a las ${requestedTime}` : "Aún no definido"}</span>
              </div>
              {recommendedHours ? (
                <div className="auth-flow-meta-card">
                  <strong>Tiempo sugerido</strong>
                  <span>
                    {estimatedMinHours && estimatedMaxHours ? `${estimatedMinHours} a ${estimatedMaxHours} h · ` : ""}
                    Recomendado: {recommendedHours} h
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          <section className="auth-flow-panel auth-flow-panel-wide service-pros-panel">
            <div className="panel-head auth-flow-panel-head">
              <h2>Taskers para tu búsqueda</h2>
              <p>Si quieres, puedes ajustar filtros antes de entrar al perfil o ver la agenda del tasker.</p>
            </div>

            <div className="query-row service-pros-query-row">
              <label>
                Ordenar por
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortBy)}>
                  <option value="best">Mejor valorado</option>
                  <option value="near">Más cercano</option>
                  <option value="cheap">Más económico</option>
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

            {availableTaskOptions.length > 0 ? (
              <div className="service-task-filter-card">
                <div className="panel-head">
                  <h3>Tareas que necesitas</h3>
                  <p>Filtra taskers según lo que sí incluyen dentro del alcance base de este servicio.</p>
                </div>
                <div className="onboarding-task-checklist onboarding-task-checklist-compact">
                  <div className="onboarding-task-checklist-head onboarding-task-checklist-head-neutral">
                    <span>Lista de tareas</span>
                    <span>Filtro</span>
                  </div>
                  {availableTaskOptions.map((task) => (
                    <label key={task.value} className={`onboarding-task-checklist-row ${selectedTasks.includes(task.value) ? "checked" : ""}`}>
                      <span className="onboarding-task-checklist-label">{task.label}</span>
                      <span className="onboarding-task-checklist-control">
                        <input type="checkbox" checked={selectedTasks.includes(task.value)} onChange={() => toggleTask(task.value)} />
                        <span className="onboarding-task-checklist-box" aria-hidden />
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="cta-row service-pros-top-actions">
              <Link
                href={`/servicios/${categorySlug}?${contextQuery}`}
                className="cta ghost small"
              >
                Cambiar dirección y horario
              </Link>
              <button type="button" className="cta ghost small" onClick={() => setNotifyMessage("Te avisaremos cuando haya cobertura en tu zona.")}>
                Avisarme cuando haya
              </button>
            </div>

            {loading ? <p className="empty">Buscando profesionales...</p> : null}
            {error ? <p className="feedback error">{error}</p> : null}
            {notifyMessage ? <p className={`feedback ${usedCategoryFallback ? "warn" : "ok"}`}>{notifyMessage}</p> : null}
            {!loading && !error && professionals.length === 0 ? (
              <p className="feedback error">No encontramos taskers en esa zona y horario. Prueba otro horario, otra dirección o menos filtros.</p>
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
                        <span className="we-tag">Agenda actualizada</span>
                        <span className="we-tag">Radio {pro.serviceRadiusKm} km</span>
                        <span className="we-tag">{pro.distanceKm.toFixed(1)} km de distancia</span>
                      </div>

                      <p className="we-pro-snippet">{profileSnippet(category?.name ?? "servicios")}</p>

                      <div className="cta-row we-pro-actions">
                        <Link className="cta small" href={`/pro/${pro.id}${contextQuery ? `?${contextQuery}` : ""}`}>
                          Ver perfil
                        </Link>
                        <Link
                          className="cta small"
                          href={`/pro/${pro.id}?${contextQuery || `date=${encodeURIComponent(requestedDate || localYmd(new Date()))}`}#availability`}
                        >
                          Ver agenda
                        </Link>
                      </div>
                    </div>
                  </div>

                  <aside className="we-pro-price">
                    <strong>{pro.hourlyRateFromClp ? clp(pro.hourlyRateFromClp) : "Por definir"}</strong>
                    <span>por hora</span>
                    <small>{pro.coverageCity ?? city}</small>
                  </aside>
                </article>
              ))}
            </section>
          </section>
        </section>
      </div>
    </main>
  );
}
