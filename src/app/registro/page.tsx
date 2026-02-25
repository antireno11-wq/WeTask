"use client";

import Link from "next/link";
import { FormEvent, MouseEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MarketNav } from "@/components/market-nav";
import { geocodeAddress } from "@/lib/geo";

const SANTIAGO_BOUNDS = {
  minLat: -33.62,
  maxLat: -33.3,
  minLng: -70.82,
  maxLng: -70.45
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function RegistroPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"CUSTOMER" | "PRO">("CUSTOMER");
  const [city, setCity] = useState("Santiago");
  const [postalCode, setPostalCode] = useState("7500000");
  const [serviceRadiusKm, setServiceRadiusKm] = useState(8);
  const [hourlyRateFromClp, setHourlyRateFromClp] = useState(12000);
  const [coverageLat, setCoverageLat] = useState(-33.4489);
  const [coverageLng, setCoverageLng] = useState(-70.6693);

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const geocodedCenter = useMemo(() => geocodeAddress({ city, postalCode }), [city, postalCode]);

  useEffect(() => {
    if (role !== "PRO") return;
    setCoverageLat(geocodedCenter.lat);
    setCoverageLng(geocodedCenter.lng);
  }, [geocodedCenter, role]);

  const mapEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${SANTIAGO_BOUNDS.minLng}%2C${SANTIAGO_BOUNDS.minLat}%2C${SANTIAGO_BOUNDS.maxLng}%2C${SANTIAGO_BOUNDS.maxLat}&layer=mapnik&marker=${coverageLat}%2C${coverageLng}`;
  const markerLeftPct = ((coverageLng - SANTIAGO_BOUNDS.minLng) / (SANTIAGO_BOUNDS.maxLng - SANTIAGO_BOUNDS.minLng)) * 100;
  const markerTopPct = (1 - (coverageLat - SANTIAGO_BOUNDS.minLat) / (SANTIAGO_BOUNDS.maxLat - SANTIAGO_BOUNDS.minLat)) * 100;
  const radiusPx = Math.max(28, serviceRadiusKm * 10);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const presetRole = params.get("role");
    if (presetRole === "PRO" || presetRole === "CUSTOMER") {
      setRole(presetRole);
    }
  }, []);

  const updateCoverageFromPointer = (clientX: number, clientY: number, rect: DOMRect) => {
    const xPct = clamp((clientX - rect.left) / rect.width, 0, 1);
    const yPct = clamp((clientY - rect.top) / rect.height, 0, 1);

    const nextLng = SANTIAGO_BOUNDS.minLng + xPct * (SANTIAGO_BOUNDS.maxLng - SANTIAGO_BOUNDS.minLng);
    const nextLat = SANTIAGO_BOUNDS.maxLat - yPct * (SANTIAGO_BOUNDS.maxLat - SANTIAGO_BOUNDS.minLat);

    setCoverageLat(nextLat);
    setCoverageLng(nextLng);
  };

  const onCoverageMapClick = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    updateCoverageFromPointer(event.clientX, event.clientY, rect);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setFeedback("");
    setError("");

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          phone,
          role,
          city,
          postalCode,
          serviceRadiusKm,
          latitude: role === "PRO" ? coverageLat : undefined,
          longitude: role === "PRO" ? coverageLng : undefined,
          hourlyRateFromClp: role === "PRO" ? hourlyRateFromClp : undefined
        })
      });

      const data = (await response.json()) as {
        error?: string;
        detail?: string;
        session?: { fullName: string; role: "CUSTOMER" | "PRO" | "ADMIN" };
      };

      if (!response.ok || !data.session) {
        throw new Error(data.detail || data.error || "No se pudo crear la cuenta");
      }

      setFeedback(`Cuenta creada para ${data.session.fullName}`);

      if (data.session.role === "PRO") {
        router.push("/pro");
      } else {
        router.push("/cliente");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page market-shell">
      <MarketNav />

      <section className="panel">
        <div className="panel-head">
          <h2>Crear cuenta</h2>
          <p>Registra cliente o profesional y entra de inmediato a la plataforma.</p>
        </div>

        <form className="grid-form" onSubmit={submit}>
          <label>
            Nombre completo
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={3} />
          </label>

          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>

          <label>
            Telefono
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+56 9 ..." />
          </label>

          <label>
            Tipo de cuenta
            <select value={role} onChange={(e) => setRole(e.target.value as "CUSTOMER" | "PRO")}>
              <option value="CUSTOMER">Cliente</option>
              <option value="PRO">Profesional</option>
            </select>
          </label>

          {role === "PRO" ? (
            <>
              <label>
                Ciudad base
                <input value={city} onChange={(e) => setCity(e.target.value)} />
              </label>

              <label>
                Codigo postal
                <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
              </label>

              <label>
                Radio de servicio (km)
                <input
                  type="number"
                  min={2}
                  max={50}
                  value={serviceRadiusKm}
                  onChange={(e) => setServiceRadiusKm(Number(e.target.value) || 8)}
                />
              </label>

              <label>
                Tarifa base por hora (CLP)
                <input
                  type="number"
                  min={5000}
                  value={hourlyRateFromClp}
                  onChange={(e) => setHourlyRateFromClp(Number(e.target.value) || 12000)}
                />
              </label>

              <div className="full coverage-map-card">
                <div className="coverage-map-head">
                  <h3>Zona de cobertura</h3>
                  <p>Haz click en el mapa para fijar tu punto base y ajustar tu radio real.</p>
                </div>
                <div
                  className="coverage-map-wrap coverage-map-interactive"
                  onClick={onCoverageMapClick}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    const rect = event.currentTarget.getBoundingClientRect();
                    updateCoverageFromPointer(rect.left + rect.width / 2, rect.top + rect.height / 2, rect);
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label="Seleccionar punto de cobertura en el mapa"
                >
                  <iframe
                    title="Mapa de cobertura de servicio"
                    src={mapEmbedUrl}
                    loading="lazy"
                    className="coverage-map-frame"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                  <span className="coverage-pin" style={{ left: `${markerLeftPct}%`, top: `${markerTopPct}%` }} aria-hidden>
                    <span className="coverage-pin-radius" style={{ width: `${radiusPx}px`, height: `${radiusPx}px` }} />
                    <span className="coverage-pin-dot" />
                  </span>
                </div>
                <p className="coverage-meta">
                  Punto: {coverageLat.toFixed(4)}, {coverageLng.toFixed(4)} · Radio {serviceRadiusKm} km
                </p>
              </div>
            </>
          ) : null}

          {role !== "PRO" ? (
            <div className="full coverage-map-card">
              <div className="coverage-map-head">
                <h3>Mapa de cobertura</h3>
                <p>Disponible para cuentas Profesionales. Cambia "Tipo de cuenta" a Profesional para activarlo.</p>
              </div>
            </div>
          ) : null}

          <div className="cta-row full">
            <button type="submit" className="cta" disabled={loading}>
              {loading ? "Creando cuenta..." : "Crear cuenta"}
            </button>
            <Link href="/ingresar" className="cta ghost">
              Ya tengo cuenta
            </Link>
          </div>
        </form>

        {feedback ? <p className="feedback ok">{feedback}</p> : null}
        {error ? <p className="feedback error">{error}</p> : null}
      </section>
    </main>
  );
}
