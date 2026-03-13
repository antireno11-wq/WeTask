"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { MarketNav } from "@/components/market-nav";

type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  services: Array<{ id: string; name: string; basePriceClp: number }>;
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
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [selectedServiceId, setSelectedServiceId] = useState(query.get("serviceId") ?? "");
  const [street, setStreet] = useState(query.get("address") ?? "");
  const city = query.get("city") ?? "Santiago";

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
  }, [city, street]);

  const selectAddressSuggestion = (value: string) => {
    setStreet(value);
    setAddressSuggestions([]);
    setShowSuggestions(false);
  };

  const openPros = (event: FormEvent) => {
    event.preventDefault();
    if (!category) return;
    if (!street.trim()) {
      setCoverageNote("Completa el servicio y la direccion para ver taskers disponibles.");
      return;
    }

    const qs = new URLSearchParams({
      address: street.trim(),
      city: city.trim()
    });
    if (selectedServiceId) qs.set("serviceId", selectedServiceId);

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
              <p>Elige el servicio y escribe tu direccion para ver taskers disponibles.</p>
            </div>

            <form className="grid-form" onSubmit={openPros}>
              <label>
                Servicio
                <select value={selectedServiceId} onChange={(event) => setSelectedServiceId(event.target.value)} required>
                  {category.services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Direccion
                <input
                  value={street}
                  onChange={(event) => {
                    setStreet(event.target.value);
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
              <div className="cta-row service-category-actions full">
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
