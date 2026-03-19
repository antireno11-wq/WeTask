export const PET_SCOPE_SERVICE_OPTIONS = [
  {
    value: "paseo_perros",
    label: "Paseo de perros",
    description: "Paseos individuales o compartidos, con foco en rutina, ejercicio y seguridad."
  },
  {
    value: "cuidado_casa_cliente",
    label: "Cuidado en casa del cliente",
    description: "Visitas o permanencia en el domicilio para alimentar, acompañar y cuidar a la mascota."
  },
  {
    value: "cuidado_en_tu_casa",
    label: "Cuidado en mi casa",
    description: "Recibo mascotas en mi casa según cupo, rutina y condiciones previamente acordadas."
  }
] as const;

export const PET_SCOPE_ANIMAL_OPTIONS = [
  { value: "perros", label: "Perros" },
  { value: "gatos", label: "Gatos" }
] as const;

export const PET_TASK_INCLUDED_OPTIONS = [
  { value: "paseo_diario", label: "Paseo diario" },
  { value: "alimentacion_agua", label: "Alimentación y agua" },
  { value: "juego_acompanamiento", label: "Juego y acompañamiento" },
  { value: "medicacion_oral", label: "Medicación oral" },
  { value: "limpieza_platos_comederos", label: "Limpieza básica de platos o comederos" },
  { value: "limpieza_arenero", label: "Limpieza básica de arenero" },
  { value: "fotos_actualizaciones", label: "Fotos o actualizaciones durante el cuidado" },
  { value: "rutinas_especiales", label: "Rutinas especiales indicadas por el cliente" },
  { value: "cuidado_nocturno", label: "Cuidado nocturno" },
  { value: "acompanamiento_cachorros_senior", label: "Acompañamiento de cachorros o mascotas senior" }
] as const;

export const PET_TASK_EXCLUDED_OPTIONS = [
  { value: "bano_mascotas", label: "Baño de mascotas" },
  { value: "grooming_corte_pelo", label: "Grooming o corte de pelo" },
  { value: "adiestramiento_profesional", label: "Adiestramiento profesional" },
  { value: "inyecciones", label: "Aplicación de inyecciones" },
  { value: "mascotas_agresivas", label: "Mascotas agresivas o sin control" },
  { value: "limpieza_profunda_heces_vomito", label: "Limpieza profunda de heces o vómito" },
  { value: "traslados_vehiculo", label: "Traslados en vehículo" },
  { value: "animales_exoticos", label: "Cuidado de animales exóticos" },
  { value: "atencion_veterinaria", label: "Atención veterinaria" },
  { value: "pernoctar", label: "Pernoctar con la mascota" }
] as const;

export type PetScopeServiceSlug = (typeof PET_SCOPE_SERVICE_OPTIONS)[number]["value"];
export type PetScopeAnimalSlug = (typeof PET_SCOPE_ANIMAL_OPTIONS)[number]["value"];
export type PetTaskIncludedSlug = (typeof PET_TASK_INCLUDED_OPTIONS)[number]["value"];
export type PetTaskExcludedSlug = (typeof PET_TASK_EXCLUDED_OPTIONS)[number]["value"];

export type PetScopeData = {
  services_offered: PetScopeServiceSlug[];
  animals_accepted: PetScopeAnimalSlug[];
  accepts_large_pets: boolean | null;
  tasks_included: PetTaskIncludedSlug[];
  tasks_excluded: PetTaskExcludedSlug[];
  special_conditions: string;
};

const serviceMap = new Map(PET_SCOPE_SERVICE_OPTIONS.map((option) => [option.value, option]));
const animalMap = new Map(PET_SCOPE_ANIMAL_OPTIONS.map((option) => [option.value, option]));
const includedTaskMap = new Map(PET_TASK_INCLUDED_OPTIONS.map((option) => [option.value, option]));
const excludedTaskMap = new Map(PET_TASK_EXCLUDED_OPTIONS.map((option) => [option.value, option]));

export function isPetScopeServiceSlug(value: string): value is PetScopeServiceSlug {
  return serviceMap.has(value as PetScopeServiceSlug);
}

export function isPetScopeAnimalSlug(value: string): value is PetScopeAnimalSlug {
  return animalMap.has(value as PetScopeAnimalSlug);
}

export function isPetTaskIncludedSlug(value: string): value is PetTaskIncludedSlug {
  return includedTaskMap.has(value as PetTaskIncludedSlug);
}

export function isPetTaskExcludedSlug(value: string): value is PetTaskExcludedSlug {
  return excludedTaskMap.has(value as PetTaskExcludedSlug);
}

export function emptyPetScope(): PetScopeData {
  return {
    services_offered: [],
    animals_accepted: [],
    accepts_large_pets: null,
    tasks_included: [],
    tasks_excluded: [],
    special_conditions: ""
  };
}

export function normalizePetScope(value: unknown): PetScopeData {
  if (!value || typeof value !== "object") {
    return emptyPetScope();
  }

  const candidate = value as Partial<PetScopeData>;

  return {
    services_offered: Array.isArray(candidate.services_offered)
      ? candidate.services_offered.filter((item): item is PetScopeServiceSlug => typeof item === "string" && isPetScopeServiceSlug(item))
      : [],
    animals_accepted: Array.isArray(candidate.animals_accepted)
      ? candidate.animals_accepted.filter((item): item is PetScopeAnimalSlug => typeof item === "string" && isPetScopeAnimalSlug(item))
      : [],
    accepts_large_pets: typeof candidate.accepts_large_pets === "boolean" ? candidate.accepts_large_pets : null,
    tasks_included: Array.isArray(candidate.tasks_included)
      ? candidate.tasks_included.filter((item): item is PetTaskIncludedSlug => typeof item === "string" && isPetTaskIncludedSlug(item))
      : [],
    tasks_excluded: Array.isArray(candidate.tasks_excluded)
      ? candidate.tasks_excluded.filter((item): item is PetTaskExcludedSlug => typeof item === "string" && isPetTaskExcludedSlug(item))
      : [],
    special_conditions: typeof candidate.special_conditions === "string" ? candidate.special_conditions.trim() : ""
  };
}

export function getPetScopeServiceLabel(value: string) {
  return serviceMap.get(value as PetScopeServiceSlug)?.label ?? value;
}

export function getPetScopeAnimalLabel(value: string) {
  return animalMap.get(value as PetScopeAnimalSlug)?.label ?? value;
}

export function getPetIncludedTaskLabel(value: string) {
  return includedTaskMap.get(value as PetTaskIncludedSlug)?.label ?? value;
}

export function getPetExcludedTaskLabel(value: string) {
  return excludedTaskMap.get(value as PetTaskExcludedSlug)?.label ?? value;
}

export function supportsPetRequestedTasks(scope: unknown, requestedTasks: string[]) {
  const normalizedScope = normalizePetScope(scope);
  const normalizedRequestedTasks = requestedTasks.filter(isPetTaskIncludedSlug);
  if (normalizedRequestedTasks.length === 0) return true;

  const included = new Set<string>(normalizedScope.tasks_included);
  const excluded = new Set<string>(normalizedScope.tasks_excluded);

  return normalizedRequestedTasks.every((task) => included.has(task) && !excluded.has(task));
}
