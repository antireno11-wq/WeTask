"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthHeroNav } from "@/components/auth-hero-nav";

export default function RegistroPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

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
          fullName,
          email,
          password,
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
        setFeedback(
          data.emailDeliveryConfigured === false
            ? `Cuenta creada, pero el correo de verificación no está configurado en este ambiente.${data.verificationTokenPreview ? ` Token dev: ${data.verificationTokenPreview}` : ""}`
            : `Cuenta creada. Revisa tu correo para verificar tu cuenta.${data.verificationTokenPreview ? ` Token dev: ${data.verificationTokenPreview}` : ""}`
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
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
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
              <h2>Crear cuenta</h2>
              <p>Completa tus datos como cliente y entra de inmediato a WeTask.</p>
            </div>

          <div className="auth-flow-note-card">
            <strong>Cuenta cliente</strong>
            <span>
              Solo necesitas tus datos personales para empezar a reservar servicios en WeTask.
            </span>
          </div>

          <form className="grid-form auth-flow-form" onSubmit={submit}>
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

            {feedback ? <p className="feedback ok">{feedback}</p> : null}
            {error ? <p className="feedback error">{error}</p> : null}
          </section>
        </section>
      </div>
    </main>
  );
}
