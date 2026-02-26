"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MarketNav } from "@/components/market-nav";

type Service = {
  id: string;
  slug: string;
  name: string;
  description: string;
  basePriceClp: number;
};

type Slot = {
  id: string;
  startsAt: string;
  endsAt: string;
  service: { id: string; name: string } | null;
};

type MatchProfessional = {
  id: string;
  userId: string;
  fullName: string;
  ratingAvg: number;
  ratingsCount: number;
  hourlyRateFromClp: number | null;
  distanceKm: number;
  nextAvailableAt: string | null;
  coverageCity: string | null;
  serviceRadiusKm: number;
  slots: Slot[];
};

type BookingResponse = {
  id: string;
  status: string;
  paymentStatus: string;
  totalPriceClp: number;
};

function clp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

function isoDay(value: string): string {
  return value.slice(0, 10);
}

function starsText(value: number) {
  const rounded = Math.max(1, Math.min(5, Math.round(value || 0)));
  return `${"★".repeat(rounded)}${"☆".repeat(5 - rounded)}`;
}

export default function ReservarPage() {
  const query = useSearchParams();
  const initialServiceId = query.get("serviceId") ?? "";
  const initialProId = query.get("proId") ?? "";
  const initialStreet = query.get("address") ?? "Av. Providencia 1550";
  const initialCity = query.get("city") ?? "Santiago";
  const initialPostalCode = query.get("postalCode") ?? "7500000";

  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingPay, setLoadingPay] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [address, setAddress] = useState({
    city: initialCity,
    postalCode: initialPostalCode,
    street: initialStreet,
    latitude: "",
    longitude: ""
  });

  const [filters, setFilters] = useState({
    serviceId: initialServiceId,
    date: new Date().toISOString().slice(0, 10)
  });

  const [customerId, setCustomerId] = useState("");

  const [matches, setMatches] = useState<MatchProfessional[]>([]);
  const [selectedProId, setSelectedProId] = useState(initialProId);
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState("");

  const [hours, setHours] = useState(2);
  const [materials, setMaterials] = useState(false);
  const [urgency, setUrgency] = useState(false);
  const [travelFeeClp, setTravelFeeClp] = useState(0);
  const [details, setDetails] = useState("");

  const [createdBooking, setCreatedBooking] = useState<BookingResponse | null>(null);

  const selectedPro = useMemo(() => matches.find((pro) => pro.userId === selectedProId) ?? null, [matches, selectedProId]);

  const dayGroups = useMemo(() => {
    if (!selectedPro) return [] as Array<[string, Slot[]]>;
    const map = new Map<string, Slot[]>();
    for (const slot of selectedPro.slots) {
      const key = isoDay(slot.startsAt);
      const prev = map.get(key) ?? [];
      prev.push(slot);
      map.set(key, prev);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [selectedPro]);

  const selectedSlots = useMemo(() => dayGroups.find(([day]) => day === selectedDay)?.[1] ?? [], [dayGroups, selectedDay]);

  const selectedSlot = useMemo(() => {
    if (!selectedPro || !selectedSlotId) return null;
    return selectedPro.slots.find((slot) => slot.id === selectedSlotId) ?? null;
  }, [selectedPro, selectedSlotId]);

  const baseHourly = selectedPro?.hourlyRateFromClp ?? services.find((s) => s.id === filters.serviceId)?.basePriceClp ?? 0;
  const extrasTotal = (materials ? 5000 : 0) + (urgency ? 9000 : 0) + travelFeeClp;
  const subtotal = baseHourly * hours;
  const commission = Math.round(subtotal * 0.12);
  const total = subtotal + extrasTotal + commission;

  const loadServices = async () => {
    try {
      setLoadingServices(true);
      const response = await fetch("/api/marketplace/catalog");
      const data = (await response.json()) as {
        categories?: Array<{ services: Array<Service> }>;
        error?: string;
        detail?: string;
      };

      if (!response.ok || !data.categories) {
        throw new Error(data.detail || data.error || "No se pudieron cargar servicios");
      }

      const list = data.categories.flatMap((category) => category.services);
      setServices(list);
      if (!filters.serviceId && list[0]) {
        setFilters((prev) => ({ ...prev, serviceId: list[0].id }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoadingServices(false);
    }
  };

  useEffect(() => {
    void loadServices();
  }, []);

  useEffect(() => {
    const bootstrapSession = async () => {
      try {
        const response = await fetch("/api/auth/session");
        const data = (await response.json()) as { session?: { userId: string } | null };
        if (data.session?.userId) setCustomerId(data.session.userId);
      } catch {
        // noop
      }
    };
    void bootstrapSession();
  }, []);

  const useGeolocation = async () => {
    if (!navigator.geolocation) {
      setError("Tu navegador no soporta geolocalizacion");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setAddress((prev) => ({
          ...prev,
          latitude: position.coords.latitude.toString(),
          longitude: position.coords.longitude.toString()
        }));
        setMessage("Ubicacion detectada. Ahora busca profesionales.");
      },
      () => {
        setError("No pudimos obtener tu ubicacion");
      }
    );
  };

  const searchPros = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setSelectedProId("");
    setSelectedSlotId("");
    setSelectedDay("");

    try {
      setLoadingSearch(true);
      const params = new URLSearchParams({
        city: address.city,
        postalCode: address.postalCode,
        street: address.street,
        date: filters.date,
        limit: "30"
      });
      if (filters.serviceId) params.set("serviceId", filters.serviceId);
      if (address.latitude && address.longitude) {
        params.set("latitude", address.latitude);
        params.set("longitude", address.longitude);
      }

      const response = await fetch(`/api/marketplace/search-professionals?${params.toString()}`);
      const data = (await response.json()) as {
        professionals?: Array<{
          id: string;
          userId: string;
          ratingAvg: number;
          ratingsCount: number;
          hourlyRateFromClp: number | null;
          distanceKm: number;
          nextAvailableAt: string | null;
          coverageCity: string | null;
          serviceRadiusKm: number;
          user: { fullName: string };
          slots: Slot[];
        }>;
        error?: string;
        detail?: string;
      };

      if (!response.ok || !data.professionals) {
        throw new Error(data.detail || data.error || "No se pudieron buscar profesionales");
      }

      const normalized: MatchProfessional[] = data.professionals.map((item) => ({
        id: item.id,
        userId: item.userId,
        fullName: item.user.fullName,
        ratingAvg: Number(item.ratingAvg),
        ratingsCount: item.ratingsCount,
        hourlyRateFromClp: item.hourlyRateFromClp,
        distanceKm: item.distanceKm,
        nextAvailableAt: item.nextAvailableAt,
        coverageCity: item.coverageCity,
        serviceRadiusKm: item.serviceRadiusKm,
        slots: item.slots
      }));

      setMatches(normalized);
      if (normalized[0]) {
        setSelectedProId(normalized[0].userId);
        const firstDay = isoDay(normalized[0].slots[0]?.startsAt ?? "");
        if (firstDay) setSelectedDay(firstDay);
      }

      setMessage(`${normalized.length} profesional(es) encontrados para tu direccion.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoadingSearch(false);
    }
  };

  const createBooking = async () => {
    if (!customerId || !selectedPro || !selectedSlot || !filters.serviceId) {
      setError("Completa cliente, profesional, servicio y horario.");
      return;
    }

    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/marketplace/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          serviceId: filters.serviceId,
          proId: selectedPro.userId,
          slotId: selectedSlot.id,
          autoAssign: false,
          startsAt: selectedSlot.startsAt,
          hours,
          address: {
            street: address.street,
            city: address.city,
            postalCode: address.postalCode,
            region: address.city
          },
          details,
          extras: {
            materials,
            urgency,
            travelFeeClp
          }
        })
      });

      const data = (await response.json()) as { booking?: BookingResponse; error?: string; detail?: string };
      if (!response.ok || !data.booking) {
        throw new Error(data.detail || data.error || "No se pudo crear la reserva");
      }

      setCreatedBooking(data.booking);
      setMessage(`Reserva creada: ${data.booking.id}. Falta confirmar pago.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  const confirmPayment = async () => {
    if (!createdBooking || !customerId) return;
    setError("");
    setMessage("");

    try {
      setLoadingPay(true);
      const response = await fetch(`/api/marketplace/bookings/${createdBooking.id}/payment/confirm`, {
        method: "POST"
      });

      const data = (await response.json()) as { booking?: BookingResponse; error?: string; detail?: string };
      if (!response.ok || !data.booking) {
        throw new Error(data.detail || data.error || "No se pudo confirmar pago");
      }

      setCreatedBooking(data.booking);
      setMessage("Pago confirmado. Reserva confirmada y slot bloqueado.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoadingPay(false);
    }
  };

  return (
    <main className="page market-shell">
      <MarketNav />

      <section className="panel">
        <div className="panel-head">
          <h2>Checkout de reserva</h2>
          <p>Servicio, profesional, fecha/hora y pago protegido en un solo flujo.</p>
        </div>

        <form className="grid-form" onSubmit={searchPros}>
          <label>
            Ciudad
            <input value={address.city} onChange={(e) => setAddress((prev) => ({ ...prev, city: e.target.value }))} required />
          </label>
          <label>
            Codigo postal
            <input value={address.postalCode} onChange={(e) => setAddress((prev) => ({ ...prev, postalCode: e.target.value }))} required />
          </label>
          <label className="full">
            Calle
            <input value={address.street} onChange={(e) => setAddress((prev) => ({ ...prev, street: e.target.value }))} required />
          </label>

          <label>
            Servicio
            <select value={filters.serviceId} onChange={(e) => setFilters((prev) => ({ ...prev, serviceId: e.target.value }))}>
              <option value="">Selecciona</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fecha deseada
            <input type="date" value={filters.date} onChange={(e) => setFilters((prev) => ({ ...prev, date: e.target.value }))} />
          </label>

          <label>
            Customer ID
            <input value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="cliente demo o real" required />
          </label>

          <div className="cta-row">
            <button className="cta ghost" type="button" onClick={useGeolocation}>
              Usar geolocalizacion
            </button>
            <button className="cta" type="submit" disabled={loadingSearch || loadingServices}>
              {loadingSearch ? "Buscando..." : "Buscar profesionales"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Profesionales disponibles</h2>
          <p>Ordenados por distancia, disponibilidad, rating y precio.</p>
        </div>

        <div className="list">
          {matches.map((pro) => (
            <article className={`booking-card ${selectedProId === pro.userId ? "selected-pro" : ""}`} key={pro.id}>
              <div className="booking-head">
                <h3>{pro.fullName}</h3>
                <span className="status status-completed">{pro.distanceKm} km</span>
              </div>
              <p>
                <strong>Rating:</strong> {starsText(pro.ratingAvg)} {pro.ratingAvg.toFixed(1)} ({pro.ratingsCount})
              </p>
              <p>
                <strong>Precio/hora:</strong> {pro.hourlyRateFromClp ? clp(pro.hourlyRateFromClp) : "Por definir"}
              </p>
              <p>
                <strong>Proxima hora:</strong> {pro.nextAvailableAt ? new Date(pro.nextAvailableAt).toLocaleString("es-ES") : "Sin slots"}
              </p>
              <p>
                <strong>Radio cobertura:</strong> {pro.serviceRadiusKm} km
              </p>
              <button
                className="cta small"
                type="button"
                onClick={() => {
                  setSelectedProId(pro.userId);
                  const firstDay = isoDay(pro.slots[0]?.startsAt ?? "");
                  setSelectedDay(firstDay);
                  setSelectedSlotId("");
                }}
              >
                Elegir profesional
              </button>
            </article>
          ))}
        </div>
      </section>

      {selectedPro ? (
        <section className="panel">
          <div className="panel-head">
            <h2>Agenda de {selectedPro.fullName}</h2>
            <p>Selecciona dia y bloque horario disponible.</p>
          </div>

          <div className="day-tabs">
            {dayGroups.map(([day]) => (
              <button key={day} type="button" className={`day-tab ${selectedDay === day ? "active" : ""}`} onClick={() => setSelectedDay(day)}>
                {new Date(`${day}T00:00:00`).toLocaleDateString("es-ES", { weekday: "short", day: "2-digit", month: "2-digit" })}
              </button>
            ))}
          </div>

          <div className="calendar-slot-grid">
            {selectedSlots.map((slot) => (
              <button
                key={slot.id}
                type="button"
                className={`slot-btn ${selectedSlotId === slot.id ? "slot-btn-active" : ""}`}
                onClick={() => setSelectedSlotId(slot.id)}
              >
                {new Date(slot.startsAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
              </button>
            ))}
          </div>

          <div className="grid-form" style={{ marginTop: 12 }}>
            <label>
              Horas (1-8)
              <input type="number" min={1} max={8} value={hours} onChange={(e) => setHours(Number(e.target.value) || 1)} />
            </label>
            <label>
              Desplazamiento (CLP)
              <input type="number" min={0} value={travelFeeClp} onChange={(e) => setTravelFeeClp(Number(e.target.value) || 0)} />
            </label>
            <label>
              <span>Extras</span>
              <div className="inline-checks">
                <label><input type="checkbox" checked={materials} onChange={(e) => setMaterials(e.target.checked)} /> Materiales</label>
                <label><input type="checkbox" checked={urgency} onChange={(e) => setUrgency(e.target.checked)} /> Urgencia</label>
              </div>
            </label>
            <label className="full">
              Detalles del trabajo
              <textarea value={details} onChange={(e) => setDetails(e.target.value)} />
            </label>
          </div>

          <div className="price-box" style={{ marginTop: 12 }}>
            Resumen en vivo: ({clp(baseHourly)} x {hours}h) + extras {clp(extrasTotal)} + comision {clp(commission)} = <strong>{clp(total)}</strong>
          </div>
          <p className="minimal-note">Pago protegido y sujeto a politica de cancelacion.</p>

          <div className="cta-row">
            <button className="cta" type="button" onClick={createBooking}>
              Crear reserva
            </button>
            <Link className="cta ghost" href="/cliente">
              Ver Mis Reservas
            </Link>
          </div>

          {createdBooking ? (
            <div className="panel" style={{ marginTop: 12 }}>
              <h3>Checkout</h3>
              <p>
                Reserva {createdBooking.id} · Estado {createdBooking.status} · Pago {createdBooking.paymentStatus}
              </p>
              <button className="cta" type="button" disabled={loadingPay} onClick={confirmPayment}>
                {loadingPay ? "Confirmando pago..." : "Pagar y confirmar"}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {message ? <p className="feedback ok">{message}</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}
    </main>
  );
}
