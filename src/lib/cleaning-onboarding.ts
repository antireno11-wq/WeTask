export const CLEANING_EXPERIENCE_TYPES = [
  "casas",
  "departamentos",
  "oficinas_pequenas",
  "airbnb",
  "limpieza_profunda",
  "planchado"
] as const;

export const CLEANING_SERVICE_TYPES = [
  "limpieza_general",
  "limpieza_profunda",
  "limpieza_recurrente",
  "limpieza_puntual",
  "planchado",
  "orden_organizacion",
  "limpieza_oficina_pequena",
  "post_evento"
] as const;

export const CLEANING_WEEK_DAYS = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo"
] as const;

export const CLEANING_TRAINING_TOPICS = [
  "puntualidad",
  "presentacion_personal",
  "incluye_limpieza_basica",
  "no_incluye_limpieza_basica",
  "marcar_inicio_termino",
  "manejo_tareas_extra",
  "faltan_materiales",
  "politica_cancelaciones",
  "protocolo_incidentes"
] as const;

export const CLEANING_ONBOARDING_STEPS = [
  { step: 1, key: "registro_inicial", label: "Registro inicial" },
  { step: 2, key: "perfil_profesional", label: "Perfil profesional" },
  { step: 3, key: "servicios", label: "Servicios ofrecidos" },
  { step: 4, key: "cobertura", label: "Cobertura geografica" },
  { step: 5, key: "disponibilidad", label: "Disponibilidad" },
  { step: 6, key: "tarifas", label: "Tarifas" },
  { step: 7, key: "verificacion", label: "Verificacion" },
  { step: 8, key: "capacitacion", label: "Capacitacion" },
  { step: 9, key: "revision", label: "Revision y activacion" }
] as const;

export const CLEANING_STATUS_LABELS: Record<string, string> = {
  BORRADOR: "borrador",
  PENDIENTE_REVISION: "pendiente de revision",
  REQUIERE_CORRECCION: "requiere correccion",
  APROBADO: "aprobado",
  ACTIVO: "activo"
};

export const CHILE_TOP_COMMUNES = [
  "Las Condes",
  "Vitacura",
  "Providencia",
  "Nunoa",
  "Lo Barnechea",
  "Santiago",
  "La Reina",
  "Macul",
  "Penalolen",
  "San Miguel"
] as const;
