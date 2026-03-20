"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AuthHeroNav } from "@/components/auth-hero-nav";
import { BABYSITTER_TASK_INCLUDED_OPTIONS } from "@/lib/babysitter-scope";
import { CHEF_TASK_INCLUDED_OPTIONS } from "@/lib/chef-scope";
import { getChefServiceDefinition } from "@/lib/chef-service-types";
import { CLEANING_TASK_INCLUDED_OPTIONS } from "@/lib/cleaning-scope";
import {
  CLEANING_DIRT_LEVEL_OPTIONS,
  CLEANING_EXTRA_OPTIONS,
  CLEANING_OCCUPANCY_OPTIONS,
  CLEANING_SIZE_OPTIONS,
  estimateCleaningDuration,
  isCleaningDirtLevel,
  isCleaningExtraTask,
  isCleaningOccupancy,
  isCleaningSizeBand,
  parseCleaningServiceSlug
} from "@/lib/cleaning-duration-estimator";
import { getCleaningServiceDefinition } from "@/lib/cleaning-service-types";
import { COVERAGE_UNAVAILABLE_MESSAGE, inferCommuneFromAddress, normalizeCommune } from "@/lib/communes";
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
  services: Array<{ id: string; slug: string; name: string; description: string; basePriceClp: number }>;
};

type TaskFilterOption = { value: string; label: string };

const TASK_FILTER_OPTIONS_BY_CATEGORY: Record<string, TaskFilterOption[]> = {
  limpieza: [...CLEANING_TASK_INCLUDED_OPTIONS],
  mascotas: [...PET_TASK_INCLUDED_OPTIONS],
  babysitter: [...BABYSITTER_TASK_INCLUDED_OPTIONS],
  "profesor-particular": [...TEACHER_TASK_INCLUDED_OPTIONS],
  "personal-trainer": [...TRAINER_TASK_INCLUDED_OPTIONS],
  chef: [...CHEF_TASK_INCLUDED_OPTIONS],
  maquillaje: [...MAKEUP_TASK_INCLUDED_OPTIONS],
  planchado: [...IRONING_TASK_INCLUDED_OPTIONS]
};

export default function ServicioCategoriaPage() {
  const params = useParams<{ categorySlug: string }>();
  const categorySlug = params?.categorySlug ?? "";
  const router = useRouter();
  const query = useSearchParams();

  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [coverageNote, setCoverageNote] = useState("");
  const [detectedCommune, setDetectedCommune] = useState<string | null>(null);
  const [coverageEmail, setCoverageEmail] = useState("");
  const [coverageEmailStatus, setCoverageEmailStatus] = useState("");
  const [savingCoverageEmail, setSavingCoverageEmail] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedFromAutocomplete, setSelectedFromAutocomplete] = useState(false);

  const [selectedServiceId, setSelectedServiceId] = useState(query.get("serviceId") ?? "");
  const [street, setStreet] = useState(query.get("address") ?? "");
  const [apartment, setApartment] = useState(query.get("apartment") ?? "");
  const [reference, setReference] = useState(query.get("reference") ?? "");
  const city = query.get("city") ?? "Santiago";
  const availableTaskOptions = TASK_FILTER_OPTIONS_BY_CATEGORY[categorySlug] ?? [];
  const [selectedTasks, setSelectedTasks] = useState<string[]>(
    (query.get("tasks") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item) => availableTaskOptions.some((option) => option.value === item))
  );
  const [cleaningBedrooms, setCleaningBedrooms] = useState(query.get("cleaningBedrooms") ?? "");
  const [cleaningBathrooms, setCleaningBathrooms] = useState(query.get("cleaningBathrooms") ?? "");
  const [cleaningSize, setCleaningSize] = useState(
    isCleaningSizeBand(query.get("cleaningSize") ?? "") ? (query.get("cleaningSize") as string) : ""
  );
  const [cleaningDirt, setCleaningDirt] = useState(
    isCleaningDirtLevel(query.get("cleaningDirt") ?? "") ? (query.get("cleaningDirt") as string) : ""
  );
  const [cleaningOccupancy, setCleaningOccupancy] = useState(
    isCleaningOccupancy(query.get("cleaningOccupancy") ?? "") ? (query.get("cleaningOccupancy") as string) : ""
  );
  const [cleaningExtras, setCleaningExtras] = useState<string[]>(
    (query.get("cleaningExtras") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter((item): item is string => Boolean(item) && isCleaningExtraTask(item))
  );
  const [cleaningKitchen, setCleaningKitchen] = useState(query.get("cleaningKitchen") !== "false");
  const [cleaningLivingDining, setCleaningLivingDining] = useState(query.get("cleaningLivingDining") !== "false");
  const autoAdvanceCategorySlugs = new Set([
    "limpieza",
    "mascotas",
    "babysitter",
    "profesor-particular",
    "personal-trainer",
    "chef",
    "maquillaje",
    "planchado"
  ]);
  const autoAdvanceOnServiceSelect = category ? autoAdvanceCategorySlugs.has(category.slug) : false;
  const isCleaningCategory = category?.slug === "limpieza";

  useEffect(() => {
    const loadSession = async () => {
      try {
        const response = await fetch("/api/auth/session");
        const data = (await response.json()) as { session?: { userId?: string | null } | null };
        setHasSession(Boolean(data.session?.userId));
      } catch {
        setHasSession(false);
      } finally {
        setSessionChecked(true);
      }
    };
    void loadSession();
  }, []);

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
        setSelectedServiceId((prev) => prev || match.services[0]?.id || "");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inesperado");
      } finally {
        setLoading(false);
      }
    };
    if (categorySlug) void load();
  }, [categorySlug]);

  useEffect(() => {
    const queryAddress = street.trim();
    if (selectedFromAutocomplete) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      setAutocompleteLoading(false);
      return;
    }

    if (queryAddress.length < 4) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      setAutocompleteLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setAutocompleteLoading(true);
      try {
        const input = `${queryAddress}, ${city}, Chile`;
        const response = await fetch(`/api/maps/autocomplete?input=${encodeURIComponent(input)}`, { signal: controller.signal });
        const data = (await response.json()) as { predictions?: string[] };
        if (!response.ok) {
          setAddressSuggestions([]);
          setShowSuggestions(false);
          return;
        }
        const suggestions = Array.isArray(data.predictions) ? data.predictions : [];
        setAddressSuggestions(suggestions);
        setShowSuggestions(suggestions.length > 0);
      } catch {
        if (!controller.signal.aborted) {
          setAddressSuggestions([]);
          setShowSuggestions(false);
        }
      } finally {
        if (!controller.signal.aborted) {
          setAutocompleteLoading(false);
        }
      }
    }, 320);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [city, selectedFromAutocomplete, street]);

  const selectAddressSuggestion = (value: string) => {
    setStreet(value);
    setSelectedFromAutocomplete(true);
    setAddressSuggestions([]);
    setShowSuggestions(false);
    setDetectedCommune(normalizeCommune(value) ?? inferCommuneFromAddress(value));
  };

  useEffect(() => {
    const commune = normalizeCommune(street) ?? inferCommuneFromAddress(street);
    setDetectedCommune(commune);
  }, [street]);

  const selectedCleaningServiceSlug = useMemo(() => {
    if (!isCleaningCategory || !category || !selectedServiceId) return null;
    const service = category.services.find((item) => item.id === selectedServiceId);
    return parseCleaningServiceSlug(service?.slug);
  }, [category, isCleaningCategory, selectedServiceId]);

  const cleaningEstimate = useMemo(() => {
    if (!selectedCleaningServiceSlug) return null;
    const bedrooms = Number(cleaningBedrooms);
    const bathrooms = Number(cleaningBathrooms);
    if (!Number.isFinite(bedrooms) || !Number.isFinite(bathrooms)) return null;
    if (!isCleaningSizeBand(cleaningSize) || !isCleaningDirtLevel(cleaningDirt) || !isCleaningOccupancy(cleaningOccupancy)) return null;

    return estimateCleaningDuration({
      serviceSlug: selectedCleaningServiceSlug,
      bedrooms,
      bathrooms,
      sizeBand: cleaningSize,
      dirtLevel: cleaningDirt,
      occupancy: cleaningOccupancy,
      hasKitchen: cleaningKitchen,
      hasLivingDining: cleaningLivingDining,
      extras: cleaningExtras.filter(isCleaningExtraTask)
    });
  }, [
    cleaningBathrooms,
    cleaningBedrooms,
    cleaningDirt,
    cleaningExtras,
    cleaningKitchen,
    cleaningLivingDining,
    cleaningOccupancy,
    cleaningSize,
    selectedCleaningServiceSlug
  ]);

  const saveCoverageEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!coverageEmail.trim()) return;
    setSavingCoverageEmail(true);
    setCoverageEmailStatus("");
    try {
      const response = await fetch("/api/coverage-waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: coverageEmail.trim(),
          commune: detectedCommune ?? undefined,
          address: [street.trim(), apartment.trim() ? `Depto ${apartment.trim()}` : "", reference.trim() ? `Ref: ${reference.trim()}` : ""]
            .filter(Boolean)
            .join(", "),
          source: "services_category_form"
        })
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; detail?: string };
      if (!response.ok || !data.ok) throw new Error(data.detail || data.error || "No se pudo registrar tu email");
      setCoverageEmailStatus("Gracias. Te avisaremos por correo cuando lleguemos a tu comuna.");
      setCoverageEmail("");
    } catch (e) {
      setCoverageEmailStatus(e instanceof Error ? e.message : "No se pudo registrar tu email.");
    } finally {
      setSavingCoverageEmail(false);
    }
  };

  const goToPros = (serviceIdOverride?: string) => {
    if (!category) return;
    setCoverageEmailStatus("");
    if (!street.trim()) {
      setCoverageNote("Completa el servicio y la dirección para ver taskers disponibles.");
      return;
    }
    const commune = detectedCommune ?? normalizeCommune(street) ?? inferCommuneFromAddress(street);
    if (!commune) {
      setCoverageNote(COVERAGE_UNAVAILABLE_MESSAGE);
      return;
    }
    if (category?.slug === "limpieza") {
      if (!cleaningBedrooms || !cleaningBathrooms || !cleaningSize || !cleaningDirt || !cleaningOccupancy) {
        setCoverageNote("Completa habitaciones, baños y condiciones del espacio para recomendar la duración del aseo.");
        return;
      }
      if (!cleaningEstimate) {
        setCoverageNote("No pudimos calcular la duración estimada. Revisa los datos de tu hogar y vuelve a intentarlo.");
        return;
      }
    }
    setCoverageNote("");

    const qs = new URLSearchParams({
      address: street.trim(),
      city: city.trim(),
      comuna: commune,
      commune
    });
    if (apartment.trim()) qs.set("apartment", apartment.trim());
    if (reference.trim()) qs.set("reference", reference.trim());
    if (selectedTasks.length > 0) qs.set("tasks", selectedTasks.join(","));
    const nextServiceId = serviceIdOverride ?? selectedServiceId;
    if (nextServiceId) qs.set("serviceId", nextServiceId);
    if (category?.slug === "limpieza" && cleaningEstimate) {
      qs.set("cleaningBedrooms", cleaningBedrooms);
      qs.set("cleaningBathrooms", cleaningBathrooms);
      qs.set("cleaningSize", cleaningSize);
      qs.set("cleaningDirt", cleaningDirt);
      qs.set("cleaningOccupancy", cleaningOccupancy);
      qs.set("cleaningKitchen", String(cleaningKitchen));
      qs.set("cleaningLivingDining", String(cleaningLivingDining));
      if (cleaningExtras.length > 0) qs.set("cleaningExtras", cleaningExtras.join(","));
      qs.set("recommendedHours", String(cleaningEstimate.recommendedHours));
      qs.set("estimatedMinHours", String(cleaningEstimate.minHours));
      qs.set("estimatedMaxHours", String(cleaningEstimate.maxHours));
    }
    const nextUrl = `/servicios/${category.slug}/pros?${qs.toString()}`;
    if (sessionChecked && !hasSession) {
      router.push(`/ingresar/cliente?next=${encodeURIComponent(nextUrl)}`);
      return;
    }

    router.push(nextUrl);
  };

  const toggleTask = (task: string) => {
    setSelectedTasks((current) => (current.includes(task) ? current.filter((item) => item !== task) : [...current, task]));
  };

  const toggleCleaningExtra = (value: string) => {
    setCleaningExtras((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  };

  const openPros = (event: FormEvent) => {
    event.preventDefault();
    goToPros();
  };

  return (
    <main className="auth-flow-screen auth-flow-screen-scroll">
      <div className="auth-flow-backdrop" aria-hidden />
      <div className="login-screen-content">
        <AuthHeroNav />

        <section className="auth-flow-shell auth-flow-shell-wide">
          <div className="auth-flow-copy">
            <p className="auth-flow-kicker">Servicio</p>
            <h1>{category?.name ?? "Cargando servicio..."}</h1>
            <p>Elige una variante del servicio y tu dirección para ver profesionales disponibles en tu zona.</p>

            <div className="auth-flow-copy-list">
              <div className="auth-flow-meta-card">
                <strong>Cobertura inteligente</strong>
                <span>Detectamos tu comuna para mostrar solo profesionales y disponibilidad relevante.</span>
              </div>
              <div className="auth-flow-meta-card">
                <strong>Siguiente paso</strong>
                <span>Después podrás comparar perfiles, agenda y tarifas antes de reservar.</span>
              </div>
            </div>
          </div>

          <section className="auth-flow-panel auth-flow-panel-wide">
            {loading ? <p className="empty">Cargando categoria...</p> : null}
            {error ? <p className="feedback error">{error}</p> : null}

            {category ? (
              <>
                <div className="panel-head auth-flow-panel-head">
                  <h2>{category.name}</h2>
                  <p>Completa los datos para continuar con una búsqueda real de profesionales.</p>
                </div>

                <form className="grid-form auth-flow-form" onSubmit={openPros}>
                  <label>
                    Dirección
                    <input
                      value={street}
                      onChange={(event) => {
                        setStreet(event.target.value);
                        setSelectedFromAutocomplete(false);
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(addressSuggestions.length > 0)}
                      placeholder="Calle y número"
                      required
                    />
                    {autocompleteLoading ? <p className="input-hint">Buscando direcciones...</p> : null}
                    {showSuggestions && addressSuggestions.length > 0 ? (
                      <div className="address-suggestions">
                        {addressSuggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            className="address-suggestion-btn"
                            onClick={() => selectAddressSuggestion(suggestion)}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </label>
                  <label>
                    Departamento
                    <input
                      value={apartment}
                      onChange={(event) => setApartment(event.target.value)}
                      placeholder="Ej: 504, Torre B"
                    />
                  </label>
                  <label>
                    Referencia
                    <input
                      value={reference}
                      onChange={(event) => setReference(event.target.value)}
                      placeholder="Ej: portón gris, frente a la plaza"
                    />
                  </label>
                  <div className="full auth-flow-note-card">
                    <strong>Comuna detectada</strong>
                    <span>{detectedCommune ?? "Aún no detectamos una comuna válida."}</span>
                  </div>
                  {availableTaskOptions.length > 0 ? (
                    <div className="full service-task-filter-card">
                      <div className="panel-head">
                        <h3>Tareas o focos que necesitas</h3>
                        <p>Opcional. Esto nos ayuda a mostrar taskers más alineados antes de entrar a resultados.</p>
                      </div>
                      <div className="onboarding-checkbox-grid onboarding-checkbox-grid-compact">
                        {availableTaskOptions.map((task) => (
                          <label key={task.value} className="onboarding-check-card">
                            <input type="checkbox" checked={selectedTasks.includes(task.value)} onChange={() => toggleTask(task.value)} />
                            <span>{task.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {isCleaningCategory ? (
                    <div className="full service-duration-card">
                      <div className="panel-head">
                        <h3>Ayúdanos a estimar la duración</h3>
                        <p>Con esto te recomendamos cuántas horas reservar según tu casa y el tipo de aseo.</p>
                      </div>

                      <div className="service-duration-grid">
                        <label>
                          Habitaciones
                          <select value={cleaningBedrooms} onChange={(event) => setCleaningBedrooms(event.target.value)} required>
                            <option value="">Selecciona</option>
                            <option value="0">Estudio / sin dormitorios</option>
                            <option value="1">1 habitación</option>
                            <option value="2">2 habitaciones</option>
                            <option value="3">3 habitaciones</option>
                            <option value="4">4 habitaciones</option>
                            <option value="5">5 o más</option>
                          </select>
                        </label>
                        <label>
                          Baños
                          <select value={cleaningBathrooms} onChange={(event) => setCleaningBathrooms(event.target.value)} required>
                            <option value="">Selecciona</option>
                            <option value="1">1 baño</option>
                            <option value="2">2 baños</option>
                            <option value="3">3 baños</option>
                            <option value="4">4 baños</option>
                            <option value="5">5 o más</option>
                          </select>
                        </label>
                        <label>
                          Tamaño aproximado
                          <select value={cleaningSize} onChange={(event) => setCleaningSize(event.target.value)} required>
                            <option value="">Selecciona</option>
                            {CLEANING_SIZE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label} · {option.helper}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Nivel de suciedad
                          <select value={cleaningDirt} onChange={(event) => setCleaningDirt(event.target.value)} required>
                            <option value="">Selecciona</option>
                            {CLEANING_DIRT_LEVEL_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="full">
                          Estado del espacio
                          <select value={cleaningOccupancy} onChange={(event) => setCleaningOccupancy(event.target.value)} required>
                            <option value="">Selecciona</option>
                            {CLEANING_OCCUPANCY_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="service-duration-toggles">
                        <label className={`onboarding-check-card ${cleaningKitchen ? "active" : ""}`}>
                          <input type="checkbox" checked={cleaningKitchen} onChange={() => setCleaningKitchen((current) => !current)} />
                          <span>Incluir cocina</span>
                        </label>
                        <label className={`onboarding-check-card ${cleaningLivingDining ? "active" : ""}`}>
                          <input type="checkbox" checked={cleaningLivingDining} onChange={() => setCleaningLivingDining((current) => !current)} />
                          <span>Incluir living / comedor</span>
                        </label>
                      </div>

                      <div className="service-duration-extras">
                        <strong>Extras que agregan tiempo</strong>
                        <div className="onboarding-checkbox-grid onboarding-checkbox-grid-compact">
                          {CLEANING_EXTRA_OPTIONS.map((extra) => (
                            <label key={extra.value} className={`onboarding-check-card ${cleaningExtras.includes(extra.value) ? "active" : ""}`}>
                              <input
                                type="checkbox"
                                checked={cleaningExtras.includes(extra.value)}
                                onChange={() => toggleCleaningExtra(extra.value)}
                              />
                              <span>
                                {extra.label}
                                <small>+{extra.minutes} min</small>
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className={`service-duration-result ${cleaningEstimate ? "ready" : ""}`}>
                        <strong>{cleaningEstimate ? `${cleaningEstimate.minHours} a ${cleaningEstimate.maxHours} horas` : "Completa los datos para estimar el tiempo"}</strong>
                        <span>
                          {cleaningEstimate
                            ? `${cleaningEstimate.summary} Si quieres irte a la segura, reserva ${cleaningEstimate.recommendedHours} hora(s).`
                            : "Te ayudaremos a calcular una recomendación antes de mostrar taskers."}
                        </span>
                      </div>
                    </div>
                  ) : null}
                  <label className="full">
                    Tipo de servicio
                    <div className={`auth-service-grid ${autoAdvanceOnServiceSelect ? "auth-service-grid-compact" : "auth-service-grid-cleaning"}`}>
                      {category.services.map((service) => {
                        const cleaningDefinition = category.slug === "limpieza" ? getCleaningServiceDefinition(service.slug) : null;
                        const chefDefinition = category.slug === "chef" ? getChefServiceDefinition(service.slug) : null;
                        const isActive = selectedServiceId === service.id;
                        return (
                          <label
                            key={service.id}
                            className={`auth-service-card ${isActive ? "active" : ""} ${autoAdvanceOnServiceSelect ? "auth-service-card-collapsible" : ""}`}
                          >
                            <input
                              type="radio"
                              name="selectedService"
                              value={service.id}
                              checked={isActive}
                              onChange={() => {
                                setSelectedServiceId(service.id);
                                if (autoAdvanceOnServiceSelect) {
                                  goToPros(service.id);
                                }
                              }}
                              required
                            />
                            <div className="auth-service-card-head">
                              <strong>{service.name}</strong>
                              <span className="auth-service-price-inline">
                                Desde <strong>${new Intl.NumberFormat("es-CL").format(service.basePriceClp)}</strong>/h
                              </span>
                            </div>
                            <span>{cleaningDefinition?.forClients ?? chefDefinition?.forClients ?? service.description}</span>
                            {isActive ? (
                              <div className="auth-service-card-detail">
                                {isCleaningCategory && cleaningEstimate ? (
                                  <span>
                                    Tiempo sugerido: {cleaningEstimate.minHours} a {cleaningEstimate.maxHours} horas · Recomendado: {cleaningEstimate.recommendedHours} h.
                                  </span>
                                ) : null}
                                {cleaningDefinition ? <span>Incluye: {cleaningDefinition.includes.slice(0, 4).join(", ")}.</span> : null}
                                {chefDefinition ? <span>Incluye: {chefDefinition.includes.slice(0, 4).join(", ")}.</span> : null}
                                {cleaningDefinition?.excludes?.length ? <span>No incluye: {cleaningDefinition.excludes.slice(0, 3).join(", ")}.</span> : null}
                                {chefDefinition?.excludes?.length ? <span>No incluye: {chefDefinition.excludes.slice(0, 3).join(", ")}.</span> : null}
                              </div>
                            ) : null}
                          </label>
                        );
                      })}
                    </div>
                  </label>
                  {!autoAdvanceOnServiceSelect ? (
                    <div className="auth-flow-actions full">
                      <button type="submit" className="cta">
                        Ver profesionales disponibles
                      </button>
                      <Link href="/services" className="cta ghost">
                        Ver todas las categorias
                      </Link>
                    </div>
                  ) : null}
                </form>

                {coverageNote ? <p className="feedback error">{coverageNote}</p> : null}
                {coverageNote === COVERAGE_UNAVAILABLE_MESSAGE ? (
                  <form className="service-coverage-form" onSubmit={saveCoverageEmail}>
                    <label>
                      Email para aviso de cobertura
                      <input
                        type="email"
                        value={coverageEmail}
                        onChange={(event) => setCoverageEmail(event.target.value)}
                        placeholder="tuemail@dominio.com"
                        required
                      />
                    </label>
                    <button type="submit" className="cta" disabled={savingCoverageEmail}>
                      {savingCoverageEmail ? "Guardando..." : "Avisarme por email"}
                    </button>
                  </form>
                ) : null}
                {coverageEmailStatus ? <p className="feedback ok">{coverageEmailStatus}</p> : null}

                <p className="minimal-note">Si no hay cobertura en tu zona puedes activar “Avisarme cuando haya”.</p>
              </>
            ) : null}
          </section>
        </section>
      </div>
    </main>
  );
}
