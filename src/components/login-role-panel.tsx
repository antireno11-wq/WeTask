"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type DemoUser = {
  id: string;
  fullName: string;
  email: string;
};

type DemoPayload = {
  customer?: DemoUser;
  professionals?: DemoUser[];
};

type LoginRole = "CUSTOMER" | "PRO";

type LoginRolePanelProps = {
  role: LoginRole;
};

export function LoginRolePanel({ role }: LoginRolePanelProps) {
  const router = useRouter();
  const isTasker = role === "PRO";

  const [nextPath, setNextPath] = useState<string>(isTasker ? "/pro" : "/cliente");
  const [demoPayload, setDemoPayload] = useState<DemoPayload | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const roleTitle = isTasker ? "Ingreso Tasker" : "Ingreso Cliente";
  const roleDescription = isTasker
    ? "Gestiona tus servicios, disponibilidad y reservas."
    : "Reserva servicios y haz seguimiento de tus solicitudes.";

  const createAccountHref = isTasker ? "/registro?role=PRO" : "/registro?role=CUSTOMER";
  const createAccountLabel = isTasker ? "Crear cuenta tasker" : "Crear cuenta cliente";

  const demoUser = useMemo(() => {
    if (!demoPayload) return null;
    if (isTasker) return demoPayload.professionals?.[0] ?? null;
    return demoPayload.customer ?? null;
  }, [demoPayload, isTasker]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNextPath(params.get("next") ?? (isTasker ? "/pro" : "/cliente"));
  }, [isTasker]);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/marketplace/demo");
        const data = (await response.json()) as DemoPayload;
        setDemoPayload(data);
      } catch {
        setError("No se pudo cargar usuarios demo.");
      }
    };
    void load();
  }, []);

  const login = async (payload: { userId?: string; email?: string; password?: string; role: LoginRole }) => {
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
    await login({ email: email.trim(), password, role });
  };

  const forgotPassword = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    setFeedback("");
    try {
      const response = await fetch("/api/auth/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() })
      });
      const data = (await response.json()) as { ok?: boolean; tokenPreview?: string; error?: string; detail?: string };
      if (!response.ok || !data.ok) throw new Error(data.detail || data.error || "No se pudo iniciar recuperacion");
      if (data.tokenPreview) setResetToken(data.tokenPreview);
      setFeedback(data.tokenPreview ? `Token recovery (dev): ${data.tokenPreview}` : "Revisa tu correo para recuperar contraseña.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const doResetPassword = async () => {
    if (!resetToken || !newPassword) return;
    setLoading(true);
    setError("");
    setFeedback("");
    try {
      const response = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, newPassword })
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; detail?: string };
      if (!response.ok || !data.ok) throw new Error(data.detail || data.error || "No se pudo cambiar contraseña");
      setFeedback("Contraseña actualizada. Ya puedes iniciar sesión.");
      setResetToken("");
      setNewPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{roleTitle}</h2>
        <p>{roleDescription}</p>
      </div>

      <div className="cta-row">
        {demoUser ? (
          <button className="cta small" type="button" onClick={() => void login({ userId: demoUser.id, role })} disabled={loading}>
            Entrar como {isTasker ? "tasker" : "cliente"} demo
          </button>
        ) : null}
        <Link href={createAccountHref} className="cta ghost small">
          {createAccountLabel}
        </Link>
        <Link href="/ingresar" className="cta ghost small">
          Cambiar tipo de ingreso
        </Link>
      </div>

      <form className="query-row query-single" onSubmit={submitByEmail}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@wetask.cl" />
        </label>
        <label>
          Contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="********" />
        </label>
        <button className="cta ghost" type="submit" disabled={loading}>
          Entrar con email
        </button>
      </form>

      <div className="cta-row">
        <button type="button" className="cta ghost small" onClick={() => void forgotPassword()} disabled={loading}>
          Olvide mi contraseña
        </button>
      </div>

      <div className="query-row query-single">
        <label>
          Token de recuperacion
          <input value={resetToken} onChange={(e) => setResetToken(e.target.value)} placeholder="token" />
        </label>
        <label>
          Nueva contraseña
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} />
        </label>
        <button type="button" className="cta ghost" onClick={() => void doResetPassword()} disabled={loading}>
          Cambiar contraseña
        </button>
      </div>

      {feedback ? <p className="feedback ok">{feedback}</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}
    </section>
  );
}
