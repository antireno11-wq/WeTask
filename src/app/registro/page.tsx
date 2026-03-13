"use client";

import { FormEvent, MouseEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MarketNav } from "@/components/market-nav";
import { ACTIVE_MVP_COMMUNES } from "@/lib/communes";
import { geocodeAddress } from "@/lib/geo";

const SANTIAGO_BOUNDS = {
  minLat: -33.62,
  maxLat: -33.3,
  minLng: -70.82,
  maxLng: -70.45
};
const CHILE_CITIES = ["Santiago", "Valparaiso", "Vina del Mar", "Concepcion", "La Serena", "Antofagasta", "Temuco", "Puerto Montt"];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function RegistroPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [role, setRole] = useState<"CUSTOMER" | "PRO">("CUSTOMER");
  const [coverageStreet, setCoverageStreet] = useState("");
  const [coverageComuna, setCoverageComuna] = useState<string>(ACTIVE_MVP_COMMUNES[0]);
  const [city, setCity] = useState("Santiago");
  const [postalCode, setPostalCode] = useState("7500000");
  const [serviceRadiusKm, setServiceRadiusKm] = useState(8);
  const [hourlyRateFromClp, setHourlyRateFromClp] = useState(12000);
  const [documentType, setDocumentType] = useState<"CEDULA_CHILE" | "PASAPORTE">("CEDULA_CHILE");
  const [documentNumber, setDocumentNumber] = useState("");
  const [identityDocumentUrl, setIdentityDocumentUrl] = useState("");
  const [backgroundCheckUrl, setBackgroundCheckUrl] = useState("");
  const [identityDocumentName, setIdentityDocumentName] = useState("");
  const [backgroundCheckName, setBackgroundCheckName] = useState("");
  const [coverageLat, setCoverageLat] = useState(-33.4489);
  const [coverageLng, setCoverageLng] = useState(-70.6693);

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const geocodedCenter = useMemo(
    () =>
      geocodeAddress({
        city,
        postalCode,
        street: `${coverageStreet} ${coverageComuna}`.trim()
      }),
    [city, postalCode, coverageStreet, coverageComuna]
  );

  useEffect(() => {
    if (role !== "PRO") return;
    setCoverageLat(geocodedCenter.lat);
    setCoverageLng(geocodedCenter.lng);
  }, [geocodedCenter, role]);

  const mapEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${SANTIAGO_BOUNDS.minLng}%2C${SANTIAGO_BOUNDS.minLat}%2C${SANTIAGO_BOUNDS.maxLng}%2C${SANTIAGO_BOUNDS.maxLat}&layer=hot&marker=${coverageLat}%2C${coverageLng}`;
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

  const toDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("No se pudo leer archivo"));
      reader.readAsDataURL(file);
    });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setFeedback("");
    setError("");

    try {
      if (role === "PRO" && (!identityDocumentUrl || !backgroundCheckUrl)) {
        throw new Error("Debes cargar documento de identidad y certificado de antecedentes");
      }

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          password,
          phone,
          role,
          acceptTerms,
          coverageStreet: role === "PRO" ? coverageStreet : undefined,
          coverageComuna: role === "PRO" ? coverageComuna : undefined,
          city,
          postalCode,
          serviceRadiusKm,
          latitude: role === "PRO" ? coverageLat : undefined,
          longitude: role === "PRO" ? coverageLng : undefined,
          hourlyRateFromClp: role === "PRO" ? hourlyRateFromClp : undefined,
          documentType: role === "PRO" ? documentType : undefined,
          documentNumber: role === "PRO" ? documentNumber : undefined,
          identityDocumentUrl: role === "PRO" ? identityDocumentUrl : undefined,
          backgroundCheckUrl: role === "PRO" ? backgroundCheckUrl : undefined
        })
      });

      const data = (await response.json()) as {
        error?: string;
        detail?: string;
        emailVerificationRequired?: boolean;
        verificationTokenPreview?: string;
        session?: { fullName: string; role: "CUSTOMER" | "PRO" | "ADMIN" };
      };

      if (!response.ok) {
        throw new Error(data.detail || data.error || "No se pudo crear la cuenta");
      }

      if (data.emailVerificationRequired) {
        setFeedback(
          `Cuenta creada. Revisa tu correo para verificar tu cuenta.${data.verificationTokenPreview ? ` Token dev: ${data.verificationTokenPreview}` : ""}`
        );
        return;
      }

      if (!data.session) {
        throw new Error("No se pudo iniciar sesion tras registro.");
      }

      setFeedback(`Cuenta creada para ${data.session.fullName}`);
      router.push(data.session.role === "PRO" ? "/pro" : "/cliente");
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
            Contraseña
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
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
                Direccion
                <input value={coverageStreet} onChange={(e) => setCoverageStreet(e.target.value)} placeholder="Calle y numero" />
              </label>

              <label>
                Comuna
                <select value={coverageComuna} onChange={(e) => setCoverageComuna(e.target.value)}>
                  {ACTIVE_MVP_COMMUNES.map((commune) => (
                    <option key={commune} value={commune}>
                      {commune}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Ciudad
                <select value={city} onChange={(e) => setCity(e.target.value)}>
                  {CHILE_CITIES.map((cityOption) => (
                    <option key={cityOption} value={cityOption}>
                      {cityOption}
                    </option>
                  ))}
                </select>
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

              <div className="full coverage-map-card">
                <div className="coverage-map-head">
                  <h3>Documentacion obligatoria</h3>
                  <p>Necesitamos validar identidad y antecedentes antes de activar tu perfil profesional.</p>
                </div>
                <div className="grid-form">
                  <label>
                    Tipo de documento
                    <select value={documentType} onChange={(e) => setDocumentType(e.target.value as "CEDULA_CHILE" | "PASAPORTE")} required>
                      <option value="CEDULA_CHILE">Cedula chilena</option>
                      <option value="PASAPORTE">Pasaporte</option>
                    </select>
                  </label>
                  <label>
                    Numero de documento
                    <input
                      value={documentNumber}
                      onChange={(e) => setDocumentNumber(e.target.value)}
                      required
                      minLength={5}
                      placeholder="Ej: 12345678-9"
                    />
                  </label>
                  <label>
                    Documento de identidad (archivo)
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      required
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const content = await toDataUrl(file);
                        setIdentityDocumentUrl(content);
                        setIdentityDocumentName(file.name);
                      }}
                    />
                    {identityDocumentName ? <span className="input-hint">Cargado: {identityDocumentName}</span> : null}
                  </label>
                  <label>
                    Certificado de antecedentes (archivo)
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      required
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const content = await toDataUrl(file);
                        setBackgroundCheckUrl(content);
                        setBackgroundCheckName(file.name);
                      }}
                    />
                    {backgroundCheckName ? <span className="input-hint">Cargado: {backgroundCheckName}</span> : null}
                  </label>
                </div>
              </div>
            </>
          ) : null}

          <label className="full">
            <span className="inline-checks">
              <label>
                <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} required /> Acepto terminos y
                condiciones
              </label>
            </span>
          </label>

          {role !== "PRO" ? (
            <div className="full coverage-map-card">
              <div className="coverage-map-head">
                <h3>Mapa de cobertura</h3>
                <p>Disponible para cuentas Profesionales. Cambia &quot;Tipo de cuenta&quot; a Profesional para activarlo.</p>
              </div>
            </div>
          ) : null}

          <div className="cta-row full">
            <button type="submit" className="cta" disabled={loading}>
              {loading ? "Creando cuenta..." : "Crear cuenta"}
            </button>
          </div>
        </form>

        {feedback ? <p className="feedback ok">{feedback}</p> : null}
        {error ? <p className="feedback error">{error}</p> : null}
      </section>
    </main>
  );
}
