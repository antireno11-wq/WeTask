import { NextResponse } from "next/server";
import { getMercadoPagoHealthSnapshot } from "@/lib/payments/providers/mercadopago";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ComponentStatus = "ok" | "degraded" | "down" | "unconfigured";
type ComponentReport = {
  status: ComponentStatus;
  detail?: string;
  latencyMs?: number;
};

type HealthPayload = {
  ok: boolean;
  service: "wetask";
  timestamp: string;
  components: {
    database: ComponentReport;
    mercadopago: ComponentReport;
    resend: ComponentReport;
  };
};

let cache: { builtAt: number; payload: HealthPayload } | null = null;
const CACHE_TTL_MS = 30_000;

const IS_PROD = process.env.NODE_ENV === "production";

async function checkDatabase(): Promise<ComponentReport> {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok", latencyMs: Date.now() - started };
  } catch (err) {
    // ADM-02: nunca exponer el mensaje crudo del error de DB en un endpoint público.
    return {
      status: "down",
      detail: IS_PROD ? "database unreachable" : err instanceof Error ? err.message : "DB query failed",
      latencyMs: Date.now() - started
    };
  }
}

function checkMercadoPago(): ComponentReport {
  const snapshot = getMercadoPagoHealthSnapshot();
  if (!snapshot.configured) {
    return { status: "unconfigured", detail: "MERCADOPAGO_ACCESS_TOKEN o NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY faltan" };
  }
  if (snapshot.credentials.sameEnvironment === false) {
    return { status: "degraded", detail: "Las credenciales MP están en environments distintos (test vs production)" };
  }
  return { status: "ok" };
}

function checkResend(): ComponentReport {
  const configured = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
  if (!configured) {
    return { status: "unconfigured", detail: "RESEND_API_KEY o RESEND_FROM_EMAIL faltan" };
  }
  return { status: "ok" };
}

async function buildHealthPayload(): Promise<HealthPayload> {
  const [database] = await Promise.all([checkDatabase()]);
  const mercadopago = checkMercadoPago();
  const resend = checkResend();
  const ok =
    database.status === "ok" && mercadopago.status !== "down" && resend.status !== "down";
  // ADM-02: en producción no enumeramos qué env vars faltan ni detalles internos.
  const redact = (report: ComponentReport): ComponentReport =>
    IS_PROD ? { status: report.status, latencyMs: report.latencyMs } : report;
  return {
    ok,
    service: "wetask",
    timestamp: new Date().toISOString(),
    components: { database: redact(database), mercadopago: redact(mercadopago), resend: redact(resend) }
  };
}

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.builtAt < CACHE_TTL_MS) {
    return NextResponse.json(cache.payload, { status: cache.payload.ok ? 200 : 503 });
  }
  const payload = await buildHealthPayload();
  cache = { builtAt: now, payload };
  return NextResponse.json(payload, { status: payload.ok ? 200 : 503 });
}

