"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { MarketNav } from "@/components/market-nav";

type Service = {
  id: string;
  slug: string;
  name: string;
  description: string;
  basePriceClp: number;
  minHours: number;
  slotMinutes: number;
};

type Professional = {
  user: {
    id: string;
    fullName: string;
  };
  isVerified: boolean;
  ratingAvg: number;
  coverageCity: string | null;
};

type BookingResponse = {
  id: string;
  totalPriceClp: number;
  status: string;
  paymentStatus: string;
};

function clp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

function toDateTimeLocalValue(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export default function ReservarPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [pros, setPros] = useState<Professional[]>([]);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    customerId: "",
    serviceId: "",
    proId: "",
    autoAssign: true,
    startsAt: "",
    hours: 2,
    street: "",
    city: "Santiago",
    postalCode: "",
    region: "Metropolitana",
    details: "",
    materials: false,
    urgency: false,
    travelFeeClp: 0
  });

  const [createdBooking, setCreatedBooking] = useState<BookingResponse | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const defaultServiceId = params.get("serviceId") ?? "";
    const defaultProId = params.get("proId") ?? "";
    const defaultStartsAt = params.get("startsAt") ?? "";

    setForm((prev) => ({
      ...prev,
      serviceId: defaultServiceId || prev.serviceId,
      proId: defaultProId || prev.proId,
      startsAt: defaultStartsAt ? toDateTimeLocalValue(defaultStartsAt) : prev.startsAt,
      autoAssign: defaultProId ? false : prev.autoAssign
    }));

    const load = async () => {
      try {
        setLoading(true);
        const [catalogRes, prosRes] = await Promise.all([
          fetch("/api/marketplace/catalog"),
          fetch("/api/marketplace/pros?verified=true&limit=30")
        ]);

        const catalogData = (await catalogRes.json()) as {
          categories?: Array<{
            minHours: number;
            slotMinutes: number;
            services: Array<{
              id: string;
              slug: string;
              name: string;
              description: string;
              basePriceClp: number;
            }>;
          }>;
          error?: string;
          detail?: string;
        };
        const prosData = (await prosRes.json()) as { professionals?: Professional[]; error?: string; detail?: string };

        if (!catalogRes.ok || !catalogData.categories) {
          throw new Error(catalogData.detail || catalogData.error || "No se pudo cargar catalogo");
        }
        if (!prosRes.ok || !prosData.professionals) {
          throw new Error(prosData.detail || prosData.error || "No se pudo cargar profesionales");
        }

        const allServices = catalogData.categories.flatMap((category) =>
          category.services.map((service) => ({
            ...service,
            minHours: category.minHours,
            slotMinutes: category.slotMinutes
          }))
        );

        setServices(allServices);
        setPros(prosData.professionals);

        if (!defaultServiceId && allServices[0]) {
          setForm((prev) => ({ ...prev, serviceId: allServices[0].id }));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inesperado");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const selectedService = useMemo(() => services.find((item) => item.id === form.serviceId) ?? null, [services, form.serviceId]);

  const estimatedPrice = useMemo(() => {
    if (!selectedService) return 0;
    const base = selectedService.basePriceClp * form.hours;
    const material = form.materials ? 5000 : 0;
    const urgency = form.urgency ? 9000 : 0;
    const travel = form.travelFeeClp || 0;
    const fee = Math.round(base * 0.12);
    return base + material + urgency + travel + fee;
  }, [form.hours, form.materials, form.urgency, form.travelFeeClp, selectedService]);

  const createBooking = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/marketplace/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: form.customerId,
          serviceId: form.serviceId,
          proId: form.autoAssign ? undefined : form.proId || undefined,
          autoAssign: form.autoAssign,
          startsAt: new Date(form.startsAt).toISOString(),
          hours: form.hours,
          address: {
            street: form.street,
            city: form.city,
            postalCode: form.postalCode,
            region: form.region
          },
          details: form.details,
          extras: {
            materials: form.materials,
            urgency: form.urgency,
            travelFeeClp: Number(form.travelFeeClp || 0)
          }
        })
      });

      const data = (await response.json()) as { booking?: BookingResponse; error?: string; detail?: string };

      if (!response.ok || !data.booking) {
        throw new Error(data.detail || data.error || "No se pudo crear la reserva");
      }

      setCreatedBooking(data.booking);
      setStep(4);
      setMessage(`Reserva creada: ${data.booking.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  const confirmPayment = async () => {
    if (!createdBooking) return;

    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/marketplace/bookings/${createdBooking.id}/payment/confirm`, {
        method: "POST",
        headers: {
          "x-user-id": form.customerId,
          "x-user-role": "CUSTOMER"
        }
      });
      const data = (await response.json()) as { booking?: BookingResponse; error?: string; detail?: string };
      if (!response.ok || !data.booking) {
        throw new Error(data.detail || data.error || "No se pudo confirmar pago");
      }
      setCreatedBooking(data.booking);
      setMessage("Pago confirmado y reserva confirmada.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  return (
    <main className="page market-shell">
      <MarketNav />
      <section className="panel">
        <div className="panel-head">
          <h2>Reserva paso a paso</h2>
          <p>Paso {step} de 4</p>
        </div>

        {loading ? <p className="empty">Cargando datos...</p> : null}

        <form className="grid-form" onSubmit={createBooking}>
          <label>
            Customer ID (demo)
            <input required value={form.customerId} onChange={(e) => setForm((p) => ({ ...p, customerId: e.target.value }))} />
          </label>

          <label>
            Servicio
            <select value={form.serviceId} onChange={(e) => setForm((p) => ({ ...p, serviceId: e.target.value }))}>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} ({clp(service.basePriceClp)}/h)
                </option>
              ))}
            </select>
          </label>

          <label>
            Asignacion
            <select
              value={form.autoAssign ? "auto" : "manual"}
              onChange={(e) => setForm((p) => ({ ...p, autoAssign: e.target.value === "auto" }))}
            >
              <option value="auto">Automatica</option>
              <option value="manual">Elegir profesional</option>
            </select>
          </label>

          <label>
            Profesional
            <select
              disabled={form.autoAssign}
              value={form.proId}
              onChange={(e) => setForm((p) => ({ ...p, proId: e.target.value }))}
            >
              <option value="">Selecciona</option>
              {pros.map((pro) => (
                <option key={pro.user.id} value={pro.user.id}>
                  {pro.user.fullName} · {Number(pro.ratingAvg || 0).toFixed(1)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Inicio
            <input type="datetime-local" required value={form.startsAt} onChange={(e) => setForm((p) => ({ ...p, startsAt: e.target.value }))} />
          </label>

          <label>
            Horas
            <input
              type="number"
              min={selectedService?.minHours ?? 1}
              max={8}
              value={form.hours}
              onChange={(e) => setForm((p) => ({ ...p, hours: Number(e.target.value) || 1 }))}
            />
          </label>

          <label className="full">
            Direccion
            <input value={form.street} required onChange={(e) => setForm((p) => ({ ...p, street: e.target.value }))} />
          </label>

          <label>
            Ciudad
            <input value={form.city} required onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
          </label>

          <label>
            Codigo postal
            <input value={form.postalCode} required onChange={(e) => setForm((p) => ({ ...p, postalCode: e.target.value }))} />
          </label>

          <label>
            Materiales
            <select value={form.materials ? "yes" : "no"} onChange={(e) => setForm((p) => ({ ...p, materials: e.target.value === "yes" }))}>
              <option value="no">No</option>
              <option value="yes">Si</option>
            </select>
          </label>

          <label>
            Urgencia
            <select value={form.urgency ? "yes" : "no"} onChange={(e) => setForm((p) => ({ ...p, urgency: e.target.value === "yes" }))}>
              <option value="no">No</option>
              <option value="yes">Si</option>
            </select>
          </label>

          <label>
            Desplazamiento (CLP)
            <input
              type="number"
              min={0}
              value={form.travelFeeClp}
              onChange={(e) => setForm((p) => ({ ...p, travelFeeClp: Number(e.target.value) || 0 }))}
            />
          </label>

          <label className="full">
            Detalles del trabajo
            <textarea value={form.details} onChange={(e) => setForm((p) => ({ ...p, details: e.target.value }))} />
          </label>

          <p className="price-box">Total estimado: {clp(estimatedPrice)}</p>

          <button type="submit" className="cta">
            Crear reserva
          </button>
        </form>

        {createdBooking ? (
          <div className="panel" style={{ marginTop: 12 }}>
            <h3>Pago</h3>
            <p>
              Reserva {createdBooking.id} · Estado {createdBooking.status} · Pago {createdBooking.paymentStatus}
            </p>
            <button className="cta" type="button" onClick={confirmPayment}>
              Confirmar pago (simulado)
            </button>
          </div>
        ) : null}

        {message ? <p className="feedback ok">{message}</p> : null}
        {error ? <p className="feedback error">{error}</p> : null}
      </section>
    </main>
  );
}
