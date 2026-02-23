"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MarketNav } from "@/components/market-nav";

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

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const presetRole = params.get("role");
    if (presetRole === "PRO" || presetRole === "CUSTOMER") {
      setRole(presetRole);
    }
  }, []);

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
            </>
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
