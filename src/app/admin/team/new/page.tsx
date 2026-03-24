"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminHeroShell } from "@/components/admin-hero-shell";

export const dynamic = "force-dynamic";

export default function AdminCreatePage() {
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [email, setEmail] = useState("");
  const [existingEmail, setExistingEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");

  const runAction = async (
    action: "grant" | "create_admin",
    target: { email?: string; fullName?: string; password?: string }
  ) => {
    const currentBusyId = target.email || action;
    setBusyId(currentBusyId);
    setError("");
    setFeedback("");
    try {
      const response = await fetch("/api/admin/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...target })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string; detail?: string; message?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.detail || payload.error || "No se pudo crear el administrador");
      setFeedback(payload.message || "Administrador creado correctamente.");
      if (action === "grant") setExistingEmail("");
      if (action === "create_admin") {
        setEmail("");
        setFullName("");
        setPassword("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setBusyId("");
    }
  };

  return (
    <AdminHeroShell>
      <div className="panel-head admin-page-head">
        <div>
          <span className="eyebrow">Backoffice WeTask</span>
          <h2>Crear otro administrador</h2>
          <p>Crea un admin nuevo desde cero o dale acceso administrador a una cuenta que ya exista como cliente o tasker.</p>
        </div>
        <div className="cta-row">
          <Link href="/admin/team" className="cta ghost small">
            Equipo interno
          </Link>
          <Link href="/admin/users" className="cta ghost small">
            Usuarios de la plataforma
          </Link>
        </div>
      </div>

      {error ? <p className="feedback error">{error}</p> : null}
      {feedback ? <p className="feedback ok">{feedback}</p> : null}

      <section className="admin-section-card">
        <div className="admin-section-head">
          <div>
            <h3>Crear admin desde cero</h3>
            <p>Usa esta opción si la persona todavía no tiene cuenta en WeTask.</p>
          </div>
        </div>

        <div className="admin-team-form">
          <label>
            Nombre completo
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Nombre del administrador"
            />
          </label>
          <label>
            Correo del administrador
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="equipo@wetask.cl"
            />
          </label>
          <label>
            Contraseña inicial
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
          </label>
          <button
            type="button"
            className="cta"
            disabled={!fullName.trim() || !email.trim() || password.trim().length < 8 || busyId === email.trim().toLowerCase()}
            onClick={() =>
              void runAction("create_admin", {
                fullName: fullName.trim(),
                email: email.trim().toLowerCase(),
                password
              })
            }
          >
            Crear administrador
          </button>
        </div>
      </section>

      <section className="admin-section-card">
        <div className="admin-section-head">
          <div>
            <h3>Dar acceso a cuenta existente</h3>
            <p>Si la persona ya es cliente o tasker, aquí le agregas acceso admin sin crear otra cuenta.</p>
          </div>
        </div>

        <div className="admin-team-form admin-team-form-secondary">
          <label>
            Correo de la cuenta existente
            <input
              type="email"
              value={existingEmail}
              onChange={(event) => setExistingEmail(event.target.value)}
              placeholder="usuario-existente@wetask.cl"
            />
          </label>
          <button
            type="button"
            className="cta ghost"
            disabled={!existingEmail.trim() || busyId === existingEmail.trim().toLowerCase()}
            onClick={() => void runAction("grant", { email: existingEmail.trim().toLowerCase() })}
          >
            Dar acceso admin
          </button>
        </div>
      </section>
    </AdminHeroShell>
  );
}
