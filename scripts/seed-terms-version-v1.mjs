#!/usr/bin/env node
/**
 * Bootstrap TermsVersion v1 + backfill User.termsVersionId.
 *
 * Idempotente: si v1 ya existe se reutiliza; si User.termsVersionId ya
 * está seteado no se sobrescribe. Apunta a los usuarios cuya
 * termsAcceptedAt no es null pero termsVersionId sí — esos son los
 * usuarios pre-Fase 14 que aceptaron T&C sin versionado.
 *
 * Uso:
 *   node scripts/seed-terms-version-v1.mjs
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const VERSION = "1.0";
const PUBLISHED_AT = new Date("2026-05-01T00:00:00.000Z");
const TITLE = "Términos y condiciones · WeTask v1.0";
const CONTENT = `WeTask v1.0 — vigente desde mayo 2026.

WeTask opera como una plataforma de conexión y gestión segura entre clientes y profesionales. El uso de la plataforma implica respetar las reglas de reserva, pago, comunicación y cumplimiento establecidas por WeTask.

1. Coordinación dentro de la plataforma
Está prohibido coordinar servicios fuera de la plataforma. Clientes y profesionales deben mantener la reserva, el pago y la comunicación del servicio dentro de WeTask mientras la solicitud esté activa. Los profesionales que intenten desviar reservas, pagos o coordinación fuera de la plataforma podrán ser suspendidos o eliminados de WeTask.

2. Pagos y boleta
Los pagos se procesan vía Mercado Pago. El dinero queda retenido (escrow) hasta que el cliente confirma el servicio o transcurren 48 horas desde el check-out del profesional. WeTask emite boleta electrónica conforme a la Ley 21.131.

3. Cancelaciones y reembolsos
Las cancelaciones se rigen por la política específica del servicio. Las disputas se resuelven a través del centro de soporte y pueden derivar en reembolso parcial o total según la evaluación del equipo de WeTask.

4. Datos personales
El tratamiento de datos personales se rige por la Política de privacidad publicada en /legal/privacidad, conforme a la Ley 19.628 de Chile.

5. Modificaciones
WeTask puede modificar estos términos avisando con al menos 15 días de anticipación a los cambios sustanciales.

Para consultas: legal@wetask.cl`;

async function main() {
  console.log(`[seed-terms-v1] Buscando TermsVersion existente version=${VERSION}...`);
  let termsVersion = await prisma.termsVersion.findUnique({ where: { version: VERSION } });

  if (!termsVersion) {
    termsVersion = await prisma.termsVersion.create({
      data: { version: VERSION, title: TITLE, content: CONTENT, publishedAt: PUBLISHED_AT }
    });
    console.log(`[seed-terms-v1] Creada TermsVersion id=${termsVersion.id} version=${VERSION}`);
  } else {
    console.log(`[seed-terms-v1] TermsVersion ya existe id=${termsVersion.id}, se reutiliza`);
  }

  const target = await prisma.user.count({
    where: { termsAcceptedAt: { not: null }, termsVersionId: null }
  });
  console.log(`[seed-terms-v1] ${target} usuarios con termsAcceptedAt pero sin termsVersionId — backfill a v1`);

  const result = await prisma.user.updateMany({
    where: { termsAcceptedAt: { not: null }, termsVersionId: null },
    data: { termsVersionId: termsVersion.id }
  });
  console.log(`[seed-terms-v1] ${result.count} usuarios actualizados`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("[seed-terms-v1] Error:", err);
  await prisma.$disconnect();
  process.exit(1);
});
