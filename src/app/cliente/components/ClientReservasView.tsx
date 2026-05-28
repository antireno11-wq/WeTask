"use client";

import Link from "next/link";
import type { Booking } from "../types";
import { bookingEyebrow, clp, formatBookingDate, statusClassByBooking, statusLabelByBooking } from "../utils";

export default function ClientReservasView({ bookings }: { bookings: Booking[] }) {
  return (
    <section className="auth-flow-panel client-dashboard-section">
      <div className="panel-head client-dashboard-panel-head">
        <h2>Servicios</h2>
        <p>Estado y detalle de tus reservas activas e históricas.</p>
      </div>
      <div className="list client-dashboard-list">
        {bookings.length === 0 ? (
          <p className="empty">Todavía no tienes reservas. Cuando hagas la primera, aparecerá aquí.</p>
        ) : (
          bookings.map((booking) => (
            <article className="booking-card client-dashboard-card" key={booking.id}>
              <div className="booking-head">
                <h3>{booking.service.name}</h3>
                <span className={`status ${statusClassByBooking(booking.status)}`}>
                  {statusLabelByBooking(booking.status)}
                </span>
              </div>
              <p className="client-booking-eyebrow">{bookingEyebrow(booking.status, booking.scheduledAt)}</p>
              <p>
                <strong>Pago protegido:</strong>{" "}
                {booking.status === "COMPLETED"
                  ? "cerrado o liberado"
                  : booking.status === "CANCELLED" || booking.status === "REFUNDED"
                    ? "resuelto"
                    : "retenido hasta tu confirmación o hasta que venza el plazo sin reclamo"}
              </p>
              <p>
                <strong>Fecha:</strong> {formatBookingDate(booking.scheduledAt)}
              </p>
              <p>
                <strong>Profesional:</strong> {booking.pro?.fullName ?? "Pendiente"}
              </p>
              <p>
                <strong>Ubicación:</strong> {[booking.addressLine1, booking.comuna, booking.city].filter(Boolean).join(", ")}
              </p>
              <p>
                <strong>Total:</strong> {clp(booking.totalPriceClp)}
              </p>
              {booking.review?.id ? (
                <p className="client-booking-review-line">
                  <strong>Valoración:</strong> {booking.review.rating}/5 estrellas
                </p>
              ) : null}
              <div className="booking-actions">
                <Link className="cta small" href={`/cliente/reservas/${booking.id}`}>
                  Ver servicio
                </Link>
                {booking.status === "COMPLETED" ? (
                  booking.review?.id ? (
                    <button type="button" className="cta small cta-rating done" disabled>
                      Valorado
                    </button>
                  ) : (
                    <Link className="cta small cta-rating" href={`/cliente/reservas/${booking.id}`}>
                      Valorar
                    </Link>
                  )
                ) : null}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
