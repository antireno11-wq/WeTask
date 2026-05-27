import { logError, logger } from "@/lib/logger";

/**
 * OpenFactura — DTE / boleta electrónica para Chile (Ley 21.131, art. 53D
 * y obligación de boleta electrónica). Si no hay envs configuradas, el
 * helper falla en silencio (devuelve `{ ok: false, reason: "not_configured" }`)
 * para que un checkout exitoso no quede bloqueado por boleta.
 *
 * Doc oficial: https://docs.openfactura.cl/reference/dte-emitidos
 *
 * Envs:
 *   OPENFACTURA_API_KEY      — token API (header `apikey`).
 *   OPENFACTURA_RUT_EMISOR   — RUT del emisor con DV, formato `76123456-7`.
 *   OPENFACTURA_AMBIENTE     — `certificacion` | `produccion` (default certif).
 *   OPENFACTURA_BASE_URL     — opcional, override del endpoint base.
 */

export interface BoletaInput {
  paymentId: string;
  amountClp: number;
  serviceName: string;
  customer: {
    fullName: string;
    email: string;
    rut?: string | null;
  };
  emittedAt?: Date;
}

export type BoletaResult =
  | { ok: true; folio: string; url: string | null; raw: unknown }
  | { ok: false; reason: "not_configured" | "provider_error" | "invalid_input"; detail: string };

const OPENFACTURA_DEFAULT_PROD = "https://api.haulmer.com/v2";
const OPENFACTURA_DEFAULT_CERT = "https://dev-api.haulmer.com/v2";

function resolveBaseUrl(): string | null {
  const override = process.env.OPENFACTURA_BASE_URL?.trim();
  if (override) return override.replace(/\/+$/, "");
  const ambiente = (process.env.OPENFACTURA_AMBIENTE ?? "certificacion").toLowerCase();
  if (ambiente === "produccion" || ambiente === "production") return OPENFACTURA_DEFAULT_PROD;
  return OPENFACTURA_DEFAULT_CERT;
}

export function isOpenFacturaConfigured(): boolean {
  return Boolean(process.env.OPENFACTURA_API_KEY?.trim() && process.env.OPENFACTURA_RUT_EMISOR?.trim());
}

export async function emitirBoletaServicio(input: BoletaInput): Promise<BoletaResult> {
  if (!isOpenFacturaConfigured()) {
    return { ok: false, reason: "not_configured", detail: "OPENFACTURA_API_KEY o OPENFACTURA_RUT_EMISOR faltan" };
  }

  if (input.amountClp <= 0) {
    return { ok: false, reason: "invalid_input", detail: "amountClp debe ser > 0" };
  }

  const baseUrl = resolveBaseUrl();
  if (!baseUrl) {
    return { ok: false, reason: "not_configured", detail: "OPENFACTURA_BASE_URL inválido" };
  }

  const emittedAt = input.emittedAt ?? new Date();
  const fechaEmision = emittedAt.toISOString().slice(0, 10);

  // Esquema mínimo boleta electrónica afecta (DTE 39).
  // Detalle de campos: https://docs.openfactura.cl/reference/dte-emitidos
  const body = {
    Encabezado: {
      IdDoc: { TipoDTE: 39, FchEmis: fechaEmision, IndServicio: 3 },
      Emisor: { RUTEmisor: process.env.OPENFACTURA_RUT_EMISOR },
      Receptor: input.customer.rut
        ? { RUTRecep: input.customer.rut, RznSocRecep: input.customer.fullName }
        : { RUTRecep: "66666666-6", RznSocRecep: input.customer.fullName },
      Totales: { MntTotal: input.amountClp }
    },
    Detalle: [
      {
        NroLinDet: 1,
        NmbItem: input.serviceName.slice(0, 80),
        QtyItem: 1,
        PrcItem: input.amountClp,
        MontoItem: input.amountClp
      }
    ]
  };

  try {
    const res = await fetch(`${baseUrl}/dte/document`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.OPENFACTURA_API_KEY!
      },
      body: JSON.stringify(body)
    });

    const raw = await res.json().catch(() => ({}));

    if (!res.ok) {
      logError("billing.openfactura", new Error(`HTTP ${res.status}`), { paymentId: input.paymentId, raw });
      return {
        ok: false,
        reason: "provider_error",
        detail: typeof (raw as { message?: string })?.message === "string" ? (raw as { message: string }).message : `HTTP ${res.status}`
      };
    }

    const folio = String((raw as { Folio?: number | string; folio?: number | string }).Folio ?? (raw as { folio?: number | string }).folio ?? "");
    const url = (raw as { PDF?: string; pdf_url?: string }).PDF ?? (raw as { pdf_url?: string }).pdf_url ?? null;

    if (!folio) {
      return { ok: false, reason: "provider_error", detail: "OpenFactura no devolvió folio" };
    }

    logger.info({ paymentId: input.paymentId, folio }, "Boleta electrónica emitida");
    return { ok: true, folio, url, raw };
  } catch (error) {
    logError("billing.openfactura", error, { paymentId: input.paymentId });
    return {
      ok: false,
      reason: "provider_error",
      detail: error instanceof Error ? error.message : "Error desconocido"
    };
  }
}
