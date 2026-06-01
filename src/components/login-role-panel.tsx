"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { UserRole } from "@prisma/client";
import { BrandLogo } from "@/components/brand-logo";

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
  const isTasker = role === "PRO";
  const isAdmin = role === "ADMIN";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [nextPath, setNextPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [showResetPasswordHint, setShowResetPasswordHint] = useState(false);

  const normalizeEmailError = (message: string) => {
    const normalized = message.toLowerCase();
    if (
      normalized.includes("invalid email") ||
      normalized.includes("email inválido") ||
      normalized.includes("error en el correo") ||
      (normalized.includes("invalid_string") && normalized.includes("email")) ||
      (normalized.includes("\"path\": [ \"email\" ]") || normalized.includes("\"path\":[\"email\"]"))
    ) {
      return "Error en el correo";
    }
    return message;
  };

  const roleTitle = isAdmin ? "Ingreso equipo WeTask" : "Acceder";
  const roleDescription = isAdmin
    ? "Accede con tu cuenta interna para revisar validaciones, usuarios y operación del backoffice."
    : "Ingresa tus datos o crea una cuenta.";

  const createAccountHref = isTasker ? "/trabaja-con-nosotros" : "/registro?role=CUSTOMER";
  const createAccountLabel = isTasker ? "Crear cuenta tasker" : "Crear cuenta cliente";

  useEffect(() => {
    if (typeof window === "undefined") return;
    setNextPath(new URLSearchParams(window.location.search).get("next"));
  }, []);

  const login = async (payload: { email?: string; password?: string }) => {
    setLoading(true);
    setError("");
    setFeedback("");
    setShowResendVerification(false);
    setShowResetPasswordHint(false);
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
      const profileRoute = data.session.role === "PRO" ? "/pro" : data.session.role === "ADMIN" ? "/admin" : "/servicios";
      const safeNext = nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : null;
      window.location.assign(safeNext ?? profileRoute);
    } catch (e) {
      const message = normalizeEmailError(e instanceof Error ? e.message : "Error inesperado");
      setError(message);
      setShowResendVerification(message.includes("Debes verificar tu correo antes de ingresar"));
      setShowResetPasswordHint(
        message.includes("Olvidé mi contraseña") ||
          message.includes("contraseña no coincide") ||
          message.includes("Credenciales inválidas")
      );
    } finally {
      setLoading(false);
    }
  };

  const submitByEmail = async (event: FormEvent) => {
    event.preventDefault();
    // UX-06: validación explícita con feedback (antes fallaba en silencio).
    if (!email.trim()) {
      setError("Ingresa tu correo.");
      return;
    }
    if (!password) {
      setError("Ingresa tu contraseña.");
      return;
    }
    await login({ email: email.trim(), password });
  };

  const forgotPassword = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    setFeedback("");
    setShowResendVerification(false);
    setShowResetPasswordHint(false);
    try {
      const response = await fetch("/api/auth/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() })
      });
      const data = (await response.json()) as {
        ok?: boolean;
        emailConfigured?: boolean;
        tokenPreview?: string;
        error?: string;
        detail?: string;
      };
      if (!response.ok || !data.ok) throw new Error(data.detail || data.error || "No se pudo iniciar recuperación");
      if (data.emailConfigured) {
        setFeedback("Si tu cuenta existe, te enviamos un correo para restablecer tu contraseña.");
      } else {
        setFeedback(
          // UX-01: nunca mostrar el token en producción, aunque el backend lo enviara.
          data.tokenPreview && process.env.NODE_ENV !== "production"
            ? `Este ambiente no tiene correo configurado todavía. Token de prueba: ${data.tokenPreview}`
            : "Este ambiente no tiene correo configurado todavía para recuperación de contraseña."
        );
      }
    } catch (e) {
      setError(normalizeEmailError(e instanceof Error ? e.message : "Error inesperado"));
    } finally {
      setLoading(false);
    }
  };

  const resendVerificationEmail = async () => {
    if (!email.trim()) {
      setError("Escribe tu correo para reenviar la validación.");
      return;
    }
    setLoading(true);
    setError("");
    setFeedback("");
    try {
      const response = await fetch("/api/auth/verify/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() })
      });
      const data = (await response.json()) as {
        ok?: boolean;
        alreadyVerified?: boolean;
        codePreview?: string;
        error?: string;
        detail?: string;
      };
      if (!response.ok || !data.ok) {
        throw new Error(data.detail || data.error || "No se pudo reenviar el correo de validación.");
      }
      if (data.alreadyVerified) {
        setFeedback("Ese correo ya está verificado. Ya puedes iniciar sesión.");
        setShowResendVerification(false);
        return;
      }
      setFeedback(
        // UX-01: el código de prueba sólo se muestra fuera de producción.
        data.codePreview && process.env.NODE_ENV !== "production"
          ? `Te reenviamos el correo de validación. Código de prueba: ${data.codePreview}`
          : "Te reenviamos el correo de validación. Revisa tu bandeja de entrada."
      );
      setShowResendVerification(false);
    } catch (e) {
      setError(normalizeEmailError(e instanceof Error ? e.message : "Error inesperado"));
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

      <form id="wetask-login-form" className="login-form-shell" onSubmit={submitByEmail}>
        <label>
          Email
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@wetask.cl" />
        </label>
        <label>
          Contraseña
          <div className="password-field">
            <input type={showPassword ? "text" : "password"} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="********" />
            <button type="button" className="password-toggle" onClick={() => setShowPassword((current) => !current)}>
              {showPassword ? "Ocultar" : "Mostrar"}
            </button>
          </div>
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
      {showResendVerification ? (
        <div className="login-inline-help">
          <button type="button" className="login-link-button" onClick={() => void resendVerificationEmail()} disabled={loading}>
            {loading ? "Reenviando..." : "Reenviar correo de validación"}
          </button>
        </div>
      ) : null}
      {showResetPasswordHint ? (
        <div className="login-inline-help">
          <button type="button" className="login-link-button" onClick={() => void forgotPassword()} disabled={loading}>
            {loading ? "Enviando..." : "Restablecer contraseña"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
