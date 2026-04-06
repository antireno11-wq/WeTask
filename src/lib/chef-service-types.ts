export const CHEF_SERVICE_DEFINITIONS = [
  {
    slug: "cena-privada-2",
    name: "Cena privada (2 personas)",
    shortLabel: "Cena privada 2 personas",
    description: "Servicio íntimo para una pareja o cena especial en casa.",
    forClients: "Ideal para aniversarios, celebraciones privadas y una experiencia más cuidada en casa.",
    includes: ["preparación", "cocción", "emplatado", "limpieza básica"],
    excludes: ["compra de insumos", "garzones", "decoración del evento", "vajilla especial"],
    estimatedDurationLabel: "2 a 3 horas",
    estimatedDurationMinutes: 150,
    recommendedMinClp: 50000,
    recommendedMaxClp: 80000
  },
  {
    slug: "cena-privada-4",
    name: "Cena privada (4 personas)",
    shortLabel: "Cena privada 4 personas",
    description: "Cena a domicilio para grupos pequeños con una experiencia más completa.",
    forClients: "Pensado para reuniones pequeñas, celebraciones familiares y cenas especiales con amigos.",
    includes: ["preparación", "cocción", "emplatado", "limpieza básica"],
    excludes: ["garzones", "decoración", "vajilla especial", "compra de insumos si no se acuerda"],
    estimatedDurationLabel: "3 a 4 horas",
    estimatedDurationMinutes: 210,
    recommendedMinClp: 80000,
    recommendedMaxClp: 120000
  },
  {
    slug: "meal-prep-semanal",
    name: "Meal prep semanal",
    shortLabel: "Meal prep semanal",
    description: "Preparación de comidas para varios días con planificación previa.",
    forClients: "Muy útil para familias, personas con poco tiempo o quienes quieren dejar comidas listas para la semana.",
    includes: ["planificación simple", "preparación", "cocción", "porcionado", "limpieza básica"],
    excludes: ["envases", "compra de supermercado", "dietas clínicas complejas"],
    estimatedDurationLabel: "3 a 4 horas",
    estimatedDurationMinutes: 210,
    recommendedMinClp: 45000,
    recommendedMaxClp: 85000
  },
  {
    slug: "evento-cumpleanos",
    name: "Evento / cumpleaños",
    shortLabel: "Evento / cumpleaños",
    description: "Servicio para celebraciones, cumpleaños y reuniones donde importa resolver cocina y servicio base.",
    forClients: "Ideal para cumpleaños en casa, reuniones familiares y celebraciones pequeñas o medianas.",
    includes: ["planificación básica", "preparación", "cocción", "montaje simple", "limpieza básica"],
    excludes: ["decoración", "garzones", "mobiliario", "producción completa del evento"],
    estimatedDurationLabel: "4 a 6 horas",
    estimatedDurationMinutes: 300,
    recommendedMinClp: 90000,
    recommendedMaxClp: 160000
  },
  {
    slug: "parrilla-asado",
    name: "Parrilla / asado",
    shortLabel: "Parrilla / asado",
    description: "Chef o parrillero para asados, parrilla y servicio en torno al fuego.",
    forClients: "Perfecto para reuniones familiares, asados de fin de semana y celebraciones al aire libre o terraza.",
    includes: ["mise en place", "parrilla", "cocción", "servicio base", "limpieza básica"],
    excludes: ["compra de carnes", "garzones", "vajilla", "producción completa"],
    estimatedDurationLabel: "3 a 5 horas",
    estimatedDurationMinutes: 240,
    recommendedMinClp: 70000,
    recommendedMaxClp: 130000
  },
  {
    slug: "reposteria",
    name: "Repostería",
    shortLabel: "Repostería",
    description: "Preparaciones dulces, tortas, postres y encargos personalizados.",
    forClients: "Pensado para tortas, mesas dulces pequeñas, postres especiales y pedidos a medida.",
    includes: ["preparación", "horneado", "decoración básica", "limpieza básica"],
    excludes: ["montaje de evento", "decoración del lugar", "delivery externo"],
    estimatedDurationLabel: "2 a 4 horas",
    estimatedDurationMinutes: 180,
    recommendedMinClp: 30000,
    recommendedMaxClp: 70000
  }
] as const;

export type ChefServiceDefinition = (typeof CHEF_SERVICE_DEFINITIONS)[number];
export type ChefServiceSlug = ChefServiceDefinition["slug"];

export function isChefServiceSlug(value: string): value is ChefServiceSlug {
  return CHEF_SERVICE_DEFINITIONS.some((service) => service.slug === value);
}

export function getChefServiceDefinition(value: string) {
  return CHEF_SERVICE_DEFINITIONS.find((service) => service.slug === value) ?? null;
}

export function isChefServiceRateWithinRange(serviceSlug: string, value: number) {
  const service = getChefServiceDefinition(serviceSlug);
  if (!service) return false;
  return value >= service.recommendedMinClp && value <= service.recommendedMaxClp;
}
