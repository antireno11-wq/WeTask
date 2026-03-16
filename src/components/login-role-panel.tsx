"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { BrandLogo } from "@/components/brand-logo";

type DemoUser = {
  id: string;
  fullName: string;
  email: string;
};

type DemoPayload = {
  customer?: DemoUser;
  customers?: DemoUser[];
  professionals?: DemoUser[];
  admin?: DemoUser | null;
};

type LoginRole = "CUSTOMER" | "PRO" | "ADMIN";

type LoginRolePanelProps = {
  role: LoginRole;
  showRoleSwitchLink?: boolean;
  showRoleTabs?: boolean;
  onRoleChange?: (role: LoginRole) => void;
  allowCreateAccount?: boolean;
};

export function LoginRolePanel({
  role,
  showRoleSwitchLink = true,
  showRoleTabs = false,
  onRoleChange,
  allowCreateAccount = true
}: LoginRolePanelProps) {
  const router = useRouter();
  const isTasker = role === "PRO";
  const isAdmin = role === "ADMIN";

  const [demoPayload, setDemoPayload] = useState<DemoPayload | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nextPath, setNextPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const demoPassword = "WetaskDemo2026!";

  const roleTitle = isAdmin ? "Ingreso equipo WeTask" : "Acceder";
  const roleDescription = isAdmin
    ? "Accede con tu cuenta interna para revisar validaciones, usuarios y operación del backoffice."
    : "Ingresa tus datos o crea una cuenta.";

  const createAccountHref = isTasker ? "/trabaja-con-nosotros" : "/registro?role=CUSTOMER";
  const createAccountLabel = isTasker ? "Crear cuenta tasker" : "Crear cuenta cliente";

  const demoUser = useMemo(() => {
    if (!demoPayload) return null;
    if (isAdmin) return demoPayload.admin ?? null;
    if (isTasker) return demoPayload.professionals?.[0] ?? null;
    return demoPayload.customers?.[0] ?? demoPayload.customer ?? null;
  }, [demoPayload, isAdmin, isTasker]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setNextPath(new URLSearchParams(window.location.search).get("next"));
  }, []);

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

  const login = async (payload: { userId?: string; email?: string; password?: string }) => {
    setLoading(true);
    setError("");
    setFeedback("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, role: role as UserRole })
      });
      const data = (await response.json()) as {
        error?: string;
        detail?: string;
        session?: { fullName: string; role: "CUSTOMER" | "PRO" | "ADMIN" };
      };
      if (!response.ok || !data.session) {
        throw new Error(data.detail || data.error || "No se pudo iniciar sesión");
      }
      setFeedback(`Sesión iniciada como ${data.session.fullName}`);
      const profileRoute = data.session.role === "PRO" ? "/pro" : data.session.role === "ADMIN" ? "/admin" : "/cliente";
      const safeNext = nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : null;
      router.push(safeNext ?? profileRoute);
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
    await login({ email: email.trim(), password });
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
      const data = (await response.json()) as { ok?: boolean; error?: string; detail?: string };
      if (!response.ok || !data.ok) throw new Error(data.detail || data.error || "No se pudo iniciar recuperación");
      setFeedback("Revisa tu correo para recuperar contraseña.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="login-panel-card">
      <div className="login-panel-head">
        <Link href="/" className="login-brand-mark" aria-label="Volver a WeTask">
          <BrandLogo width={210} height={82} />
        </Link>
        <p className="login-panel-kicker">Tu cuenta WeTask</p>
        <h1>{roleTitle}</h1>
        <p>{roleDescription}</p>

        {showRoleTabs ? (
          <div className="login-role-tabs" role="tablist" aria-label="Tipo de acceso">
            <button
              type="button"
              className={`login-role-tab ${role === "CUSTOMER" ? "active" : ""}`}
              aria-pressed={role === "CUSTOMER"}
              onClick={() => onRoleChange?.("CUSTOMER")}
            >
              Cliente
            </button>
            <button
              type="button"
              className={`login-role-tab ${role === "PRO" ? "active" : ""}`}
              aria-pressed={role === "PRO"}
              onClick={() => onRoleChange?.("PRO")}
            >
              Tasker
            </button>
          </div>
        ) : null}
      </div>

      {demoUser ? (
        <div className="login-demo-card">
          <div>
            <strong>Modo demo</strong>
            <span>
              {demoUser.email} · {demoPassword}
            </span>
          </div>
          <button className="login-demo-button" type="button" onClick={() => void login({ userId: demoUser.id })} disabled={loading}>
            Probar demo
          </button>
        </div>
      ) : null}

      <form id="wetask-login-form" className="login-form-shell" onSubmit={submitByEmail}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@wetask.cl" />
        </label>
        <label>
          Contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="********" />
        </label>
        <div className="login-primary-actions">
          <button className="cta small" type="submit" disabled={loading}>
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </button>
          {allowCreateAccount ? (
            <Link href={createAccountHref} className="cta ghost small">
              {createAccountLabel}
            </Link>
          ) : null}
        </div>
      </form>

      <div className="login-panel-footer">
        <button type="button" className="login-link-button" onClick={() => void forgotPassword()} disabled={loading}>
          Olvidé mi contraseña
        </button>
        {showRoleSwitchLink ? (
          <Link href="/ingresar" className="login-link-button link-inline">
            Cambiar tipo de ingreso
          </Link>
        ) : null}
      </div>

      <p className="login-legal-copy">
        Al acceder, aceptas nuestras <Link href="/legal">Condiciones de uso</Link> y <Link href="/legal">Política de privacidad</Link>.
      </p>

      {feedback ? <p className="feedback ok">{feedback}</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}
    </section>
  );
}
