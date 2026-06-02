"use client";

import type { Dispatch, SetStateAction } from "react";
import type { Booking } from "../types";
import { PRO_STATUS_LABELS, clp, formatBookingDate, statusOptions } from "../utils";

type Props = {
  bookings: Booking[];
  statusByBooking: Record<string, string>;
  setStatusByBooking: Dispatch<SetStateAction<Record<string, string>>>;
  updateStatus: (bookingId: string) => void;
  completeBooking: (bookingId: string) => void;
};

export default function ProReservasView({ bookings, statusByBooking, setStatusByBooking, updateStatus, completeBooking }: Props) {
  return (
    <section className="auth-flow-panel client-dashboard-section">
      <div className="panel-head client-dashboard-panel-head">
        <h2>Servicios</h2>
        <p>Revisa y actualiza el estado de tus reservas activas sin mezclarlo con reseñas ni payouts.</p>
      </div>

      <div className="list client-dashboard-list">
        {bookings.length === 0 ? (
          <p className="empty">Todavía no tienes servicios asignados.</p>
        ) : (
          bookings.map((booking) => (
            <article className="booking-card client-dashboard-card" key={booking.id}>
              <div className="booking-head">
                <h3>{booking.service.name}</h3>
                <span
                  className={`status ${
                    booking.status === "COMPLETED" ? "status-completed" : booking.status === "CANCELLED" ? "status-cancelled" : "status-accepted"
                  }`}
                >
                  {PRO_STATUS_LABELS[booking.status] ?? booking.status}
                </span>
              </div>
              <p className="client-booking-eyebrow">{booking.status === "COMPLETED" ? "Servicio realizado" : "Próxima atención"}</p>
              <p>
                <strong>Cliente:</strong> {booking.customer.fullName} ({booking.customer.email})
              </p>
              <p>
                <strong>Fecha:</strong> {formatBookingDate(booking.scheduledAt)}
              </p>
              <p>
                <strong>Total:</strong> {clp(booking.totalPriceClp)}
              </p>
              <div className="status-editor">
                <label>
                  Estado
                  <select
                    value={statusByBooking[booking.id] ?? booking.status}
                    onChange={(e) => setStatusByBooking((prev) => ({ ...prev, [booking.id]: e.target.value }))}
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {PRO_STATUS_LABELS[status] ?? status}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="cta small" type="button" onClick={() => updateStatus(booking.id)}>
                  Guardar estado
                </button>
                <button className="cta ghost small" type="button" onClick={() => completeBooking(booking.id)}>
                  Finalizar
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
