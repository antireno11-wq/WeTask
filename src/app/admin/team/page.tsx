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
  page: number;
  pageSize: number;
  totalRecentUsers: number;
  totalPages: number;
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
  const [existingEmail, setExistingEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [deleteEmail, setDeleteEmail] = useState("");
  const [busyId, setBusyId] = useState("");
  const [page, setPage] = useState(1);

  const load = async (nextPage = page) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/team?page=${nextPage}&pageSize=5`);
      const payload = (await response.json()) as TeamPayload & { error?: string; detail?: string };
      if (!response.ok) throw new Error(payload.detail || payload.error || "No se pudo cargar el equipo");
      setData(payload);
      setPage(payload.page);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const runAction = async (
    action: "grant" | "revoke" | "delete_user" | "create_admin",
    target: { userId?: string; email?: string; fullName?: string; password?: string }
  ) => {
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
      if (action === "grant") setExistingEmail("");
      if (action === "create_admin") {
        setEmail("");
        setFullName("");
        setPassword("");
      }
      if (action === "delete_user") setDeleteEmail("");
      await load(page);
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
          <p>Da acceso solo a tu equipo y revócalo cuando sea necesario. Los cambios toman efecto en el próximo inicio de sesión.</p>
        </div>
        <Link href="/admin" className="cta ghost small admin-head-action">
          Volver al panel
        </Link>
      </div>

      <section className="admin-section-card">
        <div className="admin-section-head">
          <div>
            <h3>Crear otro administrador</h3>
            <p>Crea un administrador nuevo desde cero o usa el correo de alguien existente para darle acceso.</p>
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

        <div className="admin-team-form admin-team-form-secondary">
          <label>
            Dar acceso a cuenta existente
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

      <section className="admin-section-card">
        <div className="admin-section-head">
          <div>
            <h3>Eliminar usuario por correo</h3>
            <p>Borra cuentas de prueba cliente o tasker que no tengan reservas ni actividad asociada.</p>
          </div>
        </div>

        <div className="admin-team-form">
          <label>
            Correo a eliminar
            <input
              type="email"
              value={deleteEmail}
              onChange={(event) => setDeleteEmail(event.target.value)}
              placeholder="antireno11@gmail.com"
            />
          </label>
          <button
            type="button"
            className="cta ghost"
            disabled={!deleteEmail.trim() || busyId === deleteEmail.trim().toLowerCase()}
            onClick={() => void runAction("delete_user", { email: deleteEmail.trim().toLowerCase() })}
          >
            Eliminar usuario
          </button>
        </div>

        <p className="feedback warn">
          Este borrado rápido no elimina admins ni cuentas con reservas, mensajes, pagos o actividad real asociada.
        </p>
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
              <h3>Usuarios de la plataforma</h3>
              <p>Mostrando 5 por página para revisar actividad y limpiar cuentas internas sin llenar la pantalla.</p>
            </div>
            <span className="status status-approved">{data?.totalRecentUsers ?? 0} usuarios</span>
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
                <div className="cta-row admin-team-row-actions">
                  {user.role === "ADMIN" ? <span className="status status-approved">Admin</span> : null}
                  {user.role !== "ADMIN" ? (
                    <button
                      type="button"
                      className="cta ghost small"
                      disabled={busyId === user.id}
                      onClick={() => void runAction("delete_user", { userId: user.id })}
                    >
                      Eliminar usuario
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          <div className="admin-pagination">
            <button type="button" className="cta ghost small" disabled={loading || page <= 1} onClick={() => void load(page - 1)}>
              Anterior
            </button>
            <span className="admin-pagination-copy">
              Página {data?.page ?? page} de {data?.totalPages ?? 1}
            </span>
            <button
              type="button"
              className="cta ghost small"
              disabled={loading || page >= (data?.totalPages ?? 1)}
              onClick={() => void load(page + 1)}
            >
              Siguiente
            </button>
          </div>
        </section>
      </div>
    </AdminHeroShell>
  );
}
