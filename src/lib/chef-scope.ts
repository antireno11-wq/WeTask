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

export const CHEF_TASK_INCLUDED_OPTIONS = [] as const;
export const CHEF_TASK_EXCLUDED_OPTIONS = [] as const;

export type ChefTaskIncludedSlug = never;
export type ChefTaskExcludedSlug = never;

export type ChefScopeData = {
  services_offered: ChefServiceSlug[];
  tasks_included: ChefTaskIncludedSlug[];
  tasks_excluded: ChefTaskExcludedSlug[];
  special_conditions: string;
};

const serviceMap = new Map(CHEF_SCOPE_SERVICE_OPTIONS.map((option) => [option.value, option]));

export function isChefScopeServiceSlug(value: string): value is ChefServiceSlug {
  return serviceMap.has(value as ChefServiceSlug);
}

export function isChefTaskIncludedSlug(_: string): _ is ChefTaskIncludedSlug {
  return false;
}

export function isChefTaskExcludedSlug(_: string): _ is ChefTaskExcludedSlug {
  return false;
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
    tasks_included: [],
    tasks_excluded: [],
    special_conditions: typeof candidate.special_conditions === "string" ? candidate.special_conditions.trim() : ""
  };
}

export function getChefScopeServiceLabel(value: string) {
  return serviceMap.get(value as ChefServiceSlug)?.label ?? value;
}

export function getChefIncludedTaskLabel(value: string) {
  return value;
}

export function getChefExcludedTaskLabel(value: string) {
  return value;
}

export function supportsChefRequestedTasks(_: unknown, __: string[]) {
  return true;
}
