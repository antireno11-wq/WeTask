export const MAKEUP_DURATION_OPTIONS = [
  { minutes: 45, label: "45 min" },
  { minutes: 60, label: "1 hora" },
  { minutes: 90, label: "1.5 horas" },
  { minutes: 120, label: "2 horas" },
  { minutes: 150, label: "2.5 horas" },
  { minutes: 180, label: "3 horas" }
] as const;

export const MAKEUP_SERVICE_DEFINITIONS = [
  {
    slug: "maquillaje-natural",
    scopeValue: "natural",
    name: "Maquillaje natural",
    shortLabel: "Natural",
    forClients: "Ideal para un look fresco, equilibrado y discreto.",
    idealFor: "Reuniones, día a día, comidas o eventos tranquilos.",
    recommendedMinClp: 25000,
    recommendedMaxClp: 32000,
    durationLabel: "45 min a 1 hora",
    defaultDurationMin: 60
  },
  {
    slug: "maquillaje-social-evento",
    scopeValue: "social_evento",
    name: "Maquillaje social / evento",
    shortLabel: "Social / evento",
    forClients: "Pensado para celebraciones, cenas y eventos especiales.",
    idealFor: "Cumpleaños, graduaciones, cenas y compromisos sociales.",
    recommendedMinClp: 35000,
    recommendedMaxClp: 45000,
    durationLabel: "1.5 a 2 horas",
    defaultDurationMin: 90
  },
  {
    slug: "maquillaje-noche",
    scopeValue: "noche",
    name: "Maquillaje de noche",
    shortLabel: "Noche",
    forClients: "Look más intenso, definido y pensado para iluminación nocturna.",
    idealFor: "Fiestas, cenas especiales y eventos de noche.",
    recommendedMinClp: 36000,
    recommendedMaxClp: 47000,
    durationLabel: "1.5 a 2 horas",
    defaultDurationMin: 90
  },
  {
    slug: "maquillaje-fiesta",
    scopeValue: "fiesta",
    name: "Maquillaje para fiesta",
    shortLabel: "Fiesta",
    forClients: "Un resultado más glam, con mayor fijación y detalles.",
    idealFor: "Fiestas, celebraciones y ocasiones especiales.",
    recommendedMinClp: 38000,
    recommendedMaxClp: 50000,
    durationLabel: "1.5 a 2 horas",
    defaultDurationMin: 90
  },
  {
    slug: "maquillaje-novia",
    scopeValue: "novia",
    name: "Maquillaje para matrimonio / novia",
    shortLabel: "Novia",
    forClients: "Servicio premium, más detallado y pensado para larga duración.",
    idealFor: "Novias, civil, matrimonio y eventos de alta importancia.",
    recommendedMinClp: 55000,
    recommendedMaxClp: 90000,
    durationLabel: "2 a 3 horas",
    defaultDurationMin: 120
  },
  {
    slug: "maquillaje-produccion",
    scopeValue: "produccion_fotos",
    name: "Maquillaje para fotos / producción",
    shortLabel: "Producción / fotos",
    forClients: "Look pensado para cámara, iluminación y duración durante sesiones.",
    idealFor: "Fotos, campañas, contenido y producciones pequeñas.",
    recommendedMinClp: 45000,
    recommendedMaxClp: 70000,
    durationLabel: "1.5 a 3 horas",
    defaultDurationMin: 120
  },
  {
    slug: "maquillaje-otro",
    scopeValue: "otro",
    name: "Otro",
    shortLabel: "Otro",
    forClients: "Si tu servicio no calza perfecto en las opciones anteriores.",
    idealFor: "Casos especiales o estilos más personalizados.",
    recommendedMinClp: 30000,
    recommendedMaxClp: 50000,
    durationLabel: "1 a 2 horas",
    defaultDurationMin: 90
  }
] as const;

export type MakeupDurationMinutes = (typeof MAKEUP_DURATION_OPTIONS)[number]["minutes"];
export type MakeupServiceSlug = (typeof MAKEUP_SERVICE_DEFINITIONS)[number]["slug"];
export type MakeupScopeServiceSlug = (typeof MAKEUP_SERVICE_DEFINITIONS)[number]["scopeValue"];

const serviceDefinitionMap = new Map(MAKEUP_SERVICE_DEFINITIONS.map((service) => [service.slug, service]));
const scopeValueMap = new Map(MAKEUP_SERVICE_DEFINITIONS.map((service) => [service.scopeValue, service]));
const durationOptionMap = new Map(MAKEUP_DURATION_OPTIONS.map((option) => [option.minutes, option]));

export function isMakeupServiceSlug(value: string): value is MakeupServiceSlug {
  return serviceDefinitionMap.has(value as MakeupServiceSlug);
}

export function isMakeupScopeServiceSlug(value: string): value is MakeupScopeServiceSlug {
  return scopeValueMap.has(value as MakeupScopeServiceSlug);
}

export function isMakeupDurationMinutes(value: number): value is MakeupDurationMinutes {
  return durationOptionMap.has(value as MakeupDurationMinutes);
}

export function getMakeupServiceDefinitionBySlug(value: string | null | undefined) {
  if (!value) return null;
  return serviceDefinitionMap.get(value as MakeupServiceSlug) ?? null;
}

export function getMakeupServiceDefinitionByScopeValue(value: string | null | undefined) {
  if (!value) return null;
  return scopeValueMap.get(value as MakeupScopeServiceSlug) ?? null;
}

export function getMakeupServiceSlugFromScopeValue(value: string | null | undefined) {
  return getMakeupServiceDefinitionByScopeValue(value)?.slug ?? null;
}

export function getMakeupDurationLabel(minutes: number | null | undefined) {
  if (typeof minutes !== "number") return "Duración por confirmar";
  return durationOptionMap.get(minutes as MakeupDurationMinutes)?.label ?? `${minutes} min`;
}

export function durationMinutesToRoundedHours(minutes: number | null | undefined) {
  if (!minutes || minutes <= 0) return 1;
  return Math.max(1, Math.ceil(minutes / 60));
}
