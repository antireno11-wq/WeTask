"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminHeroShell } from "@/components/admin-hero-shell";

export const dynamic = "force-dynamic";

type TeamAdminRow = {
  id: string;
  fullName: string;
  email: string;
  role: "CUSTOMER" | "PRO" | "ADMIN";
  createdAt: string;
  roleAssignments: Array<{ code: "CUSTOMER" | "PRO" | "ADMIN"; label: string }>;
};

type TeamPayload = {
  currentAdminId: string;
  admins: TeamAdminRow[];
};

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("es-CL");
}

export default function AdminTeamPage() {
  const [data, setData] = useState<TeamPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/team?page=1&pageSize=5");
      const payload = (await response.json()) as TeamPayload & { error?: string; detail?: string };
      if (!response.ok) throw new Error(payload.detail || payload.error || "No se pudo cargar el equipo");
      setData(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const revokeAccess = async (userId: string) => {
    setBusyId(userId);
    setError("");
    setFeedback("");
    try {
      const response = await fetch("/api/admin/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke", userId })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string; detail?: string; message?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.detail || payload.error || "No se pudo quitar el acceso");
      setFeedback(payload.message || "Acceso actualizado correctamente.");
      await load();
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
          <h2>Equipo interno</h2>
          <p>Revisa quién tiene acceso al backoffice y administra los permisos internos del equipo.</p>
        </div>
        <div className="cta-row">
          <Link href="/admin/team/new" className="cta">
            Crear otro administrador
          </Link>
          <Link href="/admin/users" className="cta ghost small">
            Usuarios de la plataforma
          </Link>
        </div>
      </div>

      {loading ? <p className="empty">Cargando equipo...</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}
      {feedback ? <p className="feedback ok">{feedback}</p> : null}

      <section className="admin-section-card">
        <div className="admin-section-head">
          <div>
            <h3>Admins activos</h3>
            <p>Estas son las personas que hoy pueden revisar taskers y operar el backoffice.</p>
          </div>
          <span className="status status-approved">{data?.admins.length ?? 0} activos</span>
        </div>

        <div className="admin-team-list">
          {data?.admins.map((user) => (
            <article key={user.id} className="admin-team-row">
              <div>
                <h4>{user.fullName}</h4>
                <p>{user.email}</p>
                <p>Desde {dateLabel(user.createdAt)} · Roles: {user.roleAssignments.map((role) => role.label).join(", ")}</p>
              </div>

              <div className="cta-row">
                {user.id === data.currentAdminId ? <span className="status status-approved">Tu sesión</span> : null}
                <button
                  type="button"
                  className="cta ghost small"
                  disabled={busyId === user.id || user.id === data.currentAdminId}
                  onClick={() => void revokeAccess(user.id)}
                >
                  Quitar acceso
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </AdminHeroShell>
  );
}
