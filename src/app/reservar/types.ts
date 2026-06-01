export type Service = {
  id: string;
  slug: string;
  name: string;
  description: string;
  basePriceClp: number;
};

export type Slot = {
  id: string;
  startsAt: string;
  endsAt: string;
  service: { id: string; name: string } | null;
};

export type MatchProfessional = {
  id: string;
  userId: string;
  fullName: string;
  profilePhotoUrl?: string | null;
  ratingAvg: number;
  ratingsCount: number;
  hourlyRateFromClp: number | null;
  distanceKm: number;
  nextAvailableAt: string | null;
  coverageCity: string | null;
  serviceRadiusKm: number;
  taskerServices: Array<{ serviceId: string | null; serviceName: string | null }>;
  slots: Slot[];
};

export type BookingResponse = {
  id: string;
  status: string;
  paymentStatus: string;
  totalPriceClp: number;
};

export type SavedPaymentMethod = {
  id: string;
  brand: string | null;
  last4: string;
  expirationMonth: number | null;
  expirationYear: number | null;
  cardholderName: string | null;
  payerEmail: string | null;
  paymentMethodId: string | null;
  providerCardId: string | null;
  isDefault: boolean;
};

export type CardFormData = {
  token?: string;
  paymentMethodId?: string;
  issuerId?: string;
  installments?: string | number;
  cardholderEmail?: string;
  identificationType?: string;
  identificationNumber?: string;
};
