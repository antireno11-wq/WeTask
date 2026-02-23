"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { MarketNav } from "@/components/market-nav";

const statusOptions = ["ACCEPTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

type Booking = {
  id: string;
  status: string;
  scheduledAt: string;
  totalPriceClp: number;
  customer: { fullName: string; email: string };
  service: { name: string };
  payout: { status: string } | null;
};

type Notification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
};

type Service = {
  id: string;
  name: string;
};

type ProProfile = {
  id: string;
  bio: string | null;
  coverageCity: string | null;
  coveragePostal: string | null;
  coverageLatitude: number | null;
  coverageLongitude: number | null;
  serviceRadiusKm: number;
  hourlyRateFromClp: number | null;
  isVerified: boolean;
};

type ProSlot = {
  id: string;
  startsAt: string;
  endsAt: string;
  isAvailable: boolean;
  service: { id: string; name: string } | null;
  bookings: Array<{ id: string; status: string }>;
};

function clp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

function dateInputDefault() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function combineLocalDateAndTime(date: string, time: string) {
  return new Date(`${date}T${time}:00`);
}

export default function ProPage() {
  const [proId, setProId] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [slots, setSlots] = useState<ProSlot[]>([]);
  const [statusByBooking, setStatusByBooking] = useState<Record<string, string>>({});

  const [profile, setProfile] = useState<ProProfile | null>(null);
  const [bio, setBio] = useState("");
  const [coverageCity, setCoverageCity] = useState("Santiago");
  const [coveragePostal, setCoveragePostal] = useState("7500000");
  const [coverageLatitude, setCoverageLatitude] = useState("");
  const [coverageLongitude, setCoverageLongitude] = useState("");
  const [serviceRadiusKm, setServiceRadiusKm] = useState(8);
  const [hourlyRateFromClp, setHourlyRateFromClp] = useState(12000);

  const [slotDate, setSlotDate] = useState(dateInputDefault());
  const [slotTime, setSlotTime] = useState("09:00");
  const [slotDurationMin, setSlotDurationMin] = useState(60);
  const [slotServiceId, setSlotServiceId] = useState("");

  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const slotGroups = useMemo(() => {
    const map = new Map<string, ProSlot[]>();
    for (const slot of slots) {
      const key = slot.startsAt.slice(0, 10);
      const prev = map.get(key) ?? [];
      prev.push(slot);
      map.set(key, prev);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [slots]);

  const applyProfile = (nextProfile: ProProfile | null) => {
    setProfile(nextProfile);
    if (!nextProfile) return;
    setBio(nextProfile.bio ?? "");
    setCoverageCity(nextProfile.coverageCity ?? "Santiago");
    setCoveragePostal(nextProfile.coveragePostal ?? "");
    setCoverageLatitude(nextProfile.coverageLatitude != null ? String(nextProfile.coverageLatitude) : "");
    setCoverageLongitude(nextProfile.coverageLongitude != null ? String(nextProfile.coverageLongitude) : "");
    setServiceRadiusKm(nextProfile.serviceRadiusKm ?? 8);
    setHourlyRateFromClp(nextProfile.hourlyRateFromClp ?? 12000);
  };

  const loadAll = async (targetProId: string) => {
    if (!targetProId) return;

    const [bookingsRes, notificationsRes, profileRes, slotsRes, catalogRes] = await Promise.all([
      fetch(`/api/marketplace/pro/bookings?proId=${targetProId}`),
      fetch(`/api/marketplace/notifications?userId=${targetProId}`),
      fetch(`/api/marketplace/pro/profile?proId=${targetProId}`),
      fetch(`/api/marketplace/pro/slots?proId=${targetProId}&days=14&limit=300`),
      fetch("/api/marketplace/catalog")
    ]);

    const bookingsData = (await bookingsRes.json()) as { bookings?: Booking[]; error?: string; detail?: string };
    const notificationsData = (await notificationsRes.json()) as { notifications?: Notification[]; error?: string; detail?: string };
    const profileData = (await profileRes.json()) as { profile?: ProProfile | null; error?: string; detail?: string };
    const slotsData = (await slotsRes.json()) as { slots?: ProSlot[]; error?: string; detail?: string };
    const catalogData = (await catalogRes.json()) as {
      categories?: Array<{ services: Array<{ id: string; name: string }> }>;
      error?: string;
      detail?: string;
    };

    if (!bookingsRes.ok || !bookingsData.bookings) throw new Error(bookingsData.detail || bookingsData.error || "No se pudo cargar reservas");
    if (!notificationsRes.ok || !notificationsData.notifications) {
      throw new Error(notificationsData.detail || notificationsData.error || "No se pudo cargar notificaciones");
    }
    if (!profileRes.ok) throw new Error(profileData.detail || profileData.error || "No se pudo cargar perfil");
    if (!slotsRes.ok || !slotsData.slots) throw new Error(slotsData.detail || slotsData.error || "No se pudo cargar disponibilidad");
    if (!catalogRes.ok || !catalogData.categories) throw new Error(catalogData.detail || catalogData.error || "No se pudo cargar catalogo");

    setBookings(bookingsData.bookings);
    const nextStatuses: Record<string, string> = {};
    bookingsData.bookings.forEach((item) => {
      nextStatuses[item.id] = item.status;
    });
    setStatusByBooking(nextStatuses);

    setNotifications(notificationsData.notifications);
    applyProfile(profileData.profile ?? null);
    setSlots(slotsData.slots);
    const list = catalogData.categories.flatMap((category) => category.services);
    setServices(list);
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const response = await fetch("/api/auth/session");
        const data = (await response.json()) as { session?: { userId: string } | null };
        if (data.session?.userId) {
          setProId(data.session.userId);
          await loadAll(data.session.userId);
        }
      } catch {
        // noop
      }
    };
    void bootstrap();
  }, []);

  const reloadData = async (event: FormEvent) => {
    event.preventDefault();
    setFeedback("");
    setError("");
    try {
      await loadAll(proId);
      setFeedback("Panel actualizado.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  const saveProfile = async () => {
    setFeedback("");
    setError("");
    try {
      const response = await fetch("/api/marketplace/pro/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proId,
          bio: bio.trim() || null,
          coverageCity: coverageCity.trim() || null,
          coveragePostal: coveragePostal.trim() || null,
          coverageLatitude: coverageLatitude ? Number(coverageLatitude) : null,
          coverageLongitude: coverageLongitude ? Number(coverageLongitude) : null,
          serviceRadiusKm,
          hourlyRateFromClp
        })
      });
      const data = (await response.json()) as { profile?: ProProfile; error?: string; detail?: string };
      if (!response.ok || !data.profile) throw new Error(data.detail || data.error || "No se pudo guardar perfil");
      applyProfile(data.profile);
      setFeedback("Perfil actualizado.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  const createSlot = async () => {
    setFeedback("");
    setError("");
    try {
      const startsAt = combineLocalDateAndTime(slotDate, slotTime);
      const endsAt = new Date(startsAt.getTime() + slotDurationMin * 60 * 1000);

      const response = await fetch("/api/marketplace/pro/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proId,
          serviceId: slotServiceId || null,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString()
        })
      });

      const data = (await response.json()) as { slot?: ProSlot; error?: string; detail?: string };
      if (!response.ok || !data.slot) throw new Error(data.detail || data.error || "No se pudo crear bloque horario");
      const createdSlot = data.slot;
      setSlots((prev) => [...prev, createdSlot].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
      setFeedback("Bloque horario creado.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  const updateSlotAvailability = async (slotId: string, isAvailable: boolean) => {
    setFeedback("");
    setError("");
    try {
      const response = await fetch(`/api/marketplace/pro/slots/${slotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable })
      });
      const data = (await response.json()) as { slot?: ProSlot; error?: string; detail?: string };
      if (!response.ok || !data.slot) throw new Error(data.detail || data.error || "No se pudo actualizar disponibilidad");
      setSlots((prev) => prev.map((slot) => (slot.id === slotId ? { ...slot, isAvailable: data.slot!.isAvailable } : slot)));
      setFeedback("Disponibilidad actualizada.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  const deleteSlot = async (slotId: string) => {
    setFeedback("");
    setError("");
    try {
      const response = await fetch(`/api/marketplace/pro/slots/${slotId}`, { method: "DELETE" });
      const data = (await response.json()) as { ok?: boolean; error?: string; detail?: string };
      if (!response.ok || !data.ok) throw new Error(data.detail || data.error || "No se pudo eliminar bloque");
      setSlots((prev) => prev.filter((slot) => slot.id !== slotId));
      setFeedback("Bloque horario eliminado.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  const updateStatus = async (bookingId: string) => {
    setFeedback("");
    setError("");

    try {
      const response = await fetch(`/api/marketplace/bookings/${bookingId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: statusByBooking[bookingId] })
      });
      const data = (await response.json()) as { booking?: { id: string; status: string }; error?: string; detail?: string };
      if (!response.ok || !data.booking) throw new Error(data.detail || data.error || "No se pudo actualizar estado");
      setBookings((prev) => prev.map((item) => (item.id === bookingId ? { ...item, status: data.booking!.status } : item)));
      setFeedback(`Estado actualizado: ${data.booking.status}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  const completeBooking = async (bookingId: string) => {
    setFeedback("");
    setError("");
    try {
      const response = await fetch(`/api/marketplace/bookings/${bookingId}/complete`, {
        method: "POST"
      });
      const data = (await response.json()) as { booking?: { status: string }; error?: string; detail?: string };
      if (!response.ok || !data.booking) throw new Error(data.detail || data.error || "No se pudo finalizar reserva");
      setBookings((prev) => prev.map((item) => (item.id === bookingId ? { ...item, status: data.booking!.status } : item)));
      setFeedback("Reserva finalizada.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  const requestPayout = async (bookingId: string) => {
    setFeedback("");
    setError("");
    try {
      const response = await fetch(`/api/marketplace/bookings/${bookingId}/payout/request`, {
        method: "POST"
      });
      const data = (await response.json()) as { payout?: { id: string; status: string }; error?: string; detail?: string };
      if (!response.ok || !data.payout) throw new Error(data.detail || data.error || "No se pudo solicitar payout");
      setFeedback(`Payout solicitado: ${data.payout.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  return (
    <main className="page market-shell">
      <MarketNav />
      <section className="panel">
        <div className="panel-head">
          <h2>Panel Profesional</h2>
          <p>Onboarding Tasker, calendario editable, reservas y payouts.</p>
        </div>

        <form className="query-row query-single" onSubmit={reloadData}>
          <label>
            Pro ID
            <input required value={proId} onChange={(e) => setProId(e.target.value)} placeholder="cuid profesional" />
          </label>
          <button type="submit" className="cta ghost">
            Recargar panel
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Perfil Tasker</h2>
          <p>Configura tu zona, radio, tarifa y bio.</p>
        </div>

        <div className="grid-form">
          <label className="full">
            Bio
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Experiencia, especialidad, herramientas." />
          </label>
          <label>
            Ciudad
            <input value={coverageCity} onChange={(e) => setCoverageCity(e.target.value)} />
          </label>
          <label>
            Codigo postal
            <input value={coveragePostal} onChange={(e) => setCoveragePostal(e.target.value)} />
          </label>
          <label>
            Latitud
            <input value={coverageLatitude} onChange={(e) => setCoverageLatitude(e.target.value)} placeholder="-33.45" />
          </label>
          <label>
            Longitud
            <input value={coverageLongitude} onChange={(e) => setCoverageLongitude(e.target.value)} placeholder="-70.66" />
          </label>
          <label>
            Radio cobertura (km)
            <input type="number" min={2} max={60} value={serviceRadiusKm} onChange={(e) => setServiceRadiusKm(Number(e.target.value) || 8)} />
          </label>
          <label>
            Tarifa desde (CLP/h)
            <input
              type="number"
              min={5000}
              value={hourlyRateFromClp}
              onChange={(e) => setHourlyRateFromClp(Number(e.target.value) || 12000)}
            />
          </label>
        </div>

        <div className="cta-row">
          <button className="cta" type="button" onClick={saveProfile}>
            Guardar perfil
          </button>
          <span className={`status ${profile?.isVerified ? "status-completed" : "status-pending"}`}>
            {profile?.isVerified ? "Verificado" : "Pendiente verificacion"}
          </span>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Calendario de disponibilidad</h2>
          <p>Crea bloques disponibles y habilita/deshabilita con click.</p>
        </div>

        <div className="grid-form">
          <label>
            Fecha
            <input type="date" value={slotDate} onChange={(e) => setSlotDate(e.target.value)} />
          </label>
          <label>
            Hora inicio
            <input type="time" value={slotTime} onChange={(e) => setSlotTime(e.target.value)} />
          </label>
          <label>
            Duracion
            <select value={slotDurationMin} onChange={(e) => setSlotDurationMin(Number(e.target.value))}>
              <option value={30}>30 min</option>
              <option value={60}>60 min</option>
              <option value={90}>90 min</option>
              <option value={120}>120 min</option>
              <option value={180}>180 min</option>
              <option value={240}>240 min</option>
            </select>
          </label>
          <label>
            Servicio (opcional)
            <select value={slotServiceId} onChange={(e) => setSlotServiceId(e.target.value)}>
              <option value="">Cualquier servicio</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="cta-row">
          <button className="cta" type="button" onClick={createSlot}>
            Agregar bloque
          </button>
        </div>

        <div className="list">
          {slotGroups.length === 0 ? (
            <p className="empty">Aun no tienes bloques de disponibilidad.</p>
          ) : (
            slotGroups.map(([day, daySlots]) => (
              <article className="booking-card" key={day}>
                <p>
                  <strong>{new Date(`${day}T00:00:00`).toLocaleDateString("es-CL", { weekday: "long", day: "2-digit", month: "long" })}</strong>
                </p>
                <div className="calendar-slot-grid">
                  {daySlots.map((slot) => (
                    <div key={slot.id} className={`pro-slot-card ${slot.isAvailable ? "slot-btn-active" : ""}`}>
                      <span>
                        {new Date(slot.startsAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })} -{" "}
                        {new Date(slot.endsAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span>{slot.service?.name ?? "General"}</span>
                      <span>{slot.bookings.length > 0 ? "Con reserva" : slot.isAvailable ? "Disponible" : "No disponible"}</span>
                      <div className="cta-row">
                        <button className="cta small" type="button" onClick={() => updateSlotAvailability(slot.id, !slot.isAvailable)}>
                          {slot.isAvailable ? "Desactivar" : "Activar"}
                        </button>
                        <button className="cta ghost small" type="button" onClick={() => deleteSlot(slot.id)}>
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Notificaciones</h2>
        </div>
        <div className="list">
          {notifications.length === 0 ? (
            <p className="empty">Sin notificaciones por ahora.</p>
          ) : (
            notifications.map((item) => (
              <article className="booking-card" key={item.id}>
                <p>
                  <strong>{item.title}</strong>
                </p>
                <p>{item.body}</p>
                <p>{new Date(item.createdAt).toLocaleString("es-ES")}</p>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="list">
        {bookings.map((booking) => (
          <article className="booking-card" key={booking.id}>
            <div className="booking-head">
              <h3>{booking.service.name}</h3>
              <span className="status status-accepted">{booking.status}</span>
            </div>
            <p>
              <strong>Cliente:</strong> {booking.customer.fullName} ({booking.customer.email})
            </p>
            <p>
              <strong>Fecha:</strong> {new Date(booking.scheduledAt).toLocaleString("es-ES")}
            </p>
            <p>
              <strong>Total:</strong> {clp(booking.totalPriceClp)}
            </p>
            <p>
              <strong>Payout:</strong> {booking.payout?.status ?? "No solicitado"}
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
                      {status}
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
              <button className="cta ghost small" type="button" onClick={() => requestPayout(booking.id)}>
                Solicitar payout
              </button>
            </div>
          </article>
        ))}
      </section>

      {feedback ? <p className="feedback ok">{feedback}</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}
    </main>
  );
}
