import {
  BABYSITTER_AGE_RANGE_OPTIONS,
  BABYSITTER_SCOPE_SERVICE_OPTIONS,
  BABYSITTER_TASK_EXCLUDED_OPTIONS,
  BABYSITTER_TASK_INCLUDED_OPTIONS,
  emptyBabysitterScope,
  normalizeBabysitterScope,
  supportsBabysitterRequestedTasks
} from "@/lib/babysitter-scope";
import {
  CHEF_SCOPE_SERVICE_OPTIONS,
  CHEF_TASK_EXCLUDED_OPTIONS,
  CHEF_TASK_INCLUDED_OPTIONS,
  emptyChefScope,
  normalizeChefScope,
  supportsChefRequestedTasks
} from "@/lib/chef-scope";
import {
  CLEANING_SCOPE_SERVICE_OPTIONS,
  CLEANING_TASK_EXCLUDED_OPTIONS,
  CLEANING_TASK_INCLUDED_OPTIONS,
  emptyCleaningScope,
  normalizeCleaningScope,
  supportsCleaningRequestedTasks
} from "@/lib/cleaning-scope";
import { normalizeCommuneList } from "@/lib/communes";
import { CORE_SERVICES, type CoreTaskerServiceSlug } from "@/lib/core-services";
import {
  emptyIroningScope,
  IRONING_SCOPE_SERVICE_OPTIONS,
  IRONING_TASK_EXCLUDED_OPTIONS,
  IRONING_TASK_INCLUDED_OPTIONS,
  normalizeIroningScope,
  supportsIroningRequestedTasks
} from "@/lib/ironing-scope";
import {
  emptyMakeupScope,
  MAKEUP_SCOPE_SERVICE_OPTIONS,
  normalizeMakeupScope,
  supportsMakeupRequestedTasks
} from "@/lib/makeup-scope";
import {
  emptyPetScope,
  normalizePetScope,
  PET_SCOPE_ANIMAL_OPTIONS,
  PET_SCOPE_SERVICE_OPTIONS,
  PET_TASK_EXCLUDED_OPTIONS,
  PET_TASK_INCLUDED_OPTIONS,
  supportsPetRequestedTasks
} from "@/lib/pet-scope";
import {
  emptyTeacherScope,
  getTeacherPublicServiceSlugs,
  normalizeTeacherScope,
  supportsTeacherRequestedTasks,
  TEACHER_LEVEL_OPTIONS,
  TEACHER_MODE_OPTIONS,
  TEACHER_SCOPE_SERVICE_OPTIONS,
  TEACHER_TASK_EXCLUDED_OPTIONS,
  TEACHER_TASK_INCLUDED_OPTIONS
} from "@/lib/teacher-scope";
import {
  emptyTrainerScope,
  normalizeTrainerScope,
  supportsTrainerRequestedTasks,
  TRAINER_MODE_OPTIONS,
  TRAINER_SCOPE_SERVICE_OPTIONS,
  TRAINER_TASK_EXCLUDED_OPTIONS,
  TRAINER_TASK_INCLUDED_OPTIONS
} from "@/lib/trainer-scope";

export type SupportedTaskerCategorySlug = CoreTaskerServiceSlug;

type ScopeOption = {
  value: string;
  label: string;
  description?: string;
};

type CheckboxGroup = {
  key: string;
  label: string;
  options: readonly ScopeOption[];
};

type ToggleField = {
  key: string;
  label: string;
};

export type TaskerCategoryConfig = {
  slug: SupportedTaskerCategorySlug;
  label: string;
  marketplaceCategorySlug: string;
  serviceOptions: readonly ScopeOption[];
  includedTaskOptions: readonly ScopeOption[];
  excludedTaskOptions: readonly ScopeOption[];
  extraGroups?: CheckboxGroup[];
  toggleFields?: ToggleField[];
};

export type TaskerCategoryProfilePayload = {
  categorySlug: SupportedTaskerCategorySlug;
  hourlyRateClp: number;
  minBookingHours?: number;
  serviceCommunes: string[];
  scopeData: unknown;
};

export type TaskerCategoryProfileRecord = {
  id: string;
  categorySlug: string;
  hourlyRateClp: number;
  minBookingHours: number;
  serviceCommunes: string[];
  offeredServices: string[];
  experienceTypes: string[];
  scopeData: unknown;
  isActive: boolean;
  completedAt: string | Date | null;
};

const CATEGORY_CONFIGS: Record<SupportedTaskerCategorySlug, TaskerCategoryConfig> = {
  limpieza: {
    slug: "limpieza",
    label: "Limpieza",
    marketplaceCategorySlug: "limpieza",
    serviceOptions: CLEANING_SCOPE_SERVICE_OPTIONS,
    includedTaskOptions: CLEANING_TASK_INCLUDED_OPTIONS,
    excludedTaskOptions: CLEANING_TASK_EXCLUDED_OPTIONS
  },
  mascotas: {
    slug: "mascotas",
    label: "Paseo y cuidado mascotas",
    marketplaceCategorySlug: "paseo-cuidado-mascotas",
    serviceOptions: PET_SCOPE_SERVICE_OPTIONS,
    includedTaskOptions: PET_TASK_INCLUDED_OPTIONS,
    excludedTaskOptions: PET_TASK_EXCLUDED_OPTIONS,
    extraGroups: [{ key: "animals_accepted", label: "Mascotas que aceptas", options: PET_SCOPE_ANIMAL_OPTIONS }],
    toggleFields: [{ key: "accepts_large_pets", label: "Acepto mascotas grandes" }]
  },
  babysitter: {
    slug: "babysitter",
    label: "Babysitter",
    marketplaceCategorySlug: "babysitter-por-horas",
    serviceOptions: BABYSITTER_SCOPE_SERVICE_OPTIONS,
    includedTaskOptions: BABYSITTER_TASK_INCLUDED_OPTIONS,
    excludedTaskOptions: BABYSITTER_TASK_EXCLUDED_OPTIONS,
    extraGroups: [{ key: "age_ranges", label: "Rangos de edad", options: BABYSITTER_AGE_RANGE_OPTIONS }],
    toggleFields: [
      { key: "first_aid", label: "Tengo nociones de primeros auxilios" },
      { key: "multi_child", label: "Acepto más de un niño por servicio" }
    ]
  },
  "profesor-particular": {
    slug: "profesor-particular",
    label: "Clases particulares",
    marketplaceCategorySlug: "profesor-particular",
    serviceOptions: TEACHER_SCOPE_SERVICE_OPTIONS,
    includedTaskOptions: TEACHER_TASK_INCLUDED_OPTIONS,
    excludedTaskOptions: TEACHER_TASK_EXCLUDED_OPTIONS,
    extraGroups: [
      { key: "levels", label: "Niveles", options: TEACHER_LEVEL_OPTIONS },
      { key: "modes", label: "Modalidad", options: TEACHER_MODE_OPTIONS }
    ]
  },
  "personal-trainer": {
    slug: "personal-trainer",
    label: "Personal trainer",
    marketplaceCategorySlug: "personal-trainer",
    serviceOptions: TRAINER_SCOPE_SERVICE_OPTIONS,
    includedTaskOptions: TRAINER_TASK_INCLUDED_OPTIONS,
    excludedTaskOptions: TRAINER_TASK_EXCLUDED_OPTIONS,
    extraGroups: [{ key: "modes", label: "Modalidad", options: TRAINER_MODE_OPTIONS }],
    toggleFields: [{ key: "brings_equipment", label: "Llevo implementos para entrenar" }]
  },
  chef: {
    slug: "chef",
    label: "Chef",
    marketplaceCategorySlug: "chef-a-domicilio",
    serviceOptions: CHEF_SCOPE_SERVICE_OPTIONS,
    includedTaskOptions: CHEF_TASK_INCLUDED_OPTIONS,
    excludedTaskOptions: CHEF_TASK_EXCLUDED_OPTIONS
  },
  maquillaje: {
    slug: "maquillaje",
    label: "Maquillaje",
    marketplaceCategorySlug: "maquillaje-a-domicilio",
    serviceOptions: MAKEUP_SCOPE_SERVICE_OPTIONS,
    includedTaskOptions: [],
    excludedTaskOptions: [],
    toggleFields: [{ key: "works_at_home", label: "Trabajo a domicilio" }, { key: "same_day_bookings", label: "Acepto reservas el mismo día" }]
  },
  planchado: {
    slug: "planchado",
    label: "Planchado",
    marketplaceCategorySlug: "planchado",
    serviceOptions: IRONING_SCOPE_SERVICE_OPTIONS,
    includedTaskOptions: IRONING_TASK_INCLUDED_OPTIONS,
    excludedTaskOptions: IRONING_TASK_EXCLUDED_OPTIONS,
    toggleFields: [{ key: "delicate_clothes", label: "Trabajo con ropa delicada" }]
  }
};

export function normalizeTaskerCategorySlug(value: string | null | undefined) {
  switch (value) {
    case "paseo-cuidado-mascotas":
      return "mascotas";
    case "babysitter-por-horas":
      return "babysitter";
    case "chef-a-domicilio":
      return "chef";
    case "maquillaje-a-domicilio":
      return "maquillaje";
    default:
      return (value ?? null) as SupportedTaskerCategorySlug | null;
  }
}

export function getTaskerCategoryConfig(categorySlug: string | null | undefined) {
  const normalized = normalizeTaskerCategorySlug(categorySlug);
  return normalized ? CATEGORY_CONFIGS[normalized] ?? null : null;
}

export function getTaskerCategoryLabel(categorySlug: string | null | undefined) {
  return getTaskerCategoryConfig(categorySlug)?.label ?? categorySlug ?? "Servicio";
}

export function getMarketplaceCategorySlugForTaskerCategory(categorySlug: string | null | undefined) {
  return getTaskerCategoryConfig(categorySlug)?.marketplaceCategorySlug ?? categorySlug ?? null;
}

export function getCoreServiceForTaskerCategory(categorySlug: string | null | undefined) {
  const normalized = normalizeTaskerCategorySlug(categorySlug);
  if (!normalized) return null;
  return CORE_SERVICES.find((service) => service.slug === normalized) ?? null;
}

export function emptyScopeForTaskerCategory(categorySlug: string | null | undefined) {
  switch (normalizeTaskerCategorySlug(categorySlug)) {
    case "limpieza":
      return emptyCleaningScope();
    case "mascotas":
      return emptyPetScope();
    case "babysitter":
      return emptyBabysitterScope();
    case "profesor-particular":
      return emptyTeacherScope();
    case "personal-trainer":
      return emptyTrainerScope();
    case "chef":
      return emptyChefScope();
    case "maquillaje":
      return emptyMakeupScope();
    case "planchado":
      return emptyIroningScope();
    default:
      return {};
  }
}

export function normalizeScopeForTaskerCategory(categorySlug: string | null | undefined, value: unknown) {
  switch (normalizeTaskerCategorySlug(categorySlug)) {
    case "limpieza":
      return normalizeCleaningScope(value);
    case "mascotas":
      return normalizePetScope(value);
    case "babysitter":
      return normalizeBabysitterScope(value);
    case "profesor-particular":
      return normalizeTeacherScope(value);
    case "personal-trainer":
      return normalizeTrainerScope(value);
    case "chef":
      return normalizeChefScope(value);
    case "maquillaje":
      return normalizeMakeupScope(value);
    case "planchado":
      return normalizeIroningScope(value);
    default:
      return {};
  }
}

export function validateScopeForTaskerCategory(categorySlug: string | null | undefined, value: unknown) {
  const normalized = normalizeTaskerCategorySlug(categorySlug);
  const scope = normalizeScopeForTaskerCategory(normalized, value) as Record<string, unknown>;

  if (!normalized) {
    return { ok: false as const, error: "Categoría inválida", scope };
  }

  const servicesOffered = Array.isArray(scope.services_offered) ? scope.services_offered : [];
  const tasksIncluded = Array.isArray(scope.tasks_included) ? scope.tasks_included : [];

  if (servicesOffered.length === 0) {
    return { ok: false as const, error: "Selecciona al menos un servicio ofrecido", scope };
  }

  switch (normalized) {
    case "mascotas":
      if (!Array.isArray(scope.animals_accepted) || scope.animals_accepted.length === 0) {
        return { ok: false as const, error: "Selecciona al menos un tipo de mascota", scope };
      }
      if (tasksIncluded.length === 0) {
        return { ok: false as const, error: "Selecciona al menos una tarea que sí realizas", scope };
      }
      break;
    case "babysitter":
      if (!Array.isArray(scope.age_ranges) || scope.age_ranges.length === 0) {
        return { ok: false as const, error: "Selecciona al menos un rango de edad", scope };
      }
      if (tasksIncluded.length === 0) {
        return { ok: false as const, error: "Selecciona al menos una tarea que sí realizas", scope };
      }
      break;
    case "profesor-particular":
      if (Array.isArray(scope.services_offered) && scope.services_offered.includes("musica")) {
        if (!Array.isArray(scope.music_instruments) || scope.music_instruments.length === 0) {
          return { ok: false as const, error: "Selecciona al menos un tipo de clase de música", scope };
        }
      }
      if (!Array.isArray(scope.service_configs) || scope.service_configs.length === 0) {
        return { ok: false as const, error: "Configura al menos una clase con precio, nivel y modalidad", scope };
      }
      if (
        !scope.service_configs.every(
          (item) =>
            item &&
            typeof item === "object" &&
            Array.isArray((item as { levels?: unknown[] }).levels) &&
            (item as { levels?: unknown[] }).levels!.length > 0 &&
            Array.isArray((item as { modes?: unknown[] }).modes) &&
            (item as { modes?: unknown[] }).modes!.length > 0 &&
            typeof (item as { hourly_rate_clp?: unknown }).hourly_rate_clp === "number" &&
            typeof (item as { typical_duration_min?: unknown }).typical_duration_min === "number"
        )
      ) {
        return { ok: false as const, error: "Completa nivel, modalidad, precio y duración típica en cada clase", scope };
      }
      if (typeof scope.teaching_style !== "string" || scope.teaching_style.trim().length === 0) {
        return { ok: false as const, error: "Describe tu estilo de enseñanza", scope };
      }
      break;
    case "personal-trainer":
      if (!Array.isArray(scope.modes) || scope.modes.length === 0) {
        return { ok: false as const, error: "Selecciona al menos una modalidad", scope };
      }
      if (tasksIncluded.length === 0) {
        return { ok: false as const, error: "Selecciona al menos una tarea que sí realizas", scope };
      }
      break;
    case "chef":
    case "maquillaje":
    case "limpieza":
      if (tasksIncluded.length === 0) {
        return { ok: false as const, error: "Selecciona al menos una tarea que sí realizas", scope };
      }
      break;
    default:
      break;
  }

  return { ok: true as const, scope };
}

export function extractOfferedServicesForTaskerCategory(categorySlug: string | null | undefined, scopeData: unknown) {
  const scope = normalizeScopeForTaskerCategory(categorySlug, scopeData) as Record<string, unknown>;
  if (normalizeTaskerCategorySlug(categorySlug) === "profesor-particular") {
    return getTeacherPublicServiceSlugs(scope as ReturnType<typeof normalizeTeacherScope>);
  }
  return Array.isArray(scope.services_offered) ? scope.services_offered.filter((item): item is string => typeof item === "string") : [];
}

export function extractExperienceTypesForTaskerCategory(categorySlug: string | null | undefined, scopeData: unknown) {
  const scope = normalizeScopeForTaskerCategory(categorySlug, scopeData) as Record<string, unknown>;
  switch (normalizeTaskerCategorySlug(categorySlug)) {
    case "mascotas":
      return Array.isArray(scope.animals_accepted) ? scope.animals_accepted.filter((item): item is string => typeof item === "string") : [];
    case "babysitter":
      return Array.isArray(scope.age_ranges) ? scope.age_ranges.filter((item): item is string => typeof item === "string") : [];
    case "profesor-particular": {
      const normalizedScope = normalizeTeacherScope(scopeData);
      const levels = normalizedScope.levels;
      const modes = normalizedScope.modes;
      return [...levels, ...modes];
    }
    case "personal-trainer":
      return Array.isArray(scope.modes) ? scope.modes.filter((item): item is string => typeof item === "string") : [];
    default:
      return [];
  }
}

export function supportsRequestedTasksForTaskerCategory(categorySlug: string | null | undefined, scopeData: unknown, requestedTasks: string[]) {
  const normalized = normalizeTaskerCategorySlug(categorySlug);
  if (!normalized) return true;

  switch (normalized) {
    case "limpieza":
      return supportsCleaningRequestedTasks(scopeData, requestedTasks);
    case "mascotas":
      return supportsPetRequestedTasks(scopeData, requestedTasks);
    case "babysitter":
      return supportsBabysitterRequestedTasks(scopeData, requestedTasks);
    case "profesor-particular":
      return supportsTeacherRequestedTasks(scopeData, requestedTasks);
    case "personal-trainer":
      return supportsTrainerRequestedTasks(scopeData, requestedTasks);
    case "chef":
      return supportsChefRequestedTasks(scopeData, requestedTasks);
    case "maquillaje":
      return supportsMakeupRequestedTasks(scopeData, requestedTasks);
    case "planchado":
      return supportsIroningRequestedTasks(scopeData, requestedTasks);
    default:
      return true;
  }
}

export function canPublishTaskerCategoryProfile(profile: TaskerCategoryProfileRecord | null | undefined) {
  if (!profile || !profile.isActive) return false;
  if (!profile.completedAt) return false;
  if (profile.hourlyRateClp <= 0) return false;
  if (normalizeCommuneList(profile.serviceCommunes).length === 0) return false;
  return extractOfferedServicesForTaskerCategory(profile.categorySlug, profile.scopeData).length > 0;
}
