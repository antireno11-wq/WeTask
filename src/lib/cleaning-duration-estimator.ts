import { type CleaningServiceSlug, getCleaningServiceDefinition, isCleaningServiceSlug } from "@/lib/cleaning-service-types";

export type CleaningSizeBand = "studio" | "small" | "medium" | "large" | "xlarge";
export type CleaningDirtLevel = "low" | "normal" | "high";
export type CleaningOccupancy = "furnished" | "vacant";
export type CleaningExtraTask = "oven" | "fridge" | "windows" | "balcony" | "pet-hair";

export type CleaningDurationInput = {
  serviceSlug: CleaningServiceSlug;
  bedrooms: number;
  bathrooms: number;
  sizeBand: CleaningSizeBand;
  dirtLevel: CleaningDirtLevel;
  occupancy: CleaningOccupancy;
  hasKitchen: boolean;
  hasLivingDining: boolean;
  extras: CleaningExtraTask[];
};

export type CleaningDurationEstimate = {
  minHours: number;
  maxHours: number;
  recommendedHours: number;
  summary: string;
};

export const CLEANING_SIZE_OPTIONS: Array<{ value: CleaningSizeBand; label: string; helper: string }> = [
  { value: "studio", label: "Estudio / 1 ambiente", helper: "Hasta 35 m2" },
  { value: "small", label: "Pequeño", helper: "36 a 55 m2" },
  { value: "medium", label: "Mediano", helper: "56 a 85 m2" },
  { value: "large", label: "Grande", helper: "86 a 120 m2" },
  { value: "xlarge", label: "Muy grande", helper: "Más de 120 m2" }
];

export const CLEANING_DIRT_LEVEL_OPTIONS: Array<{ value: CleaningDirtLevel; label: string }> = [
  { value: "low", label: "Baja" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "Alta" }
];

export const CLEANING_OCCUPANCY_OPTIONS: Array<{ value: CleaningOccupancy; label: string }> = [
  { value: "furnished", label: "Amoblada / con cosas" },
  { value: "vacant", label: "Vacía o casi vacía" }
];

export const CLEANING_EXTRA_OPTIONS: Array<{ value: CleaningExtraTask; label: string; minutes: number }> = [
  { value: "oven", label: "Interior de horno", minutes: 40 },
  { value: "fridge", label: "Interior de refrigerador", minutes: 30 },
  { value: "windows", label: "Ventanas interiores", minutes: 45 },
  { value: "balcony", label: "Balcón o terraza", minutes: 30 },
  { value: "pet-hair", label: "Mucho pelo de mascota", minutes: 25 }
];

export const CLEANING_ESTIMATE_QUERY_KEYS = [
  "recommendedHours",
  "estimatedMinHours",
  "estimatedMaxHours",
  "cleaningBedrooms",
  "cleaningBathrooms",
  "cleaningSize",
  "cleaningDirt",
  "cleaningOccupancy",
  "cleaningKitchen",
  "cleaningLivingDining",
  "cleaningExtras"
] as const;

type SearchLike = {
  get(name: string): string | null;
};

export function copyCleaningEstimateParams(source: SearchLike, target: URLSearchParams) {
  for (const key of CLEANING_ESTIMATE_QUERY_KEYS) {
    const value = source.get(key);
    if (value) target.set(key, value);
  }
}

function roundHalf(value: number) {
  return Math.max(1, Math.round(value * 2) / 2);
}

function sizeHours(value: CleaningSizeBand) {
  switch (value) {
    case "studio":
      return 0;
    case "small":
      return 0.3;
    case "medium":
      return 0.7;
    case "large":
      return 1.15;
    case "xlarge":
      return 1.7;
  }
}

function serviceBaseHours(value: CleaningServiceSlug) {
  switch (value) {
    case "limpieza-hogar":
      return 1.45;
    case "limpieza-profunda":
      return 1.9;
    case "limpieza-por-horas":
      return 1.3;
    case "limpieza-post-mudanza":
      return 2.15;
    case "limpieza-oficina":
      return 1.4;
  }
}

function serviceMultiplier(value: CleaningServiceSlug) {
  switch (value) {
    case "limpieza-hogar":
      return 1;
    case "limpieza-profunda":
      return 1.28;
    case "limpieza-por-horas":
      return 0.88;
    case "limpieza-post-mudanza":
      return 1.4;
    case "limpieza-oficina":
      return 0.94;
  }
}

function dirtMultiplier(value: CleaningDirtLevel) {
  switch (value) {
    case "low":
      return 0.92;
    case "normal":
      return 1;
    case "high":
      return 1.2;
  }
}

export function estimateCleaningDuration(input: CleaningDurationInput): CleaningDurationEstimate {
  const extrasMinutes = input.extras.reduce((acc, item) => acc + (CLEANING_EXTRA_OPTIONS.find((option) => option.value === item)?.minutes ?? 0), 0);
  const structuralHours =
    serviceBaseHours(input.serviceSlug) +
    input.bedrooms * 0.55 +
    input.bathrooms * 0.45 +
    sizeHours(input.sizeBand) +
    (input.hasKitchen ? 0.35 : 0) +
    (input.hasLivingDining ? 0.25 : 0) +
    (input.occupancy === "furnished" ? 0.3 : -0.1) +
    extrasMinutes / 60;

  const adjusted = structuralHours * serviceMultiplier(input.serviceSlug) * dirtMultiplier(input.dirtLevel);
  const minHours = roundHalf(Math.max(1.5, adjusted - 0.5));
  const maxHours = roundHalf(Math.max(minHours + 0.5, adjusted + 0.5));
  const recommendedHours = Math.max(2, Math.ceil((minHours + maxHours) / 2));
  const service = getCleaningServiceDefinition(input.serviceSlug);

  return {
    minHours,
    maxHours,
    recommendedHours,
    summary: `Para ${service?.name.toLowerCase() ?? "este servicio"}, te recomendamos reservar ${recommendedHours} hora(s).`
  };
}

export function parseCleaningRecommendedHours(value: string | null | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const normalized = Math.round(parsed);
  return normalized >= 1 && normalized <= 12 ? normalized : null;
}

export function isCleaningExtraTask(value: string): value is CleaningExtraTask {
  return CLEANING_EXTRA_OPTIONS.some((option) => option.value === value);
}

export function isCleaningSizeBand(value: string): value is CleaningSizeBand {
  return CLEANING_SIZE_OPTIONS.some((option) => option.value === value);
}

export function isCleaningDirtLevel(value: string): value is CleaningDirtLevel {
  return CLEANING_DIRT_LEVEL_OPTIONS.some((option) => option.value === value);
}

export function isCleaningOccupancy(value: string): value is CleaningOccupancy {
  return CLEANING_OCCUPANCY_OPTIONS.some((option) => option.value === value);
}

export function parseCleaningServiceSlug(value: string | null | undefined) {
  return value && isCleaningServiceSlug(value) ? value : null;
}
