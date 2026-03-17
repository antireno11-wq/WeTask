"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AuthHeroNav } from "@/components/auth-hero-nav";
import { getChefServiceDefinition } from "@/lib/chef-service-types";
import { getCleaningServiceDefinition } from "@/lib/cleaning-service-types";
import { COVERAGE_UNAVAILABLE_MESSAGE, inferCommuneFromAddress, normalizeCommune } from "@/lib/communes";

type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  services: Array<{ id: string; slug: string; name: string; description: string; basePriceClp: number }>;
};

export default function ServicioCategoriaPage() {
  const params = useParams<{ categorySlug: string }>();
  const categorySlug = params?.categorySlug ?? "";
  const router = useRouter();
  const query = useSearchParams();

  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
    setCoverageNote("");

    const qs = new URLSearchParams({
      address: street.trim(),
      city: city.trim(),
      comuna: commune,
      commune
    });
    if (apartment.trim()) qs.set("apartment", apartment.trim());
    if (reference.trim()) qs.set("reference", reference.trim());
    const nextServiceId = serviceIdOverride ?? selectedServiceId;
    if (nextServiceId) qs.set("serviceId", nextServiceId);

    router.push(`/servicios/${category.slug}/pros?${qs.toString()}`);
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
                  <label className="full">
                    Tipo de servicio
                    <div className={`auth-service-grid ${autoAdvanceOnServiceSelect ? "auth-service-grid-compact" : "auth-service-grid-cleaning"}`}>
                      {category.services.map((service) => {
                        const cleaningDefinition = category.slug === "limpieza" ? getCleaningServiceDefinition(service.slug) : null;
                        const chefDefinition = category.slug === "chef-a-domicilio" ? getChefServiceDefinition(service.slug) : null;
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
