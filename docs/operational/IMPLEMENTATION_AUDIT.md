# WeTask — Implementation Audit (Auditoría de Implementación Operacional)

> Documento de auditoría profunda de implementación. Clasifica cada subsistema cubierto en los hallazgos como **production-ready / partial / mock-demo / dangerous / missing**, agrupado por dominio (booking, payments, onboarding, admin, async, trust). Para cada ítem se incluyen las referencias reales de archivos, el comportamiento actual (currentBehavior) y el riesgo operacional.
>
> Fecha: 2026-05-29 · Alcance: lifecycle de booking, pagos MercadoPago Marketplace, onboarding de taskers, herramientas admin, jobs/cron asíncronos y capa de confianza.
>
> **Nota de honestidad:** Este documento es para un lanzamiento real a producción. Distingue explícitamente lo que es sólido, lo que es heurístico/aproximado, y lo que es falso, demo-only o directamente peligroso. Está basado **enteramente** en los hallazgos de auditoría reales — no se inventa nada que no esté en los hallazgos.

---

## 1. Resumen Ejecutivo (Executive Summary)

### 1.1 Tabla maestra: subsistema → status → severidad

| # | Subsistema / Hallazgo | Dominio | Status | Severidad |
|---|------------------------|---------|--------|-----------|
| B1 | PAYOUT_SCHEDULED nunca se procesa — payouts confirmados por el cliente quedan congelados para siempre | Booking | **dangerous** | **critical** |
| B2 | Ruta legacy `/api/bookings/[bookingId]/status` muta estado SIN auth y SIN state machine | Booking | **dangerous** | **critical** |
| B3 | No existe endpoint de cancelación — no se puede cancelar, reembolsar ni liberar el slot | Booking | **missing** | high |
| B4 | `dueDateAt` de disputas se escribe pero ningún job lo aplica — payouts congelados indefinidamente | Booking | **partial** | high |
| B5 | Escrow RELEASED / Payout PAID se setean por heurística, no por confirmación real de MercadoPago | Booking | **partial** | high |
| B6 | Creación pública de bookings genera órdenes huérfanas sin pago, sin pro, sin slot | Booking | **dangerous** | medium |
| B7 | Slot puede perderse silenciosamente (orphan booked=false) si falla el proveedor de pago a mitad de flujo | Booking | **partial** | medium |
| B8 | Double-hold de slot bien protegido, pero el hold no se re-valida atómicamente por dueño en checkout | Booking | **partial** | low |
| B9 | `check-in`/`on-the-way` mutan booking sin `assertTransition` (allow-lists hardcodeadas) | Booking | **partial** | low |
| B10 | `payout/request` crea Payout sin cambiar estado → flujo competidor con el cron | Booking | **partial** | low |
| P1 | Webhook registra `ProcessedWebhookEvent` ANTES de mutar la DB — una tx fallida pierde el evento y congela el pago | Payments | **dangerous** | **critical** |
| P2 | Payout PAID / escrow RELEASED por heurística de 24h sin `money_release_date` | Payments | **dangerous** | high |
| P3 | Reembolso post-COMPLETED imposible — disputes reembolsa en MP primero y luego falla la transición ilegal | Payments | **dangerous** | **critical** |
| P4 | Cron de payout no valida que el token del collector siga ACTIVE antes de liberar | Payments | **partial** | high |
| P5 | Reembolso parcial deja escrow/payout intactos — PARTIAL_REFUNDED puede pagarse completo | Payments | **partial** | high |
| P6 | Webhook `refunded`/`failed` aplicado a booking ya completado desincroniza Payment vs Booking silenciosamente | Payments | **partial** | medium |
| P7 | `refundMercadoPagoPayment` trata cualquier 2xx como éxito total, no valida el status del objeto refund de MP | Payments | **partial** | medium |
| P8 | Sin reconciliación de `application_fee`: comisión solo sobre labor, extras pasan 100% al tasker | Payments | **partial** | medium |
| P9 | Ventana de refresh de token asume 7 días; tokens que expiran mid-lifecycle no se re-validan proactivamente | Payments | **partial** | low |
| O1 | Taskers aprobados-pero-no-activados se vuelven visibles en search antes del gate de activación | Onboarding | **dangerous** | high |
| O2 | `approve` no valida requisitos de publicación (commune/rate/category) que sí valida `activate` | Onboarding | **partial** | medium |
| O3 | Documentos de identidad y fotos guardados como base64 multi-MB en DB cuando R2 no está configurado | Onboarding | **partial** | medium |
| O4 | Rutas SMS muertas `phone/send`+`phone/verify` siguen seteando `phoneValidatedAt=null` y rompen submit | Onboarding | **dangerous** | low |
| O5 | Generación de `AvailabilitySlot` sin unicidad en DB; syncs concurrentes pueden crear slots duplicados | Onboarding | **partial** | low |
| O6 | Gate de payout MP correctamente forzado en search, availability y checkout | Onboarding | **production-ready** | none |
| A1 | Payouts fallidos (`Payout.status=FAILED`) completamente invisibles — se escriben pero nunca se leen, sin retry | Admin | **missing** | **critical** |
| A2 | No existe cola operacional de bookings/pagos atascados (stuck PENDING_PAYMENT/PROCESSING) | Admin | **missing** | high |
| A3 | `AdminAuditLog` es write-only — no hay UI ni API para leer el audit trail | Admin | **missing** | high |
| A4 | No hay vista de providers con MP desconectado/expirado que tengan bookings activos | Admin | **missing** | high |
| A5 | Endpoint de trigger manual de payout existe pero no está cableado a ningún botón admin | Admin | **partial** | medium |
| A6 | Disputas cerca/sobre SLA visibles por fila pero sin conteo de breach ni cola agregada | Admin | **partial** | medium |
| A7 | Ruta standalone de refund depende solo de la transición de booking; sin guard de payment-status ni idempotency | Admin | **partial** | medium |
| A8 | Payout PROCESSING es un limbo terminal sin path de escalación | Admin | **partial** | medium |
| X1 | Outage transitorio de MercadoPago cancela en masa bookings sanos pagados (reconcile trata todo error HTTP como FAILED) | Async | **dangerous** | **critical** |
| X2 | Cron de payout marca PAID/RELEASED mientras el dinero sigue en escrow de MP (`money_release_date` ignorado) | Async | **dangerous** | **critical** |
| X3 | `process-bookings` y `booking-reminders` con `findMany` sin `take:` — exceden timeout y QStash reintenta el batch para siempre | Async | **dangerous** | high |
| X4 | Sin heartbeat/dead-letter/alerting de crons — un cron muerto pasa desapercibido por días | Async | **missing** | high |
| X5 | Idempotencia de `booking-reminders` basada en título hardcodeado + ventana de 6h — frágil, puede duplicar o dejar de enviar | Async | **partial** | medium |
| X6 | `refresh-mp-tokens` deshabilita al tasker ante CUALQUIER excepción, incluso errores OAuth transitorios | Async | **partial** | medium |
| X7 | Side-effects de payout PAID (notif+email) fuera de la tx sin compensación | Async | **partial** | low |
| X8 | Verificación de auth QStash y aislamiento/idempotencia por ítem correctamente implementados | Async | **production-ready** | none |
| T1 | Auto-confirm a 24h libera payout ante el silencio del cliente; sin fallback neutral para clientes "ghosting" | Trust | **dangerous** | **critical** |
| T2 | Disputa puede abrirse DESPUÉS de liberado el payout (COMPLETED→DISPUTE) sin path de clawback | Trust | **dangerous** | **critical** |
| T3 | Disputas nunca auto-expiran: `dueDateAt` SLA seteado pero ningún cron lo procesa; payout congelado para siempre | Trust | **partial** | high |
| T4 | Sin constraint unique/active en `DisputeTicket.bookingId` — disputas spammeables/reabribles para re-congelar payouts | Trust | **dangerous** | high |
| T5 | Anti-disintermediación de chat solo bloquea ANTES de CONFIRMED — abierto toda la ventana de servicio; filtro burlable | Trust | **partial** | high |
| T6 | Cliente no puede reseñar en el path común de auto-confirm (review gateado a COMPLETED, pero auto-confirm cae en PAYOUT_SCHEDULED) | Trust | **partial** | medium |
| T7 | Agregación de rating corre en tx pero no es isolation-safe ante reviews concurrentes | Trust | **partial** | medium |
| T8 | `customer-confirm` y el cron de payout pueden hacer race en el mismo booking (sin row lock) | Trust | **partial** | low |
| T9 | Fallback de header-auth permite spoofing de actor (self-review / abrir disputa como la otra parte) fuera de producción | Trust | **partial** | low |

### 1.2 Conteo por status

| Status | Cantidad |
|--------|----------|
| **dangerous** | 11 |
| **missing** | 5 |
| **partial** | 22 |
| **production-ready** | 2 |
| **mock-demo** | 0 |
| **Total ítems** | 40 |

### 1.3 Conteo por severidad

| Severidad | Cantidad |
|-----------|----------|
| **critical** | 8 |
| **high** | 12 |
| **medium** | 12 |
| **low** | 6 |
| **none** (positivos) | 2 |

### 1.4 Lectura honesta del estado (qué es real, qué es falso/demo)

- **Núcleo sólido y real (no mock):** El lifecycle de booking tiene un core robusto — checkout usa una transacción de DB real con `SELECT ... FOR UPDATE` para reclamar slots; la state machine se fuerza en las rutas marketplace de status/complete/check-out/customer-confirm/disputes/refund; `Payment.idempotencyKey` y `Payout.bookingId` son `@unique`; el webhook de MP es idempotente vía `ProcessedWebhookEvent`. La verificación de firma QStash es correcta (HS256 + body-hash + exp/nbf, timing-safe, key rotation). El gate de payout MP se fuerza en search/availability/checkout. La resolución de disputas y la revisión de onboarding son genuinamente production-grade (refunds reales de MP, guards de state machine, `OnboardingReviewEvent` + `AdminAuditLog`, badges de SLA).
- **Lo que es heurístico/aproximado (no es confirmación real):** Varias decisiones de escrow "RELEASED" son **heurísticas, no confirmaciones de MercadoPago**. El cron marca Payout PAID / escrow RELEASED cuando MP reporta `approved` tras un hold local plano de 24h, **sin** chequear `money_release_date`. Esto significa que **los libros de WeTask divergen de la realidad de MercadoPago**: se reporta a taskers que cobraron cuando el dinero sigue retenido.
- **Lo que es peligroso / pérdida directa de dinero:** Reembolsos post-COMPLETED reembolsan al cliente mientras el tasker ya recibió el escrow (sin clawback). Un outage transitorio de MP puede cancelar en masa bookings sanos pagados. El webhook puede perder eventos permanentemente. La ruta legacy de status no tiene auth ni state machine.
- **Lo que falta por completo (missing):** No hay endpoint de cancelación. No hay UI ni API que lea payouts FAILED. No hay cola de bookings/pagos atascados. No hay lector de `AdminAuditLog`. No hay vista de providers con MP desconectado. No hay heartbeat/alerting de crons.
- **Demo-only / falso:** No se identificaron subsistemas puramente mock-demo en los hallazgos. El UX de "hold de slot de 5 minutos" es **advisory, no enforced** (efectivamente una promesa que no se cumple a nivel de checkout — ver B8). Las rutas SMS de teléfono son código muerto que aún puede romper el submit.

---

## 2. Dominio: BOOKING (Integridad del lifecycle)

**Resumen del dominio:** Core sólido (tx real con `FOR UPDATE`, state machine forzada en rutas marketplace, constraints `@unique`, webhook idempotente). PERO hay agujeros de integridad genuinamente peligrosos: el peor es que los payouts confirmados explícitamente por el cliente (PAYOUT_SCHEDULED) nunca se procesan; una ruta legacy de status sin auth bypasea toda la state machine; no hay endpoint de cancelación a pesar de las transiciones CANCELLED en la tabla; `dueDateAt` de disputas nunca se aplica; y varias decisiones de escrow "RELEASED" son heurísticas.

---

### B1 — PAYOUT_SCHEDULED nunca se procesa: payouts confirmados por el cliente congelados para siempre · **dangerous · critical**

**Archivos:**
- `src/app/api/marketplace/bookings/[bookingId]/customer-confirm/route.ts:49-99`
- `src/lib/payouts-processor.ts:38-215`
- `src/app/api/cron/process-bookings/route.ts:15-42`

**currentBehavior:** Cuando un cliente confirma vía `customer-confirm`, el booking transiciona `AWAITING_CUSTOMER_CONFIRMATION -> PAYOUT_SCHEDULED` y se crea una fila `Payout` con status `PENDING` dentro de una transacción (`customer-confirm/route.ts:62-99`). El único procesador de payouts, `processBookingsForPayout` (`payouts-processor.ts:41-46`), consulta estrictamente `where: { status: AWAITING_CUSTOMER_CONFIRMATION, paymentStatus: PAID, updatedAt <= cutoff }`. Un grep confirma que `PAYOUT_SCHEDULED` se escribe en dos lugares (customer-confirm y el path auto del processor) pero nunca es SELECTeado por ninguna query en el codebase.

**Gap:** Ningún job transiciona `PAYOUT_SCHEDULED -> COMPLETED`, marca el Payout PAID, ni setea `Payment.escrowStatus=RELEASED` para bookings que llegaron a PAYOUT_SCHEDULED vía confirmación explícita del cliente (el happy path primario). El Payout queda PENDING y el escrow HELD indefinidamente.

**Escenario de falla:** El cliente termina un trabajo limpio y clickea "Confirmar servicio". Booking → PAYOUT_SCHEDULED, Payout(status=PENDING) creado. El cron horario `process-bookings` corre pero su WHERE excluye PAYOUT_SCHEDULED, así que skippea el booking para siempre. El pro nunca cobra.

**Riesgo operacional:** **El más dañino de booking-integrity.** Todo cliente bien comportado que confirma deja a su pro sin pagar — lo opuesto al incentivo deseado. Churn masivo de pros, tickets de soporte, y responsabilidad de la plataforma por fondos retenidos.

**Fix:** Hacer que `processBookingsForPayout` consulte ambos estados: `status: { in: [AWAITING_CUSTOMER_CONFIRMATION, PAYOUT_SCHEDULED] }` (y relajar el cutoff de 24h para filas PAYOUT_SCHEDULED ya confirmadas, dado que el cliente ya consintió). Alternativa: que `customer-confirm` encole un job QStash de payout inmediato. Asegurar que el path `canTransition(PAYOUT_SCHEDULED -> COMPLETED, SYSTEM)` (ya legal en state machine línea 52) efectivamente corra.

---

### B2 — Ruta legacy `/api/bookings/[bookingId]/status` muta estado SIN auth y SIN state machine · **dangerous · critical**

**Archivos:**
- `src/app/api/bookings/[bookingId]/status/route.ts:7-51`

**currentBehavior:** El handler PATCH no importa `getRequestIdentity`/`hasRole` y no realiza autenticación ni autorización alguna. Parsea `input.status` y llama `prisma.booking.update({ data: { status: input.status, proId: ... } })` directamente. No hay `assertTransition`/`canTransition`, así que acepta cualquier valor de status que el schema permita desde cualquier caller.

**Gap:** `Booking.status` se muta fuera de la state machine y sin chequeo de actor/ownership, bypaseando completamente la protección de la que dependen todas las rutas marketplace.

**Escenario de falla:** Cualquiera que alcance el endpoint hace PATCH `{status:'COMPLETED'}` o `{status:'CONFIRMED'}` sobre un bookingId arbitrario, o reasigna `proId`. Por ejemplo: forzar un PENDING_PAYMENT (impago) directo a COMPLETED, o devolver un DISPUTE a CONFIRMED para destrabar un payout, o asignar un pro arbitrario para que cobre.

**Riesgo operacional:** Bypass total del gating de pago y de los holds de disputa: trabajos impagos marcados completos, disputas borradas, payouts redirigidos. Pérdida financiera directa y pérdida total de integridad de estado. Las demás rutas cuidadosamente protegidas son irrelevantes mientras exista esta.

**Fix:** Eliminar esta ruta legacy por completo (la ruta `marketplace/bookings/[bookingId]/status` ya cubre cambios PRO/ADMIN con `assertTransition`), o gatearla detrás de `requireAdminRequest` Y envolver el update con `assertTransition(booking.status, input.status, 'ADMIN')`. **No dejar un mutador de status sin auth en producción.**

---

### B3 — No existe endpoint de cancelación · **missing · high**

**Archivos:**
- `src/lib/booking-state-machine.ts:30-59`
- `src/app/api/marketplace/bookings/[bookingId]/status/route.ts:13-19`

**currentBehavior:** La state machine define muchas transiciones CANCELLED para CUSTOMER y PRO (ej. `CONFIRMED/ACCEPTED -> CANCELLED`). Pero un grep de 'cancel'/'CANCELLED' en todas las rutas API solo encuentra `me/account` (chequeo de borrado de cuenta) y `pro/slots/[slotId]` (guard de borrado de slot). La ruta marketplace de status restringe roles a ADMIN y PRO (línea 17), así que un CUSTOMER ni siquiera puede alcanzarla, y no hay ruta dedicada de cancelación que además reembolse + libere el slot.

**Gap:** No hay code path por el cual un cliente cancele un booking confirmado, ni path que en cancelación emita un refund y devuelva el `AvailabilitySlot` a `isAvailable=true`. La cancelación está modelada pero no implementada.

**Escenario de falla:** Un cliente necesita cancelar un booking pagado (riesgo de no-show del pro, conflicto de agenda). No hay API; el slot queda `isAvailable=false` para siempre y el pago queda PAID con dinero en escrow. Soporte debe editar la DB a mano y reembolsar manualmente.

**Riesgo operacional:** Cada cancelación se vuelve una operación manual de soporte+finanzas. Slots consumidos permanentemente por bookings muertos, reduciendo disponibilidad de pros. Clientes se sienten atrapados; suben los chargebacks porque el refund self-serve es imposible.

**Fix:** Agregar `POST /api/marketplace/bookings/[bookingId]/cancel`: autenticar CUSTOMER (dueño), PRO (asignado) o ADMIN, `assertTransition(status -> CANCELLED, actor)`, y en una transacción: setear `status=CANCELLED`; si `paymentStatus=PAID` llamar `refundProviderPayment` + setear `paymentStatus=REFUNDED`; y `updateMany` del bookedSlot a `isAvailable=true`, `heldExpiresAt/heldByUserId=null`. Agregar política de ventana/fee de cancelación.

---

### B4 — `dueDateAt` de disputas se escribe pero ningún job lo aplica · **partial · high**

**Archivos:**
- `src/app/api/marketplace/disputes/route.ts:70-87`
- `src/lib/payouts-processor.ts:50-58`
- `src/app/api/cron/process-bookings/route.ts`
- `prisma/schema.prisma:518`

**currentBehavior:** Crear una disputa setea `dueDateAt = now + 5 días` y mueve el booking a DISPUTE. `processBookingsForPayout` excluye cualquier booking con disputa OPEN/IN_REVIEW (`payouts-processor.ts:50-58`); `customer-confirm` y `payout-request` también bloquean mientras hay disputa abierta. Un grep muestra que `dueDateAt` se escribe en `disputes/route.ts` pero nunca es leído por ningún cron/job/query. No hay escalación de SLA ni auto-resolución.

**Gap:** Nada actúa sobre `dueDateAt`. Un booking en DISPUTE solo sale de ese estado vía un PATCH manual de admin en `admin/disputes`. No hay fallback si el admin nunca actúa.

**Escenario de falla:** El cliente abre una disputa frívola (o el pro abre una) y el admin está de vacaciones. Los 5 días de `dueDateAt` pasan sin efecto. El booking queda atascado en DISPUTE, el Payout bloqueado, el escrow HELD, y ninguna parte obtiene resolución. Bad actors pueden congelar indefinidamente los ingresos de un pro abriendo una disputa.

**Riesgo operacional:** Fondos de payout congelados sin garantía de SLA; disputas acumulándose sin límite; pros expuestos a "griefing". Erosión de confianza en ambos lados y backlog operacional ilimitado.

**Fix:** Agregar un cron (extender `process-bookings` o un nuevo job `dispute-sla`) que encuentre `DisputeTicket` con `status in (OPEN,IN_REVIEW)` y `dueDateAt < now`, y aplique una resolución por defecto definida (auto-escalar a IN_REVIEW con alerta a admin, o auto-release/auto-refund según política). Como mínimo, alertar a admins sobre disputas vencidas.

---

### B5 — Escrow RELEASED y Payout PAID seteados por heurística, no por confirmación real de MercadoPago · **partial · high**

**Archivos:**
- `src/lib/payouts-processor.ts:78-105`
- `src/lib/payouts-processor.ts:121-149`

**currentBehavior:** En `processBookingsForPayout`, si MP retorna `providerResult.status === 'approved'`, el código setea `payoutStatus=PAID` y `escrowStatus='RELEASED'` (líneas 88-90), con un comentario que admite *"Como heuristica pragmatica consideramos el approved estable como RELEASED tras pasar el hold local de 24h"*. No chequea `money_release_date` ni consulta el status de disbursement/release de MP. Luego marca el Payout local PAID y el Booking COMPLETED.

**Gap:** Un pago MP está `approved` en el momento en que se captura, mucho antes de que la `money_release_date` del escrow marketplace libere fondos al collector. El código confunde "pago aprobado" con "fondos liberados al pro".

**Escenario de falla:** MP retiene fondos marketplace varios días. 24h después de AWAITING_CUSTOMER_CONFIRMATION el cron ve `status=approved`, marca Payout PAID + Booking COMPLETED + escrow RELEASED, y emailea al pro "tu payout fue liberado". El pro revisa su cuenta MP y el dinero no está (sigue en escrow), generando carga de soporte y desconfianza; los libros de WeTask dicen PAID mientras MP dice retenido.

**Riesgo operacional:** Los libros divergen de la realidad de MercadoPago; pros notificados de un cobro que no recibieron; pesadillas de reconciliación; potencial sub/sobre-conteo de pasivos de la plataforma.

**Fix:** Solo setear `escrowStatus=RELEASED`/`Payout=PAID` cuando MP confirme la liberación: inspeccionar `money_release_date` (debe estar en el pasado) y/o consultar el status de disbursement, no meramente `status=approved`. Hasta entonces mantener `Payout=PROCESSING` y re-pollear. Hacer que la notificación al pro refleje con precisión "agendado" vs "liberado".

---

### B6 — Creación pública de bookings genera órdenes huérfanas sin pago, sin pro, sin slot · **dangerous · medium**

**Archivos:**
- `src/app/api/bookings/public/route.ts:45-95`
- `src/app/api/bookings/route.ts:47-86`

**currentBehavior:** `POST /api/bookings/public` y `POST /api/bookings` crean un Booking solo con `customerId, serviceId, scheduledAt`, campos de dirección y `totalPriceClp=service.basePriceClp`. Sin `proId`, sin `bookedSlotId`, sin fila Payment, y status default PENDING (`schema.prisma:362`). Nunca se inicia un pago y no hay auth en la ruta pública (hace upsert del usuario por email).

**Gap:** Estos bookings existen en PENDING con `paymentStatus=PENDING` para siempre. No están en PENDING_PAYMENT (así que `reconcile-payments` los ignora — solo mira filas Payment), no atados a slot, y sin Payment. Nada los transiciona ni limpia.

**Escenario de falla:** Un visitante envía el form público. Se crea un Booking PENDING sin pago ni pro. Polluciona dashboards/listas (el GET de la ruta bookings los retorna), representa una orden fantasma que nadie cumplirá. Emails spammy pueden crear masivamente usuarios + bookings.

**Riesgo operacional:** La DB se llena de bookings huérfanos fantasma; métricas y dashboards de pro/cliente polucionados; vector de abuso para creación no autenticada de usuario+booking. Los operadores no pueden distinguir intención real del ruido.

**Fix:** O eliminar estas rutas legacy no autenticadas en favor del flujo de checkout, o que creen el booking en PENDING_PAYMENT atado a un payment intent y agregar un cron que expire bookings PENDING/PENDING_PAYMENT sin Payment tras N minutos. Agregar auth a la ruta pública o rate limiting estricto + verificación de email antes de persistir.

---

### B7 — Slot puede perderse silenciosamente (orphan booked=false) cuando falla el proveedor de pago a mitad de flujo · **partial · medium**

**Archivos:**
- `src/app/api/bookings/checkout/route.ts:324-462`
- `src/lib/payouts-processor.ts:223-239`

**currentBehavior:** Checkout marca el slot `isAvailable=false` dentro de la tx, luego llama a MP fuera de la tx. Ante excepción del proveedor corre una tx compensatoria que devuelve el slot a `isAvailable=true` (líneas 453-458), y ante webhook/reconcile PAYMENT_FAILED también lo libera. `releaseExpiredHolds` (`payouts-processor.ts:223-239`) solo libera slots con `isAvailable: true AND bookings: { none: {} }` — es decir, nunca libera un slot que esté `isAvailable=false`.

**Gap:** Si el proceso crashea entre la creación del booking (slot `isAvailable=false`, booking PENDING_PAYMENT) y el manejo del resultado del proveedor, el bloque compensatorio nunca corre. El slot queda `isAvailable=false` con un booking PENDING_PAYMENT atado. `releaseExpiredHolds` explícitamente skippea slots con cualquier booking, y `reconcile-payments` solo libera ante status FAILED — pero un booking PENDING_PAYMENT nunca confirmado cuyo Payment no tiene `providerPaymentId` nunca se reconcilia (reconcile requiere `providerPaymentId` not null, `payouts-processor.ts:282`).

**Escenario de falla:** Cliente inicia checkout; `createMercadoPagoMarketplacePayment` se cuelga y la función serverless hace timeout tras reservar el slot y crear Payment con `providerStatus='created'` pero sin `providerPaymentId`. El Booking queda PENDING_PAYMENT, el slot `isAvailable=false` para siempre, y reconcile lo skippea. El slot queda permanentemente no reservable.

**Riesgo operacional:** Fuga silenciosa de slots: los pros pierden inventario reservable sin señal. Con el tiempo, el calendario de un pro se llena de slots muertos. Requiere limpieza manual de DB.

**Fix:** Agregar un cron de limpieza para bookings PENDING_PAYMENT stale: si un booking es PENDING_PAYMENT sin `providerPaymentId` (o `Payment.providerStatus` aún 'created') más viejo que ~15 min, transicionar a PAYMENT_FAILED/CANCELLED y liberar el bookedSlot. También incluir esos bookings en reconcile re-consultando MP vía `idempotencyKey`/`externalReference` aunque `providerPaymentId` sea null.

---

### B8 — Double-hold de slot bien protegido, pero el hold no se re-valida atómicamente por dueño en checkout · **partial · low**

**Archivos:**
- `src/app/api/bookings/slot-hold/route.ts:42-65`
- `src/app/api/bookings/checkout/route.ts:129-170`
- `src/app/api/bookings/checkout/route.ts:324-338`

**currentBehavior:** `slot-hold` usa un `updateMany` condicional (solo toma el slot si `holdExpiresAt` es null/expirado o el hold es del caller), previniendo correctamente holds concurrentes y devolviendo 409. Checkout re-chequea `slot.isAvailable` y dentro de la tx hace `SELECT ... FOR UPDATE` sobre `isAvailable=true` antes de setear `isAvailable=false`, serializando correctamente checkouts concurrentes sobre el mismo slot. Sin embargo, checkout nunca verifica que `holdExpiresAt`/`heldByUserId` pertenezca al cliente comprador — solo chequea `isAvailable`.

**Gap:** Un cliente que nunca tomó el slot (o cuyo hold expiró y otro usuario lo tiene) puede igual completar checkout mientras el slot siga `isAvailable=true`, porque el guard FOR UPDATE solo chequea `isAvailable`, no ownership del hold. El hold de 5 minutos es por tanto **advisory, no forzado** en la compra.

**Escenario de falla:** Usuario A tiene el slot S (holdExpiresAt futuro, heldByUserId=A). Usuario B, que nunca lo tomó, hace race de checkout para S; como `isAvailable` sigue true, el SELECT FOR UPDATE de B tiene éxito y B lo reserva, derrotando el hold de A. A termina su wizard y recibe un 409. Dentro del diseño esto es "el primero que paga gana", pero hace que el UX del hold sea una mentira.

**Riesgo operacional:** Bajo riesgo financiero (solo un booking tiene éxito, sin doble cobro) pero mal UX/confianza: un cliente que "reservó" un slot por 5 minutos puede perderlo ante un pagador más rápido.

**Fix:** En el guard FOR UPDATE del checkout, requerir también que el hold pertenezca al comprador o esté libre/expirado: extender el WHERE del raw query a `("heldByUserId" = ${customerId} OR "holdExpiresAt" IS NULL OR "holdExpiresAt" < now())`, devolviendo el mismo 409 en caso contrario.

---

### B9 — `check-in`/`on-the-way` mutan booking sin `assertTransition` · **partial · low**

**Archivos:**
- `src/app/api/marketplace/bookings/[bookingId]/check-in/route.ts:71-110`
- `src/app/api/marketplace/bookings/[bookingId]/on-the-way/route.ts:40-55`

**currentBehavior:** `check-in` gatea sobre una lista hardcodeada `VALID_STATUSES` y `paymentStatus=PAID`, luego computa `nextStatus` vía `canTransition(...,'PRO')` con fallback al status actual; actualiza status dentro de una tx pero no usa `assertTransition` (tolera quedarse en el mismo status). `on-the-way` gatea sobre `VALID_STATUSES` y solo escribe `onTheWayAt` (sin cambio de status). Funcionalmente seguros hoy gracias a las allow-lists explícitas.

**Gap:** Las reglas de transición de estas acciones viven en dos lugares (arrays hardcodeados + state machine) en vez de forzarse centralmente vía `assertTransition`. La deriva entre los arrays y `BOOKING_TRANSITIONS` podría permitir una transición inconsistente en el futuro.

**Escenario de falla:** Si luego se agrega un nuevo `BookingStatus` o se cambia la state machine, el array `VALID_STATUSES_FOR_CHECK_IN` no se actualizará en sincronía, permitiendo un check-in (y transición IN_PROGRESS) desde un estado que la máquina central prohibiría.

**Riesgo operacional:** Hoy bajo; principalmente riesgo de mantenibilidad/consistencia que podría volverse bug de integridad a medida que evolucionan los estados.

**Fix:** Reemplazar los arrays hardcodeados por `assertTransition`/`canTransition` contra la state machine central. Mantener el guard `paymentStatus=PAID`. Hacer de la state machine la única fuente de verdad para toda ruta que cambie status.

---

### B10 — `payout/request` crea Payout sin cambiar estado → flujo competidor con el cron · **partial · low**

**Archivos:**
- `src/app/api/marketplace/bookings/[bookingId]/payout/request/route.ts:22-69`
- `src/lib/payouts-processor.ts:108-127`

**currentBehavior:** `payout/request` (pro/admin) permite crear un Payout cuando el status es AWAITING_CUSTOMER_CONFIRMATION o PAYOUT_SCHEDULED, protegido por `Payout.bookingId @unique` y un chequeo de existencia. Crea Payout(PENDING) pero NO cambia `Booking.status`. Por separado, `processBookingsForPayout` para AWAITING_CUSTOMER_CONFIRMATION reutiliza `booking.payout` si existe (`payouts-processor.ts:110-119`), y el unique constraint previene una fila duplicada.

**Gap:** El `@unique` previene dos filas Payout, así que no hay double-payout. Pero los flujos no están coordinados: un pro puede auto-crear un Payout PENDING mientras el booking sigue AWAITING_CUSTOMER_CONFIRMATION (antes de que el cliente confirme), y el cron luego puede flipearlo a PAID al pasar las 24h — aunque el cliente nunca confirmó explícitamente.

**Escenario de falla:** El pro pega `payout/request` justo tras marcar el trabajo hecho. Existe un Payout PENDING. El cron de 24h lo paga basado en la heurística approved. Si el cliente iba a abrir una disputa el día 2, la disputa ahora colisiona con un payout ya PAID (DISPUTE desde PAYOUT_SCHEDULED es legal, pero los fondos pueden ya estar liberados).

**Riesgo operacional:** Bajo (sin filas duplicadas gracias al `@unique`) pero el path de payout-request descoordinado ensancha la ventana donde los fondos se liberan antes de respetar la confirmación/disputa del cliente. Principalmente un tema de consistencia de política.

**Fix:** O eliminar el endpoint `payout/request` iniciado por pro (confiar solo en customer-confirm + cron), o hacer que solo agende (no habilite PAID) y asegurar que la ventana de disputa se respete antes de cualquier release. Documentar el único path canónico de payout.

---

## 3. Dominio: PAYMENTS (MercadoPago Marketplace)

**Resumen del dominio:** WeTask usa MercadoPago Marketplace con `application_fee` para escrow nativo. El happy path está razonablemente construido (idempotencyKey único, `Payout.bookingId` único, webhook idempotente vía `ProcessedWebhookEvent`, refunds llamados antes de la tx, cron de refresh de tokens). PERO hay varios gaps reales de corrección monetaria, varios de ellos críticos.

---

### P1 — Webhook registra `ProcessedWebhookEvent` ANTES de la mutación de DB · **dangerous · critical**

**Archivos:**
- `src/app/api/payments/webhook/mercadopago/route.ts:116-130`
- `src/app/api/payments/webhook/mercadopago/route.ts:165-204`

**currentBehavior:** La ruta hace `prisma.processedWebhookEvent.create({ eventId })` en la línea 117, devolviendo 200 'duplicate' ante violación de unique P2002. Solo DESPUÉS llama `getProviderPayment` y corre la `prisma.$transaction` (líneas 165-204) que actualiza Payment y Booking. Si esa tx lanza (caída de DB, deadlock, falla de serialización, edge de transición), el catch en la línea 226 devuelve 500 — pero la fila `ProcessedWebhookEvent` ya está commiteada y NO se hace rollback.

**Gap:** El marcador de idempotencia se commitea antes del side effect que se supone debe proteger. No hay delete compensatorio ni un flag 'processed' separado seteado solo tras éxito.

**Escenario de falla:** MP envía el webhook 'payment approved'. La fila del evento se escribe, luego la `$transaction` falla (ej. corte de conexión Postgres). WeTask devuelve 500. MP reintenta el mismo webhook; la firma pasa, el create del evento pega P2002 y el handler devuelve 200 `{duplicate:true}` en la línea 127 SIN actualizar nunca Payment/Booking. El Payment queda PENDING y el Booking PENDING_PAYMENT para siempre aunque el cliente fue cobrado.

**Riesgo operacional:** Bookings pagados atascados en PENDING_PAYMENT: cliente cobrado, tasker nunca ve un trabajo confirmado, payout nunca agendado. Pérdida silenciosa de revenue/booking que requiere cirugía manual de DB. `reconcilePendingPayments` rescata parcialmente esto (re-consulta pagos PENDING >10min) pero solo si `providerPaymentId` ya estaba guardado — para el primerísimo webhook de aprobación `providerPaymentId` puede ser aún null, así que reconcile puede fallar.

**Fix:** Mover el insert de `ProcessedWebhookEvent` DENTRO de la misma `prisma.$transaction` que muta Payment/Booking (`tx.processedWebhookEvent.create` al inicio de la tx). Así el dedupe por unique-constraint y el side effect commitean o hacen rollback atómicamente. Mantener el short-circuit P2002 → 200, pero chequear el evento existente dentro de la tx para que una mutación fallida también haga rollback del marcador, permitiendo que el retry de MP reprocese.

---

### P2 — Payout PAID / escrow RELEASED por heurística de 24h sin `money_release_date` · **dangerous · high**

**Archivos:**
- `src/lib/payouts-processor.ts:68-105`
- `src/lib/payouts-processor.ts:121-148`

**currentBehavior:** `processBookingsForPayout` toma bookings AWAITING_CUSTOMER_CONFIRMATION + PAID + `updatedAt` más viejo que un `HOLD_HOURS=24` plano. Re-consulta MP y si `providerResult.status === 'approved'` setea `payoutStatus=PAID` y `escrowStatus='RELEASED'` (líneas 88-90), luego `Payout.paidAt=now` y Booking→COMPLETED. El comentario en líneas 84-87 admite explícitamente que es una 'heuristica pragmatica' que ignora `money_release_date`.

**Gap:** En MP Marketplace el dinero queda en escrow hasta la `money_release_date` propia de MP (a menudo días). 'approved' solo significa que el cargo se liquidó, NO que los fondos fueron liberados al collector. El processor nunca lee `payload.money_release_date` antes de declarar RELEASED.

**Escenario de falla:** Un booking es approved, el cliente no disputa, pasan 24h. El cron ve status 'approved', flipea Payout=PAID, escrow=RELEASED, Booking=COMPLETED — pero MP retiene los fondos varios días más. El libro de WeTask y la app del tasker ahora dicen 'paid/liberado' mientras el tasker no tiene dinero en MP.

**Riesgo operacional:** Desincronización del libro contra la realidad de MP; taskers notificados de un cobro inexistente. Además, como COMPLETED es terminal para refunds (ver P3), completar prematuramente cierra el path de refund antes de que termine la ventana de chargeback/return de MP.

**Fix:** Leer `providerResult.raw.money_release_date` y el sub-status released. Solo setear `escrowStatus='RELEASED'`/`Payout=PAID` cuando `status==='approved'` AND `money_release_date <= now` (o MP reporte el release en el campo `released`). En caso contrario, mantener escrow 'HELD' y Payout en PROCESSING/PAYOUT_SCHEDULED. Usar el timestamp real de release para `escrowReleasedAt` en vez de `new Date()`.

---

### P3 — Reembolso post-COMPLETED imposible: disputes reembolsa en MP primero y luego falla la transición ilegal · **dangerous · critical**

**Archivos:**
- `src/app/api/marketplace/admin/disputes/route.ts:208-242`
- `src/app/api/marketplace/admin/disputes/route.ts:271-279`
- `src/lib/booking-state-machine.ts:56-72`

**currentBehavior:** El PATCH de disputes valida `canTransition(status, REFUNDED, 'ADMIN')` en la línea 208 y devuelve 409 si es ilegal. Pero la state machine solo permite REFUNDED desde CONFIRMED/ACCEPTED/IN_PROGRESS/AWAITING_CUSTOMER_CONFIRMATION/PAYOUT_SCHEDULED/DISPUTE — NO hay edge COMPLETED→REFUNDED (líneas 56-72). COMPLETED solo puede ir a DISPUTE (línea 72). Así que una vez que `processBookingsForPayout` setea un booking COMPLETED, un refund queda estructuralmente bloqueado. Peor: cuando SÍ se intenta un refund sobre una DISPUTE que vino de COMPLETED, la llamada de refund a MP en la línea 224 ocurre ANTES de la tx; el `assertTransition` dentro de la tx (línea 272) puede tener éxito solo porque DISPUTE→REFUNDED es legal — pero el dinero del escrow ya fue RELEASED al tasker en la completación, así que MP reembolsa al cliente con fondos de la plataforma mientras el tasker conserva el payout liberado.

**Gap:** No hay mecanismo para clawback o neteo de un payout ya liberado cuando se emite un refund post-completación. Una vez COMPLETED+RELEASED, reembolsar al cliente es dinero perdido sin recuperación del tasker.

**Escenario de falla:** El cron auto-completa un booking a las 24h y libera escrow al tasker. Dos días después el cliente abre disputa (COMPLETED→DISPUTE permitido), el admin resuelve con refund total. `refundProviderPayment` pega MP y tiene éxito; el cliente recupera su dinero. Pero el tasker ya recibió el escrow. WeTask come la pérdida sin débito al tasker.

**Riesgo operacional:** **Pérdida financiera directa e irrecuperable** igual al monto reembolsado en cualquier disputa post-completación. Escala con el volumen de auto-completación.

**Fix:** Dos partes: (1) No marcar Booking COMPLETED / escrow RELEASED hasta que la ventana de chargeback+refund de MP esté genuinamente cerrada (atar a `money_release_date` + buffer). (2) Antes de reembolsar en la ruta de disputes, chequear `Payout.status===PAID`/`escrowStatus==='RELEASED'`; si está liberado, bloquear el refund automático y requerir un flujo explícito de clawback/saldo-negativo al tasker, o reembolsar solo la porción de platform-fee. Persistir un asiento de ledger capturando el neteo payout-vs-refund.

---

### P4 — Cron de payout no valida que el token del collector siga ACTIVE antes de liberar · **partial · high**

**Archivos:**
- `src/lib/payouts-processor.ts:54-105`
- `src/lib/account-cleanup-processor.ts:123-189`
- `src/app/api/bookings/checkout/route.ts:271-287`

**currentBehavior:** `processBookingsForPayout` selecciona `booking.pro.mpAccessToken` y, si existe, llama `getMercadoPagoMarketplacePayment` con él (líneas 80-82). Si `mpAccessToken` es null, hace fallback silencioso al token de PLATAFORMA `getMercadoPagoPayment` (línea 82). Nunca chequea `pro.mpAccountStatus`. `refreshExpiringMpTokens` setea `mpAccountStatus='DISABLED'` y deja el `mpAccessToken` ahora-revocado en su lugar cuando un refresh falla (`account-cleanup-processor.ts:166-180` solo actualiza status, no el token).

**Gap:** Sin guard de que la cuenta collector siga ACTIVE/conectada al momento del payout. El query marketplace hace fallback al token de plataforma, que consulta el pago bajo el contexto de cuenta EQUIVOCADO, y el resultado igual maneja RELEASED. Checkout fuerza `mpAccountStatus==='ACTIVE'` (línea 279) pero el path de payout no.

**Escenario de falla:** El token MP de un tasker se revoca entre booking y el payout de 24h. El cron de refresh lo flipea a DISABLED pero el booking ya está PAID y AWAITING_CONFIRMATION. El cron de payout igual corre: con el token stale la llamada marketplace falla (caught → PROCESSING) o, si el token fue nulleado por anonimización, hace fallback al token de plataforma, puede ver 'approved' y marca escrow RELEASED para un tasker que ya no puede recibir fondos en MP.

**Riesgo operacional:** Escrow marcado como liberado a un collector desconectado/deshabilitado; fondos atascados en MP bajo un link revocado; tasker nunca pagado pero los libros dicen pagado. Carga de confianza + reconciliación.

**Fix:** En `processBookingsForPayout`, requerir `booking.pro.mpAccountStatus==='ACTIVE'` y `mpAccessToken` no-null para proceder; en caso contrario dejar Payout PROCESSING y notificar al tasker para que reconecte. Nunca hacer fallback al token de plataforma para confirmar un release marketplace. Ante falla de refresh, limpiar/flaggear también el `mpAccessToken` stale.

---

### P5 — Reembolso parcial deja escrow/payout intactos · **partial · high**

**Archivos:**
- `src/app/api/marketplace/admin/disputes/route.ts:244-291`
- `src/lib/payouts-processor.ts:88-105`

**currentBehavior:** En refund parcial la ruta de disputes setea `Payment.status=PARTIAL_REFUNDED` y `Booking.status=REFUNDED` (líneas 244-279). El monto de payout se computa en otro lado como `totalPriceClp - platformFeeClp` y nunca se reduce por el refund parcial. El payout processor solo trata el status 'refunded' (total) de MP como bloqueante (líneas 91-94); un refund parcial sigue mostrando status 'approved'.

**Gap:** Los refunds parciales no ajustan `payoutAmount`, `escrowStatus`, ni bloquean el release. El `Payout.amountClp` queda congelado en el valor total.

**Escenario de falla:** El admin emite un refund parcial del 50% por queja de calidad. Booking va REFUNDED, Payment PARTIAL_REFUNDED. Pero si ya existía un Payout de monto completo (creado por payout-request o customer-confirm), el tasker sigue agendado para recibir el monto completo pre-refund, así que la plataforma paga dinero que ya reembolsó al cliente.

**Riesgo operacional:** Neto negativo en cada refund parcial donde existe un payout de valor completo: refund al cliente + payout completo al tasker. Dinero perdido igual a la porción reembolsada.

**Fix:** En refund parcial, recomputar y decrementar `Payout.amountClp` por el monto reembolsado (y la parte de `application_fee` correspondiente), setear `escrowStatus` a un estado 'PARTIALLY_REFUNDED', y que `processBookingsForPayout` excluya pagos REFUNDED/PARTIAL_REFUNDED y honre el monto ajustado.

---

### P6 — Webhook `refunded`/`failed` aplicado a booking ya completado desincroniza Payment vs Booking · **partial · medium**

**Archivos:**
- `src/app/api/payments/webhook/mercadopago/route.ts:158-204`
- `src/lib/payouts-processor.ts:88-90`

**currentBehavior:** El webhook computa `transitionAllowed=canTransition(...)`. Cuando es false (ej. un webhook 'refunded' tardío llega tras COMPLETED — COMPLETED→REFUNDED es ilegal), igual actualiza `Payment.status` a REFUNDED (líneas 166-180) pero solo setea `Booking.paymentStatus=REFUNDED` DEJANDO `booking.status=COMPLETED` (líneas 190-196).

**Gap:** `Payment.status=REFUNDED` mientras `Booking.status=COMPLETED` y un Payout posiblemente PAID. No se levanta alerta ni cola para esta divergencia; solo persiste un estado contradictorio.

**Escenario de falla:** MP procesa un chargeback/refund out-of-band tras auto-completar el booking. El webhook marca Payment REFUNDED pero el booking queda COMPLETED con el tasker ya pagado. La contradicción es invisible para operadores.

**Riesgo operacional:** Inconsistencia silenciosa de ledger: un booking completado y pagado cuyo pago está reembolsado. Requiere reconciliación manual; el dinero ya liberado al tasker se pierde.

**Fix:** Cuando llega un status 'refunded'/'failed' pero la transición es ilegal, levantar una alerta explícita de reconciliación / crear una tarea de admin (e idealmente un DISPUTE) en vez de escribir silenciosamente un `paymentStatus` contradictorio. Agregar un chequeo periódico de invariante para `Payment.status=REFUNDED` con `Payout.status=PAID`.

---

### P7 — `refundMercadoPagoPayment` trata cualquier 2xx como éxito total, no valida el status del objeto refund de MP · **partial · medium**

**Archivos:**
- `src/lib/payments/providers/mercadopago.ts:488-526`
- `src/app/api/marketplace/admin/disputes/route.ts:229-241`

**currentBehavior:** `refundMercadoPagoPayment` hace POST a `/v1/payments/{id}/refunds` y, si `response.ok`, retorna incondicionalmente `status:'refunded'` con `amount = payload.amount ?? input.amount` (líneas 513-525). No inspecciona el campo `status` propio del objeto refund (los refunds de MP pueden ser 'approved' o 'in_process'/pending). La ruta de disputes luego persiste Payment REFUNDED/PARTIAL_REFUNDED basado puramente en ese 'refunded'.

**Gap:** Un refund que MP acepta pero deja en `in_process` se registra como completado total. Ningún reconcile re-chequea la completación del refund.

**Escenario de falla:** MP retorna 201 con el refund en 'in_process'. WeTask registra el booking REFUNDED y emailea al cliente 'se procesó un reembolso'. Si MP luego rechaza/revierte el refund, el estado de WeTask queda mal y el cliente fue notificado de dinero que no viene.

**Riesgo operacional:** Cliente notificado de reembolso cuando está pending/failed; daño de confianza y disputas. Potencial doble-refund si un operador reintenta.

**Fix:** Parsear el `payload.status` del refund y solo retornar 'refunded' cuando MP confirme 'approved'; en caso contrario retornar un status 'pending' que la ruta de disputes pueda retener. Agregar un job reconcile que re-consulte el status del refund. Validar que `payload.amount` iguale el `refundAmount` solicitado antes de persistir PARTIAL_REFUNDED vs REFUNDED.

---

### P8 — Sin reconciliación de `application_fee`: comisión solo sobre labor, extras pasan 100% al tasker · **partial · medium**

**Archivos:**
- `src/lib/marketplace-pricing.ts:23-53`
- `src/app/api/bookings/checkout/route.ts:241-250`
- `src/app/api/bookings/checkout/route.ts:386-435`
- `src/lib/payouts-processor.ts:69`

**currentBehavior:** `calculateMarketplacePrice` computa `platformFeeClp = round(subtotal * pct)` — fee solo sobre LABOR, no sobre extras (materiales/urgencia/viaje). `total = subtotal + extras + fee` (fee sumado encima, cobrado al cliente). Checkout envía `application_fee = price.platformFeeClp` a MP (checkout línea 433) y guarda `applicationFeeClp=platformFeeClp`. El collector recibe `total - fee = subtotal + extras`. El payout = `totalPriceClp - platformFeeClp = subtotal + extras` (payouts-processor línea 69), internamente consistente con lo que MP efectivamente paga al collector.

**Gap:** Los números son auto-consistentes, pero la plataforma gana comisión solo sobre el subtotal de labor — los extras (materiales, recargo de urgencia, fee de viaje) pasan 100% al tasker sin comisión. No hay registro de ledger separado del fee ganado por WeTask vs la retención de `application_fee` de MP, así que el reporting financiero depende de recomputar desde columnas del booking.

**Escenario de falla:** No es un crash de código, sino un tema de margen/reporting: un booking con altos extras de viaje+materiales le da al tasker los extras completos mientras la comisión de WeTask se computa solo sobre la porción de labor. Si el producto pretendía comisión sobre el valor total del servicio, WeTask está sub-cobrando en cada booking con extras.

**Riesgo operacional:** Potencial sub-recaudación sistemática de comisión y sin ledger de fee de primera clase para contabilidad/reconciliación de boleta. Confirmar con producto si el fee debe aplicar a extras.

**Fix:** Decidir explícitamente si `platformFeePct` aplica a `subtotal+extras` o solo `subtotal`, y documentarlo. Persistir una fila de ledger dedicada (platform fee, `application_fee` enviado a MP, neto al tasker) por pago, en vez de derivarla de columnas del booking al leer, para que reporting y refunds neteen contra una única fuente de verdad.

---

### P9 — Ventana de refresh de token asume 7 días; tokens que expiran mid-lifecycle no se re-validan proactivamente · **partial · low**

**Archivos:**
- `src/lib/account-cleanup-processor.ts:112-159`
- `src/lib/payouts-processor.ts:78-101`

**currentBehavior:** `refreshExpiringMpTokens` corre (diario según el comentario del cron) y refresca tokens que expiran dentro de 7 días, solo para `mpAccountStatus==='ACTIVE'`. El payout processor usa `booking.pro.mpAccessToken` al momento del payout sin re-chequear expiración; si está expirado solo atrapa el error de MP y deja Payout PROCESSING (líneas 98-101).

**Gap:** Dependencia de un refresh de background que corre diariamente; un token puede estar igual expirado en el preciso momento de la llamada de payout, y la única recuperación es PROCESSING indefinido sin escalación tras N reintentos.

**Escenario de falla:** El token de un tasker expira y el refresh diario no corrió / falló. Múltiples bookings quedan en PROCESSING de payout a través de varios ciclos de cron sin alerta al operador, así que los taskers silenciosamente no cobran.

**Riesgo operacional:** Payouts demorados/atascados para taskers afectados; sin breach de SLA visible.

**Fix:** Agregar un umbral de max-retry/age en payouts PROCESSING que escale a alerta de admin y al tasker, e intentar un refresh de token on-demand dentro del path de payout antes de rendirse.

---

## 4. Dominio: ONBOARDING (Provider onboarding)

**Resumen del dominio:** El onboarding de taskers es un wizard de 12 pasos respaldado por `CleaningOnboarding`, gateado por un flujo admin approve→activate, con publicación marketplace manejada por `getTaskerPublicationState` + funciones de sync. El gate core de seguridad monetaria es **sólido** (search/availability/checkout requieren `mpAccountStatus === "ACTIVE"` a nivel de query DB, y checkout además 409 con `tasker_mp_not_connected`). La validación de submit es razonablemente estricta (~30 campos). Sin embargo hay gaps reales de confiabilidad/confianza.

---

### O1 — Taskers aprobados-pero-no-activados se vuelven visibles en search antes del gate de activación · **dangerous · high**

**Archivos:**
- `src/app/api/admin/onboarding/cleaning/route.ts:368-445`
- `src/lib/tasker-publication.ts:266-390`
- `src/app/api/marketplace/search-professionals/route.ts:32,342-361`
- `src/lib/tasker-publication.ts:97-136`

**currentBehavior:** La acción admin 'approve' (`route.ts:368`) setea status APROBADO y llama `syncTaskerMarketplaceServicesFromOnboarding`, que hace upsert del `ProfessionalProfile` con `isVerified:true` / `verificationStatus:'APPROVED'` y crea filas `TaskerService` activas (`tasker-publication.ts:319-358,224`). NO setea status ACTIVO. La acción 'activate' separada es la que fuerza `serviceCommunes>0` (`route.ts:479`) y los requisitos completos de publicación (`route.ts:527-537`). Pero `search-professionals` consulta `professionalProfile` con `isVerified:true` + `user.mpAccountStatus ACTIVE`, luego aplica un fallback legacy (search route líneas 352-356) que admite cualquier perfil cuyos únicos requisitos faltantes estén en `{onboarding_completed, published, status_active}`. Tras approve, un tasker conectado a MP tiene `isVerified=true`, servicios activos, commune y rate satisfechos — así que lo único faltante es exactamente ese set legacy, y el tasker aparece en search y es reservable.

**Gap:** El modelo admin de dos pasos approve→activate asume que APROBADO no es público, pero el fallback legacy-verified de search **publica perfiles APROBADO, saltándose silenciosamente el gate de activación** (validación de commune, generación de slots de disponibilidad, `activatedAt` audit).

**Escenario de falla:** El admin aprueba a un tasker para destrabarlo, pretendiendo hacer un check de activación final luego. El tasker conectó MercadoPago. En minutos aparece en resultados de búsqueda y recibe un booking pagado y confirmado — antes de que el admin corra el paso de activación que valida communes y genera slots. Si el perfil fue aprobado con un set de communes vacío/erróneo que approve nunca chequeó, el cliente reserva a alguien que no atiende su área.

**Riesgo operacional:** Bookings llegan a providers que el operador cree aún en 'pending activation', socavando el gate de calidad manual. Clientes matcheados con providers de cobertura no validada → no-shows / cancelaciones / refunds, erosionando la confianza en el marketplace curado.

**Fix:** Hacer que la publicación requiera status ACTIVO. O (a) eliminar el fallback legacy-verified en `search-professionals` (líneas 352-361) para que `canAppearInSearch` (que requiere `status==='active'`) sea autoritativo, o (b) en la acción approve, NO setear `isVerified=true` hasta la activación — pasar un flag a `syncTaskerMarketplaceServicesFromOnboarding` para que cree TaskerServices pero deje `profile.isVerified=false` hasta que corra activate. Dado que el query DB filtra por `isVerified:true`, la opción (b) previene limpiamente que APROBADO emerja.

---

### O2 — `approve` no valida requisitos de publicación que `activate` sí fuerza · **partial · medium**

**Archivos:**
- `src/app/api/admin/onboarding/cleaning/route.ts:368-398,479-537`

**currentBehavior:** La rama 'approve' solo guardea sobre `sync.updated===0 && reason!=='synced'` (`route.ts:382`). No llama `getTaskerPublicationState`, no requiere `serviceCommunes>0`, ni chequea rate/categoría como la rama 'activate' (`route.ts:479-537`). Como approve setea `isVerified=true` + servicios activos (ver O1), un perfil que FALLARÍA el check de activación puede igual ser aprobado y publicado vía el fallback de search.

**Gap:** Approve y activate usan validación diferente e inconsistente. Los checks más estrictos viven solo en activate, pero la publicación puede ocurrir en approve.

**Escenario de falla:** Una fila de onboarding tiene `serviceCommunes` vacío (ej. data drift, o solo `baseCommune` seteado). `syncTaskerServicesForCategory` tiene éxito (solo necesita `categorySlug` + un Service que matchee), así que `sync.updated>0` y approve tiene éxito. El tasker ahora está verificado y, si está conectado a MP, emerge en search. El gate de activate que lo habría rechazado por 'commune' faltante nunca es lo que controla la visibilidad.

**Riesgo operacional:** Providers con datos de cobertura/precio incompletos van en vivo, causando resultados de búsqueda mismatcheados y bookings rotos. El modelo mental del operador ('nada es público hasta que activo y pasa los checks') es falso.

**Fix:** En la rama approve, antes/después del sync, computar `getTaskerPublicationState` para el usuario y rechazar (409 con `missingRequirements`, excluyendo published/status_active) igual que la rama activate (`route.ts:532-537`). Alternativa: no publicar en approve (diferir `isVerified` a activate).

---

### O3 — Documentos de identidad y fotos guardados como base64 multi-MB en DB cuando R2 no está configurado · **partial · medium**

**Archivos:**
- `src/lib/validators.ts:247-255,314-331,486-489,653-662`
- `src/app/trabaja-con-nosotros/registro/utils.ts:203-234`
- `src/lib/storage/r2.ts:82-89,147-157`
- `src/app/api/uploads/presign/route.ts:27-32`

**currentBehavior:** `uploadAssetViaPresign` (`utils.ts:226-234`) llama `/api/uploads/presign`; si el storage no está configurado la ruta devuelve 503, el cliente hace fallback a `fileToDataUrl` y guarda la data URL base64 completa en el campo de onboarding. `validators.ts` (`imageDataUrlSchema`/`pdfOrImageDataUrlSchema`, 314-331) acepta O una storage key O una data URL base64 hasta 8MB. El schema `profilePhotoUrl` de la ruta pública start (`validators.ts:247-255`) acepta SOLO `data:` base64 (sin path de storage key). `resolveAssetUrl` (`r2.ts:147-157`) retorna URLs `data:` tal cual para vista admin.

**Gap:** El storage de documentos degrada silenciosamente a base64-en-Postgres. Cada doc de identidad/antecedentes puede ser hasta 8MB de base64 dentro de una fila `CleaningOnboarding`; la foto de perfil inicial es siempre base64 por schema. No hay enforcement de que producción tenga R2 configurado antes de aceptar taskers.

**Escenario de falla:** Las env vars de R2 faltan/están mal en producción. Los taskers completan onboarding; sus carnets frente/dorso y PDFs de antecedentes se guardan como strings base64 de ~8MB por campo por tasker. Los tamaños de fila explotan, y cada query del queue admin (`admin/onboarding/cleaning` GET trae filas de onboarding) y cada `onboarding/me` GET arrastra estos blobs por la red, degradando la herramienta de revisión admin y arriesgando statement timeouts / TOAST bloat a escala.

**Riesgo operacional:** DB bloat y queue admin lento/fallido a escala; documentos sensibles de ID persistidos en-DB en vez de object storage; backups explotan. Ocurre calladamente cada vez que R2 no está configurado, sin alarma al operador.

**Fix:** En producción, tratar la falta de config de R2 como falla dura para campos de documentos: que presign devuelva 503 solo en no-producción, y en los handlers de submit/me rechazar valores base64 para campos de identidad/antecedentes cuando `isStorageConfigured()` es true pero el valor es una `data:` URL (forzar re-upload como key). Correr `scripts/migrate-base64-to-r2.mjs` para migrar filas legacy, y agregar un health check de startup que asegure que R2 está configurado antes de permitir submissions de onboarding.

---

### O4 — Rutas SMS muertas `phone/send`+`phone/verify` siguen seteando `phoneValidatedAt=null` y rompen submit · **dangerous · low**

**Archivos:**
- `src/app/api/onboarding/cleaning/phone/send/route.ts:61-71`
- `src/app/api/onboarding/cleaning/phone/verify/route.ts:34-42`
- `src/app/api/onboarding/cleaning/submit/route.ts:53,313-326`
- `src/app/trabaja-con-nosotros/registro/page.tsx:672,705,1126`

**currentBehavior:** La verificación SMS fue removida del UI: las rutas start/me auto-setean `phoneValidatedAt` a `new Date()` (`start/route.ts:66`, `me/route.ts:206`) y la página registro solo lee `phoneValidatedAt`. Pero la ruta `phone/send` aún existe y, al recibir POST, corre una transacción que setea `cleaningOnboarding.phoneValidatedAt = null` (`send/route.ts:70`). `submit/route.ts` requiere `phoneValidatedAt` non-null (`listMissingFields` línea 53). `phone/verify` aún setea `currentStep:Math.max(.,9)` (`verify/route.ts:41`), stale respecto a la nueva numeración de 12 pasos.

**Gap:** Endpoints huérfanos retienen acceso de escritura a estado de onboarding que el resto del flujo ahora asume siempre seteado. Son alcanzables por cualquier PRO autenticado directamente (no solo vía UI).

**Escenario de falla:** Un tasker (o un build cliente cacheado viejo, o un retry/automation) pega `POST /api/onboarding/cleaning/phone/send`. `phoneValidatedAt` se borra a null. El tasker ya no puede hacer submit ('Faltan campos obligatorios: phoneValidatedAt') y no hay path en UI para re-validar el teléfono porque el paso SMS fue removido — quedan atascados y deben contactar soporte.

**Riesgo operacional:** Lockout silencioso de onboarding para taskers afectados; carga de soporte; pérdida de oferta de providers. Baja probabilidad (sin caller en UI) pero alta molestia y confuso de diagnosticar.

**Fix:** Eliminar las rutas `phone/send`, `phone/verify` y `phone/claim` (y variantes públicas) ahora que SMS fue removido, O cambiar `phone/send` para que ya no nullee `phoneValidatedAt`. Como mínimo, remover la escritura `data:{phoneVerificationCodeHash..., phoneValidatedAt:null}` para que el endpoint no pueda regresar la elegibilidad de submit.

---

### O5 — Generación de `AvailabilitySlot` sin unicidad en DB; syncs concurrentes pueden crear slots duplicados · **partial · low**

**Archivos:**
- `src/lib/tasker-publication.ts:392-479`
- `src/app/api/marketplace/search-professionals/route.ts:389-408`

**currentBehavior:** `syncTaskerAvailabilitySlotsFromOnboarding` construye slots futuros desde `availabilityBlocks`, lee `existingSlots`, dedupea en memoria vía un Set de keys `startsAt-endsAt` (`tasker-publication.ts:459-462`), luego `createMany`. No hay unique constraint en `(professionalProfileId, startsAt, endsAt)`. `search-professionals` invoca este sync lazily para cualquier perfil con cero slots (search route 389-408), y corre en cada request de búsqueda relevante sin lock.

**Gap:** Sin unicidad a nivel DB; el dedupe es best-effort en memoria de app y no es concurrency-safe.

**Escenario de falla:** Dos clientes buscan la misma categoría/commune casi al mismo tiempo para un tasker recién activado que tiene `availabilityBlocks` pero sin slots materializados. Ambos requests pasan el check `slots.length===0`, ambos leen `existingSlots` vacío, ambos pasan el dedupe en memoria, ambos hacen `createMany` de las mismas 6 semanas de slots. El tasker ahora tiene slots de disponibilidad duplicados para los mismos horarios.

**Riesgo operacional:** Slots duplicados inflan la disponibilidad, pueden permitir que dos clientes 'tomen' el mismo horario vía distintas filas de slot (el FOR UPDATE del checkout lockea un único slot id, así que la fila duplicada queda disponible), arriesgando double-booking del provider para la misma hora. La limpieza requiere dedupe manual.

**Fix:** Agregar un unique constraint en `AvailabilitySlot(professionalProfileId, startsAt, endsAt)` y usar `createMany({ skipDuplicates: true })`, o envolver el read-then-create en una transacción con row lock / advisory lock keyeado por `professionalProfileId` para que los syncs concurrentes serialicen.

---

### O6 — Gate de payout MP correctamente forzado en search, availability y checkout · **production-ready · none**

**Archivos:**
- `src/app/api/marketplace/search-professionals/route.ts:185-191`
- `src/app/api/marketplace/availability/route.ts:30-37`
- `src/app/api/bookings/checkout/route.ts:271-287`

**currentBehavior:** `search-professionals` filtra `professionalProfile` con `user.mpAccountStatus==='ACTIVE'` (línea 189); `marketplace/availability` filtra lo mismo (línea 34); checkout obtiene `mpAccessToken/mpUserId/mpAccountStatus` del pro asignado y devuelve 409 reason `tasker_mp_not_connected` salvo que todos estén presentes y status ACTIVE (líneas 279-287), y el pago marketplace real usa el access token del collector (tasker) con `applicationFee`. Así que un provider sin capacidad de payout no puede emerger en search, no puede exponer disponibilidad, y no puede ser pagado.

**Gap:** (ninguno).

**Escenario de falla:** Un tasker está aprobado/activo pero nunca conectó MercadoPago. No aparece en search; si un cliente de algún modo lo apunta por proId, checkout devuelve 409 antes de crear cualquier Booking/Payment. No se captura dinero sin path de payout.

**Riesgo operacional:** Previene la falla clásica de marketplace de cobrarle a un cliente sin forma de pagar al provider. **Funciona como se espera.**

**Fix:** No se requiere cambio. Hardening opcional: gatear también sobre `mpAccountStatus` en la acción activate para que el operador vea el status MP en la decisión de activación, pero los gates de runtime ya previenen el daño financiero.

---

## 5. Dominio: ADMIN (Herramientas operacionales)

**Resumen del dominio:** La resolución de disputas y la revisión de onboarding son genuinamente production-grade (refunds reales de MP, guards de state machine, `OnboardingReviewEvent` + `AdminAuditLog`, badges de SLA). Pero la **recuperación operacional de fallas es casi un punto ciego total**. El gap más dañino: nada en todo el codebase lee `Payout.status=FAILED`. Las mutaciones de dinero/estado que SÍ corren están bien auditadas; el problema es la visibilidad operacional de todo lo que falla.

---

### A1 — Payouts fallidos (`Payout.status=FAILED`) completamente invisibles · **missing · critical**

**Archivos:**
- `src/lib/payouts-processor.ts:91-94`
- `src/app/admin/page.tsx:223`
- `src/app/api/admin/dashboard-stats/route.ts:61-63`
- `prisma/schema.prisma:473-485`

**currentBehavior:** `processBookingsForPayout` setea `payoutStatus = PayoutStatus.FAILED` cuando MercadoPago reporta que el pago subyacente ya fue reembolsado (`payouts-processor.ts:91-94`). Esa fila FAILED se persiste, pero un grep repo-wide muestra que el ÚNICO lugar donde `PayoutStatus.FAILED` aparece fuera del processor es esta escritura. Tanto el dashboard (`admin/page.tsx:223`) como la API dashboard-stats (`dashboard-stats/route.ts:62`) cuentan payouts SOLO con status IN (PENDING, PROCESSING). No hay página `admin/payouts` (un Glob de `src/app/admin/**/*.tsx` no retorna ruta de payouts) ni API que liste payouts por status.

**Gap:** Ninguna UI o API expone `Payout.status=FAILED`, y no hay botón de retry/re-run para un payout fallido individual. El modelo Payout tampoco tiene `@@index` en status, así que incluso un query ad-hoc es un full table scan.

**Escenario de falla:** Un booking se completa, el payout se agenda, luego una disputa/refund flipea el pago a refunded; la próxima corrida del cron marca ese Payout FAILED. O MP retorna un status non-approved/non-refunded y queda PROCESSING para siempre. El tasker nunca cobra. Ningún operador lo ve porque el único KPI de payout cuenta PENDING+PROCESSING (y un payout FAILED ni siquiera está en ese set).

**Riesgo operacional:** **Taskers silenciosamente nunca pagados por trabajo completado** — daño financiero directo y colapso total de confianza con el lado de oferta. El descubrimiento solo ocurre cuando el tasker reclama, y aun así el operador no tiene pantalla para encontrar la fila.

**Fix:** Agregar `@@index([status])` a Payout en schema.prisma. Construir `/app/admin/payouts/page.tsx` + una ruta `GET /api/admin/payouts` filtrando por status (default FAILED + PROCESSING) mostrando bookingId, proId, amountClp, updatedAt. Agregar un endpoint POST por-fila 'Reintentar payout' que re-corra la rama single-booking de `processBookingsForPayout`. Agregar conteo de payouts FAILED a dashboard-stats y una tarjeta roja en el dashboard que enlace a la cola.

---

### A2 — No existe cola operacional de bookings/pagos atascados · **missing · high**

**Archivos:**
- `src/app/admin/page.tsx:276-292`
- `src/app/api/admin/dashboard-stats/route.ts:37-72`
- `src/lib/payouts-processor.ts:274-356`

**currentBehavior:** La única vista de bookings del dashboard es 'Actividad reciente' (`admin/page.tsx:276`) — los 5 bookings más recientes por `createdAt desc`, sin importar el estado. dashboard-stats expone todayBookings, revenue, conteos de onboarding, openDisputes, pendingPayouts — pero nada sobre bookings atascados en PENDING_PAYMENT, AWAITING_CUSTOMER_CONFIRMATION pasado el hold de 24h, o pagos atascados PENDING. `reconcilePendingPayments` (`payouts-processor.ts:274`) auto-sana pagos PENDING vía cron, pero si MP sigue retornando pending o el cron falla (`result.failed` incrementa, línea 350), nada lo flaggea a un humano.

**Gap:** No hay cola/filtro que liste bookings o pagos atascados en un estado no-terminal más allá de un umbral esperado. Un operador no puede responder 'qué bookings están atascados ahora?'

**Escenario de falla:** Un webhook de MP se pierde y el cron de reconcile también falla para un pago dado (blip de red a MP). El Payment queda PENDING, el Booking PENDING_PAYMENT indefinidamente. El cliente puede haber sido cobrado. Sin tarjeta de dashboard, sin cola — el booking queda enterrado bajo filas más nuevas en 'Actividad reciente' en minutos.

**Riesgo operacional:** Clientes cobrados sin servicio entregado, slots retenidos o perdidos, y el operador no tiene forma de encontrarlos y resolverlos proactivamente. Dinero en limbo sin dueño humano.

**Fix:** Agregar a dashboard-stats conteos de `booking.count` donde status=PENDING_PAYMENT AND createdAt < now-30min, y `payment.count` donde status=PENDING AND createdAt < now-30min, y `booking.count` donde status=AWAITING_CUSTOMER_CONFIRMATION AND updatedAt < now-48h. Mostrar como tarjetas que enlacen a una cola operacional `/admin/bookings?status=...` con acción manual 'reconciliar ahora' que llame `reconcilePendingPayments` para ese pago.

---

### A3 — `AdminAuditLog` es write-only — no hay UI ni API para leer el audit trail · **missing · high**

**Archivos:**
- `src/lib/audit-log.ts:26-41`
- `prisma/schema.prisma:671-684`
- `src/app/api/admin/payments/refund/route.ts:111`
- `src/app/api/marketplace/admin/disputes/route.ts:320`

**currentBehavior:** `recordAdminAction` escribe filas `AdminAuditLog` desde 11 call sites (refunds, resoluciones de disputa, corridas manuales de payout, cron de refresh de token MP, onboarding). El modelo está bien diseñado con `actorId, action, before/afterJson`. Pero un grep de lecturas de `adminAuditLog`/`AdminAuditLog` muestra CERO read paths — sin página admin, sin ruta GET. No hay pantalla `/admin/audit`.

**Gap:** Operadores y compliance no pueden ver el historial de acciones de dinero/estado. El audit log existe solo para acceso forense a DB, no para uso operacional.

**Escenario de falla:** Un cliente disputa un chargeback alegando 'WeTask nunca me reembolsó', o dos admins discrepan sobre quién cerró una disputa con un refund de $50.000. El operador de turno no tiene forma in-product de ver quién hizo qué y cuándo; debe pedir a un developer que corra SQL crudo contra `AdminAuditLog`.

**Riesgo operacional:** Respuesta a incidentes lenta/bloqueada, sin accountability entre admins, postura débil en disputas con el payment-processor o legales a pesar de que la data está capturada. La inversión en audit logging entrega poco valor operacional sin un visor.

**Fix:** Agregar `GET /api/admin/audit-log` (paginado, filtro por actorId/targetType/action/fecha) y una `/app/admin/audit/page.tsx` tipo tabla. Enlazar desde el dashboard y desde cada página de detalle de disputa/usuario (filtro por targetId) para que el operador vea el historial completo de acciones de un booking/payment/dispute dado.

---

### A4 — No hay vista de providers con MP desconectado/expirado que tengan bookings activos · **missing · high**

**Archivos:**
- `src/lib/payouts-processor.ts:78-105`
- `src/app/api/cron/refresh-mp-tokens/route.ts:1-43`
- `src/app/admin/page.tsx:200-292`

**currentBehavior:** El payout processor ramifica sobre `booking.pro.mpAccessToken` (`payouts-processor.ts:80`): con token usa el endpoint marketplace, sin token hace fallback al endpoint de plataforma. El cron `refresh-mp-tokens` deshabilita cuentas cuyo refresh falla y notifica al tasker (según su docstring). Pero un grep de `src/app/admin` por `mpAccessToken`/`mpConnected`/`mp_expired` no retorna archivos — ninguna pantalla admin muestra qué providers tienen una conexión MP faltante/expirada, y crucialmente ninguna lo cruza contra providers que actualmente tienen bookings activos/próximos.

**Gap:** No hay vista operacional que responda 'qué taskers activos no pueden recibir payouts ahora porque su MP está desconectado?' La señal existe per-user pero nunca se agrega para operadores.

**Escenario de falla:** El token MP de un tasker popular expira y el refresh falla (revocó acceso). El cron deshabilita payouts pero sigue siendo matcheado/reservado porque nada bloquea nuevos bookings por status MP, y ningún dashboard lo flaggea. Múltiples trabajos completados se acumulan que nunca pueden pagarse hasta que alguien manualmente persiga al tasker.

**Riesgo operacional:** Payouts no-pagables apilados, taskers frustrados, y un backlog de reconciliación creciente invisible hasta que se vuelve crisis. Operadores no pueden intervenir temprano (ej. pausar matching para ese tasker).

**Fix:** Agregar tarjeta de dashboard + cola listando `professionalProfiles` donde el token MP es null/expirado AND el usuario tiene bookings en estados activos (ASSIGNED/ACCEPTED/CONFIRMED/IN_PROGRESS/AWAITING_CUSTOMER_CONFIRMATION). Proveer acción 'reenviar invitación a reconectar MP'. Opcionalmente gatear nuevo matching en una conexión MP sana.

---

### A5 — Endpoint de trigger manual de payout existe pero no está cableado a ningún botón admin · **partial · medium**

**Archivos:**
- `src/app/api/marketplace/payouts/process-timeouts/route.ts:13-39`
- `src/app/admin/page.tsx:1-501`

**currentBehavior:** `POST /api/marketplace/payouts/process-timeouts` es un trigger manual sólido, admin-guarded, que corre `processBookingsForPayout` y registra una acción de audit cuando hay trabajo (`process-timeouts/route.ts:18-27`). Sin embargo, un grep de `process-timeouts`/`payouts/process` en el UI muestra que solo la ruta cron y este archivo lo referencian — ninguna página admin fetchea este endpoint. La tarjeta de payout del dashboard (`admin/page.tsx:363-367`) es texto plano sin acción.

**Gap:** La capacidad 'correr payouts ahora' solo puede invocarse vía curl/Postman con auth admin, no desde el back-office. Operadores recuperándose de un cron estancado no tienen botón in-product.

**Escenario de falla:** El cron QStash `process-bookings` está pausado o fallando por un día. Los payouts se apilan. El operador quiere flushearlos manualmente pero el único path documentado (el docstring dice que es el botón 'ejecutar ahora') no tiene botón real — debe llamar a un developer.

**Riesgo operacional:** Recuperación más lenta de outages de cron; la recuperación depende de ingeniería en vez de operaciones. Baja severidad porque la capacidad existe y es segura (idempotente), solo no está expuesta.

**Fix:** Agregar un botón 'Procesar payouts ahora' en la tarjeta de payouts del dashboard (y la futura página `/admin/payouts`) que haga POST a `/api/marketplace/payouts/process-timeouts` y muestre el resumen retornado `{scheduled, paidOut, failed}`. Agregar botones similares para reconcile-payments.

---

### A6 — Disputas cerca/sobre SLA visibles por fila pero sin conteo de breach ni cola agregada · **partial · medium**

**Archivos:**
- `src/app/admin/disputes/page.tsx:57-72`
- `src/app/api/admin/dashboard-stats/route.ts:58-60`
- `src/app/admin/page.tsx:222`

**currentBehavior:** La lista de disputas computa un badge de SLA por fila desde `dueDateAt` (`disputes/page.tsx:57`) mostrando 'Vencida hace Nd' / 'Vence en <24h'. El modelo `DisputeTicket` tiene `dueDateAt` con índice (`schema.prisma:518,526`). Pero el dashboard y dashboard-stats solo exponen `openDisputes` = conteo de OPEN+IN_REVIEW (dashboard-stats:58, admin/page.tsx:222) — no hay conteo separado de disputas con SLA vencido/cercano, y la lista no puede ordenarse/filtrarse por `dueDateAt` (orderBy fijo a `createdAt desc` en `disputes/route.ts:73`).

**Gap:** Sin señal top-level de 'N disputas están pasadas de SLA ahora', y sin forma de ordenar la cola por urgencia. Un operador debe escanear cada página para encontrar tickets vencidos.

**Escenario de falla:** Existen 20 disputas abiertas; 3 ya pasaron su SLA `dueDateAt` pero están en página 2 porque se crearon antes y la lista ordena solo por `createdAt desc`. El operador trabaja newest-first y las vencidas se pudren, escalando a chargebacks.

**Riesgo operacional:** Breaches de SLA y chargebacks que pudieron prevenirse; sin presión operacional para limpiar los casos más urgentes primero.

**Fix:** Agregar tarjeta de dashboard 'Disputas vencidas' = `disputeTicket.count` donde status IN (OPEN,IN_REVIEW) AND `dueDateAt < now`. Agregar un `orderBy=dueDateAt asc` opcional a la ruta GET de disputas y un toggle de orden 'Urgentes primero' en el UI.

---

### A7 — Ruta standalone de refund depende solo de la transición de booking; sin guard de payment-status ni idempotency · **partial · medium**

**Archivos:**
- `src/app/api/admin/payments/refund/route.ts:40-90`
- `src/app/api/marketplace/admin/disputes/route.ts:195-242`

**currentBehavior:** `POST /api/admin/payments/refund` obtiene el pago, asegura que el BOOKING pueda transicionar a REFUNDED (`refund/route.ts:62`), luego llama `refundProviderPayment` ANTES de re-leer el estado, luego escribe en una transacción. NO chequea `payment.status !== REFUNDED/PARTIAL_REFUNDED`, y la llamada MP no está protegida por un lock a nivel de request ni idempotency key. La protección contra double-refund es indirecta: si el booking ya es REFUNDED, `assertTransition(REFUNDED -> REFUNDED)` debería lanzar. La ruta de disputes es más estricta (chequea `providerPaymentId`, capea el monto a `amountClp`, usa `canTransition`).

**Gap:** Dos requests de refund concurrentes (double-click / dos admins) ambos pasan el `assertTransition` antes de que cualquiera commitee, luego ambos llaman MP. Los refunds parciales tampoco tienen cap check en esta ruta (la de disputes lo capea, esta no).

**Escenario de falla:** Un admin hace double-click en 'Reembolsar' sobre un booking en estado reembolsable. Ambos requests leen status=CONFIRMED, ambos pasan `assertTransition`, ambos llaman refund MP por el monto completo. MP puede procesar dos refunds parciales o rechazar el segundo, pero si se pasa amount y MP lo permite, el cliente podría ser sobre-reembolsado. El rate limit de 10/h (`refund/route.ts:33`) reduce pero no elimina esto dentro del mismo segundo.

**Riesgo operacional:** Potencial over-refund (dinero perdido) y estado DB vs MP inconsistente que requiere reconciliación manual. Acotado por el rate limiter, de ahí medium.

**Fix:** En `refund/route.ts`: (1) rechazar temprano si `payment.status` es REFUNDED o PARTIAL_REFUNDED; (2) capear `input.amount` a `payment.amountClp` como hace la ruta de disputes; (3) envolver el read-validate-mutate en un `SELECT ... FOR UPDATE` sobre la fila de payment (o un `updateMany` condicional guardado por status) para que requests concurrentes serialicen; (4) pasar `payment.id` como idempotency key de MP a `refundProviderPayment`.

---

### A8 — Payout PROCESSING es un limbo terminal sin path de escalación · **partial · medium**

**Archivos:**
- `src/lib/payouts-processor.ts:95-105`
- `src/lib/payouts-processor.ts:162-171`

**currentBehavior:** Cuando MP retorna un status non-approved/non-refunded, o cuando la llamada MP lanza (`payouts-processor.ts:96,100`), el Payout se setea PROCESSING y el booking se mueve a PAYOUT_SCHEDULED. El processor solo re-actúa sobre bookings aún en AWAITING_CUSTOMER_CONFIRMATION (línea 43). Una vez que un booking se mueve a PAYOUT_SCHEDULED con un payout PROCESSING, la próxima corrida del cron NO lo re-seleccionará (el status ya no matchea el where clause), así que un payout PROCESSING nunca es reintentado por el cron.

**Gap:** Un payout que cae PROCESSING (ej. timeout de MP en el check de release) queda efectivamente atascado — el query de candidatos del cron excluye bookings PAYOUT_SCHEDULED, así que nada re-chequea MP por él, y nada lo expone a un admin (el dashboard lo cuenta como 'pendingPayouts' pero sin detalle/acción).

**Escenario de falla:** MP hace timeout durante el check de release-status para un booking completado. Payout → PROCESSING, Booking → PAYOUT_SCHEDULED. El booking ahora está fuera del filtro AWAITING_CUSTOMER_CONFIRMATION del cron. Ninguna corrida subsiguiente re-consulta MP. El tasker queda sin pagar indefinidamente y la única señal es un +1 opaco en el contador 'Payouts pendientes'.

**Riesgo operacional:** Payouts permanentemente atascados tras un error transitorio de MP; tasker sin pagar, requiere intervención manual de DB para recuperar.

**Fix:** Agregar una segunda pasada del processor (o ensanchar el query de candidatos) que seleccione bookings en PAYOUT_SCHEDULED cuyo `Payout.status IN (PENDING, PROCESSING)` y `updatedAt` más viejo que un umbral, re-consulte MP, y los complete o falle. Exponer payouts PROCESSING más viejos que N horas en la cola de payouts fallidos del A1 con retry manual.

---

## 6. Dominio: ASYNC (Jobs / Cron QStash)

**Resumen del dominio:** WeTask corre 5 crons QStash (process-bookings, reconcile-payments, booking-reminders, refresh-mp-tokens, hard-delete-accounts). Lo bueno: verificación de firma QStash correcta (HS256 + body-hash + exp/nbf, timing-safe, key rotation), la mayoría de processors usan try/catch por-ítem así que un ítem malo no aborta el batch, los errores fluyen a un logger estructurado que reenvía a Sentry en prod, y `Payout.bookingId` único previene double-pay. Lo malo está concentrado y es financieramente serio.

---

### X1 — Outage transitorio de MercadoPago cancela en masa bookings sanos pagados · **dangerous · critical**

**Archivos:**
- `src/lib/payments/providers/mercadopago.ts:466-486`
- `src/lib/payments/providers/mercadopago.ts:87-103`
- `src/lib/payouts-processor.ts:254-356`

**currentBehavior:** `getMercadoPagoPayment()` retorna `status:"failed"` cuando `response.ok` es false (`mercadopago.ts:468-484`) — i.e. para CUALQUIER non-2xx incluyendo 429 rate-limit, 500/502/503 de MP, o un miss de parse JSON. `mapStatus()` también retorna `"failed"` para cualquier status string desconocido/no-mapeado (`mercadopago.ts:101` default). `reconcilePendingPayments` (`payouts-processor.ts:300-339`) alimenta eso en `PROVIDER_STATUS_TO_PAYMENT["failed"] = PaymentStatus.FAILED` y `PROVIDER_STATUS_TO_BOOKING["failed"] = BookingStatus.PAYMENT_FAILED`, luego commitea la transición y, en líneas 327-332, flipea el `AvailabilitySlot` reservado de vuelta a `isAvailable=true`. El cron corre cada ~hora sobre hasta 100 pagos PENDING.

**Gap:** No hay distinción entre 'el proveedor dice que el pago falló' y 'no pudimos alcanzar al proveedor'. Un error de red/HTTP es indistinguible de un 'rejected' genuino. Un rechazo/cancel real debe venir solo de los status cancelled/rejected de MP, nunca de un error de transporte.

**Escenario de falla:** MercadoPago tiene un outage parcial de 20 minutos (retorna 503 / rate-limita el token del cron). El cron horario de reconcile trae 100 pagos legítimamente PENDING (el webhook simplemente no había llegado), recibe 503 por cada uno, mapea cada uno a `status:"failed"`, y commitea Payment→FAILED, Booking→PAYMENT_FAILED, y libera cada slot. Clientes que efectivamente pagaron son notificados de que el pago falló; sus slots se revenden a otros clientes (double-booking del tasker).

**Riesgo operacional:** **Pérdida directa de revenue y double-bookings ante un blip transitorio de un tercero**; dinero del cliente capturado en MP pero booking mostrado como fallido; daño de confianza y carga de refund/disputa. Incidente auto-infligido amplificado por el cron horario + retries de QStash.

**Fix:** Distinguir falla de transporte de falla de negocio. En `mercadopago.ts` agregar un outcome discriminado: cuando `!response.ok` lanzar un `TransientProviderError` (o retornar `status:"unreachable"`) en vez de `status:"failed"`. En `reconcilePendingPayments`, solo transicionar un Booking a PAYMENT_FAILED ante cancelled/rejected explícito de MP; ante unreachable/unknown dejar el Payment PENDING para el próximo ciclo e incrementar `result.failed` para observabilidad. Nunca liberar un slot por un error de transporte. Agregar un umbral de max-age/abandon (ej. solo marcar FAILED tras 48h de PENDING) para que los pagos genuinamente abandonados se limpien sin destruir los sanos durante un outage.

---

### X2 — Cron de payout marca PAID/RELEASED mientras el dinero sigue en escrow de MP · **dangerous · critical**

**Archivos:**
- `src/lib/payouts-processor.ts:78-149`
- `src/lib/payouts-processor.ts:38-66`

**currentBehavior:** `processBookingsForPayout` re-fetchea el pago MP y en líneas 88-90 hace: si `providerResult.status === "approved"` → `payoutStatus = PAID`, `escrowStatus = "RELEASED"`. El comentario en líneas 84-87 admite que es una heurística: asume que como el hold local de 24h (`HOLD_HOURS`) pasó y MP dice 'approved', el marketplace liberó fondos al collector. Luego escribe `Payout.status=PAID`, `Payout.paidAt=now`, `Payment.escrowStatus=RELEASED`, `escrowReleasedAt=now`, Booking→COMPLETED, y notifica a ambas partes que el payout fue liberado — todo sin leer `money_release_date` de MP.

**Gap:** Los fondos marketplace de MP para un pago 'approved' pueden permanecer en escrow con una `money_release_date` futura (comúnmente días). El código nunca inspecciona `money_release_date`/`date_released`. 'approved' significa que el cargo tuvo éxito, NO que los fondos salieron del escrow al tasker.

**Escenario de falla:** Un booking es pagado, el hold local de 24h pasa, MP aún muestra el pago 'approved' con `money_release_date` a 4 días. El cron marca Payout PAID y emailea al tasker 'tu pago quedó liberado' (`notifyPayoutReleased`) y le dice al cliente 'el pago del profesional quedó liberado'. El tasker revisa su MercadoPago y no ve nada por días, o el cliente disputa/hace chargeback durante la ventana de release aún abierta y los libros de la plataforma dicen PAID/COMPLETED.

**Riesgo operacional:** Libros divergen de la posición real del dinero: WeTask reporta payouts como completados mientras los fondos siguen en escrow. Taskers pierden confianza ('la app dice pagado, mi MP está vacío'); reconciliación/contabilidad incorrecta; chargebacks durante la ventana no liberada pegan un booking ya cerrado como COMPLETED.

**Fix:** Gatear la transición PAID/RELEASED sobre la señal real de release de MercadoPago. En `getMercadoPagoMarketplacePayment` exponer `money_release_date`/`date_released`/monto released del payload, y en `processBookingsForPayout` solo setear `payoutStatus=PAID` + `escrowStatus=RELEASED` cuando `status==="approved"` AND `money_release_date <= now` (o `status_detail` indique released). En caso contrario mantener Payout PROCESSING y Booking PAYOUT_SCHEDULED hasta que una corrida posterior confirme release. No enviar `notifyPayoutReleased` hasta que el release real esté confirmado.

---

### X3 — `process-bookings` y `booking-reminders` con `findMany` sin `take:` — exceden timeout y QStash reintenta para siempre · **dangerous · high**

**Archivos:**
- `src/lib/payouts-processor.ts:41-56`
- `src/app/api/cron/booking-reminders/route.ts:40-52`
- `src/app/api/cron/booking-reminders/route.ts:54-67`

**currentBehavior:** El query de candidatos de `processBookingsForPayout` (`payouts-processor.ts:41`) no tiene `take:` — carga todo booking AWAITING_CUSTOMER_CONFIRMATION+PAID más viejo que 24h, y por cada uno hace una llamada HTTP outbound síncrona a MP (líneas 78-105) más una tx de DB. `booking-reminders` (`route.ts:40`) tampoco tiene `take:` y además corre un query de idempotencia N+1 por booking (`route.ts:56`) más 2 sends de notificación/email por booking. En contraste, reconcile-payments (`take:100`), refresh-mp-tokens (`take:50`) y hard-delete (`take:100`) SÍ están acotados.

**Gap:** Sin batching/paginación en los dos crons más pesados. Combinado con round-trips de red por-ítem, un backlog convierte una invocación en miles de llamadas MP/email secuenciales en un único request serverless.

**Escenario de falla:** Un backlog de 500 bookings esperando payout se acumula (ej. tras el incidente de reconcile, o un fin de semana ocupado). `process-bookings` hace 500 GETs MP secuenciales + 500 transacciones en un request, supera el timeout serverless/QStash, no retorna 200. QStash ve un non-2xx/timeout y reintenta el batch completo de 500; cada retry hace timeout de nuevo, así que el cron nunca progresa y los payouts se estancan indefinidamente.

**Riesgo operacional:** Payouts y reminders dejan de progresar exactamente cuando el volumen es más alto; taskers sin pagar; clientes sin reminders → no-shows. Compute desperdiciado en timeouts reintentados infinitamente.

**Fix:** Agregar `take:` (ej. 50) a ambos queries y procesar oldest-first (`orderBy updatedAt asc` / `scheduledAt asc`) para que cada invocación drene un slice acotado y la próxima corrida programada continúe. Como el trabajo es idempotente, el progreso parcial es seguro. Para booking-reminders, reemplazar el `findFirst` N+1 de idempotencia por un único query batcheado (recolectar bookingIds, un `notification.findMany`) o un unique constraint como en X5.

---

### X4 — Sin heartbeat/dead-letter/alerting de crons — un cron muerto pasa desapercibido por días · **missing · high**

**Archivos:**
- `src/app/api/cron/process-bookings/route.ts:15-42`
- `src/app/api/cron/reconcile-payments/route.ts:16-46`
- `src/app/api/cron/refresh-mp-tokens/route.ts:16-43`
- `src/app/api/cron/hard-delete-accounts/route.ts:16-42`
- `src/app/api/cron/booking-reminders/route.ts:25-145`

**currentBehavior:** Los crons solo hacen `recordAdminAction` cuando los conteos de resultado son >0 (ej. `process-bookings/route.ts:22`, `refresh-mp-tokens/route.ts:23`) — una corrida que revisa 0 candidatos NO escribe registro de audit, y una corrida que nunca se dispara no escribe nada por definición. Grep en `src` por heartbeat/lastRunAt/CronRun/monitor encontró solo `rate-limit.ts`; no hay tabla ni contador que trackee la última ejecución exitosa por cron, sin chequeo de cadencia esperada, sin dead-letter/alerta cuando QStash agota retries. Sentry solo recibe excepciones lanzadas dentro de una corrida (`logError`), no la ausencia de corridas.

**Gap:** No hay detección de 'el cron X no ha tenido éxito en N horas'. Si el schedule QStash se borra, la URL/signing key se misconfigura (`assertQStashRequest` retorna 401 → QStash reintenta y se rinde), o las corridas hacen 500 repetidamente, el sistema degrada silenciosamente sin señal.

**Escenario de falla:** `QSTASH_CURRENT_SIGNING_KEY` se rota en Upstash pero no se redeploya a la app. Cada llamada de cron ahora retorna 401 (`qstash.ts:93-101`). QStash reintenta unas veces, luego las drop a su dead-letter queue. `refresh-mp-tokens` deja de correr; en 1-2 semanas los tokens MP de taskers expiran, los pagos marketplace empiezan a fallar, y nadie lo sabe hasta que los taskers reclaman. Mismo punto ciego si `process-bookings` muere — los payouts simplemente paran.

**Riesgo operacional:** El dinero deja de moverse (payouts/refresh) o la experiencia del cliente se rompe silenciosamente (reminders), y el operador se entera solo vía reclamos downstream días después. **El gap de confiabilidad más grande.**

**Fix:** Agregar una tabla `CronHeartbeat` (cronName, lastSuccessAt, lastResultJson) con upsert al final de cada corrida sin importar los conteos. Agregar un monitor liviano (un pequeño endpoint admin o un 6to cron) que flaggee cualquier cron cuyo `lastSuccessAt` exceda su intervalo esperado y empuje un mensaje Sentry / email / Slack. Configurar el callback de dead-letter de QStash para pegar un endpoint de alerting. Agregar endpoints de re-run manual (admin-guarded) para los cuatro crons que actualmente no tienen uno.

---

### X5 — Idempotencia de `booking-reminders` basada en título hardcodeado + ventana de 6h — frágil · **partial · medium**

**Archivos:**
- `src/app/api/cron/booking-reminders/route.ts:54-67`
- `prisma/schema.prisma:529-542`

**currentBehavior:** El dedup se hace consultando Notification por una fila cuyo `title` iguale exactamente el string en español 'Tu servicio empieza pronto' / 'Recordatorio: tu servicio es mañana' creado en las últimas 6h (`route.ts:56-63`). No hay unique constraint; Notification no tiene columna de marker/type (`schema.prisma:529-542`). La notificación real la crea downstream `notifyBookingReminder`, así que el string de dedup debe quedar byte-idéntico a lo que ese helper escribe.

**Gap:** La idempotencia depende de igualdad de string con la copia de otro módulo y una ventana de 6h, en vez de una key de unicidad forzada por DB. Si la copia se edita, o el cron se demora >6h, o corre más seguido de lo esperado, el dedup se rompe.

**Escenario de falla:** Marketing ajusta el texto del título del reminder en `notifyBookingReminder` pero no el literal en `route.ts:59`. El `findFirst` de dedup nunca matchea, así que cada corrida de cron de 15 minutos dentro de la ventana de 30 minutos reenvía los reminders de 24h y 1h 2-4 veces a cliente y tasker — spam de notificaciones y emails duplicados.

**Riesgo operacional:** Spam de notificaciones + emails a cliente/tasker, o (si los títulos derivan al revés) reminders silenciosamente nunca enviados llevando a no-shows. Impacto de confianza moderado.

**Fix:** Agregar una columna de marker estable a Notification (ej. `dedupeKey String? @unique`) y escribir una key determinística como `reminder:{bookingId}:{hoursUntil}`. Que el cron haga upsert/createMany con `skipDuplicates` sobre esa key dentro del mismo path que envía, removiendo la heurística título-string + ventana de tiempo por completo.

---

### X6 — `refresh-mp-tokens` deshabilita al tasker ante CUALQUIER excepción, incluso errores OAuth transitorios · **partial · medium**

**Archivos:**
- `src/lib/account-cleanup-processor.ts:144-187`
- `src/lib/payments/providers/mercadopago.ts:223-250`

**currentBehavior:** `refreshExpiringMpTokens` envuelve `refreshMercadoPagoToken` en try/catch; ante CUALQUIER error lanzado setea `mpAccountStatus=DISABLED` y notifica al tasker que reconecte (`account-cleanup-processor.ts:165-180`). `refreshMercadoPagoToken` lanza ante `!response.ok` O `access_token` faltante (`mercadopago.ts:239-241`), lo que incluye MP 5xx, 429, y errores de red — no solo un refresh token genuinamente revocado.

**Gap:** Sin distinción entre 'el refresh token es permanentemente inválido' y 'el endpoint OAuth de MP estuvo transitoriamente no disponible'. Una falla transitoria deshabilita permanentemente al tasker (removiéndolo de search) y fuerza una reconexión OAuth manual.

**Escenario de falla:** El endpoint OAuth de MP retorna 503 durante la corrida diaria. Todo tasker cuyo token expira dentro de 7 días es marcado DISABLED y emaileado 'reconecta tu MercadoPago'. Caen de search y pierden bookings hasta que cada uno re-linkea manualmente, aunque sus tokens estaban bien.

**Riesgo operacional:** Taskers activos erróneamente removidos del marketplace → GMV perdido para ellos y la plataforma, carga de soporte de taskers confundidos, churn. Auto-infligido ante un blip de un tercero.

**Fix:** Solo DISABLE ante errores que indiquen un grant permanentemente inválido (error MP `invalid_grant` / 400 con ese body, o HTTP 401). Ante 429/5xx/network lanzar, dejar `mpAccountStatus=ACTIVE` y contar como `result.failed` para que la próxima corrida diaria reintente; agregar un pequeño umbral de retries-exceeded antes de deshabilitar. Que `refreshMercadoPagoToken` lance un error tipado cargando el HTTP status para que el processor ramifique.

---

### X7 — Side-effects de payout PAID (notif+email) fuera de la tx sin compensación · **partial · low**

**Archivos:**
- `src/lib/payouts-processor.ts:107-212`

**currentBehavior:** La transacción (líneas 108-174) setea Payout PAID, Booking COMPLETED, Payment RELEASED, y crea la notificación in-app del cliente. Tras commit, `notifyPayoutReleased` (líneas 188-199) envía el email + otra notificación al tasker; las fallas solo se loggean (catch → `logError`). El comentario del código (líneas 184-187) reconoce que se aceptan entradas duplicadas en el feed. Esto es idempotente por booking porque `Payout.bookingId` es `@unique`, así que los re-runs no crean un segundo Payout.

**Gap:** Menor: la decisión PAID en sí es sólida bajo el unique constraint, pero la notificación de release es fire-and-forget. Combinado con X2 (PAID seteado prematuramente), el email que afirma el release puede ser tanto prematuro COMO, si lanza, silenciosamente perdido — el tasker nunca es notificado siquiera una vez en la corrida que lo flipeó a PAID.

**Escenario de falla:** La corrida flipea el booking a PAID/COMPLETED en la tx, luego el proveedor de email hace 500; `logError` lo registra pero no hay retry. El tasker está COMPLETED/PAID en la DB pero nunca recibe el email de payout, y como la DB ahora dice PAID, el próximo cron skippea re-notificar.

**Riesgo operacional:** Notificaciones de payout ocasionalmente perdidas sin path de recuperación; bajo impacto financiero pero un paper-cut de confianza. Mayormente una nota de corrección sobre X2/X3.

**Fix:** Manejar notificaciones desde un outbox durable (escribir una fila `NotificationOutbox` dentro de la tx, entregar vía un paso/cron idempotente separado) para que una falla transitoria de email se reintente en vez de perderse, y para que el email se envíe solo cuando el release real esté confirmado por X2.

---

### X8 — Verificación de auth QStash y aislamiento/idempotencia por ítem correctamente implementados · **production-ready · none**

**Archivos:**
- `src/lib/qstash.ts:31-121`
- `src/lib/payouts-processor.ts:176-180`
- `src/lib/account-cleanup-processor.ts:54-99`
- `prisma/schema.prisma:473-485`

**currentBehavior:** `verifyQStashSignature` hace verificación HS256 completa: HMAC sobre header.payload, comparación timing-safe, checks de exp/nbf, y check de body-hash SHA-256 contra el claim body (`qstash.ts:31-59`), con rotación current+next key (65-77). `assertQStashRequest` rechaza firmas inválidas con 401 y se niega a correr sin verificar en producción (102-110). La mayoría de processors aíslan fallas por-ítem con try/catch + `logError` y continúan el loop (ej. `payouts-processor.ts:176-180`, `account-cleanup-processor.ts:95-98`, reconcile 349-352), así que el ítem 3 de 50 lanzando no aborta el batch. `logError` reenvía a Sentry en prod (`logger.ts:64-74`). `Payout.bookingId @unique` (`schema.prisma:475`) previene payouts duplicados bajo corridas concurrentes/reintentadas, y el patrón create-or-reuse (`payouts-processor.ts:110-119`) es idempotente. `releaseExpiredHolds` usa un `updateMany` guardado (227-238) y es idempotente.

**Gap:** (ninguno).

**Escenario de falla:** Si QStash reintenta una corrida que retornó 200 y que ya commiteó, el unique constraint y la lógica create-or-reuse hacen idempotente la creación de payout; el spoofing de firma se bloquea por verificación JWT+body-hash completa.

**Riesgo operacional:** Estas partes son seguras de correr bajo entrega at-least-once de QStash; se documenta para que el operador no 'arregle' código que funciona. Los riesgos residuales son los hallazgos anteriores, no el core de auth/aislamiento.

**Fix:** No se requiere cambio a `qstash.ts` ni al patrón de aislamiento por-ítem. Mantenerlos como template al agregar batching con `take:` (X3) y heartbeats (X4).

---

## 7. Dominio: TRUST (Confianza del marketplace)

**Resumen del dominio:** La capa de confianza es real y mayormente cableada (transiciones gateadas por state machine, hold de escrow, refund MP en resolución de disputa, constraints únicos en Review/Payout), no mock. Pero existen varios agujeros operator-grade. El mayor es el modelo de trust/escrow en sí: el auto-confirm de 24h trata el silencio del cliente como confirmación positiva.

---

### T1 — Auto-confirm a 24h libera payout ante el silencio del cliente; sin fallback neutral para "ghosting" · **dangerous · critical**

**Archivos:**
- `src/lib/payouts-processor.ts:38-215`
- `src/app/api/marketplace/bookings/[bookingId]/complete/route.ts:42-45`
- `src/lib/booking-state-machine.ts:49-52`

**currentBehavior:** Cuando un pro marca el trabajo hecho (complete route → AWAITING_CUSTOMER_CONFIRMATION) y pasan 24h (`HOLD_HOURS=24`) con `paymentStatus PAID` y sin disputa OPEN/IN_REVIEW, `processBookingsForPayout()` transiciona el booking a PAYOUT_SCHEDULED (o COMPLETED si MP reporta approved) y marca el Payout PAID / escrow RELEASED. **La inacción del cliente se interpreta como aprobación.**

**Gap:** No hay señal de que el servicio efectivamente ocurrió (sin check-out obligatorio del lado cliente, sin gate de confirmación con foto del cliente). Un cliente que nunca abre la app pierde toda protección automáticamente tras 24h. El único escape del cliente es abrir activamente una disputa dentro de la ventana; silencio = pagar al pro.

**Escenario de falla:** El pro reserva un no-show o hace un mal trabajo, presiona 'finalizar', el cliente está de vacaciones / no lee la notificación. 24h después el cron libera el payout completo al pro. El cliente vuelve, el dinero ya está con el pro en MercadoPago.

**Riesgo operacional:** Pérdida financiera directa / chargebacks: cada cliente ghosting auto-financia al pro incluso por servicios no entregados. Entrena a malos pros a apresurar 'finalizar' y apostar a la inatención del cliente. Maximiza disputas de refund que ahora deben clawback de fondos ya liberados.

**Fix:** Alargar la ventana de confirmación silenciosa (ej. 72h) Y hacer el auto-release condicional a una señal positiva de completación (check-out del pro + geofence de check-in ya existen vía campos `checkInAt`/`checkOutAt`). Antes de auto-liberar, requerir `booking.checkOutAt != null`; en caso contrario rutear a una cola de revisión manual en vez de PAYOUT_SCHEDULED. Enviar reminders escalantes en T+6h/T+18h y solo auto-confirmar si al menos uno fue entregado (trackear en Notification).

---

### T2 — Disputa puede abrirse DESPUÉS de liberado el payout (COMPLETED→DISPUTE) sin path de clawback · **dangerous · critical**

**Archivos:**
- `src/lib/booking-state-machine.ts:72`
- `src/app/api/marketplace/disputes/route.ts:58-87`
- `src/app/api/marketplace/admin/disputes/route.ts:190-242`

**currentBehavior:** `BOOKING_TRANSITIONS` permite COMPLETED → DISPUTE por CUSTOMER/PRO/ADMIN. El POST de disputes solo llama `assertTransition(status, DISPUTE)` y crea el ticket; no chequea si el Payout ya es PAID o el escrow ya RELEASED. La resolución admin emite un refund MercadoPago vía `refundProviderPayment` contra el pago original.

**Gap:** Una vez que `processBookingsForPayout` setea `Payout.status=PAID` y `escrowStatus=RELEASED`, el dinero marketplace se movió a la cuenta collector del pro. Una disputa posterior que resuelve con refund intenta reembolsar el pago ORIGINAL en MP, que para un escrow marketplace ya liberado puede no ser reembolsable, y no hay lógica para recuperar fondos del pro (sin saldo-negativo / reversión de payout).

**Escenario de falla:** El cliente auto-confirma a 24h, payout PAID al pro. Dos días después el cliente abre disputa (COMPLETED → DISPUTE es legal). El admin resuelve RESOLVED con `refundAmountClp>0`; `refundProviderPayment` se llama sobre un pago cuyo escrow ya se liberó al collector. MP rechaza (502) o, peor, la plataforma come el refund mientras el pro conserva el bruto.

**Riesgo operacional:** La plataforma absorbe el refund como pérdida o el cliente queda sin remedio; doble pago (pro pagado + cliente reembolsado de fondos de plataforma). Erosiona la confianza en ambos lados.

**Fix:** En disputes POST, bloquear abrir una disputa cuando un Payout del booking ya es PAID (o `escrowStatus RELEASED`) y rutear a un flujo manual de 'post-payout claim'. En resolución admin, cuando el escrow ya está liberado, requerir un paso de clawback al pro (crear un Payout negativo / débito) antes de emitir el refund al cliente, o prohibir el auto-refund y forzar reconciliación manual. Agregar guards de estado escrow/payout junto al check existente `canTransition(REFUNDED)`.

---

### T3 — Disputas nunca auto-expiran: `dueDateAt` SLA seteado pero ningún cron lo procesa · **partial · high**

**Archivos:**
- `src/app/api/marketplace/disputes/route.ts:70-82`
- `src/lib/payouts-processor.ts:50-58`
- `prisma/schema.prisma:518-526`
- `src/app/admin/disputes/page.tsx:59-60`

**currentBehavior:** Abrir una disputa setea `dueDateAt = now + 5 días` y flipea el booking a DISPUTE. `processBookingsForPayout` excluye bookings con disputas OPEN/IN_REVIEW (filtro elegible `b.disputes.length===0`). `dueDateAt` solo se renderiza en el UI admin como badge 'Vence'. Grep no muestra cron ni job consultando `dueDateAt`.

**Gap:** No hay enforcement de SLA automatizado ni escalación. Una disputa que un admin nunca toca queda OPEN indefinidamente, excluyendo permanentemente el booking del payout y dejando al pro sin pagar con fondos atascados en escrow.

**Escenario de falla:** El cliente abre una disputa frívola y el pequeño equipo de ops está de vacaciones. El pro que genuinamente completó el trabajo nunca cobra; el booking queda en DISPUTE para siempre; los fondos del escrow pueden auto-liberarse del lado de MP (`money_release_date`) al collector mientras la DB de WeTask aún dice HELD, desincronizando los libros.

**Riesgo operacional:** Pros dejan de confiar en la plataforma (trabajos completados sin pagar), desincronización dinero/escrow vs MercadoPago, backlog de soporte. Capital de trabajo congelado.

**Fix:** Agregar un cron (ej. `/api/cron/process-disputes`) que encuentre `DisputeTicket` con `status in (OPEN,IN_REVIEW)` y `dueDateAt < now`, y o auto-escale (notificar admins + subir prioridad) o aplique una política de resolución por defecto. Como mínimo, alertar cuando `dueDateAt` se vence. Reconciliar `escrowStatus` contra `money_release_date` de MP para que la DB matchee la realidad.

---

### T4 — Sin constraint unique/active en `DisputeTicket.bookingId` — disputas spammeables/reabribles para re-congelar payouts · **dangerous · high**

**Archivos:**
- `prisma/schema.prisma:505-527`
- `src/app/api/marketplace/disputes/route.ts:46-87`
- `src/app/api/marketplace/bookings/[bookingId]/customer-confirm/route.ts:39-45`

**currentBehavior:** `DisputeTicket` tiene `@@index([bookingId,status])` pero NO unique constraint. El POST route no chequea por una disputa abierta existente antes de crear; solo asegura la transición del booking a DISPUTE. El bloqueo de payout se implementa en todos lados como `findFirst({status:{in:[OPEN,IN_REVIEW]}})`.

**Gap:** Una parte puede crear filas `DisputeTicket` ilimitadas para el mismo booking. Tras que un admin RESUELVE/CIERRA una disputa, el mismo usuario puede inmediatamente abrir una nueva disputa OPEN (la transición COMPLETED→DISPUTE o PAYOUT_SCHEDULED→DISPUTE está permitida), re-congelando el payout indefinidamente.

**Escenario de falla:** Pro y cliente no gustan de la resolución; el cliente reabre una nueva disputa cada vez que el admin cierra una. El Payout (gateado solo por 'hay una disputa OPEN/IN_REVIEW') nunca se libera. O un actor malicioso abre 50 filas de disputa, inundando el queue admin.

**Riesgo operacional:** DoS de payout permanente sobre un solo booking; spam del queue admin; pro nunca pagado; colapso de confianza.

**Fix:** Agregar un índice unique parcial para que solo exista una disputa no-terminal por booking (ej. unique sobre `bookingId where status in OPEN/IN_REVIEW` — implementar vía un guard más un DB CHECK o una columna `activeDisputeId` separada con `@unique`). En disputes POST, antes de crear, rechazar si una disputa sin resolver ya existe. Bloquear reabrir una vez que una disputa fue RESOLVED con refund o tras payout PAID.

---

### T5 — Anti-disintermediación de chat solo bloquea ANTES de CONFIRMED — abierto toda la ventana de servicio; filtro burlable · **partial · high**

**Archivos:**
- `src/lib/chat-safety.ts:22-48`
- `src/app/api/marketplace/bookings/[bookingId]/messages/route.ts:75-77`

**currentBehavior:** El POST de messages bloquea info de contacto solo cuando `canShareContactDetails(status)` es false, y eso retorna true para CONFIRMED, IN_PROGRESS, COMPLETED. Un booking se vuelve CONFIRMED en el momento en que el pago es aprobado (state machine PENDING_PAYMENT→CONFIRMED), que es antes de que el servicio se realice. El regex de teléfono es `/(?:\+?56...)9(...){8}/` y `/\d{8,}/`; la lista de keywords es pequeña.

**Gap:** El bloqueo de disintermediación está efectivamente apagado durante casi todo el lifecycle del booking. Las partes intercambian WhatsApp/números libremente desde el instante en que el pago se aprueba, antes del primer trabajo, luego pueden cancelar y transar off-platform para todos los trabajos futuros. El filtro también se burla deletreando dígitos ('nueve cero...'), insertando separadores, o usando apps no listadas.

**Escenario de falla:** El cliente paga por una limpieza, el booking flipea a CONFIRMED, en chat el pro envía 'mi numero +56 9 1234 5678' que ahora está permitido, acuerdan hacer todas las limpiezas futuras en efectivo off-platform. WeTask pierde toda comisión futura de esa relación.

**Riesgo operacional:** Pérdida de GMV/comisión recurrente (la fuga de revenue core del marketplace), y pérdida del envoltorio de seguridad/escrow que la plataforma vende. El vector clásico de leakage de marketplace.

**Fix:** Restringir `canShareContactDetails` a estados genuinamente post-completación (ej. COMPLETED/IN_PROGRESS tras check-in), NO CONFIRMED. Mejor: nunca auto-permitir números en texto libre; enmascarar info de contacto detectada en vez de permitirla, y proveer un relay/llamada enmascarada in-app. Endurecer la detección (normalización dígito-palabra, stripping de separadores, más keywords de apps) y loggear intentos para scoring de repeat-offender.

---

### T6 — Cliente no puede reseñar en el path común de auto-confirm · **partial · medium**

**Archivos:**
- `src/app/api/marketplace/reviews/route.ts:36-38`
- `src/lib/payouts-processor.ts:130-139`
- `src/app/api/marketplace/bookings/[bookingId]/customer-confirm/route.ts:49`

**currentBehavior:** El POST de review del cliente rechaza salvo que `booking.status === 'COMPLETED'`. El cron de 24h solo setea COMPLETED cuando MP reporta el pago 'approved' (payoutStatus PAID); en caso contrario setea PAYOUT_SCHEDULED. `customer-confirm` también transiciona AWAITING_CUSTOMER_CONFIRMATION → PAYOUT_SCHEDULED (no COMPLETED).

**Gap:** Muchos bookings se asientan en PAYOUT_SCHEDULED y solo después se mueven a COMPLETED (o nunca, si el provider status check queda en PROCESSING/PENDING). En PAYOUT_SCHEDULED el cliente está bloqueado de reseñar, suprimiendo la señal de rating de la que depende todo el ranking de trust/search.

**Escenario de falla:** El cliente confirma vía el botón customer-confirm (status pasa a PAYOUT_SCHEDULED), luego intenta calificar al pro y recibe 'Solo puedes reseñar reservas finalizadas'. La review se pierde silenciosamente; `ratingsCount` queda bajo y el ranking de search se queda sin data.

**Riesgo operacional:** Volumen de review sistemáticamente deprimido → `ratingAvg` poco fiable usado en sorting de search; señal de trust más débil; pros no pueden construir reputación; clientes se sienten ignorados.

**Fix:** Permitir reviews cuando el status es COMPLETED O PAYOUT_SCHEDULED (servicio entregado + pago en vuelo), o introducir un flag `reviewable` dedicado. Actualizar el check de `reviews/route.ts` línea 36 para incluir PAYOUT_SCHEDULED.

---

### T7 — Agregación de rating corre en tx pero no es isolation-safe ante reviews concurrentes · **partial · medium**

**Archivos:**
- `src/app/api/marketplace/reviews/route.ts:46-75`
- `prisma/schema.prisma:248-260`

**currentBehavior:** Dentro de `prisma.$transaction` el código crea la Review, luego re-agrega TODAS las reviews del pro (`tx.review.aggregate where booking.proId`) y escribe `ratingAvg/ratingsCount` vía `updateMany`. El comentario afirma que esto arregla la race del audit.

**Gap:** El isolation default de Prisma/Postgres es READ COMMITTED. Dos transacciones de review concurrentes para el mismo pro pueden cada una agregar antes de que la otra commitee, así que el segundo `updateMany` sobrescribe con un count/avg que omite la otra review concurrente. Poner el aggregate en la misma tx NO lo serializa sin `SELECT ... FOR UPDATE` o isolation Serializable.

**Escenario de falla:** Dos clientes distintos del mismo pro envían reviews en el mismo instante. Ambos aggregates cuentan N reviews existentes; ambos escriben `ratingsCount=N+1` (en vez de N+2), y `ratingAvg` se computa de N+1 reviews. El rating mostrado queda permanentemente off por una review hasta la próxima review (y aun así puede derivar de nuevo).

**Riesgo operacional:** Ratings públicos y conteos de reviews inexactos que manejan el ranking de search y la confianza del cliente. Drift de data difícil de detectar; un pro podría aparecer con menos/peores reviews que la realidad (o viceversa).

**Fix:** O correr el recompute bajo isolation Serializable (`prisma.$transaction(fn,{isolationLevel:'Serializable'})` con retry ante conflicto) y lockear la fila del perfil (`SELECT ... FOR UPDATE` sobre ProfessionalProfile), o reemplazar la re-agregación completa por un update incremental atómico: `ratingsCount = {increment:1}` y una columna running-sum actualizada con `{increment: rating}`, computando `avg = sum/count`. El enfoque incremental es race-free sin locking.

---

### T8 — `customer-confirm` y el cron de payout pueden hacer race en el mismo booking (sin row lock) · **partial · low**

**Archivos:**
- `src/app/api/marketplace/bookings/[bookingId]/customer-confirm/route.ts:48-99`
- `src/lib/payouts-processor.ts:68-180`

**currentBehavior:** Tanto `customer-confirm` como `processBookingsForPayout` leen el booking, aseguran la transición AWAITING_CUSTOMER_CONFIRMATION→PAYOUT_SCHEDULED, luego en una tx hacen upsert del Payout (findUnique-then-create) y actualizan el booking. `Payout.bookingId` es `@unique`, lo que previene una fila Payout duplicada.

**Gap:** El check de transición y el upsert de payout son read-then-write sin row lock; ambos paths pueden correr concurrentemente (el cliente clickea confirmar exactamente cuando el cron de 24h se dispara). El `@unique` sobre `Payout.bookingId` salva la integridad de data (uno de los dos creates lanza P2002 y ese request falla), pero el path del cron trata el throw como failed+continue, y el booking puede recibir dos updates / dos pares de notificación.

**Escenario de falla:** En T+24h el cron se dispara mientras el cliente también toca Confirmar. Ambos proceden; un `Payout.create` pega la violación de unique. El cliente recibe un 400 genérico 'No se pudo confirmar' aunque el servicio sí está agendado, o el pro recibe notificaciones duplicadas de 'pago programado'.

**Riesgo operacional:** Notificaciones duplicadas confusas y un error spurio de cara al usuario; sin pérdida financiera gracias al unique constraint, pero ruido de soporte.

**Fix:** Envolver el read+transition+payout en una sola tx con row lock (`SELECT booking ... FOR UPDATE` vía `$queryRaw` o usar `updateMany` con un status guard: update where id AND status=AWAITING_CUSTOMER_CONFIRMATION, y tratar count===0 como 'ya manejado' en vez de error). Hacer la creación de Payout un upsert idempotente keyeado en bookingId en ambos paths.

---

### T9 — Fallback de header-auth permite spoofing de actor fuera de producción · **partial · low**

**Archivos:**
- `src/lib/auth.ts:47-70`
- `src/app/api/marketplace/reviews/route.ts:19-21`
- `src/app/api/marketplace/bookings/[bookingId]/pro-review/route.ts:35`

**currentBehavior:** `getRequestIdentity` retorna identidad de una cookie firmada. Si está ausente, en `NODE_ENV!=='production'` AND `ALLOW_HEADER_AUTH==='true'`, confía en headers crudos `x-user-id` / `x-user-role`. Las rutas de review luego chequean `identity.userId` contra `booking.customerId/proId` para autorización.

**Gap:** Cuando header-auth está habilitado (staging/QA, o si `ALLOW_HEADER_AUTH` filtra a un env prod-like), cualquier caller puede afirmar un userId+role arbitrario, así que un pro podría enviar una review de cliente de sí mismo (setear `x-user-id` al cliente, `x-user-role` CUSTOMER) ya que el único check es `userId===booking.customerId`. La autorización es correcta bajo cookie auth; el riesgo es puramente la superficie de bypass por header.

**Escenario de falla:** En un ambiente staging sembrado con data realista (o un prod misconfigurado con `ALLOW_HEADER_AUTH=true`), un pro forja headers de identidad de cliente y postea reviews de 5 estrellas de sus propios bookings completados, inflando el `ratingAvg` usado por el ranking de search.

**Riesgo operacional:** Manipulación de rating / señales de trust falsas si el flag se habilita alguna vez fuera de dev confiable; en caso contrario contenido a dev.

**Fix:** Garantizar que `ALLOW_HEADER_AUTH` nunca pueda ser true en ningún deployment alcanzable por internet (asegurar en un startup check que es false salvo `NODE_ENV==='test'`). A largo plazo, remover header auth de request-identity por completo e inyectar una identidad de test solo en el test harness.

---

## 8. Recomendaciones priorizadas para lanzamiento (Launch Blockers)

> Lista accionable derivada de los hallazgos. Ordenada por riesgo financiero/operacional. Los **criticals** son bloqueantes de lanzamiento.

### Bloqueantes (critical) — resolver antes de producción

1. **B1** — Procesar PAYOUT_SCHEDULED en `processBookingsForPayout` (`status: { in: [...] }`). Sin esto, el happy path no paga a los pros.
2. **B2** — Eliminar o gatear con auth+`assertTransition` la ruta legacy `/api/bookings/[bookingId]/status`. Bypass total de seguridad.
3. **P1** — Mover el insert de `ProcessedWebhookEvent` DENTRO de la `$transaction` del webhook. Sin esto, pagos se pierden silenciosamente.
4. **P3 / T2** — No completar/liberar escrow hasta cerrada la ventana de chargeback de MP, y bloquear refund (o forzar clawback) cuando el payout ya está RELEASED. Pérdida de dinero directa.
5. **X1** — Distinguir error de transporte de falla de negocio en el cliente MP; nunca marcar PAYMENT_FAILED ni liberar slots por un error HTTP transitorio. Un outage de MP cancela bookings sanos en masa.
6. **X2 / P2 / B5** — Gatear PAID/RELEASED sobre `money_release_date` real de MP, no la heurística de 24h. Los libros divergen de la realidad.
7. **A1** — Construir UI/API de payouts FAILED + retry. Taskers nunca pagados invisibles.
8. **T1** — Condicionar auto-release a señal positiva de completación (`checkOutAt != null`) + ventana más larga + reminders. El silencio del cliente auto-financia al pro.

### Alta prioridad (high)

- **B3** — Implementar endpoint de cancelación (refund + liberar slot).
- **B4 / T3** — Cron de SLA de disputas que actúe sobre `dueDateAt`.
- **P4** — Validar `mpAccountStatus==='ACTIVE'` en el path de payout; no fallback al token de plataforma.
- **P5** — Ajustar `Payout.amountClp` y escrow ante refunds parciales.
- **O1 / O2** — Hacer que la publicación requiera status ACTIVO (eliminar fallback legacy-verified o diferir `isVerified`).
- **X3** — Agregar `take:` a `process-bookings` y `booking-reminders`.
- **X4** — Heartbeat + alerting de crons (el gap de confiabilidad más grande).
- **A2 / A3 / A4** — Colas operacionales: bookings/pagos atascados, lector de `AdminAuditLog`, providers con MP desconectado.
- **T4** — Constraint unique parcial en `DisputeTicket` para disputas no-terminales.
- **T5** — Restringir `canShareContactDetails` a post-completación; enmascarar contacto.

### Media / baja prioridad (medium/low)

- **B6, B7** — Limpieza de bookings huérfanos / PENDING_PAYMENT stale + liberación de slots.
- **B8, B9, B10** — Endurecer hold ownership, centralizar en state machine, consolidar path de payout.
- **O3** — Forzar R2 en producción para documentos; migrar legacy base64.
- **O4** — Eliminar rutas SMS muertas o detener el null-out de `phoneValidatedAt`.
- **O5** — Unique constraint en `AvailabilitySlot` + `skipDuplicates`.
- **P6, P7, P8, P9** — Reconciliación de webhook refunded/failed, validar status real de refund de MP, ledger de fees, escalación de tokens.
- **A5, A6, A7, A8** — Botón manual de payout, conteo de SLA de disputas, guards de double-refund, segunda pasada para payouts PROCESSING.
- **X5, X6, X7** — Idempotencia robusta de reminders, distinción de errores OAuth transitorios, outbox de notificaciones.
- **T6, T7, T8, T9** — Reviews en PAYOUT_SCHEDULED, agregación de rating race-free, row lock en customer-confirm, asegurar `ALLOW_HEADER_AUTH=false` en prod.

### Lo que NO se debe tocar (production-ready, working as intended)

- **O6** — Gate de payout MP en search/availability/checkout. Funciona como se espera.
- **X8** — Verificación de auth QStash + aislamiento/idempotencia por ítem. Mantener como template.

---

*Fin del documento. Basado enteramente en los hallazgos de auditoría reales de los 6 dominios. 40 ítems clasificados (11 dangerous, 5 missing, 22 partial, 2 production-ready, 0 mock-demo).*
