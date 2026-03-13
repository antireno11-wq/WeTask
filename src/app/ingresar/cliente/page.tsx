"use client";

import { AuthHeroNav } from "@/components/auth-hero-nav";
import { LoginRolePanel } from "@/components/login-role-panel";

export default function IngresarClientePage() {
  return (
    <main className="login-screen">
      <div className="login-backdrop" aria-hidden />
      <div className="login-screen-content">
        <AuthHeroNav />

        <section className="login-stage login-stage-single">
          <div className="login-stage-copy">
            <p className="login-stage-kicker">Acceso cliente</p>
            <h2>Gestiona tus reservas y sigue cada servicio desde un solo lugar.</h2>
            <p>Entra para revisar estados, pagos protegidos y soporte de WeTask cuando lo necesites.</p>
          </div>

          <LoginRolePanel role="CUSTOMER" />
        </section>
      </div>
    </main>
  );
}
