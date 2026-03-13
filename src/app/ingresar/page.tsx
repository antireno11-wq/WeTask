"use client";

import { useState } from "react";
import { AuthHeroNav } from "@/components/auth-hero-nav";
import { LoginRolePanel } from "@/components/login-role-panel";

type LoginRole = "CUSTOMER" | "PRO";

export default function IngresarPage() {
  const [role, setRole] = useState<LoginRole>("CUSTOMER");

  return (
    <main className="login-screen">
      <div className="login-backdrop" aria-hidden />
      <div className="login-screen-content">
        <AuthHeroNav />

        <section className="login-stage">
          <div className="login-stage-copy">
            <p className="login-stage-kicker">WeTask</p>
            <h2>Servicios confiables, pago protegido y reserva simple.</h2>
            <p>
              Accede a tu cuenta para reservar, seguir tus servicios o administrar tu perfil profesional con la identidad visual de WeTask.
            </p>
          </div>

          <LoginRolePanel role={role} showRoleSwitchLink={false} showRoleTabs onRoleChange={setRole} />
        </section>
      </div>
    </main>
  );
}
