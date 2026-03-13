export type PaymentProvider = "MERCADOPAGO";

export type ProviderPaymentCreateInput = {
  amount: number;
  currency: string;
  description: string;
  externalReference: string;
  idempotencyKey: string;
  token: string;
  paymentMethodId: string;
  issuerId?: string;
  installments: number;
  payerEmail: string;
  payerIdentification?: {
    type?: string;
    number?: string;
  };
};

export type ProviderPaymentStatus = "approved" | "failed" | "pending" | "refunded";

export type ProviderPaymentResult = {
  provider: PaymentProvider;
  providerPaymentId: string | null;
  providerStatus: string;
  status: ProviderPaymentStatus;
  amount: number;
  currency: string;
  paymentMethod: string | null;
  last4: string | null;
  paidAt: Date | null;
  refundedAt: Date | null;
  raw: unknown;
  errorCode?: string | null;
  errorMessage?: string | null;
};

export type ProviderRefundInput = {
  providerPaymentId: string;
  amount?: number;
};
