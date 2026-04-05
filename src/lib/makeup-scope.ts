import {
  MAKEUP_DURATION_OPTIONS,
  MAKEUP_SERVICE_DEFINITIONS,
  getMakeupDurationLabel,
  getMakeupServiceDefinitionByScopeValue,
  isMakeupDurationMinutes,
  isMakeupScopeServiceSlug,
  type MakeupDurationMinutes,
  type MakeupScopeServiceSlug
} from "@/lib/makeup-service-types";

export const MAKEUP_SCOPE_SERVICE_OPTIONS = MAKEUP_SERVICE_DEFINITIONS.map((service) => ({
  value: service.scopeValue,
  label: service.name,
  description: service.idealFor
}));

export const MAKEUP_SPECIALTY_OPTIONS = [
  "Piel luminosa y natural",
  "Social / glam",
  "Novias y matrimonios",
  "Producción y fotos",
  "Maquillaje de noche",
  "Look editorial suave"
] as const;

export const MAKEUP_BOOKING_NOTICE_OPTIONS = [
  { value: 2, label: "2 horas" },
  { value: 4, label: "4 horas" },
  { value: 8, label: "8 horas" },
  { value: 12, label: "12 horas" },
  { value: 24, label: "24 horas" }
] as const;

export type MakeupServiceConfig = {
  service_slug: MakeupScopeServiceSlug;
  custom_label: string;
  base_price_clp: number | null;
  duration_min: MakeupDurationMinutes | null;
  includes_travel: boolean;
  includes_lashes: boolean;
  includes_trial: boolean;
  includes_materials: boolean;
};

export type MakeupScopeData = {
  services_offered: MakeupScopeServiceSlug[];
  service_configs: MakeupServiceConfig[];
  specialty: string;
  style_description: string;
  portfolio_photos: string[];
  works_at_home: boolean | null;
  booking_notice_hours: number | null;
  same_day_bookings: boolean | null;
  client_preparation: string;
};

function normalizePortfolioPhotos(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 6);
}

export function emptyMakeupServiceConfig(serviceSlug: MakeupScopeServiceSlug): MakeupServiceConfig {
  const definition = getMakeupServiceDefinitionByScopeValue(serviceSlug);
  return {
    service_slug: serviceSlug,
    custom_label: "",
    base_price_clp: definition?.recommendedMinClp ?? null,
    duration_min: definition?.defaultDurationMin ?? null,
    includes_travel: true,
    includes_lashes: false,
    includes_trial: false,
    includes_materials: true
  };
}

export function emptyMakeupScope(): MakeupScopeData {
  return {
    services_offered: [],
    service_configs: [],
    specialty: "",
    style_description: "",
    portfolio_photos: [],
    works_at_home: true,
    booking_notice_hours: 4,
    same_day_bookings: false,
    client_preparation: ""
  };
}

export function normalizeMakeupServiceConfig(value: unknown): MakeupServiceConfig | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<MakeupServiceConfig>;
  if (!candidate.service_slug || !isMakeupScopeServiceSlug(candidate.service_slug)) return null;
  return {
    service_slug: candidate.service_slug,
    custom_label: typeof candidate.custom_label === "string" ? candidate.custom_label.trim().slice(0, 80) : "",
    base_price_clp:
      typeof candidate.base_price_clp === "number" && Number.isFinite(candidate.base_price_clp) && candidate.base_price_clp >= 5000
        ? Math.round(candidate.base_price_clp)
        : null,
    duration_min:
      typeof candidate.duration_min === "number" && isMakeupDurationMinutes(candidate.duration_min) ? candidate.duration_min : null,
    includes_travel: candidate.includes_travel !== false,
    includes_lashes: candidate.includes_lashes === true,
    includes_trial: candidate.includes_trial === true,
    includes_materials: candidate.includes_materials !== false
  };
}

export function normalizeMakeupScope(value: unknown): MakeupScopeData {
  if (!value || typeof value !== "object") {
    return emptyMakeupScope();
  }

  const candidate = value as Partial<MakeupScopeData>;
  const servicesOffered = Array.isArray(candidate.services_offered)
    ? candidate.services_offered.filter((item): item is MakeupScopeServiceSlug => typeof item === "string" && isMakeupScopeServiceSlug(item))
    : [];
  const rawConfigs = Array.isArray(candidate.service_configs) ? candidate.service_configs : [];
  const configMap = new Map<MakeupScopeServiceSlug, MakeupServiceConfig>();

  for (const configValue of rawConfigs) {
    const normalized = normalizeMakeupServiceConfig(configValue);
    if (!normalized) continue;
    configMap.set(normalized.service_slug, normalized);
  }

  for (const serviceSlug of servicesOffered) {
    if (!configMap.has(serviceSlug)) {
      configMap.set(serviceSlug, emptyMakeupServiceConfig(serviceSlug));
    }
  }

  return {
    services_offered: Array.from(new Set(servicesOffered)),
    service_configs: Array.from(configMap.values()).filter((config) => servicesOffered.includes(config.service_slug)),
    specialty: typeof candidate.specialty === "string" ? candidate.specialty.trim().slice(0, 120) : "",
    style_description: typeof candidate.style_description === "string" ? candidate.style_description.trim().slice(0, 1200) : "",
    portfolio_photos: normalizePortfolioPhotos(candidate.portfolio_photos),
    works_at_home: typeof candidate.works_at_home === "boolean" ? candidate.works_at_home : true,
    booking_notice_hours:
      typeof candidate.booking_notice_hours === "number" &&
      Number.isFinite(candidate.booking_notice_hours) &&
      MAKEUP_BOOKING_NOTICE_OPTIONS.some((option) => option.value === candidate.booking_notice_hours)
        ? candidate.booking_notice_hours
        : 4,
    same_day_bookings: typeof candidate.same_day_bookings === "boolean" ? candidate.same_day_bookings : false,
    client_preparation: typeof candidate.client_preparation === "string" ? candidate.client_preparation.trim().slice(0, 600) : ""
  };
}

export function getMakeupServiceLabel(value: string) {
  return getMakeupServiceDefinitionByScopeValue(value)?.name ?? value;
}

export function getMakeupServiceConfig(scope: MakeupScopeData, serviceSlug: MakeupScopeServiceSlug) {
  return scope.service_configs.find((item) => item.service_slug === serviceSlug) ?? emptyMakeupServiceConfig(serviceSlug);
}

export function getMakeupServiceHeadline(scope: MakeupScopeData, serviceSlug: MakeupScopeServiceSlug) {
  const definition = getMakeupServiceDefinitionByScopeValue(serviceSlug);
  const config = getMakeupServiceConfig(scope, serviceSlug);
  if (serviceSlug === "otro" && config.custom_label.trim()) return config.custom_label.trim();
  return definition?.name ?? config.custom_label.trim() ?? "Servicio";
}

export function getMakeupDurationSummary(scope: MakeupScopeData, serviceSlug: MakeupScopeServiceSlug) {
  const config = getMakeupServiceConfig(scope, serviceSlug);
  return getMakeupDurationLabel(config.duration_min);
}

export function supportsMakeupRequestedTasks(scope: unknown, requestedTasks: string[]) {
  const normalizedScope = normalizeMakeupScope(scope);
  const requestedServices = requestedTasks.filter(isMakeupScopeServiceSlug);
  if (requestedServices.length === 0) return true;
  const offered = new Set(normalizedScope.services_offered);
  return requestedServices.every((service) => offered.has(service));
}

export { MAKEUP_DURATION_OPTIONS };
