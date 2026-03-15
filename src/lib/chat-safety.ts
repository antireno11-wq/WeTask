const CONTACT_KEYWORDS = [
  "whatsapp",
  "telefono",
  "celular",
  "llamame",
  "llamame al",
  "escribeme",
  "escribeme al",
  "mi numero",
  "mi numero es",
  "pasame tu numero",
  "instagram",
  "correo",
  "email",
  "gmail",
  "hotmail",
  "outlook",
  "contactame",
  "hablame"
];

const PHONE_PATTERNS = [
  /(?:\+?56[\s.-]*)?9(?:[\s.-]*\d){8}\b/,
  /\b\d{8,}\b/
];

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

export const PRE_CONFIRMATION_CHAT_BLOCK_MESSAGE =
  "Por seguridad, no se permite compartir números de teléfono ni datos de contacto antes de confirmar el servicio.";

function normalizeForSafetyCheck(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function canShareContactDetails(status: string) {
  return ["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(status);
}

export function messageContainsRestrictedContactInfo(body: string) {
  const normalized = normalizeForSafetyCheck(body);
  if (EMAIL_PATTERN.test(body)) return true;
  if (PHONE_PATTERNS.some((pattern) => pattern.test(body))) return true;
  return CONTACT_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

