import { ProviderPaymentCreateInput, ProviderPaymentResult, ProviderRefundInput } from "@/lib/payments/types";

const MP_API_BASE = "https://api.mercadopago.com";

function mpAccessToken() {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN no configurado");
  }
  return token;
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function mapStatus(rawStatus: string | undefined): ProviderPaymentResult["status"] {
  switch ((rawStatus || "").toLowerCase()) {
    case "approved":
      return "approved";
    case "refunded":
      return "refunded";
    case "cancelled":
    case "rejected":
      return "failed";
    case "in_process":
    case "pending":
    case "authorized":
      return "pending";
    default:
      return "failed";
  }
}

function normalizePaymentResult(payload: any): ProviderPaymentResult {
  return {
    provider: "MERCADOPAGO",
    providerPaymentId: payload?.id ? String(payload.id) : null,
    providerStatus: String(payload?.status ?? "unknown"),
    status: mapStatus(payload?.status),
    amount: Number(payload?.transaction_amount ?? 0),
    currency: String(payload?.currency_id ?? "CLP"),
    paymentMethod: payload?.payment_method_id ? String(payload.payment_method_id) : null,
    last4: payload?.card?.last_four_digits ? String(payload.card.last_four_digits) : null,
    paidAt: parseDate(payload?.date_approved),
    refundedAt: parseDate(payload?.date_last_updated),
    raw: payload,
    errorCode: payload?.status_detail ? String(payload.status_detail) : null,
    errorMessage: payload?.status_detail ? String(payload.status_detail) : null
  };
}

async function mpRequest(path: string, init: RequestInit & { idempotencyKey?: string }) {
  const token = mpAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  if (init.idempotencyKey) {
    headers.set("X-Idempotency-Key", init.idempotencyKey);
  }

  const response = await fetch(`${MP_API_BASE}${path}`, {
    ...init,
    headers,
    cache: "no-store"
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

export async function createMercadoPagoPayment(input: ProviderPaymentCreateInput): Promise<ProviderPaymentResult> {
  const body = {
    transaction_amount: input.amount,
    token: input.token,
    description: input.description,
    installments: input.installments,
    payment_method_id: input.paymentMethodId,
    issuer_id: input.issuerId ? Number(input.issuerId) : undefined,
    payer: {
      email: input.payerEmail,
      identification:
        input.payerIdentification?.type && input.payerIdentification?.number
          ? {
              type: input.payerIdentification.type,
              number: input.payerIdentification.number
            }
          : undefined
    },
    external_reference: input.externalReference,
    metadata: {
      booking_id: input.externalReference
    }
  };

  const { response, payload } = await mpRequest("/v1/payments", {
    method: "POST",
    body: JSON.stringify(body),
    idempotencyKey: input.idempotencyKey
  });

  if (!response.ok) {
    return {
      provider: "MERCADOPAGO",
      providerPaymentId: payload?.id ? String(payload.id) : null,
      providerStatus: String(payload?.status ?? "error"),
      status: "failed",
      amount: input.amount,
      currency: input.currency,
      paymentMethod: input.paymentMethodId,
      last4: null,
      paidAt: null,
      refundedAt: null,
      raw: payload,
      errorCode: payload?.error ? String(payload.error) : null,
      errorMessage: payload?.message ? String(payload.message) : "Error creando pago en Mercado Pago"
    };
  }

  return normalizePaymentResult(payload);
}

export async function getMercadoPagoPayment(providerPaymentId: string): Promise<ProviderPaymentResult> {
  const { response, payload } = await mpRequest(`/v1/payments/${providerPaymentId}`, { method: "GET" });
  if (!response.ok) {
    return {
      provider: "MERCADOPAGO",
      providerPaymentId,
      providerStatus: String(payload?.status ?? "error"),
      status: "failed",
      amount: Number(payload?.transaction_amount ?? 0),
      currency: String(payload?.currency_id ?? "CLP"),
      paymentMethod: payload?.payment_method_id ? String(payload.payment_method_id) : null,
      last4: payload?.card?.last_four_digits ? String(payload.card.last_four_digits) : null,
      paidAt: null,
      refundedAt: null,
      raw: payload,
      errorCode: payload?.error ? String(payload.error) : null,
      errorMessage: payload?.message ? String(payload.message) : "No se pudo consultar pago en Mercado Pago"
    };
  }
  return normalizePaymentResult(payload);
}

export async function refundMercadoPagoPayment(input: ProviderRefundInput): Promise<ProviderPaymentResult> {
  const body = typeof input.amount === "number" ? { amount: input.amount } : {};
  const { response, payload } = await mpRequest(`/v1/payments/${input.providerPaymentId}/refunds`, {
    method: "POST",
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    return {
      provider: "MERCADOPAGO",
      providerPaymentId: input.providerPaymentId,
      providerStatus: "refund_error",
      status: "failed",
      amount: input.amount ?? 0,
      currency: "CLP",
      paymentMethod: null,
      last4: null,
      paidAt: null,
      refundedAt: null,
      raw: payload,
      errorCode: payload?.error ? String(payload.error) : null,
      errorMessage: payload?.message ? String(payload.message) : "No se pudo reembolsar pago"
    };
  }

  return {
    provider: "MERCADOPAGO",
    providerPaymentId: input.providerPaymentId,
    providerStatus: "refunded",
    status: "refunded",
    amount: Number(payload?.amount ?? input.amount ?? 0),
    currency: "CLP",
    paymentMethod: null,
    last4: null,
    paidAt: null,
    refundedAt: parseDate(payload?.date_created) ?? new Date(),
    raw: payload
  };
}
