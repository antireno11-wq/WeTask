export const CLEANING_SCOPE_SERVICE_OPTIONS = [
  { value: "aseo_general", label: "Aseo general", description: "Mantención general del hogar y aseo normal." },
  { value: "aseo_profundo", label: "Aseo profundo", description: "Más detalle, más tiempo y limpieza más exigente." },
  { value: "limpieza_bano", label: "Limpieza de baño", description: "Baños con foco específico en sanitarios, grifería y superficies." },
  { value: "limpieza_cocina", label: "Limpieza de cocina", description: "Cocina por fuera, superficies y orden del área." },
  { value: "limpieza_post_mudanza", label: "Limpieza post mudanza", description: "Para entrar a vivir o entregar una propiedad." },
  { value: "limpieza_post_remodelacion", label: "Limpieza post remodelación", description: "Polvo fino y suciedad posterior a trabajos livianos." },
  { value: "organizacion_espacios", label: "Organización de espacios", description: "Orden de superficies, clósets o sectores visibles." },
  { value: "limpieza_vidrios_interiores", label: "Limpieza de vidrios interiores", description: "Limpieza de vidrios y ventanas por dentro." },
  { value: "limpieza_refrigerador", label: "Limpieza de refrigerador", description: "Limpieza interior del refrigerador." },
  { value: "limpieza_horno", label: "Limpieza de horno", description: "Limpieza interior del horno." }
] as const;

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

export type CleaningScopeServiceSlug = (typeof CLEANING_SCOPE_SERVICE_OPTIONS)[number]["value"];
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
  return {
    services_offered: Array.isArray(candidate.services_offered)
      ? candidate.services_offered.filter((item): item is CleaningScopeServiceSlug => typeof item === "string" && isCleaningScopeServiceSlug(item))
      : [],
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

export function supportsCleaningRequestedTasks(scope: unknown, requestedTasks: string[]) {
  const normalizedScope = normalizeCleaningScope(scope);
  const normalizedRequestedTasks = requestedTasks.filter(isCleaningTaskIncludedSlug);
  if (normalizedRequestedTasks.length === 0) return true;

  const included = new Set<string>(normalizedScope.tasks_included);
  const excluded = new Set<string>(normalizedScope.tasks_excluded);

  return normalizedRequestedTasks.every((task) => included.has(task) && !excluded.has(task));
}
