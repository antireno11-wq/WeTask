export const TEACHER_SCOPE_SERVICE_OPTIONS = [
  {
    value: "matematicas",
    label: "Matemáticas",
    description: "Clases de reforzamiento, práctica y preparación para evaluaciones."
  },
  {
    value: "ingles",
    label: "Inglés",
    description: "Conversación, apoyo escolar, reforzamiento y preparación académica."
  },
  {
    value: "apoyo_escolar",
    label: "Apoyo escolar",
    description: "Acompañamiento general para tareas, estudio guiado y reforzamiento."
  },
  {
    value: "musica",
    label: "Música",
    description: "Clases particulares para aprender instrumento o canto."
  }
] as const;

export const TEACHER_MUSIC_INSTRUMENT_OPTIONS = [
  { value: "guitarra", label: "Guitarra" },
  { value: "piano", label: "Piano" },
  { value: "canto", label: "Canto" }
] as const;

export const TEACHER_GENERAL_LEVEL_OPTIONS = [
  { value: "basica", label: "Básica" },
  { value: "media", label: "Media" },
  { value: "universitaria", label: "Universitaria" },
  { value: "adultos", label: "Adultos" }
] as const;

export const TEACHER_MUSIC_LEVEL_OPTIONS = [
  { value: "principiante", label: "Principiante" },
  { value: "intermedio", label: "Intermedio" },
  { value: "avanzado", label: "Avanzado" }
] as const;

// Legacy alias kept for older imports while the category migrates.
export const TEACHER_LEVEL_OPTIONS = [...TEACHER_GENERAL_LEVEL_OPTIONS] as const;

export const TEACHER_MODE_OPTIONS = [
  { value: "presencial", label: "Presencial" },
  { value: "online", label: "Online" }
] as const;

export const TEACHER_DURATION_OPTIONS = [
  { value: 60, label: "1 hora" },
  { value: 90, label: "1.5 horas" },
  { value: 120, label: "2 horas" }
] as const;

export const TEACHER_BOOKING_NOTICE_OPTIONS = [
  { value: 0, label: "Sin anticipación mínima" },
  { value: 3, label: "3 horas" },
  { value: 6, label: "6 horas" },
  { value: 12, label: "12 horas" },
  { value: 24, label: "24 horas" }
] as const;

export const TEACHER_TASK_INCLUDED_OPTIONS = [
  { value: "matematicas", label: "Matemáticas" },
  { value: "ingles", label: "Inglés" },
  { value: "apoyo_escolar", label: "Apoyo escolar" },
  { value: "musica", label: "Música" },
  { value: "guitarra", label: "Guitarra" },
  { value: "piano", label: "Piano" },
  { value: "canto", label: "Canto" },
  { value: "presencial", label: "Presencial" },
  { value: "online", label: "Online" },
  { value: "basica", label: "Básica" },
  { value: "media", label: "Media" },
  { value: "universitaria", label: "Universitaria" },
  { value: "adultos", label: "Adultos" },
  { value: "principiante", label: "Principiante" },
  { value: "intermedio", label: "Intermedio" },
  { value: "avanzado", label: "Avanzado" }
] as const;

// Legacy-only: kept so old data and old imports do not break while the category is migrated.
export const TEACHER_TASK_EXCLUDED_OPTIONS = [
  { value: "legacy_no_realiza", label: "Sin exclusiones legacy" }
] as const;

export type TeacherScopeServiceSlug = (typeof TEACHER_SCOPE_SERVICE_OPTIONS)[number]["value"];
export type TeacherMusicInstrumentSlug = (typeof TEACHER_MUSIC_INSTRUMENT_OPTIONS)[number]["value"];
export type TeacherGeneralLevelSlug = (typeof TEACHER_GENERAL_LEVEL_OPTIONS)[number]["value"];
export type TeacherMusicLevelSlug = (typeof TEACHER_MUSIC_LEVEL_OPTIONS)[number]["value"];
export type TeacherModeSlug = (typeof TEACHER_MODE_OPTIONS)[number]["value"];
export type TeacherTaskIncludedSlug = (typeof TEACHER_TASK_INCLUDED_OPTIONS)[number]["value"];
export type TeacherTaskExcludedSlug = (typeof TEACHER_TASK_EXCLUDED_OPTIONS)[number]["value"];
export type TeacherDurationMinutes = (typeof TEACHER_DURATION_OPTIONS)[number]["value"];
export type TeacherBookingNoticeHours = (typeof TEACHER_BOOKING_NOTICE_OPTIONS)[number]["value"];
export type TeacherLevelSlug = TeacherAnyLevelSlug;

export type TeacherPublicServiceSlug =
  | Exclude<TeacherScopeServiceSlug, "musica">
  | TeacherMusicInstrumentSlug;

export type TeacherAnyLevelSlug = TeacherGeneralLevelSlug | TeacherMusicLevelSlug;

export type TeacherServiceConfig = {
  service_slug: TeacherPublicServiceSlug;
  levels: TeacherAnyLevelSlug[];
  modes: TeacherModeSlug[];
  hourly_rate_clp: number | null;
  typical_duration_min: TeacherDurationMinutes | null;
};

export type TeacherScopeData = {
  services_offered: TeacherScopeServiceSlug[];
  music_instruments: TeacherMusicInstrumentSlug[];
  service_configs: TeacherServiceConfig[];
  levels: TeacherAnyLevelSlug[];
  modes: TeacherModeSlug[];
  years_experience: number | null;
  specialty: string;
  teaching_style: string;
  education_credentials: string;
  support_materials: string[];
  works_at_home: boolean | null;
  booking_notice_hours: TeacherBookingNoticeHours;
  same_day_bookings: boolean;
  student_requirements: string;
  tasks_included: TeacherTaskIncludedSlug[];
  tasks_excluded: TeacherTaskExcludedSlug[];
  special_conditions: string;
};

const serviceMap = new Map(TEACHER_SCOPE_SERVICE_OPTIONS.map((option) => [option.value, option]));
const musicInstrumentMap = new Map(TEACHER_MUSIC_INSTRUMENT_OPTIONS.map((option) => [option.value, option]));
const generalLevelMap = new Map(TEACHER_GENERAL_LEVEL_OPTIONS.map((option) => [option.value, option]));
const musicLevelMap = new Map(TEACHER_MUSIC_LEVEL_OPTIONS.map((option) => [option.value, option]));
const modeMap = new Map(TEACHER_MODE_OPTIONS.map((option) => [option.value, option]));
const includedTaskMap = new Map(TEACHER_TASK_INCLUDED_OPTIONS.map((option) => [option.value, option]));
const excludedTaskMap = new Map(TEACHER_TASK_EXCLUDED_OPTIONS.map((option) => [option.value, option]));

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function clampText(value: unknown, max = 1200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeLegacyTeacherService(value: string): TeacherScopeServiceSlug | null {
  switch (value) {
    case "matematicas":
    case "ingles":
      return value;
    case "apoyo_escolar":
    case "lenguaje":
    case "ciencias":
    case "otra":
      return "apoyo_escolar";
    case "musica":
      return "musica";
    default:
      return null;
  }
}

export function isTeacherScopeServiceSlug(value: string): value is TeacherScopeServiceSlug {
  return serviceMap.has(value as TeacherScopeServiceSlug);
}

export function isTeacherMusicInstrumentSlug(value: string): value is TeacherMusicInstrumentSlug {
  return musicInstrumentMap.has(value as TeacherMusicInstrumentSlug);
}

export function isTeacherGeneralLevelSlug(value: string): value is TeacherGeneralLevelSlug {
  return generalLevelMap.has(value as TeacherGeneralLevelSlug);
}

export function isTeacherMusicLevelSlug(value: string): value is TeacherMusicLevelSlug {
  return musicLevelMap.has(value as TeacherMusicLevelSlug);
}

export function isTeacherLevelSlug(value: string): value is TeacherAnyLevelSlug {
  return isTeacherGeneralLevelSlug(value) || isTeacherMusicLevelSlug(value);
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

export function isTeacherDurationMinutes(value: number): value is TeacherDurationMinutes {
  return TEACHER_DURATION_OPTIONS.some((option) => option.value === value);
}

export function isTeacherBookingNoticeHours(value: number): value is TeacherBookingNoticeHours {
  return TEACHER_BOOKING_NOTICE_OPTIONS.some((option) => option.value === value);
}

export function isTeacherPublicServiceSlug(value: string): value is TeacherPublicServiceSlug {
  return value === "matematicas" || value === "ingles" || value === "apoyo_escolar" || isTeacherMusicInstrumentSlug(value);
}

export function isTeacherMusicServiceSlug(value: string) {
  return isTeacherMusicInstrumentSlug(value);
}

export function getTeacherPublicServiceSlugs(scope: TeacherScopeData): TeacherPublicServiceSlug[] {
  const fromMain = scope.services_offered.filter((item): item is Exclude<TeacherScopeServiceSlug, "musica"> => item !== "musica");
  const fromMusic = scope.services_offered.includes("musica") ? scope.music_instruments : [];
  const fromConfigs = scope.service_configs.map((config) => config.service_slug);
  return unique([...fromMain, ...fromMusic, ...fromConfigs]).filter(isTeacherPublicServiceSlug);
}

export function getTeacherLevelOptionsForService(serviceSlug: TeacherPublicServiceSlug) {
  return isTeacherMusicInstrumentSlug(serviceSlug) ? TEACHER_MUSIC_LEVEL_OPTIONS : TEACHER_GENERAL_LEVEL_OPTIONS;
}

export function getTeacherDurationLabel(value: number | null | undefined) {
  if (typeof value !== "number") return "Por definir";
  return TEACHER_DURATION_OPTIONS.find((option) => option.value === value)?.label ?? `${value} min`;
}

export function getTeacherBookingNoticeLabel(value: number | null | undefined) {
  if (typeof value !== "number") return "Por definir";
  return TEACHER_BOOKING_NOTICE_OPTIONS.find((option) => option.value === value)?.label ?? `${value} horas`;
}

export function getTeacherServiceLabel(value: string) {
  if (isTeacherMusicInstrumentSlug(value)) {
    return musicInstrumentMap.get(value)?.label ?? value;
  }
  return serviceMap.get(value as TeacherScopeServiceSlug)?.label ?? value;
}

export function getTeacherMusicInstrumentLabel(value: string) {
  return musicInstrumentMap.get(value as TeacherMusicInstrumentSlug)?.label ?? value;
}

export function getTeacherLevelLabel(value: string) {
  return generalLevelMap.get(value as TeacherGeneralLevelSlug)?.label ?? musicLevelMap.get(value as TeacherMusicLevelSlug)?.label ?? value;
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

export function createTeacherServiceConfig(serviceSlug: TeacherPublicServiceSlug): TeacherServiceConfig {
  return {
    service_slug: serviceSlug,
    levels: [],
    modes: [],
    hourly_rate_clp: null,
    typical_duration_min: 60
  };
}

export function syncTeacherServiceConfigs(configs: unknown, servicesOffered: TeacherScopeServiceSlug[], musicInstruments: TeacherMusicInstrumentSlug[]) {
  const requestedServices = unique([
    ...servicesOffered.filter((item): item is Exclude<TeacherScopeServiceSlug, "musica"> => item !== "musica"),
    ...(servicesOffered.includes("musica") ? musicInstruments : [])
  ]).filter(isTeacherPublicServiceSlug);

  const existing = Array.isArray(configs) ? configs : [];

  return requestedServices.map((serviceSlug) => {
    const current = existing.find((item) => {
      if (!item || typeof item !== "object") return false;
      return (item as { service_slug?: string }).service_slug === serviceSlug;
    }) as Partial<TeacherServiceConfig> | undefined;

    const allowedLevelValues = new Set(getTeacherLevelOptionsForService(serviceSlug).map((option) => option.value));
    const normalizedLevels = Array.isArray(current?.levels)
      ? current.levels.filter((item): item is TeacherAnyLevelSlug => typeof item === "string" && allowedLevelValues.has(item))
      : [];
    const normalizedModes = Array.isArray(current?.modes)
      ? current.modes.filter((item): item is TeacherModeSlug => typeof item === "string" && isTeacherModeSlug(item))
      : [];
    const duration = numberOrNull(current?.typical_duration_min);

    return {
      service_slug: serviceSlug,
      levels: unique(normalizedLevels),
      modes: unique(normalizedModes),
      hourly_rate_clp: numberOrNull(current?.hourly_rate_clp),
      typical_duration_min: duration && isTeacherDurationMinutes(duration) ? duration : 60
    };
  });
}

export function emptyTeacherScope(): TeacherScopeData {
  return {
    services_offered: [],
    music_instruments: [],
    service_configs: [],
    levels: [],
    modes: [],
    years_experience: null,
    specialty: "",
    teaching_style: "",
    education_credentials: "",
    support_materials: [],
    works_at_home: null,
    booking_notice_hours: 12,
    same_day_bookings: false,
    student_requirements: "",
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
    services?: unknown;
    yearsExperience?: unknown;
    studies?: unknown;
    description?: unknown;
    style_description?: unknown;
    student_needs?: unknown;
  };

  const legacyServices = Array.isArray(candidate.services_offered)
    ? candidate.services_offered
    : Array.isArray(candidate.services)
      ? candidate.services
      : typeof candidate.subject === "string"
        ? [candidate.subject]
        : [];

  const services_offered = unique(
    legacyServices
      .filter((item): item is string => typeof item === "string")
      .map((item) => normalizeLegacyTeacherService(item))
      .filter((item): item is TeacherScopeServiceSlug => Boolean(item))
  );

  const music_instruments = unique(
    Array.isArray(candidate.music_instruments)
      ? candidate.music_instruments.filter((item): item is TeacherMusicInstrumentSlug => typeof item === "string" && isTeacherMusicInstrumentSlug(item))
      : []
  );

  const rawModes = Array.isArray(candidate.modes)
    ? candidate.modes
    : typeof candidate.mode === "string"
      ? [candidate.mode]
      : [];
  const modes = unique(
    rawModes.flatMap((item) => {
      if (item === "ambas") return ["presencial", "online"] satisfies TeacherModeSlug[];
      return typeof item === "string" && isTeacherModeSlug(item) ? [item] : [];
    })
  );

  const rawLevels = Array.isArray(candidate.levels)
    ? candidate.levels
    : typeof candidate.level === "string"
      ? [candidate.level]
      : [];
  const levels = unique(rawLevels.filter((item): item is TeacherAnyLevelSlug => typeof item === "string" && isTeacherLevelSlug(item)));

  const service_configs = syncTeacherServiceConfigs(candidate.service_configs, services_offered, music_instruments);

  const derivedLevels = unique(service_configs.flatMap((item) => item.levels));
  const derivedModes = unique(service_configs.flatMap((item) => item.modes));

  const bookingNoticeCandidate = numberOrNull(candidate.booking_notice_hours);

  return {
    services_offered,
    music_instruments,
    service_configs,
    levels: derivedLevels.length > 0 ? derivedLevels : levels,
    modes: derivedModes.length > 0 ? derivedModes : modes,
    years_experience: numberOrNull(candidate.years_experience ?? candidate.yearsExperience),
    specialty: clampText(candidate.specialty, 120),
    teaching_style: clampText(candidate.teaching_style ?? candidate.description ?? candidate.style_description, 1200),
    education_credentials: clampText(candidate.education_credentials ?? candidate.studies, 1200),
    support_materials: Array.isArray(candidate.support_materials)
      ? candidate.support_materials.filter((item): item is string => typeof item === "string" && item.startsWith("data:"))
      : [],
    works_at_home: typeof candidate.works_at_home === "boolean" ? candidate.works_at_home : null,
    booking_notice_hours:
      bookingNoticeCandidate != null && isTeacherBookingNoticeHours(bookingNoticeCandidate) ? bookingNoticeCandidate : 12,
    same_day_bookings: Boolean(candidate.same_day_bookings),
    student_requirements: clampText(candidate.student_requirements ?? candidate.student_needs, 600),
    tasks_included: Array.isArray(candidate.tasks_included)
      ? candidate.tasks_included.filter((item): item is TeacherTaskIncludedSlug => typeof item === "string" && isTeacherTaskIncludedSlug(item))
      : [],
    tasks_excluded: Array.isArray(candidate.tasks_excluded)
      ? candidate.tasks_excluded.filter((item): item is TeacherTaskExcludedSlug => typeof item === "string" && isTeacherTaskExcludedSlug(item))
      : [],
    special_conditions: clampText(candidate.special_conditions, 600)
  };
}

export function matchesTeacherFilters(
  scope: unknown,
  filters: {
    subject?: string | null;
    musicType?: string | null;
    mode?: string | null;
    level?: string | null;
  }
) {
  const normalizedScope = normalizeTeacherScope(scope);
  const publicServices = getTeacherPublicServiceSlugs(normalizedScope);

  if (filters.subject) {
    if (filters.subject === "musica") {
      if (!normalizedScope.services_offered.includes("musica")) return false;
    } else if (!publicServices.includes(filters.subject as TeacherPublicServiceSlug)) {
      return false;
    }
  }

  if (filters.musicType && !publicServices.includes(filters.musicType as TeacherPublicServiceSlug)) {
    return false;
  }

  if (!filters.level && !filters.mode) return true;

  const relevantConfigs = normalizedScope.service_configs.filter((config) => {
    if (filters.musicType) return config.service_slug === filters.musicType;
    if (filters.subject === "musica") return isTeacherMusicInstrumentSlug(config.service_slug);
    if (filters.subject && isTeacherPublicServiceSlug(filters.subject)) return config.service_slug === filters.subject;
    return true;
  });

  if (relevantConfigs.length === 0) {
    if (filters.level && !normalizedScope.levels.includes(filters.level as TeacherAnyLevelSlug)) return false;
    if (filters.mode && !normalizedScope.modes.includes(filters.mode as TeacherModeSlug)) return false;
    return true;
  }

  return relevantConfigs.some((config) => {
    const matchesLevel = !filters.level || config.levels.includes(filters.level as TeacherAnyLevelSlug);
    const matchesMode = !filters.mode || config.modes.includes(filters.mode as TeacherModeSlug);
    return matchesLevel && matchesMode;
  });
}

export function supportsTeacherRequestedTasks(scope: unknown, requestedTasks: string[]) {
  if (requestedTasks.length === 0) return true;
  const normalizedScope = normalizeTeacherScope(scope);
  const services = new Set(getTeacherPublicServiceSlugs(normalizedScope));
  const levels = new Set(normalizedScope.levels);
  const modes = new Set(normalizedScope.modes);

  return requestedTasks.every((task) => services.has(task as TeacherPublicServiceSlug) || levels.has(task as TeacherAnyLevelSlug) || modes.has(task as TeacherModeSlug));
}
