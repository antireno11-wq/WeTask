export type Booking = {
  id: string;
  status: string;
  scheduledAt: string;
  totalPriceClp: number;
  addressLine1: string;
  comuna: string;
  city: string | null;
  postalCode: string | null;
  service: { name: string };
  pro: { fullName: string } | null;
  review?: { id: string; rating: number; comment?: string | null } | null;
};

export type Notification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
};

export type SessionPayload = {
  userId: string;
  fullName?: string | null;
  email?: string | null;
};

export type PaymentMethod = {
  id: string;
  brand: string | null;
  last4: string;
  expirationMonth: number | null;
  expirationYear: number | null;
  cardholderName: string | null;
  payerEmail: string | null;
  paymentMethodId: string | null;
  isDefault: boolean;
};

export type CardFormData = {
  token?: string;
  paymentMethodId?: string;
  issuerId?: string;
  cardholderEmail?: string;
  identificationType?: string;
  identificationNumber?: string;
};

export type ClientView = "resumen" | "perfil" | "pagos" | "reservas" | "notificaciones";
