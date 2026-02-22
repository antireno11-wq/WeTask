"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";

type BookingStatus = "PENDING" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

type Service = {
  id: string;
  slug: string;
  name: string;
  description: string;
  basePriceClp: number;
  durationMin: number;
};

type PublicBooking = {
  id: string;
  status: BookingStatus;
  scheduledAt: string;
  addressLine1: string;
  comuna: string;
  region: string;
  notes: string | null;
  totalPriceClp: number;
  createdAt: string;
  service: {
    id: string;
    name: string;
    slug: string;
  };
  pro: {
    id: string;
    fullName: string;
  } | null;
};

const statusLabel: Record<BookingStatus, string> = {
  PENDING: "Pendiente",
  ACCEPTED: "Aceptada",
  IN_PROGRESS: "En progreso",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada"
};

function toIsoOrNull(datetimeLocal: string): string | null {
  if (!datetimeLocal) return null;
  const date = new Date(datetimeLocal);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatPriceClp(value: number): string {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" });
}

export default function HomePage() {
  const [services, setServices] = useState<Service[]>([]);
  const [bookings, setBookings] = useState<PublicBooking[]>([]);

  const [loadingServices, setLoadingServices] = useState(true);
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [requestForm, setRequestForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    serviceId: "",
    scheduledAt: "",
    addressLine1: "",
    comuna: "",
    region: "Metropolitana",
    notes: ""
  });

  const [trackingEmail, setTrackingEmail] = useState("");

  const selectedService = useMemo(
    () => services.find((service) => service.id === requestForm.serviceId) ?? null,
    [services, requestForm.serviceId]
  );

  useEffect(() => {
    const loadServices = async () => {
      try {
        setLoadingServices(true);
        const response = await fetch("/api/services");
        const data = (await response.json()) as { services?: Service[]; error?: string; detail?: string };

        if (!response.ok || !data.services) {
          throw new Error(data.detail || data.error || "No se pudieron cargar los servicios");
        }

        setServices(data.services);
        if (data.services.length > 0) {
          setRequestForm((prev) => ({ ...prev, serviceId: prev.serviceId || data.services![0].id }));
        }
      } catch (requestError) {
        const detail = requestError instanceof Error ? requestError.message : "Error inesperado";
        setError(detail);
      } finally {
        setLoadingServices(false);
      }
    };

    loadServices();
  }, []);

  const handleSubmitBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setError("");

    const scheduledAt = toIsoOrNull(requestForm.scheduledAt);
    if (!scheduledAt) {
      setError("Ingresa una fecha y hora valida.");
      return;
    }

    setSubmittingBooking(true);
    try {
      const response = await fetch("/api/bookings/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: requestForm.fullName.trim(),
          email: requestForm.email.trim(),
          phone: requestForm.phone.trim() || undefined,
          serviceId: requestForm.serviceId,
          scheduledAt,
          addressLine1: requestForm.addressLine1.trim(),
          comuna: requestForm.comuna.trim(),
          region: requestForm.region.trim(),
          notes: requestForm.notes.trim() || undefined
        })
      });

      const data = (await response.json()) as { booking?: PublicBooking; error?: string; detail?: string };

      if (!response.ok || !data.booking) {
        throw new Error(data.detail || data.error || "No se pudo crear la reserva");
      }

      setMessage(`Solicitud enviada. Codigo de reserva: ${data.booking.id}`);
      setTrackingEmail(requestForm.email.trim().toLowerCase());
      setRequestForm((prev) => ({ ...prev, notes: "", scheduledAt: "" }));
    } catch (requestError) {
      const detail = requestError instanceof Error ? requestError.message : "Error inesperado";
      setError(detail);
    } finally {
      setSubmittingBooking(false);
    }
  };

  const handleTrackBookings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setError("");

    const normalizedEmail = trackingEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Ingresa tu email para revisar tus reservas.");
      return;
    }

    setLoadingBookings(true);
    try {
      const params = new URLSearchParams({ email: normalizedEmail, limit: "20" });
      const response = await fetch(`/api/bookings/public?${params.toString()}`);
      const data = (await response.json()) as { bookings?: PublicBooking[]; error?: string; detail?: string };

      if (!response.ok || !data.bookings) {
        throw new Error(data.detail || data.error || "No se pudieron cargar tus reservas");
      }

      setBookings(data.bookings);
      setMessage(`${data.bookings.length} reserva(s) encontrada(s).`);
    } catch (requestError) {
      const detail = requestError instanceof Error ? requestError.message : "Error inesperado";
      setError(detail);
    } finally {
      setLoadingBookings(false);
    }
  };

  return (
    <main className="page">
      <header className="topbar">
        <div className="brand-lockup">
          <Image alt="Logo de WeTask" className="brand-logo" height={88} priority src="/logo-wetask-cropped.png" width={220} />
        </div>
        <span className="brand-pill">Reserva en 2 minutos</span>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">Servicios a domicilio en Chile</p>
          <h1>Pide tu servicio, agenda fecha y sigue el estado desde tu correo.</h1>
          <p className="lead">Flujo operativo de cliente: seleccion de servicio, direccion, horario y seguimiento de reserva.</p>
        </div>

        <aside className="trust-card">
          <h2>Como funciona</h2>
          <ul>
            <li>Elige un servicio activo</li>
            <li>Completa tus datos y direccion</li>
            <li>Recibe y sigue tu solicitud por email</li>
          </ul>
        </aside>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>1) Solicitar servicio</h2>
          <p>Completa este formulario como cliente final. No necesitas IDs internos.</p>
        </div>

        {loadingServices ? <p className="empty">Cargando servicios...</p> : null}

        <div className="service-grid">
          {services.map((service) => (
            <button
              className={`service-card ${requestForm.serviceId === service.id ? "active" : ""}`}
              key={service.id}
              onClick={() => setRequestForm((prev) => ({ ...prev, serviceId: service.id }))}
              type="button"
            >
              <strong>{service.name}</strong>
              <span>{service.description}</span>
              <span>{formatPriceClp(service.basePriceClp)}</span>
            </button>
          ))}
        </div>

        <form className="grid-form" onSubmit={handleSubmitBooking}>
          <label>
            Nombre completo
            <input
              onChange={(event) => setRequestForm((prev) => ({ ...prev, fullName: event.target.value }))}
              placeholder="Tu nombre"
              required
              value={requestForm.fullName}
            />
          </label>

          <label>
            Email
            <input
              onChange={(event) => setRequestForm((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="tu@email.com"
              required
              type="email"
              value={requestForm.email}
            />
          </label>

          <label>
            Telefono
            <input
              onChange={(event) => setRequestForm((prev) => ({ ...prev, phone: event.target.value }))}
              placeholder="+56..."
              value={requestForm.phone}
            />
          </label>

          <label>
            Fecha y hora
            <input
              onChange={(event) => setRequestForm((prev) => ({ ...prev, scheduledAt: event.target.value }))}
              required
              type="datetime-local"
              value={requestForm.scheduledAt}
            />
          </label>

          <label className="full">
            Direccion
            <input
              onChange={(event) => setRequestForm((prev) => ({ ...prev, addressLine1: event.target.value }))}
              placeholder="Av. Providencia 1234"
              required
              value={requestForm.addressLine1}
            />
          </label>

          <label>
            Comuna
            <input
              onChange={(event) => setRequestForm((prev) => ({ ...prev, comuna: event.target.value }))}
              placeholder="Providencia"
              required
              value={requestForm.comuna}
            />
          </label>

          <label>
            Region
            <input
              onChange={(event) => setRequestForm((prev) => ({ ...prev, region: event.target.value }))}
              required
              value={requestForm.region}
            />
          </label>

          <label className="full">
            Comentarios (opcional)
            <textarea
              onChange={(event) => setRequestForm((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Detalle de acceso, referencias, etc."
              value={requestForm.notes}
            />
          </label>

          <button className="cta" disabled={submittingBooking || !selectedService} type="submit">
            {submittingBooking
              ? "Enviando..."
              : `Solicitar ${selectedService ? `${selectedService.name} (${formatPriceClp(selectedService.basePriceClp)})` : "servicio"}`}
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>2) Ver mis reservas</h2>
          <p>Ingresa tu correo para revisar estado y detalle de solicitudes.</p>
        </div>

        <form className="query-row query-single" onSubmit={handleTrackBookings}>
          <label>
            Email de seguimiento
            <input
              onChange={(event) => setTrackingEmail(event.target.value)}
              placeholder="tu@email.com"
              required
              type="email"
              value={trackingEmail}
            />
          </label>
          <button className="cta ghost" disabled={loadingBookings} type="submit">
            {loadingBookings ? "Buscando..." : "Buscar reservas"}
          </button>
        </form>

        {message ? <p className="feedback ok">{message}</p> : null}
        {error ? <p className="feedback error">{error}</p> : null}

        <div className="list">
          {bookings.length === 0 ? (
            <p className="empty">Todavia no hay reservas cargadas para este correo.</p>
          ) : (
            bookings.map((booking) => (
              <article className="booking-card" key={booking.id}>
                <div className="booking-head">
                  <h3>{booking.service.name}</h3>
                  <span className={`status status-${booking.status.toLowerCase()}`}>{statusLabel[booking.status]}</span>
                </div>

                <p>
                  <strong>Codigo:</strong> {booking.id}
                </p>
                <p>
                  <strong>Fecha agendada:</strong> {formatDate(booking.scheduledAt)}
                </p>
                <p>
                  <strong>Direccion:</strong> {booking.addressLine1}, {booking.comuna}, {booking.region}
                </p>
                <p>
                  <strong>Prestador:</strong> {booking.pro?.fullName ?? "Pendiente de asignacion"}
                </p>
                <p>
                  <strong>Total estimado:</strong> {formatPriceClp(booking.totalPriceClp)}
                </p>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
