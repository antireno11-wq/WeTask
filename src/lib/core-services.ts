export const CORE_SERVICES = [
  {
    slug: "limpieza",
    label: "Limpieza",
    icon: "🧹",
    requestService: "Limpieza",
    categorySlug: "limpieza",
    taskerDescription: "Limpieza general, profunda, recurrente y por horas.",
    image:
      "https://images.unsplash.com/photo-1527515637462-daf3c4d5f065?auto=format&fit=crop&w=1400&q=80"
  },
  {
    slug: "mascotas",
    label: "Paseo y cuidado mascotas",
    icon: "🐾",
    requestService: "Paseo y cuidado de mascotas",
    categorySlug: "paseo-cuidado-mascotas",
    taskerDescription: "Paseo de perros, visitas, cuidado diario y apoyo para mascotas.",
    image:
      "https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=1400&q=80"
  },
  {
    slug: "babysitter",
    label: "Babysitter",
    icon: "👶",
    requestService: "Babysitter",
    categorySlug: "babysitter-por-horas",
    taskerDescription: "Cuidado infantil en casa con enfoque en seguridad y rutina.",
    image:
      "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=1400&q=80"
  },
  {
    slug: "profesor-particular",
    label: "Profesor particular",
    icon: "📚",
    requestService: "Profesor particular",
    categorySlug: "profesor-particular",
    taskerDescription: "Refuerzo escolar y apoyo personalizado a domicilio o en linea.",
    image:
      "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1400&q=80"
  },
  {
    slug: "personal-trainer",
    label: "Personal trainer",
    icon: "🏋️",
    requestService: "Personal trainer",
    categorySlug: "personal-trainer",
    taskerDescription: "Entrenamiento funcional y planes adaptados por objetivo.",
    image:
      "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=1400&q=80"
  },
  {
    slug: "planchado",
    label: "Planchado",
    icon: "👕",
    requestService: "Planchado",
    categorySlug: "planchado",
    taskerDescription: "Planchado por hora, orden y cuidado de prendas.",
    image:
      "https://images.unsplash.com/photo-1604335399105-a0c585fd81a1?auto=format&fit=crop&w=1400&q=80"
  }
] as const;

export type CoreTaskerServiceSlug = (typeof CORE_SERVICES)[number]["slug"];

export const CORE_CATEGORY_SLUGS = CORE_SERVICES.map((service) => service.categorySlug);
