import { BABYSITTER_TASK_INCLUDED_OPTIONS } from "@/lib/babysitter-scope";
import { getChefServiceDefinition } from "@/lib/chef-service-types";
import { CLEANING_TASK_INCLUDED_OPTIONS, getCleaningTaskOptionsForService } from "@/lib/cleaning-scope";
import {
  type CleaningDirtLevel,
  type CleaningDurationEstimate,
  type CleaningDurationInput,
  type CleaningExtraTask,
  type CleaningOccupancy,
  type CleaningSizeBand,
  estimateCleaningDuration,
  isCleaningDirtLevel,
  isCleaningExtraTask,
  isCleaningOccupancy,
  isCleaningSizeBand,
  parseCleaningServiceSlug
} from "@/lib/cleaning-duration-estimator";
import { type CleaningServiceSlug, getCleaningServiceDefinition } from "@/lib/cleaning-service-types";
import {
  type IroningDurationEstimate,
  type IroningDurationInput,
  estimateIroningDuration
} from "@/lib/ironing-duration-estimator";
import { MAKEUP_TASK_INCLUDED_OPTIONS } from "@/lib/makeup-scope";
import { PET_TASK_INCLUDED_OPTIONS } from "@/lib/pet-scope";
import { TEACHER_TASK_INCLUDED_OPTIONS } from "@/lib/teacher-scope";
import { TRAINER_TASK_INCLUDED_OPTIONS } from "@/lib/trainer-scope";

export type TaskFilterOption = { value: string; label: string };

type ServicePreparationInput = {
  categorySlug: string;
  serviceSlug?: string | null;
  cleaning?: {
    bedrooms?: number | null;
    bathrooms?: number | null;
    sizeBand?: string | null;
    dirtLevel?: string | null;
    occupancy?: string | null;
    hasKitchen?: boolean;
    hasLivingDining?: boolean;
    extras?: string[];
  };
  ironing?: {
    garments?: number | null;
    bulkyItems?: number | null;
    includesDelicates?: boolean;
  };
};

type ServicePreparationResult = {
  taskOptions: TaskFilterOption[];
  cleaningDetailsIntro: string | null;
  cleaningEstimate: CleaningDurationEstimate | null;
  ironingEstimate: IroningDurationEstimate | null;
  displayBasePriceClp: number | null;
  serviceSummary: string | null;
  serviceIncludes: string[];
  serviceExcludes: string[];
  estimatedDurationLabel: string | null;
};

const TASK_FILTER_OPTIONS_BY_CATEGORY: Record<string, TaskFilterOption[]> = {
  limpieza: [...CLEANING_TASK_INCLUDED_OPTIONS],
  mascotas: [...PET_TASK_INCLUDED_OPTIONS],
  babysitter: [...BABYSITTER_TASK_INCLUDED_OPTIONS],
  "profesor-particular": [...TEACHER_TASK_INCLUDED_OPTIONS],
  "personal-trainer": [...TRAINER_TASK_INCLUDED_OPTIONS],
  chef: [],
  maquillaje: [...MAKEUP_TASK_INCLUDED_OPTIONS],
  planchado: []
};

function getCleaningDetailsIntro(serviceSlug: CleaningServiceSlug | null) {
  switch (serviceSlug) {
    case "limpieza-hogar":
      return "Ahora cuéntanos cómo es tu casa y si hay focos específicos para calcular mejor el tiempo recomendado.";
    case "limpieza-profunda":
      return "Queremos entender el nivel de detalle y las zonas más exigentes para recomendar una duración realista.";
    case "limpieza-por-horas":
      return "Dinos el tamaño del espacio y tus prioridades para sugerirte cuántas horas conviene reservar.";
    case "limpieza-post-mudanza":
      return "Necesitamos saber cómo está el espacio y qué extras incluye para estimar bien un aseo de entrega o entrada.";
    case "limpieza-oficina":
      return "Cuéntanos el tamaño y estado del lugar para recomendar cuántas horas necesita tu limpieza de oficina.";
    default:
      return "Completa estos datos para recomendarte cuántas horas reservar según tu espacio y el alcance del servicio.";
  }
}

function buildCleaningEstimate(input: ServicePreparationInput["cleaning"], serviceSlug: CleaningServiceSlug | null) {
  if (!input || !serviceSlug) return null;
  const bedrooms = Number(input.bedrooms);
  const bathrooms = Number(input.bathrooms);
  if (!Number.isFinite(bedrooms) || !Number.isFinite(bathrooms)) return null;
  if (!isCleaningSizeBand(input.sizeBand ?? "")) return null;
  if (!isCleaningDirtLevel(input.dirtLevel ?? "")) return null;
  if (!isCleaningOccupancy(input.occupancy ?? "")) return null;

  const sizeBand = input.sizeBand as CleaningSizeBand;
  const dirtLevel = input.dirtLevel as CleaningDirtLevel;
  const occupancy = input.occupancy as CleaningOccupancy;
  const extras: CleaningExtraTask[] = (input.extras ?? []).filter(isCleaningExtraTask);

  const estimateInput: CleaningDurationInput = {
    serviceSlug,
    bedrooms,
    bathrooms,
    sizeBand,
    dirtLevel,
    occupancy,
    hasKitchen: input.hasKitchen !== false,
    hasLivingDining: input.hasLivingDining !== false,
    extras
  };

  return estimateCleaningDuration(estimateInput);
}

function buildIroningEstimate(input: ServicePreparationInput["ironing"]) {
  if (!input) return null;
  const garments = Number(input.garments);
  const bulkyItems = Number(input.bulkyItems ?? 0);
  if (!Number.isFinite(garments) || garments <= 0) return null;
  if (!Number.isFinite(bulkyItems) || bulkyItems < 0) return null;

  const estimateInput: IroningDurationInput = {
    garments,
    bulkyItems,
    includesDelicates: Boolean(input.includesDelicates)
  };

  return estimateIroningDuration(estimateInput);
}

export function prepareServiceRequest(input: ServicePreparationInput): ServicePreparationResult {
  const parsedCleaningServiceSlug = parseCleaningServiceSlug(input.serviceSlug);
  const taskOptions =
    input.categorySlug === "limpieza"
      ? getCleaningTaskOptionsForService(parsedCleaningServiceSlug)
      : (TASK_FILTER_OPTIONS_BY_CATEGORY[input.categorySlug] ?? []);

  const cleaningDefinition =
    input.categorySlug === "limpieza" && parsedCleaningServiceSlug
      ? getCleaningServiceDefinition(parsedCleaningServiceSlug)
      : null;
  const chefDefinition = input.categorySlug === "chef" && input.serviceSlug ? getChefServiceDefinition(input.serviceSlug) : null;

  return {
    taskOptions,
    cleaningDetailsIntro: input.categorySlug === "limpieza" ? getCleaningDetailsIntro(parsedCleaningServiceSlug) : null,
    cleaningEstimate: input.categorySlug === "limpieza" ? buildCleaningEstimate(input.cleaning, parsedCleaningServiceSlug) : null,
    ironingEstimate: input.categorySlug === "planchado" ? buildIroningEstimate(input.ironing) : null,
    displayBasePriceClp: cleaningDefinition?.recommendedMinClp ?? chefDefinition?.recommendedMinClp ?? null,
    serviceSummary: cleaningDefinition?.forClients ?? chefDefinition?.forClients ?? null,
    serviceIncludes: [...(cleaningDefinition?.includes ?? chefDefinition?.includes ?? [])],
    serviceExcludes: [...(cleaningDefinition?.excludes ?? chefDefinition?.excludes ?? [])],
    estimatedDurationLabel: chefDefinition?.estimatedDurationLabel ?? null
  };
}
