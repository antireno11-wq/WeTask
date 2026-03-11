"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { MarketNav } from "@/components/market-nav";
import { CHILE_TOP_COMMUNES } from "@/lib/cleaning-onboarding";

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

function defaultDateValue() {
  return new Date().toISOString().slice(0, 10);
}

function defaultTimeValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 60);
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = now.getMinutes() < 30 ? "30" : "00";
  return `${hours}:${minutes}`;
}

const TIME_QUICK_OPTIONS = [
  { id: "morning", label: "Manana", time: "09:00" },
  { id: "afternoon", label: "Tarde", time: "15:00" },
  { id: "night", label: "Noche", time: "19:00" }
] as const;

function inferTimeBlock(timeValue: string) {
  const hour = Number(timeValue.split(":")[0]);
  if (!Number.isFinite(hour)) return "";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "night";
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
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [address, setAddress] = useState({
    street: query.get("address") ?? "",
    comuna: query.get("comuna") ?? "",
    city: query.get("city") ?? "Santiago",
    requestedDate: query.get("requestedDate") ?? defaultDateValue(),
    requestedTime: query.get("requestedTime") ?? defaultTimeValue()
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
  const activeTimeBlock = useMemo(() => inferTimeBlock(address.requestedTime), [address.requestedTime]);

  useEffect(() => {
    const queryAddress = address.street.trim();
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
        const input = `${queryAddress}${address.comuna ? `, ${address.comuna}` : ""}, ${address.city}, Chile`;
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
  }, [address.street, address.comuna, address.city]);

  const selectAddressSuggestion = (value: string) => {
    setAddress((prev) => ({ ...prev, street: value }));
    setAddressSuggestions([]);
    setShowSuggestions(false);
  };

  const openPros = (event: FormEvent) => {
    event.preventDefault();
    if (!category) return;
    if (!address.city.trim() || !address.street.trim() || !address.requestedDate || !address.requestedTime) {
      setCoverageNote("Completa direccion, fecha y hora para ver taskers disponibles.");
      return;
    }

    const requestedAt = new Date(`${address.requestedDate}T${address.requestedTime}:00`);
    if (Number.isNaN(requestedAt.getTime())) {
      setCoverageNote("Ingresa una fecha y hora validas.");
      return;
    }

    const qs = new URLSearchParams({
      address: address.street.trim(),
      comuna: address.comuna.trim(),
      city: address.city.trim(),
      requestedDate: address.requestedDate,
      requestedTime: address.requestedTime,
      date: requestedAt.toISOString()
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
                  onChange={(event) => {
                    setAddress((prev) => ({ ...prev, street: event.target.value }));
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(addressSuggestions.length > 0)}
                  placeholder="Calle y numero"
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
                Comuna
                <select
                  value={address.comuna}
                  onChange={(event) => setAddress((prev) => ({ ...prev, comuna: event.target.value }))}
                >
                  <option value="">Selecciona comuna</option>
                  {CHILE_TOP_COMMUNES.map((commune) => (
                    <option key={commune} value={commune}>
                      {commune}
                    </option>
                  ))}
                </select>
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
                Fecha del servicio
                <input
                  type="date"
                  value={address.requestedDate}
                  onChange={(event) => setAddress((prev) => ({ ...prev, requestedDate: event.target.value }))}
                  required
                />
              </label>
              <label>
                Hora del servicio
                <div className="time-quick-row" role="group" aria-label="Seleccion rapida de horario">
                  {TIME_QUICK_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`time-quick-btn ${activeTimeBlock === option.id ? "active" : ""}`}
                      onClick={() => setAddress((prev) => ({ ...prev, requestedTime: option.time }))}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <input
                  type="time"
                  value={address.requestedTime}
                  onChange={(event) => setAddress((prev) => ({ ...prev, requestedTime: event.target.value }))}
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
