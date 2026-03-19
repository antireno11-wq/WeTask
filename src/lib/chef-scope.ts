import { CHEF_SERVICE_DEFINITIONS, type ChefServiceSlug } from "@/lib/chef-service-types";

export const CHEF_SCOPE_SERVICE_OPTIONS = CHEF_SERVICE_DEFINITIONS.map((service) => ({
  value: service.slug,
  label: service.name,
  description: service.description
})) as Array<{
  value: ChefServiceSlug;
  label: string;
  description: string;
}>;

export const CHEF_TASK_INCLUDED_OPTIONS = [
  { value: "planificacion_menu", label: "Planificación básica del menú" },
  { value: "cocina_domicilio", label: "Cocinar en casa del cliente" },
  { value: "mise_en_place", label: "Preparación previa y mise en place" },
  { value: "emplatado_basico", label: "Emplatado o presentación básica" },
  { value: "orden_limpieza_basica", label: "Orden y limpieza básica de la cocina usada" },
  { value: "adaptacion_preferencias", label: "Ajuste según preferencias o restricciones informadas" },
  { value: "coordinacion_porciones", label: "Coordinación por cantidad de personas" },
  { value: "preparaciones_dulces", label: "Preparaciones dulces o repostería si se acuerda" }
] as const;

export const CHEF_TASK_EXCLUDED_OPTIONS = [
  { value: "compra_insumos", label: "Compra de insumos si no se acuerda antes" },
  { value: "garzones_bartender", label: "Garzones, bartender o servicio de mesa" },
  { value: "decoracion_evento", label: "Decoración o ambientación del evento" },
  { value: "mobiliario_logistica", label: "Arriendo de mobiliario o logística del evento" },
  { value: "produccion_completa_evento", label: "Producción completa del evento" },
  { value: "delivery_externo", label: "Delivery o despacho externo fuera del servicio acordado" }
] as const;

export type ChefTaskIncludedSlug = (typeof CHEF_TASK_INCLUDED_OPTIONS)[number]["value"];
export type ChefTaskExcludedSlug = (typeof CHEF_TASK_EXCLUDED_OPTIONS)[number]["value"];

export type ChefScopeData = {
  services_offered: ChefServiceSlug[];
  tasks_included: ChefTaskIncludedSlug[];
  tasks_excluded: ChefTaskExcludedSlug[];
  special_conditions: string;
};

const serviceMap = new Map(CHEF_SCOPE_SERVICE_OPTIONS.map((option) => [option.value, option]));
const includedTaskMap = new Map(CHEF_TASK_INCLUDED_OPTIONS.map((option) => [option.value, option]));
const excludedTaskMap = new Map(CHEF_TASK_EXCLUDED_OPTIONS.map((option) => [option.value, option]));

export function isChefScopeServiceSlug(value: string): value is ChefServiceSlug {
  return serviceMap.has(value as ChefServiceSlug);
}

export function isChefTaskIncludedSlug(value: string): value is ChefTaskIncludedSlug {
  return includedTaskMap.has(value as ChefTaskIncludedSlug);
}

export function isChefTaskExcludedSlug(value: string): value is ChefTaskExcludedSlug {
  return excludedTaskMap.has(value as ChefTaskExcludedSlug);
}

export function emptyChefScope(): ChefScopeData {
  return {
    services_offered: [],
    tasks_included: [],
    tasks_excluded: [],
    special_conditions: ""
  };
}

export function normalizeChefScope(value: unknown): ChefScopeData {
  if (!value || typeof value !== "object") {
    return emptyChefScope();
  }

  const candidate = value as Partial<ChefScopeData>;
  return {
    services_offered: Array.isArray(candidate.services_offered)
      ? candidate.services_offered.filter((item): item is ChefServiceSlug => typeof item === "string" && isChefScopeServiceSlug(item))
      : [],
    tasks_included: Array.isArray(candidate.tasks_included)
      ? candidate.tasks_included.filter((item): item is ChefTaskIncludedSlug => typeof item === "string" && isChefTaskIncludedSlug(item))
      : [],
    tasks_excluded: Array.isArray(candidate.tasks_excluded)
      ? candidate.tasks_excluded.filter((item): item is ChefTaskExcludedSlug => typeof item === "string" && isChefTaskExcludedSlug(item))
      : [],
    special_conditions: typeof candidate.special_conditions === "string" ? candidate.special_conditions.trim() : ""
  };
}

export function getChefScopeServiceLabel(value: string) {
  return serviceMap.get(value as ChefServiceSlug)?.label ?? value;
}

export function getChefIncludedTaskLabel(value: string) {
  return includedTaskMap.get(value as ChefTaskIncludedSlug)?.label ?? value;
}

export function getChefExcludedTaskLabel(value: string) {
  return excludedTaskMap.get(value as ChefTaskExcludedSlug)?.label ?? value;
}
