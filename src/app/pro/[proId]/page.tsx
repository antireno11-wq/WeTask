"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MarketNav } from "@/components/market-nav";
import {
  getBabysitterAgeRangeLabel,
  getBabysitterExcludedTaskLabel,
  getBabysitterIncludedTaskLabel,
  getBabysitterServiceLabel,
  normalizeBabysitterScope
} from "@/lib/babysitter-scope";
import {
  getChefExcludedTaskLabel,
  getChefIncludedTaskLabel,
  getChefScopeServiceLabel,
  normalizeChefScope
} from "@/lib/chef-scope";
import { copyCleaningEstimateParams, parseCleaningRecommendedHours } from "@/lib/cleaning-duration-estimator";
import { getChefServiceDefinition } from "@/lib/chef-service-types";
import { getCleaningServiceDefinition } from "@/lib/cleaning-service-types";
import {
  getCleaningExcludedTaskLabel,
  getCleaningIncludedTaskLabel,
  getCleaningScopeServiceLabel,
  normalizeCleaningScope
} from "@/lib/cleaning-scope";
import {
  getPetExcludedTaskLabel,
  getPetIncludedTaskLabel,
  getPetScopeAnimalLabel,
  getPetScopeServiceLabel,
  normalizePetScope
} from "@/lib/pet-scope";
import {
  getMakeupExcludedTaskLabel,
  getMakeupIncludedTaskLabel,
  getMakeupServiceLabel,
  normalizeMakeupScope
} from "@/lib/makeup-scope";
import {
  getIroningExcludedTaskLabel,
  getIroningIncludedTaskLabel,
  getIroningServiceLabel,
  normalizeIroningScope
} from "@/lib/ironing-scope";
import {
  getTrainerExcludedTaskLabel,
  getTrainerIncludedTaskLabel,
  getTrainerModeLabel,
  getTrainerServiceLabel,
  normalizeTrainerScope
} from "@/lib/trainer-scope";
import {
  getTeacherExcludedTaskLabel,
  getTeacherIncludedTaskLabel,
  getTeacherLevelLabel,
  getTeacherModeLabel,
  getTeacherServiceLabel,
  normalizeTeacherScope
} from "@/lib/teacher-scope";

type CleaningOnboardingSummary = {
  profilePhotoUrl: string | null;
  shortDescription: string | null;
  yearsExperience: number | null;
  workMode: "SOLO" | "EQUIPO" | null;
  categorySlug: string | null;
  offeredServices: unknown;
  experienceTypes: unknown;
  cleaningScope: unknown;
  petScope: unknown;
  makeupScope: unknown;
  ironingScope: unknown;
  babysitterScope: unknown;
  chefScope: unknown;
  trainerScope: unknown;
  teacherScope: unknown;
  acceptsHomesWithPets: boolean | null;
  acceptsHomesWithChildren: boolean | null;
  bringsOwnProducts: boolean | null;
  bringsOwnTools: boolean | null;
  languages: unknown;
  baseCommune: string | null;
  maxTravelKm: number | null;
  serviceCommunes?: unknown;
  identityDocumentFrontFile?: string | null;
  identityDocumentBackFile?: string | null;
  criminalRecordFile?: string | null;
};

type ProfessionalDetail = {
  id: string;
  avatarUrl?: string | null;
  userId: string;
  bio: string | null;
  isVerified: boolean;
  ratingAvg: number;
  ratingsCount: number;
  coverageCity: string | null;
  coveragePostal: string | null;
  coverageLatitude: number | null;
  coverageLongitude: number | null;
  serviceRadiusKm: number;
  hourlyRateFromClp: number | null;
  taskerServices: Array<{
    priceClp: number;
    category: { slug: string; name: string } | null;
    service: { id: string; name: string } | null;
  }>;
  categoryProfiles: Array<{
    id: string;
    categorySlug: string;
    hourlyRateClp: number;
    serviceCommunes: string[];
    offeredServices: string[];
    experienceTypes: string[];
    scopeData: unknown;
    isActive: boolean;
    completedAt: string | null;
  }>;
  user: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    cleaningOnboarding: CleaningOnboardingSummary | null;
  };
};

type AvailabilitySlot = {
  id: string;
  startsAt: string;
  endsAt: string;
  service: { id: string; name: string } | null;
};

type SampleReview = {
  name: string;
  time: string;
  serviceLabel: string;
  overall: number;
  punctuality: number;
  communication: number;
  quality: number;
  wouldBookAgain: boolean;
  text: string;
};

type FaqItem = {
  question: string;
  answer: string;
};

type PublicProfileView = "perfil" | "valoraciones" | "agenda";

const sampleComments: SampleReview[] = [
  {
    name: "Josefa R.",
    time: "hace 6 dias",
    serviceLabel: "Limpieza profunda",
    overall: 5,
    punctuality: 5,
    communication: 5,
    quality: 5,
    wouldBookAgain: true,
    text: "Llegó puntual, explicó todo antes de empezar y dejó la cocina impecable. La volvería a reservar sin dudar."
  },
  {
    name: "Martin P.",
    time: "hace 2 semanas",
    serviceLabel: "Limpieza general",
    overall: 4,
    punctuality: 5,
    communication: 4,
    quality: 4,
    wouldBookAgain: true,
    text: "Muy buena experiencia. Ordenó bien los espacios y mantuvo una comunicación clara durante toda la visita."
  },
  {
    name: "Carolina S.",
    time: "hace 1 mes",
    serviceLabel: "Orden y organizacion",
    overall: 5,
    punctuality: 4,
    communication: 5,
    quality: 5,
    wouldBookAgain: true,
    text: "Fue muy profesional y cuidadosa con mis cosas. Se nota la experiencia y el trato amable con el cliente."
  }
];

const demoOfferedServices = ["Limpieza general", "Limpieza profunda", "Planchado", "Orden y organización"];
const demoExperienceTypes = ["Casas", "Departamentos", "Oficinas pequeñas"];
const demoLanguages = ["Español"];

function clp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

function isValidYmd(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function dateInputDefault(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
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

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() ?? "")
    .join("");
}

function labelize(value: string) {
  const cleaningService = getCleaningServiceDefinition(value);
  if (cleaningService) return cleaningService.name;
  const chefService = getChefServiceDefinition(value);
  if (chefService) return chefService.name;
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function toLabelList(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const cleaned = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map(labelize);
  return cleaned.length > 0 ? cleaned : fallback;
}

function categoryLabel(value: string | null | undefined) {
  switch (normalizeCategorySlug(value)) {
    case "limpieza":
      return "Limpieza";
    case "mascotas":
      return "Cuidado de mascotas";
    case "babysitter":
      return "Babysitter";
    case "profesor-particular":
      return "Profesor particular";
    case "personal-trainer":
      return "Personal trainer";
    case "chef":
      return "Chef";
    case "maquillaje":
      return "Maquillaje";
    case "planchado":
      return "Planchado";
    default:
      return "Servicios a domicilio";
  }
}

function renderStars(value: number) {
  return Array.from({ length: 5 }, (_, index) => (index < Math.round(value) ? "★" : "☆")).join("");
}

function ratingLabel(value: number) {
  if (value >= 4.8) return "Excelente";
  if (value >= 4.5) return "Muy bien evaluado";
  if (value >= 4) return "Muy buen servicio";
  return "Bien evaluado";
}

function taskerRoleLabel(value: string | null | undefined) {
  switch (normalizeCategorySlug(value)) {
    case "limpieza":
      return "Tasker de limpieza";
    case "mascotas":
      return "Tasker de paseo y cuidado de mascotas";
    case "babysitter":
      return "Tasker de babysitting";
    case "profesor-particular":
      return "Tasker de clases particulares";
    case "personal-trainer":
      return "Tasker de personal training";
    case "chef":
      return "Tasker chef a domicilio";
    case "maquillaje":
      return "Tasker de maquillaje";
    case "planchado":
      return "Tasker de planchado";
    default:
      return "Tasker de servicios a domicilio";
  }
}

function faqItemsForCategory(categorySlug: string | null | undefined): FaqItem[] {
  switch (normalizeCategorySlug(categorySlug)) {
    case "mascotas":
      return [
        {
          question: "¿Qué tipo de cuidado de mascotas ofrece?",
          answer:
            "Puedes revisar en el perfil si hace paseos, cuidado en casa del cliente o cuidado en su propio domicilio. Antes de reservar, por chat puedes confirmar detalles como tamaño, rutina y necesidades de tu mascota."
        },
        {
          question: "¿Puede cuidar más de una mascota a la vez?",
          answer:
            "Sí, pero depende del tipo de servicio y de la rutina de cada mascota. Lo ideal es indicar cuántas mascotas son y sus necesidades para confirmar disponibilidad real."
        },
        {
          question: "¿Qué pasa si mi mascota necesita cuidados especiales?",
          answer:
            "Puedes dejar esa información en la reserva y volver a confirmarla por chat. Así el tasker puede decirte si cuenta con la experiencia adecuada antes del servicio."
        },
        {
          question: "¿Puedo agendar paseos o cuidados recurrentes?",
          answer:
            "Sí. En WeTask puedes reservar nuevamente al mismo profesional o coordinar servicios frecuentes según su agenda disponible."
        },
        {
          question: "¿Cómo se confirma la disponibilidad?",
          answer:
            "La agenda visible muestra horarios abiertos. Una vez que eliges un bloque y completas la reserva, el servicio queda confirmado dentro de la plataforma."
        }
      ];
    case "chef":
      return [
        {
          question: "¿Qué tipo de servicios de chef ofrece?",
          answer:
            "Depende del perfil: puede incluir cocina gourmet, cocina casera, repostería, cocina para eventos o cumpleaños. En la ficha se muestran sus especialidades y puedes confirmar el detalle antes de reservar."
        },
        {
          question: "¿Cocina en la casa del cliente?",
          answer:
            "Sí. En WeTask este servicio está pensado para realizarse en el domicilio del cliente, siguiendo las condiciones y requerimientos acordados en la reserva."
        },
        {
          question: "¿Puedo pedir un menú especial o restricciones alimentarias?",
          answer:
            "Sí. Puedes dejar observaciones en tu reserva y usar el chat para detallar alergias, preferencias o restricciones antes de la visita."
        },
        {
          question: "¿Quién pone los ingredientes?",
          answer:
            "Eso puede acordarse según el tipo de servicio. Algunos servicios consideran lista de compras sugerida y otros se coordinan directamente con el cliente antes de la fecha."
        },
        {
          question: "¿Puedo reservar de forma recurrente?",
          answer:
            "Sí. Si te gusta la experiencia, puedes volver a reservar al mismo profesional según su disponibilidad visible en WeTask."
        }
      ];
    case "maquillaje":
      return [
        {
          question: "¿Qué tipos de maquillaje realiza?",
          answer:
            "El perfil puede incluir maquillaje social, para eventos y novias. Revisa sus especialidades y confirma por chat si necesitas algo específico."
        },
        {
          question: "¿El kit de maquillaje está incluido?",
          answer:
            "Si el profesional trabaja con kit propio, eso queda indicado en su perfil u observaciones del servicio. También puedes consultarlo antes de reservar."
        },
        {
          question: "¿Puede atender a domicilio?",
          answer:
            "Sí. Este servicio está pensado para coordinarse de forma cómoda a través de WeTask y concretarse en el lugar indicado por el cliente."
        },
        {
          question: "¿Puedo reservar para una ocasión especial?",
          answer:
            "Sí. Puedes reservar para eventos, celebraciones, sesiones o matrimonio, indicando fecha, hora y referencias importantes en la solicitud."
        },
        {
          question: "¿Cómo aseguro mi horario?",
          answer:
            "La mejor forma es reservar directamente el bloque disponible dentro de la plataforma, así el servicio queda protegido y confirmado."
        }
      ];
    case "planchado":
      return [
        {
          question: "¿Cómo cobra este servicio de planchado?",
          answer:
            "En WeTask el servicio de planchado se maneja por hora. En el perfil puedes ver la tarifa referencial y reservar según la duración estimada."
        },
        {
          question: "¿Puede planchar ropa delicada?",
          answer:
            "Si el profesional ofrece ese tipo de servicio, puedes verlo en sus especialidades o confirmarlo antes de la reserva para evitar errores con prendas sensibles."
        },
        {
          question: "¿El servicio se hace en mi casa?",
          answer:
            "Sí, salvo que el profesional haya indicado otra modalidad específica. Lo importante es revisar el detalle del perfil antes de confirmar."
        },
        {
          question: "¿Puedo agendar varias horas seguidas?",
          answer:
            "Sí. Puedes elegir un bloque disponible y reservar el tiempo que necesites según la cantidad de ropa y el ritmo del servicio."
        },
        {
          question: "¿Qué debo tener listo antes de la visita?",
          answer:
            "Idealmente deja la ropa separada y comenta si hay prendas delicadas o instrucciones especiales para que el servicio sea más fluido."
        }
      ];
    default:
      return [
        {
          question: "¿Qué incluye este servicio?",
          answer:
            "Cada tasker detalla en su perfil las tareas y especialidades que ofrece. Antes de reservar puedes revisar esa información y usar el chat para confirmar dudas puntuales."
        },
        {
          question: "¿Puede realizar tareas adicionales?",
          answer:
            "Depende del tipo de servicio y de lo que el profesional haya definido en su perfil. Si necesitas algo extra, lo mejor es consultarlo antes de confirmar la reserva."
        },
        {
          question: "¿Qué pasa si no cuento con materiales o implementos?",
          answer:
            "Algunos taskers trabajan con sus propios productos o herramientas y otros requieren que el cliente los tenga disponibles. Eso se puede aclarar antes del servicio."
        },
        {
          question: "¿Puedo reservar de forma semanal o recurrente?",
          answer:
            "Sí. Si el profesional tiene disponibilidad, puedes volver a reservarlo y coordinar servicios frecuentes desde la plataforma."
        },
        {
          question: "¿Qué significa reserva mínima?",
          answer:
            "Es el tiempo base o la condición mínima que el profesional requiere para aceptar un servicio. Esa información se considera en la reserva y el valor estimado."
        }
      ];
  }
}

function normalizeCategorySlug(value: string | null | undefined) {
  switch (value) {
    case "paseo-cuidado-mascotas":
      return "mascotas";
    case "babysitter-por-horas":
      return "babysitter";
    case "chef-a-domicilio":
      return "chef";
    case "maquillaje-a-domicilio":
      return "maquillaje";
    default:
      return value ?? null;
  }
}

function buildDemoProfessional(proId: string): ProfessionalDetail {
  const cleanId = proId.replace(/[-_]/g, " ").trim();
  const fallbackName = cleanId.length > 0 ? labelize(cleanId) : "Tasker WeTask";

  return {
    id: `demo-profile-${proId}`,
    userId: proId,
    bio: "Tasker con experiencia comprobada en servicios a domicilio, enfoque en puntualidad y resultados de calidad.",
    isVerified: true,
    ratingAvg: 4.9,
    ratingsCount: 47,
    coverageCity: "Santiago",
    coveragePostal: "7500000",
    coverageLatitude: -33.4489,
    coverageLongitude: -70.6693,
    serviceRadiusKm: 12,
    hourlyRateFromClp: 15000,
    categoryProfiles: [],
    taskerServices: [
      {
        priceClp: 14000,
        category: { slug: "limpieza", name: "Limpieza" },
        service: { id: "demo-limpieza-hogar", name: "Limpieza estándar" }
      },
      {
        priceClp: 18000,
        category: { slug: "limpieza", name: "Limpieza" },
        service: { id: "demo-limpieza-profunda", name: "Limpieza profunda" }
      },
      {
        priceClp: 14000,
        category: { slug: "planchado", name: "Planchado" },
        service: { id: "demo-planchado", name: "Planchado por hora" }
      }
    ],
    user: {
      id: proId,
      fullName: fallbackName,
      email: "tasker@wetask.cl",
      phone: "+56 9 5555 5555",
      cleaningOnboarding: {
        profilePhotoUrl: null,
        shortDescription: "Perfil profesional con foco en limpieza del hogar, atención cordial y cumplimiento de horarios.",
        yearsExperience: 7,
        workMode: "SOLO",
        categorySlug: "limpieza",
        offeredServices: demoOfferedServices,
        experienceTypes: demoExperienceTypes,
        cleaningScope: {
          services_offered: ["aseo_general", "aseo_profundo", "organizacion_espacios"],
          tasks_included: ["barrer", "aspirar", "trapear", "limpiar_banos", "limpiar_cocina_por_fuera", "sacar_basura"],
          tasks_excluded: ["limpieza_en_altura", "mover_muebles_pesados"],
          special_conditions: "No mueve muebles pesados ni trabaja en altura."
        },
        petScope: null,
        makeupScope: null,
        ironingScope: null,
        babysitterScope: null,
        chefScope: null,
        trainerScope: null,
        teacherScope: null,
        acceptsHomesWithPets: null,
        acceptsHomesWithChildren: null,
        bringsOwnProducts: null,
        bringsOwnTools: null,
        languages: demoLanguages,
        baseCommune: "Santiago",
        maxTravelKm: 12
      }
    }
  };
}

function buildDemoSlots(baseDate: string, proId: string): AvailabilitySlot[] {
  const start = new Date(`${baseDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return [];

  const slots: AvailabilitySlot[] = [];
  const windows = [
    [9, 0, 11, 0],
    [12, 0, 14, 0],
    [16, 0, 18, 0]
  ];

  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    for (let i = 0; i < windows.length; i += 1) {
      const [startH, startM, endH, endM] = windows[i];
      const startsAt = new Date(start);
      startsAt.setDate(start.getDate() + dayOffset);
      startsAt.setHours(startH, startM, 0, 0);

      const endsAt = new Date(start);
      endsAt.setDate(start.getDate() + dayOffset);
      endsAt.setHours(endH, endM, 0, 0);

      slots.push({
        id: `demo-slot-${proId}-${dayOffset}-${i}`,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        service: { id: "demo-service", name: "Servicio a domicilio" }
      });
    }
  }

  return slots;
}

export default function ProDetailPage() {
  const params = useParams<{ proId: string }>();
  const searchParams = useSearchParams();
  const requestedDate = searchParams.get("date");
  const requestedAddress = searchParams.get("address") ?? "";
  const requestedApartment = searchParams.get("apartment") ?? "";
  const requestedReference = searchParams.get("reference") ?? "";
  const requestedCommune = searchParams.get("commune") ?? searchParams.get("comuna") ?? "";
  const requestedCity = searchParams.get("city") ?? "";
  const requestedServiceId = searchParams.get("serviceId") ?? "";
  const requestedRecommendedHours = parseCleaningRecommendedHours(searchParams.get("recommendedHours"));
  const requestedEstimatedMinHours = searchParams.get("estimatedMinHours") ?? "";
  const requestedEstimatedMaxHours = searchParams.get("estimatedMaxHours") ?? "";
  const initialDate = isValidYmd(requestedDate) ? requestedDate! : dateInputDefault();
  const [date, setDate] = useState(initialDate);
  const [selectedDay, setSelectedDay] = useState(initialDate);
  const [expandedAbout, setExpandedAbout] = useState(false);
  const [activeView, setActiveView] = useState<PublicProfileView>("perfil");

  const [data, setData] = useState<ProfessionalDetail | null>(null);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        setNotice("");

        const [proRes, availabilityRes] = await Promise.all([
          fetch(`/api/marketplace/pros/${params.proId}`),
          fetch(`/api/marketplace/availability?proId=${params.proId}&date=${date}&days=45&limit=240`)
        ]);

        const proBody = (await proRes.json()) as { professional?: ProfessionalDetail; error?: string; detail?: string };
        const availabilityBody = (await availabilityRes.json()) as {
          slots?: Array<AvailabilitySlot>;
          error?: string;
          detail?: string;
        };

        let resolvedProfile: ProfessionalDetail;
        if (!proRes.ok || !proBody.professional) {
          resolvedProfile = buildDemoProfessional(params.proId);
          setNotice("Mostrando un perfil referencial para visualizar cómo se verá el tasker.");
        } else {
          resolvedProfile = proBody.professional;
        }

        let resolvedSlots: AvailabilitySlot[] = [];
        if (!availabilityRes.ok || !availabilityBody.slots) {
          resolvedSlots = buildDemoSlots(date, params.proId);
          setNotice((prev) =>
            prev
              ? `${prev} También cargamos una agenda de ejemplo.`
              : "Mostrando una agenda referencial para que puedas ver los días disponibles."
          );
        } else {
          resolvedSlots = availabilityBody.slots;
        }

        if (resolvedSlots.length === 0) {
          resolvedSlots = buildDemoSlots(date, params.proId);
        }

        setData(resolvedProfile);
        setSlots(resolvedSlots);
      } catch {
        setData(buildDemoProfessional(params.proId));
        setSlots(buildDemoSlots(date, params.proId));
        setNotice("No fue posible cargar todos los datos en vivo. Te mostramos una vista de ejemplo.");
        setError("");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [params.proId, date]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#availability") {
      setActiveView("agenda");
    } else if (window.location.hash === "#reviews") {
      setActiveView("valoraciones");
    }
  }, []);

  const dayGroups = useMemo(() => {
    const map = new Map<string, AvailabilitySlot[]>();
    for (const slot of slots) {
      const key = slot.startsAt.slice(0, 10);
      const prev = map.get(key) ?? [];
      prev.push(slot);
      map.set(key, prev);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [slots]);

  useEffect(() => {
    if (!selectedDay && dayGroups[0]) {
      setSelectedDay(dayGroups[0][0]);
    }
    if (selectedDay && !dayGroups.some(([day]) => day === selectedDay)) {
      setSelectedDay(dayGroups[0]?.[0] ?? "");
    }
  }, [dayGroups, selectedDay]);

  const selectedSlots = useMemo(() => dayGroups.find(([day]) => day === selectedDay)?.[1] ?? [], [dayGroups, selectedDay]);
  const todayKey = useMemo(() => formatDayKey(new Date()), []);
  const selectedDate = useMemo(() => new Date(`${selectedDay}T12:00:00`), [selectedDay]);
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
      const current = new Date(start);
      current.setDate(start.getDate() + index);
      return {
        key: formatDayKey(current),
        date: current,
        isCurrentMonth: current.getMonth() === selectedDate.getMonth()
      };
    });
  }, [selectedDate]);
  const slotsByDay = useMemo(() => {
    const map = new Map<string, AvailabilitySlot[]>();
    for (const slot of slots) {
      const key = slot.startsAt.slice(0, 10);
      const prev = map.get(key) ?? [];
      map.set(key, [...prev, slot].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
    }
    return map;
  }, [slots]);
  const availableSlotsCount = slots.length;
  const daysWithSlotsCount = slotsByDay.size;
  const todaySlots = slotsByDay.get(todayKey) ?? [];
  const nextAvailableSlot = slots[0] ?? null;

  const aboutText = useMemo(() => {
    const base = data?.bio?.trim() || data?.user.cleaningOnboarding?.shortDescription?.trim();
    const fallback =
      "Importante: aunque el calendario muestre franjas ocupadas, consulta disponibilidad. Disponemos de equipo rotativo y adaptamos horarios según tipo de servicio. Trabajamos en limpieza general, apoyo en hogar y servicios especiales bajo cotización.";
    return base && base.length > 30 ? `${fallback} ${base}` : fallback;
  }, [data?.bio, data?.user.cleaningOnboarding?.shortDescription]);

  const aboutPreview = aboutText.length > 340 ? `${aboutText.slice(0, 340)}...` : aboutText;

  const rating = Number(data?.ratingAvg || 0);
  const qualityScore = Math.min(5, Math.max(4, rating + 0.1));
  const friendlinessScore = Math.min(5, Math.max(4, rating + 0.2));
  const professionalismScore = Math.min(5, Math.max(4, rating + 0.15));
  const punctualityScore = Math.min(5, Math.max(4, rating + 0.1));
  const reviewSummaryCards = [
    { label: "Servicio", score: rating },
    { label: "Calidad", score: qualityScore },
    { label: "Amabilidad", score: friendlinessScore },
    { label: "Puntualidad", score: punctualityScore }
  ];
  const switchPublicView = (view: PublicProfileView) => {
    setActiveView(view);
    if (typeof window !== "undefined") {
      const hash = view === "agenda" ? "#availability" : view === "valoraciones" ? "#reviews" : "#perfil";
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
      window.setTimeout(() => {
        document.getElementById("public-tasker-view")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 40);
    }
  };
  const onboarding = data?.user.cleaningOnboarding ?? null;
  const serviceCategories = useMemo(() => {
    const bySlug = new Map<string, { slug: string; name: string }>();
    for (const item of data?.taskerServices ?? []) {
      const category = item.category;
      if (!category?.slug) continue;
      if (!bySlug.has(category.slug)) {
        bySlug.set(category.slug, category);
      }
    }
    return Array.from(bySlug.values());
  }, [data?.taskerServices]);
  const normalizedOnboardingCategorySlug = normalizeCategorySlug(onboarding?.categorySlug ?? null);
  const requestedCategorySlug = useMemo(() => {
    const requestedService = (data?.taskerServices ?? []).find((item) => item.service?.id === requestedServiceId);
    return normalizeCategorySlug(requestedService?.category?.slug ?? null);
  }, [data?.taskerServices, requestedServiceId]);
  const primaryCategorySlug = requestedCategorySlug ?? onboarding?.categorySlug ?? serviceCategories[0]?.slug ?? null;
  const normalizedPrimaryCategorySlug = normalizeCategorySlug(primaryCategorySlug);
  const selectedCategoryProfile =
    normalizedPrimaryCategorySlug && normalizedPrimaryCategorySlug !== normalizedOnboardingCategorySlug
      ? data?.categoryProfiles.find((item) => normalizeCategorySlug(item.categorySlug) === normalizedPrimaryCategorySlug) ?? null
      : null;
  const selectedScopeSource = selectedCategoryProfile?.scopeData ?? null;
  const cleaningScope = useMemo(
    () => normalizeCleaningScope(normalizedPrimaryCategorySlug === "limpieza" && selectedScopeSource ? selectedScopeSource : onboarding?.cleaningScope),
    [normalizedPrimaryCategorySlug, onboarding?.cleaningScope, selectedScopeSource]
  );
  const petScope = useMemo(() => {
    const normalized = normalizePetScope(normalizedPrimaryCategorySlug === "mascotas" && selectedScopeSource ? selectedScopeSource : onboarding?.petScope);
    if (normalized.services_offered.length > 0 || normalized.animals_accepted.length > 0 || normalized.tasks_included.length > 0) {
      return normalized;
    }

    return {
      ...normalized,
      services_offered: Array.isArray(onboarding?.offeredServices)
        ? onboarding.offeredServices.filter(
            (item): item is "paseo_perros" | "cuidado_casa_cliente" | "cuidado_en_tu_casa" =>
              item === "paseo_perros" || item === "cuidado_casa_cliente" || item === "cuidado_en_tu_casa"
          )
        : [],
      animals_accepted: Array.isArray(onboarding?.experienceTypes)
        ? onboarding.experienceTypes.filter((item): item is "perros" | "gatos" => item === "perros" || item === "gatos")
        : [],
      accepts_large_pets: onboarding?.acceptsHomesWithPets ?? null
    };
  }, [normalizedPrimaryCategorySlug, onboarding?.petScope, onboarding?.offeredServices, onboarding?.experienceTypes, onboarding?.acceptsHomesWithPets, selectedScopeSource]);
  const makeupScope = useMemo(() => {
    const normalized = normalizeMakeupScope(normalizedPrimaryCategorySlug === "maquillaje" && selectedScopeSource ? selectedScopeSource : onboarding?.makeupScope);
    if (normalized.services_offered.length > 0 || normalized.tasks_included.length > 0) {
      return normalized;
    }

    return {
      ...normalized,
      services_offered: Array.isArray(onboarding?.offeredServices)
        ? onboarding.offeredServices.filter(
            (item): item is "social" | "eventos" | "novias" => item === "social" || item === "eventos" || item === "novias"
          )
        : [],
      includes_kit: onboarding?.bringsOwnProducts ?? null
    };
  }, [normalizedPrimaryCategorySlug, onboarding?.makeupScope, onboarding?.offeredServices, onboarding?.bringsOwnProducts, selectedScopeSource]);
  const ironingScope = useMemo(() => {
    const normalized = normalizeIroningScope(normalizedPrimaryCategorySlug === "planchado" && selectedScopeSource ? selectedScopeSource : onboarding?.ironingScope);
    if (normalized.services_offered.length > 0 || normalized.tasks_included.length > 0) {
      return normalized;
    }

    return {
      ...normalized,
      services_offered: Array.isArray(onboarding?.offeredServices)
        ? onboarding.offeredServices.filter(
            (item): item is "casa_cliente" | "retiro_entrega" => item === "casa_cliente" || item === "retiro_entrega"
          )
        : [],
      delicate_clothes: onboarding?.bringsOwnTools ?? null
    };
  }, [normalizedPrimaryCategorySlug, onboarding?.ironingScope, onboarding?.offeredServices, onboarding?.bringsOwnTools, selectedScopeSource]);
  const babysitterScope = useMemo(() => {
    const normalized = normalizeBabysitterScope(
      normalizedPrimaryCategorySlug === "babysitter" && selectedScopeSource ? selectedScopeSource : onboarding?.babysitterScope
    );
    if (normalized.services_offered.length > 0 || normalized.age_ranges.length > 0 || normalized.tasks_included.length > 0) {
      return normalized;
    }

    return {
      ...normalized,
      services_offered: Array.isArray(onboarding?.offeredServices)
        ? onboarding.offeredServices.filter((item): item is "cuidado_por_horas" => item === "cuidado_por_horas")
        : [],
      age_ranges: Array.isArray(onboarding?.experienceTypes)
        ? onboarding.experienceTypes.filter(
            (item): item is "0_2" | "3_6" | "7_plus" => item === "0_2" || item === "3_6" || item === "7_plus"
          )
        : [],
      first_aid: onboarding?.bringsOwnTools ?? null,
      multi_child: onboarding?.acceptsHomesWithChildren ?? null
    };
  }, [normalizedPrimaryCategorySlug, onboarding?.babysitterScope, onboarding?.offeredServices, onboarding?.experienceTypes, onboarding?.bringsOwnTools, onboarding?.acceptsHomesWithChildren, selectedScopeSource]);
  const chefScope = useMemo(() => {
    const normalized = normalizeChefScope(normalizedPrimaryCategorySlug === "chef" && selectedScopeSource ? selectedScopeSource : onboarding?.chefScope);
    if (normalized.services_offered.length > 0 || normalized.tasks_included.length > 0) {
      return normalized;
    }

    return {
      ...normalized,
      services_offered: Array.isArray(onboarding?.offeredServices)
        ? onboarding.offeredServices.filter(
            (item): item is "cocina-gourmet" | "cocina-casera" | "reposteria" | "cocina-eventos" | "cumpleanos" =>
              item === "cocina-gourmet" ||
              item === "cocina-casera" ||
              item === "reposteria" ||
              item === "cocina-eventos" ||
              item === "cumpleanos"
          )
        : []
    };
  }, [normalizedPrimaryCategorySlug, onboarding?.chefScope, onboarding?.offeredServices, selectedScopeSource]);
  const trainerScope = useMemo(() => {
    const normalized = normalizeTrainerScope(
      normalizedPrimaryCategorySlug === "personal-trainer" && selectedScopeSource ? selectedScopeSource : onboarding?.trainerScope
    );
    if (normalized.services_offered.length > 0 || normalized.modes.length > 0 || normalized.tasks_included.length > 0) {
      return normalized;
    }

    return {
      ...normalized,
      services_offered: Array.isArray(onboarding?.offeredServices)
        ? onboarding.offeredServices.filter(
            (item): item is "funcional" | "fuerza" | "perdida_peso" | "movilidad" =>
              item === "funcional" || item === "fuerza" || item === "perdida_peso" || item === "movilidad"
          )
        : [],
      modes: Array.isArray(onboarding?.experienceTypes)
        ? onboarding.experienceTypes.filter(
            (item): item is "presencial" | "online" | "ambas" => item === "presencial" || item === "online" || item === "ambas"
          )
        : [],
      brings_equipment: onboarding?.bringsOwnTools ?? null
    };
  }, [normalizedPrimaryCategorySlug, onboarding?.trainerScope, onboarding?.offeredServices, onboarding?.experienceTypes, onboarding?.bringsOwnTools, selectedScopeSource]);
  const teacherScope = useMemo(() => {
    const normalized = normalizeTeacherScope(
      normalizedPrimaryCategorySlug === "profesor-particular" && selectedScopeSource ? selectedScopeSource : onboarding?.teacherScope
    );
    if (normalized.services_offered.length > 0 || normalized.levels.length > 0 || normalized.modes.length > 0 || normalized.tasks_included.length > 0) {
      return normalized;
    }

    return {
      ...normalized,
      services_offered: Array.isArray(onboarding?.offeredServices)
        ? onboarding.offeredServices.filter(
            (item): item is "matematicas" | "ingles" | "lenguaje" | "ciencias" | "otra" =>
              item === "matematicas" || item === "ingles" || item === "lenguaje" || item === "ciencias" || item === "otra"
          )
        : [],
      levels: Array.isArray(onboarding?.experienceTypes)
        ? onboarding.experienceTypes.filter(
            (item): item is "basica" | "media" | "universitario" =>
              item === "basica" || item === "media" || item === "universitario"
          )
        : [],
      modes: Array.isArray(onboarding?.experienceTypes)
        ? onboarding.experienceTypes.filter(
            (item): item is "presencial" | "online" => item === "presencial" || item === "online"
          )
        : []
    };
  }, [normalizedPrimaryCategorySlug, onboarding?.teacherScope, onboarding?.offeredServices, onboarding?.experienceTypes, selectedScopeSource]);
  const relevantServiceCategories = useMemo(() => {
    if (!normalizedPrimaryCategorySlug) return serviceCategories;
    const filtered = serviceCategories.filter(
      (category) => normalizeCategorySlug(category.slug) === normalizedPrimaryCategorySlug
    );
    return filtered.length > 0 ? filtered : serviceCategories;
  }, [normalizedPrimaryCategorySlug, serviceCategories]);
  const servicePriceTags = useMemo(() => {
    return (data?.taskerServices ?? [])
      .filter((item) =>
        normalizedPrimaryCategorySlug
          ? normalizeCategorySlug(item.category?.slug) === normalizedPrimaryCategorySlug
          : true
      )
      .filter((item) => item.service?.name)
      .map((item) => ({
        key: `${item.service?.id ?? item.service?.name}`,
        label: `${item.service?.name} · ${item.priceClp ? clp(item.priceClp) : "Por definir"}/h`
      }));
  }, [data?.taskerServices, normalizedPrimaryCategorySlug]);
  const profilePhotoUrl = onboarding?.profilePhotoUrl?.trim() || data?.avatarUrl?.trim() || "";
  const activeCommunes = useMemo(() => {
    const raw =
      selectedCategoryProfile?.serviceCommunes && selectedCategoryProfile.serviceCommunes.length > 0
        ? selectedCategoryProfile.serviceCommunes
        : Array.isArray(onboarding?.serviceCommunes)
          ? onboarding.serviceCommunes
          : [];
    const cleaned = raw
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map(labelize);

    if (cleaned.length > 0) return cleaned;
    if (onboarding?.baseCommune) return [labelize(onboarding.baseCommune)];
    return requestedCommune ? [labelize(requestedCommune)] : [];
  }, [onboarding?.baseCommune, onboarding?.serviceCommunes, requestedCommune, selectedCategoryProfile?.serviceCommunes]);
  const summaryDescription =
    onboarding?.shortDescription?.trim() ||
    "Tasker con experiencia en servicios a domicilio, buena valoración y agenda activa durante la semana.";
  const experienceYears = onboarding?.yearsExperience ?? 6;
  const hasIdentityProof = Boolean(onboarding?.identityDocumentFrontFile && onboarding?.identityDocumentBackFile);
  const hasBackgroundCheck = Boolean(onboarding?.criminalRecordFile);
  const offeredServices = toLabelList(selectedCategoryProfile?.offeredServices ?? onboarding?.offeredServices, demoOfferedServices);
  const experienceTypes = toLabelList(selectedCategoryProfile?.experienceTypes ?? onboarding?.experienceTypes, demoExperienceTypes);
  const languages = toLabelList(onboarding?.languages, demoLanguages);
  const workModeLabel = onboarding?.workMode === "EQUIPO" ? "Trabajo en equipo" : "Trabajo individual";
  const categoryName = relevantServiceCategories[0]?.name ?? categoryLabel(primaryCategorySlug);
  const taskerRole = taskerRoleLabel(primaryCategorySlug);
  const faqItems = faqItemsForCategory(primaryCategorySlug);
  const cleaningScopeServices = cleaningScope.services_offered.map(getCleaningScopeServiceLabel);
  const cleaningScopeIncludedTasks = cleaningScope.tasks_included.map(getCleaningIncludedTaskLabel);
  const cleaningScopeExcludedTasks = cleaningScope.tasks_excluded.map(getCleaningExcludedTaskLabel);
  const petScopeServices = petScope.services_offered.map(getPetScopeServiceLabel);
  const petScopeAnimals = petScope.animals_accepted.map(getPetScopeAnimalLabel);
  const petScopeIncludedTasks = petScope.tasks_included.map(getPetIncludedTaskLabel);
  const petScopeExcludedTasks = petScope.tasks_excluded.map(getPetExcludedTaskLabel);
  const makeupScopeServices = makeupScope.services_offered.map(getMakeupServiceLabel);
  const makeupScopeIncludedTasks = makeupScope.tasks_included.map(getMakeupIncludedTaskLabel);
  const makeupScopeExcludedTasks = makeupScope.tasks_excluded.map(getMakeupExcludedTaskLabel);
  const ironingScopeServices = ironingScope.services_offered.map(getIroningServiceLabel);
  const ironingScopeIncludedTasks = ironingScope.tasks_included.map(getIroningIncludedTaskLabel);
  const ironingScopeExcludedTasks = ironingScope.tasks_excluded.map(getIroningExcludedTaskLabel);
  const babysitterScopeServices = babysitterScope.services_offered.map(getBabysitterServiceLabel);
  const babysitterScopeAges = babysitterScope.age_ranges.map(getBabysitterAgeRangeLabel);
  const babysitterScopeIncludedTasks = babysitterScope.tasks_included.map(getBabysitterIncludedTaskLabel);
  const babysitterScopeExcludedTasks = babysitterScope.tasks_excluded.map(getBabysitterExcludedTaskLabel);
  const chefScopeServices = chefScope.services_offered.map(getChefScopeServiceLabel);
  const chefScopeIncludedTasks = chefScope.tasks_included.map(getChefIncludedTaskLabel);
  const chefScopeExcludedTasks = chefScope.tasks_excluded.map(getChefExcludedTaskLabel);
  const trainerScopeServices = trainerScope.services_offered.map(getTrainerServiceLabel);
  const trainerScopeModes = trainerScope.modes.map(getTrainerModeLabel);
  const trainerScopeIncludedTasks = trainerScope.tasks_included.map(getTrainerIncludedTaskLabel);
  const trainerScopeExcludedTasks = trainerScope.tasks_excluded.map(getTrainerExcludedTaskLabel);
  const teacherScopeServices = teacherScope.services_offered.map(getTeacherServiceLabel);
  const teacherScopeLevels = teacherScope.levels.map(getTeacherLevelLabel);
  const teacherScopeModes = teacherScope.modes.map(getTeacherModeLabel);
  const teacherScopeIncludedTasks = teacherScope.tasks_included.map(getTeacherIncludedTaskLabel);
  const teacherScopeExcludedTasks = teacherScope.tasks_excluded.map(getTeacherExcludedTaskLabel);
  const defaultReserveServiceId =
    requestedServiceId ||
    (data?.taskerServices ?? []).find((item) =>
      normalizedPrimaryCategorySlug ? normalizeCategorySlug(item.category?.slug) === normalizedPrimaryCategorySlug : true
    )?.service?.id ||
    "";
  const buildReserveHref = (options?: { startsAt?: string; serviceId?: string | null }) => {
    const qs = new URLSearchParams();
    qs.set("proId", data?.userId ?? params.proId);
    const resolvedServiceId = options?.serviceId || defaultReserveServiceId;
    if (resolvedServiceId) qs.set("serviceId", resolvedServiceId);
    if (options?.startsAt) qs.set("startsAt", options.startsAt);
    if (requestedAddress) qs.set("address", requestedAddress);
    if (requestedApartment) qs.set("apartment", requestedApartment);
    if (requestedReference) qs.set("reference", requestedReference);
    if (requestedCommune) qs.set("commune", requestedCommune);
    if (requestedCity) qs.set("city", requestedCity);
    copyCleaningEstimateParams(searchParams, qs);
    return `/reservar?${qs.toString()}`;
  };
  const focusLabel = normalizedPrimaryCategorySlug === "mascotas" ? "Tipos de mascota" : "Especialidades";
  const serviceLabel = normalizedPrimaryCategorySlug === "limpieza" ? "Servicios de limpieza" : "Servicios que ofrece";
  const goalText =
    normalizedPrimaryCategorySlug === "mascotas"
      ? "Cuidar mascotas con confianza, constancia y buena comunicación con cada familia."
      : normalizedPrimaryCategorySlug === "chef"
        ? "Llenar agenda con servicios bien coordinados y experiencias de calidad en cada visita."
        : normalizedPrimaryCategorySlug === "maquillaje"
          ? "Construir una agenda estable con clientas recurrentes y servicios bien evaluados."
          : "Llenar agenda con clientes recurrentes y servicios de calidad.";

  return (
    <main className="auth-flow-screen auth-flow-screen-scroll market-shell-auth">
      <div className="auth-flow-backdrop" aria-hidden />

      <div className="login-screen-content market-shell-auth-content">
        <MarketNav />

        {data ? (
          <>
            <section className="auth-flow-shell auth-flow-shell-wide client-dashboard-hero public-tasker-hero">
              <div className="auth-flow-copy client-dashboard-copy public-tasker-hero-copy">
                <p className="auth-flow-kicker">Tasker verificado</p>
                <h1>{data.user.fullName}</h1>
                <p className="public-tasker-role-line">
                  {taskerRole} · {categoryName}
                </p>
                <p>{summaryDescription}</p>

                <div className="auth-flow-copy-list client-dashboard-summary">
                  <div className="auth-flow-meta-card">
                    <strong>Servicios que realiza</strong>
                    <span>{offeredServices.join(", ")}</span>
                  </div>
                  <div className="auth-flow-meta-card">
                    <strong>Experiencia</strong>
                    <span>{experienceYears} años de experiencia en servicios a domicilio.</span>
                  </div>
                  <div className="auth-flow-meta-card">
                    <strong>Disponibilidad</strong>
                    <span>{daysWithSlotsCount} día(s) con agenda visible para reserva.</span>
                  </div>
                  {requestedRecommendedHours ? (
                    <div className="auth-flow-meta-card">
                      <strong>Tiempo sugerido</strong>
                      <span>
                        {requestedEstimatedMinHours && requestedEstimatedMaxHours
                          ? `${requestedEstimatedMinHours} a ${requestedEstimatedMaxHours} horas · `
                          : ""}
                        Recomendado: {requestedRecommendedHours} h
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>

              <section className="auth-flow-panel auth-flow-panel-wide client-dashboard-profile-panel public-tasker-hero-card">
                <div className="we-sticky-head">
                  <div className="we-pro-avatar large" aria-hidden>
                    {profilePhotoUrl ? <img src={profilePhotoUrl} alt="" className="we-pro-avatar-image" /> : initials(data.user.fullName)}
                  </div>
                  <div>
                    <div className="public-tasker-category-inline">{categoryName}</div>
                    <h3>Agenda y tarifa</h3>
                    <p className="public-tasker-card-label">Reserva directamente con su disponibilidad visible.</p>
                    <p>{data.ratingsCount > 0 ? <><span className="we-star">★</span> {rating.toFixed(1)} ({data.ratingsCount} valoraciones)</> : "0.0 (0 valoraciones)"}</p>
                  </div>
                </div>

                <p className="we-sticky-price">{data.hourlyRateFromClp ? clp(data.hourlyRateFromClp) : "Por definir"}/h</p>
                <p className="we-sticky-meta">{data.coverageCity ?? "Santiago"} · {workModeLabel}</p>

                <div className="public-profile-switcher">
                  <button type="button" className={`public-profile-switch ${activeView === "perfil" ? "active" : ""}`} onClick={() => switchPublicView("perfil")}>
                    Perfil
                  </button>
                  <button type="button" className={`public-profile-switch ${activeView === "valoraciones" ? "active" : ""}`} onClick={() => switchPublicView("valoraciones")}>
                    Valoraciones
                  </button>
                  <button type="button" className={`public-profile-switch ${activeView === "agenda" ? "active" : ""}`} onClick={() => switchPublicView("agenda")}>
                    Agenda
                  </button>
                </div>

                <div className="cta-row">
                  <Link className="cta small" href={buildReserveHref()}>
                    Reservar ahora
                  </Link>
                </div>

                <p className="minimal-note">Para protegerte, usa siempre WeTask para contratar y comunicarte.</p>
              </section>
            </section>

            <div className="page client-dashboard-sections">
              {loading ? <p className="empty">Cargando perfil...</p> : null}
              {notice ? <p className="feedback ok">{notice}</p> : null}
              {error ? <p className="feedback error">{error}</p> : null}

              <section className="we-pro-detail-layout" id="public-tasker-view">
                <div className="we-pro-detail-main">
                  <div className="public-profile-switcher public-profile-switcher-wide">
                    <button type="button" className={`public-profile-switch ${activeView === "perfil" ? "active" : ""}`} onClick={() => switchPublicView("perfil")}>
                      Ver perfil
                    </button>
                    <button type="button" className={`public-profile-switch ${activeView === "valoraciones" ? "active" : ""}`} onClick={() => switchPublicView("valoraciones")}>
                      Ver valoraciones
                    </button>
                    <button type="button" className={`public-profile-switch ${activeView === "agenda" ? "active" : ""}`} onClick={() => switchPublicView("agenda")}>
                      Ver agenda
                    </button>
                  </div>

                  {activeView === "perfil" ? (
                    <>
                  <article className="auth-flow-panel client-dashboard-section tasker-profile-section">
                    <h2>Perfil del tasker</h2>
                    <p>Revisa su experiencia, forma de trabajo y datos importantes antes de reservar.</p>
                    <div className="we-trust-grid">
                      <div className={`we-trust-card ${hasIdentityProof ? "ok" : ""}`}>
                        <span className="we-trust-check" aria-hidden>{hasIdentityProof ? "✓" : "•"}</span>
                        <div>
                          <strong>Identidad confirmada</strong>
                          <p>{hasIdentityProof ? "Subió ambos lados de su carnet para validación." : "Aún no informa validación completa."}</p>
                        </div>
                      </div>
                      <div className={`we-trust-card ${hasBackgroundCheck ? "ok" : ""}`}>
                        <span className="we-trust-check" aria-hidden>{hasBackgroundCheck ? "✓" : "•"}</span>
                        <div>
                          <strong>Antecedentes revisados</strong>
                          <p>{hasBackgroundCheck ? "Tiene certificado de antecedentes cargado en su perfil." : "Aún no informa certificado de antecedentes."}</p>
                        </div>
                      </div>
                    </div>
                    <div className="we-info-grid we-profile-quick-grid tasker-profile-detail-grid tasker-profile-detail-grid-compact">
                      <div>
                        <h3>Experiencia</h3>
                        <p>{experienceYears} años</p>
                      </div>
                      <div>
                        <h3>Modalidad</h3>
                        <p>{workModeLabel}</p>
                      </div>
                      <div>
                        <h3>{focusLabel}</h3>
                        <p>{experienceTypes.join(", ")}</p>
                      </div>
                      <div>
                        <h3>Idiomas</h3>
                        <p>{languages.join(", ")}</p>
                      </div>
                    </div>
                    <div className="we-pro-tags tasker-profile-service-tags">
                      {(servicePriceTags.length > 0 ? servicePriceTags : offeredServices.map((service) => ({ key: service, label: service }))).map((service) => (
                        <span key={service.key} className="we-tag">
                          {service.label}
                        </span>
                      ))}
                    </div>
                  </article>

                  <article className="auth-flow-panel client-dashboard-section tasker-profile-section">
                    <h2>Sobre mi</h2>
                    <p className="tasker-profile-body-copy">{expandedAbout ? aboutText : aboutPreview}</p>
                    {aboutText.length > 340 ? (
                      <button type="button" className="we-text-link" onClick={() => setExpandedAbout((prev) => !prev)}>
                        {expandedAbout ? "Ver menos" : "Ver mas"}
                      </button>
                    ) : null}
                  </article>

                  <article className="auth-flow-panel client-dashboard-section tasker-profile-section">
                    <h2>Informacion de interes</h2>
                    <div className="we-info-grid tasker-profile-detail-grid">
                      <div>
                        <h3>¿Cuánta experiencia tiene?</h3>
                        <p>{experienceYears} años trabajando en servicios a domicilio.</p>
                      </div>
                      <div>
                        <h3>{serviceLabel}</h3>
                        <p>{offeredServices.join(", ")}</p>
                      </div>
                      <div>
                        <h3>{focusLabel}</h3>
                        <p>{experienceTypes.join(", ")}</p>
                      </div>
                      <div>
                        <h3>¿Qué busca en WeTask?</h3>
                        <p>{goalText}</p>
                      </div>
                    </div>
                  </article>

                  <article className="auth-flow-panel client-dashboard-section tasker-profile-section">
                    <h2>Cobertura</h2>
                    <p className="coverage-meta">Estas son las comunas activas que el tasker tiene configuradas hoy.</p>
                    {activeCommunes.length > 0 ? (
                      <div className="coverage-map-chip-list" aria-label="Comunas donde trabaja">
                        {activeCommunes.map((commune) => (
                          <span key={commune} className="coverage-map-chip">
                            {commune}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="coverage-meta">Aún no hay comunas informadas en este perfil.</p>
                    )}
                  </article>

                  {normalizedPrimaryCategorySlug === "limpieza" ? (
                    <article className="auth-flow-panel client-dashboard-section tasker-profile-section">
                      <h2>Alcance del servicio</h2>
                      <div className="we-info-grid tasker-profile-detail-grid">
                        <div>
                          <h3>Tipos de limpieza que acepta</h3>
                          <p>{cleaningScopeServices.length > 0 ? cleaningScopeServices.join(", ") : "Aún no informado."}</p>
                        </div>
                        <div>
                          <h3>Tareas que sí realiza</h3>
                          <p>{cleaningScopeIncludedTasks.length > 0 ? cleaningScopeIncludedTasks.join(", ") : "Aún no informado."}</p>
                        </div>
                        <div>
                          <h3>Tareas que no realiza</h3>
                          <p>{cleaningScopeExcludedTasks.length > 0 ? cleaningScopeExcludedTasks.join(", ") : "No reporta exclusiones."}</p>
                        </div>
                        <div>
                          <h3>Condiciones especiales</h3>
                          <p>{cleaningScope.special_conditions || "Sin condiciones especiales reportadas."}</p>
                        </div>
                      </div>
                      <p className="minimal-note">Si necesitas tareas fuera de este alcance base, revísalo antes de reservar para evitar malos entendidos.</p>
                    </article>
                  ) : null}

                  {normalizedPrimaryCategorySlug === "mascotas" ? (
                    <article className="auth-flow-panel client-dashboard-section tasker-profile-section">
                      <h2>Alcance del servicio</h2>
                      <div className="we-info-grid tasker-profile-detail-grid">
                        <div>
                          <h3>Servicios de mascotas que ofrece</h3>
                          <p>{petScopeServices.length > 0 ? petScopeServices.join(", ") : "Aún no informado."}</p>
                        </div>
                        <div>
                          <h3>Mascotas con las que trabaja</h3>
                          <p>{petScopeAnimals.length > 0 ? petScopeAnimals.join(", ") : "Aún no informado."}</p>
                        </div>
                        <div>
                          <h3>Tareas que sí realiza</h3>
                          <p>{petScopeIncludedTasks.length > 0 ? petScopeIncludedTasks.join(", ") : "Aún no informado."}</p>
                        </div>
                        <div>
                          <h3>Tareas que no realiza</h3>
                          <p>{petScopeExcludedTasks.length > 0 ? petScopeExcludedTasks.join(", ") : "No reporta exclusiones."}</p>
                        </div>
                        <div>
                          <h3>Mascotas grandes</h3>
                          <p>{petScope.accepts_large_pets == null ? "No informado." : petScope.accepts_large_pets ? "Sí acepta" : "No acepta"}</p>
                        </div>
                        <div>
                          <h3>Condiciones especiales</h3>
                          <p>{petScope.special_conditions || "Sin condiciones especiales reportadas."}</p>
                        </div>
                      </div>
                      <p className="minimal-note">Si necesitas algo fuera de este alcance base, revísalo antes de reservar para evitar malos entendidos.</p>
                    </article>
                  ) : null}

                  {normalizedPrimaryCategorySlug === "maquillaje" ? (
                    <article className="auth-flow-panel client-dashboard-section tasker-profile-section">
                      <h2>Alcance del servicio</h2>
                      <div className="we-info-grid tasker-profile-detail-grid">
                        <div>
                          <h3>Tipos de maquillaje</h3>
                          <p>{makeupScopeServices.length > 0 ? makeupScopeServices.join(", ") : "Aún no informado."}</p>
                        </div>
                        <div>
                          <h3>Tareas que sí realiza</h3>
                          <p>{makeupScopeIncludedTasks.length > 0 ? makeupScopeIncludedTasks.join(", ") : "Aún no informado."}</p>
                        </div>
                        <div>
                          <h3>Tareas que no realiza</h3>
                          <p>{makeupScopeExcludedTasks.length > 0 ? makeupScopeExcludedTasks.join(", ") : "No reporta exclusiones."}</p>
                        </div>
                        <div>
                          <h3>Incluye kit</h3>
                          <p>{makeupScope.includes_kit == null ? "No informado." : makeupScope.includes_kit ? "Sí" : "No"}</p>
                        </div>
                        <div>
                          <h3>Condiciones especiales</h3>
                          <p>{makeupScope.special_conditions || "Sin condiciones especiales reportadas."}</p>
                        </div>
                      </div>
                      <p className="minimal-note">Si necesitas algo fuera de este alcance base, revísalo antes de reservar para evitar malos entendidos.</p>
                    </article>
                  ) : null}

                  {normalizedPrimaryCategorySlug === "planchado" ? (
                    <article className="auth-flow-panel client-dashboard-section tasker-profile-section">
                      <h2>Alcance del servicio</h2>
                      <div className="we-info-grid tasker-profile-detail-grid">
                        <div>
                          <h3>Modalidades de planchado</h3>
                          <p>{ironingScopeServices.length > 0 ? ironingScopeServices.join(", ") : "Aún no informado."}</p>
                        </div>
                        <div>
                          <h3>Tareas que sí realiza</h3>
                          <p>{ironingScopeIncludedTasks.length > 0 ? ironingScopeIncludedTasks.join(", ") : "Aún no informado."}</p>
                        </div>
                        <div>
                          <h3>Tareas que no realiza</h3>
                          <p>{ironingScopeExcludedTasks.length > 0 ? ironingScopeExcludedTasks.join(", ") : "No reporta exclusiones."}</p>
                        </div>
                        <div>
                          <h3>Ropa delicada</h3>
                          <p>{ironingScope.delicate_clothes == null ? "No informado." : ironingScope.delicate_clothes ? "Sí" : "No"}</p>
                        </div>
                        <div>
                          <h3>Condiciones especiales</h3>
                          <p>{ironingScope.special_conditions || "Sin condiciones especiales reportadas."}</p>
                        </div>
                      </div>
                      <p className="minimal-note">Si necesitas algo fuera de este alcance base, revísalo antes de reservar para evitar malos entendidos.</p>
                    </article>
                  ) : null}

                  {normalizedPrimaryCategorySlug === "babysitter" ? (
                    <article className="auth-flow-panel client-dashboard-section tasker-profile-section">
                      <h2>Alcance del servicio</h2>
                      <div className="we-info-grid tasker-profile-detail-grid">
                        <div>
                          <h3>Servicios de babysitter que ofrece</h3>
                          <p>{babysitterScopeServices.length > 0 ? babysitterScopeServices.join(", ") : "Aún no informado."}</p>
                        </div>
                        <div>
                          <h3>Edades con las que trabaja</h3>
                          <p>{babysitterScopeAges.length > 0 ? babysitterScopeAges.join(", ") : "Aún no informado."}</p>
                        </div>
                        <div>
                          <h3>Tareas que sí realiza</h3>
                          <p>{babysitterScopeIncludedTasks.length > 0 ? babysitterScopeIncludedTasks.join(", ") : "Aún no informado."}</p>
                        </div>
                        <div>
                          <h3>Tareas que no realiza</h3>
                          <p>{babysitterScopeExcludedTasks.length > 0 ? babysitterScopeExcludedTasks.join(", ") : "No reporta exclusiones."}</p>
                        </div>
                        <div>
                          <h3>Primeros auxilios</h3>
                          <p>{babysitterScope.first_aid == null ? "No informado." : babysitterScope.first_aid ? "Sí" : "No"}</p>
                        </div>
                        <div>
                          <h3>Más de un niño</h3>
                          <p>{babysitterScope.multi_child == null ? "No informado." : babysitterScope.multi_child ? "Sí" : "No"}</p>
                        </div>
                        <div>
                          <h3>Condiciones especiales</h3>
                          <p>{babysitterScope.special_conditions || "Sin condiciones especiales reportadas."}</p>
                        </div>
                      </div>
                      <p className="minimal-note">Si necesitas apoyo fuera de este alcance base, revísalo antes de reservar para evitar malos entendidos.</p>
                    </article>
                  ) : null}

                  {normalizedPrimaryCategorySlug === "chef" ? (
                    <article className="auth-flow-panel client-dashboard-section tasker-profile-section">
                      <h2>Alcance del servicio</h2>
                      <div className="we-info-grid tasker-profile-detail-grid">
                        <div>
                          <h3>Servicios de chef que ofrece</h3>
                          <p>{chefScopeServices.length > 0 ? chefScopeServices.join(", ") : "Aún no informado."}</p>
                        </div>
                        <div>
                          <h3>Tareas que sí realiza</h3>
                          <p>{chefScopeIncludedTasks.length > 0 ? chefScopeIncludedTasks.join(", ") : "Aún no informado."}</p>
                        </div>
                        <div>
                          <h3>Tareas que no realiza</h3>
                          <p>{chefScopeExcludedTasks.length > 0 ? chefScopeExcludedTasks.join(", ") : "No reporta exclusiones."}</p>
                        </div>
                        <div>
                          <h3>Condiciones especiales</h3>
                          <p>{chefScope.special_conditions || "Sin condiciones especiales reportadas."}</p>
                        </div>
                      </div>
                      <p className="minimal-note">Si necesitas algo fuera de este alcance base, revísalo antes de reservar para evitar malos entendidos.</p>
                    </article>
                  ) : null}

                  {normalizedPrimaryCategorySlug === "personal-trainer" ? (
                    <article className="auth-flow-panel client-dashboard-section tasker-profile-section">
                      <h2>Alcance del servicio</h2>
                      <div className="we-info-grid tasker-profile-detail-grid">
                        <div>
                          <h3>Tipos de entrenamiento</h3>
                          <p>{trainerScopeServices.length > 0 ? trainerScopeServices.join(", ") : "Aún no informado."}</p>
                        </div>
                        <div>
                          <h3>Modalidades</h3>
                          <p>{trainerScopeModes.length > 0 ? trainerScopeModes.join(", ") : "Aún no informado."}</p>
                        </div>
                        <div>
                          <h3>Tareas que sí realiza</h3>
                          <p>{trainerScopeIncludedTasks.length > 0 ? trainerScopeIncludedTasks.join(", ") : "Aún no informado."}</p>
                        </div>
                        <div>
                          <h3>Tareas que no realiza</h3>
                          <p>{trainerScopeExcludedTasks.length > 0 ? trainerScopeExcludedTasks.join(", ") : "No reporta exclusiones."}</p>
                        </div>
                        <div>
                          <h3>Lleva equipamiento</h3>
                          <p>{trainerScope.brings_equipment == null ? "No informado." : trainerScope.brings_equipment ? "Sí" : "No"}</p>
                        </div>
                        <div>
                          <h3>Condiciones especiales</h3>
                          <p>{trainerScope.special_conditions || "Sin condiciones especiales reportadas."}</p>
                        </div>
                      </div>
                      <p className="minimal-note">Si necesitas algo fuera de este alcance base, revísalo antes de reservar para evitar malos entendidos.</p>
                    </article>
                  ) : null}

                  {normalizedPrimaryCategorySlug === "profesor-particular" ? (
                    <article className="auth-flow-panel client-dashboard-section tasker-profile-section">
                      <h2>Alcance del servicio</h2>
                      <div className="we-info-grid tasker-profile-detail-grid">
                        <div>
                          <h3>Asignaturas que ofrece</h3>
                          <p>{teacherScopeServices.length > 0 ? teacherScopeServices.join(", ") : "Aún no informado."}</p>
                        </div>
                        <div>
                          <h3>Niveles</h3>
                          <p>{teacherScopeLevels.length > 0 ? teacherScopeLevels.join(", ") : "Aún no informado."}</p>
                        </div>
                        <div>
                          <h3>Modalidades</h3>
                          <p>{teacherScopeModes.length > 0 ? teacherScopeModes.join(", ") : "Aún no informado."}</p>
                        </div>
                        <div>
                          <h3>Tareas que sí realiza</h3>
                          <p>{teacherScopeIncludedTasks.length > 0 ? teacherScopeIncludedTasks.join(", ") : "Aún no informado."}</p>
                        </div>
                        <div>
                          <h3>Tareas que no realiza</h3>
                          <p>{teacherScopeExcludedTasks.length > 0 ? teacherScopeExcludedTasks.join(", ") : "No reporta exclusiones."}</p>
                        </div>
                        <div>
                          <h3>Condiciones especiales</h3>
                          <p>{teacherScope.special_conditions || "Sin condiciones especiales reportadas."}</p>
                        </div>
                      </div>
                      <p className="minimal-note">Si necesitas algo fuera de este alcance base, revísalo antes de reservar para evitar malos entendidos.</p>
                    </article>
                  ) : null}

                  <article className="auth-flow-panel client-dashboard-section tasker-profile-section">
                    <h2>Garantía WeTask</h2>
                    <p>Hasta confirmar que el servicio fue correcto, el pago permanece protegido en plataforma.</p>
                    <ul className="we-check-list">
                      <li>Garantía de reembolso</li>
                      <li>Atencion 365 dias</li>
                      <li>Pago protegido</li>
                    </ul>
                  </article>

                  <article className="auth-flow-panel client-dashboard-section tasker-profile-section">
                    <h2>Preguntas frecuentes</h2>
                    <div className="we-faq-list">
                      {faqItems.map((item) => (
                        <details key={item.question}>
                          <summary>{item.question}</summary>
                          <p>{item.answer}</p>
                        </details>
                      ))}
                    </div>
                  </article>

                  <article className="auth-flow-panel client-dashboard-section tasker-profile-section">
                    <h2>Política de cancelación</h2>
                    <div className="we-cancel-table">
                      <div>
                        <strong>Antelacion</strong>
                        <span>Hasta 24h</span>
                        <span>24h a 4h</span>
                        <span>4h a 45min</span>
                        <span>45min a inicio</span>
                      </div>
                      <div>
                        <strong>% de reembolso</strong>
                        <span>Cancelacion gratuita</span>
                        <span>75% del importe</span>
                        <span>50% del importe</span>
                        <span>35% del importe</span>
                      </div>
                    </div>
                  </article>

                  <article className="auth-flow-panel client-dashboard-section">
                    <h2>¿Podemos ayudarte?</h2>
                    <p>Si tienes dudas del servicio, horario o materiales, escríbenos antes de reservar.</p>
                    <button type="button" className="cta small">
                      Enviar mensaje
                    </button>
                  </article>
                    </>
                  ) : null}

                  {activeView === "agenda" ? (
                    <article id="availability" className="auth-flow-panel client-dashboard-section">
                      <div className="we-section-head">
                        <div>
                          <h2>Agenda y disponibilidad</h2>
                          <p className="availability-inline-note">Elige un día y luego el horario que te acomode para reservar.</p>
                        </div>
                        <div className="availability-board-controls">
                          <span className="availability-board-chip">{availableSlotsCount} bloque(s) disponibles</span>
                        </div>
                      </div>

                      <div className="pro-availability-shell public-availability-shell">
                        <aside className="pro-availability-sidebar">
                          <div className="pro-availability-overview">
                            <article className="availability-stat-card tone-indigo">
                              <span>Hoy</span>
                              <strong>{todaySlots.length}</strong>
                              <p>bloque(s) abiertos hoy</p>
                            </article>
                            <article className="availability-stat-card tone-peach">
                              <span>Disponibles</span>
                              <strong>{availableSlotsCount}</strong>
                              <p>horarios visibles para reserva</p>
                            </article>
                            <article className="availability-stat-card tone-sky">
                              <span>Días activos</span>
                              <strong>{daysWithSlotsCount}</strong>
                              <p>días con agenda cargada</p>
                            </article>
                            <article className="availability-stat-card tone-mint">
                              <span>Próximo</span>
                              <strong>{nextAvailableSlot ? new Date(nextAvailableSlot.startsAt).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" }) : "--"}</strong>
                              <p>{nextAvailableSlot ? new Date(nextAvailableSlot.startsAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : "Sin bloques cercanos"}</p>
                            </article>
                          </div>
                        </aside>

                        <div className="availability-board-card">
                          <div className="availability-board-head">
                            <div>
                              <p className="availability-eyebrow">Calendario</p>
                              <h3>{selectedMonthLabel}</h3>
                            </div>
                            <div className="availability-month-nav">
                              <button type="button" className="availability-month-nav-btn" onClick={() => {
                                const next = shiftMonthKey(selectedDay, -1);
                                setDate(next);
                                setSelectedDay(next);
                              }}>
                                ‹
                              </button>
                              <button type="button" className="availability-month-nav-btn" onClick={() => {
                                const next = shiftMonthKey(selectedDay, 1);
                                setDate(next);
                                setSelectedDay(next);
                              }}>
                                ›
                              </button>
                            </div>
                          </div>

                          <div className="availability-weekdays">
                            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
                              <span key={day}>{day}</span>
                            ))}
                          </div>

                          <div className="availability-month-grid">
                            {monthCalendarDays.map((day) => {
                              const slotCount = slotsByDay.get(day.key)?.length ?? 0;
                              const isToday = day.key === todayKey;
                              const isSelected = day.key === selectedDay;

                              return (
                                <button
                                  key={day.key}
                                  type="button"
                                  className={[
                                    "availability-day-card",
                                    !day.isCurrentMonth ? "muted" : "",
                                    isToday ? "today" : "",
                                    isSelected ? "selected" : ""
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                  onClick={() => setSelectedDay(day.key)}
                                >
                                  <span className="availability-day-number">{day.date.getDate()}</span>
                                  <span className="availability-day-meta">
                                    {slotCount > 0 ? `${slotCount} horario(s)` : "Sin horarios"}
                                  </span>
                                  <span className="availability-day-dots" aria-hidden>
                                    {slotCount > 0 ? <span className="availability-dot free" /> : <span className="availability-dot" />}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="availability-task-panel">
                          <div className="availability-task-head">
                            <div>
                              <p className="availability-eyebrow">Día elegido</p>
                              <h4>{selectedDayLabel}</h4>
                            </div>
                            <span className="availability-selected-pill">{selectedSlots.length} bloque(s)</span>
                          </div>

                          {selectedSlots.length === 0 ? (
                            <div className="availability-empty-state">
                              <strong>No hay horarios abiertos ese día.</strong>
                              <p>Prueba con otro día del calendario para ver la disponibilidad de este tasker.</p>
                            </div>
                          ) : (
                            <div className="availability-task-list">
                              {selectedSlots.map((slot) => (
                                <article key={slot.id} className="availability-task-item open public-availability-task-item">
                                  <div className="availability-task-time">
                                    {new Date(slot.startsAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                                    <span />
                                    {new Date(slot.endsAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                                  </div>
                                  <div className="availability-task-copy">
                                    <strong>{slot.service?.name ?? categoryName}</strong>
                                    <p>Disponible para reservar en WeTask.</p>
                                  </div>
                                  <div className="availability-task-actions">
                                    <Link className="cta small" href={buildReserveHref({ startsAt: slot.startsAt, serviceId: slot.service?.id })}>
                                      Reservar este horario
                                    </Link>
                                  </div>
                                </article>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  ) : null}

                  {activeView === "valoraciones" ? (
                    <article id="reviews" className="auth-flow-panel client-dashboard-section">
                      <div className="we-section-head">
                        <h2>Valoraciones de clientes</h2>
                        <span className="availability-board-chip">{data.ratingsCount} opinión(es)</span>
                      </div>

                      <div className="public-rating-hero">
                        <div className="public-rating-hero-copy">
                          <span className="public-rating-stars public-rating-stars-large">{renderStars(rating)}</span>
                          <strong>{data.ratingsCount > 0 ? ratingLabel(rating) : "Sin valoraciones aún"}</strong>
                          <p>
                            {rating.toFixed(1)} de 5 basado en {data.ratingsCount} valoraciones verificadas dentro de WeTask.
                          </p>
                        </div>
                        <div className="public-rating-summary-grid">
                          {reviewSummaryCards.map((item) => (
                            <article key={item.label} className="public-rating-card">
                              <span>{item.label}</span>
                              <strong>{renderStars(item.score)}</strong>
                              <small>{item.score.toFixed(1)} de 5</small>
                            </article>
                          ))}
                        </div>
                      </div>

                      <div className="public-review-list">
                        {sampleComments.map((comment) => (
                          <article key={comment.name + comment.time} className="public-review-card">
                            <div className="public-review-head">
                              <div>
                                <strong>{comment.name}</strong>
                                <span>
                                  {comment.serviceLabel} · {comment.time}
                                </span>
                              </div>
                              <div className="public-review-score">
                                <span className="public-rating-stars">{renderStars(comment.overall)}</span>
                                <small>{comment.overall.toFixed(1)} / 5</small>
                              </div>
                            </div>

                            <div className="public-review-metrics">
                              <div>
                                <span>Puntualidad</span>
                                <strong>{renderStars(comment.punctuality)}</strong>
                              </div>
                              <div>
                                <span>Comunicación</span>
                                <strong>{renderStars(comment.communication)}</strong>
                              </div>
                              <div>
                                <span>Calidad</span>
                                <strong>{renderStars(comment.quality)}</strong>
                              </div>
                            </div>

                            <p>{comment.text}</p>
                            <em>{comment.wouldBookAgain ? "Lo volvería a contratar" : "No lo volvería a contratar"}</em>
                          </article>
                        ))}
                      </div>
                    </article>
                  ) : null}
                </div>
              </section>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
