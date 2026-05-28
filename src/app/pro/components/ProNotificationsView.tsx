"use client";

import type { Notification } from "../types";

export default function ProNotificationsView({ notifications }: { notifications: Notification[] }) {
  return (
    <section className="auth-flow-panel client-dashboard-section">
      <div className="panel-head client-dashboard-panel-head">
        <h2>Notificaciones</h2>
        <p>Mensajes y movimientos importantes de tu cuenta.</p>
      </div>
      <div className="list client-dashboard-list">
        {notifications.length === 0 ? (
          <p className="empty">Sin notificaciones por ahora.</p>
        ) : (
          notifications.map((item) => (
            <article className="booking-card client-dashboard-card" key={item.id}>
              <p>
                <strong>{item.title}</strong>
              </p>
              <p>{item.body}</p>
              <p>{new Date(item.createdAt).toLocaleString("es-CL")}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
