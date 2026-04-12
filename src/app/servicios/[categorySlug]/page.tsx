"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { MarketNav } from "@/components/market-nav";
import { BABYSITTER_TASK_INCLUDED_OPTIONS } from "@/lib/babysitter-scope";
import { getChefServiceDefinition } from "@/lib/chef-service-types";
import { CLEANING_TASK_INCLUDED_OPTIONS, getCleaningTaskOptionsForService } from "@/lib/cleaning-scope";
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
import { ACTIVE_CLEANING_SERVICE_SLUGS, getCleaningServiceDefinition } from "@/lib/cleaning-service-types";
import { ACTIVE_MVP_COMMUNES, COVERAGE_UNAVAILABLE_MESSAGE, inferCommuneFromAddress, normalizeCommune } from "@/lib/communes";
import { estimateIroningDuration } from "@/lib/ironing-duration-estimator";
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
  chef: [],
  maquillaje: [...MAKEUP_TASK_INCLUDED_OPTIONS],
  planchado: []
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
  const [sessionRole, setSessionRole] = useState<string | null>(null);
  const [coverageNote, setCoverageNote] = useState("");
  const [detectedCommune, setDetectedCommune] = useState<string | null>(null);
  const [selectedCommune, setSelectedCommune] = useState<string>(normalizeCommune(query.get("commune") ?? "") ?? "");
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
  const categoryTaskOptions = useMemo(() => TASK_FILTER_OPTIONS_BY_CATEGORY[categorySlug] ?? [], [categorySlug]);
  const [selectedTasks, setSelectedTasks] = useState<string[]>(
    (query.get("tasks") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item) => categoryTaskOptions.some((option) => option.value === item))
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
  const [ironingGarments, setIroningGarments] = useState(query.get("ironingGarments") ?? "");
  const [ironingBulkyItems, setIroningBulkyItems] = useState(query.get("ironingBulkyItems") ?? "");
  const [ironingDelicates, setIroningDelicates] = useState(query.get("ironingDelicates") === "true");
  const autoAdvanceCategorySlugs = new Set([
    "mascotas",
    "babysitter",
    "profesor-particular",
    "personal-trainer",
    "chef",
    "maquillaje"
  ]);
  const autoAdvanceOnServiceSelect = category ? autoAdvanceCategorySlugs.has(category.slug) : false;
  const isCleaningCategory = category?.slug === "limpieza";
  const isIroningCategory = category?.slug === "planchado";
  const isCustomerSession = sessionRole === "CUSTOMER";
  const skipAddressStep = query.get("skipAddress") === "1";

  useEffect(() => {
    const loadSession = async () => {
      try {
        const response = await fetch("/api/auth/session");
        const data = (await response.json()) as { session?: { userId?: string | null; role?: string | null } | null };
        setHasSession(Boolean(data.session?.userId));
        setSessionRole(data.session?.role ?? null);
      } catch {
        setHasSession(false);
        setSessionRole(null);
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
    const nextCommune = normalizeCommune(value) ?? inferCommuneFromAddress(value);
    setDetectedCommune(nextCommune);
    if (nextCommune) setSelectedCommune(nextCommune);
  };

  useEffect(() => {
    const commune = normalizeCommune(street) ?? inferCommuneFromAddress(street);
    setDetectedCommune(commune);
    if (commune) setSelectedCommune(commune);
  }, [street]);

  useEffect(() => {
    if (street.trim()) return;
    try {
      const savedAddress = window.localStorage.getItem("wetask_customer_address")?.trim() ?? "";
      if (savedAddress) {
        setStreet(savedAddress);
        setSelectedFromAutocomplete(true);
      }
    } catch {
      // noop
    }
  }, [street]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!(skipAddressStep && isCustomerSession)) return;
    const timer = window.setTimeout(() => {
      document.getElementById("task-focos")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 160);
    return () => window.clearTimeout(timer);
  }, [isCustomerSession, skipAddressStep]);

  const selectedCleaningServiceSlug = useMemo(() => {
    if (!isCleaningCategory || !category || !selectedServiceId) return null;
    const service = category.services.find((item) => item.id === selectedServiceId);
    return parseCleaningServiceSlug(service?.slug);
  }, [category, isCleaningCategory, selectedServiceId]);

  const selectedCleaningDefinition = useMemo(() => {
    if (!selectedCleaningServiceSlug) return null;
    return getCleaningServiceDefinition(selectedCleaningServiceSlug);
  }, [selectedCleaningServiceSlug]);

  const getServiceDisplayPrice = (service: Category["services"][number]) => {
    if (category?.slug !== "limpieza") return service.basePriceClp;
    const definition = getCleaningServiceDefinition(service.slug);
    return definition?.recommendedMinClp ?? service.basePriceClp;
  };

  const visibleServices = useMemo(() => {
    if (!category) return [];
    if (category.slug !== "limpieza") return category.services;

    const orderMap = new Map(ACTIVE_CLEANING_SERVICE_SLUGS.map((slug, index) => [slug, index]));
    return category.services
      .filter((service) => orderMap.has(service.slug as (typeof ACTIVE_CLEANING_SERVICE_SLUGS)[number]))
      .sort((a, b) => (orderMap.get(a.slug as (typeof ACTIVE_CLEANING_SERVICE_SLUGS)[number]) ?? 999) - (orderMap.get(b.slug as (typeof ACTIVE_CLEANING_SERVICE_SLUGS)[number]) ?? 999));
  }, [category]);

  const availableTaskOptions = useMemo(() => {
    if (!isCleaningCategory) return categoryTaskOptions;
    return getCleaningTaskOptionsForService(selectedCleaningServiceSlug);
  }, [categoryTaskOptions, isCleaningCategory, selectedCleaningServiceSlug]);

  const cleaningDetailsIntro = useMemo(() => {
    switch (selectedCleaningServiceSlug) {
      case "limpieza-hogar":
        return "Ahora cuéntanos cómo es tu casa y si hay focos específicos para calcular mejor el tiempo recomendado.";
      case "limpieza-profunda":
        return "Queremos entender el nivel de detalle y las zonas más exigentes para recomendar una duración realista.";
      case "limpieza-por-horas":
        return "Dinos el tamaño del espacio y tus prioridades para sugerirte cuántas horas conviene reservar.";
      case "limpieza-post-mudanza":
        return "Necesitamos saber cómo está el espacio y qué extras incluye para estimar bien un aseo de entrega o entrada.";
      case "limpieza-oficina":
        return "Cuéntanos el tamaño y estado del lugar para recomendar cuántas horas necesita tu limpieza de oficina.";
      default:
        return "Completa estos datos para recomendarte cuántas horas reservar según tu espacio y el alcance del servicio.";
    }
  }, [selectedCleaningServiceSlug]);

  useEffect(() => {
    if (!category) return;
    if (selectedServiceId && visibleServices.some((service) => service.id === selectedServiceId)) return;
    setSelectedServiceId(visibleServices[0]?.id ?? "");
  }, [category, selectedServiceId, visibleServices]);

  useEffect(() => {
    setSelectedTasks((current) => current.filter((item) => availableTaskOptions.some((option) => option.value === item)));
  }, [availableTaskOptions]);

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

  const ironingEstimate = useMemo(() => {
    if (!isIroningCategory || !selectedServiceId) return null;
    const garments = Number(ironingGarments);
    const bulkyItems = Number(ironingBulkyItems || 0);
    if (!Number.isFinite(garments) || garments <= 0) return null;
    if (!Number.isFinite(bulkyItems) || bulkyItems < 0) return null;
    return estimateIroningDuration({
      garments,
      bulkyItems,
      includesDelicates: ironingDelicates
    });
  }, [ironingBulkyItems, ironingDelicates, ironingGarments, isIroningCategory, selectedServiceId]);

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
    const commune = normalizeCommune(selectedCommune) ?? detectedCommune ?? normalizeCommune(street) ?? inferCommuneFromAddress(street);
    if (!commune) {
      setCoverageNote("Selecciona una comuna disponible dentro de la cobertura activa de WeTask.");
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
    if (category?.slug === "planchado") {
      if (!ironingGarments.trim()) {
        setCoverageNote("Cuéntanos cuánta ropa necesitas planchar para estimar bien el tiempo.");
        return;
      }
      if (!ironingEstimate) {
        setCoverageNote("No pudimos calcular la duración estimada. Revisa la cantidad de prendas y vuelve a intentarlo.");
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
    if (category?.slug === "planchado" && ironingEstimate) {
      qs.set("ironingGarments", ironingGarments);
      qs.set("ironingBulkyItems", ironingBulkyItems || "0");
      qs.set("ironingDelicates", String(ironingDelicates));
      qs.set("recommendedHours", String(ironingEstimate.recommendedHours));
      qs.set("estimatedMinHours", String(ironingEstimate.minHours));
      qs.set("estimatedMaxHours", String(ironingEstimate.maxHours));
    }
    const nextUrl = `/servicios/${category.slug}/pros?${qs.toString()}`;
    if (sessionChecked && !hasSession) {
      router.push(`/registro?next=${encodeURIComponent(nextUrl)}`);
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
    <main className="auth-flow-screen auth-flow-screen-scroll market-shell-auth">
      <div className="auth-flow-backdrop" aria-hidden />
      <div className="login-screen-content market-shell-auth-content">
        <MarketNav />

        <section className="auth-flow-shell auth-flow-shell-wide service-request-shell">
          <div className="auth-flow-copy">
            <p className="auth-flow-kicker">Servicio</p>
            <h1>{category?.name ?? "Cargando servicio..."}</h1>
            <p>Elige una variante del servicio y una comuna activa de WeTask para ver taskers disponibles en tu zona.</p>

            <div className="auth-flow-copy-list">
              <div className="auth-flow-meta-card">
                <strong>Cobertura inteligente</strong>
                <span>Trabajamos solo en comunas activas definidas por WeTask y mostramos solo taskers dentro de esa cobertura.</span>
              </div>
              <div className="auth-flow-meta-card">
                <strong>Siguiente paso</strong>
                <span>Después podrás comparar perfiles, agenda y tarifas antes de reservar.</span>
              </div>
            </div>
          </div>

          <section className="auth-flow-panel auth-flow-panel-wide service-request-panel">
            {loading ? <p className="empty">Cargando categoria...</p> : null}
            {error ? <p className="feedback error">{error}</p> : null}

            {category ? (
              <>
                <div className="panel-head auth-flow-panel-head">
                  <h2>{category.name}</h2>
                  <p>Completa los datos para continuar con una búsqueda real de taskers.</p>
                </div>

                <form className="grid-form auth-flow-form" onSubmit={openPros}>
                  {isCustomerSession && street.trim() ? (
                    <div className="full auth-flow-note-card auth-flow-note-card-compact">
                      <strong>Usaremos tu dirección guardada</strong>
                      <span>{street}</span>
                      <span>
                        {selectedCommune || detectedCommune
                          ? `Comuna dentro de cobertura: ${selectedCommune || detectedCommune}`
                          : "Si quieres cambiarla, edítala desde tu panel cliente."}
                      </span>
                    </div>
                  ) : (
                    <>
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
                        Comuna disponible
                        <select value={selectedCommune} onChange={(event) => setSelectedCommune(event.target.value)} required>
                          <option value="">Selecciona una comuna</option>
                          {ACTIVE_MVP_COMMUNES.map((commune) => (
                            <option key={commune} value={commune}>
                              {commune}
                            </option>
                          ))}
                        </select>
                        <p className="input-hint">Solo puedes buscar dentro de las comunas activas definidas por WeTask.</p>
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
                        <strong>Comuna para la búsqueda</strong>
                        <span>{selectedCommune || detectedCommune || "Selecciona una comuna activa para continuar."}</span>
                      </div>
                    </>
                  )}
                  <label className="full">
                    {isCleaningCategory ? "Elige el tipo de limpieza" : "Tipo de servicio"}
                    <div className={`auth-service-grid ${autoAdvanceOnServiceSelect ? "auth-service-grid-compact" : "auth-service-grid-cleaning"}`}>
                      {visibleServices.map((service) => {
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
                                Desde <strong>${new Intl.NumberFormat("es-CL").format(getServiceDisplayPrice(service))}</strong>
                                {chefDefinition ? "" : "/h"}
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
                                {chefDefinition ? <span>Duración estimada: {chefDefinition.estimatedDurationLabel}.</span> : null}
                                {cleaningDefinition?.excludes?.length ? <span>No incluye: {cleaningDefinition.excludes.slice(0, 3).join(", ")}.</span> : null}
                                {chefDefinition?.excludes?.length ? <span>No incluye: {chefDefinition.excludes.slice(0, 3).join(", ")}.</span> : null}
                              </div>
                            ) : null}
                          </label>
                        );
                      })}
                    </div>
                  </label>
                  {isCleaningCategory && !selectedCleaningDefinition ? (
                    <div className="full auth-flow-note-card auth-flow-note-card-compact">
                      <strong>Primero elige el tipo de limpieza</strong>
                      <span>Después te pediremos solo los detalles necesarios para estimar la duración y mostrar taskers compatibles.</span>
                    </div>
                  ) : null}
                  {isCleaningCategory && selectedCleaningDefinition ? (
                    <div className="full service-prep-card" id="task-focos">
                      <div className="panel-head">
                        <h3>Cuéntanos los detalles del servicio</h3>
                        <p>{cleaningDetailsIntro}</p>
                      </div>
                      {availableTaskOptions.length > 0 ? (
                        <div className="service-task-filter-card service-task-filter-card-embedded">
                          <div className="panel-head">
                            <h3>Tareas o focos que necesitas</h3>
                            <p>Opcional. Esto nos ayuda a mostrar taskers más alineados antes de entrar a resultados.</p>
                          </div>
                          <div className="onboarding-task-checklist onboarding-task-checklist-compact">
                            <div className="onboarding-task-checklist-head onboarding-task-checklist-head-neutral">
                              <span>Lista de tareas</span>
                              <span>Agregar</span>
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

                      <div className="service-duration-card">
                        <div className="panel-head">
                          <h3>Ayúdanos a estimar la duración</h3>
                          <p>Con esto te recomendamos cuántas horas reservar según tu espacio y el alcance de esta limpieza.</p>
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
                    </div>
                  ) : null}
                  {isIroningCategory && selectedServiceId ? (
                    <div className="full service-prep-card" id="task-focos">
                      <div className="panel-head">
                        <h3>Ayúdanos a estimar el tiempo</h3>
                        <p>Para planchado trabajamos por hora. Cuéntanos cuánta ropa tienes para sugerirte una duración realista.</p>
                      </div>

                      <div className="service-prep-summary">
                        <strong>Planchado por hora</strong>
                        <span>Luego podrás comparar taskers según agenda, valoración y tarifa por hora.</span>
                      </div>

                      <div className="service-duration-grid">
                        <label>
                          Cantidad de prendas
                          <select value={ironingGarments} onChange={(event) => setIroningGarments(event.target.value)} required>
                            <option value="">Selecciona</option>
                            <option value="8">Hasta 8 prendas</option>
                            <option value="15">9 a 15 prendas</option>
                            <option value="25">16 a 25 prendas</option>
                            <option value="35">26 a 35 prendas</option>
                            <option value="45">36 a 45 prendas</option>
                            <option value="60">Más de 45 prendas</option>
                          </select>
                        </label>
                        <label>
                          Textiles grandes
                          <select value={ironingBulkyItems} onChange={(event) => setIroningBulkyItems(event.target.value)}>
                            <option value="0">No</option>
                            <option value="1">1 prenda grande</option>
                            <option value="2">2 prendas grandes</option>
                            <option value="3">3 o más</option>
                          </select>
                        </label>
                      </div>

                      <div className="service-duration-toggles">
                        <label className={`onboarding-check-card ${ironingDelicates ? "active" : ""}`}>
                          <input type="checkbox" checked={ironingDelicates} onChange={() => setIroningDelicates((current) => !current)} />
                          <span>Incluye ropa delicada</span>
                        </label>
                      </div>

                      <div className={`service-duration-result ${ironingEstimate ? "ready" : ""}`}>
                        <strong>{ironingEstimate ? `${ironingEstimate.minHours} a ${ironingEstimate.maxHours} horas` : "Completa la cantidad de ropa para estimar el tiempo"}</strong>
                        <span>
                          {ironingEstimate
                            ? `${ironingEstimate.summary} Si quieres irte a la segura, reserva ${ironingEstimate.recommendedHours} hora(s).`
                            : "Te mostraremos un rango sugerido antes de buscar taskers."}
                        </span>
                      </div>
                    </div>
                  ) : null}
                  {!isCleaningCategory && availableTaskOptions.length > 0 ? (
                    <div className="full service-task-filter-card" id="task-focos">
                      <div className="panel-head">
                        <h3>Tareas o focos que necesitas</h3>
                        <p>Opcional. Esto nos ayuda a mostrar taskers más alineados antes de entrar a resultados.</p>
                      </div>
                      <div className="onboarding-task-checklist onboarding-task-checklist-compact">
                        <div className="onboarding-task-checklist-head onboarding-task-checklist-head-neutral">
                          <span>Lista de tareas</span>
                          <span>Agregar</span>
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
                  {!autoAdvanceOnServiceSelect ? (
                    <div className="auth-flow-actions full">
                      <button type="submit" className="cta">
                        Ver taskers disponibles
                      </button>
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
