"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminHeroShell } from "@/components/admin-hero-shell";
import { formatPaymentRejectionReason } from "@/lib/payment-rejection";

export const dynamic = "force-dynamic";

type UserDetailPayload = {
  user: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    role: "CUSTOMER" | "PRO" | "ADMIN";
    roleLabel: string;
    authProvider: string;
    createdAt: string;
    updatedAt: string;
    termsAcceptedAt: string | null;
    emailVerifiedAt: string | null;
    roleAssignments: Array<{ code: "CUSTOMER" | "PRO" | "ADMIN"; label: string }>;
    addresses: Array<{
      id: string;
      label: string | null;
      street: string;
      city: string;
      postalCode: string;
      region: string | null;
      country: string;
      updatedAt: string;
    }>;
    _count: {
      bookings: number;
      proBookings: number;
      notifications: number;
      paymentMethods: number;
    };
    bookings: Array<{
      id: string;
      updatedAt: string;
      scheduledAt: string;
      status: string;
      totalPriceClp: number;
      paymentStatus: string;
      payment: {
        providerStatus: string | null;
        errorCode: string | null;
        errorMessage: string | null;
      } | null;
      service: { name: string };
    }>;
    proBookings: Array<{
      id: string;
      updatedAt: string;
      scheduledAt: string;
      status: string;
      totalPriceClp: number;
      paymentStatus: string;
      payment: {
        providerStatus: string | null;
        errorCode: string | null;
        errorMessage: string | null;
      } | null;
      service: { name: string };
    }>;
    notifications: Array<{
      id: string;
      title: string;
      body: string;
      createdAt: string;
      isRead: boolean;
    }>;
    professionalProfile: {
      id: string;
      avatarUrl: string | null;
      bio: string | null;
      isVerified: boolean;
      verificationStatus: string;
      coverageStreet: string | null;
      coverageComuna: string | null;
      coverageCity: string | null;
      hourlyRateFromClp: number | null;
      taskerServices: Array<{
        priceClp: number;
        service: { id: string; name: string };
      }>;
    } | null;
    cleaningOnboarding: {
      status: string;
      categorySlug: string | null;
      baseCommune: string | null;
      serviceCommunes: unknown;
      profilePhotoUrl: string | null;
      submittedAt: string | null;
    } | null;
  };
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("es-CL");
}

function clp(value?: number | null) {
  if (!value) return "-";
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

function communeListLabel(value: unknown) {
  if (!Array.isArray(value)) return "-";
  const items = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return items.length > 0 ? items.join(", ") : "-";
}

function roleLabelList(roleAssignments: Array<{ label: string }>, fallback: string) {
  return roleAssignments.length > 0 ? roleAssignments.map((role) => role.label).join(", ") : fallback;
}

export default function AdminUserProfilePage({ params }: { params: { userId: string } }) {
  const [payload, setPayload] = useState<UserDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/admin/users/${params.userId}`);
        const data = (await response.json()) as UserDetailPayload & { error?: string };
        if (!response.ok || !data.user) throw new Error(data.error || "No se pudo cargar el perfil del usuario");
        if (!cancelled) setPayload(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error inesperado");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [params.userId]);

  const user = payload?.user;

  return (
    <AdminHeroShell>
      <div className="panel-head admin-page-head">
        <div>
          <span className="eyebrow">Backoffice WeTask</span>
          <h2>Ficha de usuario</h2>
          <p>Resumen completo del usuario seleccionado dentro de la plataforma.</p>
        </div>
        <div className="cta-row">
          <Link href="/admin/users" className="cta ghost small">
            Volver a usuarios
          </Link>
        </div>
      </div>

      {loading ? <p className="empty">Cargando perfil...</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}

      {user ? (
        <div className="admin-detail-grid">
          <section className="admin-section-card">
            <div className="admin-section-head">
              <div>
                <h3>{user.fullName}</h3>
                <p>{user.email}</p>
              </div>
              <span className="status status-approved">{roleLabelList(user.roleAssignments, user.roleLabel)}</span>
            </div>
            <div className="admin-user-facts">
              <p>
                <strong>Teléfono:</strong> {user.phone || "Sin teléfono"}
              </p>
              <p>
                <strong>Proveedor de acceso:</strong> {user.authProvider}
              </p>
              <p>
                <strong>Creado:</strong> {formatDate(user.createdAt)}
              </p>
              <p>
                <strong>Última actualización:</strong> {formatDate(user.updatedAt)}
              </p>
              <p>
                <strong>Correo verificado:</strong> {user.emailVerifiedAt ? formatDate(user.emailVerifiedAt) : "No"}
              </p>
              <p>
                <strong>Términos aceptados:</strong> {user.termsAcceptedAt ? formatDate(user.termsAcceptedAt) : "No"}
              </p>
            </div>
          </section>

          <section className="admin-section-card">
            <div className="admin-section-head">
              <div>
                <h3>Actividad</h3>
                <p>Conteos rápidos asociados a la cuenta.</p>
              </div>
            </div>
            <div className="admin-user-facts">
              <p>
                <strong>Reservas como cliente:</strong> {user._count.bookings}
              </p>
              <p>
                <strong>Reservas como tasker:</strong> {user._count.proBookings}
              </p>
              <p>
                <strong>Notificaciones:</strong> {user._count.notifications}
              </p>
              <p>
                <strong>Medios de pago:</strong> {user._count.paymentMethods}
              </p>
            </div>
          </section>

          <section className="admin-section-card">
            <div className="admin-section-head">
              <div>
                <h3>Direcciones</h3>
                <p>Últimas direcciones guardadas en la cuenta.</p>
              </div>
            </div>
            <div className="admin-team-list">
              {user.addresses.length === 0 ? (
                <p className="empty">Sin direcciones guardadas.</p>
              ) : (
                user.addresses.map((address) => (
                  <article key={address.id} className="admin-team-row">
                    <div>
                      <h4>{address.label || "Dirección guardada"}</h4>
                      <p>{[address.street, address.city, address.region, address.country].filter(Boolean).join(", ")}</p>
                      <p>Código postal: {address.postalCode || "-"}</p>
                    </div>
                    <div className="admin-team-row-actions">
                      <span className="status status-pending">{formatDate(address.updatedAt)}</span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="admin-section-card">
            <div className="admin-section-head">
              <div>
                <h3>Perfil tasker</h3>
                <p>Visible si esta cuenta también trabaja en la plataforma.</p>
              </div>
            </div>
            {user.professionalProfile ? (
              <div className="admin-user-facts">
                <p>
                  <strong>Estado del perfil:</strong> {user.professionalProfile.verificationStatus}
                </p>
                <p>
                  <strong>Verificado:</strong> {user.professionalProfile.isVerified ? "Sí" : "No"}
                </p>
                <p>
                  <strong>Tarifa desde:</strong> {clp(user.professionalProfile.hourlyRateFromClp)}
                </p>
                <p>
                  <strong>Cobertura base:</strong>{" "}
                  {[user.professionalProfile.coverageStreet, user.professionalProfile.coverageComuna, user.professionalProfile.coverageCity]
                    .filter(Boolean)
                    .join(", ") || "-"}
                </p>
                <p>
                  <strong>Servicios:</strong>{" "}
                  {user.professionalProfile.taskerServices.length > 0
                    ? user.professionalProfile.taskerServices.map((item) => item.service.name).join(", ")
                    : "Sin servicios activos"}
                </p>
                <p>
                  <strong>Bio:</strong> {user.professionalProfile.bio || "Sin bio"}
                </p>
                {user.role === "PRO" ? (
                  <div className="cta-row">
                    <Link href={`/pro/${user.id}`} className="cta ghost small">
                      Ver perfil público
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="empty">Esta cuenta no tiene perfil tasker.</p>
            )}
          </section>

          <section className="admin-section-card">
            <div className="admin-section-head">
              <div>
                <h3>Onboarding tasker</h3>
                <p>Estado del onboarding si la cuenta pasó por ese flujo.</p>
              </div>
            </div>
            {user.cleaningOnboarding ? (
              <div className="admin-user-facts">
                <p>
                  <strong>Estado:</strong> {user.cleaningOnboarding.status}
                </p>
                <p>
                  <strong>Categoría:</strong> {user.cleaningOnboarding.categorySlug || "-"}
                </p>
                <p>
                  <strong>Comuna base:</strong> {user.cleaningOnboarding.baseCommune || "-"}
                </p>
                <p>
                  <strong>Comunas de servicio:</strong> {communeListLabel(user.cleaningOnboarding.serviceCommunes)}
                </p>
                <p>
                  <strong>Enviado a revisión:</strong> {formatDate(user.cleaningOnboarding.submittedAt)}
                </p>
              </div>
            ) : (
              <p className="empty">No tiene onboarding tasker asociado.</p>
            )}
          </section>

          <section className="admin-section-card">
            <div className="admin-section-head">
              <div>
                <h3>Últimas reservas</h3>
                <p>Actividad reciente como cliente y como tasker.</p>
              </div>
            </div>
            <div className="admin-team-list">
              {[...user.bookings.map((booking) => ({ ...booking, kind: "cliente" as const })), ...user.proBookings.map((booking) => ({ ...booking, kind: "tasker" as const }))].length === 0 ? (
                <p className="empty">Sin reservas registradas.</p>
              ) : (
                [...user.bookings.map((booking) => ({ ...booking, kind: "cliente" as const })), ...user.proBookings.map((booking) => ({ ...booking, kind: "tasker" as const }))]
                  .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                  .slice(0, 6)
                  .map((booking) => (
                    <article key={`${booking.kind}-${booking.id}`} className="admin-team-row">
                      <div>
                        <h4>{booking.service.name}</h4>
                        <p>Rol: {booking.kind}</p>
                        <p>Estado: {booking.status}</p>
                        <p>Fecha: {formatDate(booking.scheduledAt)}</p>
                        {booking.paymentStatus === "FAILED" || booking.status === "PAYMENT_FAILED" ? (
                          <p>
                            <strong>Motivo rechazo:</strong>{" "}
                            {formatPaymentRejectionReason({
                              errorCode: booking.payment?.errorCode,
                              errorMessage: booking.payment?.errorMessage,
                              providerStatus: booking.payment?.providerStatus
                            }).friendly || "Pago rechazado por el proveedor"}
                            {booking.payment?.errorCode ? ` (${booking.payment.errorCode})` : ""}
                          </p>
                        ) : null}
                      </div>
                      <div className="admin-team-row-actions">
                        <span className="status status-approved">{clp(booking.totalPriceClp)}</span>
                      </div>
                    </article>
                  ))
              )}
            </div>
          </section>

          <section className="admin-section-card">
            <div className="admin-section-head">
              <div>
                <h3>Notificaciones recientes</h3>
                <p>Últimos avisos enviados a esta cuenta.</p>
              </div>
            </div>
            <div className="admin-team-list">
              {user.notifications.length === 0 ? (
                <p className="empty">Sin notificaciones recientes.</p>
              ) : (
                user.notifications.map((notification) => (
                  <article key={notification.id} className="admin-team-row">
                    <div>
                      <h4>{notification.title}</h4>
                      <p>{notification.body}</p>
                    </div>
                    <div className="admin-team-row-actions">
                      <span className={`status ${notification.isRead ? "status-approved" : "status-pending"}`}>
                        {notification.isRead ? "Leída" : "No leída"}
                      </span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      ) : null}
    </AdminHeroShell>
  );
}
