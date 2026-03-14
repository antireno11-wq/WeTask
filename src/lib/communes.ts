export const ACTIVE_MVP_COMMUNES = [
  "Las Condes",
  "Vitacura",
  "Chicureo",
  "Providencia",
  "Ñuñoa",
  "La Reina",
  "Lo Barnechea"
] as const;

export const COVERAGE_UNAVAILABLE_MESSAGE =
  "Aún no estamos disponibles en tu comuna. Déjanos tu email y te avisaremos cuando lleguemos.";

export type ActiveMvpCommune = (typeof ACTIVE_MVP_COMMUNES)[number];

type Coordinates = { lat: number; lng: number };

const ACTIVE_MVP_COMMUNE_CENTERS: Record<ActiveMvpCommune, Coordinates> = {
  "Las Condes": { lat: -33.4167, lng: -70.5833 },
  Vitacura: { lat: -33.3906, lng: -70.5711 },
  Chicureo: { lat: -33.2833, lng: -70.65 },
  Providencia: { lat: -33.4311, lng: -70.6111 },
  "Ñuñoa": { lat: -33.4569, lng: -70.5975 },
  "Lo Barnechea": { lat: -33.3504, lng: -70.5152 },
  "La Reina": { lat: -33.4489, lng: -70.5564 }
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const communeAliasMap = new Map<string, ActiveMvpCommune>(
  ACTIVE_MVP_COMMUNES.flatMap((commune) => {
    const normalized = normalizeText(commune);
    const aliases = new Set<string>([normalized]);

    if (normalized === "nunoa") {
      aliases.add("ñunoa");
      aliases.add("nunoa");
      aliases.add("nunoa santiago");
    }
    if (normalized === "lo barnechea") {
      aliases.add("barnechea");
    }
    if (normalized === "chicureo") {
      aliases.add("colina");
      aliases.add("chicureo colina");
    }

    return Array.from(aliases).map((alias) => [alias, commune] as const);
  })
);

export function normalizeCommune(value: string | null | undefined): ActiveMvpCommune | null {
  if (!value) return null;
  return communeAliasMap.get(normalizeText(value)) ?? null;
}

export function isActiveMvpCommune(value: string | null | undefined): boolean {
  return Boolean(normalizeCommune(value));
}

export function inferCommuneFromAddress(address: string | null | undefined): ActiveMvpCommune | null {
  if (!address) return null;
  const normalizedAddress = normalizeText(address);

  for (const commune of ACTIVE_MVP_COMMUNES) {
    if (normalizedAddress.includes(normalizeText(commune))) {
      return commune;
    }
  }

  if (normalizedAddress.includes("nunoa") || normalizedAddress.includes("ñunoa")) {
    return "Ñuñoa";
  }

  return null;
}

export function getCommuneCenter(commune: string | null | undefined): Coordinates | null {
  const normalized = normalizeCommune(commune);
  if (!normalized) return null;
  return ACTIVE_MVP_COMMUNE_CENTERS[normalized];
}

export function activeCommunesSummaryText() {
  return ACTIVE_MVP_COMMUNES.join(", ");
}

export function activeCommunesSummaryWithConjunction() {
  const items = [...ACTIVE_MVP_COMMUNES];
  if (items.length <= 1) return items.join("");
  const last = items.pop();
  return `${items.join(", ")} y ${last}`;
}

export function normalizeCommuneList(values: unknown): ActiveMvpCommune[] {
  if (!Array.isArray(values)) return [];
  const unique = new Set<ActiveMvpCommune>();
  for (const value of values) {
    if (typeof value !== "string") continue;
    const normalized = normalizeCommune(value);
    if (normalized) unique.add(normalized);
  }
  return Array.from(unique);
}

export function taskerServesCommune(
  input: {
    serviceCommunes?: unknown;
    coverageComuna?: string | null;
  },
  clientCommune: string | null | undefined
) {
  const normalizedClientCommune = normalizeCommune(clientCommune);
  if (!normalizedClientCommune) return false;

  const configuredCommunes = normalizeCommuneList(input.serviceCommunes);
  if (configuredCommunes.length > 0) {
    return configuredCommunes.includes(normalizedClientCommune);
  }

  const fallbackCommune = normalizeCommune(input.coverageComuna);
  if (fallbackCommune) {
    return fallbackCommune === normalizedClientCommune;
  }

  return false;
}
