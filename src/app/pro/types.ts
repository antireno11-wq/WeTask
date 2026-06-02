export type Booking = {
  id: string;
  status: string;
  scheduledAt: string;
  totalPriceClp: number;
  proReviewRating: number | null;
  proReviewComment: string | null;
  proReviewedAt: string | null;
  customer: { fullName: string; email: string };
  service: { name: string };
  payout: { status: string } | null;
};

export type Notification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
};

export type Service = {
  id: string;
  name: string;
};

export type DayKey = "lunes" | "martes" | "miercoles" | "jueves" | "viernes" | "sabado" | "domingo";

export type AvailabilityBlock = {
  day: DayKey;
  start: string;
  end: string;
};

export type ProProfile = {
  id: string;
  avatarUrl?: string | null;
  bio: string | null;
  coverageStreet: string | null;
  coverageComuna: string | null;
  coverageCity: string | null;
  coveragePostal: string | null;
  coverageLatitude: number | null;
  coverageLongitude: number | null;
  serviceRadiusKm: number;
  hourlyRateFromClp: number | null;
  isVerified: boolean;
};

export type ProProfileResponse = {
  user?: {
    id: string;
    fullName: string;
    email: string;
  };
  profile?: ProProfile | null;
  categorySlug?: string | null;
  profilePhotoUrl?: string | null;
  availabilityMode?: "FIJA" | "VARIABLE" | null;
  availabilityBlocks?: unknown;
  taskerServices?: Service[];
  serviceCommunes?: string[];
  error?: string;
  detail?: string;
};

export type AddressValidationResponse = {
  valid?: boolean;
  skipped?: boolean;
  normalizedAddress?: string;
  commune?: string | null;
  isActiveCommune?: boolean;
  location?: { lat?: number | null; lng?: number | null };
  error?: string;
  detail?: string;
};

export type ProSlot = {
  id: string;
  startsAt: string;
  endsAt: string;
  isAvailable: boolean;
  source?: "saved" | "onboarding";
  service: { id: string; name: string } | null;
  bookings: Array<{ id: string; status: string }>;
};

export type ProView = "resumen" | "perfil" | "agenda" | "reservas" | "resenas" | "notificaciones";
