export const TRAINER_SCOPE_SERVICE_OPTIONS = [
  {
    value: "funcional",
    label: "Entrenamiento funcional",
    description: "Sesiones orientadas a movilidad, coordinación, resistencia y fuerza aplicada al día a día."
  },
  {
    value: "fuerza",
    label: "Fuerza",
    description: "Trabajo enfocado en fuerza, técnica básica y progresión según objetivo."
  },
  {
    value: "perdida_peso",
    label: "Pérdida de peso",
    description: "Entrenamientos guiados para mejorar condición física y apoyar objetivos de composición corporal."
  },
  {
    value: "movilidad",
    label: "Movilidad",
    description: "Sesiones centradas en flexibilidad, movilidad articular y recuperación activa."
  }
] as const;

export const TRAINER_MODE_OPTIONS = [
  { value: "presencial", label: "Presencial" },
  { value: "online", label: "Online" },
  { value: "ambas", label: "Ambas" }
] as const;

export const TRAINER_TASK_INCLUDED_OPTIONS = [
  { value: "evaluacion_inicial_basica", label: "Evaluación inicial básica" },
  { value: "rutina_personalizada", label: "Rutina personalizada" },
  { value: "seguimiento_progreso", label: "Seguimiento de progreso" },
  { value: "correccion_tecnica", label: "Corrección técnica" },
  { value: "calentamiento_elongacion", label: "Calentamiento y elongación" },
  { value: "sesion_online", label: "Sesión online guiada" },
  { value: "sesion_domicilio", label: "Sesión a domicilio" },
  { value: "trabajo_con_implementos", label: "Trabajo con implementos" }
] as const;

export const TRAINER_TASK_EXCLUDED_OPTIONS = [
  { value: "rehabilitacion_medica", label: "Rehabilitación médica" },
  { value: "nutricion_clinica", label: "Nutrición clínica" },
  { value: "tratamiento_lesiones", label: "Tratamiento de lesiones" },
  { value: "alto_rendimiento_especializado", label: "Entrenamiento de alto rendimiento especializado" },
  { value: "prescripcion_medicamentos", label: "Prescripción de medicamentos o suplementos" },
  { value: "traslado_cliente", label: "Traslado del cliente" }
] as const;

export type TrainerScopeServiceSlug = (typeof TRAINER_SCOPE_SERVICE_OPTIONS)[number]["value"];
export type TrainerModeSlug = (typeof TRAINER_MODE_OPTIONS)[number]["value"];
export type TrainerTaskIncludedSlug = (typeof TRAINER_TASK_INCLUDED_OPTIONS)[number]["value"];
export type TrainerTaskExcludedSlug = (typeof TRAINER_TASK_EXCLUDED_OPTIONS)[number]["value"];

export type TrainerScopeData = {
  services_offered: TrainerScopeServiceSlug[];
  modes: TrainerModeSlug[];
  brings_equipment: boolean | null;
  tasks_included: TrainerTaskIncludedSlug[];
  tasks_excluded: TrainerTaskExcludedSlug[];
  special_conditions: string;
};

const serviceMap = new Map(TRAINER_SCOPE_SERVICE_OPTIONS.map((option) => [option.value, option]));
const modeMap = new Map(TRAINER_MODE_OPTIONS.map((option) => [option.value, option]));
const includedTaskMap = new Map(TRAINER_TASK_INCLUDED_OPTIONS.map((option) => [option.value, option]));
const excludedTaskMap = new Map(TRAINER_TASK_EXCLUDED_OPTIONS.map((option) => [option.value, option]));

export function isTrainerScopeServiceSlug(value: string): value is TrainerScopeServiceSlug {
  return serviceMap.has(value as TrainerScopeServiceSlug);
}

export function isTrainerModeSlug(value: string): value is TrainerModeSlug {
  return modeMap.has(value as TrainerModeSlug);
}

export function isTrainerTaskIncludedSlug(value: string): value is TrainerTaskIncludedSlug {
  return includedTaskMap.has(value as TrainerTaskIncludedSlug);
}

export function isTrainerTaskExcludedSlug(value: string): value is TrainerTaskExcludedSlug {
  return excludedTaskMap.has(value as TrainerTaskExcludedSlug);
}

export function emptyTrainerScope(): TrainerScopeData {
  return {
    services_offered: [],
    modes: [],
    brings_equipment: null,
    tasks_included: [],
    tasks_excluded: [],
    special_conditions: ""
  };
}

export function normalizeTrainerScope(value: unknown): TrainerScopeData {
  if (!value || typeof value !== "object") {
    return emptyTrainerScope();
  }

  const candidate = value as Partial<TrainerScopeData>;

  return {
    services_offered: Array.isArray(candidate.services_offered)
      ? candidate.services_offered.filter((item): item is TrainerScopeServiceSlug => typeof item === "string" && isTrainerScopeServiceSlug(item))
      : [],
    modes: Array.isArray(candidate.modes)
      ? candidate.modes.filter((item): item is TrainerModeSlug => typeof item === "string" && isTrainerModeSlug(item))
      : [],
    brings_equipment: typeof candidate.brings_equipment === "boolean" ? candidate.brings_equipment : null,
    tasks_included: Array.isArray(candidate.tasks_included)
      ? candidate.tasks_included.filter((item): item is TrainerTaskIncludedSlug => typeof item === "string" && isTrainerTaskIncludedSlug(item))
      : [],
    tasks_excluded: Array.isArray(candidate.tasks_excluded)
      ? candidate.tasks_excluded.filter((item): item is TrainerTaskExcludedSlug => typeof item === "string" && isTrainerTaskExcludedSlug(item))
      : [],
    special_conditions: typeof candidate.special_conditions === "string" ? candidate.special_conditions.trim() : ""
  };
}

export function getTrainerServiceLabel(value: string) {
  return serviceMap.get(value as TrainerScopeServiceSlug)?.label ?? value;
}

export function getTrainerModeLabel(value: string) {
  return modeMap.get(value as TrainerModeSlug)?.label ?? value;
}

export function getTrainerIncludedTaskLabel(value: string) {
  return includedTaskMap.get(value as TrainerTaskIncludedSlug)?.label ?? value;
}

export function getTrainerExcludedTaskLabel(value: string) {
  return excludedTaskMap.get(value as TrainerTaskExcludedSlug)?.label ?? value;
}

export function supportsTrainerRequestedTasks(scope: unknown, requestedTasks: string[]) {
  const normalizedScope = normalizeTrainerScope(scope);
  const normalizedRequestedTasks = requestedTasks.filter(isTrainerTaskIncludedSlug);
  if (normalizedRequestedTasks.length === 0) return true;

  const included = new Set<string>(normalizedScope.tasks_included);
  const excluded = new Set<string>(normalizedScope.tasks_excluded);

  return normalizedRequestedTasks.every((task) => included.has(task) && !excluded.has(task));
}
