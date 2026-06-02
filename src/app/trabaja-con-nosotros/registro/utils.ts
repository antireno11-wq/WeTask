import type { ChefServiceDefinition } from "@/lib/chef-service-types";
import { CHEF_SERVICE_DEFINITIONS, isChefServiceSlug } from "@/lib/chef-service-types";
import type { CleaningServiceDefinition, CleaningServiceSlug } from "@/lib/cleaning-service-types";
import { ACTIVE_CLEANING_SERVICE_SLUGS, CLEANING_SERVICE_DEFINITIONS, isActiveCleaningServiceSlug, isCleaningServiceSlug } from "@/lib/cleaning-service-types";
import type { CleaningScopeData } from "@/lib/cleaning-scope";
import type { MakeupScopeData } from "@/lib/makeup-scope";
import type { PetScopeServiceSlug } from "@/lib/pet-scope";
import { isPetScopeServiceSlug } from "@/lib/pet-scope";
import { CATEGORY_OPTIONS, CHILE_MOBILE_PREFIX, DAY_OPTIONS, UPLOAD_KINDS } from "./constants";
import type { AvailabilityBlock, CategorySlug, DayKey, DraftState, UploadKind } from "./types";

export function currentWeekDayKey(): DayKey {
  const jsDay = new Date().getDay();
  const map: DayKey[] = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  return map[jsDay] ?? "lunes";
}

export function normalizeChileanMobileInput(rawValue: string) {
  const digits = rawValue.replace(/\D/g, "");
  let localDigits = digits;

  if (localDigits.startsWith("56")) {
    localDigits = localDigits.slice(2);
  }
  if (localDigits.startsWith("9")) {
    localDigits = localDigits.slice(1);
  }

  return `${CHILE_MOBILE_PREFIX}${localDigits.slice(0, 8)}`;
}

export function isValidChileanMobilePhone(value: string) {
  return /^\+569\d{8}$/.test(normalizeChileanMobileInput(value));
}

export function formatRutInput(rawRut: string) {
  const clean = rawRut.replace(/[^0-9kK]/g, "").toUpperCase().slice(0, 9);
  if (!clean) return "";
  if (clean.length === 1) return clean;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formattedBody}-${dv}`;
}

export function extractRutBody(rawRut: string) {
  const clean = rawRut.replace(/[^0-9kK]/g, "").toUpperCase();
  return clean.length > 1 ? clean.slice(0, -1) : "";
}

export function formatClp(value: number) {
  return new Intl.NumberFormat("es-CL").format(value);
}

export function getPricingGuide(draft: DraftState) {
  const baseByCategory: Record<CategorySlug, { min: number; max: number; note: string }> = {
    limpieza: { min: 12000, max: 16000, note: "Referencia habitual para limpieza estándar en comunas del MVP." },
    mascotas: { min: 10000, max: 14000, note: "Útil para paseos, visitas y cuidado básico por hora." },
    babysitter: { min: 12000, max: 18000, note: "Suele variar según experiencia, cantidad de niños y horario." },
    "profesor-particular": { min: 15000, max: 25000, note: "Las clases especializadas y universitarias suelen cobrar más." },
    "personal-trainer": { min: 18000, max: 30000, note: "Depende del tipo de entrenamiento, modalidad e implementos." },
    chef: { min: 18000, max: 42000, note: "Varía según el tipo de cocina, la cantidad de personas y la complejidad del servicio." },
    maquillaje: { min: 18000, max: 30000, note: "Novias y eventos suelen estar en el tramo alto." },
    planchado: { min: 10000, max: 14000, note: "Se recomienda cobrar por hora según volumen y delicadeza." }
  };

  const base = baseByCategory[draft.category];
  let min = base.min;
  let max = base.max;
  const extras: string[] = [];

  if (draft.category === "limpieza") {
    min = Math.min(...CLEANING_SERVICE_DEFINITIONS.map((service) => service.recommendedMinClp));
    max = Math.max(...CLEANING_SERVICE_DEFINITIONS.map((service) => service.recommendedMaxClp));
    extras.push("En limpieza puedes definir una tarifa distinta por hora para cada tipo de servicio que ofrezcas.");
    if (draft.cleaningBringsProducts) extras.push("Si incluyes productos, normalmente puedes cobrar un poco más en todos tus tipos de limpieza.");
    if (draft.cleaningBringsEquipment) extras.push("Si llevas aspiradora o equipo propio, también puedes posicionarte en el tramo alto.");
  }

  if (draft.category === "maquillaje" && draft.makeupKit) {
    min += 3000;
    max += 5000;
    extras.push("Si incluyes tu kit de maquillaje, conviene cobrar un extra por hora.");
  }

  if (draft.category === "personal-trainer" && draft.trainerBringsEquipment) {
    min += 3000;
    max += 5000;
    extras.push("Si llevas implementos o equipamiento, puedes posicionarte en la parte alta del rango.");
  }

  if (draft.category === "chef") {
    const chefDefinitions = selectedChefServiceDefinitions(draft);
    if (chefDefinitions.length > 0) {
      min = Math.min(...chefDefinitions.map((service) => service.recommendedMinClp));
      max = Math.max(...chefDefinitions.map((service) => service.recommendedMaxClp));
      extras.push("En Chef a domicilio defines un precio por servicio dentro del rango permitido por WeTask.");
    }
  }

  return {
    title: CATEGORY_OPTIONS.find((option) => option.slug === draft.category)?.label ?? "Servicio",
    min,
    max,
    note: base.note,
    extras
  };
}

export function normalizeCleaningServiceSlugs(value: unknown): CleaningServiceSlug[] {
  if (Array.isArray(value)) {
    const items = value.filter(
      (item): item is CleaningServiceSlug =>
        typeof item === "string" && isCleaningServiceSlug(item) && isActiveCleaningServiceSlug(item)
    );
    return items.length > 0 ? Array.from(new Set(items)) : [...ACTIVE_CLEANING_SERVICE_SLUGS];
  }
  if (typeof value === "string" && isCleaningServiceSlug(value) && isActiveCleaningServiceSlug(value)) {
    return [value];
  }
  return [...ACTIVE_CLEANING_SERVICE_SLUGS];
}

export function selectedCleaningServiceDefinitions(draft: DraftState): CleaningServiceDefinition[] {
  return CLEANING_SERVICE_DEFINITIONS.filter((service) => draft.cleaningServices.includes(service.slug));
}

export function deriveCleaningServicesFromScope(scope: CleaningScopeData): CleaningServiceSlug[] {
  const derived = scope.services_offered.filter(isCleaningServiceSlug);
  return derived.length > 0 ? Array.from(new Set(derived)) : [...ACTIVE_CLEANING_SERVICE_SLUGS];
}

export function selectedChefServiceDefinitions(draft: DraftState): ChefServiceDefinition[] {
  return CHEF_SERVICE_DEFINITIONS.filter((service) => draft.chefServiceType.includes(service.slug));
}

export function normalizeMakeupTypes(value: unknown): MakeupScopeData["services_offered"] {
  const legacyMap: Record<string, MakeupScopeData["services_offered"][number]> = {
    social: "social_evento",
    eventos: "fiesta",
    novias: "novia",
    natural: "natural",
    social_evento: "social_evento",
    noche: "noche",
    fiesta: "fiesta",
    novia: "novia",
    produccion_fotos: "produccion_fotos",
    otro: "otro"
  };

  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return Array.from(
    new Set(
      values
        .filter((item): item is string => typeof item === "string")
        .map((item) => legacyMap[item])
        .filter((item): item is MakeupScopeData["services_offered"][number] => Boolean(item))
    )
  );
}

export function normalizeChefServiceTypes(value: unknown) {
  if (Array.isArray(value)) {
    const items = value.filter((item): item is ReturnType<typeof isChefServiceSlug> extends true ? string : never =>
      typeof item === "string" && isChefServiceSlug(item)
    );
    return items.length > 0 ? Array.from(new Set(items)) : [];
  }
  if (typeof value === "string" && isChefServiceSlug(value)) {
    return [value];
  }
  return [];
}

export function normalizePetServiceTypes(value: unknown): PetScopeServiceSlug[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is PetScopeServiceSlug => typeof item === "string" && isPetScopeServiceSlug(item));
  }
  if (typeof value === "string" && isPetScopeServiceSlug(value)) {
    return [value];
  }
  return [];
}

export function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" ")
  };
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

export async function uploadAssetViaPresign(input: {
  source: File | { dataUrl: string; contentType: string };
  kind: UploadKind;
}): Promise<string | null> {
  let blob: Blob;
  let contentType: string;
  let sizeBytes: number;

  if (input.source instanceof File) {
    blob = input.source;
    contentType = input.source.type || "application/octet-stream";
    sizeBytes = input.source.size;
  } else {
    const match = input.source.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error("Data URL inválido para subir");
    contentType = match[1] || input.source.contentType;
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    blob = new Blob([bytes], { type: contentType });
    sizeBytes = blob.size;
  }

  const presignResponse = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: input.kind, contentType, sizeBytes })
  });

  if (presignResponse.status === 503) {
    return null;
  }

  if (!presignResponse.ok) {
    const detail = await presignResponse.json().catch(() => ({}));
    throw new Error(detail?.error || `No se pudo preparar la carga (${presignResponse.status})`);
  }

  const { uploadUrl, key } = (await presignResponse.json()) as { uploadUrl: string; key: string };

  const putResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob
  });

  if (!putResponse.ok) {
    throw new Error(`El archivo no se pudo subir al almacenamiento (${putResponse.status})`);
  }

  return key;
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo procesar la foto"));
    image.src = src;
  });
}

export async function createCenteredProfilePhoto(dataUrl: string, focusX: number, focusY: number) {
  if (!dataUrl) return dataUrl;
  const image = await loadImageElement(dataUrl);
  const size = 720;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return dataUrl;

  const scale = Math.max(size / image.width, size / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const normalizedX = Math.min(100, Math.max(0, focusX));
  const normalizedY = Math.min(100, Math.max(0, focusY));
  const offsetX = (size - drawWidth) * (normalizedX / 100);
  const offsetY = (size - drawHeight) * (normalizedY / 100);

  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  return canvas.toDataURL("image/jpeg", 0.92);
}

export function normalizeRut(rawRut: string) {
  return rawRut.replace(/\./g, "").replace(/-/g, "").toUpperCase();
}

export function isValidRut(rawRut: string) {
  const clean = normalizeRut(rawRut);
  if (!/^\d{7,8}[0-9K]$/.test(clean)) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  let sum = 0;
  let multiplier = 2;

  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  const expected = remainder === 11 ? "0" : remainder === 10 ? "K" : String(remainder);
  return dv === expected;
}

export function toAvailabilityBlocks(value: unknown): AvailabilityBlock[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as { day?: string; start?: string; end?: string };
      if (!candidate.day || !candidate.start || !candidate.end) return null;
      if (!DAY_OPTIONS.some((day) => day.key === candidate.day)) return null;
      return {
        day: candidate.day as DayKey,
        start: candidate.start,
        end: candidate.end
      };
    })
    .filter(Boolean) as AvailabilityBlock[];
}

export function buildStep7Payload(draft: DraftState) {
  switch (draft.category) {
    case "limpieza":
      return {
        offeredServices: draft.cleaningServices,
        experienceTypes: draft.cleaningServices,
        cleaningScope: draft.cleaningScope,
        worksWithClientProducts: false,
        bringsOwnProducts: draft.cleaningBringsProducts,
        bringsOwnTools: draft.cleaningBringsEquipment
      };
    case "mascotas":
      return {
        offeredServices: draft.petServiceType,
        experienceTypes: draft.petAnimals,
        petScope: {
          ...draft.petScope,
          services_offered: draft.petServiceType,
          animals_accepted: draft.petAnimals,
          accepts_large_pets: draft.petLargePets
        },
        acceptsHomesWithPets: draft.petLargePets
      };
    case "babysitter":
      return {
        offeredServices: draft.babysitterScope.services_offered,
        experienceTypes: draft.babysitterScope.age_ranges,
        babysitterScope: {
          ...draft.babysitterScope,
          age_ranges: draft.babysitterScope.age_ranges,
          first_aid: draft.babysitterFirstAid,
          multi_child: draft.babysitterMultiChild
        },
        bringsOwnTools: draft.babysitterFirstAid,
        acceptsHomesWithChildren: draft.babysitterMultiChild
      };
    case "profesor-particular":
      return {
        offeredServices: draft.teacherScope.services_offered,
        experienceTypes: [...draft.teacherScope.levels, ...draft.teacherScope.modes],
        teacherScope: { ...draft.teacherScope }
      };
    case "personal-trainer":
      return {
        offeredServices: draft.trainerScope.services_offered,
        experienceTypes: draft.trainerScope.modes,
        trainerScope: {
          ...draft.trainerScope,
          brings_equipment: draft.trainerBringsEquipment
        },
        bringsOwnTools: draft.trainerBringsEquipment
      };
    case "chef":
      return {
        offeredServices: draft.chefScope.services_offered,
        experienceTypes: draft.chefScope.services_offered,
        chefScope: { ...draft.chefScope },
        worksWithClientProducts: true
      };
    case "maquillaje":
      return {
        offeredServices: draft.makeupScope.services_offered,
        makeupScope: {
          ...draft.makeupScope,
          includes_kit: draft.makeupKit
        },
        bringsOwnProducts: draft.makeupKit,
        worksWithClientProducts: true
      };
    case "planchado":
      return {
        offeredServices: draft.ironingScope.services_offered,
        experienceTypes: ["por_hora"],
        ironingScope: {
          ...draft.ironingScope,
          delicate_clothes: draft.ironingDelicate
        },
        bringsOwnTools: draft.ironingDelicate
      };
    default:
      return { offeredServices: ["limpieza_general"] };
  }
}
