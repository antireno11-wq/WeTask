"use client";

import { useState } from "react";
import { MarketNav } from "@/components/market-nav";
import { LoginRolePanel } from "@/components/login-role-panel";

type LoginRole = "CUSTOMER" | "PRO";

export default function IngresarPage() {
  const [role, setRole] = useState<LoginRole>("CUSTOMER");

  return (
    <main className="page market-shell">
      <MarketNav />

      <section className="panel">
        <div className="panel-head">
          <h2>Ingresar</h2>
          <p>Elige cómo quieres iniciar sesión y continúa con un solo formulario.</p>
        </div>

        <div className="query-row query-single">
          <label>
            Tipo de sesión
            <select value={role} onChange={(event) => setRole(event.target.value as LoginRole)}>
              <option value="CUSTOMER">Cliente</option>
              <option value="PRO">Tasker (Profesional)</option>
            </select>
          </label>
        </div>
      </section>

      <LoginRolePanel role={role} showRoleSwitchLink={false} />
    </main>
  );
}
