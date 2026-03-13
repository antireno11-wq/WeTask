"use client";

import { LoginRolePanel } from "@/components/login-role-panel";

export default function IngresarTaskerPage() {
  return (
    <main className="login-screen">
      <div className="login-backdrop" aria-hidden />
      <section className="login-stage login-stage-single">
        <div className="login-stage-copy">
          <p className="login-stage-kicker">Acceso tasker</p>
          <h2>Administra agenda, disponibilidad y pagos desde tu cuenta profesional.</h2>
          <p>Ingresa a WeTask para atender solicitudes, cerrar servicios y hacer crecer tu perfil.</p>
        </div>

        <LoginRolePanel role="PRO" />
      </section>
    </main>
  );
}
