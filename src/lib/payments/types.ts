export type PaymentProvider = "MERCADOPAGO";

export type ProviderPaymentCreateInput = {
  amount: number;
  currency: string;
  description: string;
  externalReference: string;
  idempotencyKey: string;
  token?: string;
  paymentMethodId: string;
  issuerId?: string;
  installments: number;
  payerEmail: string;
  payerIdentification?: {
    type?: string;
    number?: string;
  };
  customerId?: string;
  cardId?: string;
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
  /**
   * `false` cuando el proveedor no respondió OK (timeout, 5xx, rate-limit).
   * Distingue un fallo de TRANSPORTE de un fallo de NEGOCIO: un pago no debe
   * marcarse FAILED solo porque MercadoPago estuvo caído un momento (G6).
   * `undefined` se trata como alcanzable (true).
   */
  reachable?: boolean;
  /**
   * Fecha en que MercadoPago libera el dinero del escrow al collector
   * (`money_release_date`). El payout no debe marcarse PAID antes de esto (G7).
   */
  moneyReleaseDate?: Date | null;
};

export type ProviderRefundInput = {
  providerPaymentId: string;
  amount?: number;
};
