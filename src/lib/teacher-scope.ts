export const TEACHER_SCOPE_SERVICE_OPTIONS = [
  {
    value: "matematicas",
    label: "Matemáticas",
    description: "Refuerzo, práctica y preparación para evaluaciones en matemática."
  },
  {
    value: "ingles",
    label: "Inglés",
    description: "Clases de comprensión, conversación, apoyo escolar y reforzamiento."
  },
  {
    value: "lenguaje",
    label: "Lenguaje",
    description: "Lectura, comprensión, escritura y apoyo en contenidos de lenguaje."
  },
  {
    value: "ciencias",
    label: "Ciencias",
    description: "Apoyo en ciencias naturales, biología, química o contenidos afines."
  },
  {
    value: "otra",
    label: "Otra asignatura",
    description: "Si enseñas otra asignatura, podrás aclararla en tus condiciones especiales."
  }
] as const;

export const TEACHER_LEVEL_OPTIONS = [
  { value: "basica", label: "Básica" },
  { value: "media", label: "Media" },
  { value: "universitario", label: "Universitario" }
] as const;

export const TEACHER_MODE_OPTIONS = [
  { value: "presencial", label: "Presencial" },
  { value: "online", label: "Online" }
] as const;

export const TEACHER_TASK_INCLUDED_OPTIONS = [
  { value: "reforzamiento_contenidos", label: "Reforzamiento de contenidos" },
  { value: "preparacion_pruebas", label: "Preparación de pruebas y evaluaciones" },
  { value: "apoyo_tareas", label: "Apoyo con tareas y trabajos guiados" },
  { value: "material_propio", label: "Material propio o ejercicios preparados" },
  { value: "clases_online", label: "Clases online guiadas" },
  { value: "clases_presenciales", label: "Clases presenciales" },
  { value: "evaluacion_diagnostica", label: "Evaluación diagnóstica inicial" },
  { value: "seguimiento_progreso", label: "Seguimiento de avance" }
] as const;

export const TEACHER_TASK_EXCLUDED_OPTIONS = [
  { value: "hacer_trabajos_alumno", label: "Hacer trabajos o pruebas por el alumno" },
  { value: "apoyo_necesidades_especiales_no_declaradas", label: "Apoyo especializado no declarado previamente" },
  { value: "traslado_fuera_zona", label: "Traslados fuera de mi zona acordada" },
  { value: "clases_grupales", label: "Clases grupales" },
  { value: "reemplazo_docente_formal", label: "Reemplazo docente formal para colegios o instituciones" },
  { value: "cuidado_estudiante_fuera_clase", label: "Cuidado o supervisión fuera del horario de clase" }
] as const;

export type TeacherScopeServiceSlug = (typeof TEACHER_SCOPE_SERVICE_OPTIONS)[number]["value"];
export type TeacherLevelSlug = (typeof TEACHER_LEVEL_OPTIONS)[number]["value"];
export type TeacherModeSlug = (typeof TEACHER_MODE_OPTIONS)[number]["value"];
export type TeacherTaskIncludedSlug = (typeof TEACHER_TASK_INCLUDED_OPTIONS)[number]["value"];
export type TeacherTaskExcludedSlug = (typeof TEACHER_TASK_EXCLUDED_OPTIONS)[number]["value"];

export type TeacherScopeData = {
  services_offered: TeacherScopeServiceSlug[];
  levels: TeacherLevelSlug[];
  modes: TeacherModeSlug[];
  tasks_included: TeacherTaskIncludedSlug[];
  tasks_excluded: TeacherTaskExcludedSlug[];
  special_conditions: string;
};

const serviceMap = new Map(TEACHER_SCOPE_SERVICE_OPTIONS.map((option) => [option.value, option]));
const levelMap = new Map(TEACHER_LEVEL_OPTIONS.map((option) => [option.value, option]));
const modeMap = new Map(TEACHER_MODE_OPTIONS.map((option) => [option.value, option]));
const includedTaskMap = new Map(TEACHER_TASK_INCLUDED_OPTIONS.map((option) => [option.value, option]));
const excludedTaskMap = new Map(TEACHER_TASK_EXCLUDED_OPTIONS.map((option) => [option.value, option]));

export function isTeacherScopeServiceSlug(value: string): value is TeacherScopeServiceSlug {
  return serviceMap.has(value as TeacherScopeServiceSlug);
}

export function isTeacherLevelSlug(value: string): value is TeacherLevelSlug {
  return levelMap.has(value as TeacherLevelSlug);
}

export function isTeacherModeSlug(value: string): value is TeacherModeSlug {
  return modeMap.has(value as TeacherModeSlug);
}

export function isTeacherTaskIncludedSlug(value: string): value is TeacherTaskIncludedSlug {
  return includedTaskMap.has(value as TeacherTaskIncludedSlug);
}

export function isTeacherTaskExcludedSlug(value: string): value is TeacherTaskExcludedSlug {
  return excludedTaskMap.has(value as TeacherTaskExcludedSlug);
}

export function emptyTeacherScope(): TeacherScopeData {
  return {
    services_offered: [],
    levels: [],
    modes: [],
    tasks_included: [],
    tasks_excluded: [],
    special_conditions: ""
  };
}

export function normalizeTeacherScope(value: unknown): TeacherScopeData {
  if (!value || typeof value !== "object") {
    return emptyTeacherScope();
  }

  const candidate = value as Partial<TeacherScopeData> & {
    subject?: string;
    level?: string;
    mode?: string;
  };

  const modes = Array.isArray(candidate.modes)
    ? candidate.modes.filter((item): item is TeacherModeSlug => typeof item === "string" && isTeacherModeSlug(item))
    : [];

  if (modes.length === 0 && typeof candidate.mode === "string") {
    if (candidate.mode === "ambas") {
      modes.push("presencial", "online");
    } else if (isTeacherModeSlug(candidate.mode)) {
      modes.push(candidate.mode);
    }
  }

  return {
    services_offered: Array.isArray(candidate.services_offered)
      ? candidate.services_offered.filter((item): item is TeacherScopeServiceSlug => typeof item === "string" && isTeacherScopeServiceSlug(item))
      : typeof candidate.subject === "string" && isTeacherScopeServiceSlug(candidate.subject)
        ? [candidate.subject]
        : [],
    levels: Array.isArray(candidate.levels)
      ? candidate.levels.filter((item): item is TeacherLevelSlug => typeof item === "string" && isTeacherLevelSlug(item))
      : typeof candidate.level === "string" && isTeacherLevelSlug(candidate.level)
        ? [candidate.level]
        : [],
    modes: Array.from(new Set(modes)),
    tasks_included: Array.isArray(candidate.tasks_included)
      ? candidate.tasks_included.filter((item): item is TeacherTaskIncludedSlug => typeof item === "string" && isTeacherTaskIncludedSlug(item))
      : [],
    tasks_excluded: Array.isArray(candidate.tasks_excluded)
      ? candidate.tasks_excluded.filter((item): item is TeacherTaskExcludedSlug => typeof item === "string" && isTeacherTaskExcludedSlug(item))
      : [],
    special_conditions: typeof candidate.special_conditions === "string" ? candidate.special_conditions.trim() : ""
  };
}

export function getTeacherServiceLabel(value: string) {
  return serviceMap.get(value as TeacherScopeServiceSlug)?.label ?? value;
}

export function getTeacherLevelLabel(value: string) {
  return levelMap.get(value as TeacherLevelSlug)?.label ?? value;
}

export function getTeacherModeLabel(value: string) {
  return modeMap.get(value as TeacherModeSlug)?.label ?? value;
}

export function getTeacherIncludedTaskLabel(value: string) {
  return includedTaskMap.get(value as TeacherTaskIncludedSlug)?.label ?? value;
}

export function getTeacherExcludedTaskLabel(value: string) {
  return excludedTaskMap.get(value as TeacherTaskExcludedSlug)?.label ?? value;
}

export function supportsTeacherRequestedTasks(scope: unknown, requestedTasks: string[]) {
  const normalizedScope = normalizeTeacherScope(scope);
  const normalizedRequestedTasks = requestedTasks.filter(isTeacherTaskIncludedSlug);
  if (normalizedRequestedTasks.length === 0) return true;

  const included = new Set<string>(normalizedScope.tasks_included);
  const excluded = new Set<string>(normalizedScope.tasks_excluded);

  return normalizedRequestedTasks.every((task) => included.has(task) && !excluded.has(task));
}
