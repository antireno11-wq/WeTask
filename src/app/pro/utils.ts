import { type CoreTaskerServiceSlug } from "@/lib/core-services";
import type { AvailabilityBlock, DayKey } from "./types";

export const statusOptions = ["ACCEPTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
export const CHILE_CITIES = [
  "Santiago",
  "Valparaiso",
  "Vina del Mar",
  "Concepcion",
  "La Serena",
  "Antofagasta",
  "Temuco",
  "Puerto Montt"
];
export const TASKER_WIZARD_STORAGE_KEY = "wetask_tasker_wizard_v2";

export const PRO_STATUS_LABELS: Record<string, string> = {
  ACCEPTED: "Aceptado",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
  CONFIRMED: "Confirmado",
  ASSIGNED: "Asignado",
  PENDING: "Pendiente"
};

export const WEEK_DAY_OPTIONS: Array<{ key: DayKey; label: string; shortLabel: string }> = [
  { key: "lunes", label: "Lunes", shortLabel: "Lun" },
  { key: "martes", label: "Martes", shortLabel: "Mar" },
  { key: "miercoles", label: "Miércoles", shortLabel: "Mié" },
  { key: "jueves", label: "Jueves", shortLabel: "Jue" },
  { key: "viernes", label: "Viernes", shortLabel: "Vie" },
  { key: "sabado", label: "Sábado", shortLabel: "Sáb" },
  { key: "domingo", label: "Domingo", shortLabel: "Dom" }
];

export const TASKER_CATEGORY_ALIASES: Record<string, CoreTaskerServiceSlug> = {
  limpieza: "limpieza",
  mascotas: "mascotas",
  "paseo-cuidado-mascotas": "mascotas",
  babysitter: "babysitter",
  "babysitter-por-horas": "babysitter",
  "profesor-particular": "profesor-particular",
  "personal-trainer": "personal-trainer",
  chef: "chef",
  "chef-a-domicilio": "chef",
  maquillaje: "maquillaje",
  "maquillaje-a-domicilio": "maquillaje",
  planchado: "planchado"
};

export function clp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

export function dateInputDefault() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function formatBookingDate(value: string) {
  return new Date(value).toLocaleString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function formatDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shiftMonthKey(dayKey: string, delta: number) {
  const base = new Date(`${dayKey}T12:00:00`);
  const desiredDay = base.getDate();
  const target = new Date(base);
  target.setDate(1);
  target.setMonth(target.getMonth() + delta);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(desiredDay, lastDay));
  return formatDayKey(target);
}

export function weekdayToDayKey(date: Date): DayKey {
  return ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"][date.getDay()] as DayKey;
}

export function initialsFromName(value: string) {
  const words = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (words.length === 0) return "WT";
  return words.map((word) => word[0]?.toUpperCase() ?? "").join("");
}

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function formatCoverageAddress(street: string, commune: string, city: string) {
  const normalizedStreet = street
    .replace(/\b\d{7}\b/g, " ")
    .replace(/,\s*Región Metropolitana,?\s*Chile/gi, " ")
    .replace(/,\s*Chile/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+,/g, ",")
    .replace(/,+$/g, "")
    .trim();

  const duplicatePatterns = [commune, city]
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => new RegExp(`(?:,\\s*)?${escapeRegex(value)}`, "gi"));

  let cleanedStreet = normalizedStreet;
  for (const pattern of duplicatePatterns) {
    cleanedStreet = cleanedStreet.replace(pattern, "");
  }

  cleanedStreet = cleanedStreet
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/,+$/g, "")
    .trim();

  return [cleanedStreet || "Sin dirección", commune || "Sin comuna", city].filter(Boolean).join(", ");
}

export function normalizeAvailabilityBlocks(value: unknown): AvailabilityBlock[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as Partial<AvailabilityBlock>;
      if (typeof candidate.day !== "string" || typeof candidate.start !== "string" || typeof candidate.end !== "string") {
        return null;
      }
      return {
        day: candidate.day as DayKey,
        start: candidate.start,
        end: candidate.end
      };
    })
    .filter((item): item is AvailabilityBlock => Boolean(item));
}

export function localDraftProfilePhoto() {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem(TASKER_WIZARD_STORAGE_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { profilePhotoUrl?: string };
    return typeof parsed.profilePhotoUrl === "string" ? parsed.profilePhotoUrl.trim() : "";
  } catch {
    return "";
  }
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
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
