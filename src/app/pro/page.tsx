"use client";

import { FormEvent, MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { MarketNav } from "@/components/market-nav";
import { ACTIVE_MVP_COMMUNES, inferCommuneFromAddress, normalizeCommune, normalizeCommuneList } from "@/lib/communes";
import { geocodeAddress } from "@/lib/geo";

const statusOptions = ["ACCEPTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const SANTIAGO_BOUNDS = {
  minLat: -33.62,
  maxLat: -33.3,
  minLng: -70.82,
  maxLng: -70.45
};
const CHILE_CITIES = ["Santiago", "Valparaiso", "Vina del Mar", "Concepcion", "La Serena", "Antofagasta", "Temuco", "Puerto Montt"];
const TASKER_WIZARD_STORAGE_KEY = "wetask_tasker_wizard_v2";
const PRO_STATUS_LABELS: Record<string, string> = {
  ACCEPTED: "Aceptado",
  IN_PROGRESS: "En curso",
  COMPLETED: "Servicio informado como terminado",
  CANCELLED: "Cancelado",
  CONFIRMED: "Reserva confirmada",
  ASSIGNED: "Asignado",
  PENDING: "Pendiente"
};
const COMMUNE_MAP_POSITIONS: Record<string, { top: string; left: string }> = {
  Vitacura: { top: "26%", left: "56%" },
  "Lo Barnechea": { top: "16%", left: "69%" },
  Chicureo: { top: "8%", left: "51%" },
  "Las Condes": { top: "38%", left: "60%" },
  Providencia: { top: "49%", left: "49%" },
  "La Reina": { top: "55%", left: "67%" },
  "Ñuñoa": { top: "61%", left: "53%" }
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

type Booking = {
  id: string;
  status: string;
  scheduledAt: string;
  totalPriceClp: number;
  proReviewRating: number | null;
  proReviewComment: string | null;
  proReviewedAt: string | null;
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

type DayKey = "lunes" | "martes" | "miercoles" | "jueves" | "viernes" | "sabado" | "domingo";

type AvailabilityBlock = {
  day: DayKey;
  start: string;
  end: string;
};

type ProProfile = {
  id: string;
  avatarUrl?: string | null;
  bio: string | null;
  coverageStreet: string | null;
  coverageComuna: string | null;
  coverageCity: string | null;
  coveragePostal: string | null;
  coverageLatitude: number | null;
  coverageLongitude: number | null;
  serviceRadiusKm: number;
  hourlyRateFromClp: number | null;
  isVerified: boolean;
};

type ProProfileResponse = {
  user?: {
    id: string;
    fullName: string;
    email: string;
  };
  profile?: ProProfile | null;
  categorySlug?: string | null;
  profilePhotoUrl?: string | null;
  availabilityMode?: "FIJA" | "VARIABLE" | null;
  availabilityBlocks?: unknown;
  taskerServices?: Service[];
  serviceCommunes?: string[];
  error?: string;
  detail?: string;
};

type AddressValidationResponse = {
  valid?: boolean;
  skipped?: boolean;
  normalizedAddress?: string;
  commune?: string | null;
  isActiveCommune?: boolean;
  location?: { lat?: number | null; lng?: number | null };
  error?: string;
  detail?: string;
};

type ProSlot = {
  id: string;
  startsAt: string;
  endsAt: string;
  isAvailable: boolean;
  source?: "saved" | "onboarding";
  service: { id: string; name: string } | null;
  bookings: Array<{ id: string; status: string }>;
};

type ProView = "resumen" | "perfil" | "agenda" | "reservas" | "resenas" | "notificaciones";

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

function formatBookingDate(value: string) {
  return new Date(value).toLocaleString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftMonthKey(dayKey: string, delta: number) {
  const base = new Date(`${dayKey}T12:00:00`);
  const desiredDay = base.getDate();
  const target = new Date(base);
  target.setDate(1);
  target.setMonth(target.getMonth() + delta);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(desiredDay, lastDay));
  return formatDayKey(target);
}

function weekdayToDayKey(date: Date): DayKey {
  return ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"][date.getDay()] as DayKey;
}

function initialsFromName(value: string) {
  const words = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (words.length === 0) return "WT";
  return words.map((word) => word[0]?.toUpperCase() ?? "").join("");
}

function normalizeAvailabilityBlocks(value: unknown): AvailabilityBlock[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as Partial<AvailabilityBlock>;
      if (typeof candidate.day !== "string" || typeof candidate.start !== "string" || typeof candidate.end !== "string") {
        return null;
      }
      return {
        day: candidate.day as DayKey,
        start: candidate.start,
        end: candidate.end
      };
    })
    .filter((item): item is AvailabilityBlock => Boolean(item));
}

function localDraftProfilePhoto() {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem(TASKER_WIZARD_STORAGE_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { profilePhotoUrl?: string };
    return typeof parsed.profilePhotoUrl === "string" ? parsed.profilePhotoUrl.trim() : "";
  } catch {
    return "";
  }
}

export default function ProPage() {
  const [proId, setProId] = useState("");
  const [proName, setProName] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [slots, setSlots] = useState<ProSlot[]>([]);
  const [statusByBooking, setStatusByBooking] = useState<Record<string, string>>({});
  const [proReviewByBooking, setProReviewByBooking] = useState<Record<string, { rating: number; comment: string }>>({});

  const [profile, setProfile] = useState<ProProfile | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const [availabilityMode, setAvailabilityMode] = useState<"FIJA" | "VARIABLE" | null>(null);
  const [onboardingAvailabilityBlocks, setOnboardingAvailabilityBlocks] = useState<AvailabilityBlock[]>([]);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [bio, setBio] = useState("");
  const [coverageStreet, setCoverageStreet] = useState("");
  const [coverageComuna, setCoverageComuna] = useState("");
  const [coverageCity, setCoverageCity] = useState("Santiago");
  const [coveragePostal, setCoveragePostal] = useState("7500000");
  const [coverageLatitude, setCoverageLatitude] = useState("");
  const [coverageLongitude, setCoverageLongitude] = useState("");
  const [manualCoveragePoint, setManualCoveragePoint] = useState(false);
  const [serviceRadiusKm, setServiceRadiusKm] = useState(8);
  const [hourlyRateFromClp, setHourlyRateFromClp] = useState(12000);
  const [serviceCommunes, setServiceCommunes] = useState<string[]>([]);
  const hourlyRateInputRef = useRef<HTMLInputElement | null>(null);

  const [slotDate, setSlotDate] = useState(dateInputDefault());
  const [slotTime, setSlotTime] = useState("09:00");
  const [slotDurationMin, setSlotDurationMin] = useState(60);
  const [slotServiceId, setSlotServiceId] = useState("");

  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState<ProView>("resumen");
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedFromAutocomplete, setSelectedFromAutocomplete] = useState(false);
  const [validatingAddress, setValidatingAddress] = useState(false);
  const [validatedAddress, setValidatedAddress] = useState("");
  const [addressValidationMessage, setAddressValidationMessage] = useState("");
  const [addressValidationError, setAddressValidationError] = useState("");
  const parsedMapLat = Number(coverageLatitude);
  const parsedMapLng = Number(coverageLongitude);
  const cityOptions = useMemo(
    () => (coverageCity && !CHILE_CITIES.includes(coverageCity) ? [coverageCity, ...CHILE_CITIES] : CHILE_CITIES),
    [coverageCity]
  );
  const geocodedCenter = useMemo(
    () =>
      geocodeAddress({
        city: coverageCity || "Santiago",
        postalCode: coveragePostal || "7500000",
        street: `${coverageStreet} ${coverageComuna}`.trim()
      }),
    [coverageCity, coveragePostal, coverageStreet, coverageComuna]
  );
  const mapLat = Number.isFinite(parsedMapLat) ? parsedMapLat : -33.4489;
  const mapLng = Number.isFinite(parsedMapLng) ? parsedMapLng : -70.6693;
  const markerLeftPct = ((mapLng - SANTIAGO_BOUNDS.minLng) / (SANTIAGO_BOUNDS.maxLng - SANTIAGO_BOUNDS.minLng)) * 100;
  const markerTopPct = (1 - (mapLat - SANTIAGO_BOUNDS.minLat) / (SANTIAGO_BOUNDS.maxLat - SANTIAGO_BOUNDS.minLat)) * 100;
  const fullCoverageAddress = useMemo(
    () => [coverageStreet.trim(), coverageComuna.trim(), coverageCity.trim(), "Chile"].filter(Boolean).join(", "),
    [coverageCity, coverageComuna, coverageStreet]
  );
  const selectedCommunes = useMemo(
    () => normalizeCommuneList(serviceCommunes.length > 0 ? serviceCommunes : [coverageComuna]),
    [serviceCommunes, coverageComuna]
  );
  const mapEmbedUrl = useMemo(() => {
    const query = encodeURIComponent(`${mapLat},${mapLng}`);
    return `https://www.google.com/maps?q=${query}&z=11&output=embed`;
  }, [mapLat, mapLng]);
  const todayKey = useMemo(() => formatDayKey(new Date()), []);
  const selectedDate = useMemo(() => new Date(`${slotDate}T12:00:00`), [slotDate]);
  const selectedMonthLabel = useMemo(
    () => selectedDate.toLocaleDateString("es-CL", { month: "long", year: "numeric" }),
    [selectedDate]
  );
  const selectedDayLabel = useMemo(
    () => selectedDate.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" }),
    [selectedDate]
  );
  const monthCalendarDays = useMemo(() => {
    const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const startWeekday = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - startWeekday);

    return Array.from({ length: 35 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return {
        key: formatDayKey(date),
        date,
        isCurrentMonth: date.getMonth() === selectedDate.getMonth()
      };
    });
  }, [selectedDate]);
  const displaySlots = useMemo(() => {
    if (slots.length > 0) {
      return slots.map((slot) => ({ ...slot, source: "saved" as const }));
    }

    if (onboardingAvailabilityBlocks.length === 0) return [];

    const primaryService = services[0] ?? null;
    return monthCalendarDays.flatMap((day) => {
      const blocksForDay = onboardingAvailabilityBlocks.filter((block) => block.day === weekdayToDayKey(day.date));
      return blocksForDay.map((block, index) => ({
        id: `onboarding-${day.key}-${block.start}-${block.end}-${index}`,
        startsAt: new Date(`${day.key}T${block.start}:00`).toISOString(),
        endsAt: new Date(`${day.key}T${block.end}:00`).toISOString(),
        isAvailable: true,
        source: "onboarding" as const,
        service: primaryService,
        bookings: []
      }));
    });
  }, [monthCalendarDays, onboardingAvailabilityBlocks, services, slots]);
  const slotsByDay = useMemo(() => {
    const map = new Map<string, ProSlot[]>();
    for (const slot of displaySlots) {
      const key = slot.startsAt.slice(0, 10);
      const prev = map.get(key) ?? [];
      map.set(key, [...prev, slot].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
    }
    return map;
  }, [displaySlots]);
  const todaySlots = slotsByDay.get(todayKey) ?? [];
  const selectedDaySlots = slotsByDay.get(slotDate) ?? [];
  const bookedSlotsCount = useMemo(() => displaySlots.filter((item) => item.bookings.length > 0).length, [displaySlots]);
  const daysWithSlotsCount = useMemo(() => slotsByDay.size, [slotsByDay]);

  const upcomingBookings = useMemo(
    () => bookings.filter((item) => new Date(item.scheduledAt).getTime() >= Date.now() && item.status !== "COMPLETED"),
    [bookings]
  );
  const completedBookings = useMemo(() => bookings.filter((item) => item.status === "COMPLETED"), [bookings]);
  const availableSlotsCount = useMemo(() => displaySlots.filter((item) => item.isAvailable).length, [displaySlots]);

  const applyProfile = (nextProfile: ProProfile | null, nextServiceCommunes: string[] = []) => {
    setProfile(nextProfile);
    setIsEditingProfile(false);
    if (!nextProfile) return;
    setBio(nextProfile.bio ?? "");
    setCoverageStreet(nextProfile.coverageStreet ?? "");
    setCoverageComuna(nextProfile.coverageComuna ?? "");
    setCoverageCity(nextProfile.coverageCity ?? "Santiago");
    setCoveragePostal(nextProfile.coveragePostal ?? "");
    const hasCoords = nextProfile.coverageLatitude != null && nextProfile.coverageLongitude != null;
    setCoverageLatitude(hasCoords ? String(nextProfile.coverageLatitude) : "");
    setCoverageLongitude(hasCoords ? String(nextProfile.coverageLongitude) : "");
    setManualCoveragePoint(hasCoords);
    setServiceRadiusKm(nextProfile.serviceRadiusKm ?? 8);
    setHourlyRateFromClp(nextProfile.hourlyRateFromClp ?? 12000);
    const normalizedServiceCommunes = normalizeCommuneList(
      nextServiceCommunes.length > 0 ? nextServiceCommunes : [nextProfile.coverageComuna ?? ""]
    );
    setServiceCommunes(normalizedServiceCommunes);
  };

  useEffect(() => {
    if (manualCoveragePoint) return;
    setCoverageLatitude(geocodedCenter.lat.toFixed(6));
    setCoverageLongitude(geocodedCenter.lng.toFixed(6));
  }, [geocodedCenter, manualCoveragePoint]);

  useEffect(() => {
    if (selectedFromAutocomplete) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      setAutocompleteLoading(false);
      return;
    }

    if (coverageStreet.trim().length < 4) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      setAutocompleteLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setAutocompleteLoading(true);
      try {
        const response = await fetch(`/api/maps/autocomplete?input=${encodeURIComponent(fullCoverageAddress)}`, {
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
  }, [coverageStreet, fullCoverageAddress, selectedFromAutocomplete]);

  const loadAll = async (targetProId: string) => {
    if (!targetProId) return;

    const [bookingsRes, notificationsRes, profileRes, slotsRes] = await Promise.all([
      fetch(`/api/marketplace/pro/bookings?proId=${targetProId}`),
      fetch(`/api/marketplace/notifications?userId=${targetProId}`),
      fetch(`/api/marketplace/pro/profile?proId=${targetProId}`),
      fetch(`/api/marketplace/pro/slots?proId=${targetProId}&days=14&limit=300`)
    ]);

    const bookingsData = (await bookingsRes.json()) as { bookings?: Booking[]; error?: string; detail?: string };
    const notificationsData = (await notificationsRes.json()) as { notifications?: Notification[]; error?: string; detail?: string };
    const profileData = (await profileRes.json()) as ProProfileResponse;
    const slotsData = (await slotsRes.json()) as { slots?: ProSlot[]; error?: string; detail?: string };

    if (!bookingsRes.ok || !bookingsData.bookings) throw new Error(bookingsData.detail || bookingsData.error || "No se pudo cargar reservas");
    if (!notificationsRes.ok || !notificationsData.notifications) {
      throw new Error(notificationsData.detail || notificationsData.error || "No se pudo cargar notificaciones");
    }
    if (!profileRes.ok) throw new Error(profileData.detail || profileData.error || "No se pudo cargar perfil");
    if (!slotsRes.ok || !slotsData.slots) throw new Error(slotsData.detail || slotsData.error || "No se pudo cargar disponibilidad");

    setBookings(bookingsData.bookings);
    const nextStatuses: Record<string, string> = {};
    bookingsData.bookings.forEach((item) => {
      nextStatuses[item.id] = item.status;
    });
    setStatusByBooking(nextStatuses);

    setNotifications(notificationsData.notifications);
    setProName(profileData.user?.fullName ?? "");
    setCategorySlug(profileData.categorySlug ?? "");
    const nextProfilePhoto = profileData.profilePhotoUrl?.trim() || profileData.profile?.avatarUrl?.trim() || localDraftProfilePhoto();
    setProfilePhotoUrl(nextProfilePhoto);
    setAvailabilityMode(profileData.availabilityMode ?? null);
    setOnboardingAvailabilityBlocks(normalizeAvailabilityBlocks(profileData.availabilityBlocks));
    applyProfile(profileData.profile ?? null, profileData.serviceCommunes ?? []);
    setSlots(slotsData.slots);
    const nextServices = profileData.taskerServices ?? [];
    setServices(nextServices);
    setSlotServiceId((current) => (nextServices.some((service) => service.id === current) ? current : nextServices[0]?.id ?? ""));
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

  const reloadData = async () => {
    setFeedback("");
    setError("");
    try {
      await loadAll(proId);
      setFeedback("Panel actualizado.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  const openHourlyRateEditor = () => {
    setIsEditingProfile(true);
    window.setTimeout(() => {
      hourlyRateInputRef.current?.focus();
      hourlyRateInputRef.current?.select();
    }, 40);
  };

  const updateCoverageFromPointer = (clientX: number, clientY: number, rect: DOMRect) => {
    const xPct = clamp((clientX - rect.left) / rect.width, 0, 1);
    const yPct = clamp((clientY - rect.top) / rect.height, 0, 1);

    const nextLng = SANTIAGO_BOUNDS.minLng + xPct * (SANTIAGO_BOUNDS.maxLng - SANTIAGO_BOUNDS.minLng);
    const nextLat = SANTIAGO_BOUNDS.maxLat - yPct * (SANTIAGO_BOUNDS.maxLat - SANTIAGO_BOUNDS.minLat);
    setManualCoveragePoint(true);
    setCoverageLatitude(nextLat.toFixed(6));
    setCoverageLongitude(nextLng.toFixed(6));
  };

  const onCoverageMapClick = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    updateCoverageFromPointer(event.clientX, event.clientY, rect);
  };

  const toggleCommune = (commune: string) => {
    setServiceCommunes((current) => {
      if (current.includes(commune)) {
        return current.filter((item) => item !== commune);
      }
      return [...current, commune];
    });
  };

  const selectAddressSuggestion = (suggestion: string) => {
    const [streetSegment] = suggestion.split(",");
    setCoverageStreet(streetSegment?.trim() || suggestion);
    const detectedCommune = normalizeCommune(suggestion) ?? inferCommuneFromAddress(suggestion);
    if (detectedCommune) {
      setCoverageComuna(detectedCommune);
    }
    setSelectedFromAutocomplete(true);
    setAddressSuggestions([]);
    setShowSuggestions(false);
    setAddressValidationMessage("");
    setAddressValidationError("");
    setValidatedAddress("");
    setManualCoveragePoint(false);
  };

  const validateCoverageAddress = async () => {
    if (!coverageStreet.trim()) {
      setAddressValidationError("Ingresa una dirección antes de corroborarla con Google.");
      setAddressValidationMessage("");
      return false;
    }

    setValidatingAddress(true);
    setAddressValidationError("");
    setAddressValidationMessage("");

    try {
      const response = await fetch(`/api/maps/validate-address?address=${encodeURIComponent(fullCoverageAddress)}`);
      const data = (await response.json()) as AddressValidationResponse;

      if (!response.ok || !data.valid) {
        throw new Error(data.detail || data.error || "No pudimos corroborar esa dirección.");
      }

      const detectedCommune = normalizeCommune(data.commune ?? "") ?? inferCommuneFromAddress(data.normalizedAddress ?? fullCoverageAddress);
      if (detectedCommune) {
        setCoverageComuna(detectedCommune);
      }

      if (data.location?.lat != null && data.location?.lng != null) {
        setCoverageLatitude(data.location.lat.toFixed(6));
        setCoverageLongitude(data.location.lng.toFixed(6));
        setManualCoveragePoint(true);
      } else {
        setManualCoveragePoint(false);
      }

      setValidatedAddress(data.normalizedAddress ?? fullCoverageAddress);
      setAddressValidationMessage(
        data.skipped ? "Dirección corroborada en modo básico. En este ambiente no respondió Google Maps." : "Dirección corroborada con Google Maps."
      );
      return true;
    } catch (e) {
      setValidatedAddress("");
      setAddressValidationError(e instanceof Error ? e.message : "No pudimos corroborar esa dirección.");
      return false;
    } finally {
      setValidatingAddress(false);
    }
  };

  const saveProfile = async () => {
    setFeedback("");
    setError("");
    try {
      const isAddressValid = await validateCoverageAddress();
      if (!isAddressValid) return;

      const payloadServiceCommunes = normalizeCommuneList(serviceCommunes.length > 0 ? serviceCommunes : [coverageComuna]);
      if (payloadServiceCommunes.length === 0) {
        throw new Error("Selecciona al menos una comuna activa donde atiendes.");
      }
      const response = await fetch("/api/marketplace/pro/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proId,
          bio: bio.trim() || null,
          coverageStreet: coverageStreet.trim() || null,
          coverageComuna: coverageComuna.trim() || null,
          coverageCity: coverageCity.trim() || null,
          coveragePostal: coveragePostal.trim() || null,
          coverageLatitude: coverageLatitude ? Number(coverageLatitude) : null,
          coverageLongitude: coverageLongitude ? Number(coverageLongitude) : null,
          serviceRadiusKm,
          hourlyRateFromClp,
          serviceCommunes: payloadServiceCommunes
        })
      });
      const data = (await response.json()) as { profile?: ProProfile; serviceCommunes?: string[]; error?: string; detail?: string };
      if (!response.ok || !data.profile) throw new Error(data.detail || data.error || "No se pudo guardar perfil");
      applyProfile(data.profile, data.serviceCommunes ?? serviceCommunes);
      setIsEditingProfile(false);
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
          serviceId: slotServiceId || services[0]?.id || null,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString()
        })
      });

      const data = (await response.json()) as { slot?: ProSlot; error?: string; detail?: string };
      if (!response.ok || !data.slot) throw new Error(data.detail || data.error || "No se pudo crear bloque horario");
      setSlots((prev) => [...prev, data.slot!].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
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
      setFeedback(`Estado actualizado: ${PRO_STATUS_LABELS[data.booking.status] ?? data.booking.status}`);
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

  const submitClientReview = async (bookingId: string) => {
    const payload = proReviewByBooking[bookingId];
    if (!payload || payload.comment.trim().length < 8) {
      setError("Antes de solicitar payout, deja una reseña clara del cliente.");
      return;
    }

    setFeedback("");
    setError("");
    try {
      const response = await fetch(`/api/marketplace/bookings/${bookingId}/pro-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: payload.rating,
          comment: payload.comment
        })
      });
      const data = (await response.json()) as {
        review?: { proReviewRating: number | null; proReviewComment: string | null; proReviewedAt: string | null };
        error?: string;
        detail?: string;
      };
      if (!response.ok || !data.review) throw new Error(data.detail || data.error || "No se pudo guardar la reseña del cliente");
      setBookings((current) =>
        current.map((item) =>
          item.id === bookingId
            ? {
                ...item,
                proReviewRating: data.review?.proReviewRating ?? payload.rating,
                proReviewComment: data.review?.proReviewComment ?? payload.comment,
                proReviewedAt: data.review?.proReviewedAt ?? new Date().toISOString()
              }
            : item
        )
      );
      setFeedback("Reseña del cliente guardada.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  return (
    <main className="auth-flow-screen auth-flow-screen-scroll market-shell-auth">
      <div className="auth-flow-backdrop" aria-hidden />

      <div className="login-screen-content market-shell-auth-content">
        <MarketNav />

        <section className="auth-flow-shell auth-flow-shell-wide client-dashboard-hero">
          <div className="auth-flow-copy client-dashboard-copy">
            <p className="auth-flow-kicker">Panel profesional</p>
            <h1>Gestiona tu operación diaria con el look nuevo de WeTask.</h1>
            <p>Controla tu perfil, cobertura, agenda, reservas y pagos desde un panel más claro y más fácil de usar. Aquí verás cuándo una reserva ya está pagada, cuándo sigue retenida y cuándo entra al próximo payout.</p>

            <div className="auth-flow-copy-list client-dashboard-summary">
              <div className="auth-flow-meta-card">
                <strong>Próximas reservas</strong>
                <span>{upcomingBookings.length} servicio(s) activos o por realizar.</span>
              </div>
              <div className="auth-flow-meta-card">
                <strong>Servicios completados</strong>
                <span>{completedBookings.length} trabajo(s) finalizado(s).</span>
              </div>
              <div className="auth-flow-meta-card">
                <strong>Bloques disponibles</strong>
                <span>{availableSlotsCount} horario(s) abierto(s) para nuevas reservas.</span>
              </div>
            </div>

            <div className="auth-flow-actions">
              <button className="cta ghost" type="button" onClick={() => void reloadData()} disabled={!proId}>
                Actualizar panel
              </button>
            </div>
          </div>

          <section className="auth-flow-panel auth-flow-panel-wide client-dashboard-profile-panel">
            <div className="panel-head client-dashboard-panel-head">
              <h2>Tu operación hoy</h2>
              <p>Resumen rápido de tu perfil y cobertura actual.</p>
            </div>

            <div className="client-profile-box client-profile-box-auth pro-dashboard-profile-box">
              <div className="client-photo-frame pro-dashboard-badge" aria-hidden>
                {profilePhotoUrl ? (
                  <img src={profilePhotoUrl} alt="" className="client-photo-img" />
                ) : (
                  <span>{initialsFromName(proName)}</span>
                )}
              </div>
              <div className="client-profile-copy">
                <h3>{coverageComuna || "Tu perfil profesional"}</h3>
                <p>Dirección base</p>
                <strong className="client-profile-address">
                  {[coverageStreet || "Sin dirección", coverageComuna || "Sin comuna", coverageCity].filter(Boolean).join(", ")}
                </strong>
                <p>Tarifa desde</p>
                <strong className="client-profile-address">{clp(hourlyRateFromClp)}/hora</strong>
                <div className="client-profile-actions">
                  <span className={`status ${profile?.isVerified ? "status-completed" : "status-pending"}`}>
                    {profile?.isVerified ? "Verificado" : "Pendiente de verificación"}
                  </span>
                  <span className="status status-accepted">{serviceCommunes.length || 0} comuna(s)</span>
                </div>
              </div>
            </div>
          </section>
        </section>

        <div className="page client-dashboard-sections">
          {feedback ? <p className="feedback ok">{feedback}</p> : null}
          {error ? <p className="feedback error">{error}</p> : null}

          <div className="dashboard-switcher">
            {[
              { id: "resumen", label: "Resumen" },
              { id: "perfil", label: "Perfil" },
              { id: "agenda", label: "Calendario" },
              { id: "reservas", label: "Reservas" },
              { id: "resenas", label: "Reseñas y payouts" },
              { id: "notificaciones", label: "Notificaciones" }
            ].map((view) => (
              <button
                key={view.id}
                type="button"
                className={`dashboard-switch ${activeView === view.id ? "active" : ""}`}
                onClick={() => setActiveView(view.id as ProView)}
              >
                {view.label}
              </button>
            ))}
          </div>

          {activeView === "resumen" ? (
            <section className="auth-flow-panel client-dashboard-section">
            <div className="panel-head client-dashboard-panel-head">
              <h2>Resumen rápido</h2>
              <p>Vista general de tu actividad actual.</p>
            </div>

            <div className="module-grid client-dashboard-metrics">
              <article className="module-card client-dashboard-metric">
                <h3>Reservas activas</h3>
                <p>{upcomingBookings.length} servicio(s)</p>
              </article>
              <article className="module-card client-dashboard-metric">
                <h3>Completadas</h3>
                <p>{completedBookings.length} servicio(s)</p>
              </article>
              <article className="module-card client-dashboard-metric">
                <h3>Notificaciones</h3>
                <p>{notifications.length} aviso(s)</p>
              </article>
            </div>
            <div className="module-grid dashboard-summary-grid">
              <article className="module-card client-dashboard-card dashboard-summary-card">
                <h3>Próxima reserva</h3>
                <p>
                  {upcomingBookings[0]
                    ? `${upcomingBookings[0].service.name} · ${formatBookingDate(upcomingBookings[0].scheduledAt)}`
                    : "No tienes reservas próximas."}
                </p>
              </article>
              <article className="module-card client-dashboard-card dashboard-summary-card">
                <h3>Comunas activas</h3>
                <p>{selectedCommunes.length > 0 ? selectedCommunes.join(", ") : "Aún no defines cobertura."}</p>
              </article>
              <article className="module-card client-dashboard-card dashboard-summary-card">
                <h3>Agenda abierta</h3>
                <p>{availableSlotsCount > 0 ? `${availableSlotsCount} bloque(s) disponible(s)` : "No tienes bloques abiertos por ahora."}</p>
              </article>
            </div>
            </section>
          ) : null}

          {activeView === "perfil" ? (
            <section className="auth-flow-panel client-dashboard-section">
            <div className="panel-head client-dashboard-panel-head">
              <div>
                <h2>Perfil profesional</h2>
                <p>Revisa tu información y edítala solo cuando realmente lo necesites.</p>
              </div>
              {isEditingProfile ? (
                <button className="cta ghost small" type="button" onClick={() => setIsEditingProfile(false)}>
                  Cerrar edición
                </button>
              ) : (
                <button className="cta ghost small" type="button" onClick={() => setIsEditingProfile(true)}>
                  Editar perfil
                </button>
              )}
            </div>

            {!isEditingProfile ? (
              <div className="pro-profile-summary">
                <div className="module-grid pro-profile-summary-grid">
                  <article className="module-card client-dashboard-card">
                    <h3>Bio</h3>
                    <p>{bio.trim() ? bio : "Todavía no agregas una descripción profesional."}</p>
                  </article>
                  <article className="module-card client-dashboard-card">
                    <h3>Dirección base</h3>
                    <p>{[coverageStreet || "Sin dirección", coverageComuna || "Sin comuna", coverageCity || "Sin ciudad"].join(", ")}</p>
                  </article>
                  <article className="module-card client-dashboard-card">
                    <h3>Tarifa desde</h3>
                    <p>{clp(hourlyRateFromClp)}/hora</p>
                    <div className="cta-row">
                      <button className="cta ghost small" type="button" onClick={openHourlyRateEditor}>
                        Editar valor por hora
                      </button>
                    </div>
                  </article>
                  <article className="module-card client-dashboard-card">
                    <h3>Comunas activas</h3>
                    <p>{selectedCommunes.length > 0 ? selectedCommunes.join(", ") : "Aún no defines comunas de trabajo."}</p>
                  </article>
                </div>

                <div className="full coverage-map-card pro-profile-map-preview">
                  <div className="coverage-map-head">
                    <h3>Mapa de cobertura</h3>
                    <p>Revisa tu punto base, haz zoom en el mapa y confirma las comunas donde trabajas.</p>
                  </div>
                  <div className="coverage-map-wrap">
                    <iframe
                      title="Mapa de cobertura profesional"
                      src={mapEmbedUrl}
                      className="coverage-map-frame"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                    <span className="coverage-pin" style={{ left: `${markerLeftPct}%`, top: `${markerTopPct}%` }} aria-hidden>
                      <span className="coverage-pin-dot" />
                    </span>
                  </div>
                  {selectedCommunes.length > 0 ? (
                    <>
                      <p className="coverage-map-tag-head">Comunas donde trabajas</p>
                      <div className="coverage-map-chip-list" aria-label="Comunas activas">
                        {selectedCommunes.map((commune) => (
                          <span key={commune} className="coverage-map-chip">
                            {commune}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : null}
                  <p className="coverage-meta">
                    Dirección base: {coverageStreet || "Sin dirección"}, {coverageComuna || "Sin comuna"}, {coverageCity}
                  </p>
                </div>
              </div>
            ) : null}

            {isEditingProfile ? <div className="grid-form">
              <label className="full">
                Bio
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Experiencia, especialidad, herramientas." />
              </label>
              <label>
                Dirección
                <input
                  value={coverageStreet}
                  onChange={(e) => {
                    setSelectedFromAutocomplete(false);
                    setAddressValidationMessage("");
                    setAddressValidationError("");
                    setValidatedAddress("");
                    setManualCoveragePoint(false);
                    setCoverageStreet(e.target.value);
                  }}
                  onFocus={() => setShowSuggestions(addressSuggestions.length > 0)}
                  placeholder="Calle y número"
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
                <div className="address-inline-actions">
                  <button className="cta ghost small" type="button" onClick={() => void validateCoverageAddress()} disabled={validatingAddress}>
                    {validatingAddress ? "Corroborando..." : "Corroborar con Google"}
                  </button>
                </div>
              </label>
              <label>
                Comuna
                <input
                  value={coverageComuna}
                  onChange={(e) => {
                    setSelectedFromAutocomplete(false);
                    setAddressValidationMessage("");
                    setAddressValidationError("");
                    setValidatedAddress("");
                    setManualCoveragePoint(false);
                    setCoverageComuna(e.target.value);
                  }}
                  placeholder="Providencia"
                />
              </label>
              <div className="full">
                <p className="field-label">Comunas donde trabajas</p>
                <div className="inline-checks">
                  {ACTIVE_MVP_COMMUNES.map((commune) => (
                    <label key={commune}>
                      <input
                        type="checkbox"
                        checked={serviceCommunes.includes(commune)}
                        onChange={(event) => {
                          if (event.target.checked) {
                            setServiceCommunes((current) => Array.from(new Set([...current, commune])));
                            return;
                          }
                          setServiceCommunes((current) => current.filter((item) => item !== commune));
                        }}
                      />
                      {commune}
                    </label>
                  ))}
                </div>
              </div>
              <label>
                Ciudad
                <select
                  value={coverageCity}
                  onChange={(e) => {
                    setSelectedFromAutocomplete(false);
                    setAddressValidationMessage("");
                    setAddressValidationError("");
                    setValidatedAddress("");
                    setManualCoveragePoint(false);
                    setCoverageCity(e.target.value);
                  }}
                >
                  {cityOptions.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tarifa desde (CLP/h)
                <input
                  ref={hourlyRateInputRef}
                  type="number"
                  min={5000}
                  value={hourlyRateFromClp}
                  onChange={(e) => setHourlyRateFromClp(Number(e.target.value) || 12000)}
                />
              </label>
              <div className="full coverage-map-card">
                <div className="coverage-map-head">
                  <h3>Mapa de cobertura</h3>
                  <p>Haz click para mover tu punto base y selecciona las comunas donde quieres trabajar.</p>
                </div>
                <div
                  className="coverage-map-wrap coverage-map-interactive"
                  onClick={onCoverageMapClick}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    const rect = event.currentTarget.getBoundingClientRect();
                    updateCoverageFromPointer(rect.left + rect.width / 2, rect.top + rect.height / 2, rect);
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label="Seleccionar punto de cobertura en el mapa"
                >
                  <iframe
                    title="Mapa de cobertura profesional"
                    src={mapEmbedUrl}
                    className="coverage-map-frame"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                  <div className="coverage-map-labels">
                    {ACTIVE_MVP_COMMUNES.map((commune) => {
                      const position = COMMUNE_MAP_POSITIONS[commune];
                      const isSelected = selectedCommunes.includes(commune);
                      return (
                        <button
                          key={commune}
                          type="button"
                          className={`coverage-commune-pill ${isSelected ? "active" : ""}`}
                          style={{ top: position.top, left: position.left }}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleCommune(commune);
                          }}
                        >
                          {commune}
                        </button>
                      );
                    })}
                  </div>
                  <span className="coverage-pin" style={{ left: `${markerLeftPct}%`, top: `${markerTopPct}%` }} aria-hidden>
                    <span className="coverage-pin-dot" />
                  </span>
                </div>
                <p className="coverage-meta">
                  Dirección base: {coverageStreet || "Sin dirección"}, {coverageComuna || "Sin comuna"}, {coverageCity}
                </p>
                {addressValidationMessage ? (
                  <p className="coverage-meta coverage-meta-ok">
                    {addressValidationMessage} {validatedAddress ? `(${validatedAddress})` : ""}
                  </p>
                ) : null}
                {addressValidationError ? <p className="coverage-meta coverage-meta-error">{addressValidationError}</p> : null}
                {selectedCommunes.length > 0 ? (
                  <>
                    <p className="coverage-map-tag-head">Comunas donde trabajas</p>
                    <div className="coverage-map-chip-list" aria-label="Comunas activas">
                      {selectedCommunes.map((commune) => (
                        <span key={commune} className="coverage-map-chip">
                          {commune}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="coverage-meta">Selecciona al menos una comuna.</p>
                )}
              </div>
            </div> : null}

            {isEditingProfile ? (
              <div className="cta-row">
                <button className="cta ghost" type="button" onClick={() => setIsEditingProfile(false)}>
                  Cancelar
                </button>
                <button className="cta" type="button" onClick={saveProfile}>
                  Guardar perfil
                </button>
              </div>
            ) : null}
            </section>
          ) : null}

          {activeView === "agenda" ? (
            <section className="auth-flow-panel client-dashboard-section">
            <div className="panel-head client-dashboard-panel-head">
              <h2>Calendario de disponibilidad</h2>
              <p>Organiza tus horarios como una agenda visual y controla qué bloques quedan abiertos para reservas.</p>
            </div>

            <div className="pro-availability-shell">
              <aside className="pro-availability-sidebar">
                <div className="pro-availability-overview">
                  <article className="availability-stat-card tone-indigo">
                    <span>Hoy</span>
                    <strong>{todaySlots.length}</strong>
                    <p>bloque(s) programado(s)</p>
                  </article>
                  <article className="availability-stat-card tone-peach">
                    <span>Abiertos</span>
                    <strong>{availableSlotsCount}</strong>
                    <p>listos para reservar</p>
                  </article>
                  <article className="availability-stat-card tone-sky">
                    <span>Con reserva</span>
                    <strong>{bookedSlotsCount}</strong>
                    <p>bloque(s) comprometido(s)</p>
                  </article>
                  <article className="availability-stat-card tone-mint">
                    <span>Días activos</span>
                    <strong>{daysWithSlotsCount}</strong>
                    <p>con disponibilidad cargada</p>
                  </article>
                </div>

                <div className="availability-composer-card">
                  <div className="availability-composer-head">
                    <div>
                      <p className="availability-eyebrow">Nuevo bloque</p>
                      <h3>Agrega una franja rápida</h3>
                    </div>
                    <span className="availability-selected-pill">{selectedDayLabel}</span>
                  </div>

                  <div className="grid-form availability-form-grid">
                    <label>
                      Fecha
                      <input type="date" value={slotDate} onChange={(e) => setSlotDate(e.target.value)} />
                    </label>
                    <label>
                      Hora inicio
                      <input type="time" value={slotTime} onChange={(e) => setSlotTime(e.target.value)} />
                    </label>
                    <label>
                      Duración
                      <select value={slotDurationMin} onChange={(e) => setSlotDurationMin(Number(e.target.value))}>
                        <option value={30}>30 min</option>
                        <option value={60}>60 min</option>
                        <option value={90}>90 min</option>
                        <option value={120}>120 min</option>
                        <option value={180}>180 min</option>
                        <option value={240}>240 min</option>
                      </select>
                    </label>
                  </div>

                  <p className="availability-inline-note">
                    {services[0]?.name
                      ? `Este bloque se publicará para ${services[0].name}.`
                      : categorySlug
                        ? `Este bloque se publicará para tu servicio de ${categorySlug.replaceAll("-", " ")}.`
                        : "Este bloque se publicará para el servicio que registraste en tu onboarding."}
                  </p>

                  {slots.length === 0 && onboardingAvailabilityBlocks.length > 0 ? (
                    <p className="availability-inline-note soft">
                      Ya cargaste {onboardingAvailabilityBlocks.length} bloque(s) en tu onboarding. Los estamos mostrando abajo como base
                      {availabilityMode === "VARIABLE" ? " variable" : " semanal"}.
                    </p>
                  ) : null}

                  <div className="cta-row availability-form-actions">
                    <button className="cta" type="button" onClick={createSlot}>
                      Agregar bloque
                    </button>
                  </div>
                </div>
              </aside>

              <div className="availability-board-card">
                <div className="availability-board-head">
                  <div>
                    <p className="availability-eyebrow">
                      {selectedDate.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "2-digit", weekday: "long" })}
                    </p>
                    <h3>{selectedMonthLabel}</h3>
                  </div>
                  <div className="availability-board-controls">
                    <div className="availability-month-nav" aria-label="Cambiar mes">
                      <button
                        type="button"
                        className="availability-month-nav-btn"
                        onClick={() => setSlotDate((current) => shiftMonthKey(current, -1))}
                        aria-label="Ver mes anterior"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        className="availability-month-nav-btn"
                        onClick={() => setSlotDate((current) => shiftMonthKey(current, 1))}
                        aria-label="Ver mes siguiente"
                      >
                        ›
                      </button>
                    </div>
                    <span className="availability-board-chip">
                      {selectedDaySlots.length} bloque(s) en {selectedDate.getDate()}
                    </span>
                  </div>
                </div>

                <div className="availability-weekdays">
                  {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>

                <div className="availability-month-grid">
                  {monthCalendarDays.map((day) => {
                    const daySlots = slotsByDay.get(day.key) ?? [];
                    const freeCount = daySlots.filter((slot) => slot.isAvailable && slot.bookings.length === 0).length;
                    const reservedCount = daySlots.filter((slot) => slot.bookings.length > 0).length;
                    const isSelected = day.key === slotDate;
                    const isToday = day.key === todayKey;

                    return (
                      <button
                        key={day.key}
                        type="button"
                        className={[
                          "availability-day-card",
                          day.isCurrentMonth ? "" : "muted",
                          isSelected ? "selected" : "",
                          isToday ? "today" : ""
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => setSlotDate(day.key)}
                      >
                        <span className="availability-day-number">{day.date.getDate()}</span>
                        <span className="availability-day-meta">
                          {daySlots.length > 0 ? `${daySlots.length} bloque(s)` : "Sin bloques"}
                        </span>
                        <span className="availability-day-dots" aria-hidden>
                          {freeCount > 0 ? <span className="availability-dot free" /> : null}
                          {reservedCount > 0 ? <span className="availability-dot booked" /> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="availability-task-panel">
                  <div className="availability-task-head">
                    <div>
                      <p className="availability-eyebrow">Detalle del día</p>
                      <h4>{selectedDayLabel}</h4>
                    </div>
                    <span className="availability-selected-pill">
                      {selectedDaySlots.length > 0 ? `${selectedDaySlots.length} bloque(s)` : "Sin bloques"}
                    </span>
                  </div>

                  {selectedDaySlots.length === 0 ? (
                    <div className="availability-empty-state">
                      <strong>No tienes horarios cargados para este día.</strong>
                      <p>Usa el formulario de la izquierda para agregar una nueva franja de atención.</p>
                    </div>
                  ) : (
                    <div className="availability-task-list">
                      {selectedDaySlots.map((slot) => (
                        <article
                          key={slot.id}
                          className={`availability-task-item ${
                            slot.bookings.length > 0 ? "reserved" : slot.isAvailable ? "open" : "closed"
                          }`}
                        >
                          <div className="availability-task-time">
                            {new Date(slot.startsAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                            <span />
                            {new Date(slot.endsAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                          <div className="availability-task-copy">
                            <strong>{slot.service?.name ?? "Disponibilidad general"}</strong>
                            <p>
                              {slot.source === "onboarding"
                                ? "Bloque base traído desde tu onboarding."
                                : slot.bookings.length > 0
                                ? "Este bloque ya tiene una reserva asociada."
                                : slot.isAvailable
                                  ? "Visible para nuevas reservas."
                                  : "Guardado pero oculto para clientes."}
                            </p>
                          </div>
                          {slot.source === "onboarding" ? null : (
                            <div className="availability-task-actions">
                              <button className="cta small" type="button" onClick={() => updateSlotAvailability(slot.id, !slot.isAvailable)}>
                                {slot.isAvailable ? "Desactivar" : "Activar"}
                              </button>
                              <button className="cta ghost small" type="button" onClick={() => deleteSlot(slot.id)}>
                                Eliminar
                              </button>
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            </section>
          ) : null}

          {activeView === "notificaciones" ? (
            <section className="auth-flow-panel client-dashboard-section">
            <div className="panel-head client-dashboard-panel-head">
              <h2>Notificaciones</h2>
              <p>Mensajes y movimientos importantes de tu cuenta.</p>
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
                    <p>{new Date(item.createdAt).toLocaleString("es-CL")}</p>
                  </article>
                ))
              )}
            </div>
            </section>
          ) : null}

          {activeView === "reservas" ? (
            <section className="auth-flow-panel client-dashboard-section">
            <div className="panel-head client-dashboard-panel-head">
              <h2>Servicios</h2>
              <p>Revisa y actualiza el estado de tus reservas activas sin mezclarlo con reseñas ni payouts.</p>
            </div>

            <div className="list client-dashboard-list">
              {upcomingBookings.length === 0 ? (
                <p className="empty">Todavía no tienes servicios asignados.</p>
              ) : (
                upcomingBookings.map((booking) => (
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
                    <p>
                      <strong>Estado del pago:</strong> {booking.status === "COMPLETED" ? booking.payout?.status ?? "Pendiente de programación" : booking.status === "IN_PROGRESS" ? "Retenido hasta terminar el servicio" : booking.status === "CONFIRMED" || booking.status === "ACCEPTED" || booking.status === "ASSIGNED" ? "Pago reservado por WeTask" : booking.payout?.status ?? "Aún no aplica"}
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
          ) : null}

          {activeView === "resenas" ? (
            <section className="auth-flow-panel client-dashboard-section">
              <div className="panel-head client-dashboard-panel-head">
                <h2>Reseñas y payouts</h2>
                <p>Completa la reseña del cliente y solicita tu payout cuando corresponda.</p>
              </div>

              <div className="list client-dashboard-list">
                {completedBookings.length === 0 ? (
                  <p className="empty">Todavía no tienes servicios completados para reseñar.</p>
                ) : (
                  completedBookings.map((booking) => (
                    <article className="booking-card client-dashboard-card" key={booking.id}>
                      <div className="booking-head">
                        <h3>{booking.service.name}</h3>
                        <span className="status status-completed">{PRO_STATUS_LABELS[booking.status] ?? booking.status}</span>
                      </div>
                      <p className="client-booking-eyebrow">Servicio realizado</p>
                      <p>
                        <strong>Cliente:</strong> {booking.customer.fullName} ({booking.customer.email})
                      </p>
                      <p>
                        <strong>Fecha:</strong> {formatBookingDate(booking.scheduledAt)}
                      </p>
                      <p>
                        <strong>Total:</strong> {clp(booking.totalPriceClp)}
                      </p>
                      <p>
                        <strong>Payout:</strong> {booking.payout?.status ?? "No solicitado"}
                      </p>
                      <div className="pro-review-card">
                        <strong>Reseña del cliente</strong>
                        <label>
                          Calificación
                          <select
                            value={proReviewByBooking[booking.id]?.rating ?? booking.proReviewRating ?? 5}
                            onChange={(e) =>
                              setProReviewByBooking((current) => ({
                                ...current,
                                [booking.id]: {
                                  rating: Number(e.target.value),
                                  comment: current[booking.id]?.comment ?? booking.proReviewComment ?? ""
                                }
                              }))
                            }
                          >
                            {[5, 4, 3, 2, 1].map((value) => (
                              <option key={value} value={value}>
                                {value} estrella{value > 1 ? "s" : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Comentario
                          <textarea
                            rows={4}
                            value={proReviewByBooking[booking.id]?.comment ?? booking.proReviewComment ?? ""}
                            onChange={(e) =>
                              setProReviewByBooking((current) => ({
                                ...current,
                                [booking.id]: {
                                  rating: current[booking.id]?.rating ?? booking.proReviewRating ?? 5,
                                  comment: e.target.value
                                }
                              }))
                            }
                            placeholder="Cuéntanos cómo fue trabajar con este cliente."
                          />
                        </label>
                        <div className="booking-actions">
                          <button className="cta ghost small" type="button" onClick={() => submitClientReview(booking.id)}>
                            Guardar reseña
                          </button>
                          <button className="cta small" type="button" onClick={() => requestPayout(booking.id)}>
                            Solicitar payout
                          </button>
                        </div>
                      </div>
                    <div className="client-booking-note">
                      <strong>Lógica de cobro</strong>
                      <p>El cliente paga al reservar. WeTask retiene ese dinero y tu pago entra al próximo ciclo cuando el cliente confirma o cuando vence el plazo sin reclamo.</p>
                    </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
