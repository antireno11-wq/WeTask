"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { MarketNav } from "@/components/market-nav";

const serviceOptions = [
  "Gasfiter",
  "Electricista",
  "Maestro multiuso",
  "Aire acondicionado",
  "Jardineria",
  "Reparaciones del hogar"
];

function SolicitarTecnicoContent() {
  const search = useSearchParams();
  const prefilledService = search.get("servicio") ?? "";
  const source = search.get("source") ?? "direct";

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [comuna, setComuna] = useState("");
  const [serviceNeeded, setServiceNeeded] = useState(prefilledService || serviceOptions[0]);
  const [problemDescription, setProblemDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [okMessage, setOkMessage] = useState("");
  const [error, setError] = useState("");

  const availableComunas = useMemo(() => ["Las Condes", "Vitacura", "Providencia", "Nunoa", "Lo Barnechea"], []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setOkMessage("");
    setError("");

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          phone,
          comuna,
          serviceNeeded,
          problemDescription,
          source
        })
      });

      const data = (await response.json()) as { ok?: boolean; error?: string; detail?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.detail || data.error || "No se pudo enviar la solicitud");
      }

      setOkMessage("Solicitud enviada. Te contactaremos en breve para coordinar el servicio.");
      setProblemDescription("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page market-shell">
      <MarketNav />

      <section className="panel mvp-lead-panel">
        <div className="panel-head">
          <h2>Buscar tecnico</h2>
          <p>Completa este formulario simple y te ayudamos a encontrar un tecnico confiable.</p>
        </div>

        <p className="mvp-coverage-note">Disponible actualmente en: {availableComunas.join(", ")}.</p>

        <form className="grid-form" onSubmit={submit}>
          <label>
            Nombre
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} required placeholder="Tu nombre" />
          </label>

          <label>
            Telefono
            <input value={phone} onChange={(event) => setPhone(event.target.value)} required placeholder="+56 9 ..." />
          </label>

          <label>
            Comuna
            <select value={comuna} onChange={(event) => setComuna(event.target.value)} required>
              <option value="">Selecciona comuna</option>
              {availableComunas.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label>
            Servicio que necesita
            <select value={serviceNeeded} onChange={(event) => setServiceNeeded(event.target.value)} required>
              {serviceOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="full">
            Descripcion del problema
            <textarea
              value={problemDescription}
              onChange={(event) => setProblemDescription(event.target.value)}
              required
              placeholder="Describe brevemente el problema o trabajo que necesitas"
            />
          </label>

          <div className="cta-row">
            <button type="submit" className="cta" disabled={loading}>
              {loading ? "Enviando..." : "Enviar solicitud"}
            </button>
            <Link href="/" className="cta ghost">
              Volver al inicio
            </Link>
          </div>
        </form>

        {okMessage ? <p className="feedback ok">{okMessage}</p> : null}
        {error ? <p className="feedback error">{error}</p> : null}
      </section>
    </main>
  );
}

function LoadingState() {
  return (
    <main className="page market-shell">
      <MarketNav />
      <section className="panel mvp-lead-panel">
        <p className="empty">Cargando formulario...</p>
      </section>
    </main>
  );
}

export default function SolicitarTecnicoPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SolicitarTecnicoContent />
    </Suspense>
  );
}
