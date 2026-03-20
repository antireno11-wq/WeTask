"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type VerifyEmailClientProps = {
  token?: string;
};

export function VerifyEmailClient({ token }: VerifyEmailClientProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Estamos verificando tu correo.");
  const [code, setCode] = useState(token ?? "");
  const [submitting, setSubmitting] = useState(false);

  const submitVerification = async (value: string) => {
    const normalized = value.trim();
    if (!normalized) {
      setStatus("error");
      setMessage("Ingresa tu código de verificación.");
      return;
    }

    try {
      setSubmitting(true);
      setStatus("loading");
      setMessage("Estamos verificando tu correo.");
      const response = await fetch("/api/auth/verify/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: normalized })
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; detail?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.detail || data.error || "No se pudo verificar tu correo.");
      }
      setStatus("success");
      setMessage("Tu correo ya quedó verificado. Ahora puedes iniciar sesión.");
      setTimeout(() => {
        router.push("/ingresar/cliente");
      }, 1400);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "No se pudo verificar tu correo.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Ingresa el código que te enviamos por correo para verificar tu cuenta.");
      return;
    }

    void submitVerification(token);
  }, [token]);

  return (
    <section className="auth-flow-panel auth-flow-panel-wide">
      <div className="panel-head auth-flow-panel-head">
        <h2>{status === "loading" ? "Verificando..." : status === "success" ? "Correo verificado" : "Verifica tu correo"}</h2>
        <p>{message}</p>
      </div>

      {status !== "success" ? (
        <form
          className="auth-flow-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submitVerification(code);
          }}
        >
          <label>
            Código de verificación
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\s+/g, "").slice(0, 6))}
              inputMode="numeric"
              placeholder="123456"
              autoComplete="one-time-code"
            />
          </label>
          <button type="submit" className="cta" disabled={submitting}>
            {submitting ? "Verificando..." : "Verificar código"}
          </button>
        </form>
      ) : null}

      <div className="auth-flow-actions">
        <Link href="/ingresar/cliente" className="cta">
          Ir a iniciar sesión
        </Link>
        <Link href="/registro" className="cta ghost">
          Volver a crear cuenta
        </Link>
      </div>
    </section>
  );
}
