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
  const [phone, setPhone] = useState("");
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
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          password,
          phone,
          role: "CUSTOMER",
          acceptTerms
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
                <span>Tu informacion queda asociada a tu perfil y puedes continuar el flujo despues desde tu sesion.</span>
              </div>
              <div className="auth-flow-meta-card">
                <strong>¿Quieres ofrecer servicios?</strong>
                <span>Si quieres ser tasker, crea tu cuenta directamente desde el flujo de profesionales.</span>
              </div>
            </div>

            <div className="auth-flow-inline-links">
              <Link href="/ingresar">Ya tengo cuenta</Link>
              <Link href="/trabaja-con-nosotros">Quiero ofrecer servicios</Link>
              <Link href="/legal">Terminos y privacidad</Link>
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
              Contrasena
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
            </label>

            <label>
              Telefono
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+56 9 ..." />
            </label>

            <div className="full auth-flow-note-card">
              <strong>¿Quieres ser tasker?</strong>
              <span>El registro de profesionales ahora vive solo en Ofrecer servicios para que el onboarding sea más claro y ordenado.</span>
            </div>

            <label className="full auth-flow-checkbox">
              <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} required />
              <span>Acepto terminos y condiciones de WeTask.</span>
            </label>

            <div className="auth-flow-actions full">
              <button type="submit" className="cta" disabled={loading}>
                {loading ? "Creando cuenta..." : "Crear cuenta"}
              </button>
              <Link href="/trabaja-con-nosotros" className="cta ghost">
                Ofrecer servicios
              </Link>
              <Link href="/ingresar" className="cta ghost">
                Iniciar sesion
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
