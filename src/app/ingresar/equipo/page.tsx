"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthHeroNav } from "@/components/auth-hero-nav";
import { LoginRolePanel } from "@/components/login-role-panel";

export default function IngresarEquipoPage() {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const prepareAdminAccess = async () => {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const data = (await response.json()) as { session?: { role?: "CUSTOMER" | "PRO" | "ADMIN" } | null };

        if (data.session?.role === "ADMIN") {
          router.replace("/admin");
          return;
        }

        if (data.session?.role === "CUSTOMER" || data.session?.role === "PRO") {
          await fetch("/api/auth/logout", { method: "POST" });
          setNotice("Cerramos tu sesión actual para que puedas ingresar al backoffice con una cuenta administradora.");
        }
      } catch {
        setNotice("");
      } finally {
        setCheckingSession(false);
      }
    };

    void prepareAdminAccess();
  }, [router]);

  return (
    <main className="login-screen">
      <div className="login-backdrop" aria-hidden />
      <div className="login-screen-content">
        <AuthHeroNav />

        <section className="login-stage login-stage-single">
          <div className="login-stage-copy">
            <p className="login-stage-kicker">Equipo WeTask</p>
            <h2>Ingresa al backoffice para validar profesionales y administrar la operación.</h2>
            <p>Este acceso es solo para administradores autorizados del equipo interno de WeTask.</p>
            {checkingSession ? <p className="feedback admin-access-notice">Preparando acceso del equipo...</p> : null}
            {!checkingSession && notice ? <p className="feedback admin-access-notice">{notice}</p> : null}
          </div>

          <LoginRolePanel role="ADMIN" allowCreateAccount={false} />
        </section>
      </div>
    </main>
  );
}
