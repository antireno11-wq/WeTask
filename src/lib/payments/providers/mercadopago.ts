import { ProviderPaymentCreateInput, ProviderPaymentResult, ProviderRefundInput } from "@/lib/payments/types";

const MP_API_BASE = "https://api.mercadopago.com";
const MP_REQUEST_TIMEOUT_MS = 10_000;

export type MercadoPagoCredentialMode = "test" | "production" | "unknown" | "missing";
export type MercadoPagoHealthReport = {
  configured: boolean;
  credentials: {
    hasAccessToken: boolean;
    hasPublicKey: boolean;
    accessTokenMode: MercadoPagoCredentialMode;
    publicKeyMode: MercadoPagoCredentialMode;
    sameEnvironment: boolean | null;
  };
  provider: {
    reachable: boolean;
    ok: boolean;
    status: number | null;
    message: string;
  };
};

export type MercadoPagoStoredCard = {
  customerId: string;
  cardId: string;
  paymentMethodId: string | null;
  brand: string | null;
  last4: string;
  expirationMonth: number | null;
  expirationYear: number | null;
  cardholderName: string | null;
};

function mpAccessToken() {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN no configurado");
  }
  return token;
}

function detectCredentialMode(value: string | undefined | null): MercadoPagoCredentialMode {
  if (!value) return "missing";
  const normalized = value.trim().toUpperCase();
  if (!normalized) return "missing";
  if (normalized.includes("TEST")) return "test";
  if (normalized.startsWith("APP_USR") || normalized.startsWith("APP_PUBLIC")) return "production";
  return "unknown";
}

export function getMercadoPagoHealthSnapshot(): MercadoPagoHealthReport {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const publicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;
  const accessTokenMode = detectCredentialMode(accessToken);
  const publicKeyMode = detectCredentialMode(publicKey);
  const sameEnvironment =
    accessTokenMode === "missing" || publicKeyMode === "missing"
      ? null
      : accessTokenMode === "unknown" || publicKeyMode === "unknown"
        ? null
        : accessTokenMode === publicKeyMode;

  return {
    configured: Boolean(accessToken && publicKey),
    credentials: {
      hasAccessToken: Boolean(accessToken),
      hasPublicKey: Boolean(publicKey),
      accessTokenMode,
      publicKeyMode,
      sameEnvironment
    },
    provider: {
      reachable: false,
      ok: false,
      status: null,
      message: "Aún no verificado"
    }
  };
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
    case "charged_back":
      return "refunded";
    case "cancelled":
    case "rejected":
      return "failed";
    case "in_process":
    case "pending":
    case "authorized":
      return "pending";
    default:
      // Un status desconocido NO es un fallo definitivo (G6): tratarlo como
      // pending evita cancelar bookings sanos ante respuestas inesperadas de MP.
      return "pending";
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
    errorMessage: payload?.status_detail ? String(payload.status_detail) : null,
    reachable: true,
    moneyReleaseDate: parseDate(payload?.money_release_date)
  };
}

async function mpRequest(
  path: string,
  init: RequestInit & { idempotencyKey?: string; accessTokenOverride?: string }
) {
  const token = init.accessTokenOverride ?? mpAccessToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  if (init.idempotencyKey) {
    headers.set("X-Idempotency-Key", init.idempotencyKey);
  }

  // PAY-09: timeout duro de 10s. Si MP no responde, lo tratamos como fallo de
  // transporte (response.ok=false) para que los callers lo manejen como "no reachable"
  // (G6) en vez de colgar el request del cliente o el cron.
  try {
    const response = await fetch(`${MP_API_BASE}${path}`, {
      ...init,
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(MP_REQUEST_TIMEOUT_MS)
    });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  } catch {
    return { response: { ok: false, status: 0 } as Response, payload: {} as any };
  }
}

// ---------------------------------------------------------------------------
// MercadoPago Marketplace OAuth (Fase 5)
// ---------------------------------------------------------------------------

export type MercadoPagoOAuthTokenResponse = {
  accessToken: string;
  refreshToken: string | null;
  userId: string;
  publicKey: string | null;
  expiresInSeconds: number | null;
  scope: string | null;
};

function getOAuthClientId(): string {
  const value = process.env.MERCADOPAGO_APP_ID;
  if (!value) throw new Error("MERCADOPAGO_APP_ID no configurado");
  return value;
}

function getOAuthClientSecret(): string {
  const value = process.env.MERCADOPAGO_APP_SECRET;
  if (!value) throw new Error("MERCADOPAGO_APP_SECRET no configurado");
  return value;
}

export function getOAuthRedirectUri(): string {
  const explicit = process.env.MERCADOPAGO_OAUTH_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "http://localhost:3000";
  return `${base}/api/payments/mp/oauth/callback`;
}

export function isMercadoPagoOAuthConfigured(): boolean {
  return Boolean(process.env.MERCADOPAGO_APP_ID && process.env.MERCADOPAGO_APP_SECRET);
}

export function getMercadoPagoAuthorizationUrl(state: string): string {
  const clientId = getOAuthClientId();
  const redirectUri = getOAuthRedirectUri();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    platform_id: "mp",
    redirect_uri: redirectUri,
    state
  });
  return `https://auth.mercadopago.cl/authorization?${params.toString()}`;
}

export async function exchangeMercadoPagoCode(code: string): Promise<MercadoPagoOAuthTokenResponse> {
  const response = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body: new URLSearchParams({
      client_id: getOAuthClientId(),
      client_secret: getOAuthClientSecret(),
      grant_type: "authorization_code",
      code,
      redirect_uri: getOAuthRedirectUri()
    }).toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(MP_REQUEST_TIMEOUT_MS)
  });
  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    throw new Error(payload?.message || payload?.error || `MercadoPago OAuth code exchange falló (${response.status})`);
  }
  return {
    accessToken: String(payload.access_token),
    refreshToken: payload.refresh_token ? String(payload.refresh_token) : null,
    userId: String(payload.user_id ?? ""),
    publicKey: payload.public_key ? String(payload.public_key) : null,
    expiresInSeconds: typeof payload.expires_in === "number" ? payload.expires_in : null,
    scope: payload.scope ? String(payload.scope) : null
  };
}

export async function refreshMercadoPagoToken(refreshToken: string): Promise<MercadoPagoOAuthTokenResponse> {
  const response = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body: new URLSearchParams({
      client_id: getOAuthClientId(),
      client_secret: getOAuthClientSecret(),
      grant_type: "refresh_token",
      refresh_token: refreshToken
    }).toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(MP_REQUEST_TIMEOUT_MS)
  });
  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    throw new Error(payload?.message || payload?.error || `MercadoPago OAuth refresh falló (${response.status})`);
  }
  return {
    accessToken: String(payload.access_token),
    refreshToken: payload.refresh_token ? String(payload.refresh_token) : refreshToken,
    userId: String(payload.user_id ?? ""),
    publicKey: payload.public_key ? String(payload.public_key) : null,
    expiresInSeconds: typeof payload.expires_in === "number" ? payload.expires_in : null,
    scope: payload.scope ? String(payload.scope) : null
  };
}

/**
 * Re-consulta el estado de un pago directamente al collector (tasker)
 * con su access_token, útil para reconciliación y para verificar que un
 * payment con application_fee ya fue capturado y liberado al tasker.
 *
 * MercadoPago Marketplace libera el dinero al collector automáticamente
 * según las reglas de la cuenta (típicamente entre días y horas). Este
 * helper no fuerza el release sino que confirma el estado actual para
 * que el cron actualice nuestra DB en consecuencia.
 */
export async function getMercadoPagoMarketplacePayment(
  providerPaymentId: string,
  collectorAccessToken: string
): Promise<ProviderPaymentResult> {
  const { response, payload } = await mpRequest(`/v1/payments/${providerPaymentId}`, {
    method: "GET",
    accessTokenOverride: collectorAccessToken
  });
  if (!response.ok) {
    // Fallo de transporte (timeout/5xx/rate-limit): NO es un pago fallido (G6).
    return {
      provider: "MERCADOPAGO",
      providerPaymentId,
      providerStatus: String(payload?.status ?? "error"),
      status: "pending",
      reachable: false,
      amount: Number(payload?.transaction_amount ?? 0),
      currency: String(payload?.currency_id ?? "CLP"),
      paymentMethod: payload?.payment_method_id ? String(payload.payment_method_id) : null,
      last4: payload?.card?.last_four_digits ? String(payload.card.last_four_digits) : null,
      paidAt: null,
      refundedAt: null,
      raw: payload,
      errorCode: payload?.error ? String(payload.error) : null,
      errorMessage: payload?.message ? String(payload.message) : "No se pudo consultar pago marketplace"
    };
  }
  return normalizePaymentResult(payload);
}

/**
 * Crea un pago contra MercadoPago usando el access token del COLLECTOR (tasker)
 * con application_fee retenido por WeTask. Modelo Marketplace.
 *
 * @param input pago estándar (token de tarjeta, monto, etc.)
 * @param collectorAccessToken access_token OAuth del tasker
 * @param applicationFeeClp comisión que retiene WeTask del monto
 */
export async function createMercadoPagoMarketplacePayment(
  input: ProviderPaymentCreateInput,
  options: { collectorAccessToken: string; applicationFeeClp: number }
): Promise<ProviderPaymentResult> {
  const body: Record<string, unknown> = {
    transaction_amount: input.amount,
    token: input.token,
    card_id: input.cardId,
    description: input.description,
    installments: input.installments,
    payment_method_id: input.paymentMethodId,
    issuer_id: input.issuerId ? Number(input.issuerId) : undefined,
    application_fee: options.applicationFeeClp,
    payer: {
      email: input.payerEmail,
      ...(input.customerId
        ? {
            id: input.customerId,
            type: "customer"
          }
        : {}),
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
      booking_id: input.externalReference,
      marketplace: "WETASK"
    }
  };

  const { response, payload } = await mpRequest("/v1/payments", {
    method: "POST",
    body: JSON.stringify(body),
    idempotencyKey: input.idempotencyKey,
    accessTokenOverride: options.collectorAccessToken
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
      errorMessage: payload?.message ? String(payload.message) : "Error creando pago marketplace en Mercado Pago"
    };
  }

  return normalizePaymentResult(payload);
}

export async function checkMercadoPagoHealth(): Promise<MercadoPagoHealthReport> {
  const snapshot = getMercadoPagoHealthSnapshot();

  if (!snapshot.credentials.hasAccessToken) {
    return {
      ...snapshot,
      provider: {
        reachable: false,
        ok: false,
        status: null,
        message: "Falta MERCADOPAGO_ACCESS_TOKEN"
      }
    };
  }

  try {
    const probeEmail = `healthcheck+${Date.now()}@wetask.invalid`;
    const { response, payload } = await mpRequest(`/v1/customers/search?email=${encodeURIComponent(probeEmail)}`, { method: "GET" });
    const ok = response.ok;
    const detail =
      payload?.message ||
      payload?.error ||
      (ok ? "Mercado Pago respondió correctamente" : "Mercado Pago respondió con error");

    return {
      ...snapshot,
      provider: {
        reachable: ok,
        ok,
        status: response.status,
        message: String(detail)
      }
    };
  } catch (error) {
    return {
      ...snapshot,
      provider: {
        reachable: false,
        ok: false,
        status: null,
        message: error instanceof Error ? error.message : "No se pudo conectar con Mercado Pago"
      }
    };
  }
}

export async function createMercadoPagoPayment(input: ProviderPaymentCreateInput): Promise<ProviderPaymentResult> {
  const body = {
    transaction_amount: input.amount,
    token: input.token,
    card_id: input.cardId,
    description: input.description,
    installments: input.installments,
    payment_method_id: input.paymentMethodId,
    issuer_id: input.issuerId ? Number(input.issuerId) : undefined,
    payer: {
      email: input.payerEmail,
      ...(input.customerId
        ? {
            id: input.customerId,
            type: "customer"
          }
        : {}),
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
    // Fallo de transporte (timeout/5xx/rate-limit): NO es un pago fallido (G6).
    return {
      provider: "MERCADOPAGO",
      providerPaymentId,
      providerStatus: String(payload?.status ?? "error"),
      status: "pending",
      reachable: false,
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

function normalizeStoredCard(payload: any, customerId: string): MercadoPagoStoredCard {
  return {
    customerId,
    cardId: String(payload?.id ?? ""),
    paymentMethodId: payload?.payment_method?.id ? String(payload.payment_method.id) : payload?.payment_method_id ? String(payload.payment_method_id) : null,
    brand: payload?.payment_method?.name ? String(payload.payment_method.name) : payload?.payment_method?.id ? String(payload.payment_method.id) : null,
    last4: String(payload?.last_four_digits ?? payload?.last4 ?? ""),
    expirationMonth: typeof payload?.expiration_month === "number" ? payload.expiration_month : null,
    expirationYear: typeof payload?.expiration_year === "number" ? payload.expiration_year : null,
    cardholderName: payload?.cardholder?.name ? String(payload.cardholder.name) : null
  };
}

export async function findMercadoPagoCustomerByEmail(email: string) {
  const { response, payload } = await mpRequest(`/v1/customers/search?email=${encodeURIComponent(email)}`, { method: "GET" });
  if (!response.ok) {
    throw new Error(payload?.message ? String(payload.message) : "No se pudo buscar cliente en Mercado Pago");
  }
  const first = Array.isArray(payload?.results) ? payload.results[0] : null;
  return first?.id ? String(first.id) : null;
}

export async function createMercadoPagoCustomer(input: { email: string; firstName?: string | null; lastName?: string | null }) {
  const { response, payload } = await mpRequest("/v1/customers", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      first_name: input.firstName ?? undefined,
      last_name: input.lastName ?? undefined
    })
  });

  if (!response.ok || !payload?.id) {
    throw new Error(payload?.message ? String(payload.message) : "No se pudo crear cliente en Mercado Pago");
  }

  return String(payload.id);
}

export async function ensureMercadoPagoCustomer(input: { email: string; firstName?: string | null; lastName?: string | null; existingCustomerId?: string | null }) {
  if (input.existingCustomerId) return input.existingCustomerId;
  const found = await findMercadoPagoCustomerByEmail(input.email);
  if (found) return found;
  return createMercadoPagoCustomer(input);
}

export async function createMercadoPagoCustomerCard(input: {
  customerId: string;
  token: string;
  paymentMethodId?: string;
  issuerId?: string;
}) {
  const { response, payload } = await mpRequest(`/v1/customers/${input.customerId}/cards`, {
    method: "POST",
    body: JSON.stringify({
      token: input.token,
      payment_method_id: input.paymentMethodId,
      issuer_id: input.issuerId ? Number(input.issuerId) : undefined
    })
  });

  if (!response.ok || !payload?.id) {
    throw new Error(payload?.message ? String(payload.message) : "No se pudo guardar la tarjeta en Mercado Pago");
  }

  return normalizeStoredCard(payload, input.customerId);
}

export async function listMercadoPagoCustomerCards(customerId: string) {
  const { response, payload } = await mpRequest(`/v1/customers/${customerId}/cards`, { method: "GET" });
  if (!response.ok) {
    throw new Error(payload?.message ? String(payload.message) : "No se pudieron cargar las tarjetas guardadas");
  }
  const items = Array.isArray(payload) ? payload : [];
  return items.map((item) => normalizeStoredCard(item, customerId));
}

export async function deleteMercadoPagoCustomerCard(customerId: string, cardId: string) {
  const { response, payload } = await mpRequest(`/v1/customers/${customerId}/cards/${cardId}`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(payload?.message ? String(payload.message) : "No se pudo eliminar la tarjeta guardada");
  }
}
