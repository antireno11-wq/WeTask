"use client";

import { AuthHeroNav } from "@/components/auth-hero-nav";
import { LoginRolePanel } from "@/components/login-role-panel";

export default function IngresarEquipoPage() {
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
          </div>

          <LoginRolePanel role="ADMIN" allowCreateAccount={false} />
        </section>
      </div>
    </main>
  );
}
