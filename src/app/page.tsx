"use client";

import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";

type BookingStatus = "PENDING" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

type Booking = {
  id: string;
  customerId: string;
  proId: string | null;
  serviceId: string;
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
  };
  customer: {
    id: string;
    fullName: string;
    email: string;
  };
  pro: {
    id: string;
    fullName: string;
    email: string;
  } | null;
};

type Drafts = Record<string, { status: BookingStatus; proId: string }>;

const statusOptions: BookingStatus[] = ["PENDING", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

const categoryItems = ["Limpieza", "Gasfiter", "Electricista", "Jardineria", "Pintura", "Armado de muebles"];

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
  const [createForm, setCreateForm] = useState({
    customerId: "",
    serviceId: "",
    scheduledAt: "",
    addressLine1: "",
    comuna: "",
    region: "Metropolitana",
    notes: ""
  });
  const [listForm, setListForm] = useState({
    customerId: "",
    proId: "",
    status: "",
    limit: "20"
  });

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [loadingList, setLoadingList] = useState(false);
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const canQuery = useMemo(
    () => Boolean(listForm.customerId.trim() || listForm.proId.trim()),
    [listForm.customerId, listForm.proId]
  );

  const hydrateDrafts = (items: Booking[]) => {
    const nextDrafts: Drafts = {};
    for (const booking of items) {
      nextDrafts[booking.id] = {
        status: booking.status,
        proId: booking.proId ?? ""
      };
    }
    setDrafts(nextDrafts);
  };

  const handleCreateBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    const scheduledAt = toIsoOrNull(createForm.scheduledAt);
    if (!scheduledAt) {
      setError("Ingresa una fecha y hora valida para la reserva.");
      return;
    }

    setSubmittingCreate(true);
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: createForm.customerId.trim(),
          serviceId: createForm.serviceId.trim(),
          scheduledAt,
          addressLine1: createForm.addressLine1.trim(),
          comuna: createForm.comuna.trim(),
          region: createForm.region.trim(),
          notes: createForm.notes.trim() || undefined
        })
      });

      const data = (await response.json()) as { booking?: Booking; error?: string; detail?: string };

      if (!response.ok || !data.booking) {
        throw new Error(data.detail || data.error || "No se pudo crear la reserva");
      }

      setMessage(`Reserva creada: ${data.booking.id}`);
      setCreateForm((prev) => ({ ...prev, notes: "", scheduledAt: "" }));
    } catch (requestError) {
      const detail = requestError instanceof Error ? requestError.message : "Error inesperado";
      setError(detail);
    } finally {
      setSubmittingCreate(false);
    }
  };

  const handleListBookings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!canQuery) {
      setError("Debes ingresar customerId o proId para listar reservas.");
      return;
    }

    setLoadingList(true);
    try {
      const params = new URLSearchParams();
      if (listForm.customerId.trim()) params.set("customerId", listForm.customerId.trim());
      if (listForm.proId.trim()) params.set("proId", listForm.proId.trim());
      if (listForm.status.trim()) params.set("status", listForm.status.trim());
      if (listForm.limit.trim()) params.set("limit", listForm.limit.trim());

      const response = await fetch(`/api/bookings?${params.toString()}`);
      const data = (await response.json()) as { bookings?: Booking[]; error?: string; detail?: string };

      if (!response.ok || !data.bookings) {
        throw new Error(data.detail || data.error || "No se pudieron cargar las reservas");
      }

      setBookings(data.bookings);
      hydrateDrafts(data.bookings);
      setMessage(`${data.bookings.length} reserva(s) cargada(s).`);
    } catch (requestError) {
      const detail = requestError instanceof Error ? requestError.message : "Error inesperado";
      setError(detail);
    } finally {
      setLoadingList(false);
    }
  };

  const handlePatchStatus = async (bookingId: string) => {
    const draft = drafts[bookingId];
    if (!draft) return;

    setError("");
    setMessage("");
    setUpdatingId(bookingId);

    try {
      const response = await fetch(`/api/bookings/${bookingId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: draft.status,
          proId: draft.proId.trim() || undefined
        })
      });

      const data = (await response.json()) as { booking?: Booking; error?: string; detail?: string };

      if (!response.ok || !data.booking) {
        throw new Error(data.detail || data.error || "No se pudo actualizar el estado");
      }

      setBookings((prev) => prev.map((item) => (item.id === bookingId ? data.booking! : item)));
      setMessage(`Reserva ${bookingId} actualizada a ${draft.status}.`);
    } catch (requestError) {
      const detail = requestError instanceof Error ? requestError.message : "Error inesperado";
      setError(detail);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <main className="page">
      <header className="topbar">
        <div className="brand-lockup">
          <Image
            alt="Logo de WeTask"
            className="brand-logo"
            height={88}
            priority
            src="/logo-wetask.png"
            width={220}
          />
        </div>
        <span className="brand-pill">MVP operativo</span>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">Servicios a domicilio</p>
          <h1>Reserva rapido, asigna prestador y controla estados en un solo panel.</h1>
          <p className="lead">
            Interfaz inspirada en marketplaces de servicios como Webel: foco en conversion, confianza y claridad de
            operacion para cliente y prestador.
          </p>
          <div className="chips" aria-label="Categorias populares">
            {categoryItems.map((item) => (
              <span className="chip" key={item}>
                {item}
              </span>
            ))}
          </div>
        </div>

        <aside className="trust-card">
          <h2>Confianza primero</h2>
          <ul>
            <li>Profesionales verificados</li>
            <li>Precios transparentes en CLP</li>
            <li>Seguimiento de cada reserva</li>
          </ul>
        </aside>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>1) Crear reserva</h2>
          <p>Usa IDs existentes en tu base de datos (seed o producción).</p>
        </div>

        <form className="grid-form" onSubmit={handleCreateBooking}>
          <label>
            Customer ID
            <input
              value={createForm.customerId}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, customerId: event.target.value }))}
              required
              placeholder="cus_..."
            />
          </label>

          <label>
            Service ID
            <input
              value={createForm.serviceId}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, serviceId: event.target.value }))}
              required
              placeholder="srv_..."
            />
          </label>

          <label>
            Fecha y hora
            <input
              type="datetime-local"
              value={createForm.scheduledAt}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, scheduledAt: event.target.value }))}
              required
            />
          </label>

          <label>
            Direccion
            <input
              value={createForm.addressLine1}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, addressLine1: event.target.value }))}
              required
              placeholder="Av. Providencia 1234"
            />
          </label>

          <label>
            Comuna
            <input
              value={createForm.comuna}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, comuna: event.target.value }))}
              required
              placeholder="Providencia"
            />
          </label>

          <label>
            Region
            <input
              value={createForm.region}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, region: event.target.value }))}
              required
            />
          </label>

          <label className="full">
            Notas
            <textarea
              value={createForm.notes}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Detalle de acceso, referencias, etc."
            />
          </label>

          <button className="cta" disabled={submittingCreate} type="submit">
            {submittingCreate ? "Creando..." : "Crear reserva"}
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>2) Listar y actualizar reservas</h2>
          <p>Consulta por cliente o prestador y ajusta el estado de cada reserva.</p>
        </div>

        <form className="query-row" onSubmit={handleListBookings}>
          <label>
            Customer ID
            <input
              value={listForm.customerId}
              onChange={(event) => setListForm((prev) => ({ ...prev, customerId: event.target.value }))}
              placeholder="Obligatorio si no hay proId"
            />
          </label>

          <label>
            Pro ID
            <input
              value={listForm.proId}
              onChange={(event) => setListForm((prev) => ({ ...prev, proId: event.target.value }))}
              placeholder="Obligatorio si no hay customerId"
            />
          </label>

          <label>
            Estado
            <select
              value={listForm.status}
              onChange={(event) => setListForm((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="">Todos</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label>
            Limite
            <input
              value={listForm.limit}
              onChange={(event) => setListForm((prev) => ({ ...prev, limit: event.target.value }))}
            />
          </label>

          <button className="cta ghost" disabled={loadingList || !canQuery} type="submit">
            {loadingList ? "Buscando..." : "Buscar"}
          </button>
        </form>

        {message ? <p className="feedback ok">{message}</p> : null}
        {error ? <p className="feedback error">{error}</p> : null}

        <div className="list">
          {bookings.length === 0 ? (
            <p className="empty">Sin resultados todavia. Ejecuta una busqueda para ver reservas.</p>
          ) : (
            bookings.map((booking) => (
              <article className="booking-card" key={booking.id}>
                <div className="booking-head">
                  <h3>{booking.service.name}</h3>
                  <span className={`status status-${booking.status.toLowerCase()}`}>{booking.status}</span>
                </div>

                <p>
                  <strong>ID:</strong> {booking.id}
                </p>
                <p>
                  <strong>Cliente:</strong> {booking.customer.fullName} ({booking.customer.email})
                </p>
                <p>
                  <strong>Direccion:</strong> {booking.addressLine1}, {booking.comuna}
                </p>
                <p>
                  <strong>Agenda:</strong> {formatDate(booking.scheduledAt)}
                </p>
                <p>
                  <strong>Total:</strong> {formatPriceClp(booking.totalPriceClp)}
                </p>

                <div className="status-editor">
                  <label>
                    Nuevo estado
                    <select
                      value={drafts[booking.id]?.status ?? booking.status}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [booking.id]: {
                            status: event.target.value as BookingStatus,
                            proId: prev[booking.id]?.proId ?? booking.proId ?? ""
                          }
                        }))
                      }
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Asignar proId (opcional)
                    <input
                      value={drafts[booking.id]?.proId ?? booking.proId ?? ""}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [booking.id]: {
                            status: prev[booking.id]?.status ?? booking.status,
                            proId: event.target.value
                          }
                        }))
                      }
                      placeholder="pro_..."
                    />
                  </label>

                  <button
                    className="cta small"
                    disabled={updatingId === booking.id}
                    onClick={() => handlePatchStatus(booking.id)}
                    type="button"
                  >
                    {updatingId === booking.id ? "Actualizando..." : "Guardar estado"}
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
