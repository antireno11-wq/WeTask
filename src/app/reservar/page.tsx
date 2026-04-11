"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { MarketNav } from "@/components/market-nav";
import { getChefServiceDefinition } from "@/lib/chef-service-types";
import { parseCleaningRecommendedHours } from "@/lib/cleaning-duration-estimator";
import { ACTIVE_MVP_COMMUNES, COVERAGE_UNAVAILABLE_MESSAGE, inferCommuneFromAddress, normalizeCommune } from "@/lib/communes";

export const dynamic = "force-dynamic";

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
  taskerServices: Array<{ serviceId: string | null; serviceName: string | null }>;
  slots: Slot[];
};

type BookingResponse = {
  id: string;
  status: string;
  paymentStatus: string;
  totalPriceClp: number;
};

type SavedPaymentMethod = {
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
  installments?: string | number;
  cardholderEmail?: string;
  identificationType?: string;
  identificationNumber?: string;
};

const DIETARY_OPTIONS = [
  "Sin gluten",
  "Sin lactosa",
  "APLV",
  "Vegetariana",
  "Vegana",
  "Sin frutos secos",
  "Otra alergia o indicación"
] as const;

const BOOKING_HOUR_OPTIONS = Array.from({ length: 8 }, (_, index) => index + 1);

function clampBookingHours(value: number) {
  return Math.min(8, Math.max(1, Math.floor(value || 1)));
}

function clp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

function isoDay(value: string): string {
  return value.slice(0, 10);
}

function isFutureSlot(slot: Slot): boolean {
  return new Date(slot.endsAt).getTime() > Date.now();
}

function starsText(value: number) {
  const rounded = Math.max(1, Math.min(5, Math.round(value || 0)));
  return `${"★".repeat(rounded)}${"☆".repeat(5 - rounded)}`;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() ?? "")
    .join("");
}

function paymentMethodLabel(paymentMethod: SavedPaymentMethod) {
  const base = paymentMethod.brand?.trim() || paymentMethod.paymentMethodId?.trim() || "Tarjeta";
  const expiry =
    paymentMethod.expirationMonth && paymentMethod.expirationYear
      ? ` · ${String(paymentMethod.expirationMonth).padStart(2, "0")}/${String(paymentMethod.expirationYear).slice(-2)}`
      : "";
  return `${base} terminada en ${paymentMethod.last4}${expiry}`;
}

function formatBookingDateTime(value: string) {
  return new Date(value).toLocaleString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function buildStartOptions(slot: Slot | null) {
  if (!slot) return [] as string[];
  const startMs = new Date(slot.startsAt).getTime();
  const endMs = new Date(slot.endsAt).getTime();
  const options: string[] = [];

  for (let cursor = startMs; cursor + 60 * 60 * 1000 <= endMs; cursor += 60 * 60 * 1000) {
    options.push(new Date(cursor).toISOString());
  }

  return options;
}

function buildHourOptions(slot: Slot | null, selectedStartAt: string) {
  if (!slot || !selectedStartAt) return BOOKING_HOUR_OPTIONS;
  const startMs = new Date(selectedStartAt).getTime();
  const endMs = new Date(slot.endsAt).getTime();
  const availableWholeHours = Math.max(1, Math.floor((endMs - startMs) / (60 * 60 * 1000)));
  const maxHours = Math.min(8, availableWholeHours);
  return BOOKING_HOUR_OPTIONS.filter((value) => value <= maxHours);
}

export default function ReservarPage() {
  const router = useRouter();
  const checkoutFormRef = useRef<any>(null);

  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [checkoutState, setCheckoutState] = useState<"idle" | "processing" | "approved" | "rejected" | "connection_error">("idle");
  const [checkoutStatusText, setCheckoutStatusText] = useState("");
  const [mpSdkReady, setMpSdkReady] = useState(false);
  const [cardFormReady, setCardFormReady] = useState(false);
  const [checkoutIdempotencyKey, setCheckoutIdempotencyKey] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [address, setAddress] = useState({
    city: "Santiago",
    commune: "Providencia",
    postalCode: "7500000",
    street: "Av. Providencia 1550",
    latitude: "",
    longitude: ""
  });

  const [filters, setFilters] = useState({
    serviceId: "",
    date: new Date().toISOString().slice(0, 10)
  });

  const [customerId, setCustomerId] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  const [matches, setMatches] = useState<MatchProfessional[]>([]);
  const [selectedProId, setSelectedProId] = useState("");
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [selectedStartAt, setSelectedStartAt] = useState("");
  const [bookingStage, setBookingStage] = useState<"agenda" | "checkout">("agenda");
  const [taskerFlowLocked, setTaskerFlowLocked] = useState(false);

  const [hours, setHours] = useState(2);
  const [recommendedHours, setRecommendedHours] = useState<number | null>(null);
  const [estimatedHoursRange, setEstimatedHoursRange] = useState("");
  const [details, setDetails] = useState("");
  const [dietaryFlags, setDietaryFlags] = useState<string[]>([]);
  const [dietaryNotes, setDietaryNotes] = useState("");

  const [createdBooking, setCreatedBooking] = useState<BookingResponse | null>(null);
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [loadingSavedPaymentMethods, setLoadingSavedPaymentMethods] = useState(false);
  const [selectedSavedPaymentMethodId, setSelectedSavedPaymentMethodId] = useState("");
  const [showNewCardForm, setShowNewCardForm] = useState(false);
  const [preferredSlotId, setPreferredSlotId] = useState("");
  const [preferredStartsAt, setPreferredStartsAt] = useState("");
  const mercadoPagoPublicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ?? "";

  const selectedPro = useMemo(() => matches.find((pro) => pro.userId === selectedProId) ?? null, [matches, selectedProId]);
  const selectedService = useMemo(() => services.find((service) => service.id === filters.serviceId) ?? null, [services, filters.serviceId]);
  const selectedSavedPaymentMethod = useMemo(
    () => savedPaymentMethods.find((paymentMethod) => paymentMethod.id === selectedSavedPaymentMethodId) ?? null,
    [savedPaymentMethods, selectedSavedPaymentMethodId]
  );
  const isChefService = Boolean(selectedService?.slug && getChefServiceDefinition(selectedService.slug));
  const quickCheckoutMode = taskerFlowLocked;

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

  const startOptions = useMemo(() => buildStartOptions(selectedSlot), [selectedSlot]);

  const hourOptions = useMemo(() => buildHourOptions(selectedSlot, selectedStartAt), [selectedSlot, selectedStartAt]);

  const resolveServiceIdForProfessional = (professional: MatchProfessional | null, slot?: Slot | null) => {
    return (
      slot?.service?.id ||
      professional?.slots.find((item) => item.service?.id)?.service?.id ||
      professional?.taskerServices.find((item) => item.serviceId)?.serviceId ||
      ""
    );
  };

  const bookingDetails = useMemo(() => {
    const sections = [details.trim()].filter(Boolean);
    if (isChefService) {
      const dietarySummary = dietaryFlags.length > 0 ? dietaryFlags.join(", ") : "";
      const extraNotes = dietaryNotes.trim();
      if (dietarySummary || extraNotes) {
        sections.push(
          [
            "Información sobre alimentación:",
            dietarySummary ? `Preferencias o restricciones: ${dietarySummary}.` : "",
            extraNotes ? `Detalle adicional: ${extraNotes}` : ""
          ]
            .filter(Boolean)
            .join(" ")
        );
      }
    }
    return sections.join("\n\n");
  }, [details, dietaryFlags, dietaryNotes, isChefService]);

  const baseHourly = selectedPro?.hourlyRateFromClp ?? services.find((s) => s.id === filters.serviceId)?.basePriceClp ?? 0;
  const extrasTotal = 0;
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
      const hasPinnedBookingContext =
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).has("proId");
      if (!filters.serviceId && list[0] && !hasPinnedBookingContext) {
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
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const serviceId = params.get("serviceId");
    const proId = params.get("proId");
    const slotId = params.get("slotId");
    const startsAt = params.get("startsAt");
    const suggestedHours = parseCleaningRecommendedHours(params.get("recommendedHours"));
    const estimatedMinHours = params.get("estimatedMinHours");
    const estimatedMaxHours = params.get("estimatedMaxHours");
    const addressLine = params.get("address");
    const city = params.get("city");
    const commune = params.get("commune") ?? params.get("comuna");
    const postalCode = params.get("postalCode");
    if (serviceId) setFilters((prev) => ({ ...prev, serviceId }));
    if (proId) setSelectedProId(proId);
    if (slotId) setPreferredSlotId(slotId);
    if (startsAt) {
      setPreferredStartsAt(startsAt);
      const derivedDate = startsAt.slice(0, 10);
      if (derivedDate) {
        setFilters((prev) => ({ ...prev, date: derivedDate }));
      }
    }
    if (proId) {
      setTaskerFlowLocked(true);
    }
    if (suggestedHours) {
      const safeSuggestedHours = clampBookingHours(suggestedHours);
      setRecommendedHours(safeSuggestedHours);
      setHours(safeSuggestedHours);
    }
    if (estimatedMinHours && estimatedMaxHours) {
      setEstimatedHoursRange(`${estimatedMinHours} a ${estimatedMaxHours} horas`);
    }
    if (addressLine || city || postalCode) {
      setAddress((prev) => ({
        ...prev,
        street: addressLine || prev.street,
        city: city || prev.city,
        commune: commune || prev.commune,
        postalCode: postalCode || prev.postalCode
      }));
    }
  }, []);

  useEffect(() => {
    const bootstrapSession = async () => {
      try {
        const response = await fetch("/api/auth/session");
        const data = (await response.json()) as { session?: { userId?: string; email?: string | null } | null };
        if (data.session?.userId) setCustomerId(data.session.userId);
        if (data.session?.email) setCustomerEmail(data.session.email);
      } catch {
        // noop
      }
    };
    void bootstrapSession();
  }, []);

  useEffect(() => {
    if (!customerId) return;
    const loadSavedPaymentMethods = async () => {
      try {
        setLoadingSavedPaymentMethods(true);
        const response = await fetch("/api/marketplace/client/payment-methods");
        const data = (await response.json()) as { paymentMethods?: SavedPaymentMethod[] };
        if (response.ok) {
          const paymentMethods = data.paymentMethods ?? [];
          setSavedPaymentMethods(paymentMethods);
          const defaultPaymentMethod = paymentMethods.find((item) => item.isDefault) ?? paymentMethods[0] ?? null;
          setSelectedSavedPaymentMethodId(defaultPaymentMethod?.id ?? "");
          setShowNewCardForm(paymentMethods.length === 0);
        }
      } catch {
        // noop
      } finally {
        setLoadingSavedPaymentMethods(false);
      }
    };

    void loadSavedPaymentMethods();
  }, [customerId]);

  useEffect(() => {
    if (!selectedSlot) {
      setSelectedStartAt("");
      return;
    }

    const nextStartAt = startOptions.includes(selectedStartAt)
      ? selectedStartAt
      : startOptions[0] ?? new Date(selectedSlot.startsAt).toISOString();
    if (nextStartAt !== selectedStartAt) {
      setSelectedStartAt(nextStartAt);
      return;
    }

    if (!hourOptions.includes(hours)) {
      setHours(hourOptions[hourOptions.length - 1] ?? 1);
    }
  }, [selectedSlot, selectedStartAt, startOptions, hourOptions, hours]);

  useEffect(() => {
    const nextKey =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? `wtk_checkout_${crypto.randomUUID()}`
        : `wtk_checkout_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setCheckoutIdempotencyKey(nextKey);
  }, [customerId, selectedSlotId, filters.serviceId, hours, address.street, address.commune]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as any).MercadoPago) {
      setMpSdkReady(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://sdk.mercadopago.com/js/v2";
    script.async = true;
    script.onload = () => setMpSdkReady(true);
    script.onerror = () => {
      setMpSdkReady(false);
      setCheckoutState("connection_error");
      setCheckoutStatusText("No pudimos cargar el SDK de Mercado Pago.");
    };
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  const useGeolocation = async () => {
    if (!navigator.geolocation) {
      setError("Tu navegador no soporta geolocalización");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setAddress((prev) => ({
          ...prev,
          latitude: position.coords.latitude.toString(),
          longitude: position.coords.longitude.toString()
        }));
        setMessage("Ubicación detectada. Ahora busca profesionales.");
      },
      () => {
        setError("No pudimos obtener tu ubicación");
      }
    );
  };

  const loadPinnedProfessional = async (options: { preferredProId: string; preferredSlotId?: string; preferredStartsAt?: string }) => {
    const response = await fetch(`/api/marketplace/pros/${options.preferredProId}`);
    const data = (await response.json()) as {
      professional?: {
        id: string;
        userId: string;
        ratingAvg: number;
        ratingsCount: number;
        hourlyRateFromClp: number | null;
        coverageCity: string | null;
        serviceRadiusKm: number;
        taskerServices?: Array<{ priceClp: number; service?: { id: string; name: string } | null }>;
        user: { fullName: string };
        slots: Slot[];
      };
    };

    if (!response.ok || !data.professional) {
      return false;
    }

    const professional = data.professional;
    const pinnedMatch: MatchProfessional = {
      id: professional.id,
      userId: professional.userId,
      fullName: professional.user.fullName,
      ratingAvg: Number(professional.ratingAvg ?? 0),
      ratingsCount: professional.ratingsCount ?? 0,
      hourlyRateFromClp: professional.hourlyRateFromClp,
      distanceKm: 0,
      nextAvailableAt: professional.slots[0]?.startsAt ?? null,
      coverageCity: professional.coverageCity,
      serviceRadiusKm: professional.serviceRadiusKm,
      taskerServices: (professional.taskerServices ?? []).map((taskerService) => ({
        serviceId: taskerService.service?.id ?? null,
        serviceName: taskerService.service?.name ?? null
      })),
      slots: (professional.slots ?? []).filter(isFutureSlot)
    };

    setMatches([pinnedMatch]);
    setSelectedProId(pinnedMatch.userId);

    const preferredSlotById = options.preferredSlotId ? pinnedMatch.slots.find((slot) => slot.id === options.preferredSlotId) ?? null : null;
    const preferredSlotByStart = options.preferredStartsAt
      ? pinnedMatch.slots.find((slot) => slot.startsAt === options.preferredStartsAt) ?? null
      : null;
    const preferredSlotByDay = options.preferredStartsAt
      ? pinnedMatch.slots.find((slot) => isoDay(slot.startsAt) === isoDay(options.preferredStartsAt ?? "")) ?? null
      : null;
    const preferredSlot = preferredSlotById ?? preferredSlotByStart ?? preferredSlotByDay ?? pinnedMatch.slots[0] ?? null;

    if (preferredSlot) {
      setSelectedDay(isoDay(preferredSlot.startsAt));
      setSelectedSlotId(preferredSlot.id);
      setSelectedStartAt(new Date(preferredSlotByStart?.startsAt ?? preferredSlot.startsAt).toISOString());
    }

    const resolvedServiceId = filters.serviceId || resolveServiceIdForProfessional(pinnedMatch, preferredSlot);
    if (resolvedServiceId && resolvedServiceId !== filters.serviceId) {
      setFilters((prev) => ({ ...prev, serviceId: resolvedServiceId }));
    }

    return true;
  };

  const loadProfessionals = async (options?: { preferredProId?: string; preferredSlotId?: string; preferredStartsAt?: string; silent?: boolean }) => {
    setError("");
    if (!options?.silent) setMessage("");
    setSelectedSlotId("");
    setSelectedDay("");
    setSelectedStartAt("");
    setBookingStage("agenda");

    try {
      setLoadingSearch(true);
      const params = new URLSearchParams({
        city: address.city,
        commune: normalizeCommune(address.commune) ?? inferCommuneFromAddress(address.street) ?? address.commune,
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
          taskerServices?: Array<{ priceClp: number; serviceId: string | null; service?: { id: string; name: string } | null }>;
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
        taskerServices: (item.taskerServices ?? []).map((taskerService) => ({
          serviceId: taskerService.service?.id ?? taskerService.serviceId ?? null,
          serviceName: taskerService.service?.name ?? null
        })),
        slots: item.slots.filter(isFutureSlot)
      }));

      let resolvedMatches = normalized;

      if (resolvedMatches.length === 0 && options?.preferredProId) {
        const pinnedLoaded = await loadPinnedProfessional({
          preferredProId: options.preferredProId,
          preferredSlotId: options.preferredSlotId,
          preferredStartsAt: options.preferredStartsAt
        });

        if (pinnedLoaded) {
          if (!options?.silent) {
            setMessage("Recuperamos el tasker seleccionado para que continúes con la reserva.");
          }
          return;
        }
      }

      setMatches(resolvedMatches);
      if (resolvedMatches[0]) {
        const preferredPro = options?.preferredProId ? resolvedMatches.find((item) => item.userId === options.preferredProId) ?? null : null;
        const nextPro = preferredPro ?? resolvedMatches[0];
        setSelectedProId(nextPro.userId);

        const preferredSlotById = options?.preferredSlotId ? nextPro.slots.find((slot) => slot.id === options.preferredSlotId) ?? null : null;
        const preferredSlotByStart = options?.preferredStartsAt
          ? nextPro.slots.find((slot) => slot.startsAt === options.preferredStartsAt) ?? null
          : null;
        const preferredSlotByDay = options?.preferredStartsAt
          ? nextPro.slots.find((slot) => isoDay(slot.startsAt) === isoDay(options.preferredStartsAt!)) ?? null
          : null;
        const preferredSlot = preferredSlotById ?? preferredSlotByStart ?? preferredSlotByDay;

        if (preferredSlot) {
          setSelectedDay(isoDay(preferredSlot.startsAt));
          setSelectedSlotId(preferredSlot.id);
          setSelectedStartAt(new Date(preferredSlotByStart?.startsAt ?? preferredSlot.startsAt).toISOString());
        } else {
          const firstDay = isoDay(nextPro.slots[0]?.startsAt ?? "");
          if (firstDay) setSelectedDay(firstDay);
        }

        const resolvedServiceId = filters.serviceId || resolveServiceIdForProfessional(nextPro, preferredSlot);
        if (resolvedServiceId && resolvedServiceId !== filters.serviceId) {
          setFilters((prev) => ({ ...prev, serviceId: resolvedServiceId }));
        }

        if ((options?.preferredSlotId || options?.preferredStartsAt) && !preferredSlot) {
          setError("No pudimos reconstruir el horario que elegiste. Vuelve a seleccionar un bloque disponible para continuar.");
        }
      } else if (options?.preferredProId || options?.preferredSlotId || options?.preferredStartsAt) {
        setError("No pudimos recuperar el tasker o el horario seleccionado. Revisa los bloques disponibles e inténtalo nuevamente.");
      }

      if (!options?.silent) {
        setMessage(`${resolvedMatches.length} tasker(s) encontrados para tu dirección.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoadingSearch(false);
    }
  };

  const searchPros = async (event: FormEvent) => {
    event.preventDefault();
    setTaskerFlowLocked(false);
    setBookingStage("agenda");
    await loadProfessionals();
  };

  useEffect(() => {
    if (!selectedProId || services.length === 0) return;
    if (matches.some((professional) => professional.userId === selectedProId)) return;

    void loadProfessionals({
      preferredProId: selectedProId,
      preferredSlotId,
      preferredStartsAt,
      silent: true
    });
  }, [filters.serviceId, preferredSlotId, preferredStartsAt, selectedProId, services.length, matches]);

  useEffect(() => {
    setCardFormReady(false);
    if (!showNewCardForm) return;
    setCheckoutState("idle");
    setCheckoutStatusText("");
    if (!selectedSlot || !mpSdkReady || !mercadoPagoPublicKey) return;
    if (typeof window === "undefined") return;
    const MercadoPagoCtor = (window as any).MercadoPago;
    if (!MercadoPagoCtor) return;

    const mount = async () => {
      try {
        const mp = new MercadoPagoCtor(mercadoPagoPublicKey, { locale: "es-CL" });
        const cardForm = mp.cardForm({
          amount: String(total),
          iframe: true,
          form: {
            id: "mp-card-form",
            cardholderName: { id: "mp-cardholder-name" },
            cardholderEmail: { id: "mp-cardholder-email" },
            cardNumber: { id: "mp-card-number" },
            expirationDate: { id: "mp-expiration-date" },
            securityCode: { id: "mp-security-code" },
            installments: { id: "mp-installments" },
            identificationType: { id: "mp-identification-type" },
            identificationNumber: { id: "mp-identification-number" },
            issuer: { id: "mp-issuer" }
          }
        });
        checkoutFormRef.current = cardForm;
        setCardFormReady(true);
      } catch {
        setCardFormReady(false);
        setCheckoutState("connection_error");
        setCheckoutStatusText("No pudimos inicializar el formulario de pago.");
      }
    };

    void mount();

    return () => {
      try {
        checkoutFormRef.current?.unmount?.();
        checkoutFormRef.current?.destroy?.();
      } catch {
        // noop
      } finally {
        checkoutFormRef.current = null;
      }
    };
  }, [selectedSlot, mpSdkReady, mercadoPagoPublicKey, total, showNewCardForm]);

  const submitCheckout = async () => {
    if (!customerId || !selectedPro || !selectedSlot || !selectedStartAt || !filters.serviceId) {
      setError("Completa cliente, profesional, servicio y horario.");
      return;
    }
    if (showNewCardForm && (!cardFormReady || !checkoutFormRef.current)) {
      setError("Formulario de pago aún cargando. Espera unos segundos.");
      return;
    }
    if (!showNewCardForm && !selectedSavedPaymentMethod) {
      setError("Selecciona una tarjeta guardada o agrega una nueva para continuar.");
      return;
    }

    setError("");
    setMessage("");
    setCheckoutState("processing");
    setCheckoutStatusText("Procesando pago...");
    setLoadingCheckout(true);

    try {
      const bookingCommune = normalizeCommune(address.commune) ?? inferCommuneFromAddress(address.street);
      if (!bookingCommune) {
        setError(COVERAGE_UNAVAILABLE_MESSAGE);
        setCheckoutState("rejected");
        setCheckoutStatusText("Pago rechazado por comuna fuera de cobertura.");
        return;
      }

      const cardData = showNewCardForm ? ((checkoutFormRef.current?.getCardFormData?.() ?? {}) as CardFormData) : null;
      if (showNewCardForm && (!cardData?.token || !cardData.paymentMethodId)) {
        throw new Error("No pudimos tokenizar tu tarjeta. Revisa los datos e inténtalo nuevamente.");
      }

      const payerEmail = (
        selectedSavedPaymentMethod?.payerEmail ||
        cardData?.cardholderEmail ||
        customerEmail ||
        ""
      ).trim();
      if (!payerEmail) {
        throw new Error("Ingresa un correo válido para procesar el pago.");
      }

      const safeHours = clampBookingHours(hours);

      const response = await fetch("/api/bookings/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          serviceId: filters.serviceId,
          proId: selectedPro.userId,
          slotId: selectedSlot.id,
          startsAt: selectedStartAt,
          hours: safeHours,
          address: {
            street: address.street,
            commune: bookingCommune,
            city: address.city,
            postalCode: address.postalCode,
            region: address.city
          },
          details: bookingDetails,
          extras: {
            materials: false,
            urgency: false,
            travelFeeClp: 0
          },
          payment: {
            token: cardData?.token,
            paymentMethodId: selectedSavedPaymentMethod?.paymentMethodId ?? cardData?.paymentMethodId,
            issuerId: cardData?.issuerId,
            installments: Number(cardData?.installments || 1),
            payerEmail,
            payerIdentificationType: cardData?.identificationType,
            payerIdentificationNumber: cardData?.identificationNumber,
            savedCardId: showNewCardForm ? undefined : selectedSavedPaymentMethod?.id
          },
          idempotencyKey: checkoutIdempotencyKey
        })
      });

      const data = (await response.json()) as {
        booking?: BookingResponse;
        payment?: { status?: string; providerStatus?: string };
        error?: string;
        detail?: string;
      };
      if (!response.ok || !data.booking) {
        throw new Error(data.detail || data.error || "No se pudo completar el checkout");
      }

      setCreatedBooking(data.booking);
      const paymentStatus = String(data.payment?.status ?? data.booking.paymentStatus);
      if (data.booking.status === "CONFIRMED" && paymentStatus === "PAID") {
        setCheckoutState("approved");
        setCheckoutStatusText("Pago aprobado");
        setMessage(`Reserva confirmada: ${data.booking.id}`);
        setTimeout(() => {
          router.push(`/booking/${data.booking!.id}`);
        }, 800);
      } else if (data.booking.status === "PAYMENT_FAILED" || paymentStatus === "FAILED") {
        setCheckoutState("rejected");
        setCheckoutStatusText("Pago rechazado");
        setError("El pago fue rechazado. Puedes intentar con otra tarjeta.");
      } else {
        setCheckoutState("processing");
        setCheckoutStatusText("Pago en proceso. Te avisaremos apenas se confirme.");
      }
    } catch (e) {
      const detail = e instanceof Error ? e.message : "Error inesperado";
      setCheckoutState("connection_error");
      setCheckoutStatusText("Error de conexión");
      setError(detail);
    } finally {
      setLoadingCheckout(false);
    }
  };

  return (
    <main className="auth-flow-screen auth-flow-screen-scroll market-shell-auth booking-flow-page">
      <div className="auth-flow-backdrop" aria-hidden />

      <div className="login-screen-content market-shell-auth-content">
        <MarketNav />

        <section className="auth-flow-shell auth-flow-shell-wide client-dashboard-hero booking-flow-hero">
          <article className="auth-flow-panel client-dashboard-section booking-flow-hero-card">
            <div className="booking-flow-hero-content">
              <div className="booking-flow-hero-copy">
                <p className="auth-flow-kicker booking-flow-hero-kicker">Reserva protegida</p>
                <h1>Agenda, compara y paga en un solo flujo.</h1>
                <p>Elige el servicio, encuentra profesionales disponibles en tu zona y confirma tu reserva con pago seguro dentro de WeTask.</p>
              </div>

              <div className="auth-flow-copy-list client-dashboard-summary booking-flow-hero-summary">
                <div className="auth-flow-meta-card">
                  <strong>Dirección</strong>
                  <span>{address.street}, {address.commune}</span>
                </div>
                <div className="auth-flow-meta-card">
                  <strong>Servicio</strong>
                  <span>{selectedService?.name ?? "Selecciona un servicio"}</span>
                </div>
                <div className="auth-flow-meta-card">
                  <strong>Total estimado</strong>
                  <span>{selectedPro ? clp(total) : "Busca profesionales para calcularlo"}</span>
                </div>
              </div>

              <div className="booking-summary-card booking-summary-card-inline">
                <strong>Estado de tu reserva</strong>
                <div className="booking-summary-list">
                  <span className={filters.serviceId ? "is-complete" : ""}>1. Servicio seleccionado</span>
                  <span className={matches.length > 0 ? "is-complete" : ""}>2. Profesionales encontrados</span>
                  <span className={selectedStartAt ? "is-complete" : ""}>3. Horario elegido</span>
                  <span className={checkoutState === "approved" ? "is-complete" : ""}>4. Pago confirmado</span>
                </div>
                <div className="auth-flow-note-card booking-flow-note-card">
                  <strong>Resumen rápido</strong>
                  <span>{selectedPro ? `${selectedPro.fullName} · ${selectedStartAt ? formatBookingDateTime(selectedStartAt) : "falta horario"}` : "Aún no eliges profesional."}</span>
                </div>
              </div>
            </div>
          </article>
        </section>

        <div className="page client-dashboard-sections booking-flow-sections">
          <section className="auth-flow-panel client-dashboard-section">
            {quickCheckoutMode ? (
              <>
                <div className="panel-head auth-flow-panel-head">
                  <h2>Tasker seleccionado</h2>
                  <p>Ya elegiste un tasker. En este paso solo define la fecha, la hora de inicio y cuántas horas quieres reservar.</p>
                </div>

                <div className="booking-checkout-summary">
                  <p>
                    Servicio: <strong>{selectedService?.name ?? "Servicio seleccionado"}</strong>
                  </p>
                  <p>
                    Tasker: <strong>{selectedPro?.fullName ?? "Cargando profesional"}</strong>
                  </p>
                  <p>
                    Fecha y hora: <strong>{selectedStartAt ? formatBookingDateTime(selectedStartAt) : "Selecciona bloque y hora"}</strong>
                  </p>
                  <p>
                    Dirección: <strong>{address.street}, {address.commune}, {address.city}</strong>
                  </p>
                </div>

                <div className="cta-row">
                  <button
                    className="cta ghost"
                    type="button"
                    onClick={() => {
                      setTaskerFlowLocked(false);
                      setBookingStage("agenda");
                    }}
                  >
                    Editar búsqueda
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="panel-head auth-flow-panel-head">
                  <h2>Busca tu servicio</h2>
                  <p>Completa la ubicación, elige la fecha deseada y encuentra profesionales disponibles en tiempo real.</p>
                </div>

                <form className="grid-form auth-flow-form" onSubmit={searchPros}>
                  <label>
                    Ciudad
                    <input value={address.city} onChange={(e) => setAddress((prev) => ({ ...prev, city: e.target.value }))} required />
                  </label>
                  <label>
                    Comuna
                    <select value={address.commune} onChange={(e) => setAddress((prev) => ({ ...prev, commune: e.target.value }))} required>
                      {ACTIVE_MVP_COMMUNES.map((commune) => (
                        <option key={commune} value={commune}>
                          {commune}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Código postal
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
                    ID cliente
                    <input value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="cliente demo o real" required />
                  </label>

                  <div className="cta-row">
                    <button className="cta ghost" type="button" onClick={useGeolocation}>
                      Usar geolocalización
                    </button>
                    <button className="cta" type="submit" disabled={loadingSearch || loadingServices}>
                      {loadingSearch ? "Buscando..." : "Buscar profesionales"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </section>

          <div className={`booking-flow-grid ${quickCheckoutMode ? "booking-flow-grid-compact" : ""}`}>
            {!quickCheckoutMode ? (
              <section className="auth-flow-panel client-dashboard-section">
                <div className="panel-head auth-flow-panel-head">
                  <h2>Profesionales disponibles</h2>
                  <p>Ordenados por distancia, disponibilidad, valoración y precio estimado por hora.</p>
                </div>

                <div className="list booking-results-list">
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
                        <strong>Próxima hora:</strong> {pro.nextAvailableAt ? new Date(pro.nextAvailableAt).toLocaleString("es-ES") : "Sin slots"}
                      </p>
                      <p>
                        <strong>Cobertura:</strong> hasta {pro.serviceRadiusKm} km
                      </p>
                      <button
                        className="cta small"
                        type="button"
                        onClick={() => {
                          setSelectedProId(pro.userId);
                          setTaskerFlowLocked(true);
                          setBookingStage("agenda");
                          const firstDay = isoDay(pro.slots[0]?.startsAt ?? "");
                          setSelectedDay(firstDay);
                          setSelectedSlotId("");
                          setSelectedStartAt("");
                        }}
                      >
                        Elegir profesional
                      </button>
                    </article>
                  ))}
                  {!loadingSearch && matches.length === 0 ? <p className="empty">Aún no hay profesionales cargados para esta búsqueda.</p> : null}
                </div>
              </section>
            ) : null}

            {selectedPro ? (
              <div className={quickCheckoutMode ? "booking-selection-column booking-selection-column-wide" : "booking-selection-column"}>
                <section className="auth-flow-panel client-dashboard-section booking-agenda-section">
                  <div className="panel-head auth-flow-panel-head">
                    <h2>Agenda y detalles de la reserva</h2>
                    <p>Selecciona un día, luego elige el bloque, la hora de inicio y la cantidad de horas del servicio.</p>
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
                        onClick={() => {
                          setSelectedSlotId(slot.id);
                          setSelectedStartAt(new Date(slot.startsAt).toISOString());
                        }}
                      >
                        {new Date(slot.startsAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })} -{" "}
                        {new Date(slot.endsAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                      </button>
                    ))}
                  </div>

                  {!selectedSlots.length ? <p className="minimal-note booking-agenda-empty">Este día todavía no tiene bloques disponibles.</p> : null}

                  <div className="grid-form auth-flow-form booking-agenda-form">
                    <label>
                      Hora de inicio
                      <select value={selectedStartAt} onChange={(e) => setSelectedStartAt(e.target.value)} disabled={!selectedSlot}>
                        {!selectedSlot ? <option value="">Primero elige un bloque</option> : null}
                        {startOptions.map((startAt) => (
                          <option key={startAt} value={startAt}>
                            {new Date(startAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Horas (1-8)
                      <select value={hours} onChange={(e) => setHours(clampBookingHours(Number(e.target.value) || 1))} disabled={!selectedSlot}>
                        {hourOptions.map((hourOption) => (
                          <option key={hourOption} value={hourOption}>
                            {hourOption} hora{hourOption === 1 ? "" : "s"}
                          </option>
                        ))}
                      </select>
                      {recommendedHours ? (
                        <small className="input-hint">
                          Recomendación WeTask: {estimatedHoursRange ? `${estimatedHoursRange} · ` : ""}
                          reserva sugerida {recommendedHours} hora(s).
                        </small>
                      ) : null}
                    </label>
                    <label className="full">
                      Detalles del trabajo
                      <textarea value={details} onChange={(e) => setDetails(e.target.value)} />
                    </label>
                    {isChefService ? (
                      <div className="full auth-flow-note-card">
                        <strong>¿Deberíamos saber algo sobre tu alimentación?</strong>
                        <span>Cuéntanos si necesitas comida libre de alérgenos, sin gluten, APLV u otra consideración importante.</span>
                        <div className="inline-checks" style={{ marginTop: 12 }}>
                          {DIETARY_OPTIONS.map((option) => (
                            <label key={option}>
                              <input
                                type="checkbox"
                                checked={dietaryFlags.includes(option)}
                                onChange={(event) =>
                                  setDietaryFlags((current) =>
                                    event.target.checked ? Array.from(new Set([...current, option])) : current.filter((item) => item !== option)
                                  )
                                }
                              />
                              {option}
                            </label>
                          ))}
                        </div>
                        <textarea
                          style={{ marginTop: 12 }}
                          value={dietaryNotes}
                          onChange={(event) => setDietaryNotes(event.target.value)}
                          placeholder="Ejemplo: una persona es celíaca, evitar contaminación cruzada, sin mariscos, menú infantil, etc."
                        />
                      </div>
                    ) : null}
                  </div>

                  <div className="price-box booking-price-box">
                    Resumen en vivo: ({clp(baseHourly)} x {hours}h) + comisión {clp(commission)} = <strong>{clp(total)}</strong>
                  </div>
                  {selectedSlot && selectedStartAt ? (
                    <p className="minimal-note">
                      Horario elegido: <strong>{formatBookingDateTime(selectedStartAt)}</strong> · duración <strong>{hours} hora(s)</strong>
                    </p>
                  ) : null}
                  {recommendedHours ? (
                    <p className="minimal-note">
                      Tiempo recomendado para este servicio: <strong>{recommendedHours} hora(s)</strong>
                      {estimatedHoursRange ? ` · Rango estimado ${estimatedHoursRange}` : ""}
                    </p>
                  ) : null}
                  <div className="cta-row">
                    <button
                      className="cta"
                      type="button"
                      disabled={!selectedSlot || !selectedStartAt}
                      onClick={() => setBookingStage("checkout")}
                    >
                      Continuar al checkout
                    </button>
                  </div>
                </section>
              </div>
            ) : null}
          </div>

          {selectedPro && bookingStage === "checkout" ? (
            <section className="auth-flow-panel client-dashboard-section booking-checkout-section">
              <div className="panel-head auth-flow-panel-head">
                <h2>Checkout</h2>
                <p>Revisa el horario elegido y completa el pago con Mercado Pago.</p>
              </div>

              <div className="booking-checkout-summary">
                <p>
                  Servicio: <strong>{selectedService?.name ?? "Servicio seleccionado"}</strong>
                </p>
                <p>
                  Fecha y hora: <strong>{selectedStartAt ? formatBookingDateTime(selectedStartAt) : "Selecciona un horario"}</strong>
                </p>
                <p>
                  Dirección: <strong>{address.street}, {address.commune}, {address.city}</strong>
                </p>
                <p>
                  Horas estimadas: <strong>{hours}</strong> · Total: <strong>{clp(total)}</strong>
                </p>
                {recommendedHours ? (
                  <p>
                    Recomendación WeTask: <strong>{recommendedHours} hora(s)</strong>
                    {estimatedHoursRange ? ` · ${estimatedHoursRange}` : ""}
                  </p>
                ) : null}
              </div>

              {!mercadoPagoPublicKey ? (
                showNewCardForm ? <p className="feedback error">Configura `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` para habilitar pagos.</p> : null
              ) : null}

              <div className="booking-checkout-saved-methods">
                <div className="panel-head auth-flow-panel-head">
                  <h3>Tus tarjetas guardadas</h3>
                  <p>Guárdalas en tu panel cliente para acelerar futuras reservas con Mercado Pago.</p>
                </div>

                {loadingSavedPaymentMethods ? (
                  <p className="minimal-note">Cargando tarjetas guardadas...</p>
                ) : savedPaymentMethods.length === 0 ? (
                  <p className="minimal-note">Aún no tienes tarjetas guardadas. Puedes agregarlas desde tu panel cliente.</p>
                ) : (
                  <div className="client-payment-methods-list compact">
                    {savedPaymentMethods.map((paymentMethod) => (
                      <button
                        key={paymentMethod.id}
                        type="button"
                        className={`client-payment-method-card compact selectable${selectedSavedPaymentMethodId === paymentMethod.id && !showNewCardForm ? " is-selected" : ""}`}
                        onClick={() => {
                          setSelectedSavedPaymentMethodId(paymentMethod.id);
                          setShowNewCardForm(false);
                          setCheckoutState("idle");
                          setCheckoutStatusText("");
                          setError("");
                        }}
                      >
                        <div>
                          <strong>{paymentMethodLabel(paymentMethod)}</strong>
                          <p>{paymentMethod.isDefault ? "Tarjeta principal" : "Tarjeta guardada"}</p>
                        </div>
                        {selectedSavedPaymentMethodId === paymentMethod.id && !showNewCardForm ? <span>Seleccionada</span> : null}
                      </button>
                    ))}
                  </div>
                )}

                <div className="cta-row booking-checkout-method-actions">
                  <Link className="cta ghost small" href="/cliente">
                    Gestionar tarjetas
                  </Link>
                  {savedPaymentMethods.length > 0 ? (
                    <button
                      className="cta ghost small"
                      type="button"
                      onClick={() => {
                        setShowNewCardForm((prev) => !prev);
                        setCheckoutState("idle");
                        setCheckoutStatusText("");
                        setError("");
                      }}
                    >
                      {showNewCardForm ? "Usar tarjeta guardada" : "Agregar otra tarjeta"}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="cta-row">
                <button className="cta ghost small" type="button" onClick={() => setBookingStage("agenda")}>
                  Volver a la agenda
                </button>
              </div>

              {showNewCardForm ? (
                <form id="mp-card-form" className="grid-form auth-flow-form" onSubmit={(event) => event.preventDefault()}>
                  <label>
                    Nombre del titular
                    <input id="mp-cardholder-name" type="text" placeholder="Como aparece en tu tarjeta" />
                  </label>
                  <label>
                    Email pagador
                    <input id="mp-cardholder-email" type="email" placeholder="correo@ejemplo.com" defaultValue={customerEmail} />
                  </label>
                  <label className="full">
                    Número de tarjeta
                    <div id="mp-card-number" className="mp-secure-field" />
                  </label>
                  <label>
                    Vencimiento
                    <div id="mp-expiration-date" className="mp-secure-field" />
                  </label>
                  <label>
                    Código de seguridad
                    <div id="mp-security-code" className="mp-secure-field" />
                  </label>
                  <label>
                    Cuotas
                    <select id="mp-installments" defaultValue="" />
                  </label>
                  <label>
                    Banco emisor
                    <select id="mp-issuer" defaultValue="" />
                  </label>
                  <label>
                    Tipo de identificación
                    <select id="mp-identification-type" defaultValue="" />
                  </label>
                  <label>
                    Número de identificación
                    <input id="mp-identification-number" type="text" placeholder="RUT / documento" />
                  </label>
                </form>
              ) : null}

              <div className="cta-row">
                <button
                  className="cta"
                  type="button"
                  onClick={submitCheckout}
                  disabled={loadingCheckout || !selectedSlot || !selectedStartAt || (showNewCardForm ? !cardFormReady : !selectedSavedPaymentMethod)}
                >
                  {loadingCheckout ? "Procesando pago..." : "Pagar y confirmar reserva"}
                </button>
                <Link className="cta ghost" href="/cliente">
                  Ver mis reservas
                </Link>
              </div>

              <div className="booking-checkout-feedback-stack">
                {checkoutState === "processing" ? <p className="feedback ok">Procesando pago...</p> : null}
                {checkoutState === "approved" ? <p className="feedback ok">Pago aprobado. Redirigiendo a tu confirmación...</p> : null}
                {checkoutState === "rejected" ? <p className="feedback error">Pago rechazado. Revisa los datos o prueba otra tarjeta.</p> : null}
                {checkoutState === "connection_error" ? <p className="feedback error">Error de conexión con el proveedor de pago.</p> : null}
                {checkoutStatusText ? <p className="minimal-note">Estado checkout: {checkoutStatusText}</p> : null}
                {createdBooking ? (
                  <p className="minimal-note">
                    Reserva {createdBooking.id} · Estado {createdBooking.status} · Pago {createdBooking.paymentStatus}
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}

          {message ? <p className="feedback ok">{message}</p> : null}
          {error ? <p className="feedback error">{error}</p> : null}
        </div>
      </div>
    </main>
  );
}
