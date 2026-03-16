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

type TeamUserRow = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: "CUSTOMER" | "PRO" | "ADMIN";
  createdAt: string;
  latestActivityAt: string;
  latestActivityLabel: string;
  professionalProfile: {
    isVerified: boolean;
    verificationStatus: string;
  } | null;
  cleaningOnboarding: {
    status: string;
  } | null;
};

type TeamPayload = {
  currentAdminId: string;
  admins: TeamAdminRow[];
  recentUsers: TeamUserRow[];
};

function roleLabel(role: TeamAdminRow["role"] | TeamUserRow["role"]) {
  if (role === "ADMIN") return "Admin";
  if (role === "PRO") return "Tasker";
  return "Cliente";
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("es-CL");
}

export default function AdminTeamPage() {
  const [data, setData] = useState<TeamPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [email, setEmail] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/team");
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

  const runAction = async (action: "grant" | "revoke", target: { userId?: string; email?: string }) => {
    setBusyId(target.userId || target.email || action);
    setError("");
    setFeedback("");
    try {
      const response = await fetch("/api/admin/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...target })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string; detail?: string; message?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.detail || payload.error || "No se pudo actualizar acceso");
      setFeedback(payload.message || "Acceso actualizado correctamente.");
      if (action === "grant") setEmail("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setBusyId("");
    }
  };

  return (
    <AdminHeroShell
      copy={
        <>
          <span className="auth-flow-kicker">Equipo interno</span>
          <h1>Administra accesos del backoffice con el mismo estilo de WeTask.</h1>
          <p>Invita administradores, revisa quién tiene acceso hoy y sigue la actividad más reciente de las cuentas que pasan por la plataforma.</p>

          <div className="auth-flow-copy-list admin-copy-list">
            <article className="auth-flow-meta-card">
              <strong>{data?.admins.length ?? 0} admins activos</strong>
              <span>Correos autorizados para entrar al panel privado y revisar validaciones.</span>
            </article>
            <article className="auth-flow-meta-card">
              <strong>{data?.recentUsers.length ?? 0} usuarios recientes</strong>
              <span>Actividad reciente para mantener visibilidad operativa del equipo.</span>
            </article>
          </div>

          <div className="auth-flow-inline-links">
            <Link href="/admin">Volver al backoffice</Link>
            <Link href="/admin/onboarding-limpieza">Ir a revisión manual</Link>
          </div>

          <div className="auth-flow-status">
            <strong>Acceso administrado por rol</strong>
            <span>Los cambios toman efecto en el próximo inicio de sesión de cada integrante.</span>
          </div>
        </>
      }
    >
      <div className="panel-head admin-page-head">
        <div>
          <span className="eyebrow">Backoffice WeTask</span>
          <h2>Equipo interno</h2>
          <p>Da acceso solo a tu equipo y revócalo cuando sea necesario. Los cambios toman efecto en el próximo inicio de sesión.</p>
        </div>
        <Link href="/admin" className="cta ghost small">
          Volver al panel
        </Link>
      </div>

      <section className="admin-section-card">
        <div className="admin-section-head">
          <div>
            <h3>Agregar admin por correo</h3>
            <p>La persona debe tener una cuenta ya creada en WeTask.</p>
          </div>
        </div>

        <div className="admin-team-form">
          <label>
            Correo del integrante
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="equipo@wetask.cl"
            />
          </label>
          <button
            type="button"
            className="cta"
            disabled={!email.trim() || busyId === email.trim().toLowerCase()}
            onClick={() => void runAction("grant", { email: email.trim().toLowerCase() })}
          >
            Dar acceso admin
          </button>
        </div>
      </section>

      {loading ? <p className="empty">Cargando equipo...</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}
      {feedback ? <p className="feedback ok">{feedback}</p> : null}

      <div className="admin-team-grid">
        <section className="admin-section-card">
          <div className="admin-section-head">
            <div>
              <h3>Admins activos</h3>
              <p>Estas son las personas que hoy pueden revisar profesionales y operar el backoffice.</p>
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
                    disabled={busyId === user.id}
                    onClick={() => void runAction("revoke", { userId: user.id })}
                  >
                    Quitar acceso
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-section-card">
          <div className="admin-section-head">
            <div>
              <h3>Usuarios recientes</h3>
              <p>Listado reciente con la última actividad de cada cuenta dentro de la plataforma.</p>
            </div>
          </div>

          <div className="admin-team-list">
            {data?.recentUsers.map((user) => (
              <article key={user.id} className="admin-team-row">
                <div>
                  <h4>{user.fullName}</h4>
                  <p>
                    {user.email} · {roleLabel(user.role)}
                  </p>
                  <p>
                    {user.cleaningOnboarding ? `Onboarding: ${user.cleaningOnboarding.status.toLowerCase()}` : "Sin onboarding"} ·{" "}
                    {user.professionalProfile ? `Perfil pro: ${user.professionalProfile.verificationStatus.toLowerCase()}` : "Cuenta cliente"}
                  </p>
                  <p>
                    Última actividad: {user.latestActivityLabel} · {dateLabel(user.latestActivityAt)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </AdminHeroShell>
  );
}
