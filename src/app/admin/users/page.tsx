"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminHeroShell } from "@/components/admin-hero-shell";

export const dynamic = "force-dynamic";

type TeamUserRow = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: "CUSTOMER" | "PRO" | "ADMIN";
  roleAssignments: Array<{ code: "CUSTOMER" | "PRO" | "ADMIN"; label: string }>;
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

type UserListPayload = {
  page: number;
  totalPages: number;
  totalRecentUsers: number;
  recentUsers: TeamUserRow[];
};

function assignmentLabelList(roleAssignments: Array<{ code: "CUSTOMER" | "PRO" | "ADMIN"; label: string }>, fallbackRole: TeamUserRow["role"]) {
  if (roleAssignments.length > 0) return roleAssignments.map((role) => role.label).join(", ");
  if (fallbackRole === "PRO") return "Tasker";
  if (fallbackRole === "ADMIN") return "Admin";
  return "Cliente";
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("es-CL");
}

function isApprovedTasker(user: TeamUserRow) {
  return Boolean(
    user.professionalProfile?.isVerified ||
      user.professionalProfile?.verificationStatus === "APPROVED" ||
      user.cleaningOnboarding?.status === "APROBADO" ||
      user.cleaningOnboarding?.status === "ACTIVO"
  );
}

export default function AdminUsersPage() {
  const [taskers, setTaskers] = useState<UserListPayload | null>(null);
  const [customers, setCustomers] = useState<UserListPayload | null>(null);
  const [taskerPage, setTaskerPage] = useState(1);
  const [customerPage, setCustomerPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [deleteEmail, setDeleteEmail] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = async (nextTaskerPage = taskerPage, nextCustomerPage = customerPage) => {
    setLoading(true);
    setError("");
    try {
      const [taskersResponse, customersResponse] = await Promise.all([
        fetch(`/api/admin/team?page=${nextTaskerPage}&pageSize=5&roleFilter=taskers`),
        fetch(`/api/admin/team?page=${nextCustomerPage}&pageSize=5&roleFilter=customers`)
      ]);

      const taskersPayload = (await taskersResponse.json()) as UserListPayload & { error?: string; detail?: string };
      const customersPayload = (await customersResponse.json()) as UserListPayload & { error?: string; detail?: string };

      if (!taskersResponse.ok) throw new Error(taskersPayload.detail || taskersPayload.error || "No se pudieron cargar taskers");
      if (!customersResponse.ok) throw new Error(customersPayload.detail || customersPayload.error || "No se pudieron cargar clientes");

      setTaskers(taskersPayload);
      setCustomers(customersPayload);
      setTaskerPage(taskersPayload.page);
      setCustomerPage(customersPayload.page);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const deleteUser = async (target: { userId?: string; email?: string }) => {
    const currentBusyId = target.userId || target.email || "delete";
    setBusyId(currentBusyId);
    setError("");
    setFeedback("");
    try {
      const response = await fetch("/api/admin/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_user", ...target })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string; detail?: string; message?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.detail || payload.error || "No se pudo eliminar el usuario");
      setFeedback(payload.message || "Usuario eliminado.");
      if (target.email) setDeleteEmail("");
      await load(taskerPage, customerPage);
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
          <h2>Usuarios de la plataforma</h2>
          <p>Revisa taskers y clientes por separado, con su actividad reciente y herramientas rápidas de limpieza interna.</p>
        </div>
        <div className="cta-row">
          <Link href="/admin/team" className="cta ghost small">
            Equipo interno
          </Link>
          <Link href="/admin/team/new" className="cta">
            Gestionar administradores
          </Link>
        </div>
      </div>

      <section className="admin-section-card">
        <div className="admin-section-head">
          <div>
            <h3>Eliminar usuario por correo</h3>
            <p>Borra cuentas de prueba que no tengan reservas, mensajes, pagos ni actividad real asociada.</p>
          </div>
        </div>

        <div className="admin-team-form">
          <label>
            Correo a eliminar
            <input
              type="email"
              value={deleteEmail}
              onChange={(event) => setDeleteEmail(event.target.value)}
              placeholder="usuario@wetask.cl"
            />
          </label>
          <button
            type="button"
            className="cta ghost"
            disabled={!deleteEmail.trim() || busyId === deleteEmail.trim().toLowerCase()}
            onClick={() => void deleteUser({ email: deleteEmail.trim().toLowerCase() })}
          >
            Eliminar usuario
          </button>
        </div>

        <p className="feedback warn">Este borrado rápido no elimina admins ni cuentas con actividad real asociada.</p>
      </section>

      {loading ? <p className="empty">Cargando usuarios...</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}
      {feedback ? <p className="feedback ok">{feedback}</p> : null}

      <div className="admin-users-grid">
        <section className="admin-section-card">
          <div className="admin-section-head">
            <div>
              <h3>Taskers</h3>
              <p>Cuentas que trabajan o están en proceso de trabajar en WeTask.</p>
            </div>
            <span className="status status-approved">{taskers?.totalRecentUsers ?? 0} taskers</span>
          </div>

          <div className="admin-team-list">
            {taskers?.recentUsers.map((user) => (
              <article key={user.id} className="admin-team-row">
                <div className="admin-team-row-copy">
                  <h4>{user.fullName}</h4>
                  <div className="admin-email-row">
                    <span className="admin-email-chip">{user.email}</span>
                  </div>
                  <p>{assignmentLabelList(user.roleAssignments, user.role)}</p>
                  <div className="admin-user-meta-row">
                    <span className={`admin-approval-chip ${isApprovedTasker(user) ? "approved" : "pending"}`}>
                      <span aria-hidden>{isApprovedTasker(user) ? "✓" : "•"}</span>
                      {isApprovedTasker(user) ? "Aprobado" : "Pendiente"}
                    </span>
                  </div>
                </div>
                <div className="cta-row admin-team-row-actions">
                  <Link href={`/admin/users/${user.id}`} className="cta ghost small">
                    Ver perfil
                  </Link>
                  {!user.roleAssignments.some((role) => role.code === "ADMIN") ? (
                    <button
                      type="button"
                      className="cta ghost small"
                      disabled={busyId === user.id}
                      onClick={() => void deleteUser({ userId: user.id })}
                    >
                      Eliminar usuario
                    </button>
                  ) : (
                    <span className="status status-approved">Admin</span>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="admin-pagination">
            <button type="button" className="cta ghost small" disabled={loading || taskerPage <= 1} onClick={() => void load(taskerPage - 1, customerPage)}>
              Anterior
            </button>
            <span className="admin-pagination-copy">
              Página {taskers?.page ?? taskerPage} de {taskers?.totalPages ?? 1}
            </span>
            <button
              type="button"
              className="cta ghost small"
              disabled={loading || taskerPage >= (taskers?.totalPages ?? 1)}
              onClick={() => void load(taskerPage + 1, customerPage)}
            >
              Siguiente
            </button>
          </div>
        </section>

        <section className="admin-section-card">
          <div className="admin-section-head">
            <div>
              <h3>Clientes</h3>
              <p>Cuentas cliente con actividad reciente dentro de la plataforma.</p>
            </div>
            <span className="status status-approved">{customers?.totalRecentUsers ?? 0} clientes</span>
          </div>

          <div className="admin-team-list">
            {customers?.recentUsers.map((user) => (
              <article key={user.id} className="admin-team-row">
                <div className="admin-team-row-copy">
                  <h4>{user.fullName}</h4>
                  <div className="admin-email-row">
                    <span className="admin-email-chip">{user.email}</span>
                  </div>
                  <p>{assignmentLabelList(user.roleAssignments, user.role)}</p>
                </div>
                <div className="cta-row admin-team-row-actions">
                  <Link href={`/admin/users/${user.id}`} className="cta ghost small">
                    Ver perfil
                  </Link>
                  {!user.roleAssignments.some((role) => role.code === "ADMIN") ? (
                    <button
                      type="button"
                      className="cta ghost small"
                      disabled={busyId === user.id}
                      onClick={() => void deleteUser({ userId: user.id })}
                    >
                      Eliminar usuario
                    </button>
                  ) : (
                    <span className="status status-approved">Admin</span>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="admin-pagination">
            <button type="button" className="cta ghost small" disabled={loading || customerPage <= 1} onClick={() => void load(taskerPage, customerPage - 1)}>
              Anterior
            </button>
            <span className="admin-pagination-copy">
              Página {customers?.page ?? customerPage} de {customers?.totalPages ?? 1}
            </span>
            <button
              type="button"
              className="cta ghost small"
              disabled={loading || customerPage >= (customers?.totalPages ?? 1)}
              onClick={() => void load(taskerPage, customerPage + 1)}
            >
              Siguiente
            </button>
          </div>
        </section>
      </div>
    </AdminHeroShell>
  );
}
