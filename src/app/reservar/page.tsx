"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { MarketNav } from "@/components/market-nav";
import { parseCleaningRecommendedHours } from "@/lib/cleaning-duration-estimator";
import { COVERAGE_UNAVAILABLE_MESSAGE, inferCommuneFromAddress, normalizeCommune } from "@/lib/communes";
import { formatPaymentRejectionReason } from "@/lib/payment-rejection";

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

function mergeContiguousSlots(slots: Slot[]) {
  if (slots.length === 0) return [] as Slot[];

  const sorted = [...slots].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const merged: Slot[] = [];

  for (const slot of sorted) {
    const currentServiceId = slot.service?.id ?? null;
    const previous = merged[merged.length - 1];
    const previousServiceId = previous?.service?.id ?? null;

    if (!previous) {
      merged.push({ ...slot });
      continue;
    }

    const previousEndsAt = new Date(previous.endsAt).getTime();
    const currentStartsAt = new Date(slot.startsAt).getTime();
    const currentEndsAt = new Date(slot.endsAt).getTime();
    const canMerge = previousServiceId === currentServiceId && currentStartsAt <= previousEndsAt;

    if (!canMerge) {
      merged.push({ ...slot });
      continue;
    }

    if (currentEndsAt > previousEndsAt) {
      previous.endsAt = slot.endsAt;
    }
  }

  return merged;
}

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

function clampBookingHours(value: number) {
  return Math.min(8, Math.max(1, Math.floor(value || 1)));
}

function clp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

function isoDay(value: string): string {
  return value.slice(0, 10);
}

function firstOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addMonths(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

function startOffsetMonday(value: Date) {
  return (value.getDay() + 6) % 7;
}

function formatSlotRange(slot: Slot) {
  return `${new Date(slot.startsAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })} - ${new Date(slot.endsAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`;
}

function durationHours(slot: Slot) {
  const start = new Date(slot.startsAt).getTime();
  const end = new Date(slot.endsAt).getTime();
  return Math.max(0.5, Math.round(((end - start) / 36e5) * 2) / 2);
}

function starsText(value: number) {
  const rounded = Math.max(0, Math.min(5, Math.round(value || 0)));
  return `${"★".repeat(rounded)}${"☆".repeat(5 - rounded)}`;
}

function addHours(dateValue: Date, hours: number) {
  return new Date(dateValue.getTime() + hours * 60 * 60 * 1000);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("es-CL");
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
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

  const [matches, setMatches] = useState<MatchProfessional[]>([]);
  const [selectedProId, setSelectedProId] = useState("");
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [selectedStartAt, setSelectedStartAt] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => firstOfMonth(new Date()));

  const [hours, setHours] = useState(2);
  const [recommendedHours, setRecommendedHours] = useState<number | null>(null);
  const [estimatedHoursRange, setEstimatedHoursRange] = useState("");
  const [details, setDetails] = useState("");
  const [dietaryFlags, setDietaryFlags] = useState<string[]>([]);
  const [dietaryNotes, setDietaryNotes] = useState("");

  const [createdBooking, setCreatedBooking] = useState<BookingResponse | null>(null);
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [bookingStep, setBookingStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [preferredStartsAt, setPreferredStartsAt] = useState("");
  const [quickCheckoutEnabled, setQuickCheckoutEnabled] = useState(false);
  const [pinnedTaskerMode, setPinnedTaskerMode] = useState(false);
  const mercadoPagoPublicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ?? "";

  const selectedPro = useMemo(() => matches.find((pro) => pro.userId === selectedProId) ?? null, [matches, selectedProId]);
  const selectedService = useMemo(() => services.find((service) => service.id === filters.serviceId) ?? null, [services, filters.serviceId]);
  const isChefService = Boolean(selectedService?.slug?.startsWith("cocina-") || selectedService?.slug === "reposteria" || selectedService?.slug === "cumpleanos");
  const quickCheckoutMode = quickCheckoutEnabled && !createdBooking && !pinnedTaskerMode;
  const selectedSavedPaymentMethod = useMemo(
    () => savedPaymentMethods.find((item) => item.isDefault) ?? savedPaymentMethods[0] ?? null,
    [savedPaymentMethods]
  );

  const mergedSelectedProSlots = useMemo(() => mergeContiguousSlots(selectedPro?.slots ?? []), [selectedPro]);

  const dayGroups = useMemo(() => {
    if (!selectedPro) return [] as Array<[string, Slot[]]>;
    const map = new Map<string, Slot[]>();
    for (const slot of mergedSelectedProSlots) {
      const key = isoDay(slot.startsAt);
      const prev = map.get(key) ?? [];
      prev.push(slot);
      map.set(key, prev);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [mergedSelectedProSlots, selectedPro]);

  const selectedSlots = useMemo(() => dayGroups.find(([day]) => day === selectedDay)?.[1] ?? [], [dayGroups, selectedDay]);
  const availableDays = useMemo(() => new Map(dayGroups.map(([day, slots]) => [day, slots])), [dayGroups]);
  const calendarCells = useMemo(() => {
    const start = firstOfMonth(calendarMonth);
    const offset = startOffsetMonday(start);
    const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;
    return Array.from({ length: totalCells }, (_, index) => {
      const dayNumber = index - offset + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) return null;
      const date = new Date(start.getFullYear(), start.getMonth(), dayNumber);
      const iso = date.toISOString().slice(0, 10);
      const slots = availableDays.get(iso) ?? [];
      return {
        iso,
        dayNumber,
        slotsCount: slots.length,
        hasAvailability: slots.length > 0
      };
    });
  }, [availableDays, calendarMonth]);

  const selectedSlot = useMemo(() => {
    if (!selectedPro || !selectedSlotId) return null;
    return mergedSelectedProSlots.find((slot) => slot.id === selectedSlotId) ?? null;
  }, [mergedSelectedProSlots, selectedPro, selectedSlotId]);

  const selectedStartOptions = useMemo(() => {
    if (!selectedSlot) return [] as Array<{ value: string; label: string }>;
    const options: Array<{ value: string; label: string }> = [];
    const start = new Date(selectedSlot.startsAt);
    const end = new Date(selectedSlot.endsAt);
    const latestStart = new Date(end.getTime() - 60 * 60 * 1000);

    for (let current = new Date(start); current <= latestStart; current = addHours(current, 1)) {
      options.push({
        value: current.toISOString(),
        label: formatTime(current.toISOString())
      });
    }

    return options;
  }, [selectedSlot]);

  const selectedBookingStartAt = useMemo(() => {
    if (!selectedSlot) return "";
    if (selectedStartAt && selectedStartOptions.some((option) => option.value === selectedStartAt)) return selectedStartAt;
    return selectedSlot.startsAt;
  }, [selectedSlot, selectedStartAt, selectedStartOptions]);

  const selectedDurationOptions = useMemo(() => {
    if (!selectedSlot || !selectedBookingStartAt) return [] as number[];
    const start = new Date(selectedBookingStartAt);
    const end = new Date(selectedSlot.endsAt);
    const diffHours = Math.floor((end.getTime() - start.getTime()) / (60 * 60 * 1000));
    return Array.from({ length: Math.max(0, Math.min(8, diffHours)) }, (_, index) => index + 1);
  }, [selectedBookingStartAt, selectedSlot]);

  const selectedBookingEndsAt = useMemo(() => {
    if (!selectedBookingStartAt || !hours) return "";
    return addHours(new Date(selectedBookingStartAt), hours).toISOString();
  }, [selectedBookingStartAt, hours]);

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
  const subtotal = baseHourly * hours;
  const commission = Math.round(subtotal * 0.12);
  const total = subtotal + commission;
  const bookingSteps = [
    { id: 1 as const, label: "Servicio" },
    { id: 2 as const, label: pinnedTaskerMode ? "Dirección" : "Ubicación" },
    { id: 3 as const, label: pinnedTaskerMode ? "Horario" : "Tasker" },
    { id: 4 as const, label: "Detalles" },
    { id: 5 as const, label: "Pago" }
  ];
  const canGoToStep2 = Boolean(filters.serviceId);
  const canGoToStep3 = pinnedTaskerMode ? Boolean(selectedPro) : matches.length > 0;
  const canGoToStep4 = Boolean(selectedPro && selectedSlot);
  const canGoToStep5 = Boolean(selectedPro && selectedSlot && selectedBookingStartAt);
  const canAdvanceFromCurrent =
    (bookingStep === 1 && canGoToStep2) ||
    (bookingStep === 2 && canGoToStep3) ||
    (bookingStep === 3 && canGoToStep4) ||
    (bookingStep === 4 && canGoToStep5) ||
    bookingStep === 5;

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
    const startsAt = params.get("startsAt");
    const suggestedHours = parseCleaningRecommendedHours(params.get("recommendedHours"));
    const estimatedMinHours = params.get("estimatedMinHours");
    const estimatedMaxHours = params.get("estimatedMaxHours");
    const addressLine = params.get("address");
    const city = params.get("city");
    const commune = params.get("commune") ?? params.get("comuna");
    const postalCode = params.get("postalCode");
    const hasBookingAddress = Boolean(addressLine || city || commune || postalCode);
    const hasPinnedTasker = Boolean(proId);

    if (serviceId) setFilters((prev) => ({ ...prev, serviceId }));
    if (proId) setSelectedProId(proId);
    if (startsAt) {
      setPreferredStartsAt(startsAt);
      setQuickCheckoutEnabled(hasBookingAddress && !hasPinnedTasker);
      const derivedDate = startsAt.slice(0, 10);
      if (derivedDate) {
        setFilters((prev) => ({ ...prev, date: derivedDate }));
      }
    }
    if (hasPinnedTasker) {
      setPinnedTaskerMode(true);
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
        const data = (await response.json()) as { session?: { userId: string } | null };
        if (data.session?.userId) setCustomerId(data.session.userId);
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
        const response = await fetch("/api/marketplace/client/payment-methods");
        const data = (await response.json()) as { paymentMethods?: SavedPaymentMethod[] };
        if (response.ok) {
          setSavedPaymentMethods(data.paymentMethods ?? []);
        }
      } catch {
        // noop
      }
    };

    void loadSavedPaymentMethods();
  }, [customerId]);

  useEffect(() => {
    const nextKey =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? `wtk_checkout_${crypto.randomUUID()}`
        : `wtk_checkout_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setCheckoutIdempotencyKey(nextKey);
  }, [customerId, selectedSlotId, selectedBookingStartAt, filters.serviceId, hours, address.street, address.commune]);

  useEffect(() => {
    if (!selectedSlot) return;
    setSelectedStartAt(selectedSlot.startsAt);
    setHours(Math.max(1, Math.min(8, Math.floor(durationHours(selectedSlot)))));
    setBookingStep(4);
  }, [selectedSlot]);

  useEffect(() => {
    if (!selectedStartOptions.length) return;
    if (!selectedStartOptions.some((option) => option.value === selectedStartAt)) {
      setSelectedStartAt(selectedStartOptions[0]?.value ?? "");
    }
  }, [selectedStartAt, selectedStartOptions]);

  useEffect(() => {
    if (!selectedDurationOptions.length) return;
    if (!selectedDurationOptions.includes(hours)) {
      setHours(selectedDurationOptions[0] ?? 1);
    }
  }, [hours, selectedDurationOptions]);

  useEffect(() => {
    if (!selectedDay) return;
    setCalendarMonth(firstOfMonth(new Date(`${selectedDay}T00:00:00`)));
  }, [selectedDay]);

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

  const loadProfessionals = async (options?: { preferredProId?: string; preferredStartsAt?: string; silent?: boolean }) => {
    setError("");
    if (!options?.silent) setMessage("");
    setSelectedSlotId("");
    setSelectedDay("");

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
        slots: item.slots
      }));

      setMatches(normalized);
      if (normalized[0]) {
        const preferredPro = options?.preferredProId ? normalized.find((item) => item.userId === options.preferredProId) ?? null : null;
        const nextPro = preferredPro ?? normalized[0];
        setSelectedProId(nextPro.userId);

        const preferredSlot = options?.preferredStartsAt
          ? nextPro.slots.find((slot) => slot.startsAt === options.preferredStartsAt) ?? null
          : null;

        if (preferredSlot) {
          setSelectedDay(isoDay(preferredSlot.startsAt));
          setSelectedSlotId(preferredSlot.id);
        } else {
          const firstDay = isoDay(nextPro.slots[0]?.startsAt ?? "");
          if (firstDay) setSelectedDay(firstDay);
        }

        const resolvedServiceId = filters.serviceId || resolveServiceIdForProfessional(nextPro, preferredSlot);
        if (resolvedServiceId && resolvedServiceId !== filters.serviceId) {
          setFilters((prev) => ({ ...prev, serviceId: resolvedServiceId }));
        }

        if (options?.preferredStartsAt && !preferredSlot) {
          setQuickCheckoutEnabled(false);
          setError("No pudimos reconstruir el horario que elegiste. Vuelve a seleccionar un bloque disponible para continuar.");
        }
      } else if (options?.preferredProId || options?.preferredStartsAt) {
        setQuickCheckoutEnabled(false);
        setError("No pudimos recuperar el tasker o el horario seleccionado. Revisa los bloques disponibles e inténtalo nuevamente.");
      }

      if (!options?.silent) {
        setMessage(`${normalized.length} tasker(s) encontrados para tu dirección.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoadingSearch(false);
    }
  };

  const searchPros = async (event: FormEvent) => {
    event.preventDefault();
    setQuickCheckoutEnabled(false);
    await loadProfessionals();
  };

  useEffect(() => {
    if ((!quickCheckoutEnabled && !pinnedTaskerMode) || !selectedProId || !services.length) return;
    void loadProfessionals({
      preferredProId: selectedProId,
      preferredStartsAt,
      silent: true
    });
  }, [filters.serviceId, pinnedTaskerMode, preferredStartsAt, quickCheckoutEnabled, selectedProId, services.length]);

  useEffect(() => {
    setCardFormReady(false);
    setCheckoutState("idle");
    setCheckoutStatusText("");
    if (!selectedSlot || !mpSdkReady || !mercadoPagoPublicKey || selectedSavedPaymentMethod) return;
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
  }, [selectedSavedPaymentMethod, selectedSlot, mpSdkReady, mercadoPagoPublicKey, total]);

  const submitCheckout = async () => {
    if (!customerId || !selectedPro || !selectedSlot || !filters.serviceId || !selectedBookingStartAt) {
      setError("Completa cliente, profesional, servicio y horario.");
      return;
    }
    if (!selectedSavedPaymentMethod && (!cardFormReady || !checkoutFormRef.current)) {
      setError("Formulario de pago aún cargando. Espera unos segundos.");
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

      const cardData = selectedSavedPaymentMethod ? ({} as CardFormData) : ((checkoutFormRef.current.getCardFormData?.() ?? {}) as CardFormData);
      if (!selectedSavedPaymentMethod && (!cardData.token || !cardData.paymentMethodId)) {
        throw new Error("No pudimos tokenizar tu tarjeta. Revisa los datos e inténtalo nuevamente.");
      }

      const payerEmail = (selectedSavedPaymentMethod?.payerEmail || cardData.cardholderEmail || "").trim();

      const safeHours = clampBookingHours(hours);

      const response = await fetch("/api/bookings/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          serviceId: filters.serviceId,
          proId: selectedPro.userId,
          slotId: selectedSlot.id,
          startsAt: selectedBookingStartAt,
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
            token: cardData.token,
            paymentMethodId: selectedSavedPaymentMethod?.paymentMethodId ?? cardData.paymentMethodId,
            issuerId: cardData.issuerId,
            installments: Number(cardData.installments || 1),
            payerEmail: payerEmail || undefined,
            payerIdentificationType: cardData.identificationType,
            payerIdentificationNumber: cardData.identificationNumber,
            savedCardId: selectedSavedPaymentMethod?.id
          },
          idempotencyKey: checkoutIdempotencyKey
        })
      });

      const data = (await response.json()) as {
        booking?: BookingResponse;
        payment?: { status?: string; providerStatus?: string; errorCode?: string | null; errorMessage?: string | null };
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
        const paymentReason = formatPaymentRejectionReason({
          errorCode: data.payment?.errorCode,
          errorMessage: data.payment?.errorMessage,
          providerStatus: data.payment?.providerStatus
        });
        setCheckoutState("rejected");
        setCheckoutStatusText("Pago rechazado");
        setError(
          paymentReason.friendly
            ? `${paymentReason.friendly}${paymentReason.rawCode && paymentReason.rawCode !== paymentReason.friendly ? ` (${paymentReason.rawCode})` : ""}`
            : "El pago fue rechazado. Puedes intentar con otra tarjeta."
        );
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
          <div className="auth-flow-copy client-dashboard-copy booking-flow-hero-copy">
            <p className="auth-flow-kicker">Reserva protegida</p>
            <h1>{pinnedTaskerMode ? "Revisa la agenda y reserva con tu tasker." : "Agenda, compara y paga en un solo flujo."}</h1>
            <p>
              {pinnedTaskerMode
                ? "Ya vienes con un tasker elegido. Selecciona un bloque disponible, revisa los detalles del servicio y confirma tu reserva con pago protegido dentro de WeTask."
                : "Elige el servicio, encuentra profesionales disponibles en tu zona y confirma tu reserva con pago seguro dentro de WeTask. Tu dinero queda retenido hasta que confirmes o venza el plazo sin reclamo."}
            </p>

            <div className="auth-flow-copy-list client-dashboard-summary">
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
              {pinnedTaskerMode ? (
                <div className="auth-flow-meta-card">
                  <strong>Tasker</strong>
                  <span>{selectedPro?.fullName ?? "Cargando tasker elegido"}</span>
                </div>
              ) : null}
            </div>
          </div>
          <aside className="auth-flow-panel booking-summary-panel booking-summary-panel-inline">
            <div className="booking-summary-card">
              <strong>Estado de tu reserva</strong>
              <div className="booking-summary-list">
                <span className={filters.serviceId ? "is-complete" : ""}>1. Servicio seleccionado</span>
                <span className={(pinnedTaskerMode ? Boolean(selectedPro) : matches.length > 0) ? "is-complete" : ""}>
                  {pinnedTaskerMode ? "2. Tasker cargado" : "2. Taskers encontrados"}
                </span>
                <span className={selectedSlot ? "is-complete" : ""}>{pinnedTaskerMode ? "3. Horario definido" : "3. Horario elegido"}</span>
                <span className={checkoutState === "approved" ? "is-complete" : ""}>4. Pago retenido y protegido</span>
              </div>
              <div className="auth-flow-note-card">
                <strong>Resumen rápido</strong>
                <span>
                  {selectedPro
                    ? `${selectedPro.fullName} · ${selectedBookingStartAt ? formatDateTime(selectedBookingStartAt) : "falta horario"}`
                    : pinnedTaskerMode
                      ? "Cargando tasker elegido."
                      : "Aún no eliges profesional."}
                </span>
              </div>
            </div>
          </aside>
        </section>

        <div className="page client-dashboard-sections booking-flow-sections">
          <section className="auth-flow-panel client-dashboard-section">
            {quickCheckoutMode ? (
              <>
                <div className="panel-head auth-flow-panel-head">
                  <h2>Resumen antes de confirmar</h2>
                  <p>Ya vienes con tasker y horario elegidos. Aquí solo revisas el resumen y continúas al pago.</p>
                </div>

                <div className="booking-checkout-summary">
                  <p>
                    Servicio: <strong>{selectedService?.name ?? "Servicio seleccionado"}</strong>
                  </p>
                  <p>
                    Tasker: <strong>{selectedPro?.fullName ?? "Cargando profesional"}</strong>
                  </p>
                  <p>
                    Fecha y hora: <strong>{selectedBookingStartAt ? formatDateTime(selectedBookingStartAt) : "Cargando horario"}</strong>
                  </p>
                  <p>
                    Dirección: <strong>{address.street}, {address.commune}, {address.city}</strong>
                  </p>
                </div>

                <div className="cta-row">
                  <button className="cta ghost" type="button" onClick={() => setQuickCheckoutEnabled(false)}>
                    Editar búsqueda
                  </button>
                </div>
              </>
            ) : pinnedTaskerMode ? (
              <>
                <div className="panel-head auth-flow-panel-head">
                  <h2>Tasker y dirección de la reserva</h2>
                  <p>Ya vienes con el tasker elegido. Revisa tu dirección y sigue directo a la agenda para escoger el horario.</p>
                </div>

                <div className="booking-checkout-summary">
                  <p>
                    Tasker: <strong>{selectedPro?.fullName ?? "Cargando tasker"}</strong>
                  </p>
                  <p>
                    Servicio: <strong>{selectedService?.name ?? "Servicio seleccionado"}</strong>
                  </p>
                  <p>
                    Dirección: <strong>{address.street}, {address.commune}, {address.city}</strong>
                  </p>
                  <p>
                    Estado: <strong>{selectedSlot ? "Horario definido dentro del bloque" : "Falta elegir horario"}</strong>
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="panel-head auth-flow-panel-head">
                  <h2>Busca tu servicio</h2>
                  <p>Completa la ubicación, elige la fecha deseada y encuentra taskers disponibles en tiempo real.</p>
                </div>

                <form className="grid-form auth-flow-form" onSubmit={searchPros}>
                  <label>
                    Ciudad
                    <input value={address.city} onChange={(e) => setAddress((prev) => ({ ...prev, city: e.target.value }))} required />
                  </label>
                  <label>
                    Comuna
                    <input value={address.commune} onChange={(e) => setAddress((prev) => ({ ...prev, commune: e.target.value }))} required />
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

          <div className={`booking-flow-grid ${quickCheckoutMode ? "booking-flow-grid-compact" : ""} ${pinnedTaskerMode ? "booking-flow-grid-pinned" : ""}`}>
            {!quickCheckoutMode && !pinnedTaskerMode ? (
              <section className="auth-flow-panel client-dashboard-section">
                <div className="panel-head auth-flow-panel-head">
                  <h2>Taskers disponibles</h2>
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
                        <strong>Rating:</strong>{" "}
                        {pro.ratingsCount > 0 ? `${starsText(pro.ratingAvg)} ${pro.ratingAvg.toFixed(1)} (${pro.ratingsCount})` : "0.0 (0 valoraciones)"}
                      </p>
                      <p>
                        <strong>Precio/hora:</strong> {pro.hourlyRateFromClp ? clp(pro.hourlyRateFromClp) : "Por definir"}
                      </p>
                      <p>
                        <strong>Próxima hora:</strong> {pro.nextAvailableAt ? new Date(pro.nextAvailableAt).toLocaleString("es-ES") : "Sin slots"}
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
                  {!loadingSearch && matches.length === 0 ? <p className="empty">Aún no hay profesionales cargados para esta búsqueda.</p> : null}
                </div>
              </section>
            ) : null}

            {selectedPro && bookingStep >= 3 ? (
              <div className="booking-selection-column">
                <section className="auth-flow-panel client-dashboard-section booking-pro-profile-panel">
                  <div className="panel-head auth-flow-panel-head">
                    <h2>Perfil del tasker</h2>
                    <p>Revisa su información principal y luego elige horario en la agenda.</p>
                  </div>

                  <div className="booking-pro-card">
                    <div className="booking-pro-card-head">
                      <div className="booking-pro-avatar" aria-hidden>
                        {initials(selectedPro.fullName)}
                      </div>
                      <div>
                        <h3>{selectedPro.fullName}</h3>
                        <p>{selectedPro.ratingsCount > 0 ? `${starsText(selectedPro.ratingAvg)} ${selectedPro.ratingAvg.toFixed(1)} · ${selectedPro.ratingsCount} reseñas` : "0.0 · 0 reseñas"}</p>
                      </div>
                    </div>

                    <div className="booking-pro-highlights">
                      <article>
                        <span>Precio por hora</span>
                        <strong>{selectedPro.hourlyRateFromClp ? clp(selectedPro.hourlyRateFromClp) : "Por definir"}</strong>
                      </article>
                      <article>
                        <span>Próximo bloque</span>
                        <strong>{selectedPro.nextAvailableAt ? new Date(selectedPro.nextAvailableAt).toLocaleString("es-CL") : "Sin bloques"}</strong>
                      </article>
                    </div>

                    <div className="booking-pro-meta">
                      <p>Este bloque es solo para revisar el perfil rápido del profesional antes de reservar.</p>
                    </div>

                    <div className="cta-row">
                      <Link className="cta ghost small" href={`/pro/${selectedPro.userId}`}>
                        Ver perfil completo
                      </Link>
                    </div>
                  </div>
                </section>

                <section className="auth-flow-panel client-dashboard-section booking-agenda-section">
                  <div className="panel-head auth-flow-panel-head">
                    <h2>Agenda y detalles de la reserva</h2>
                    <p>Elige un día, selecciona un bloque del tasker y luego define tu hora de inicio y duración dentro de ese bloque.</p>
                  </div>

                  <div className="booking-month-calendar">
                    <div className="booking-month-calendar-head">
                      <button type="button" className="day-tab" onClick={() => setCalendarMonth((current) => addMonths(current, -1))}>
                        Mes anterior
                      </button>
                      <strong>{calendarMonth.toLocaleDateString("es-CL", { month: "long", year: "numeric" })}</strong>
                      <button type="button" className="day-tab" onClick={() => setCalendarMonth((current) => addMonths(current, 1))}>
                        Mes siguiente
                      </button>
                    </div>

                    <div className="booking-month-weekdays">
                      {["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"].map((label) => (
                        <span key={label}>{label}</span>
                      ))}
                    </div>

                    <div className="booking-month-grid">
                      {calendarCells.map((cell, index) =>
                        cell ? (
                          <button
                            key={cell.iso}
                            type="button"
                            className={`booking-month-day ${cell.hasAvailability ? "is-available" : ""} ${selectedDay === cell.iso ? "is-selected" : ""}`}
                            onClick={() => {
                              setSelectedDay(cell.iso);
                              setSelectedSlotId("");
                            }}
                          >
                            <strong>{cell.dayNumber}</strong>
                            <span>{cell.hasAvailability ? `${cell.slotsCount} bloque(s)` : "Sin agenda"}</span>
                          </button>
                        ) : (
                          <span key={`empty-${index}`} className="booking-month-day is-empty" aria-hidden />
                        )
                      )}
                    </div>
                  </div>

                  <div className="booking-slot-list">
                    {selectedSlots.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        className={`booking-slot-card ${selectedSlotId === slot.id ? "is-active" : ""}`}
                        onClick={() => setSelectedSlotId(slot.id)}
                      >
                        <strong>{formatSlotRange(slot)}</strong>
                        <span>{Math.floor(durationHours(slot))} hora(s) disponibles en este bloque</span>
                        <small>Elige este bloque para definir inicio y duración abajo</small>
                      </button>
                    ))}
                  </div>

                  {!selectedSlots.length ? <p className="minimal-note booking-agenda-empty">Este día todavía no tiene bloques disponibles.</p> : null}

                  <div className="grid-form auth-flow-form booking-agenda-form">
                    <label>
                      Hora de inicio
                      <select value={selectedBookingStartAt} onChange={(e) => setSelectedStartAt(e.target.value)} disabled={!selectedSlot}>
                        {selectedStartOptions.length === 0 ? (
                          <option value="">Elige un bloque primero</option>
                        ) : (
                          selectedStartOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))
                        )}
                      </select>
                    </label>
                    <label>
                      Duración del servicio
                      <select value={String(hours)} onChange={(e) => setHours(clampBookingHours(Number(e.target.value)))} disabled={!selectedSlot}>
                        {selectedDurationOptions.length === 0 ? (
                          <option value="">Elige un bloque primero</option>
                        ) : (
                          selectedDurationOptions.map((duration) => (
                            <option key={duration} value={String(duration)}>
                              {duration} hora(s)
                            </option>
                          ))
                        )}
                      </select>
                      {recommendedHours ? (
                        <small className="input-hint">
                          Recomendación WeTask: {estimatedHoursRange ? `${estimatedHoursRange} · ` : ""}
                          reserva sugerida {recommendedHours} hora(s).
                        </small>
                      ) : null}
                    </label>
                    {selectedSlot && selectedBookingStartAt && selectedBookingEndsAt ? (
                      <div className="full auth-flow-note-card auth-flow-note-card-compact booking-range-note">
                        <strong>Horario elegido</strong>
                        <span>
                          {formatDateTime(selectedBookingStartAt)} a {formatTime(selectedBookingEndsAt)} dentro del bloque del tasker.
                        </span>
                      </div>
                    ) : null}
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

                  <div className="booking-invoice-card">
                    <strong>Resumen del cobro</strong>
                    <div className="booking-invoice-line">
                      <span>Valor por hora</span>
                      <span>{clp(baseHourly)}</span>
                    </div>
                    <div className="booking-invoice-line">
                      <span>Duración del bloque</span>
                      <span>{hours} h</span>
                    </div>
                    <div className="booking-invoice-line">
                      <span>Subtotal servicio</span>
                      <span>{clp(subtotal)}</span>
                    </div>
                    <div className="booking-invoice-line">
                      <span>Comisión WeTask</span>
                      <span>{clp(commission)}</span>
                    </div>
                    <div className="booking-invoice-line is-total">
                      <span>Total estimado</span>
                      <span>{clp(total)}</span>
                    </div>
                  </div>
                  {recommendedHours ? (
                    <p className="minimal-note">
                      Tiempo recomendado para este servicio: <strong>{recommendedHours} hora(s)</strong>
                      {estimatedHoursRange ? ` · Rango estimado ${estimatedHoursRange}` : ""}
                    </p>
                  ) : null}
                  <p className="minimal-note">Pago seguro procesado por Mercado Pago. El cobro queda protegido hasta tu confirmación o hasta que venza el plazo sin reclamo.</p>
                </section>
              </div>
            ) : null}
          </div>

          {selectedPro ? (
            <section className="auth-flow-panel client-dashboard-section booking-checkout-section">
              <div className="panel-head auth-flow-panel-head">
                <h2>Checkout</h2>
                <p>Confirma el horario elegido y completa el pago con Mercado Pago sin salir de WeTask.</p>
              </div>

              <div className="booking-checkout-summary">
                <p>
                  Servicio: <strong>{selectedService?.name ?? "Servicio seleccionado"}</strong>
                </p>
                <p>
                  Fecha y hora: <strong>{selectedBookingStartAt ? formatDateTime(selectedBookingStartAt) : "Selecciona un horario"}</strong>
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
                <p className="feedback error">Configura `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` para habilitar pagos.</p>
              ) : null}

              {selectedSavedPaymentMethod ? (
                <div className="auth-flow-note-card">
                  <strong>Tarjeta usada para esta reserva</strong>
                  <span>{paymentMethodLabel(selectedSavedPaymentMethod)}</span>
                </div>
              ) : (
                <form id="mp-card-form" className="grid-form auth-flow-form" onSubmit={(event) => event.preventDefault()}>
                  <label>
                    Nombre del titular
                    <input id="mp-cardholder-name" type="text" placeholder="Como aparece en tu tarjeta" />
                  </label>
                  <label>
                    Email pagador
                    <input id="mp-cardholder-email" type="email" placeholder="correo@ejemplo.com" />
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
              )}

              <div className="cta-row">
                <button
                  className="cta"
                  type="button"
                  onClick={submitCheckout}
                  disabled={loadingCheckout || !selectedSlot || !selectedBookingStartAt || (!selectedSavedPaymentMethod && !cardFormReady)}
                >
                  {loadingCheckout ? "Procesando pago..." : "Pagar y confirmar reserva"}
                </button>
                <Link className="cta ghost" href="/cliente">
                  Ver mis reservas
                </Link>
              </div>

              {checkoutState === "processing" ? <p className="feedback ok">Procesando pago...</p> : null}
              {checkoutState === "approved" ? <p className="feedback ok">Pago aprobado. Redirigiendo a tu confirmación...</p> : null}
              {checkoutState === "rejected" ? <p className="feedback error">{error || "Pago rechazado. Revisa los datos o prueba otra tarjeta."}</p> : null}
              {checkoutState === "connection_error" ? <p className="feedback error">Error de conexión con el proveedor de pago.</p> : null}
              {checkoutStatusText ? <p className="minimal-note">Estado checkout: {checkoutStatusText}</p> : null}
              {createdBooking ? (
                <p className="minimal-note">
                  Reserva {createdBooking.id} · Estado {createdBooking.status} · Pago {createdBooking.paymentStatus}
                </p>
              ) : null}
            </section>
          ) : null}

          <div className="booking-mobile-footer">
            <button className="cta ghost" type="button" onClick={() => setBookingStep((current) => Math.max(1, current - 1) as 1 | 2 | 3 | 4 | 5)} disabled={bookingStep === 1}>
              Volver
            </button>
            <button
              className="cta"
              type="button"
              disabled={!canAdvanceFromCurrent || bookingStep === 5}
              onClick={() => setBookingStep((current) => Math.min(5, current + 1) as 1 | 2 | 3 | 4 | 5)}
            >
              {bookingStep === 4 ? "Ir a pago" : "Continuar"}
            </button>
          </div>

          {message ? <p className="feedback ok">{message}</p> : null}
          {error && checkoutState !== "rejected" && checkoutState !== "connection_error" ? <p className="feedback error">{error}</p> : null}
        </div>
      </div>
    </main>
  );
}
