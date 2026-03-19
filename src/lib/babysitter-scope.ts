export const BABYSITTER_SCOPE_SERVICE_OPTIONS = [
  {
    value: "cuidado_por_horas",
    label: "Cuidado por horas",
    description: "Acompañamiento y cuidado por bloques de tiempo durante el día."
  },
  {
    value: "cuidado_nocturno",
    label: "Cuidado nocturno",
    description: "Apoyo para noches, salidas o rutinas de sueño previamente acordadas."
  },
  {
    value: "despues_del_colegio",
    label: "Después del colegio",
    description: "Acompañamiento al llegar a casa, colación, tareas y rutina de tarde."
  },
  {
    value: "acompanamiento_eventual",
    label: "Acompañamiento eventual",
    description: "Apoyo para eventos, reuniones o necesidades puntuales de la familia."
  }
] as const;

export const BABYSITTER_AGE_RANGE_OPTIONS = [
  { value: "0_2", label: "0-2 años" },
  { value: "3_6", label: "3-6 años" },
  { value: "7_plus", label: "7+ años" }
] as const;

export const BABYSITTER_TASK_INCLUDED_OPTIONS = [
  { value: "supervision_general", label: "Supervisión general" },
  { value: "comida_simple", label: "Preparar comida simple" },
  { value: "cambio_ropa_higiene_basica", label: "Cambio de ropa e higiene básica" },
  { value: "ayuda_tareas", label: "Ayuda con tareas o estudio" },
  { value: "juego_acompanamiento", label: "Juego y acompañamiento" },
  { value: "rutina_sueno", label: "Rutina de sueño" },
  { value: "cambio_panal", label: "Cambio de pañal" },
  { value: "acompanamiento_actividades_casa", label: "Acompañamiento en actividades dentro de casa" }
] as const;

export const BABYSITTER_TASK_EXCLUDED_OPTIONS = [
  { value: "enfermeria", label: "Enfermería o atención médica" },
  { value: "aseo_profundo_hogar", label: "Aseo profundo del hogar" },
  { value: "cocinar_familia_completa", label: "Cocinar para toda la familia" },
  { value: "traslados_vehiculo", label: "Traslados en vehículo" },
  { value: "mas_tres_ninos", label: "Cuidado de más de tres niños a la vez" },
  { value: "apoyo_terapeutico_especializado", label: "Apoyo terapéutico especializado" },
  { value: "administrar_medicamentos_complejos", label: "Administrar medicamentos complejos" },
  { value: "pernoctar", label: "Pernoctar" }
] as const;

export type BabysitterScopeServiceSlug = (typeof BABYSITTER_SCOPE_SERVICE_OPTIONS)[number]["value"];
export type BabysitterAgeRangeSlug = (typeof BABYSITTER_AGE_RANGE_OPTIONS)[number]["value"];
export type BabysitterTaskIncludedSlug = (typeof BABYSITTER_TASK_INCLUDED_OPTIONS)[number]["value"];
export type BabysitterTaskExcludedSlug = (typeof BABYSITTER_TASK_EXCLUDED_OPTIONS)[number]["value"];

export type BabysitterScopeData = {
  services_offered: BabysitterScopeServiceSlug[];
  age_ranges: BabysitterAgeRangeSlug[];
  first_aid: boolean | null;
  multi_child: boolean | null;
  tasks_included: BabysitterTaskIncludedSlug[];
  tasks_excluded: BabysitterTaskExcludedSlug[];
  special_conditions: string;
};

const serviceMap = new Map(BABYSITTER_SCOPE_SERVICE_OPTIONS.map((option) => [option.value, option]));
const ageRangeMap = new Map(BABYSITTER_AGE_RANGE_OPTIONS.map((option) => [option.value, option]));
const includedTaskMap = new Map(BABYSITTER_TASK_INCLUDED_OPTIONS.map((option) => [option.value, option]));
const excludedTaskMap = new Map(BABYSITTER_TASK_EXCLUDED_OPTIONS.map((option) => [option.value, option]));

export function isBabysitterScopeServiceSlug(value: string): value is BabysitterScopeServiceSlug {
  return serviceMap.has(value as BabysitterScopeServiceSlug);
}

export function isBabysitterAgeRangeSlug(value: string): value is BabysitterAgeRangeSlug {
  return ageRangeMap.has(value as BabysitterAgeRangeSlug);
}

export function isBabysitterTaskIncludedSlug(value: string): value is BabysitterTaskIncludedSlug {
  return includedTaskMap.has(value as BabysitterTaskIncludedSlug);
}

export function isBabysitterTaskExcludedSlug(value: string): value is BabysitterTaskExcludedSlug {
  return excludedTaskMap.has(value as BabysitterTaskExcludedSlug);
}

export function emptyBabysitterScope(): BabysitterScopeData {
  return {
    services_offered: [],
    age_ranges: [],
    first_aid: null,
    multi_child: null,
    tasks_included: [],
    tasks_excluded: [],
    special_conditions: ""
  };
}

export function normalizeBabysitterScope(value: unknown): BabysitterScopeData {
  if (!value || typeof value !== "object") {
    return emptyBabysitterScope();
  }

  const candidate = value as Partial<BabysitterScopeData>;
  const legacyServiceMap: Record<string, BabysitterScopeServiceSlug> = {
    babysitter_horas: "cuidado_por_horas"
  };

  return {
    services_offered: Array.isArray(candidate.services_offered)
      ? candidate.services_offered
          .map((item) => {
            if (typeof item !== "string") return null;
            if (isBabysitterScopeServiceSlug(item)) return item;
            return legacyServiceMap[item] ?? null;
          })
          .filter((item): item is BabysitterScopeServiceSlug => Boolean(item))
      : [],
    age_ranges: Array.isArray(candidate.age_ranges)
      ? candidate.age_ranges.filter((item): item is BabysitterAgeRangeSlug => typeof item === "string" && isBabysitterAgeRangeSlug(item))
      : [],
    first_aid: typeof candidate.first_aid === "boolean" ? candidate.first_aid : null,
    multi_child: typeof candidate.multi_child === "boolean" ? candidate.multi_child : null,
    tasks_included: Array.isArray(candidate.tasks_included)
      ? candidate.tasks_included.filter((item): item is BabysitterTaskIncludedSlug => typeof item === "string" && isBabysitterTaskIncludedSlug(item))
      : [],
    tasks_excluded: Array.isArray(candidate.tasks_excluded)
      ? candidate.tasks_excluded.filter((item): item is BabysitterTaskExcludedSlug => typeof item === "string" && isBabysitterTaskExcludedSlug(item))
      : [],
    special_conditions: typeof candidate.special_conditions === "string" ? candidate.special_conditions.trim() : ""
  };
}

export function getBabysitterServiceLabel(value: string) {
  return serviceMap.get(value as BabysitterScopeServiceSlug)?.label ?? value;
}

export function getBabysitterAgeRangeLabel(value: string) {
  return ageRangeMap.get(value as BabysitterAgeRangeSlug)?.label ?? value;
}

export function getBabysitterIncludedTaskLabel(value: string) {
  return includedTaskMap.get(value as BabysitterTaskIncludedSlug)?.label ?? value;
}

export function getBabysitterExcludedTaskLabel(value: string) {
  return excludedTaskMap.get(value as BabysitterTaskExcludedSlug)?.label ?? value;
}

export function supportsBabysitterRequestedTasks(scope: unknown, requestedTasks: string[]) {
  const normalizedScope = normalizeBabysitterScope(scope);
  const normalizedRequestedTasks = requestedTasks.filter(isBabysitterTaskIncludedSlug);
  if (normalizedRequestedTasks.length === 0) return true;

  const included = new Set<string>(normalizedScope.tasks_included);
  const excluded = new Set<string>(normalizedScope.tasks_excluded);

  return normalizedRequestedTasks.every((task) => included.has(task) && !excluded.has(task));
}
