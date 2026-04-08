import {
  ACTIVE_CLEANING_SERVICE_DEFINITIONS,
  ACTIVE_CLEANING_SERVICE_SLUGS,
  type CleaningServiceSlug,
  isActiveCleaningServiceSlug,
  isCleaningServiceSlug
} from "@/lib/cleaning-service-types";

export const CLEANING_SCOPE_SERVICE_OPTIONS = ACTIVE_CLEANING_SERVICE_DEFINITIONS.map((service) => ({
  value: service.slug,
  label: service.name,
  description: service.description
})) as ReadonlyArray<{
  value: (typeof ACTIVE_CLEANING_SERVICE_SLUGS)[number];
  label: string;
  description: string;
}>;

export const CLEANING_TASK_INCLUDED_OPTIONS = [
  { value: "barrer", label: "Barrer" },
  { value: "aspirar", label: "Aspirar" },
  { value: "trapear", label: "Trapear" },
  { value: "sacudir_polvo", label: "Sacudir polvo" },
  { value: "limpiar_banos", label: "Limpiar baños" },
  { value: "limpiar_cocina_por_fuera", label: "Limpiar cocina por fuera" },
  { value: "lavar_loza", label: "Lavar loza" },
  { value: "hacer_camas", label: "Hacer camas" },
  { value: "sacar_basura", label: "Sacar basura" },
  { value: "orden_basico", label: "Orden básico" },
  { value: "limpieza_interior_horno", label: "Limpieza interior de horno" },
  { value: "limpieza_interior_refrigerador", label: "Limpieza interior de refrigerador" },
  { value: "limpieza_ventanas", label: "Limpieza de ventanas" },
  { value: "limpieza_balcones_terrazas", label: "Limpieza de balcones o terrazas" }
] as const;

export const CLEANING_TASK_EXCLUDED_OPTIONS = [
  { value: "limpieza_heces_vomito_fluidos", label: "Limpieza de heces, vómito o fluidos" },
  { value: "limpieza_post_obra_pesada", label: "Limpieza post obra pesada" },
  { value: "limpieza_en_altura", label: "Limpieza en altura" },
  { value: "mover_muebles_pesados", label: "Mover muebles pesados" },
  { value: "cuidar_ninos", label: "Cuidar niños" },
  { value: "cuidar_adultos_mayores", label: "Cuidar adultos mayores" },
  { value: "cocinar", label: "Cocinar" },
  { value: "lavar_mascotas_o_zonas_mascotas", label: "Lavar mascotas o limpiar zonas de mascotas" },
  { value: "uso_quimicos_fuertes", label: "Uso de químicos fuertes" },
  { value: "limpieza_vidrios_en_altura", label: "Limpieza de vidrios en altura" }
] as const;

export type CleaningScopeServiceSlug = (typeof ACTIVE_CLEANING_SERVICE_SLUGS)[number];
export type CleaningTaskIncludedSlug = (typeof CLEANING_TASK_INCLUDED_OPTIONS)[number]["value"];
export type CleaningTaskExcludedSlug = (typeof CLEANING_TASK_EXCLUDED_OPTIONS)[number]["value"];

export type CleaningScopeData = {
  services_offered: CleaningScopeServiceSlug[];
  tasks_included: CleaningTaskIncludedSlug[];
  tasks_excluded: CleaningTaskExcludedSlug[];
  special_conditions: string;
};

const serviceMap = new Map(CLEANING_SCOPE_SERVICE_OPTIONS.map((option) => [option.value, option]));
const includedTaskMap = new Map(CLEANING_TASK_INCLUDED_OPTIONS.map((option) => [option.value, option]));
const excludedTaskMap = new Map(CLEANING_TASK_EXCLUDED_OPTIONS.map((option) => [option.value, option]));

export function isCleaningScopeServiceSlug(value: string): value is CleaningScopeServiceSlug {
  return serviceMap.has(value as CleaningScopeServiceSlug);
}

export function isCleaningTaskIncludedSlug(value: string): value is CleaningTaskIncludedSlug {
  return includedTaskMap.has(value as CleaningTaskIncludedSlug);
}

export function isCleaningTaskExcludedSlug(value: string): value is CleaningTaskExcludedSlug {
  return excludedTaskMap.has(value as CleaningTaskExcludedSlug);
}

export function emptyCleaningScope(): CleaningScopeData {
  return {
    services_offered: [],
    tasks_included: [],
    tasks_excluded: [],
    special_conditions: ""
  };
}

export function normalizeCleaningScope(value: unknown): CleaningScopeData {
  if (!value || typeof value !== "object") {
    return emptyCleaningScope();
  }

  const candidate = value as Partial<CleaningScopeData>;
  const legacyServiceMap: Record<string, CleaningServiceSlug> = {
    aseo_general: "limpieza-hogar",
    limpieza_bano: "limpieza-hogar",
    limpieza_cocina: "limpieza-hogar",
    organizacion_espacios: "limpieza-hogar",
    limpieza_vidrios_interiores: "limpieza-hogar",
    aseo_profundo: "limpieza-profunda",
    limpieza_post_remodelacion: "limpieza-profunda",
    limpieza_refrigerador: "limpieza-profunda",
    limpieza_horno: "limpieza-profunda",
    limpieza_post_mudanza: "limpieza-post-mudanza"
  };

  return {
    services_offered: Array.isArray(candidate.services_offered)
      ? Array.from(
          new Set(
            candidate.services_offered
              .map((item) => {
                if (typeof item !== "string") return null;
                if (isCleaningScopeServiceSlug(item) && isActiveCleaningServiceSlug(item)) return item;
                return legacyServiceMap[item] ?? null;
              })
              .filter((item): item is CleaningServiceSlug => typeof item === "string")
              .filter(isActiveCleaningServiceSlug)
          )
        )
      : [...ACTIVE_CLEANING_SERVICE_SLUGS],
    tasks_included: Array.isArray(candidate.tasks_included)
      ? candidate.tasks_included.filter((item): item is CleaningTaskIncludedSlug => typeof item === "string" && isCleaningTaskIncludedSlug(item))
      : [],
    tasks_excluded: Array.isArray(candidate.tasks_excluded)
      ? candidate.tasks_excluded.filter((item): item is CleaningTaskExcludedSlug => typeof item === "string" && isCleaningTaskExcludedSlug(item))
      : [],
    special_conditions: typeof candidate.special_conditions === "string" ? candidate.special_conditions.trim() : ""
  };
}

export function getCleaningScopeServiceLabel(value: string) {
  return serviceMap.get(value as CleaningScopeServiceSlug)?.label ?? value;
}

export function getCleaningIncludedTaskLabel(value: string) {
  return includedTaskMap.get(value as CleaningTaskIncludedSlug)?.label ?? value;
}

export function getCleaningExcludedTaskLabel(value: string) {
  return excludedTaskMap.get(value as CleaningTaskExcludedSlug)?.label ?? value;
}

const CLEANING_TASKS_BY_SERVICE: Record<CleaningServiceSlug, CleaningTaskIncludedSlug[]> = {
  "limpieza-hogar": [
    "barrer",
    "aspirar",
    "trapear",
    "sacudir_polvo",
    "limpiar_banos",
    "limpiar_cocina_por_fuera",
    "lavar_loza",
    "hacer_camas",
    "sacar_basura",
    "orden_basico"
  ],
  "limpieza-profunda": [
    "barrer",
    "aspirar",
    "trapear",
    "sacudir_polvo",
    "limpiar_banos",
    "limpiar_cocina_por_fuera",
    "lavar_loza",
    "hacer_camas",
    "sacar_basura",
    "orden_basico",
    "limpieza_interior_horno",
    "limpieza_interior_refrigerador",
    "limpieza_ventanas",
    "limpieza_balcones_terrazas"
  ],
  "limpieza-por-horas": [
    "barrer",
    "aspirar",
    "trapear",
    "sacudir_polvo",
    "limpiar_banos",
    "limpiar_cocina_por_fuera",
    "lavar_loza",
    "hacer_camas",
    "sacar_basura",
    "orden_basico"
  ],
  "limpieza-post-mudanza": [
    "barrer",
    "aspirar",
    "trapear",
    "sacudir_polvo",
    "limpiar_banos",
    "limpiar_cocina_por_fuera",
    "sacar_basura",
    "limpieza_ventanas",
    "limpieza_balcones_terrazas"
  ],
  "limpieza-oficina": ["barrer", "aspirar", "trapear", "sacudir_polvo", "limpiar_banos", "sacar_basura", "orden_basico"]
};

export function getCleaningTaskOptionsForService(serviceSlug: CleaningServiceSlug | null | undefined) {
  if (!serviceSlug || !isActiveCleaningServiceSlug(serviceSlug)) {
    const defaultService = ACTIVE_CLEANING_SERVICE_SLUGS[0];
    const allowed = new Set(CLEANING_TASKS_BY_SERVICE[defaultService] ?? []);
    return CLEANING_TASK_INCLUDED_OPTIONS.filter((option) => allowed.has(option.value));
  }
  const allowed = new Set(CLEANING_TASKS_BY_SERVICE[serviceSlug] ?? []);
  return CLEANING_TASK_INCLUDED_OPTIONS.filter((option) => allowed.has(option.value));
}

export function supportsCleaningRequestedTasks(scope: unknown, requestedTasks: string[]) {
  const normalizedScope = normalizeCleaningScope(scope);
  const normalizedRequestedTasks = requestedTasks.filter(isCleaningTaskIncludedSlug);
  if (normalizedRequestedTasks.length === 0) return true;

  const included = new Set<string>(normalizedScope.tasks_included);
  const excluded = new Set<string>(normalizedScope.tasks_excluded);

  return normalizedRequestedTasks.every((task) => included.has(task) && !excluded.has(task));
}
