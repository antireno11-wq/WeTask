"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MarketNav } from "@/components/market-nav";

type SessionPayload = {
  userId: string;
  fullName?: string | null;
  role?: string | null;
};

type Notification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
};

function formatNotificationDate(value: string) {
  return new Date(value).toLocaleString("es-CL", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function NotificationsPage() {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const sessionResponse = await fetch("/api/auth/session");
        const sessionData = (await sessionResponse.json()) as { session?: SessionPayload | null };
        if (!sessionResponse.ok || !sessionData.session?.userId) {
          setSession(null);
          setNotifications([]);
          return;
        }

        setSession(sessionData.session);

        const notificationsResponse = await fetch("/api/marketplace/notifications");
        const notificationsData = (await notificationsResponse.json()) as {
          notifications?: Notification[];
          error?: string;
          detail?: string;
        };

        if (!notificationsResponse.ok) {
          throw new Error(notificationsData.detail || notificationsData.error || "No se pudieron cargar las notificaciones");
        }

        setNotifications(notificationsData.notifications ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inesperado");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const accountHref = useMemo(() => {
    if (session?.role === "PRO") return "/pro";
    if (session?.role === "CUSTOMER") return "/cliente";
    if (session?.role === "ADMIN") return "/admin";
    return "/ingresar";
  }, [session?.role]);

  const roleLabel = session?.role === "PRO" ? "Tasker" : session?.role === "CUSTOMER" ? "Cliente" : session?.role === "ADMIN" ? "Admin" : "";
  const latestNotification = notifications[0] ?? null;

  return (
    <main className="auth-flow-screen auth-flow-screen-scroll market-shell-auth">
      <div className="auth-flow-backdrop" aria-hidden />

      <div className="login-screen-content market-shell-auth-content">
        <MarketNav />

        <section className="auth-flow-shell auth-flow-shell-wide client-dashboard-hero">
          <div className="auth-flow-copy client-dashboard-copy">
            <p className="auth-flow-kicker">Notificaciones</p>
            <h1>Todo lo importante en un solo lugar</h1>
            <p>Revisa avisos sobre tus reservas, movimientos de cuenta y actualizaciones importantes sin tener que entrar a cada sección.</p>
          </div>

          <section className="auth-flow-panel auth-flow-panel-wide client-dashboard-profile-panel">
            <div className="panel-head client-dashboard-panel-head">
              <h2>Resumen rápido</h2>
              <p>{session ? `${session.fullName ?? "Tu cuenta"} · ${roleLabel}` : "Tu actividad reciente en WeTask."}</p>
            </div>

            <div className="client-booking-overview notifications-overview">
              <article className="module-card client-dashboard-metric">
                <h3>Total</h3>
                <p>{loading ? "..." : notifications.length}</p>
                <small>notificación(es)</small>
              </article>
              <article className="module-card client-dashboard-metric">
                <h3>Última</h3>
                <p>{latestNotification ? formatNotificationDate(latestNotification.createdAt) : "Sin avisos"}</p>
              </article>
              <article className="module-card client-dashboard-metric">
                <h3>Volver</h3>
                <p>{session?.role === "PRO" ? "Panel tasker" : session?.role === "CUSTOMER" ? "Panel cliente" : "Inicio de sesión"}</p>
              </article>
            </div>

            <div className="notifications-hero-actions">
              <Link href={accountHref} className="cta ghost small">
                {session?.role === "PRO" ? "Volver al panel tasker" : session?.role === "CUSTOMER" ? "Volver al panel cliente" : "Ir a acceder"}
              </Link>
            </div>
          </section>
        </section>

        <div className="page client-dashboard-sections">
          {error ? <p className="feedback error">{error}</p> : null}

          <section className="auth-flow-panel client-dashboard-section notifications-page-section">
            <div className="panel-head client-dashboard-panel-head">
              <h2>Centro de notificaciones</h2>
              <p>Mensajes ordenados por fecha, con lo más reciente primero.</p>
            </div>

            {!session && !loading ? (
              <div className="client-booking-note">
                <strong>Necesitas iniciar sesión</strong>
                <p>Entra como cliente o tasker para revisar tus notificaciones.</p>
                <div className="notifications-hero-actions">
                  <Link href="/ingresar/cliente" className="cta small">
                    Ingresar como cliente
                  </Link>
                  <Link href="/ingresar/tasker" className="cta ghost small">
                    Ingresar como tasker
                  </Link>
                </div>
              </div>
            ) : loading ? (
              <p className="empty">Cargando notificaciones...</p>
            ) : notifications.length === 0 ? (
              <p className="empty">Todavía no tienes notificaciones.</p>
            ) : (
              <div className="notifications-list">
                {notifications.map((item) => (
                  <article className="booking-card client-dashboard-card notification-card" key={item.id}>
                    <div className="notification-card-head">
                      <h3>{item.title}</h3>
                      <span>{formatNotificationDate(item.createdAt)}</span>
                    </div>
                    <p>{item.body}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
