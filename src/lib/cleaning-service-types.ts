export type CleaningServiceSlug =
  | "limpieza-hogar"
  | "limpieza-profunda"
  | "limpieza-por-horas"
  | "limpieza-post-mudanza"
  | "limpieza-oficina";

export type CleaningServiceDefinition = {
  slug: CleaningServiceSlug;
  name: string;
  description: string;
  forClients: string;
  includes: string[];
  excludes?: string[];
  recommendedMinClp: number;
  recommendedMaxClp: number;
};

export const CLEANING_SERVICE_DEFINITIONS: CleaningServiceDefinition[] = [
  {
    slug: "limpieza-hogar",
    name: "Limpieza estándar",
    description: "Ideal para mantención general del hogar, departamentos y casas con aseo normal.",
    forClients: "Para clientes que quieren un aseo habitual sin trabajo pesado.",
    includes: [
      "Barrer y aspirar",
      "Trapear",
      "Limpiar polvo",
      "Ordenar superficies visibles",
      "Limpiar cocina por fuera",
      "Limpiar baños",
      "Sacar basura"
    ],
    excludes: ["Limpieza profunda de horno", "Interior de refrigerador", "Manchas difíciles", "Post mudanza", "Trabajo pesado"],
    recommendedMinClp: 12000,
    recommendedMaxClp: 16000
  },
  {
    slug: "limpieza-profunda",
    name: "Limpieza profunda",
    description: "Para casas más sucias o espacios que no se limpian hace tiempo.",
    forClients: "Ideal cuando se necesita más detalle, más tiempo y una cocina o baño más exigente.",
    includes: ["Todo lo de limpieza estándar", "Rincones", "Zócalos", "Puertas", "Manchas visibles", "Cocina más detallada", "Baños más profundos"],
    excludes: ["Interior de horno o refrigerador solo si no se acuerda antes"],
    recommendedMinClp: 15000,
    recommendedMaxClp: 20000
  },
  {
    slug: "limpieza-por-horas",
    name: "Limpieza por horas",
    description: "Flexible para tareas puntuales, apoyo doméstico y mantención rápida.",
    forClients: "El cliente elige cuántas horas necesita y cuáles son las tareas prioritarias.",
    includes: ["Apoyo doméstico", "Tareas puntuales", "Mantención rápida", "Ayuda en departamentos pequeños"],
    recommendedMinClp: 11000,
    recommendedMaxClp: 15000
  },
  {
    slug: "limpieza-post-mudanza",
    name: "Limpieza post mudanza",
    description: "Pensada para casas o departamentos vacíos, recién ocupados o entregas de propiedad.",
    forClients: "Sirve para entrar a vivir o dejar una propiedad lista después de mover muebles.",
    includes: ["Polvo acumulado", "Pisos", "Baños", "Cocina", "Clósets", "Espacios vacíos"],
    excludes: ["Ventanas solo si se acuerdan como adicional"],
    recommendedMinClp: 16000,
    recommendedMaxClp: 22000
  },
  {
    slug: "limpieza-oficina",
    name: "Limpieza de oficina",
    description: "Para oficinas pequeñas, consultas y espacios de trabajo.",
    forClients: "Buena opción para clientes no residenciales con necesidades recurrentes o puntuales.",
    includes: ["Escritorios", "Pisos", "Baño", "Superficies", "Basura"],
    recommendedMinClp: 13000,
    recommendedMaxClp: 17000
  }
];

export const CLEANING_SERVICE_MAP = new Map(CLEANING_SERVICE_DEFINITIONS.map((service) => [service.slug, service]));

export function isCleaningServiceSlug(value: string): value is CleaningServiceSlug {
  return CLEANING_SERVICE_MAP.has(value as CleaningServiceSlug);
}

export function getCleaningServiceDefinition(value: string) {
  return CLEANING_SERVICE_MAP.get(value as CleaningServiceSlug) ?? null;
}

