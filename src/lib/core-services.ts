export const CORE_SERVICES = [
  {
    slug: "limpieza",
    label: "Limpieza",
    icon: "🧹",
    requestService: "Limpieza",
    categorySlug: "limpieza",
    taskerDescription: "Limpieza general, profunda, recurrente y por horas.",
    image: "/services/limpieza.png"
  },
  {
    slug: "mascotas",
    label: "Paseo y cuidado mascotas",
    icon: "🐾",
    requestService: "Paseo y cuidado de mascotas",
    categorySlug: "paseo-cuidado-mascotas",
    taskerDescription: "Paseo de perros, visitas, cuidado diario y apoyo para mascotas.",
    image: "/services/mascotas.png"
  },
  {
    slug: "babysitter",
    label: "Babysitter",
    icon: "👶",
    requestService: "Babysitter",
    categorySlug: "babysitter-por-horas",
    taskerDescription: "Cuidado infantil en casa con enfoque en seguridad y rutina.",
    image: "/services/babysitter.png"
  },
  {
    slug: "profesor-particular",
    label: "Profesor particular",
    icon: "📚",
    requestService: "Profesor particular",
    categorySlug: "profesor-particular",
    taskerDescription: "Refuerzo escolar y apoyo personalizado a domicilio o en linea.",
    image: "/services/profesor-particular.png"
  },
  {
    slug: "personal-trainer",
    label: "Personal trainer",
    icon: "🏋️",
    requestService: "Personal trainer",
    categorySlug: "personal-trainer",
    taskerDescription: "Entrenamiento funcional y planes adaptados por objetivo.",
    image: "/services/personal-trainer.png"
  },
  {
    slug: "chef",
    label: "Chef",
    icon: "👨‍🍳",
    requestService: "Chef a domicilio",
    categorySlug: "chef-a-domicilio",
    taskerDescription: "Menu personalizado, cocina en casa y preparacion para eventos.",
    image: "/services/chef.png"
  },
  {
    slug: "planchado",
    label: "Planchado",
    icon: "👕",
    requestService: "Planchado",
    categorySlug: "planchado",
    taskerDescription: "Planchado por hora, orden y cuidado de prendas.",
    image: "/services/planchado.png"
  }
] as const;

export type CoreTaskerServiceSlug = (typeof CORE_SERVICES)[number]["slug"];

export const CORE_CATEGORY_SLUGS = CORE_SERVICES.map((service) => service.categorySlug);
