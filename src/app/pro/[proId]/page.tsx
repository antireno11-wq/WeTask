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
  getChefScopeServiceLabel,
  normalizeChefScope
} from "@/lib/chef-scope";
import { copyCleaningEstimateParams, parseCleaningRecommendedHours } from "@/lib/cleaning-duration-estimator";
import { getChefServiceDefinition, isChefServiceSlug } from "@/lib/chef-service-types";
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

function renderScopeChecklist(title: string, items: string[], emptyText: string, variant: "included" | "excluded" = "included") {
  return (
    <div className="we-scope-card">
      <h3>{title}</h3>
      {items.length > 0 ? (
        <ul className={`we-check-list we-check-list-scope${variant === "excluded" ? " is-excluded" : ""}`}>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>{emptyText}</p>
      )}
    </div>
  );
}

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

function materialsSupportLabel(bringsOwnProducts: boolean | null, bringsOwnTools: boolean | null) {
  if (bringsOwnProducts && bringsOwnTools) return "Lleva productos e implementos";
  if (bringsOwnProducts) return "Lleva sus productos";
  if (bringsOwnTools) return "Lleva sus implementos";
  if (bringsOwnProducts === false || bringsOwnTools === false) return "Usa lo disponible en el domicilio";
  return "Por confirmar antes de la reserva";
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

function ratingTierLabel(value: number) {
  if (value >= 4.8) return "Sobresaliente";
  if (value >= 4.4) return "Muy bueno";
  if (value >= 4) return "Confiable";
  if (value >= 3.5) return "Bueno";
  return "En desarrollo";
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
            "Ofrece exactamente los servicios que aparecen publicados en esta ficha, como paseos, visitas o cuidado básico a domicilio."
        },
        {
          question: "¿Puede cuidar más de una mascota a la vez?",
          answer:
            "Sí, pero depende de la rutina, el tamaño y las necesidades de cada mascota. Si son varias, conviene avisarlo antes de reservar."
        },
        {
          question: "¿Qué pasa si mi mascota necesita cuidados especiales?",
          answer:
            "Debes informarlo antes de confirmar la reserva para que el tasker te diga si puede hacerse cargo de esos cuidados."
        },
        {
          question: "¿Puedo agendar paseos o cuidados recurrentes?",
          answer:
            "Sí. Puedes volver a reservar al mismo tasker según los bloques que tenga abiertos en agenda."
        },
        {
          question: "¿Cómo se confirma la disponibilidad?",
          answer:
            "Se confirma cuando eliges un bloque visible y completas la reserva dentro de WeTask."
        }
      ];
    case "chef":
      return [
        {
          question: "¿Qué tipo de servicios de chef ofrece?",
          answer:
            "Ofrece solo los servicios estandarizados que aparecen en su perfil, como cena privada, meal prep, asado o repostería."
        },
        {
          question: "¿Cocina en la casa del cliente?",
          answer:
            "Sí. En WeTask este servicio está pensado para realizarse en el domicilio del cliente, siguiendo las condiciones y requerimientos acordados en la reserva."
        },
        {
          question: "¿Puedo pedir un menú especial o restricciones alimentarias?",
          answer:
            "Sí. Puedes dejarlas en la reserva para que el chef confirme si puede adaptarse a ellas."
        },
        {
          question: "¿Quién pone los ingredientes?",
          answer:
            "Depende del servicio. En la ficha y en la coordinación previa se define si van incluidos o si se coordinan aparte."
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
            "Realiza solo los tipos de maquillaje que aparecen publicados en su perfil, como social, fiesta, novia o producción."
        },
        {
          question: "¿El kit de maquillaje está incluido?",
          answer:
            "Sí o no según lo que indique en su ficha. Si incluye kit, pestañas o prueba previa, eso aparece en el perfil."
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
            "Reservando un bloque disponible dentro de WeTask. Así el horario queda tomado y protegido."
        }
      ];
    case "planchado":
      return [
        {
          question: "¿Cómo cobra este servicio de planchado?",
          answer:
            "Se cobra por hora. En la ficha puedes ver la tarifa base y reservar según el tiempo que necesites."
        },
        {
          question: "¿Puede planchar ropa delicada?",
          answer:
            "Sí, pero solo si lo declara en su perfil. Si tienes prendas delicadas, conviene avisarlo antes."
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
            "Idealmente la ropa separada y cualquier instrucción especial sobre prendas delicadas o temperatura."
        }
      ];
    case "limpieza":
      return [
        {
          question: "¿Qué incluye la limpieza estándar?",
          answer: "Incluye solo las tareas que el tasker marcó como sí realiza en su perfil."
        },
        {
          question: "¿Puede hacer tareas fuera del alcance publicado?",
          answer: "No necesariamente. Si la tarea no aparece en su alcance del servicio, primero debes consultarla."
        },
        {
          question: "¿Cómo sé cuánto tiempo debería reservar?",
          answer: "WeTask te muestra un tiempo sugerido cuando corresponde, pero la duración final depende del tamaño del trabajo y del alcance acordado."
        },
        {
          question: "¿Cómo confirmo que atiende mi comuna?",
          answer: "La ficha muestra sus comunas activas, así que si aparece en resultados debería poder atender esa zona."
        }
      ];
    case "babysitter":
      return [
        {
          question: "¿Con qué edades trabaja?",
          answer: "Trabaja solo con las edades que aparecen en su perfil, por ejemplo lactantes, preescolar o escolar."
        },
        {
          question: "¿Puede cuidar a más de un niño?",
          answer: "Sí, si el tasker lo permite en su alcance del servicio. Si son varios niños, conviene avisarlo antes."
        },
        {
          question: "¿Hace tareas adicionales en la casa?",
          answer: "Solo las tareas que figuran como sí realiza en su perfil."
        },
        {
          question: "¿Tiene conocimientos de primeros auxilios?",
          answer: "Si los tiene, eso se muestra en su perfil dentro del alcance del servicio."
        },
        {
          question: "¿Cómo se confirma el horario?",
          answer: "Reservando un bloque disponible y completando el pago dentro de WeTask."
        }
      ];
    case "personal-trainer":
      return [
        {
          question: "¿Qué tipo de entrenamiento realiza?",
          answer: "Realiza solo los tipos de entrenamiento que aparecen publicados en su perfil."
        },
        {
          question: "¿Lleva implementos o equipamiento?",
          answer: "Si lleva implementos, eso aparece indicado en su alcance del servicio."
        },
        {
          question: "¿Las clases pueden ser online o presenciales?",
          answer: "Sí, según la modalidad que el tasker tenga activa en su perfil."
        },
        {
          question: "¿Puede adaptar la clase a mi nivel?",
          answer: "Sí, pero siempre dentro de los objetivos y modalidades que declara trabajar."
        },
        {
          question: "¿Cómo elijo un horario?",
          answer: "Desde la agenda visible del tasker, seleccionando un bloque libre."
        }
      ];
    case "profesor-particular":
      return [
        {
          question: "¿Qué asignaturas enseña?",
          answer: "Enseña únicamente las asignaturas y subcategorías que aparecen publicadas en su perfil."
        },
        {
          question: "¿Qué nivel puede enseñar?",
          answer: "Los niveles exactos se muestran en la ficha, por ejemplo básica, media, universitaria o principiante/intermedio/avanzado."
        },
        {
          question: "¿Hace clases online o presenciales?",
          answer: "Sí, según la modalidad que tenga activa en su perfil."
        },
        {
          question: "¿Qué necesita tener preparado el alumno?",
          answer: "Eso se define en su perfil o en la coordinación previa, por ejemplo cuaderno, instrumento o computador."
        },
        {
          question: "¿Puedo tomar clases frecuentes?",
          answer: "Sí. Puedes volver a reservar según la agenda que tenga disponible."
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

function isFutureSlot(slot: AvailabilitySlot) {
  return new Date(slot.endsAt).getTime() > Date.now();
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
        setSlots(resolvedSlots.filter(isFutureSlot));
      } catch {
        setData(buildDemoProfessional(params.proId));
        setSlots(buildDemoSlots(date, params.proId).filter(isFutureSlot));
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

  const visibleSlots = useMemo(() => slots.filter(isFutureSlot), [slots]);
  const dayGroups = useMemo(() => {
    const map = new Map<string, AvailabilitySlot[]>();
    for (const slot of visibleSlots) {
      const key = slot.startsAt.slice(0, 10);
      const prev = map.get(key) ?? [];
      prev.push(slot);
      map.set(key, prev);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [visibleSlots]);

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
  const todayDate = useMemo(() => new Date(`${todayKey}T12:00:00`), [todayKey]);
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
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const firstWeekday = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

    return Array.from({ length: totalCells }, (_, index) => {
      const dayNumber = index - firstWeekday + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) {
        return {
          key: `blank-${index}`,
          date: null,
          isCurrentMonth: false
        };
      }

      const current = new Date(year, month, dayNumber);
      const isPastDayInCurrentMonth =
        current.getFullYear() === todayDate.getFullYear() &&
        current.getMonth() === todayDate.getMonth() &&
        current.getDate() < todayDate.getDate();

      if (isPastDayInCurrentMonth) {
        return {
          key: `past-${formatDayKey(current)}`,
          date: null,
          isCurrentMonth: false
        };
      }

      return {
        key: formatDayKey(current),
        date: current,
        isCurrentMonth: true
      };
    });
  }, [selectedDate, todayDate]);
  const visibleMonthCalendarDays = useMemo(() => {
    const selectedIsCurrentMonth =
      selectedDate.getFullYear() === todayDate.getFullYear() && selectedDate.getMonth() === todayDate.getMonth();

    if (!selectedIsCurrentMonth) {
      return monthCalendarDays;
    }

    const firstVisibleDayIndex = monthCalendarDays.findIndex((day) => day.date && day.key === todayKey);
    if (firstVisibleDayIndex === -1) {
      return monthCalendarDays;
    }

    const firstVisibleWeekIndex = Math.floor(firstVisibleDayIndex / 7) * 7;
    return monthCalendarDays.slice(firstVisibleWeekIndex);
  }, [monthCalendarDays, selectedDate, todayDate, todayKey]);
  const canGoToPreviousMonth = useMemo(() => {
    const selectedMonthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const currentMonthStart = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
    return selectedMonthStart.getTime() > currentMonthStart.getTime();
  }, [selectedDate, todayDate]);
  const slotsByDay = useMemo(() => {
    const map = new Map<string, AvailabilitySlot[]>();
    for (const slot of slots) {
      const key = slot.startsAt.slice(0, 10);
      const prev = map.get(key) ?? [];
      map.set(key, [...prev, slot].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
    }
    return map;
  }, [slots]);
  const availableSlotsCount = visibleSlots.length;
  const daysWithSlotsCount = slotsByDay.size;
  const todaySlots = slotsByDay.get(todayKey) ?? [];
  const nextAvailableSlot = visibleSlots[0] ?? null;

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
  const reviewBreakdownItems = reviewSummaryCards.map((item, index) => ({
    ...item,
    percent: Math.round((item.score / 5) * 100),
    tier: ratingTierLabel(item.score),
    toneClass: `tone-${index + 1}`
  }));
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
  const cleaningScope = useMemo(() => normalizeCleaningScope(onboarding?.cleaningScope), [onboarding?.cleaningScope]);
  const petScope = useMemo(() => {
    const normalized = normalizePetScope(onboarding?.petScope);
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
  }, [onboarding?.petScope, onboarding?.offeredServices, onboarding?.experienceTypes, onboarding?.acceptsHomesWithPets]);
  const makeupScope = useMemo(() => {
    const normalized = normalizeMakeupScope(onboarding?.makeupScope);
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
  }, [onboarding?.makeupScope, onboarding?.offeredServices, onboarding?.bringsOwnProducts]);
  const ironingScope = useMemo(() => {
    const normalized = normalizeIroningScope(onboarding?.ironingScope);
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
  }, [onboarding?.ironingScope, onboarding?.offeredServices, onboarding?.bringsOwnTools]);
  const babysitterScope = useMemo(() => {
    const normalized = normalizeBabysitterScope(onboarding?.babysitterScope);
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
  }, [onboarding?.babysitterScope, onboarding?.offeredServices, onboarding?.experienceTypes, onboarding?.bringsOwnTools, onboarding?.acceptsHomesWithChildren]);
  const chefScope = useMemo(() => {
    const normalized = normalizeChefScope(onboarding?.chefScope);
    if (normalized.services_offered.length > 0) {
      return normalized;
    }

    return {
      ...normalized,
      services_offered: Array.isArray(onboarding?.offeredServices)
        ? onboarding.offeredServices.filter((item): item is string => typeof item === "string" && isChefServiceSlug(item))
        : []
    };
  }, [onboarding?.chefScope, onboarding?.offeredServices]);
  const trainerScope = useMemo(() => {
    const normalized = normalizeTrainerScope(onboarding?.trainerScope);
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
  }, [onboarding?.trainerScope, onboarding?.offeredServices, onboarding?.experienceTypes, onboarding?.bringsOwnTools]);
  const teacherScope = useMemo(() => {
    const normalized = normalizeTeacherScope(onboarding?.teacherScope);
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
  }, [onboarding?.teacherScope, onboarding?.offeredServices, onboarding?.experienceTypes]);
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
  const profilePhotoUrl = onboarding?.profilePhotoUrl?.trim() || data?.avatarUrl?.trim() || "";
  const activeCommunes = useMemo(() => {
    const raw = Array.isArray(onboarding?.serviceCommunes) ? onboarding.serviceCommunes : [];
    const cleaned = raw
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map(labelize);

    if (cleaned.length > 0) return cleaned;
    if (onboarding?.baseCommune) return [labelize(onboarding.baseCommune)];
    return requestedCommune ? [labelize(requestedCommune)] : [];
  }, [onboarding?.baseCommune, onboarding?.serviceCommunes, requestedCommune]);
  const summaryDescription =
    onboarding?.shortDescription?.trim() ||
    "Tasker con experiencia en servicios a domicilio, buena valoración y agenda activa durante la semana.";
  const experienceYears = onboarding?.yearsExperience ?? 6;
  const hasIdentityProof = Boolean(onboarding?.identityDocumentFrontFile && onboarding?.identityDocumentBackFile);
  const hasBackgroundCheck = Boolean(onboarding?.criminalRecordFile);
  const offeredServices = toLabelList(onboarding?.offeredServices, demoOfferedServices);
  const experienceTypes = toLabelList(onboarding?.experienceTypes, demoExperienceTypes);
  const languages = toLabelList(onboarding?.languages, demoLanguages);
  const materialsSupport = materialsSupportLabel(onboarding?.bringsOwnProducts ?? null, onboarding?.bringsOwnTools ?? null);
  const workModeLabel = onboarding?.workMode === "EQUIPO" ? "Trabajo en equipo" : "Trabajo individual";
  const primaryCategorySlug = serviceCategories[0]?.slug ?? onboarding?.categorySlug ?? null;
  const normalizedPrimaryCategorySlug = normalizeCategorySlug(primaryCategorySlug);
  const categoryName = serviceCategories[0]?.name ?? categoryLabel(primaryCategorySlug);
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
  const trainerScopeServices = trainerScope.services_offered.map(getTrainerServiceLabel);
  const trainerScopeModes = trainerScope.modes.map(getTrainerModeLabel);
  const trainerScopeIncludedTasks = trainerScope.tasks_included.map(getTrainerIncludedTaskLabel);
  const trainerScopeExcludedTasks = trainerScope.tasks_excluded.map(getTrainerExcludedTaskLabel);
  const teacherScopeServices = teacherScope.services_offered.map(getTeacherServiceLabel);
  const teacherScopeLevels = teacherScope.levels.map(getTeacherLevelLabel);
  const teacherScopeModes = teacherScope.modes.map(getTeacherModeLabel);
  const teacherScopeIncludedTasks = teacherScope.tasks_included.map(getTeacherIncludedTaskLabel);
  const teacherScopeExcludedTasks = teacherScope.tasks_excluded.map(getTeacherExcludedTaskLabel);
  const defaultReserveServiceId = requestedServiceId || data?.taskerServices?.[0]?.service?.id || "";
  const buildReserveHref = (options?: { slotId?: string; startsAt?: string; serviceId?: string | null }) => {
    const qs = new URLSearchParams();
    qs.set("proId", data?.userId ?? params.proId);
    const resolvedServiceId = options?.serviceId || defaultReserveServiceId;
    if (resolvedServiceId) qs.set("serviceId", resolvedServiceId);
    if (options?.slotId) qs.set("slotId", options.slotId);
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
  return (
    <main className="auth-flow-screen auth-flow-screen-scroll market-shell-auth">
      <div className="auth-flow-backdrop" aria-hidden />

      <div className="login-screen-content market-shell-auth-content">
        <MarketNav />

        {data ? (
          <>
            <section className="page public-tasker-hero-shell">
              <article className="auth-flow-panel client-dashboard-section public-tasker-hero-card">
                <div className="public-tasker-hero-top">
                  <span className="we-verified-badge public-tasker-verified-badge">Tasker verificado</span>
                  <div className="public-tasker-hero-primary">
                    <div className="public-tasker-hero-copy">
                      <div className="public-tasker-identity">
                        <div className="we-pro-avatar large public-tasker-avatar" aria-hidden>
                          {profilePhotoUrl ? <img src={profilePhotoUrl} alt="" className="we-pro-avatar-image" /> : initials(data.user.fullName)}
                        </div>

                        <div className="public-tasker-identity-copy">
                          <h1>{data.user.fullName}</h1>
                          <p className="public-tasker-role">{categoryName}</p>
                          <p className="we-pro-rating-line">
                            <span className="we-star">★</span> {rating.toFixed(1)} ({data.ratingsCount} valoraciones)
                          </p>
                        </div>
                      </div>

                      <div className="public-profile-switcher public-tasker-hero-switcher">
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

                      <p className="public-tasker-summary">{summaryDescription}</p>
                    </div>

                    <div className="public-tasker-price-box">
                      <span className="public-tasker-price-label">Tarifa desde</span>
                      <strong className="public-tasker-price-value">{data.hourlyRateFromClp ? clp(data.hourlyRateFromClp) : "Por definir"}/h</strong>
                      <p className="public-tasker-price-meta">{data.coverageCity ?? "Santiago"} · {workModeLabel}</p>
                      <div className="cta-row public-tasker-hero-actions">
                        <Link className="cta small" href={buildReserveHref()}>
                          Reservar ahora
                        </Link>
                      </div>
                    </div>
                  </div>

                  <div className="auth-flow-copy-list client-dashboard-summary public-tasker-summary-cards">
                    <div className="auth-flow-meta-card">
                      <strong>Servicios que realiza</strong>
                      <span>{offeredServices.join(", ")}</span>
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
              </article>
            </section>

            <div className="page client-dashboard-sections">
              {loading ? <p className="empty">Cargando perfil...</p> : null}
              {error ? <p className="feedback error">{error}</p> : null}

              <section className="we-pro-detail-layout" id="public-tasker-view">
                <div className="we-pro-detail-main">
	                  {activeView === "perfil" ? (
	                    <>
	                  <article className="auth-flow-panel client-dashboard-section">
	                    <h2>Seguridad</h2>
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
	                  </article>

	                  <article className="auth-flow-panel client-dashboard-section">
	                    <h2>Perfil del tasker</h2>
	                    <div className="we-info-grid we-profile-quick-grid">
                      <div>
                        <h3>Experiencia</h3>
                        <p>{experienceYears} años</p>
                      </div>
                      <div>
                        <h3>Modalidad</h3>
                        <p>{workModeLabel}</p>
                      </div>
                      <div>
                        <h3>Categoría</h3>
                        <p>{categoryName}</p>
                      </div>
                      <div>
                        <h3>{focusLabel}</h3>
                        <p>{experienceTypes.join(", ")}</p>
                      </div>
                      <div>
                        <h3>Idiomas</h3>
                        <p>{languages.join(", ")}</p>
                      </div>
                      <div>
                        <h3>Productos e implementos</h3>
                        <p>{materialsSupport}</p>
                      </div>
                    </div>
                  </article>

                  <section className="we-pro-duo-grid">
                    <article className="auth-flow-panel client-dashboard-section">
                      <h2>Sobre mi</h2>
                      <p>{expandedAbout ? aboutText : aboutPreview}</p>
                      {aboutText.length > 340 ? (
                        <button type="button" className="we-text-link" onClick={() => setExpandedAbout((prev) => !prev)}>
                          {expandedAbout ? "Ver menos" : "Ver mas"}
                        </button>
                      ) : null}
                    </article>

                    <article className="auth-flow-panel client-dashboard-section">
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
                  </section>

                  {normalizedPrimaryCategorySlug === "limpieza" ? (
                    <article className="auth-flow-panel client-dashboard-section">
                      <h2>Alcance del servicio</h2>
                      <div className="we-info-grid we-scope-grid">
                        <div className="we-scope-card">
                          <h3>Tipos de limpieza que acepta</h3>
                          <p>{cleaningScopeServices.length > 0 ? cleaningScopeServices.join(", ") : "Aún no informado."}</p>
                        </div>
                        {renderScopeChecklist("Tareas que sí realiza", cleaningScopeIncludedTasks, "Aún no informado.")}
                        {renderScopeChecklist("Tareas que no realiza", cleaningScopeExcludedTasks, "No reporta exclusiones.", "excluded")}
                        <div className="we-scope-card">
                          <h3>Condiciones especiales</h3>
                          <p>{cleaningScope.special_conditions || "Sin condiciones especiales reportadas."}</p>
                        </div>
                      </div>
                      <p className="minimal-note">Si necesitas tareas fuera de este alcance base, revísalo antes de reservar para evitar malos entendidos.</p>
                    </article>
                  ) : null}

                  {normalizedPrimaryCategorySlug === "mascotas" ? (
                    <article className="auth-flow-panel client-dashboard-section">
                      <h2>Alcance del servicio</h2>
                      <div className="we-info-grid we-scope-grid">
                        <div className="we-scope-card">
                          <h3>Servicios de mascotas que ofrece</h3>
                          <p>{petScopeServices.length > 0 ? petScopeServices.join(", ") : "Aún no informado."}</p>
                        </div>
                        <div className="we-scope-card">
                          <h3>Mascotas con las que trabaja</h3>
                          <p>{petScopeAnimals.length > 0 ? petScopeAnimals.join(", ") : "Aún no informado."}</p>
                        </div>
                        {renderScopeChecklist("Tareas que sí realiza", petScopeIncludedTasks, "Aún no informado.")}
                        {renderScopeChecklist("Tareas que no realiza", petScopeExcludedTasks, "No reporta exclusiones.", "excluded")}
                        <div className="we-scope-card">
                          <h3>Mascotas grandes</h3>
                          <p>{petScope.accepts_large_pets == null ? "No informado." : petScope.accepts_large_pets ? "Sí acepta" : "No acepta"}</p>
                        </div>
                        <div className="we-scope-card">
                          <h3>Condiciones especiales</h3>
                          <p>{petScope.special_conditions || "Sin condiciones especiales reportadas."}</p>
                        </div>
                      </div>
                      <p className="minimal-note">Si necesitas algo fuera de este alcance base, revísalo antes de reservar para evitar malos entendidos.</p>
                    </article>
                  ) : null}

                  {normalizedPrimaryCategorySlug === "maquillaje" ? (
                    <article className="auth-flow-panel client-dashboard-section">
                      <h2>Alcance del servicio</h2>
                      <div className="we-info-grid we-scope-grid">
                        <div className="we-scope-card">
                          <h3>Tipos de maquillaje</h3>
                          <p>{makeupScopeServices.length > 0 ? makeupScopeServices.join(", ") : "Aún no informado."}</p>
                        </div>
                        {renderScopeChecklist("Tareas que sí realiza", makeupScopeIncludedTasks, "Aún no informado.")}
                        {renderScopeChecklist("Tareas que no realiza", makeupScopeExcludedTasks, "No reporta exclusiones.", "excluded")}
                        <div className="we-scope-card">
                          <h3>Incluye kit</h3>
                          <p>{makeupScope.includes_kit == null ? "No informado." : makeupScope.includes_kit ? "Sí" : "No"}</p>
                        </div>
                        <div className="we-scope-card">
                          <h3>Condiciones especiales</h3>
                          <p>{makeupScope.special_conditions || "Sin condiciones especiales reportadas."}</p>
                        </div>
                      </div>
                      <p className="minimal-note">Si necesitas algo fuera de este alcance base, revísalo antes de reservar para evitar malos entendidos.</p>
                    </article>
                  ) : null}

                  {normalizedPrimaryCategorySlug === "planchado" ? (
                    <article className="auth-flow-panel client-dashboard-section">
                      <h2>Alcance del servicio</h2>
                      <div className="we-info-grid we-scope-grid">
                        <div className="we-scope-card">
                          <h3>Modalidades de planchado</h3>
                          <p>{ironingScopeServices.length > 0 ? ironingScopeServices.join(", ") : "Aún no informado."}</p>
                        </div>
                        {renderScopeChecklist("Tareas que sí realiza", ironingScopeIncludedTasks, "Aún no informado.")}
                        {renderScopeChecklist("Tareas que no realiza", ironingScopeExcludedTasks, "No reporta exclusiones.", "excluded")}
                        <div className="we-scope-card">
                          <h3>Ropa delicada</h3>
                          <p>{ironingScope.delicate_clothes == null ? "No informado." : ironingScope.delicate_clothes ? "Sí" : "No"}</p>
                        </div>
                        <div className="we-scope-card">
                          <h3>Condiciones especiales</h3>
                          <p>{ironingScope.special_conditions || "Sin condiciones especiales reportadas."}</p>
                        </div>
                      </div>
                      <p className="minimal-note">Si necesitas algo fuera de este alcance base, revísalo antes de reservar para evitar malos entendidos.</p>
                    </article>
                  ) : null}

                  {normalizedPrimaryCategorySlug === "babysitter" ? (
                    <article className="auth-flow-panel client-dashboard-section">
                      <h2>Alcance del servicio</h2>
                      <div className="we-info-grid we-scope-grid">
                        <div className="we-scope-card">
                          <h3>Servicios de babysitter que ofrece</h3>
                          <p>{babysitterScopeServices.length > 0 ? babysitterScopeServices.join(", ") : "Aún no informado."}</p>
                        </div>
                        <div className="we-scope-card">
                          <h3>Edades con las que trabaja</h3>
                          <p>{babysitterScopeAges.length > 0 ? babysitterScopeAges.join(", ") : "Aún no informado."}</p>
                        </div>
                        {renderScopeChecklist("Tareas que sí realiza", babysitterScopeIncludedTasks, "Aún no informado.")}
                        {renderScopeChecklist("Tareas que no realiza", babysitterScopeExcludedTasks, "No reporta exclusiones.", "excluded")}
                        <div className="we-scope-card">
                          <h3>Primeros auxilios</h3>
                          <p>{babysitterScope.first_aid == null ? "No informado." : babysitterScope.first_aid ? "Sí" : "No"}</p>
                        </div>
                        <div className="we-scope-card">
                          <h3>Más de un niño</h3>
                          <p>{babysitterScope.multi_child == null ? "No informado." : babysitterScope.multi_child ? "Sí" : "No"}</p>
                        </div>
                        <div className="we-scope-card">
                          <h3>Condiciones especiales</h3>
                          <p>{babysitterScope.special_conditions || "Sin condiciones especiales reportadas."}</p>
                        </div>
                      </div>
                      <p className="minimal-note">Si necesitas apoyo fuera de este alcance base, revísalo antes de reservar para evitar malos entendidos.</p>
                    </article>
                  ) : null}

                  {normalizedPrimaryCategorySlug === "chef" ? (
                    <article className="auth-flow-panel client-dashboard-section">
                      <h2>Alcance del servicio</h2>
                      <div className="we-info-grid we-scope-grid">
                        <div className="we-scope-card">
                          <h3>Servicios de chef que ofrece</h3>
                          <p>{chefScopeServices.length > 0 ? chefScopeServices.join(", ") : "Aún no informado."}</p>
                        </div>
                        <div className="we-scope-card">
                          <h3>Modelo del servicio</h3>
                          <p>Servicios estandarizados por WeTask con duración estimada, qué incluye y precio claro por servicio.</p>
                        </div>
                        <div className="we-scope-card">
                          <h3>Condiciones especiales</h3>
                          <p>{chefScope.special_conditions || "Sin condiciones especiales reportadas."}</p>
                        </div>
                      </div>
                      <div className="we-info-grid" style={{ marginTop: 16 }}>
                        {chefScope.services_offered.map((serviceSlug) => {
                          const service = getChefServiceDefinition(serviceSlug);
                          if (!service) return null;
                          return (
                            <div key={service.slug} className="we-scope-card">
                              <h3>{service.name}</h3>
                              <p>Duración estimada: {service.estimatedDurationLabel}</p>
                              <p>Incluye: {service.includes.join(", ")}.</p>
                              <p>
                                Rango WeTask: ${service.recommendedMinClp.toLocaleString("es-CL")} - ${service.recommendedMaxClp.toLocaleString("es-CL")}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                      <p className="minimal-note">Si necesitas algo fuera de este alcance base, revísalo antes de reservar para evitar malos entendidos.</p>
                    </article>
                  ) : null}

                  {normalizedPrimaryCategorySlug === "personal-trainer" ? (
                    <article className="auth-flow-panel client-dashboard-section">
                      <h2>Alcance del servicio</h2>
                      <div className="we-info-grid we-scope-grid">
                        <div className="we-scope-card">
                          <h3>Tipos de entrenamiento</h3>
                          <p>{trainerScopeServices.length > 0 ? trainerScopeServices.join(", ") : "Aún no informado."}</p>
                        </div>
                        <div className="we-scope-card">
                          <h3>Modalidades</h3>
                          <p>{trainerScopeModes.length > 0 ? trainerScopeModes.join(", ") : "Aún no informado."}</p>
                        </div>
                        {renderScopeChecklist("Tareas que sí realiza", trainerScopeIncludedTasks, "Aún no informado.")}
                        {renderScopeChecklist("Tareas que no realiza", trainerScopeExcludedTasks, "No reporta exclusiones.", "excluded")}
                        <div className="we-scope-card">
                          <h3>Lleva equipamiento</h3>
                          <p>{trainerScope.brings_equipment == null ? "No informado." : trainerScope.brings_equipment ? "Sí" : "No"}</p>
                        </div>
                        <div className="we-scope-card">
                          <h3>Condiciones especiales</h3>
                          <p>{trainerScope.special_conditions || "Sin condiciones especiales reportadas."}</p>
                        </div>
                      </div>
                      <p className="minimal-note">Si necesitas algo fuera de este alcance base, revísalo antes de reservar para evitar malos entendidos.</p>
                    </article>
                  ) : null}

                  {normalizedPrimaryCategorySlug === "profesor-particular" ? (
                    <article className="auth-flow-panel client-dashboard-section">
                      <h2>Alcance del servicio</h2>
                      <div className="we-info-grid we-scope-grid">
                        <div className="we-scope-card">
                          <h3>Asignaturas que ofrece</h3>
                          <p>{teacherScopeServices.length > 0 ? teacherScopeServices.join(", ") : "Aún no informado."}</p>
                        </div>
                        <div className="we-scope-card">
                          <h3>Niveles</h3>
                          <p>{teacherScopeLevels.length > 0 ? teacherScopeLevels.join(", ") : "Aún no informado."}</p>
                        </div>
                        <div className="we-scope-card">
                          <h3>Modalidades</h3>
                          <p>{teacherScopeModes.length > 0 ? teacherScopeModes.join(", ") : "Aún no informado."}</p>
                        </div>
                        {renderScopeChecklist("Tareas que sí realiza", teacherScopeIncludedTasks, "Aún no informado.")}
                        {renderScopeChecklist("Tareas que no realiza", teacherScopeExcludedTasks, "No reporta exclusiones.", "excluded")}
                        <div className="we-scope-card">
                          <h3>Condiciones especiales</h3>
                          <p>{teacherScope.special_conditions || "Sin condiciones especiales reportadas."}</p>
                        </div>
                      </div>
                      <p className="minimal-note">Si necesitas algo fuera de este alcance base, revísalo antes de reservar para evitar malos entendidos.</p>
                    </article>
                  ) : null}

                  <article className="auth-flow-panel client-dashboard-section">
                    <h2>Garantía WeTask</h2>
                    <p>El pago se mantiene protegido dentro de WeTask hasta que recibas el servicio o podamos revisar cualquier inconveniente reportado.</p>
                    <div className="we-guarantee-grid">
                      <article className="we-guarantee-card">
                        <span className="we-guarantee-lock" aria-hidden>
                          <svg viewBox="0 0 24 24" focusable="false">
                            <path d="M8 10V8a4 4 0 1 1 8 0v2h1a2 2 0 0 1 2 2v6a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-6a2 2 0 0 1 2-2h1zm2 0h4V8a2 2 0 1 0-4 0v2zm2 4a1.5 1.5 0 0 0-.75 2.8V18a.75.75 0 0 0 1.5 0v-1.2A1.5 1.5 0 0 0 12 14z" />
                          </svg>
                        </span>
                        <strong>Pago seguro</strong>
                        <span>Tu dinero queda protegido hasta recibir el servicio.</span>
                      </article>
                      <article className="we-guarantee-card">
                        <span className="we-guarantee-lock" aria-hidden>
                          <svg viewBox="0 0 24 24" focusable="false">
                            <path d="M8 10V8a4 4 0 1 1 8 0v2h1a2 2 0 0 1 2 2v6a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-6a2 2 0 0 1 2-2h1zm2 0h4V8a2 2 0 1 0-4 0v2zm2 4a1.5 1.5 0 0 0-.75 2.8V18a.75.75 0 0 0 1.5 0v-1.2A1.5 1.5 0 0 0 12 14z" />
                          </svg>
                        </span>
                        <strong>Garantía de reembolso</strong>
                        <span>Si algo sale mal, revisamos el caso y gestionamos la devolución cuando corresponda.</span>
                      </article>
                      <article className="we-guarantee-card">
                        <span className="we-guarantee-lock" aria-hidden>
                          <svg viewBox="0 0 24 24" focusable="false">
                            <path d="M8 10V8a4 4 0 1 1 8 0v2h1a2 2 0 0 1 2 2v6a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-6a2 2 0 0 1 2-2h1zm2 0h4V8a2 2 0 1 0-4 0v2zm2 4a1.5 1.5 0 0 0-.75 2.8V18a.75.75 0 0 0 1.5 0v-1.2A1.5 1.5 0 0 0 12 14z" />
                          </svg>
                        </span>
                        <strong>Atención 365 días</strong>
                        <span>Siempre puedes contactarnos si necesitas ayuda antes, durante o después del servicio.</span>
                      </article>
                    </div>
                  </article>

                  <article className="auth-flow-panel client-dashboard-section we-faq-section">
                    <div className="we-faq-heading">
                      <p className="we-faq-kicker">Respuestas WeTask</p>
                      <h2>Preguntas frecuentes</h2>
                      <p>Estas son las dudas más comunes antes de reservar este servicio dentro de WeTask.</p>
                    </div>
                    <div className="we-faq-list">
                      {faqItems.map((item) => (
                        <details key={item.question} className="we-faq-item">
                          <summary>
                            <span>{item.question}</span>
                          </summary>
                          <p>{item.answer}</p>
                        </details>
                      ))}
                    </div>
                  </article>

                  <article className="auth-flow-panel client-dashboard-section">
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
                    <Link href="/ayuda-soporte#support-contact" className="cta small">
                      Enviar mensaje
                    </Link>
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
                              <button
                                type="button"
                                className="availability-month-nav-btn"
                                disabled={!canGoToPreviousMonth}
                                onClick={() => {
                                  if (!canGoToPreviousMonth) return;
                                  const next = shiftMonthKey(selectedDay, -1);
                                  setDate(next);
                                  setSelectedDay(next);
                                }}
                              >
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
                            {visibleMonthCalendarDays.map((day) => {
                              if (!day.date) {
                                return <div key={day.key} className="availability-day-spacer" aria-hidden />;
                              }
                              const slotCount = slotsByDay.get(day.key)?.length ?? 0;
                              const isToday = day.key === todayKey;
                              const isSelected = day.key === selectedDay;

                              return (
                                <button
                                  key={day.key}
                                  type="button"
                                  className={[
                                    "availability-day-card",
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

                      </div>

                      <div className="availability-task-panel public-availability-day-panel">
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
                                  </div>
                                  <div className="availability-task-actions">
                                    <Link className="cta small" href={buildReserveHref({ slotId: slot.id, startsAt: slot.startsAt, serviceId: slot.service?.id })}>
                                      Reservar este horario
                                    </Link>
                                  </div>
                                </article>
                              ))}
                            </div>
                          )}
                      </div>
                    </article>
                  ) : null}

                  {activeView === "valoraciones" ? (
                    <article id="reviews" className="auth-flow-panel client-dashboard-section we-reviews-section">
                      <div className="we-reviews-header">
                        <p className="we-faq-kicker">Clientes WeTask</p>
                        <h2>Valoraciones y comentarios</h2>
                      </div>

                      <div className="we-reviews-grid">
                        <div className="we-reviews-main">
                          <div className="we-reviews-score-card">
                            <div className="we-reviews-score-value">{rating.toFixed(1)}</div>
                            <span className="public-rating-stars public-rating-stars-large">{renderStars(rating)}</span>
                            <p>
                              {data.ratingsCount} valoración(es) verificadas en WeTask
                            </p>
                          </div>

                          <div className="we-reviews-comments">
                            <h3>Comentarios destacados</h3>
                            {sampleComments.map((comment) => (
                              <article key={comment.name + comment.time} className="public-review-card public-review-card-fancy">
                                <div className="public-review-head public-review-head-fancy">
                                  <div className="public-review-person">
                                    <span className="public-review-avatar">{initials(comment.name)}</span>
                                    <div>
                                      <strong>{comment.name}</strong>
                                      <span>
                                        {comment.serviceLabel} · {comment.time}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="public-review-score">
                                    <span className="public-rating-stars">{renderStars(comment.overall)}</span>
                                    <small>{comment.overall.toFixed(1)} / 5</small>
                                  </div>
                                </div>

                                <p>{comment.text}</p>
                                <em>{comment.wouldBookAgain ? "Lo volvería a contratar" : "No lo volvería a contratar"}</em>
                              </article>
                            ))}
                          </div>
                        </div>

                        <aside className="we-reviews-breakdown">
                          <h3>Elementos mejor evaluados</h3>
                          <div className="we-reviews-breakdown-list">
                            {reviewBreakdownItems.map((item) => (
                              <article key={item.label} className={`we-reviews-breakdown-card ${item.toneClass}`}>
                                <div className="we-reviews-breakdown-head">
                                  <strong>{item.label}</strong>
                                  <span>{item.percent}%</span>
                                </div>
                                <div className="we-reviews-progress-rail" aria-hidden>
                                  <span className="we-reviews-progress-fill" style={{ width: `${item.percent}%` }} />
                                </div>
                                <div className="we-reviews-breakdown-foot">
                                  <small>{renderStars(item.score)}</small>
                                  <small>{item.tier}</small>
                                </div>
                              </article>
                            ))}
                          </div>
                        </aside>
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
