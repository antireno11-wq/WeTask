"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MarketNav } from "@/components/market-nav";

type DemoUser = {
  id: string;
  fullName: string;
  email: string;
};

type DemoPayload = {
  customer?: DemoUser;
  admin?: DemoUser;
  professionals?: DemoUser[];
};

export default function IngresarPage() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState("/");

  const [customer, setCustomer] = useState<DemoUser | null>(null);
  const [admin, setAdmin] = useState<DemoUser | null>(null);
  const [professionals, setProfessionals] = useState<DemoUser[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNextPath(params.get("next") ?? "/");
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/marketplace/demo");
        const data = (await response.json()) as DemoPayload;
        setCustomer(data.customer ?? null);
        setAdmin(data.admin ?? null);
        setProfessionals(data.professionals ?? []);
      } catch {
        setError("No se pudo cargar usuarios demo");
      }
    };
    void load();
  }, []);

  const login = async (payload: { userId?: string; email?: string }) => {
    setLoading(true);
    setError("");
    setFeedback("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = (await response.json()) as { error?: string; detail?: string; session?: { fullName: string } };
      if (!response.ok || !data.session) {
        throw new Error(data.detail || data.error || "No se pudo iniciar sesion");
      }
      setFeedback(`Sesion iniciada como ${data.session.fullName}`);
      router.push(nextPath);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const submitByEmail = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    await login({ email: email.trim() });
  };

  return (
    <main className="page market-shell">
      <MarketNav />
      <section className="panel">
        <div className="panel-head">
          <h2>Ingresar</h2>
          <p>Accesos separados para cliente y profesional.</p>
        </div>

        <div className="login-split">
          <article className="module-card">
            <h3>Cliente</h3>
            <p>Reserva servicios y sigue tus pedidos.</p>
            {customer ? (
              <button className="cta small" type="button" onClick={() => void login({ userId: customer.id })} disabled={loading}>
                Entrar como cliente demo
              </button>
            ) : null}
            <Link href="/registro?role=CUSTOMER" className="cta ghost small">
              Crear cuenta cliente
            </Link>
          </article>

          <article className="module-card">
            <h3>Profesional</h3>
            <p>Gestiona tu perfil, disponibilidad y reservas.</p>
            {professionals[0] ? (
              <button className="cta small" type="button" onClick={() => void login({ userId: professionals[0].id })} disabled={loading}>
                Entrar como profesional demo
              </button>
            ) : null}
            <Link href="/registro?role=PRO" className="cta ghost small">
              Crear cuenta profesional
            </Link>
          </article>
        </div>

        <div className="module-grid">
          {admin ? (
            <article className="module-card">
              <h3>Admin demo</h3>
              <p>{admin.fullName}</p>
              <button className="cta small" type="button" onClick={() => void login({ userId: admin.id })} disabled={loading}>
                Entrar como admin
              </button>
            </article>
          ) : null}
        </div>

        <form className="query-row query-single" onSubmit={submitByEmail}>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@wetask.cl" />
          </label>
          <button className="cta ghost" type="submit" disabled={loading}>
            Entrar por email
          </button>
        </form>

        {feedback ? <p className="feedback ok">{feedback}</p> : null}
        {error ? <p className="feedback error">{error}</p> : null}
      </section>
    </main>
  );
}
