export const MAKEUP_SCOPE_SERVICE_OPTIONS = [
  {
    value: "social",
    label: "Social",
    description: "Maquillaje para reuniones, cenas, salidas y ocasiones especiales."
  },
  {
    value: "eventos",
    label: "Eventos",
    description: "Maquillaje pensado para fiestas, graduaciones, celebraciones y producciones."
  },
  {
    value: "novias",
    label: "Novias",
    description: "Servicio para novia con preparación más detallada y foco en larga duración."
  }
] as const;

export const MAKEUP_TASK_INCLUDED_OPTIONS = [
  { value: "preparacion_piel", label: "Preparación de la piel" },
  { value: "maquillaje_completo", label: "Maquillaje completo" },
  { value: "retoques_basicos", label: "Retoques básicos si se acuerdan" },
  { value: "pestanas_postizas", label: "Aplicación de pestañas postizas" },
  { value: "prueba_maquillaje", label: "Prueba previa para novias o eventos" },
  { value: "traslado_domicilio", label: "Atención a domicilio" },
  { value: "uso_kit_propio", label: "Uso de kit propio" }
] as const;

export const MAKEUP_TASK_EXCLUDED_OPTIONS = [
  { value: "peinado", label: "Peinado" },
  { value: "manicure", label: "Manicure o uñas" },
  { value: "maquillaje_fx", label: "Maquillaje FX o artístico especializado" },
  { value: "grupos_grandes", label: "Grupos grandes si no se acuerda antes" },
  { value: "produccion_editorial", label: "Producción editorial completa" },
  { value: "kit_regalo_cliente", label: "Entrega de productos o kit al cliente" }
] as const;

export type MakeupScopeServiceSlug = (typeof MAKEUP_SCOPE_SERVICE_OPTIONS)[number]["value"];
export type MakeupTaskIncludedSlug = (typeof MAKEUP_TASK_INCLUDED_OPTIONS)[number]["value"];
export type MakeupTaskExcludedSlug = (typeof MAKEUP_TASK_EXCLUDED_OPTIONS)[number]["value"];

export type MakeupScopeData = {
  services_offered: MakeupScopeServiceSlug[];
  includes_kit: boolean | null;
  tasks_included: MakeupTaskIncludedSlug[];
  tasks_excluded: MakeupTaskExcludedSlug[];
  special_conditions: string;
};

const serviceMap = new Map(MAKEUP_SCOPE_SERVICE_OPTIONS.map((option) => [option.value, option]));
const includedTaskMap = new Map(MAKEUP_TASK_INCLUDED_OPTIONS.map((option) => [option.value, option]));
const excludedTaskMap = new Map(MAKEUP_TASK_EXCLUDED_OPTIONS.map((option) => [option.value, option]));

export function isMakeupScopeServiceSlug(value: string): value is MakeupScopeServiceSlug {
  return serviceMap.has(value as MakeupScopeServiceSlug);
}

export function isMakeupTaskIncludedSlug(value: string): value is MakeupTaskIncludedSlug {
  return includedTaskMap.has(value as MakeupTaskIncludedSlug);
}

export function isMakeupTaskExcludedSlug(value: string): value is MakeupTaskExcludedSlug {
  return excludedTaskMap.has(value as MakeupTaskExcludedSlug);
}

export function emptyMakeupScope(): MakeupScopeData {
  return {
    services_offered: [],
    includes_kit: null,
    tasks_included: [],
    tasks_excluded: [],
    special_conditions: ""
  };
}

export function normalizeMakeupScope(value: unknown): MakeupScopeData {
  if (!value || typeof value !== "object") {
    return emptyMakeupScope();
  }

  const candidate = value as Partial<MakeupScopeData>;
  return {
    services_offered: Array.isArray(candidate.services_offered)
      ? candidate.services_offered.filter((item): item is MakeupScopeServiceSlug => typeof item === "string" && isMakeupScopeServiceSlug(item))
      : [],
    includes_kit: typeof candidate.includes_kit === "boolean" ? candidate.includes_kit : null,
    tasks_included: Array.isArray(candidate.tasks_included)
      ? candidate.tasks_included.filter((item): item is MakeupTaskIncludedSlug => typeof item === "string" && isMakeupTaskIncludedSlug(item))
      : [],
    tasks_excluded: Array.isArray(candidate.tasks_excluded)
      ? candidate.tasks_excluded.filter((item): item is MakeupTaskExcludedSlug => typeof item === "string" && isMakeupTaskExcludedSlug(item))
      : [],
    special_conditions: typeof candidate.special_conditions === "string" ? candidate.special_conditions.trim() : ""
  };
}

export function getMakeupServiceLabel(value: string) {
  return serviceMap.get(value as MakeupScopeServiceSlug)?.label ?? value;
}

export function getMakeupIncludedTaskLabel(value: string) {
  return includedTaskMap.get(value as MakeupTaskIncludedSlug)?.label ?? value;
}

export function getMakeupExcludedTaskLabel(value: string) {
  return excludedTaskMap.get(value as MakeupTaskExcludedSlug)?.label ?? value;
}

export function supportsMakeupRequestedTasks(scope: unknown, requestedTasks: string[]) {
  const normalizedScope = normalizeMakeupScope(scope);
  const normalizedRequestedTasks = requestedTasks.filter(isMakeupTaskIncludedSlug);
  if (normalizedRequestedTasks.length === 0) return true;

  const included = new Set<string>(normalizedScope.tasks_included);
  const excluded = new Set<string>(normalizedScope.tasks_excluded);

  return normalizedRequestedTasks.every((task) => included.has(task) && !excluded.has(task));
}
