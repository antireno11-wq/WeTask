export const CHEF_SERVICE_DEFINITIONS = [
  {
    slug: "cocina-gourmet",
    name: "Cocina gourmet",
    shortLabel: "Gourmet",
    description: "Experiencia premium para cenas especiales, reuniones pequeñas y menús más elaborados.",
    forClients: "Ideal para ocasiones especiales, platos sofisticados y presentación más cuidada.",
    includes: [
      "preparación de platos elaborados",
      "presentación cuidada",
      "menú acordado previamente",
      "preparación en el domicilio o entrega según el modelo",
      "limpieza básica del espacio usado"
    ],
    excludes: [
      "decoración del evento",
      "garzones",
      "vajilla especial",
      "compra de insumos salvo que se indique",
      "torta o repostería aparte salvo que se contrate"
    ],
    recommendedMinClp: 26000,
    recommendedMaxClp: 38000
  },
  {
    slug: "cocina-casera",
    name: "Cocina casera",
    shortLabel: "Casera",
    description: "Opción simple y masiva para familias, comida rica y apoyo doméstico en cocina.",
    forClients: "Muy buena para almuerzos o cenas familiares, comida semanal y personas con poco tiempo.",
    includes: [
      "preparación de comida casera",
      "platos definidos con el cliente",
      "porciones para una o varias personas",
      "orden y limpieza básica de la cocina usada",
      "posibilidad de cocinar para el día o dejar comida lista"
    ],
    excludes: [
      "servicio de mesa",
      "decoración",
      "eventos grandes",
      "repostería especializada",
      "compra de insumos salvo acuerdo"
    ],
    recommendedMinClp: 18000,
    recommendedMaxClp: 26000
  },
  {
    slug: "reposteria",
    name: "Repostería",
    shortLabel: "Repostería",
    description: "Preparaciones dulces, tortas, cupcakes, postres y encargos personalizados.",
    forClients: "Pensado para tortas, mesas dulces pequeñas, postres y pedidos especiales.",
    includes: [
      "preparación del producto solicitado",
      "decoración básica o personalizada",
      "coordinación de sabor, tamaño y diseño",
      "entrega o preparación en domicilio según el servicio"
    ],
    excludes: [
      "montaje completo de evento",
      "decoración del lugar",
      "catering salado",
      "delivery externo si no está contemplado"
    ],
    recommendedMinClp: 22000,
    recommendedMaxClp: 34000
  },
  {
    slug: "cocina-eventos",
    name: "Cocina para eventos",
    shortLabel: "Eventos",
    description: "Servicio para celebraciones, reuniones de empresa pequeñas y comidas para grupos.",
    forClients: "Ideal para brunch, almuerzos o cenas para varios invitados con planificación básica de menú.",
    includes: [
      "planificación básica del menú",
      "preparación de comida para grupo",
      "coordinación por cantidad de personas",
      "montaje básico de comida si aplica",
      "orden y limpieza básica del espacio utilizado"
    ],
    excludes: [
      "decoración del evento",
      "arriendo de mobiliario",
      "garzones, bartenders o animación",
      "torta salvo adicional",
      "producción completa del evento"
    ],
    recommendedMinClp: 28000,
    recommendedMaxClp: 42000
  },
  {
    slug: "cumpleanos",
    name: "Cumpleaños",
    shortLabel: "Cumpleaños",
    description: "Servicio pensado para cumpleaños infantiles, familiares y celebraciones en casa.",
    forClients: "Muy útil para picoteo, menú especial para invitados y apoyo dulce o salado para la celebración.",
    includes: [
      "preparación de comida o picoteo",
      "opciones dulces o saladas",
      "coordinación según cantidad de invitados",
      "opción de sumar torta o repostería como adicional"
    ],
    excludes: [
      "decoración del cumpleaños",
      "animación",
      "garzones",
      "mobiliario",
      "cotillón o producción completa"
    ],
    recommendedMinClp: 25000,
    recommendedMaxClp: 38000
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
