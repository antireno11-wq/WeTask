"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type VerifyEmailClientProps = {
  token: string;
};

export function VerifyEmailClient({ token }: VerifyEmailClientProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Estamos verificando tu correo.");

  useEffect(() => {
    const verify = async () => {
      try {
        const response = await fetch("/api/auth/verify/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token })
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
      }
    };

    void verify();
  }, [router, token]);

  return (
    <section className="auth-flow-panel auth-flow-panel-wide">
      <div className="panel-head auth-flow-panel-head">
        <h2>{status === "loading" ? "Verificando..." : status === "success" ? "Correo verificado" : "No pudimos verificarlo"}</h2>
        <p>{message}</p>
      </div>

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
