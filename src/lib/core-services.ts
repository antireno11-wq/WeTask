export const CORE_SERVICES = [
  {
    slug: "limpieza",
    label: "Limpieza",
    icon: "🧹",
    requestService: "Limpieza general",
    categorySlug: "limpieza",
    taskerDescription: "Onboarding completo con cobertura, tarifas y verificacion."
  },
  {
    slug: "maestro",
    label: "Maestro",
    icon: "🧰",
    requestService: "Maestro multiuso",
    categorySlug: "maestro-polifuncional",
    taskerDescription: "Registro para trabajos de reparaciones y mantenciones."
  },
  {
    slug: "clases",
    label: "Clases",
    icon: "📚",
    requestService: "Clases particulares",
    categorySlug: "clases-colegio",
    taskerDescription: "Registro para profes de apoyo escolar y clases personalizadas."
  }
] as const;

export type CoreTaskerServiceSlug = (typeof CORE_SERVICES)[number]["slug"];

export const CORE_CATEGORY_SLUGS = CORE_SERVICES.map((service) => service.categorySlug);
