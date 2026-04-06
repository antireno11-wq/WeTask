"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MarketNav } from "@/components/market-nav";
import { BABYSITTER_TASK_INCLUDED_OPTIONS } from "@/lib/babysitter-scope";
import { CHEF_TASK_INCLUDED_OPTIONS } from "@/lib/chef-scope";
import { copyCleaningEstimateParams, parseCleaningRecommendedHours, parseCleaningServiceSlug } from "@/lib/cleaning-duration-estimator";
import { CLEANING_TASK_INCLUDED_OPTIONS, getCleaningTaskOptionsForService } from "@/lib/cleaning-scope";
import { getMakeupDurationSummary, getMakeupServiceConfig, getMakeupServiceHeadline, normalizeMakeupScope } from "@/lib/makeup-scope";
import { getMakeupServiceDefinitionBySlug } from "@/lib/makeup-service-types";
import { PET_TASK_INCLUDED_OPTIONS } from "@/lib/pet-scope";
import { getMarketplaceCategorySlugForTaskerCategory, normalizeTaskerCategorySlug } from "@/lib/tasker-category-profiles";
import { getTeacherLevelLabel, getTeacherModeLabel, getTeacherPublicServiceSlugs, getTeacherServiceLabel, normalizeTeacherScope } from "@/lib/teacher-scope";
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
  distanceKm: number | null;
  coverageCity: string | null;
  coverageComuna?: string | null;
  serviceRadiusKm: number;
  avatarUrl?: string | null;
  avatarPositionX?: number | null;
  avatarPositionY?: number | null;
  user: {
    fullName: string;
    cleaningOnboarding?: {
      profilePhotoUrl?: string | null;
      profilePhotoPositionX?: number | null;
      profilePhotoPositionY?: number | null;
      baseCommune?: string | null;
      makeupScope?: unknown;
      teacherScope?: unknown;
    } | null;
  };
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
  "profesor-particular": [],
  chef: [...CHEF_TASK_INCLUDED_OPTIONS],
  maquillaje: [],
  planchado: []
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
  return `Tasker verificado para ${categoryName.toLowerCase()}, con agenda activa y servicios a domicilio en tu zona.`;
}

function avatarObjectPosition(x?: number | null, y?: number | null) {
  const nextX = typeof x === "number" ? Math.min(Math.max(x, 0), 100) : 50;
  const nextY = typeof y === "number" ? Math.min(Math.max(y, 0), 100) : 34;
  return `${nextX}% ${nextY}%`;
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

function getAgendaLabel(slots: Array<{ startsAt: string }>) {
  if (slots.length === 0) return "Sin agenda visible";
  const now = new Date();
  const next7Days = new Date(now);
  next7Days.setDate(next7Days.getDate() + 7);
  const hasWeekAvailability = slots.some((slot) => {
    const startsAt = new Date(slot.startsAt);
    return startsAt >= now && startsAt <= next7Days;
  });
  return hasWeekAvailability ? "Agenda esta semana" : "Agenda disponible";
}

export default function ServiceProsPage() {
  const params = useParams<{ categorySlug: string }>();
  const search = useSearchParams();
  const categorySlug = params?.categorySlug ?? "";
  const normalizedRouteCategorySlug = normalizeTaskerCategorySlug(categorySlug);
  const marketplaceRouteCategorySlug = getMarketplaceCategorySlugForTaskerCategory(categorySlug) ?? categorySlug;

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
  const classSubject = search.get("classSubject") ?? "";
  const classMusicType = search.get("classMusicType") ?? "";
  const classMode = search.get("classMode") ?? "";
  const classLevel = search.get("classLevel") ?? "";
  const classFrequency = search.get("classFrequency") ?? "";
  const classNotes = search.get("classNotes") ?? "";
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
    if (classSubject) qs.set("classSubject", classSubject);
    if (classMusicType) qs.set("classMusicType", classMusicType);
    if (classMode) qs.set("classMode", classMode);
    if (classLevel) qs.set("classLevel", classLevel);
    if (classFrequency) qs.set("classFrequency", classFrequency);
    if (classNotes) qs.set("classNotes", classNotes);
    if (selectedServiceId) qs.set("serviceId", selectedServiceId);
    if (selectedTasks.length > 0) qs.set("tasks", selectedTasks.join(","));
    copyCleaningEstimateParams(search, qs);
    return qs.toString();
  }, [address, apartment, city, classFrequency, classLevel, classMode, classMusicType, classNotes, classSubject, comuna, reference, requestedDate, requestedTime, search, selectedServiceId, selectedTasks]);
  const selectedService = useMemo(
    () => category?.services.find((service) => service.id === selectedServiceId) ?? null,
    [category, selectedServiceId]
  );
  const selectedMakeupDefinition = useMemo(
    () => (category?.slug === "maquillaje" && selectedService ? getMakeupServiceDefinitionBySlug(selectedService.slug) : null),
    [category?.slug, selectedService]
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

        const match =
          catalogData.categories.find(
            (item) =>
              item.slug === categorySlug ||
              item.slug === marketplaceRouteCategorySlug ||
              normalizeTaskerCategorySlug(item.slug) === normalizedRouteCategorySlug
          ) ?? null;
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
          if (classSubject) qs.set("classSubject", classSubject);
          if (classMusicType) qs.set("classMusicType", classMusicType);
          if (classMode) qs.set("classMode", classMode);
          if (classLevel) qs.set("classLevel", classLevel);
          if (selectedTasks.length > 0) qs.set("tasks", selectedTasks.join(","));

          const response = await fetch(`/api/marketplace/search-professionals?${qs.toString()}`);
          const data = (await response.json()) as { professionals?: Professional[]; error?: string; detail?: string };
          if (!response.ok || !data.professionals) {
            throw new Error(data.detail || data.error || "No se pudieron cargar taskers");
          }
          return data.professionals;
        };

        let nextProfessionals = await fetchProfessionals(true);

        if (nextProfessionals.length === 0 && selectedServiceId) {
          nextProfessionals = await fetchProfessionals(false);
          if (nextProfessionals.length > 0) {
            setUsedCategoryFallback(true);
            setNotifyMessage(
              `No encontramos taskers publicados para ese tipo exacto todavía, así que te mostramos taskers disponibles de ${match.name.toLowerCase()} en tu comuna.`
            );
          }
        }

        setAllPros(nextProfessionals);

        if (nextProfessionals.length === 0) {
          setNotifyMessage("Aún no tenemos cobertura en esta dirección. Puedes activar aviso cuando haya taskers.");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inesperado");
      } finally {
        setLoading(false);
      }
    };

    if (categorySlug) void load();
  }, [address, categorySlug, city, classLevel, classMode, classMusicType, classSubject, comuna, marketplaceRouteCategorySlug, normalizedRouteCategorySlug, requestedIso, selectedServiceId, selectedTasks]);

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
      filtered.sort((a, b) => {
        const distanceA = typeof a.distanceKm === "number" ? a.distanceKm : Number.MAX_SAFE_INTEGER;
        const distanceB = typeof b.distanceKm === "number" ? b.distanceKm : Number.MAX_SAFE_INTEGER;
        return distanceA - distanceB;
      });
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
    <main className="auth-flow-screen auth-flow-screen-scroll market-shell-auth">
      <div className="auth-flow-backdrop" aria-hidden />
      <div className="login-screen-content market-shell-auth-content">
        <MarketNav />

        <section className="auth-flow-shell auth-flow-shell-wide service-pros-shell">
          <div className="auth-flow-copy service-pros-copy">
            <p className="auth-flow-kicker">Taskers disponibles</p>
            <h1>{category?.name ?? "Servicio"} en {comuna || city}</h1>
            <p>
              {category?.slug === "profesor-particular"
                ? "Compara profesores por tipo de clase, nivel, modalidad, duración típica y precio por hora."
                : `${selectedService ? `Mostrando resultados para ${selectedService.name.toLowerCase()}. ` : ""}Compara perfiles, agenda y precios antes de confirmar tu reserva.`}
            </p>

            <div className="auth-flow-copy-list">
              <div className="auth-flow-meta-card">
                <strong>{category?.slug === "profesor-particular" && classMode === "online" ? "Modalidad" : "Dirección"}</strong>
                <span>{category?.slug === "profesor-particular" && classMode === "online" ? "Clase online" : `${address || "Sin dirección"}${comuna ? `, ${comuna}` : ""}`}</span>
              </div>
              <div className="auth-flow-meta-card">
                <strong>Detalles</strong>
                <span>
                  {apartment ? `Depto ${apartment}` : "Sin depto"}
                  {reference ? ` · Ref. ${reference}` : ""}
                </span>
              </div>
              <div className="auth-flow-meta-card">
                <strong>{category?.slug === "profesor-particular" ? "Clase buscada" : "Horario"}</strong>
                <span>
                  {category?.slug === "profesor-particular"
                    ? [classMusicType || classSubject, classLevel, classMode].filter(Boolean).join(" · ") || "Aún no definido"
                    : requestedDate && requestedTime
                      ? `${requestedDate} a las ${requestedTime}`
                      : "Aún no definido"}
                </span>
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

            {loading ? <p className="empty">Buscando taskers...</p> : null}
            {error ? <p className="feedback error">{error}</p> : null}
            {notifyMessage ? <p className={`feedback ${usedCategoryFallback ? "warn" : "ok"}`}>{notifyMessage}</p> : null}
            {!loading && !error && professionals.length === 0 ? (
              <p className="feedback error">No encontramos taskers en esa zona y horario. Prueba otro horario, otra dirección o menos filtros.</p>
            ) : null}

            <section className="we-results-list">
              {professionals.map((pro) => {
                const profilePhotoUrl = pro.avatarUrl?.trim() || pro.user.cleaningOnboarding?.profilePhotoUrl?.trim() || "";
                const profilePhotoObjectPosition = avatarObjectPosition(
                  pro.avatarPositionX ?? pro.user.cleaningOnboarding?.profilePhotoPositionX,
                  pro.avatarPositionY ?? pro.user.cleaningOnboarding?.profilePhotoPositionY
                );
                const communeLabel = pro.coverageComuna ?? pro.user.cleaningOnboarding?.baseCommune ?? comuna ?? city;
                const agendaLabel = getAgendaLabel(pro.slots);
                const makeupScope = normalizeMakeupScope(pro.user.cleaningOnboarding?.makeupScope);
                const makeupScopeValue = selectedMakeupDefinition?.scopeValue ?? null;
                const makeupConfig =
                  makeupScopeValue && makeupScope.services_offered.includes(makeupScopeValue)
                    ? getMakeupServiceConfig(makeupScope, makeupScopeValue)
                    : null;
                const makeupHeadline =
                  makeupScopeValue && makeupScope.services_offered.includes(makeupScopeValue)
                    ? getMakeupServiceHeadline(makeupScope, makeupScopeValue)
                    : selectedMakeupDefinition?.name ?? selectedService?.name ?? category?.name ?? "Maquillaje";
                const makeupDuration =
                  makeupScopeValue && makeupScope.services_offered.includes(makeupScopeValue)
                    ? getMakeupDurationSummary(makeupScope, makeupScopeValue)
                    : selectedMakeupDefinition?.durationLabel ?? "Duración por confirmar";
                const makeupAudience =
                  selectedMakeupDefinition && "idealFor" in selectedMakeupDefinition && typeof selectedMakeupDefinition.idealFor === "string"
                    ? selectedMakeupDefinition.idealFor
                    : profileSnippet(category?.name ?? "servicios");
                const teacherScope = normalizeTeacherScope(pro.user.cleaningOnboarding?.teacherScope);
                const teacherRelevantServices = getTeacherPublicServiceSlugs(teacherScope)
                  .filter((serviceSlug) => (classMusicType ? serviceSlug === classMusicType : classSubject === "musica" ? ["guitarra", "piano", "canto"].includes(serviceSlug) : classSubject ? serviceSlug === classSubject : true))
                  .map(getTeacherServiceLabel);
                const teacherRelevantConfig =
                  teacherScope.service_configs.find((config) =>
                    classMusicType ? config.service_slug === classMusicType : classSubject && classSubject !== "musica" ? config.service_slug === classSubject : true
                  ) ?? teacherScope.service_configs[0] ?? null;
                const teacherLevels = teacherRelevantConfig?.levels?.length
                  ? teacherRelevantConfig.levels.map(getTeacherLevelLabel)
                  : teacherScope.levels.map(getTeacherLevelLabel);
                const teacherModes = teacherRelevantConfig?.modes?.length
                  ? teacherRelevantConfig.modes.map(getTeacherModeLabel)
                  : teacherScope.modes.map(getTeacherModeLabel);
                const priceLabel = pro.hourlyRateFromClp ? clp(pro.hourlyRateFromClp) : "Por definir";

                return (
                  <article className="we-pro-card" key={pro.id}>
                    <div className="we-pro-main">
                      <div className="we-pro-avatar" aria-hidden>
                        {profilePhotoUrl ? <img src={profilePhotoUrl} alt="" className="we-pro-avatar-image" style={{ objectPosition: profilePhotoObjectPosition }} /> : initials(pro.user.fullName)}
                      </div>

                      <div className="we-pro-content">
                        <div className="we-pro-title-row">
                          <h3>{pro.user.fullName}</h3>
                          <span className="we-verified-badge">Verificado</span>
                        </div>

                        <p className="we-pro-rating-line">
                          <span className="we-star">★</span> {Number(pro.ratingAvg || 0).toFixed(1)} ({pro.ratingsCount} reseñas)
                        </p>

                        <div className="we-pro-tags">
                          <span className="we-tag">{agendaLabel}</span>
                        </div>

                        <p className="we-pro-snippet">
                          {category?.slug === "maquillaje"
                            ? `${makeupHeadline}. ${makeupAudience}`
                            : category?.slug === "profesor-particular"
                              ? `Clases de ${teacherRelevantServices.join(", ") || "clases particulares"}${teacherModes.length > 0 ? ` · ${teacherModes.join(" / ")}` : ""}.`
                              : profileSnippet(category?.name ?? "servicios")}
                        </p>

                        {category?.slug === "maquillaje" ? (
                          <div className="auth-flow-copy-list">
                            <div className="auth-flow-meta-card">
                              <strong>Servicio</strong>
                              <span>{makeupHeadline}</span>
                            </div>
                            <div className="auth-flow-meta-card">
                              <strong>Duración estimada</strong>
                              <span>{makeupDuration}</span>
                            </div>
                            <div className="auth-flow-meta-card">
                              <strong>Cobertura</strong>
                              <span>{communeLabel}</span>
                            </div>
                          </div>
                        ) : null}

                        {category?.slug === "profesor-particular" ? (
                          <div className="auth-flow-copy-list">
                            <div className="auth-flow-meta-card">
                              <strong>Clase</strong>
                              <span>{teacherRelevantServices.join(", ") || "Clases particulares"}</span>
                            </div>
                            <div className="auth-flow-meta-card">
                              <strong>Nivel</strong>
                              <span>{teacherLevels.length > 0 ? teacherLevels.join(", ") : "Por confirmar"}</span>
                            </div>
                            <div className="auth-flow-meta-card">
                              <strong>Modalidad</strong>
                              <span>{teacherModes.length > 0 ? teacherModes.join(" / ") : "Por confirmar"}</span>
                            </div>
                            <div className="auth-flow-meta-card">
                              <strong>Duración típica</strong>
                              <span>{teacherRelevantConfig?.typical_duration_min ? `${teacherRelevantConfig.typical_duration_min / 60} h` : "Por confirmar"}</span>
                            </div>
                          </div>
                        ) : null}

                        <div className="cta-row we-pro-actions">
                          <Link className="cta small" href={`/pro/${pro.userId}${contextQuery ? `?${contextQuery}` : ""}`}>
                            Ver perfil
                          </Link>
                          <Link
                            className="cta small"
                            href={`/pro/${pro.userId}?${contextQuery || `date=${encodeURIComponent(requestedDate || localYmd(new Date()))}`}#availability`}
                          >
                            Ver agenda
                          </Link>
                        </div>
                      </div>
                    </div>

                    <aside className="we-pro-price">
                      <strong>{priceLabel}</strong>
                      <span>{category?.slug === "maquillaje" ? "precio base" : "por hora"}</span>
                      {category?.slug === "maquillaje" ? <small>{makeupConfig ? `Duración: ${makeupDuration}` : "Duración por confirmar"}</small> : null}
                      {category?.slug === "profesor-particular" ? (
                        <small>{teacherRelevantConfig?.typical_duration_min ? `Duración típica: ${teacherRelevantConfig.typical_duration_min / 60} h` : "Duración por confirmar"}</small>
                      ) : null}
                    </aside>
                  </article>
                );
              })}
            </section>
          </section>
        </section>
      </div>
    </main>
  );
}
