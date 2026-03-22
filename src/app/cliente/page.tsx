"use client";

import Link from "next/link";
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MarketNav } from "@/components/market-nav";

type Booking = {
  id: string;
  status: string;
  scheduledAt: string;
  totalPriceClp: number;
  addressLine1: string;
  comuna: string;
  city: string | null;
  postalCode: string | null;
  service: { name: string };
  pro: { fullName: string } | null;
  review?: { id: string; rating: number; comment?: string | null } | null;
};

type Notification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
};

type SessionPayload = {
  userId: string;
  fullName?: string | null;
  email?: string | null;
};

type PaymentMethod = {
  id: string;
  brand: string | null;
  last4: string;
  expirationMonth: number | null;
  expirationYear: number | null;
  cardholderName: string | null;
  payerEmail: string | null;
  paymentMethodId: string | null;
  isDefault: boolean;
};

type CardFormData = {
  token?: string;
  paymentMethodId?: string;
  issuerId?: string;
  cardholderEmail?: string;
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  PENDING_PAYMENT: "Pago pendiente",
  ACCEPTED: "Aceptado",
  ASSIGNED: "Asignado",
  CONFIRMED: "Confirmado",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
  PAYMENT_FAILED: "Pago fallido"
};

function clp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

function formatBookingDate(value: string) {
  return new Date(value).toLocaleString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function bookingEyebrow(status: string, scheduledAt: string) {
  if (status === "COMPLETED") return "Servicio realizado";
  if (status === "IN_PROGRESS") return "Servicio en curso";
  if (new Date(scheduledAt).getTime() >= Date.now()) return "Próxima visita";
  return "Servicio agendado";
}

export default function ClientePage() {
  const addPaymentFormRef = useRef<any>(null);

  const [sessionUserId, setSessionUserId] = useState("");
  const [customerName, setCustomerName] = useState("Cliente");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhotoUrl, setCustomerPhotoUrl] = useState("");
  const [customAddress, setCustomAddress] = useState("");
  const [addressDraft, setAddressDraft] = useState("");
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedFromAutocomplete, setSelectedFromAutocomplete] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);
  const [savingPaymentMethod, setSavingPaymentMethod] = useState(false);
  const [editingPayments, setEditingPayments] = useState(false);
  const [paymentSdkReady, setPaymentSdkReady] = useState(false);
  const [paymentFormReady, setPaymentFormReady] = useState(false);
  const [paymentMethodMessage, setPaymentMethodMessage] = useState("");
  const [paymentMethodError, setPaymentMethodError] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [payerEmail, setPayerEmail] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const sortedBookings = useMemo(
    () => [...bookings].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
    [bookings]
  );
  const defaultAddress = useMemo(() => {
    const latestWithAddress = bookings.find((item) => item.addressLine1?.trim());
    if (!latestWithAddress) return "Aún no tienes una dirección guardada.";

    return [latestWithAddress.addressLine1, latestWithAddress.comuna, latestWithAddress.city]
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .join(", ");
  }, [bookings]);
  const displayedAddress = customAddress.trim() || defaultAddress;
  const servicesHref = useMemo(() => {
    const qs = new URLSearchParams();
    const savedAddress = customAddress.trim() || (defaultAddress !== "Aún no tienes una dirección guardada." ? defaultAddress : "");
    if (savedAddress) qs.set("address", savedAddress);
    return qs.toString() ? `/servicios?${qs.toString()}` : "/servicios";
  }, [customAddress, defaultAddress]);

  const upcomingBookings = sortedBookings.filter((item) => new Date(item.scheduledAt).getTime() >= Date.now());
  const historyBookings = sortedBookings.filter((item) => new Date(item.scheduledAt).getTime() < Date.now());

  const fetchBookings = async () => {
    const response = await fetch("/api/marketplace/client/bookings");
    const data = (await response.json()) as { bookings?: Booking[]; error?: string; detail?: string };
    if (!response.ok || !data.bookings) throw new Error(data.detail || data.error || "No se pudieron cargar reservas");
    setBookings(data.bookings);
    return data.bookings.length;
  };

  const fetchNotifications = async () => {
    const response = await fetch("/api/marketplace/notifications");
    const data = (await response.json()) as { notifications?: Notification[] };
    setNotifications(data.notifications ?? []);
  };

  const fetchPaymentMethods = useCallback(async () => {
    try {
      setLoadingPaymentMethods(true);
      const response = await fetch("/api/marketplace/client/payment-methods");
      const data = (await response.json()) as { paymentMethods?: PaymentMethod[]; error?: string; detail?: string };
      if (!response.ok) {
        throw new Error(data.detail || data.error || "No se pudieron cargar los medios de pago");
      }
      setPaymentMethods(data.paymentMethods ?? []);
    } catch (e) {
      setPaymentMethodError(e instanceof Error ? e.message : "No se pudieron cargar los medios de pago");
    } finally {
      setLoadingPaymentMethods(false);
    }
  }, []);

  const loadDashboard = useCallback(async (targetName: string) => {
    const count = await fetchBookings();
    await fetchNotifications();
    setFeedback(`Panel cargado para ${targetName} (${count} reservas).`);
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = (await sessionRes.json()) as {
          session?: SessionPayload;
          error?: string;
          detail?: string;
        };

        if (!sessionRes.ok || !sessionData.session?.userId) {
          throw new Error(sessionData.detail || sessionData.error || "No se pudo cargar sesión");
        }

        const nextName = sessionData.session.fullName?.trim() || "Cliente";
        setSessionUserId(sessionData.session.userId);
        setCustomerName(nextName);
        setCustomerEmail(sessionData.session.email?.trim() || "");
        setCardholderName(nextName);
        setPayerEmail(sessionData.session.email?.trim() || "");
        await loadDashboard(nextName);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inesperado");
      }
    };

    bootstrap();
  }, [loadDashboard]);

  useEffect(() => {
    try {
      const savedPhoto = window.localStorage.getItem("wetask_customer_photo") ?? "";
      if (savedPhoto) setCustomerPhotoUrl(savedPhoto);
      const savedAddress = window.localStorage.getItem("wetask_customer_address") ?? "";
      if (savedAddress) {
        setCustomAddress(savedAddress);
        setAddressDraft(savedAddress);
      }
    } catch {
      // Ignorar errores de almacenamiento local.
    }
  }, []);

  useEffect(() => {
    if (!sessionUserId) return;
    void fetchPaymentMethods();
  }, [fetchPaymentMethods, sessionUserId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as any).MercadoPago) {
      setPaymentSdkReady(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://sdk.mercadopago.com/js/v2";
    script.async = true;
    script.onload = () => setPaymentSdkReady(true);
    script.onerror = () => setPaymentMethodError("No pudimos cargar Mercado Pago para guardar tu tarjeta.");
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  useEffect(() => {
    const publicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ?? "";
    if (!editingPayments || !paymentSdkReady || !publicKey) return;
    if (typeof window === "undefined") return;
    const MercadoPagoCtor = (window as any).MercadoPago;
    if (!MercadoPagoCtor) return;

    let cancelled = false;

    const mount = async () => {
      try {
        const mp = new MercadoPagoCtor(publicKey, { locale: "es-CL" });
        const cardForm = mp.cardForm({
          amount: "1",
          iframe: true,
          form: {
            id: "client-payment-card-form",
            cardholderName: { id: "client-payment-cardholder-name" },
            cardholderEmail: { id: "client-payment-cardholder-email" },
            cardNumber: { id: "client-payment-card-number" },
            expirationDate: { id: "client-payment-expiration-date" },
            securityCode: { id: "client-payment-security-code" },
            installments: { id: "client-payment-installments" },
            identificationType: { id: "client-payment-identification-type" },
            identificationNumber: { id: "client-payment-identification-number" },
            issuer: { id: "client-payment-issuer" }
          }
        });
        if (cancelled) {
          cardForm.unmount?.();
          cardForm.destroy?.();
          return;
        }
        addPaymentFormRef.current = cardForm;
        setPaymentFormReady(true);
      } catch {
        if (!cancelled) {
          setPaymentFormReady(false);
          setPaymentMethodError("No pudimos inicializar el formulario de tarjeta.");
        }
      }
    };

    void mount();

    return () => {
      cancelled = true;
      setPaymentFormReady(false);
      try {
        addPaymentFormRef.current?.unmount?.();
        addPaymentFormRef.current?.destroy?.();
      } catch {
        // noop
      } finally {
        addPaymentFormRef.current = null;
      }
    };
  }, [editingPayments, paymentSdkReady]);

  useEffect(() => {
    if (!editingAddress) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      setAutocompleteLoading(false);
      return;
    }

    const queryAddress = addressDraft.trim();
    if (selectedFromAutocomplete) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      setAutocompleteLoading(false);
      return;
    }

    if (queryAddress.length < 4) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      setAutocompleteLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setAutocompleteLoading(true);
      try {
        const response = await fetch(`/api/maps/autocomplete?input=${encodeURIComponent(`${queryAddress}, Santiago, Chile`)}`, {
          signal: controller.signal
        });
        const data = (await response.json()) as { predictions?: string[] };
        if (!response.ok) {
          setAddressSuggestions([]);
          setShowSuggestions(false);
          return;
        }
        const suggestions = Array.isArray(data.predictions) ? data.predictions : [];
        setAddressSuggestions(suggestions);
        setShowSuggestions(suggestions.length > 0);
      } catch {
        if (!controller.signal.aborted) {
          setAddressSuggestions([]);
          setShowSuggestions(false);
        }
      } finally {
        if (!controller.signal.aborted) {
          setAutocompleteLoading(false);
        }
      }
    }, 320);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [addressDraft, editingAddress, selectedFromAutocomplete]);

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const next = typeof reader.result === "string" ? reader.result : "";
      setCustomerPhotoUrl(next);
      try {
        window.localStorage.setItem("wetask_customer_photo", next);
      } catch {
        // Ignorar errores de almacenamiento local.
      }
    };
    reader.readAsDataURL(file);
  };

  const refreshDashboard = async () => {
    setError("");
    setFeedback("");
    try {
      await loadDashboard(customerName);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  const savePaymentMethod = async () => {
    if (!addPaymentFormRef.current || !paymentFormReady) {
      setPaymentMethodError("Espera un momento mientras cargamos el formulario de tarjeta.");
      return;
    }

    setPaymentMethodError("");
    setPaymentMethodMessage("");
    setSavingPaymentMethod(true);
    try {
      const cardData = (addPaymentFormRef.current.getCardFormData?.() ?? {}) as CardFormData;
      if (!cardData.token) {
        throw new Error("No pudimos tokenizar la tarjeta. Revisa los datos e inténtalo nuevamente.");
      }

      const response = await fetch("/api/marketplace/client/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: cardData.token,
          paymentMethodId: cardData.paymentMethodId,
          issuerId: cardData.issuerId,
          payerEmail: (cardData.cardholderEmail || payerEmail || customerEmail).trim(),
          cardholderName: cardholderName.trim(),
          makeDefault: paymentMethods.length === 0
        })
      });
      const data = (await response.json()) as { error?: string; detail?: string };
      if (!response.ok) {
        throw new Error(data.detail || data.error || "No se pudo guardar la tarjeta");
      }

      await fetchPaymentMethods();
      setPaymentMethodMessage("Tarjeta guardada correctamente.");
      setEditingPayments(false);
    } catch (e) {
      setPaymentMethodError(e instanceof Error ? e.message : "No se pudo guardar la tarjeta");
    } finally {
      setSavingPaymentMethod(false);
    }
  };

  const setDefaultPaymentMethod = async (paymentMethodId: string) => {
    setPaymentMethodError("");
    setPaymentMethodMessage("");
    try {
      const response = await fetch("/api/marketplace/client/payment-methods", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: paymentMethodId, makeDefault: true })
      });
      const data = (await response.json()) as { error?: string; detail?: string };
      if (!response.ok) {
        throw new Error(data.detail || data.error || "No se pudo actualizar la tarjeta principal");
      }
      await fetchPaymentMethods();
      setPaymentMethodMessage("Tarjeta principal actualizada.");
    } catch (e) {
      setPaymentMethodError(e instanceof Error ? e.message : "No se pudo actualizar la tarjeta principal");
    }
  };

  const deletePaymentMethod = async (paymentMethodId: string) => {
    setPaymentMethodError("");
    setPaymentMethodMessage("");
    try {
      const response = await fetch("/api/marketplace/client/payment-methods", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: paymentMethodId })
      });
      const data = (await response.json()) as { error?: string; detail?: string };
      if (!response.ok) {
        throw new Error(data.detail || data.error || "No se pudo eliminar la tarjeta");
      }
      await fetchPaymentMethods();
      setPaymentMethodMessage("Tarjeta eliminada correctamente.");
    } catch (e) {
      setPaymentMethodError(e instanceof Error ? e.message : "No se pudo eliminar la tarjeta");
    }
  };

  const paymentMethodLabel = (paymentMethod: PaymentMethod) => {
    const base = paymentMethod.brand?.trim() || paymentMethod.paymentMethodId?.trim() || "Tarjeta";
    const expiry =
      paymentMethod.expirationMonth && paymentMethod.expirationYear
        ? ` · ${String(paymentMethod.expirationMonth).padStart(2, "0")}/${String(paymentMethod.expirationYear).slice(-2)}`
        : "";
    return `${base} terminada en ${paymentMethod.last4}${expiry}`;
  };

  const saveAddress = async () => {
    const nextAddress = addressDraft.trim();
    if (!nextAddress) {
      setError("Ingresa una dirección antes de guardar.");
      return;
    }
    setSavingAddress(true);
    setError("");
    setFeedback("");
    try {
      const response = await fetch(`/api/maps/validate-address?address=${encodeURIComponent(nextAddress)}`);
      const data = (await response.json()) as {
        valid?: boolean;
        normalizedAddress?: string;
        commune?: string | null;
        error?: string;
      };

      if (!response.ok || !data.valid) {
        throw new Error(data.error || "No pudimos validar esa dirección con Google.");
      }

      const normalizedAddress = data.normalizedAddress?.trim() || nextAddress;
      setCustomAddress(normalizedAddress);
      setAddressDraft(normalizedAddress);
      setEditingAddress(false);
      setShowSuggestions(false);
      setAddressSuggestions([]);
      setFeedback(data.commune ? `Dirección validada y guardada para ${data.commune}.` : "Dirección validada y guardada en tu panel.");
      try {
        window.localStorage.setItem("wetask_customer_address", normalizedAddress);
      } catch {
        // noop
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos validar la dirección.");
    } finally {
      setSavingAddress(false);
    }
  };

  const selectAddressSuggestion = (value: string) => {
    setAddressDraft(value);
    setSelectedFromAutocomplete(true);
    setAddressSuggestions([]);
    setShowSuggestions(false);
  };

  const statusClassByBooking = (status: string) => {
    if (status === "COMPLETED") return "status-completed";
    if (status === "CANCELLED" || status === "REFUNDED") return "status-cancelled";
    if (status === "ACCEPTED" || status === "IN_PROGRESS" || status === "ASSIGNED" || status === "CONFIRMED") {
      return "status-accepted";
    }
    return "status-pending";
  };
  const statusLabelByBooking = (status: string) => STATUS_LABELS[status] ?? status;

  return (
    <main className="auth-flow-screen auth-flow-screen-scroll market-shell-auth">
      <div className="auth-flow-backdrop" aria-hidden />

      <div className="login-screen-content market-shell-auth-content">
        <MarketNav />

        <section className="auth-flow-shell auth-flow-shell-wide client-dashboard-hero">
          <div className="auth-flow-copy client-dashboard-copy">
            <p className="auth-flow-kicker">Panel cliente</p>
            <h1>Gestiona tus reservas con el mismo look de WeTask.</h1>
            <p>Revisa tus próximas visitas, historial, avisos importantes y vuelve a reservar en segundos desde un solo panel.</p>

            <div className="auth-flow-copy-list client-dashboard-summary">
              <div className="auth-flow-meta-card">
                <strong>Próximas reservas</strong>
                <span>{upcomingBookings.length} servicio(s) programado(s).</span>
              </div>
              <div className="auth-flow-meta-card">
                <strong>Historial</strong>
                <span>{historyBookings.length} servicio(s) completados o pasados.</span>
              </div>
              <div className="auth-flow-meta-card">
                <strong>Notificaciones</strong>
                <span>{notifications.length} aviso(s) disponible(s) para revisar.</span>
              </div>
            </div>

            <div className="auth-flow-actions">
              <Link href={servicesHref} className="cta">
                Buscar servicio
              </Link>
              <button className="cta ghost" type="button" onClick={() => void refreshDashboard()} disabled={!sessionUserId}>
                Actualizar panel
              </button>
            </div>
          </div>

          <section className="auth-flow-panel auth-flow-panel-wide client-dashboard-profile-panel">
            <div className="panel-head client-dashboard-panel-head">
              <h2>Tu perfil</h2>
              <p>Tu foto y accesos rápidos del lado cliente.</p>
            </div>

            <div className="client-profile-box client-profile-box-auth">
              <div className="client-photo-frame">
                {customerPhotoUrl ? <img src={customerPhotoUrl} alt="Foto del cliente" className="client-photo-img" /> : <span>Sin foto</span>}
                <label className="client-photo-upload client-photo-upload-floating">
                  Cambiar
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoChange} />
                </label>
              </div>
              <div className="client-profile-copy">
                <h3>{customerName}</h3>
                <p>Dirección por defecto</p>
                <strong className="client-profile-address">{displayedAddress}</strong>
                {editingAddress ? (
                  <div className="client-address-editor">
                    <input
                      value={addressDraft}
                      onChange={(event) => {
                        setAddressDraft(event.target.value);
                        setSelectedFromAutocomplete(false);
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(addressSuggestions.length > 0)}
                      placeholder="Ingresa tu dirección"
                    />
                    {autocompleteLoading ? <p className="input-hint">Buscando direcciones en Google...</p> : null}
                    {showSuggestions && addressSuggestions.length > 0 ? (
                      <div className="address-suggestions">
                        {addressSuggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            className="address-suggestion-btn"
                            onClick={() => selectAddressSuggestion(suggestion)}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <p className="input-hint">Guardaremos la dirección validada con Google para evitar errores al reservar.</p>
                    <div className="client-profile-actions">
                      <button className="cta small" type="button" onClick={() => void saveAddress()} disabled={savingAddress}>
                        {savingAddress ? "Validando..." : "Guardar dirección"}
                      </button>
                      <button
                        className="cta ghost small"
                        type="button"
                        onClick={() => {
                          setAddressDraft(displayedAddress);
                          setEditingAddress(false);
                          setAddressSuggestions([]);
                          setShowSuggestions(false);
                          setSelectedFromAutocomplete(false);
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : null}
                <div className="client-profile-actions">
                  <button className="cta ghost small" type="button" onClick={() => setEditingAddress((current) => !current)}>
                    Editar dirección
                  </button>
                  <Link className="cta small" href={servicesHref}>
                    Explorar servicios
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </section>

        <div className="page client-dashboard-sections">
          {feedback ? <p className="feedback ok">{feedback}</p> : null}
          {error ? <p className="feedback error">{error}</p> : null}

          <section className="auth-flow-panel client-dashboard-section">
            <div className="panel-head client-dashboard-panel-head">
              <h2>Medios de pago</h2>
              <p>Guarda tu tarjeta con Mercado Pago para tenerla lista en futuras reservas.</p>
            </div>

            {paymentMethodMessage ? <p className="feedback ok">{paymentMethodMessage}</p> : null}
            {paymentMethodError ? <p className="feedback error">{paymentMethodError}</p> : null}

            <div className="client-payment-methods-list">
              {loadingPaymentMethods ? (
                <p className="empty">Cargando tarjetas guardadas...</p>
              ) : paymentMethods.length === 0 ? (
                <p className="empty">Aún no tienes tarjetas guardadas. Agrega una para pagar más rápido después.</p>
              ) : (
                paymentMethods.map((paymentMethod) => (
                  <article key={paymentMethod.id} className="client-payment-method-card">
                    <div>
                      <strong>{paymentMethodLabel(paymentMethod)}</strong>
                      <p>{paymentMethod.payerEmail || customerEmail || "Email no informado"}</p>
                    </div>
                    <div className="client-payment-method-actions">
                      {paymentMethod.isDefault ? <span className="status status-completed">Principal</span> : null}
                      {!paymentMethod.isDefault ? (
                        <button className="cta ghost small" type="button" onClick={() => void setDefaultPaymentMethod(paymentMethod.id)}>
                          Dejar principal
                        </button>
                      ) : null}
                      <button className="cta ghost small" type="button" onClick={() => void deletePaymentMethod(paymentMethod.id)}>
                        Eliminar
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>

            <div className="client-profile-actions">
              <button className="cta small" type="button" onClick={() => setEditingPayments((current) => !current)}>
                {editingPayments ? "Cerrar formulario" : "Agregar tarjeta"}
              </button>
            </div>

            {editingPayments ? (
              <div className="client-payment-method-editor">
                {!process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ? (
                  <p className="feedback error">Configura `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` para guardar tarjetas.</p>
                ) : (
                  <>
                    <form
                      id="client-payment-card-form"
                      className="grid-form auth-flow-form"
                      onSubmit={(event) => event.preventDefault()}
                    >
                      <label>
                        Nombre del titular
                        <input
                          id="client-payment-cardholder-name"
                          type="text"
                          value={cardholderName}
                          onChange={(event) => setCardholderName(event.target.value)}
                          placeholder="Como aparece en tu tarjeta"
                        />
                      </label>
                      <label>
                        Email del titular
                        <input
                          id="client-payment-cardholder-email"
                          type="email"
                          value={payerEmail}
                          onChange={(event) => setPayerEmail(event.target.value)}
                          placeholder="correo@ejemplo.com"
                        />
                      </label>
                      <label className="full">
                        Número de tarjeta
                        <div id="client-payment-card-number" className="mp-secure-field" />
                      </label>
                      <label>
                        Vencimiento
                        <div id="client-payment-expiration-date" className="mp-secure-field" />
                      </label>
                      <label>
                        Código de seguridad
                        <div id="client-payment-security-code" className="mp-secure-field" />
                      </label>
                      <label>
                        Cuotas
                        <select id="client-payment-installments" defaultValue="" />
                      </label>
                      <label>
                        Banco emisor
                        <select id="client-payment-issuer" defaultValue="" />
                      </label>
                      <label>
                        Tipo de identificación
                        <select id="client-payment-identification-type" defaultValue="" />
                      </label>
                      <label>
                        Número de identificación
                        <input id="client-payment-identification-number" type="text" placeholder="RUT / documento" />
                      </label>
                    </form>

                    <div className="client-profile-actions">
                      <button className="cta small" type="button" onClick={() => void savePaymentMethod()} disabled={savingPaymentMethod || !paymentFormReady}>
                        {savingPaymentMethod ? "Guardando..." : "Guardar tarjeta"}
                      </button>
                    </div>
                    <p className="minimal-note">Tu tarjeta se guarda en Mercado Pago. WeTask solo conserva una referencia segura y los últimos 4 dígitos.</p>
                  </>
                )}
              </div>
            ) : null}
          </section>

          <section className="auth-flow-panel client-dashboard-section">
            <div className="panel-head client-dashboard-panel-head">
              <h2>Resumen rápido</h2>
              <p>Tu actividad actual dentro de la plataforma.</p>
            </div>
            <div className="module-grid client-dashboard-metrics">
              <article className="module-card client-dashboard-metric">
                <h3>Próximas</h3>
                <p>{upcomingBookings.length} reserva(s) programada(s)</p>
              </article>
              <article className="module-card client-dashboard-metric">
                <h3>Historial</h3>
                <p>{historyBookings.length} servicio(s) realizado(s)</p>
              </article>
              <article className="module-card client-dashboard-metric">
                <h3>Servicios</h3>
                <p>{bookings.length} servicio(s) en total</p>
              </article>
            </div>
          </section>

          <section className="auth-flow-panel client-dashboard-section">
            <div className="panel-head client-dashboard-panel-head">
              <h2>Notificaciones</h2>
              <p>Mensajes y actualizaciones sobre tus reservas.</p>
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
                    <p>{new Date(item.createdAt).toLocaleString("es-ES")}</p>
                  </article>
                ))
              )}
            </div>
          </section>

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
                      <span className={`status ${statusClassByBooking(booking.status)}`}>{statusLabelByBooking(booking.status)}</span>
                    </div>
                    <p className="client-booking-eyebrow">{bookingEyebrow(booking.status, booking.scheduledAt)}</p>
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
        </div>
      </div>
    </main>
  );
}
