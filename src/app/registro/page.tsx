"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthHeroNav } from "@/components/auth-hero-nav";

export default function RegistroPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phoneDigits, setPhoneDigits] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [loading, setLoading] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [resendingCode, setResendingCode] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationPreview, setVerificationPreview] = useState("");
  const [emailDeliveryConfigured, setEmailDeliveryConfigured] = useState(true);

  const normalizeEmailError = (message: string) => {
    const normalized = message.toLowerCase();
    if (
      normalized.includes("invalid email") ||
      normalized.includes("email inválido") ||
      normalized.includes("error en el correo") ||
      (normalized.includes("invalid_string") && normalized.includes("email")) ||
      normalized.includes("\"path\": [ \"email\" ]") ||
      normalized.includes("\"path\":[\"email\"]")
    ) {
      return "Error en el correo";
    }
    return message;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setFeedback("");
    setError("");

    try {
      const normalizedPhone = phoneDigits.trim() ? `+569${phoneDigits.trim()}` : undefined;
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          password,
          birthDate,
          phone: normalizedPhone,
          role: "CUSTOMER",
          acceptTerms
        })
      });

      const data = (await response.json()) as {
        error?: string;
        detail?: string;
        emailVerificationRequired?: boolean;
        emailDeliveryConfigured?: boolean;
        verificationTokenPreview?: string;
        session?: { fullName: string; role: "CUSTOMER" | "PRO" | "ADMIN" };
      };

      if (!response.ok) {
        throw new Error(data.detail || data.error || "No se pudo crear la cuenta");
      }

      if (data.emailVerificationRequired) {
        setVerificationRequired(true);
        setEmailDeliveryConfigured(data.emailDeliveryConfigured !== false);
        setVerificationPreview(data.verificationTokenPreview ?? "");
        setFeedback(
          data.emailDeliveryConfigured === false
            ? `Cuenta creada, pero el correo de verificación no está configurado en este ambiente.${data.verificationTokenPreview ? ` Código dev: ${data.verificationTokenPreview}` : ""}`
            : `Cuenta creada. Revisa tu correo e ingresa aquí el código de verificación.${data.verificationTokenPreview ? ` Código dev: ${data.verificationTokenPreview}` : ""}`
        );
        return;
      }

      if (!data.session) {
        throw new Error("No se pudo iniciar sesión tras registro.");
      }

      setFeedback(`Cuenta creada para ${data.session.fullName}`);
      router.push("/cliente");
      router.refresh();
    } catch (e) {
      setError(normalizeEmailError(e instanceof Error ? e.message : "Error inesperado"));
    } finally {
      setLoading(false);
    }
  };

  const submitVerificationCode = async (event: FormEvent) => {
    event.preventDefault();
    setVerifyingCode(true);
    setError("");
    setFeedback("");

    try {
      const response = await fetch("/api/auth/verify/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: verificationCode.trim() })
      });

      const data = (await response.json()) as { ok?: boolean; error?: string; detail?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.detail || data.error || "No se pudo verificar el código");
      }

      setVerificationRequired(false);
      setFeedback("Correo verificado. Ahora ya puedes iniciar sesión.");
      router.push("/ingresar/cliente");
    } catch (e) {
      setError(normalizeEmailError(e instanceof Error ? e.message : "Error inesperado"));
    } finally {
      setVerifyingCode(false);
    }
  };

  const resendVerificationCode = async () => {
    if (!email.trim()) return;
    setResendingCode(true);
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
        error?: string;
        detail?: string;
        codePreview?: string;
        alreadyVerified?: boolean;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.detail || data.error || "No se pudo reenviar el código");
      }

      if (data.alreadyVerified) {
        setVerificationRequired(false);
        setFeedback("Tu correo ya estaba verificado. Ahora puedes iniciar sesión.");
        return;
      }

      setVerificationPreview(data.codePreview ?? "");
      setFeedback(`Te enviamos un nuevo código.${data.codePreview ? ` Código dev: ${data.codePreview}` : ""}`);
    } catch (e) {
      setError(normalizeEmailError(e instanceof Error ? e.message : "Error inesperado"));
    } finally {
      setResendingCode(false);
    }
  };

  return (
    <main className="auth-flow-screen auth-flow-screen-scroll">
      <div className="auth-flow-backdrop" aria-hidden />
      <div className="login-screen-content">
        <AuthHeroNav />
        <section className="auth-flow-shell auth-flow-shell-wide">
          <div className="auth-flow-copy">
            <p className="auth-flow-kicker">Crear cuenta</p>
            <h1>Empieza con WeTask en minutos.</h1>
            <p>
              Crea tu cuenta de cliente para reservar servicios, seguir tus reservas y pagar de forma protegida dentro de WeTask.
            </p>

            <div className="auth-flow-copy-list">
              <div className="auth-flow-meta-card">
                <strong>Cuenta cliente</strong>
                <span>
                  Reserva, paga de forma protegida y sigue tus servicios desde una sola cuenta.
                </span>
              </div>
              <div className="auth-flow-meta-card">
                <strong>Acceso seguro</strong>
                <span>Tu información queda asociada a tu perfil y puedes continuar el flujo después desde tu sesión.</span>
              </div>
            </div>

            <div className="auth-flow-inline-links">
              <Link href="/ingresar">Ya tengo cuenta</Link>
              <Link href="/legal">Términos y privacidad</Link>
            </div>
          </div>

          <section className="auth-flow-panel auth-flow-panel-wide">
            <div className="panel-head auth-flow-panel-head">
              <h2>{verificationRequired ? "Verifica tu correo" : "Crear cuenta"}</h2>
              <p>
                {verificationRequired
                  ? "Ingresa aquí el código que te enviamos por correo para activar tu cuenta."
                  : "Completa tus datos como cliente y entra de inmediato a WeTask."}
              </p>
            </div>

            {!verificationRequired ? (
              <>
                <div className="auth-flow-note-card">
                  <strong>Cuenta cliente</strong>
                  <span>
                    Solo necesitas tus datos personales para empezar a reservar servicios en WeTask.
                  </span>
                </div>

                <form className="grid-form auth-flow-form" onSubmit={submit}>
                  <label>
                    Nombre
                    <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required minLength={2} />
                  </label>

                  <label>
                    Apellido
                    <input value={lastName} onChange={(e) => setLastName(e.target.value)} required minLength={2} />
                  </label>

                  <label>
                    Fecha de nacimiento
                    <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required max={new Date().toISOString().slice(0, 10)} />
                  </label>

                  <label>
                    Email
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </label>

                  <label>
                    Contraseña
                    <div className="password-field">
                      <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
                      <button type="button" className="password-toggle" onClick={() => setShowPassword((current) => !current)}>
                        {showPassword ? "Ocultar" : "Mostrar"}
                      </button>
                    </div>
                  </label>

                  <label>
                    Teléfono
                    <div className="phone-inline-field">
                      <span className="phone-inline-prefix">+569</span>
                      <input
                        inputMode="numeric"
                        pattern="[0-9]{8}"
                        value={phoneDigits}
                        onChange={(e) => setPhoneDigits(e.target.value.replace(/\D/g, "").slice(0, 8))}
                        placeholder="12345678"
                      />
                    </div>
                  </label>

                  <label className="full auth-flow-checkbox">
                    <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} required />
                    <span>Acepto términos y condiciones de WeTask.</span>
                  </label>

                  <div className="auth-flow-actions full">
                    <button type="submit" className="cta" disabled={loading}>
                      {loading ? "Creando cuenta..." : "Crear cuenta"}
                    </button>
                    <Link href="/ingresar" className="cta ghost">
                      Iniciar sesión
                    </Link>
                  </div>
                </form>
              </>
            ) : (
              <>
                <div className="auth-flow-note-card">
                  <strong>{email}</strong>
                  <span>
                    {emailDeliveryConfigured
                      ? "Te enviamos un correo con un código de 6 dígitos."
                      : "En este ambiente el correo no está configurado, pero puedes usar el código dev mostrado abajo."}
                  </span>
                </div>

                <form className="grid-form auth-flow-form" onSubmit={submitVerificationCode}>
                  <label className="full">
                    Código de verificación
                    <input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="123456"
                      required
                    />
                  </label>

                  {verificationPreview ? (
                    <p className="feedback ok full">Código dev: {verificationPreview}</p>
                  ) : null}

                  <div className="auth-flow-actions full">
                    <button type="submit" className="cta" disabled={verifyingCode}>
                      {verifyingCode ? "Verificando..." : "Verificar código"}
                    </button>
                    <button type="button" className="cta ghost" onClick={() => void resendVerificationCode()} disabled={resendingCode}>
                      {resendingCode ? "Reenviando..." : "Reenviar código"}
                    </button>
                  </div>
                </form>
              </>
            )}

            {feedback ? <p className="feedback ok">{feedback}</p> : null}
            {error ? <p className="feedback error">{error}</p> : null}
          </section>
        </section>
      </div>
    </main>
  );
}
