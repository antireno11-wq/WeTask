export const IRONING_SCOPE_SERVICE_OPTIONS = [
  {
    value: "casa_cliente",
    label: "En casa del cliente",
    description: "Servicio realizado directamente en el domicilio del cliente."
  },
  {
    value: "retiro_entrega",
    label: "Retiro y entrega",
    description: "Retiro de prendas y devolución coordinada según condiciones del servicio."
  }
] as const;

export const IRONING_TASK_INCLUDED_OPTIONS = [
  { value: "planchado_general", label: "Planchado general" },
  { value: "camisas_blusas", label: "Camisas y blusas" },
  { value: "pantalones_faldas", label: "Pantalones y faldas" },
  { value: "doblado_prendas", label: "Doblado y orden básico" },
  { value: "ropa_delicada", label: "Ropa delicada si se acuerda" },
  { value: "retiro_entrega_coordinada", label: "Retiro y entrega coordinada" }
] as const;

export const IRONING_TASK_EXCLUDED_OPTIONS = [
  { value: "lavado_prendas", label: "Lavado de prendas" },
  { value: "tintoreria", label: "Tintorería" },
  { value: "arreglos_costura", label: "Arreglos de costura" },
  { value: "manchas_dificiles", label: "Tratamiento de manchas difíciles" },
  { value: "prendas_muy_danadas", label: "Prendas muy dañadas o riesgosas" },
  { value: "textiles_hogar_grandes", label: "Textiles grandes como cortinas o ropa de cama pesada" }
] as const;

export type IroningScopeServiceSlug = (typeof IRONING_SCOPE_SERVICE_OPTIONS)[number]["value"];
export type IroningTaskIncludedSlug = (typeof IRONING_TASK_INCLUDED_OPTIONS)[number]["value"];
export type IroningTaskExcludedSlug = (typeof IRONING_TASK_EXCLUDED_OPTIONS)[number]["value"];

export type IroningScopeData = {
  services_offered: IroningScopeServiceSlug[];
  delicate_clothes: boolean | null;
  tasks_included: IroningTaskIncludedSlug[];
  tasks_excluded: IroningTaskExcludedSlug[];
  special_conditions: string;
};

const serviceMap = new Map(IRONING_SCOPE_SERVICE_OPTIONS.map((option) => [option.value, option]));
const includedTaskMap = new Map(IRONING_TASK_INCLUDED_OPTIONS.map((option) => [option.value, option]));
const excludedTaskMap = new Map(IRONING_TASK_EXCLUDED_OPTIONS.map((option) => [option.value, option]));

export function isIroningScopeServiceSlug(value: string): value is IroningScopeServiceSlug {
  return serviceMap.has(value as IroningScopeServiceSlug);
}

export function isIroningTaskIncludedSlug(value: string): value is IroningTaskIncludedSlug {
  return includedTaskMap.has(value as IroningTaskIncludedSlug);
}

export function isIroningTaskExcludedSlug(value: string): value is IroningTaskExcludedSlug {
  return excludedTaskMap.has(value as IroningTaskExcludedSlug);
}

export function emptyIroningScope(): IroningScopeData {
  return {
    services_offered: [],
    delicate_clothes: null,
    tasks_included: [],
    tasks_excluded: [],
    special_conditions: ""
  };
}

export function normalizeIroningScope(value: unknown): IroningScopeData {
  if (!value || typeof value !== "object") {
    return emptyIroningScope();
  }

  const candidate = value as Partial<IroningScopeData>;
  return {
    services_offered: Array.isArray(candidate.services_offered)
      ? candidate.services_offered.filter((item): item is IroningScopeServiceSlug => typeof item === "string" && isIroningScopeServiceSlug(item))
      : [],
    delicate_clothes: typeof candidate.delicate_clothes === "boolean" ? candidate.delicate_clothes : null,
    tasks_included: Array.isArray(candidate.tasks_included)
      ? candidate.tasks_included.filter((item): item is IroningTaskIncludedSlug => typeof item === "string" && isIroningTaskIncludedSlug(item))
      : [],
    tasks_excluded: Array.isArray(candidate.tasks_excluded)
      ? candidate.tasks_excluded.filter((item): item is IroningTaskExcludedSlug => typeof item === "string" && isIroningTaskExcludedSlug(item))
      : [],
    special_conditions: typeof candidate.special_conditions === "string" ? candidate.special_conditions.trim() : ""
  };
}

export function getIroningServiceLabel(value: string) {
  return serviceMap.get(value as IroningScopeServiceSlug)?.label ?? value;
}

export function getIroningIncludedTaskLabel(value: string) {
  return includedTaskMap.get(value as IroningTaskIncludedSlug)?.label ?? value;
}

export function getIroningExcludedTaskLabel(value: string) {
  return excludedTaskMap.get(value as IroningTaskExcludedSlug)?.label ?? value;
}
