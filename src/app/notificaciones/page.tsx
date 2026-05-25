"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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
  isRead: boolean;
  createdAt: string;
  bookingId: string | null;
};

type TabKey = "all" | "unread";

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
  const [sessionLoading, setSessionLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  // Cargar sesión
  useEffect(() => {
    const loadSession = async () => {
      try {
        const response = await fetch("/api/auth/session");
        const data = (await response.json()) as { session?: SessionPayload | null };
        setSession(data.session ?? null);
      } catch {
        setSession(null);
      } finally {
        setSessionLoading(false);
      }
    };
    void loadSession();
  }, []);

  const load = useCallback(
    async (options?: { cursor?: string | null; append?: boolean; activeTab?: TabKey }) => {
      if (!session?.userId) return;
      const cursor = options?.cursor ?? null;
      const append = Boolean(options?.append);
      const activeTab = options?.activeTab ?? tab;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (activeTab === "unread") params.set("unread", "true");
        if (cursor) params.set("cursor", cursor);
        const response = await fetch(`/api/marketplace/notifications?${params.toString()}`);
        const data = (await response.json()) as {
          notifications?: Notification[];
          unreadCount?: number;
          nextCursor?: string | null;
          error?: string;
          detail?: string;
        };
        if (!response.ok || !data.notifications) {
          throw new Error(data.detail || data.error || "No se pudieron cargar las notificaciones");
        }
        setNotifications((current) => (append ? [...current, ...data.notifications!] : data.notifications!));
        setUnreadCount(data.unreadCount ?? 0);
        setNextCursor(data.nextCursor ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inesperado");
      } finally {
        if (append) setLoadingMore(false);
        else setLoading(false);
      }
    },
    [session?.userId, tab]
  );

  // Cargar notifs cuando hay sesión o cambia tab
  useEffect(() => {
    if (!session?.userId) return;
    void load();
  }, [session?.userId, tab, load]);

  // Marcar como leídas las notifs visibles tras ~2s en la página
  useEffect(() => {
    if (!session?.userId) return;
    if (notifications.length === 0) return;
    const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n.id);
    if (unreadIds.length === 0) return;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/marketplace/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "markAsRead", notificationIds: unreadIds })
        });
        if (response.ok) {
          setNotifications((current) => current.map((n) => (unreadIds.includes(n.id) ? { ...n, isRead: true } : n)));
          setUnreadCount((current) => Math.max(0, current - unreadIds.length));
        }
      } catch {
        // silencioso
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [notifications, session?.userId]);

  const markAllAsRead = async () => {
    try {
      const response = await fetch("/api/marketplace/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markAllAsRead" })
      });
      if (response.ok) {
        setNotifications((current) => current.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch {
      // silencioso
    }
  };

  const roleLabel = session?.role === "PRO" ? "Tasker" : session?.role === "CUSTOMER" ? "Cliente" : session?.role === "ADMIN" ? "Admin" : "";

  return (
    <main className="auth-flow-screen auth-flow-screen-scroll market-shell-auth">
      <div className="auth-flow-backdrop" aria-hidden />

      <div className="login-screen-content market-shell-auth-content">
        <MarketNav />

        <section className="auth-flow-shell auth-flow-shell-wide client-dashboard-hero">
          <div className="auth-flow-copy client-dashboard-copy">
            <p className="auth-flow-kicker">Notificaciones</p>
            <h1>Todo lo importante en un solo lugar</h1>
            <p>Revisa avisos sobre tus reservas, movimientos y actualizaciones importantes en un solo feed.</p>
          </div>

          <section className="auth-flow-panel auth-flow-panel-wide client-dashboard-profile-panel">
            <div className="panel-head client-dashboard-panel-head">
              <h2>Resumen</h2>
              <p>{session ? `${session.fullName ?? "Tu cuenta"} · ${roleLabel}` : "Tu actividad reciente en WeTask."}</p>
            </div>

            <div className="client-booking-overview notifications-overview">
              <article className="module-card client-dashboard-metric">
                <h3>Sin leer</h3>
                <p>{loading ? "..." : unreadCount}</p>
                <small>notificación(es)</small>
              </article>
              <article className="module-card client-dashboard-metric">
                <h3>Total visible</h3>
                <p>{loading ? "..." : notifications.length}</p>
                <small>en este filtro</small>
              </article>
            </div>
          </section>
        </section>

        <div className="page client-dashboard-sections">
          {error ? <p className="feedback error">{error}</p> : null}

          <section className="auth-flow-panel client-dashboard-section notifications-page-section">
            <div className="panel-head client-dashboard-panel-head">
              <h2>Centro de notificaciones</h2>
              <p>Las nuevas se marcan como leídas automáticamente al verlas.</p>
            </div>

            {sessionLoading ? (
              <p className="empty">Cargando sesión...</p>
            ) : !session ? (
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
            ) : (
              <>
                <div className="cta-row" style={{ marginBottom: 18, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className={`cta small ${tab === "all" ? "" : "ghost"}`}
                    onClick={() => setTab("all")}
                  >
                    Todas
                  </button>
                  <button
                    type="button"
                    className={`cta small ${tab === "unread" ? "" : "ghost"}`}
                    onClick={() => setTab("unread")}
                  >
                    No leídas {unreadCount > 0 ? `(${unreadCount})` : ""}
                  </button>
                  {unreadCount > 0 ? (
                    <button type="button" className="cta ghost small" onClick={() => void markAllAsRead()}>
                      Marcar todas como leídas
                    </button>
                  ) : null}
                </div>

                {loading ? (
                  <p className="empty">Cargando notificaciones...</p>
                ) : notifications.length === 0 ? (
                  <p className="empty">
                    {tab === "unread" ? "No tienes notificaciones sin leer." : "Todavía no tienes notificaciones."}
                  </p>
                ) : (
                  <>
                    <div className="notifications-list">
                      {notifications.map((item) => (
                        <article
                          className="booking-card client-dashboard-card notification-card"
                          key={item.id}
                          style={
                            item.isRead
                              ? undefined
                              : { borderLeft: "4px solid #18a6d5", background: "#f4f8fd" }
                          }
                        >
                          <div className="notification-card-head">
                            <h3>
                              {item.isRead ? null : (
                                <span
                                  aria-label="No leída"
                                  style={{
                                    display: "inline-block",
                                    width: 8,
                                    height: 8,
                                    borderRadius: 999,
                                    background: "#18a6d5",
                                    marginRight: 8,
                                    verticalAlign: "middle"
                                  }}
                                />
                              )}
                              {item.title}
                            </h3>
                            <span>{formatNotificationDate(item.createdAt)}</span>
                          </div>
                          <p>{item.body}</p>
                          {item.bookingId ? (
                            <div className="cta-row" style={{ marginTop: 12 }}>
                              <Link
                                href={
                                  session.role === "PRO"
                                    ? `/pro/reservas/${item.bookingId}`
                                    : `/cliente/reservas/${item.bookingId}`
                                }
                                className="cta ghost small"
                              >
                                Ver reserva
                              </Link>
                            </div>
                          ) : null}
                        </article>
                      ))}
                    </div>

                    {nextCursor ? (
                      <div className="cta-row" style={{ justifyContent: "center", marginTop: 24 }}>
                        <button
                          type="button"
                          className="cta ghost"
                          onClick={() => void load({ cursor: nextCursor, append: true })}
                          disabled={loadingMore}
                        >
                          {loadingMore ? "Cargando..." : "Cargar más"}
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
