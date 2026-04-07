"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from "react";
import { MarketNav } from "@/components/market-nav";
import { ACTIVE_MVP_COMMUNES, inferCommuneFromAddress, normalizeCommune, normalizeCommuneList } from "@/lib/communes";
import { CORE_SERVICES, type CoreTaskerServiceSlug } from "@/lib/core-services";
import { geocodeAddress } from "@/lib/geo";

const statusOptions = ["ACCEPTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const CHILE_CITIES = ["Santiago", "Valparaiso", "Vina del Mar", "Concepcion", "La Serena", "Antofagasta", "Temuco", "Puerto Montt"];
const TASKER_WIZARD_STORAGE_KEY = "wetask_tasker_wizard_v2";
const PRO_STATUS_LABELS: Record<string, string> = {
  ACCEPTED: "Aceptado",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
  CONFIRMED: "Confirmado",
  ASSIGNED: "Asignado",
  PENDING: "Pendiente"
};

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
const WEEK_DAY_OPTIONS: Array<{ key: DayKey; label: string; shortLabel: string }> = [
  { key: "lunes", label: "Lunes", shortLabel: "Lun" },
  { key: "martes", label: "Martes", shortLabel: "Mar" },
  { key: "miercoles", label: "Miércoles", shortLabel: "Mié" },
  { key: "jueves", label: "Jueves", shortLabel: "Jue" },
  { key: "viernes", label: "Viernes", shortLabel: "Vie" },
  { key: "sabado", label: "Sábado", shortLabel: "Sáb" },
  { key: "domingo", label: "Domingo", shortLabel: "Dom" }
];

const TASKER_CATEGORY_ALIASES: Record<string, CoreTaskerServiceSlug> = {
  limpieza: "limpieza",
  mascotas: "mascotas",
  "paseo-cuidado-mascotas": "mascotas",
  babysitter: "babysitter",
  "babysitter-por-horas": "babysitter",
  "profesor-particular": "profesor-particular",
  "personal-trainer": "personal-trainer",
  chef: "chef",
  "chef-a-domicilio": "chef",
  maquillaje: "maquillaje",
  "maquillaje-a-domicilio": "maquillaje",
  planchado: "planchado"
};

function clp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

function dateInputDefault() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
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

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo procesar la foto"));
    image.src = src;
  });
}

async function createCenteredProfilePhoto(dataUrl: string, focusX: number, focusY: number) {
  if (!dataUrl) return dataUrl;
  const image = await loadImageElement(dataUrl);
  const size = 720;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return dataUrl;

  const scale = Math.max(size / image.width, size / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const normalizedX = Math.min(100, Math.max(0, focusX));
  const normalizedY = Math.min(100, Math.max(0, focusY));
  const offsetX = (size - drawWidth) * (normalizedX / 100);
  const offsetY = (size - drawHeight) * (normalizedY / 100);

  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  return canvas.toDataURL("image/jpeg", 0.92);
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
  const [photoFocus, setPhotoFocus] = useState({ x: 50, y: 34 });
  const [photoDragging, setPhotoDragging] = useState(false);
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
  const [activeView, setActiveView] = useState<ProView>("resumen");
  const [serviceCommunes, setServiceCommunes] = useState<string[]>([]);
  const [serviceCommuneSelection, setServiceCommuneSelection] = useState<string>(ACTIVE_MVP_COMMUNES[0] ?? "Las Condes");
  const hourlyRateInputRef = useRef<HTMLInputElement | null>(null);

  const [slotDate, setSlotDate] = useState(dateInputDefault());
  const [weeklyDayKey, setWeeklyDayKey] = useState<DayKey>("lunes");
  const [weeklyStart, setWeeklyStart] = useState("09:00");
  const [weeklyEnd, setWeeklyEnd] = useState("13:00");
  const [editingWeeklyIndex, setEditingWeeklyIndex] = useState<number | null>(null);

  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    if (
      requestedTab === "perfil" ||
      requestedTab === "agenda" ||
      requestedTab === "reservas" ||
      requestedTab === "resenas" ||
      requestedTab === "notificaciones" ||
      requestedTab === "resumen"
    ) {
      setActiveView(requestedTab);
    }
  }, []);
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedFromAutocomplete, setSelectedFromAutocomplete] = useState(false);
  const [validatingAddress, setValidatingAddress] = useState(false);
  const [validatedAddress, setValidatedAddress] = useState("");
  const [addressValidationMessage, setAddressValidationMessage] = useState("");
  const [addressValidationError, setAddressValidationError] = useState("");
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const photoPreviewRef = useRef<HTMLDivElement | null>(null);
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
  const fullCoverageAddress = useMemo(
    () => [coverageStreet.trim(), coverageComuna.trim(), coverageCity.trim(), "Chile"].filter(Boolean).join(", "),
    [coverageCity, coverageComuna, coverageStreet]
  );
  const selectedCommunes = useMemo(
    () => normalizeCommuneList(serviceCommunes.length > 0 ? serviceCommunes : [coverageComuna]),
    [serviceCommunes, coverageComuna]
  );
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
  const weeklyAvailabilityDays = useMemo(
    () =>
      WEEK_DAY_OPTIONS.map((day) => ({
        ...day,
        blocks: onboardingAvailabilityBlocks
          .filter((block) => block.day === day.key)
          .sort((a, b) => a.start.localeCompare(b.start))
      })),
    [onboardingAvailabilityBlocks]
  );
  const weeklyBlocksCount = useMemo(() => onboardingAvailabilityBlocks.length, [onboardingAvailabilityBlocks]);
  const weeklyVisibleWindowLabel = "WeTask replica tu semana base y genera disponibilidad real para las próximas 8 semanas. En este panel ves 14 a 21 días a la vez.";
  const currentCoreCategorySlug = useMemo(() => {
    const normalized = categorySlug.trim().toLowerCase();
    return TASKER_CATEGORY_ALIASES[normalized] ?? null;
  }, [categorySlug]);
  const additionalCategoryOptions = useMemo(
    () => CORE_SERVICES.filter((service) => service.slug !== currentCoreCategorySlug),
    [currentCoreCategorySlug]
  );

  const upcomingBookings = useMemo(
    () => bookings.filter((item) => new Date(item.scheduledAt).getTime() >= Date.now() && item.status !== "COMPLETED"),
    [bookings]
  );
  const completedBookings = useMemo(() => bookings.filter((item) => item.status === "COMPLETED"), [bookings]);
  const availableSlotsCount = useMemo(() => displaySlots.filter((item) => item.isAvailable).length, [displaySlots]);
  const quickAccessCards = [
    {
      title: "Reservas activas",
      detail: `${upcomingBookings.length} servicio(s)`,
      view: "reservas" as ProView
    },
    {
      title: "Completadas",
      detail: `${completedBookings.length} servicio(s)`,
      view: "resenas" as ProView
    },
    {
      title: "Notificaciones",
      detail: `${notifications.length} aviso(s)`,
      view: "notificaciones" as ProView
    },
    {
      title: "Próxima reserva",
      detail: upcomingBookings[0]
        ? `${upcomingBookings[0].service.name} · ${formatBookingDate(upcomingBookings[0].scheduledAt)}`
        : "No tienes reservas próximas.",
      view: "reservas" as ProView
    },
    {
      title: "Comunas activas",
      detail: selectedCommunes.length > 0 ? selectedCommunes.join(", ") : "Aún no defines cobertura.",
      view: "perfil" as ProView
    },
    {
      title: "Agenda abierta",
      detail: availableSlotsCount > 0 ? `${availableSlotsCount} bloque(s) disponible(s)` : "No tienes bloques abiertos por ahora.",
      view: "agenda" as ProView
    }
  ];

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
    setServiceCommuneSelection(normalizedServiceCommunes[0] ?? ACTIVE_MVP_COMMUNES[0] ?? "Las Condes");
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

    const nextOnboardingAvailabilityBlocks = normalizeAvailabilityBlocks(profileData.availabilityBlocks);
    let nextSlots = slotsData.slots;
    if (nextSlots.length === 0 && nextOnboardingAvailabilityBlocks.length > 0) {
      const syncRes = await fetch("/api/marketplace/pro/slots/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proId: targetProId })
      });
      if (syncRes.ok) {
        const refreshedSlotsRes = await fetch(`/api/marketplace/pro/slots?proId=${targetProId}&days=21&limit=500`);
        const refreshedSlotsData = (await refreshedSlotsRes.json()) as { slots?: ProSlot[] };
        if (refreshedSlotsRes.ok && refreshedSlotsData.slots) {
          nextSlots = refreshedSlotsData.slots;
        }
      }
    }

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
    setPhotoFocus({ x: 50, y: 34 });
    setAvailabilityMode(profileData.availabilityMode ?? null);
    setOnboardingAvailabilityBlocks(nextOnboardingAvailabilityBlocks);
    applyProfile(profileData.profile ?? null, profileData.serviceCommunes ?? []);
    setSlots(nextSlots);
    const nextServices = profileData.taskerServices ?? [];
    setServices(nextServices);
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

  const openHourlyRateEditor = () => {
    setIsEditingProfile(true);
    window.setTimeout(() => {
      hourlyRateInputRef.current?.focus();
      hourlyRateInputRef.current?.select();
    }, 40);
  };

  const addServiceCommune = () => {
    setServiceCommunes((current) => (current.includes(serviceCommuneSelection) ? current : [...current, serviceCommuneSelection]));
  };

  const removeServiceCommune = (commune: string) => {
    setServiceCommunes((current) => current.filter((item) => item !== commune));
  };

  const updatePhotoFocusFromPointer = (clientX: number, clientY: number) => {
    const preview = photoPreviewRef.current;
    if (!preview) return;
    const rect = preview.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100));
    setPhotoFocus({ x, y });
  };

  const startPhotoDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setPhotoDragging(true);
    updatePhotoFocusFromPointer(event.clientX, event.clientY);
  };

  const movePhotoDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!photoDragging) return;
    updatePhotoFocusFromPointer(event.clientX, event.clientY);
  };

  const stopPhotoDrag = () => {
    setPhotoDragging(false);
  };

  const focusPhotoEditor = () => {
    window.setTimeout(() => {
      photoPreviewRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
  };

  const openPhotoPicker = () => {
    setActiveView("perfil");
    setIsEditingProfile(true);
    focusPhotoEditor();
    window.setTimeout(() => {
      photoInputRef.current?.click();
    }, 60);
  };

  const onPhotoFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setProfilePhotoUrl(dataUrl);
      setPhotoFocus({ x: 50, y: 34 });
      setActiveView("perfil");
      setIsEditingProfile(true);
      focusPhotoEditor();
      setFeedback("Foto cargada. Muévela dentro del marco y luego guarda el perfil.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo cargar la foto");
    }
  };

  const resetWeeklyComposer = () => {
    setWeeklyDayKey("lunes");
    setWeeklyStart("09:00");
    setWeeklyEnd("13:00");
    setEditingWeeklyIndex(null);
  };

  const editWeeklyBlock = (day: DayKey, index: number, block: AvailabilityBlock) => {
    setWeeklyDayKey(day);
    setWeeklyStart(block.start);
    setWeeklyEnd(block.end);
    setEditingWeeklyIndex(index);
  };

  const saveWeeklyAvailability = async (nextBlocks: AvailabilityBlock[]) => {
    const response = await fetch("/api/onboarding/cleaning/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        step: 8,
        payload: {
          availabilityMode: "FIJA",
          availabilityBlocks: nextBlocks
        }
      })
    });
    const data = (await response.json()) as { ok?: boolean; onboarding?: { availabilityBlocks?: unknown }; error?: string; detail?: string };
    if (!response.ok || !data.ok) {
      throw new Error(data.detail || data.error || "No se pudo guardar la semana base");
    }
    setOnboardingAvailabilityBlocks(normalizeAvailabilityBlocks(data.onboarding?.availabilityBlocks ?? nextBlocks));
    await fetch("/api/marketplace/pro/slots/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proId })
    });
    await loadAll(proId);
  };

  const saveWeeklyBlock = async () => {
    setFeedback("");
    setError("");
    if (weeklyEnd <= weeklyStart) {
      setError("La hora de término debe ser posterior al inicio.");
      return;
    }

    const nextBlock: AvailabilityBlock = {
      day: weeklyDayKey,
      start: weeklyStart,
      end: weeklyEnd
    };

    const nextBlocks = [...onboardingAvailabilityBlocks];
    if (editingWeeklyIndex != null) {
      const sameDayIndexes = onboardingAvailabilityBlocks
        .map((block, index) => ({ block, index }))
        .filter((item) => item.block.day === weeklyDayKey);
      const target = sameDayIndexes[editingWeeklyIndex];
      if (!target) {
        setError("No pudimos encontrar ese bloque de semana base.");
        return;
      }
      nextBlocks[target.index] = nextBlock;
    } else {
      nextBlocks.push(nextBlock);
    }

    try {
      await saveWeeklyAvailability(nextBlocks);
      resetWeeklyComposer();
      setFeedback(editingWeeklyIndex != null ? "Bloque semanal actualizado." : "Bloque semanal agregado.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo guardar la semana base");
    }
  };

  const removeWeeklyBlock = async (day: DayKey, index: number) => {
    setFeedback("");
    setError("");
    const nextBlocks = onboardingAvailabilityBlocks.filter((block, currentIndex) => {
      const sameDayIndex =
        onboardingAvailabilityBlocks
          .slice(0, currentIndex + 1)
          .filter((candidate) => candidate.day === day).length - 1;
      return !(block.day === day && sameDayIndex === index);
    });

    try {
      await saveWeeklyAvailability(nextBlocks);
      if (editingWeeklyIndex === index && weeklyDayKey === day) {
        resetWeeklyComposer();
      }
      setFeedback("Bloque semanal eliminado.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo eliminar el bloque semanal");
    }
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
      const normalizedProfilePhoto = profilePhotoUrl ? await createCenteredProfilePhoto(profilePhotoUrl, photoFocus.x, photoFocus.y) : null;
      if (normalizedProfilePhoto && normalizedProfilePhoto !== profilePhotoUrl) {
        setProfilePhotoUrl(normalizedProfilePhoto);
      }

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
          profilePhotoUrl: normalizedProfilePhoto,
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

  const openCategoryOnboarding = (serviceSlug: CoreTaskerServiceSlug) => {
    if (typeof window === "undefined") return;
    window.location.href = `/trabaja-con-nosotros/registro?service=${encodeURIComponent(serviceSlug)}`;
  };

  return (
    <main className="auth-flow-screen auth-flow-screen-scroll market-shell-auth">
      <div className="auth-flow-backdrop" aria-hidden />

      <div className="login-screen-content market-shell-auth-content">
        <MarketNav />

        <section className="auth-flow-shell auth-flow-shell-wide client-dashboard-hero">
          <div className="auth-flow-copy client-dashboard-copy pro-dashboard-copy">
            <p className="auth-flow-kicker">Panel tasker</p>
            <h1>Gestiona tu operación diaria con el look nuevo de WeTask.</h1>
            <p>Controla tu perfil, cobertura, agenda, reservas y pagos desde un panel más claro y más fácil de usar.</p>

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
                <button type="button" className="photo-camera-btn" onClick={openPhotoPicker} aria-label="Subir o cambiar foto de perfil">
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path
                      d="M8.5 5.5 9.7 4h4.6l1.2 1.5H18A2.5 2.5 0 0 1 20.5 8v8A2.5 2.5 0 0 1 18 18.5H6A2.5 2.5 0 0 1 3.5 16V8A2.5 2.5 0 0 1 6 5.5zm3.5 3a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9m0 1.8a2.7 2.7 0 1 1 0 5.4 2.7 2.7 0 0 1 0-5.4"
                      fill="currentColor"
                    />
                  </svg>
                </button>
                <input ref={photoInputRef} type="file" accept="image/png,image/jpeg" className="sr-only-input" onChange={onPhotoFileChange} />
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
              {quickAccessCards.slice(0, 3).map((card) => (
                <button
                  key={card.title}
                  type="button"
                  className="module-card client-dashboard-metric dashboard-nav-card"
                  onClick={() => setActiveView(card.view)}
                >
                  <h3>{card.title}</h3>
                  <p>{card.detail}</p>
                </button>
              ))}
            </div>
            <div className="module-grid dashboard-summary-grid">
              {quickAccessCards.slice(3).map((card) => (
                <button
                  key={card.title}
                  type="button"
                  className="module-card client-dashboard-card dashboard-summary-card dashboard-nav-card"
                  onClick={() => setActiveView(card.view)}
                >
                  <h3>{card.title}</h3>
                  <p>{card.detail}</p>
                </button>
              ))}
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
              {!isEditingProfile ? (
                <button className="cta ghost small" type="button" onClick={() => setIsEditingProfile(true)}>
                  Editar perfil
                </button>
              ) : null}
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

                {selectedCommunes.length > 0 ? (
                  <article className="module-card client-dashboard-card full">
                    <h3>Comunas donde trabajas</h3>
                    <div className="commune-chip-list" aria-label="Comunas activas">
                      {selectedCommunes.map((commune) => (
                        <span key={commune} className="commune-chip">
                          {commune}
                        </span>
                      ))}
                    </div>
                  </article>
                ) : null}

                <article className="module-card client-dashboard-card full tasker-extra-category-card">
                  <div className="tasker-extra-category-head">
                    <div>
                      <h3>Agregar otra categoría</h3>
                      <p>Si quieres ofrecer otro servicio en WeTask, entra directo a su onboarding y completa esa categoría.</p>
                    </div>
                  </div>
                  <div className="tasker-extra-category-grid">
                    {additionalCategoryOptions.map((service) => (
                      <button
                        key={service.slug}
                        type="button"
                        className="tasker-extra-category-option"
                        onClick={() => openCategoryOnboarding(service.slug)}
                      >
                        <span className="tasker-extra-category-icon" aria-hidden>
                          {service.icon}
                        </span>
                        <strong>{service.label}</strong>
                        <span>{service.taskerDescription}</span>
                      </button>
                    ))}
                  </div>
                </article>
              </div>
            ) : null}

            {isEditingProfile ? <div className="grid-form">
              <div className="full profile-photo-editor-card">
                <div
                  ref={photoPreviewRef}
                  className={`tasker-photo-preview ${photoDragging ? "dragging" : ""}`}
                  onPointerDown={startPhotoDrag}
                  onPointerMove={movePhotoDrag}
                  onPointerUp={stopPhotoDrag}
                  onPointerCancel={stopPhotoDrag}
                  onPointerLeave={stopPhotoDrag}
                >
                  {profilePhotoUrl ? (
                    <img src={profilePhotoUrl} alt="Vista previa de perfil" style={{ objectPosition: `${photoFocus.x}% ${photoFocus.y}%` }} />
                  ) : (
                    <span className="tasker-photo-empty">{initialsFromName(proName)}</span>
                  )}
                </div>
                <div className="tasker-photo-editor-copy">
                  <strong>Foto de perfil</strong>
                  <span>Mueve la foto dentro del marco para centrar la cara. Usa la cámara para subir otra si quieres cambiarla.</span>
                  <div className="cta-row">
                    <button type="button" className="cta ghost small" onClick={openPhotoPicker}>
                      Cambiar foto
                    </button>
                  </div>
                </div>
              </div>
              <label className="full">
                Bio
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Experiencia, especialidad, herramientas." />
              </label>
              <label className="full tasker-address-field">
                Dirección
                <input
                  className="tasker-address-input"
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
                <p className="input-hint">{validatingAddress ? "Validando la dirección automáticamente." : "La comuna y la ubicación se validan automáticamente."}</p>
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
                <div className="commune-selector-panel">
                  <div className="commune-picker-row">
                    <select value={serviceCommuneSelection} onChange={(event) => setServiceCommuneSelection(event.target.value)}>
                      {ACTIVE_MVP_COMMUNES.map((commune) => (
                        <option key={commune} value={commune}>
                          {commune}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="cta ghost small" onClick={addServiceCommune}>
                      Agregar comuna
                    </button>
                  </div>
                  <div className="commune-chip-list-frame">
                    {selectedCommunes.length > 0 ? (
                      <div className="commune-chip-list" aria-label="Comunas activas">
                        {selectedCommunes.map((commune) => (
                          <span key={commune} className="commune-chip">
                            {commune}
                            <button type="button" aria-label={`Quitar ${commune}`} onClick={() => removeServiceCommune(commune)}>
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="commune-empty">Todavía no agregas comunas de trabajo.</p>
                    )}
                  </div>
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
              {addressValidationMessage ? (
                <p className="coverage-meta coverage-meta-ok">
                  {addressValidationMessage} {validatedAddress ? `(${validatedAddress})` : ""}
                </p>
              ) : null}
              {addressValidationError ? <p className="coverage-meta coverage-meta-error">{addressValidationError}</p> : null}
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
              <h2>Disponibilidad semanal</h2>
              <p>Primero defines tu semana base y luego, si quieres, bloqueas o ajustas fechas puntuales sin tocar el resto.</p>
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

              </aside>

              <div className="availability-main-column">
                <div className="availability-board-card">
                  <div className="availability-board-head">
                    <div>
                      <p className="availability-eyebrow">Semana base</p>
                      <h3>Estos horarios se repiten cada semana</h3>
                    </div>
                    <span className="availability-board-chip">{weeklyBlocksCount} bloque(s) semanales</span>
                  </div>

                  <p className="availability-inline-note">
                    Esta es la disponibilidad que definiste en tu onboarding. Si luego necesitas cerrar un bloque específico, hazlo
                    abajo desde el calendario sin tocar toda la semana.
                  </p>
                  <p className="availability-inline-note soft">{weeklyVisibleWindowLabel}</p>

                  <div className="availability-weekly-editor">
                    <div className="grid-form availability-form-grid">
                      <label>
                        Día
                        <select value={weeklyDayKey} onChange={(event) => setWeeklyDayKey(event.target.value as DayKey)}>
                          {WEEK_DAY_OPTIONS.map((day) => (
                            <option key={day.key} value={day.key}>
                              {day.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Inicio
                        <input type="time" value={weeklyStart} onChange={(event) => setWeeklyStart(event.target.value)} />
                      </label>
                      <label>
                        Término
                        <input type="time" value={weeklyEnd} onChange={(event) => setWeeklyEnd(event.target.value)} />
                      </label>
                    </div>
                    <div className="cta-row availability-form-actions">
                      <button className="cta" type="button" onClick={saveWeeklyBlock}>
                        {editingWeeklyIndex != null ? "Guardar bloque semanal" : "Agregar a semana base"}
                      </button>
                      {editingWeeklyIndex != null ? (
                        <button className="cta ghost small" type="button" onClick={resetWeeklyComposer}>
                          Cancelar edición
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="availability-weekly-grid">
                    {weeklyAvailabilityDays.map((day) => (
                      <article key={day.key} className={`availability-weekly-day ${day.blocks.length > 0 ? "active" : ""}`}>
                        <div className="availability-weekly-day-head">
                          <strong>{day.label}</strong>
                          <span>{day.blocks.length > 0 ? `${day.blocks.length} bloque(s)` : "Libre"}</span>
                        </div>
                        {day.blocks.length === 0 ? (
                          <p className="availability-weekly-empty">Sin horario base ese día.</p>
                        ) : (
                          <div className="availability-weekly-blocks">
                            {day.blocks.map((block, index) => (
                              <div key={`${day.key}-${block.start}-${block.end}-${index}`} className="availability-weekly-pill-row">
                                <span className="availability-weekly-block">
                                  {block.start} - {block.end}
                                </span>
                                <button className="cta ghost small" type="button" onClick={() => editWeeklyBlock(day.key, index, block)}>
                                  Editar
                                </button>
                                <button className="cta ghost small" type="button" onClick={() => removeWeeklyBlock(day.key, index)}>
                                  Quitar
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </div>

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

                  <p className="availability-inline-note">
                    Aquí gestionas excepciones puntuales. Puedes seleccionar una fecha específica y bloquear, reabrir o eliminar ese
                    bloque si ese día no quieres trabajar.
                  </p>

                  <div className="availability-weekdays">
                    {WEEK_DAY_OPTIONS.map((day) => (
                      <span key={day.key}>{day.shortLabel}</span>
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
                        <p className="availability-eyebrow">Fecha puntual</p>
                        <h4>{selectedDayLabel}</h4>
                      </div>
                      <span className="availability-selected-pill">
                        {selectedDaySlots.length > 0 ? `${selectedDaySlots.length} bloque(s)` : "Sin bloques"}
                      </span>
                    </div>

                    {selectedDaySlots.length === 0 ? (
                      <div className="availability-empty-state">
                        <strong>No tienes horarios puntuales cargados para este día.</strong>
                        <p>Si quieres abrir una excepción adicional para esta fecha, usa el formulario de la izquierda.</p>
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
                                {slot.bookings.length > 0
                                  ? "Este bloque ya tiene una reserva asociada."
                                  : slot.isAvailable
                                    ? "Visible para nuevas reservas en esa fecha."
                                    : "Bloqueado para esa fecha y oculto a clientes."}
                              </p>
                            </div>
                            {slot.source === "onboarding" ? null : (
                              <div className="availability-task-actions">
                                <button className="cta small" type="button" onClick={() => updateSlotAvailability(slot.id, !slot.isAvailable)}>
                                  {slot.isAvailable ? "Bloquear" : "Volver a abrir"}
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
