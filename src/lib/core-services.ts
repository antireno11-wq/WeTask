export const CORE_SERVICES = [
  {
    slug: "limpieza",
    label: "Limpieza",
    icon: "🧹",
    requestService: "Limpieza",
    categorySlug: "limpieza",
    taskerDescription: "Limpieza general, profunda, recurrente y por horas.",
    image:
      "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1400&q=80"
  },
  {
    slug: "mascotas",
    label: "Paseo y cuidado mascotas",
    icon: "🐾",
    requestService: "Paseo y cuidado de mascotas",
    categorySlug: "paseo-cuidado-mascotas",
    taskerDescription: "Paseo de perros, visitas, cuidado diario y apoyo para mascotas.",
    image:
      "https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=1400&q=80"
  },
  {
    slug: "babysitter",
    label: "Babysitter por horas",
    icon: "👶",
    requestService: "Babysitter por horas",
    categorySlug: "babysitter-por-horas",
    taskerDescription: "Cuidado infantil por bloques horarios y apoyo en rutinas.",
    image:
      "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=1400&q=80"
  },
  {
    slug: "profesor-particular",
    label: "Profesor particular",
    icon: "📚",
    requestService: "Profesor particular",
    categorySlug: "profesor-particular",
    taskerDescription: "Refuerzo escolar y apoyo personalizado a domicilio o en linea.",
    image:
      "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1400&q=80"
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
    slug: "pintura-basica",
    label: "Pintura basica",
    icon: "🎨",
    requestService: "Pintura basica",
    categorySlug: "pintura-basica",
    taskerDescription: "Pintura interior, muros, retoques y terminaciones basicas.",
    image:
      "https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=1400&q=80"
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
