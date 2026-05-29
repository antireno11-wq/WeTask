# WeTask — EXECUTION_PHASES.md

Roadmap de ejecucion por fases para llevar WeTask a un lanzamiento de produccion confiable.

Documento generado por: ingenieria de sistemas de marketplace (operational reliability).
Fecha: 2026-05-29.

---

## Como leer este documento

Las fases estan ordenadas por **prioridad operativa**, no por dificultad. El orden de criticidad es:

1. **Estabilidad operativa** (que el sistema no quede ciego ante fallos; que los crons no se autodestruyan).
2. **Integridad financiera** (que el dinero no se pierda, no se duplique, no salga a un proveedor desconectado, ni se reporte como pagado cuando MercadoPago aun lo retiene).
3. **Correctitud de la reserva** (state machine, payouts atascados, slots fantasma, cancelaciones).
4. **Experiencia de usuario y confianza** (holds, reviews, anti-desintermediacion, ratings).

Cada fase incluye: **Objetivo**, **Archivos/modulos afectados**, **Riesgos**, **Dependencias**, **Migraciones (Prisma/backfills)**, **Testing requerido**, **Estrategia de rollout en Railway con datos vivos**, y un **tamano aproximado** (S = <1 dia, M = 1-3 dias, L = 3-7 dias, XL = >1 semana).

Las severidades y los hallazgos provienen integramente de la auditoria de 6 dominios (booking-integrity, payments-mercadopago, provider-onboarding, admin-tooling, async-jobs-cron, marketplace-trust). Donde dos dominios reportan el mismo hallazgo (p.ej. el heuristico de `money_release_date`), se consolidan en una sola fase.

### Principio transversal de rollout en Railway

Todas las fases asumen datos vivos en Railway/Postgres. Reglas generales que se repiten:

- **Migraciones Prisma expand/contract**: primero agregar columnas/indices nullable o aditivos (expand), desplegar codigo que los escribe y lee, backfillear, y solo despues (en una fase posterior) endurecer con NOT NULL / constraints (contract). Nunca un `prisma migrate deploy` destructivo en una sola pasada sobre datos vivos.
- **Indices concurrentes**: crear indices con `CREATE INDEX CONCURRENTLY` (via SQL crudo en la migracion, fuera de transaccion) para no bloquear tablas calientes como `Payout`, `Booking`, `DisputeTicket`.
- **Feature flags / env**: cambios de comportamiento de payout/escrow detras de variables de entorno para poder revertir sin redeploy.
- **Idempotencia**: el codigo de crons ya es idempotente (Payout.bookingId @unique, ProcessedWebhookEvent). Aprovecharlo: los deploys de crons pueden hacerse sin ventana de mantenimiento.
- **Backfills como scripts one-shot** ejecutados manualmente (Railway shell o job), nunca dentro del request de un cron.

---

# BLOQUE A — ESTABILIDAD OPERATIVA (primero: que dejemos de estar ciegos)

Estas fases no mueven dinero por si mismas, pero son prerequisito para hacer cualquier cambio financiero con seguridad. Sin observabilidad, los cambios de los bloques B/C se despliegan a ciegas.

---

## Fase 1 — Heartbeat de crons + alerta de dead-letter (visibilidad de jobs)

**Severidad de origen:** high (async-jobs-cron, finding "No cron heartbeat / dead-letter / alerting").
**Tamano:** M.

### Objetivo
Detectar cuando cualquiera de los 5 crons deja de ejecutarse (schedule borrado en QStash, signing key rotada mal, 500 repetidos que agotan reintentos). Hoy un cron muerto degrada el marketplace de forma silenciosa por dias.

### Archivos/modulos afectados
- `src/app/api/cron/process-bookings/route.ts:15-42`
- `src/app/api/cron/reconcile-payments/route.ts:16-46`
- `src/app/api/cron/refresh-mp-tokens/route.ts:16-43`
- `src/app/api/cron/hard-delete-accounts/route.ts:16-42`
- `src/app/api/cron/booking-reminders/route.ts:25-145`
- `src/lib/qstash.ts:31-121` (referencia: la auth ya es correcta, no tocar).
- `src/lib/logger.ts:64-74` (forwarding a Sentry en prod).

### Cambios
1. Tabla nueva `CronHeartbeat (cronName String @id, lastSuccessAt DateTime, lastResultJson Json)` upserteada **al final de cada cron, sin importar si `result` tuvo conteos > 0**. Hoy solo se hace `recordAdminAction` cuando hay trabajo (>0), por lo que una corrida vacia no deja rastro.
2. Monitor liviano: un 6to cron (o endpoint admin) que marque cualquier `lastSuccessAt` que exceda su cadencia esperada y dispare mensaje a Sentry / email / Slack.
3. Configurar el dead-letter callback de QStash apuntando a un endpoint de alerta.

### Riesgos
- Bajo. Es aditivo. El unico riesgo es que el monitor genere falsos positivos si las cadencias esperadas estan mal calibradas; mitigar con margenes generosos al inicio.

### Dependencias
- Ninguna. Es la fase base; habilita verificar todas las demas.

### Migraciones (Prisma/backfills)
- Migracion **expand**: crear tabla `CronHeartbeat`. Sin backfill (se llena en la primera corrida de cada cron).

### Testing requerido
- Unit: el upsert de heartbeat corre incluso con `result` de conteo 0.
- Integracion: simular 401 (signing key mala) y confirmar que el monitor detecta ausencia de `lastSuccessAt`.
- Verificar que `verifyQStashSignature` sigue intacto (no regresionar la auth ya correcta).

### Rollout en Railway
- Desplegar tabla + escritura de heartbeat primero (no rompe nada).
- Activar el monitor/alerta despues de confirmar que los 5 crons escriben heartbeat correctamente al menos una vez.
- No requiere ventana de mantenimiento.

---

## Fase 2 — Cola operativa de payouts FAILED + boton de reintento

**Severidad de origen:** critical (admin-tooling, finding "Failed payouts ... invisible").
**Tamano:** M.

### Objetivo
Hacer visibles y accionables los `Payout.status=FAILED`. Hoy ese estado se **escribe** (`payouts-processor.ts:91-94`) pero **no se lee en ningun lugar**: ni UI ni API. El dashboard solo cuenta PENDING+PROCESSING, asi que un tasker que nunca cobra es invisible.

### Archivos/modulos afectados
- `src/lib/payouts-processor.ts:91-94` (donde se escribe FAILED).
- `src/app/admin/page.tsx:223` (KPI actual cuenta solo PENDING+PROCESSING).
- `src/app/api/admin/dashboard-stats/route.ts:61-63`.
- `prisma/schema.prisma:473-485` (modelo Payout, sin `@@index([status])`).
- Nuevos: `src/app/admin/payouts/page.tsx`, `GET /api/admin/payouts`, `POST /api/admin/payouts/[id]/retry`.

### Cambios
1. `@@index([status])` en `Payout` (hoy una consulta por status es full table scan).
2. `GET /api/admin/payouts` filtrable por status (default FAILED + PROCESSING) mostrando bookingId, proId, amountClp, updatedAt.
3. Pagina `/app/admin/payouts/page.tsx` con la cola.
4. Endpoint `POST /api/admin/payouts/[id]/retry` que re-ejecuta la rama de un solo booking de `processBookingsForPayout` (re-query MP, transicionar a PAID si approved — sujeto a la correccion de la Fase 8 sobre `money_release_date`).
5. Tarjeta roja en dashboard con conteo de FAILED enlazada a la cola.

### Riesgos
- El boton de reintento puede re-disparar un payout sobre un estado heuristico incorrecto. Por eso el reintento que marca PAID **debe esperar a la Fase 8** (verificacion real de release); hasta entonces, el reintento solo re-evalua y deja en PROCESSING si MP no confirma.

### Dependencias
- Fase 1 (para saber que el cron esta vivo).
- Coordinacion con Fase 8 (no marcar PAID con heuristico).

### Migraciones (Prisma/backfills)
- Indice **expand**: `CREATE INDEX CONCURRENTLY` sobre `Payout(status)`.
- Backfill no necesario (los FAILED ya existen y seran listados al desplegar).

### Testing requerido
- Unit del endpoint retry con un Payout FAILED simulado.
- E2E: crear un booking que caiga en FAILED, verlo en la cola, reintentar.

### Rollout en Railway
- Migracion de indice concurrente primero.
- Desplegar API+UI read-only; validar que aparecen los FAILED existentes.
- Habilitar el boton retry al final (idempotente por Payout.bookingId @unique).

---

## Fase 3 — Cola de bookings/pagos atascados + accion de reconciliar

**Severidad de origen:** high (admin-tooling, "No stuck-booking / stuck-PENDING-payment operational queue").
**Tamano:** M.

### Objetivo
Permitir responder "que bookings estan atascados ahora?". Hoy el dashboard solo muestra "Actividad reciente" (5 mas nuevos por createdAt), y nada lista PENDING_PAYMENT viejos, PENDING payments viejos, ni AWAITING_CUSTOMER_CONFIRMATION pasado el hold.

### Archivos/modulos afectados
- `src/app/admin/page.tsx:276-292`.
- `src/app/api/admin/dashboard-stats/route.ts:37-72`.
- `src/lib/payouts-processor.ts:274-356` (`reconcilePendingPayments`).
- Nuevos: `/admin/bookings?status=...` y accion "reconciliar ahora".

### Cambios
1. Agregar a `dashboard-stats`:
   - `booking.count` donde `status=PENDING_PAYMENT AND createdAt < now-30min`.
   - `payment.count` donde `status=PENDING AND createdAt < now-30min`.
   - `booking.count` donde `status=AWAITING_CUSTOMER_CONFIRMATION AND updatedAt < now-48h`.
2. Tarjetas de dashboard enlazadas a una cola `/admin/bookings?status=...`.
3. Accion manual "reconciliar ahora" por pago que invoque `reconcilePendingPayments` para ese pago.

### Riesgos
- El boton de reconciliar manual hereda el bug de la Fase 6 (transient outage -> FAILED). **No habilitar la reconciliacion manual hasta que la Fase 6 distinga error de transporte de rechazo real.**

### Dependencias
- Fase 1. Fuerte acoplamiento con Fase 6 (reconcile seguro).

### Migraciones (Prisma/backfills)
- Ninguna (solo conteos). Conviene confirmar que existen indices utiles en `Booking(status, createdAt)` y `Payment(status, createdAt)`; si no, agregarlos con `CREATE INDEX CONCURRENTLY`.

### Testing requerido
- Unit de los conteos con datos sembrados en cada estado/umbral.
- Verificar que la accion de reconciliar respeta la logica corregida de Fase 6.

### Rollout en Railway
- Desplegar conteos + UI primero.
- Habilitar accion de reconciliar despues de Fase 6.

---

## Fase 4 — Visor de AdminAuditLog (read UI/API)

**Severidad de origen:** high (admin-tooling, "AdminAuditLog is write-only").
**Tamano:** S/M.

### Objetivo
Exponer el historial de acciones de dinero/estado. `recordAdminAction` escribe desde 11 call sites (refunds, resoluciones de disputa, runs manuales de payout, refresh de tokens MP, onboarding), pero **no existe ningun path de lectura**.

### Archivos/modulos afectados
- `src/lib/audit-log.ts:26-41`.
- `prisma/schema.prisma:671-684` (modelo bien disenado: actorId, action, before/afterJson).
- Call sites de referencia: `src/app/api/admin/payments/refund/route.ts:111`, `src/app/api/marketplace/admin/disputes/route.ts:320`.
- Nuevos: `GET /api/admin/audit-log`, `/app/admin/audit/page.tsx`.

### Cambios
1. `GET /api/admin/audit-log` paginado, filtrable por actorId/targetType/action/fecha.
2. Pagina `/app/admin/audit/page.tsx` con tabla.
3. Enlaces desde el dashboard y desde cada detalle de disputa/usuario (filtrando por targetId) para ver el historial completo de un booking/payment/disputa.

### Riesgos
- Muy bajo. Exposicion read-only de datos sensibles: restringir a rol ADMIN y considerar redaccion de campos en before/afterJson si contienen PII.

### Dependencias
- Ninguna fuerte. Util para incident response de todas las fases siguientes.

### Migraciones (Prisma/backfills)
- Ninguna. Conviene `@@index` por `targetId` y `createdAt` si las consultas filtran por ahi (`CREATE INDEX CONCURRENTLY`).

### Testing requerido
- Unit de filtros/paginacion.
- Verificar autorizacion ADMIN obligatoria.

### Rollout en Railway
- Aditivo, sin riesgo. Deploy directo.

---

## Fase 5 — Trigger manual de payouts + reconcile en UI; cola de pros con MP desconectado

**Severidad de origen:** medium + high (admin-tooling, "Manual payout trigger ... not wired" y "No view of providers with disconnected/expired MercadoPago tokens").
**Tamano:** M.

### Objetivo
1. Cablear el endpoint manual de payouts (`POST /api/marketplace/payouts/process-timeouts`) a un boton de back-office; hoy solo se puede invocar por curl.
2. Mostrar pros con token MP nulo/expirado que **tienen bookings activos** y por tanto generan payouts impagables.

### Archivos/modulos afectados
- `src/app/api/marketplace/payouts/process-timeouts/route.ts:13-39`.
- `src/app/admin/page.tsx:1-501` (tarjeta de payouts sin accion).
- `src/lib/payouts-processor.ts:78-105` (branch por `booking.pro.mpAccessToken`).
- `src/app/api/cron/refresh-mp-tokens/route.ts:1-43`.

### Cambios
1. Boton "Procesar payouts ahora" en el dashboard que hace POST a `process-timeouts` y muestra `{scheduled, paidOut, failed}`.
2. Boton equivalente para reconcile-payments (sujeto a Fase 6).
3. Tarjeta + cola listando `professionalProfile` con token MP null/expirado **AND** usuario con bookings en estados activos (ASSIGNED/ACCEPTED/CONFIRMED/IN_PROGRESS/AWAITING_CUSTOMER_CONFIRMATION).
4. Accion "reenviar invitacion a reconectar MP".

### Riesgos
- El trigger manual de payouts es idempotente y seguro (existe y esta auth-guarded). El de reconcile NO es seguro hasta la Fase 6.

### Dependencias
- Fase 6 (reconcile seguro) antes de exponer el boton de reconcile.
- Idealmente Fase 8 (release real) antes de empujar payouts manualmente en masa.

### Migraciones (Prisma/backfills)
- Ninguna.

### Testing requerido
- E2E del boton de payouts mostrando el resumen.
- Query de la cola de MP desconectado con pros sembrados.

### Rollout en Railway
- Boton de payouts: deploy directo (capacidad ya existe).
- Boton de reconcile: gated detras de Fase 6.

---

# BLOQUE B — INTEGRIDAD FINANCIERA (el dinero no se pierde, no se duplica, no sale mal)

---

## Fase 6 — Reconcile-payments no debe cancelar bookings sanos en un outage de MercadoPago

**Severidad de origen:** critical (async-jobs-cron, "Transient MercadoPago outage mass-cancels healthy paid bookings").
**Tamano:** M. **MAXIMA PRIORIDAD FINANCIERA.**

### Objetivo
Distinguir "MP dice que el pago fallo" de "no pudimos contactar a MP". Hoy `getMercadoPagoPayment()` colapsa **cualquier** respuesta no-2xx (429, 500/502/503, parse fail) en `status:"failed"`, y `reconcilePendingPayments` mapea ciegamente `failed -> Payment.FAILED + Booking.PAYMENT_FAILED` y **libera el slot** (`isAvailable=true`). Un outage de 20 minutos de MP cancela en masa bookings legitimamente pagados y revende sus slots (double-booking).

### Archivos/modulos afectados
- `src/lib/payments/providers/mercadopago.ts:466-486` (`getMercadoPagoPayment` -> `failed` en !ok).
- `src/lib/payments/providers/mercadopago.ts:87-103` (`mapStatus` default -> `failed`).
- `src/lib/payouts-processor.ts:254-356` (`reconcilePendingPayments`, incluido el freeing de slot en lineas 327-332).

### Cambios
1. En `mercadopago.ts`: outcome discriminado. Cuando `!response.ok`, lanzar `TransientProviderError` (o retornar `status:"unreachable"`) en vez de `status:"failed"`.
2. En `reconcilePendingPayments`: transicionar a `PAYMENT_FAILED` **solo** ante `cancelled`/`rejected` explicitos de MP. Ante `unreachable`/`unknown`, dejar el Payment en PENDING para el proximo ciclo e incrementar `result.failed` para observabilidad.
3. **Nunca** liberar slot ante un error de transporte.
4. Umbral de abandono: marcar FAILED solo tras N horas (p.ej. 48h) de PENDING, para que pagos genuinamente abandonados se limpien sin arrasar los sanos durante un outage.

### Riesgos
- Si el umbral de abandono es muy alto, pagos realmente abandonados ocupan slots mas tiempo. Mitiga la Fase 11 (limpieza de PENDING_PAYMENT stale por edad/falta de providerPaymentId).

### Dependencias
- Ninguna hacia atras. Bloquea la Fase 5 (boton reconcile) y la Fase 3 (accion reconciliar).

### Migraciones (Prisma/backfills)
- Ninguna. Cambio puramente de logica.

### Testing requerido
- Unit: mock de 503/429/500 -> Payment permanece PENDING, slot intacto, `result.failed++`.
- Unit: mock de `cancelled`/`rejected` -> Payment FAILED, Booking PAYMENT_FAILED, slot liberado.
- Unit: PENDING > 48h sin confirmacion -> FAILED controlado.
- Regresion: el happy path `approved` sigue funcionando.

### Rollout en Railway
- Cambio de logica de cron, idempotente: deploy directo sin ventana.
- Recomendado tras Fase 1 para confirmar que el cron sigue corriendo bien post-cambio.
- Considerar flag de env para forzar "modo seguro" (nunca FAILED por transporte) si se detecta inestabilidad de MP.

---

## Fase 7 — Webhook MercadoPago: idempotencia y mutacion en la MISMA transaccion

**Severidad de origen:** critical (payments-mercadopago, "Webhook records ProcessedWebhookEvent BEFORE the DB mutation").
**Tamano:** M. **MAXIMA PRIORIDAD FINANCIERA.**

### Objetivo
Eliminar la perdida permanente de webhooks. Hoy se hace `processedWebhookEvent.create({eventId})` **antes** del `$transaction` que muta Payment/Booking. Si esa transaccion falla (DB blip, deadlock), se retorna 500 pero el marcador ya quedo committeado; el reintento de MP cae en P2002 y retorna 200 `{duplicate:true}` sin nunca actualizar Payment/Booking. El pago queda PENDING y el booking PENDING_PAYMENT para siempre, con el cliente ya cobrado.

### Archivos/modulos afectados
- `src/app/api/payments/webhook/mercadopago/route.ts:116-130` (create del evento antes).
- `src/app/api/payments/webhook/mercadopago/route.ts:165-204` (transaccion de mutacion).

### Cambios
1. Mover el insert de `ProcessedWebhookEvent` **dentro** del mismo `prisma.$transaction` que muta Payment/Booking (`tx.processedWebhookEvent.create` al inicio del tx).
2. Mantener el short-circuit P2002 -> 200, pero chequear el evento existente **dentro** del tx, de modo que una mutacion fallida tambien revierta el marcador y permita reprocesar en el reintento de MP.

### Riesgos
- Bajo, pero requiere asegurar que la verificacion de firma (`verifyMercadoPagoSignature`) siga ocurriendo antes del tx.
- Coordinar con la Fase 9 (estado contradictorio Payment REFUNDED / Booking COMPLETED): el webhook ahora debe levantar alerta en transiciones ilegales, no escribir estados contradictorios silenciosos.

### Dependencias
- Relacionada con `reconcilePendingPayments` (rescate parcial): tras esta fase, reconcile sigue siendo la red de seguridad, pero el webhook ya no pierde eventos.

### Migraciones (Prisma/backfills)
- Ninguna. **Backfill operativo recomendado**: script one-shot que detecte Payments PENDING con Booking PENDING_PAYMENT donde existe un ProcessedWebhookEvent pero el estado no avanzo (victimas del bug previo), y los reprocese via re-query a MP.

### Testing requerido
- Unit: forzar throw en el tx y verificar que el marcador NO queda committeado (rollback atomico) y que un reintento reprocesa.
- Unit: webhook duplicado real -> 200 sin doble mutacion.
- Integracion con firma valida/invalida.

### Rollout en Railway
- Deploy directo del handler. Es atomico y compatible con la entrega at-least-once de MP.
- Ejecutar el backfill de rescate manualmente tras el deploy.

---

## Fase 8 — Release de escrow / Payout PAID solo con confirmacion real de MercadoPago (money_release_date)

**Severidad de origen:** critical/high — reportado por 3 dominios (payments-mercadopago, booking-integrity, async-jobs-cron). Findings: "Payout marked PAID / escrow RELEASED on a 24h heuristic".
**Tamano:** L. **NUCLEO DE LA INTEGRIDAD FINANCIERA.**

### Objetivo
Dejar de declarar dinero liberado cuando MP aun lo retiene. Hoy `processBookingsForPayout` setea `payoutStatus=PAID` y `escrowStatus='RELEASED'` apenas MP reporta `status==='approved'` tras un hold local plano de `HOLD_HOURS=24`, **sin leer `money_release_date`**. `approved` significa que el cargo se capturo, NO que los fondos salieron del escrow al collector (en MP Marketplace suelen quedar dias). Resultado: libros divergen de MP, se notifica al tasker "pago liberado" cuando su cuenta esta vacia, y se cierra el booking como COMPLETED antes de que cierre la ventana de chargeback (habilitando la perdida de la Fase 9).

### Archivos/modulos afectados
- `src/lib/payouts-processor.ts:68-105` y `:121-149` (heuristica + escritura de PAID/RELEASED/paidAt).
- `src/lib/payouts-processor.ts:38-66` (query de candidatos).
- `src/lib/payments/providers/mercadopago.ts` (`getMercadoPagoMarketplacePayment`: exponer `money_release_date`/`date_released`/`released`).
- `src/lib/payouts-processor.ts:107-212` (side-effects de notificacion; ver Fase 17).

### Cambios
1. Exponer en `getMercadoPagoMarketplacePayment` los campos `money_release_date` / `date_released` / monto `released` del payload.
2. En `processBookingsForPayout`: setear `escrowStatus='RELEASED'` / `Payout=PAID` **solo** cuando `status==='approved'` **AND** `money_release_date <= now` (o MP reporte el release explicitamente). Si no, mantener `Payout=PROCESSING` / `Booking=PAYOUT_SCHEDULED` y re-pollear en corridas posteriores.
3. Usar el timestamp real de release para `escrowReleasedAt`, no `new Date()`.
4. `notifyPayoutReleased` solo cuando el release este confirmado; antes, comunicar "programado" vs "liberado" con precision.

### Riesgos
- Payouts que antes se marcaban PAID en 24h ahora pueden quedar dias en PROCESSING (correcto). Esto **expone** el bug de PROCESSING en limbo (Fase 14) y el de PAYOUT_SCHEDULED nunca procesado (Fase 10): por eso ambas fases deben acompanar a esta.
- Cambio de semantica visible para taskers; coordinar copy.

### Dependencias
- Debe ir junto con Fase 10 (procesar PAYOUT_SCHEDULED) y Fase 14 (re-poll de PROCESSING), de lo contrario los payouts diferidos no avanzan nunca.
- Habilita la Fase 9 (refund post-completion) al no cerrar COMPLETED prematuramente.

### Migraciones (Prisma/backfills)
- Posible nuevo valor de estado o columna para distinguir "PROCESSING esperando release" vs error (evaluar; el modelo Payout actual usa PROCESSING). Si se agrega, migracion **expand**.
- Backfill: revisar Payouts ya marcados PAID con `escrowReleasedAt=new Date()` heuristico; idealmente reconciliar contra MP, pero al menos documentar el set afectado.

### Testing requerido
- Unit: `approved` con `money_release_date` futuro -> permanece PROCESSING/PAYOUT_SCHEDULED, sin notificacion de liberado.
- Unit: `approved` con `money_release_date` pasado -> PAID/RELEASED con `escrowReleasedAt` real.
- Regresion de notificaciones.

### Rollout en Railway
- **Feature flag** `PAYOUT_REQUIRE_REAL_RELEASE` para activar la verificacion real y poder revertir al comportamiento previo si MP no expone el campo como se espera.
- Deploy con flag off, validar que el campo `money_release_date` llega en los payloads de prod, luego encender el flag.
- Monitorear via Fase 1/2/14 que los PROCESSING avanzan.

---

## Fase 9 — Bloqueo de refunds sobre escrow ya liberado + clawback / netting

**Severidad de origen:** critical — reportado por payments-mercadopago ("Refund after COMPLETED ... refunding customer while tasker keeps released escrow") y marketplace-trust ("Dispute can be opened AFTER payout is already released ... no clawback path").
**Tamano:** L/XL.

### Objetivo
Evitar la perdida directa e irrecuperable cuando se reembolsa al cliente despues de que el escrow ya se libero al tasker. Hoy: la state machine permite `COMPLETED -> DISPUTE` (line 72) pero NO `COMPLETED -> REFUNDED`; el route de disputas llama el refund de MP **antes** del tx (`disputes/route.ts:224`); y aunque `DISPUTE -> REFUNDED` es legal, si el escrow ya fue RELEASED al collector, MP reembolsa al cliente desde fondos de plataforma mientras el tasker conserva el payout. No existe mecanismo de clawback ni netting.

### Archivos/modulos afectados
- `src/app/api/marketplace/admin/disputes/route.ts:190-242`, `:208-242`, `:271-279`.
- `src/lib/booking-state-machine.ts:56-72`.
- `src/app/api/marketplace/disputes/route.ts:58-87` (POST que abre disputa sin chequear Payout PAID).
- `src/app/api/marketplace/bookings/[bookingId]/customer-confirm/route.ts:39-45`.

### Cambios
1. **Prevencion (parte 1):** no marcar COMPLETED / escrow RELEASED hasta que la ventana de chargeback+refund de MP este realmente cerrada (atar a `money_release_date` + buffer). Esto es la Fase 8; aqui se consume.
2. **En disputes POST:** bloquear apertura de disputa cuando ya existe un `Payout` PAID / `escrowStatus='RELEASED'` para el booking; enrutar a un flujo manual de "post-payout claim".
3. **En admin resolve:** antes de reembolsar, verificar `Payout.status===PAID` / `escrowStatus==='RELEASED'`. Si esta liberado, bloquear el refund automatico y exigir un paso explicito de clawback al tasker (Payout negativo / saldo negativo) o reembolsar solo la porcion de application_fee.
4. Persistir un registro de ledger que capture el netting payout-vs-refund.

### Riesgos
- Alto en complejidad: el clawback/saldo negativo es un sistema nuevo. Si se subestima, queda un flujo manual que finanzas debe operar. Aceptable como MVP: bloquear el refund automatico y forzar reconciliacion manual con alerta, antes de construir el clawback completo.
- Riesgo de UX: clientes con reclamo legitimo post-payout no pueden ser reembolsados automaticamente; mitigar con el flujo manual claro.

### Dependencias
- **Depende de la Fase 8** (no cerrar COMPLETED/RELEASED prematuramente reduce drasticamente la frecuencia del problema).
- Relacionada con Fase 12 (refunds parciales) y Fase 13 (refund route concurrente).

### Migraciones (Prisma/backfills)
- Nueva tabla de ledger (entradas: platform fee, application_fee enviado a MP, neto a tasker, refunds, clawbacks) — migracion **expand** (ver tambien Fase 15).
- Posible columna `escrowStatus='PARTIALLY_REFUNDED'` (compartida con Fase 12).
- Sin backfill destructivo; opcionalmente backfillear ledger desde columnas de booking existentes.

### Testing requerido
- Unit: abrir disputa con Payout PAID -> rechazada / enrutada a claim manual.
- Unit: resolver disputa con escrow RELEASED -> refund automatico bloqueado, alerta creada.
- Unit: refund sobre escrow HELD (no liberado) -> flujo normal.

### Rollout en Railway
- Por etapas: primero el guard de bloqueo (parte 2 y 3) que evita la perdida, luego el ledger y el clawback.
- Feature flag para el bloqueo de refund post-release.

---

## Fase 10 — Procesar bookings en PAYOUT_SCHEDULED (payout del happy path nunca se libera)

**Severidad de origen:** critical (booking-integrity, "PAYOUT_SCHEDULED bookings are never processed").
**Tamano:** S/M. **CRITICO Y DE BAJO COSTO.**

### Objetivo
Pagar al pro en el camino mas comun. Cuando el cliente confirma explicitamente (`customer-confirm`), el booking pasa a `PAYOUT_SCHEDULED` y se crea un `Payout` PENDING — pero **ningun** cron selecciona `PAYOUT_SCHEDULED`: `processBookingsForPayout` consulta estrictamente `AWAITING_CUSTOMER_CONFIRMATION`. El payout del happy path queda PENDING y el escrow HELD para siempre.

### Archivos/modulos afectados
- `src/app/api/marketplace/bookings/[bookingId]/customer-confirm/route.ts:49-99`, `:62-99`.
- `src/lib/payouts-processor.ts:38-215`, `:41-46` (where clause), `:108-127`.
- `src/app/api/cron/process-bookings/route.ts:15-42`.

### Cambios
1. Que `processBookingsForPayout` consulte ambos estados: `status: { in: [AWAITING_CUSTOMER_CONFIRMATION, PAYOUT_SCHEDULED] }`.
2. Relajar / eliminar el `updatedAt <= cutoff` de 24h para los `PAYOUT_SCHEDULED` ya confirmados por el cliente (ya consintieron).
3. Alternativa o complemento: que `customer-confirm` encole un job de payout inmediato via QStash.
4. Asegurar que el path `canTransition(PAYOUT_SCHEDULED -> COMPLETED, SYSTEM)` (legal segun state machine line 52) efectivamente corra — sujeto a la verificacion de release real (Fase 8).

### Riesgos
- Combinado con Fase 8: el booking confirmado avanza a COMPLETED solo cuando MP confirma release; mientras tanto se queda PROCESSING (correcto, ver Fase 14).
- Cuidado de no liberar antes de respetar la ventana de disputa (coordinar con Fase 16 / politica de payout-request).

### Dependencias
- Fase 8 (release real) para no reintroducir el heuristico.
- Fase 14 (re-poll de PROCESSING) para que avancen.

### Migraciones (Prisma/backfills)
- Ninguna. **Backfill operativo**: barrer Payouts PENDING de bookings en PAYOUT_SCHEDULED preexistentes y procesarlos en la primera corrida (idempotente por unique).

### Testing requerido
- Unit: booking PAYOUT_SCHEDULED con Payout PENDING es seleccionado y avanza.
- Unit: respeta exclusion por disputa OPEN/IN_REVIEW.
- E2E del happy path completo: confirmar -> payout liberado (con money_release_date pasado).

### Rollout en Railway
- Deploy de cron, idempotente, directo.
- Vigilar via Fase 2 que no aparezcan FAILED inesperados.

---

## Fase 11 — Limpieza de PENDING_PAYMENT stale y de bookings huerfanos; liberacion de slots fantasma

**Severidad de origen:** medium (booking-integrity: "orphan bookings" y "slot can be silently lost").
**Tamano:** M.

### Objetivo
1. Evitar leak silencioso de slots: si el proceso muere entre crear el booking (slot `isAvailable=false`, booking PENDING_PAYMENT) y manejar el resultado del provider, el bloque compensatorio no corre. `releaseExpiredHolds` salta slots con cualquier booking, y `reconcile-payments` requiere `providerPaymentId != null`, asi que un PENDING_PAYMENT sin `providerPaymentId` nunca se reconcilia: el slot queda inbookeable para siempre.
2. Limpiar bookings huerfanos creados por las rutas publicas/legacy sin pago, pro ni slot.

### Archivos/modulos afectados
- `src/app/api/bookings/checkout/route.ts:324-462` (compensacion fuera de tx, lineas 453-458).
- `src/lib/payouts-processor.ts:223-239` (`releaseExpiredHolds` salta `isAvailable=false`).
- `src/lib/payouts-processor.ts:282` (reconcile requiere `providerPaymentId`).
- `src/app/api/bookings/public/route.ts:45-95` y `src/app/api/bookings/route.ts:47-86` (creacion huerfana).
- `prisma/schema.prisma:362` (default status PENDING).

### Cambios
1. Cron de limpieza de PENDING_PAYMENT stale: si un booking esta PENDING_PAYMENT sin `providerPaymentId` (o `Payment.providerStatus` aun `created`) por mas de ~15 min, transicionar a PAYMENT_FAILED/CANCELLED y liberar el `bookedSlot` (`isAvailable=true`, `heldExpiresAt/heldByUserId=null`).
2. Incluir esos bookings en reconcile re-consultando MP via `idempotencyKey`/`externalReference` aun con `providerPaymentId` null.
3. Rutas publicas/legacy: o removerlas en favor del flujo de checkout, o crear el booking en PENDING_PAYMENT atado a un payment intent + auth/rate-limit + verificacion de email; y cron que expire bookings PENDING/PENDING_PAYMENT sin Payment tras N minutos.

### Riesgos
- El umbral de 15 min debe ser mayor que el peor caso de latencia de MP para no matar checkouts lentos legitimos.
- Interaccion con Fase 6: la limpieza por edad debe basarse en ausencia de providerPaymentId / estado `created`, no en errores de transporte.

### Dependencias
- Fase 6 (no confundir transporte con fallo).
- Comparte cron con otras limpiezas.

### Migraciones (Prisma/backfills)
- Ninguna estructural. **Backfill**: barrer slots `isAvailable=false` con booking PENDING_PAYMENT viejo sin providerPaymentId y liberarlos; limpiar bookings huerfanos PENDING sin Payment.

### Testing requerido
- Unit: PENDING_PAYMENT sin providerPaymentId > 15min -> CANCELLED/FAILED + slot liberado.
- Unit: checkout lento legitimo (< umbral) NO se toca.
- Unit: booking huerfano sin Payment expira.

### Rollout en Railway
- Desplegar el cron en "modo dry-run" (loguea lo que haria) primero; revisar via Fase 1/3; luego activar la mutacion.
- Backfill manual con el mismo criterio tras validar el dry-run.

---

## Fase 12 — Refunds parciales: ajustar Payout/escrow y excluir del cron

**Severidad de origen:** high (payments-mercadopago, "Partial refund leaves escrow/payout untouched").
**Tamano:** M.

### Objetivo
Evitar el neto negativo en cada refund parcial. Hoy un refund parcial setea `Payment.status=PARTIAL_REFUNDED` y `Booking.status=REFUNDED`, pero el monto de payout (`totalPriceClp - platformFeeClp`) **nunca se reduce**. El processor solo trata `refunded` (full) como bloqueante; un parcial sigue mostrando `approved`. Si ya existe un Payout de monto completo, el tasker cobra el monto pre-refund: la plataforma paga lo que ya reembolso.

### Archivos/modulos afectados
- `src/app/api/marketplace/admin/disputes/route.ts:244-291`.
- `src/lib/payouts-processor.ts:88-105`.

### Cambios
1. En refund parcial: recomputar y **decrementar** `Payout.amountClp` por el monto reembolsado (y la cuota de application_fee correspondiente).
2. Setear `escrowStatus` a un estado `PARTIALLY_REFUNDED`.
3. Que `processBookingsForPayout` excluya pagos REFUNDED/PARTIAL_REFUNDED y honre el monto ajustado.

### Riesgos
- Calculo de la cuota proporcional de fee debe definirse con producto (ver Fase 15).
- Coordinar con Fase 9 (escrow ya liberado).

### Dependencias
- Fase 9 (estados de escrow y ledger).
- Fase 15 (modelo de fee/ledger) para el calculo de la porcion.

### Migraciones (Prisma/backfills)
- Nuevo valor `PARTIALLY_REFUNDED` en `escrowStatus` (compartido con Fase 9) — migracion **expand**.
- Sin backfill destructivo.

### Testing requerido
- Unit: refund 50% -> Payout.amountClp reducido 50% + fee, escrow PARTIALLY_REFUNDED.
- Unit: cron excluye PARTIAL_REFUNDED.

### Rollout en Railway
- Tras Fase 9/15. Deploy directo con tests.

---

## Fase 13 — Endurecer el refund route standalone (idempotencia, cap, lock, status guard)

**Severidad de origen:** medium (admin-tooling, "Standalone refund route relies solely on booking-state transition").
**Tamano:** S/M.

### Objetivo
Evitar over-refund por doble click / dos admins. `POST /api/admin/payments/refund` no chequea `payment.status !== REFUNDED/PARTIAL_REFUNDED`, no capea `input.amount` a `payment.amountClp`, llama a MP antes de re-leer estado y no usa lock ni idempotency key. La proteccion es solo indirecta (assertTransition).

### Archivos/modulos afectados
- `src/app/api/admin/payments/refund/route.ts:40-90`, `:33` (rate limit 10/h).
- Referencia (mas estricta): `src/app/api/marketplace/admin/disputes/route.ts:195-242`.

### Cambios
1. Rechazar temprano si `payment.status` es REFUNDED o PARTIAL_REFUNDED.
2. Capear `input.amount` a `payment.amountClp` (como hace el route de disputas).
3. Envolver read-validate-mutate en `SELECT ... FOR UPDATE` sobre la fila de payment (o `updateMany` guardado por status) para serializar concurrentes.
4. Pasar `payment.id` como idempotency key a `refundProviderPayment`.

### Riesgos
- Bajo. Endurecimiento puro.

### Dependencias
- Conviene tras Fase 9 (para integrar guards de escrow liberado).

### Migraciones (Prisma/backfills)
- Ninguna.

### Testing requerido
- Unit: dos requests concurrentes -> solo uno ejecuta el refund.
- Unit: amount > amountClp -> rechazado.
- Unit: payment ya REFUNDED -> rechazado.

### Rollout en Railway
- Deploy directo.

---

## Fase 14 — Payout PROCESSING en limbo: re-poll y escalamiento

**Severidad de origen:** medium/low (admin-tooling "PROCESSING ... limbo" + payments-mercadopago "Token refresh window").
**Tamano:** M.

### Objetivo
Que un Payout que cae en PROCESSING (timeout de MP, token expirado al momento del payout) se reintente y, si persiste, escale a admin/tasker. Hoy, cuando el booking pasa a `PAYOUT_SCHEDULED` con Payout PROCESSING, el cron ya no lo selecciona (su where era solo AWAITING_CUSTOMER_CONFIRMATION) y nunca se re-consulta MP.

### Archivos/modulos afectados
- `src/lib/payouts-processor.ts:95-105`, `:162-171`, `:78-101`.
- `src/lib/account-cleanup-processor.ts:112-159` (refresh de tokens).

### Cambios
1. Segunda pasada (o ampliar query) que seleccione bookings en `PAYOUT_SCHEDULED` con `Payout.status IN (PENDING, PROCESSING)` y `updatedAt` mayor a un umbral, re-consulte MP y complete o falle.
2. Umbral de max-retry/edad sobre PROCESSING que escale a alerta admin + tasker (integra con cola de Fase 2).
3. Intentar refresh on-demand del token MP dentro del path de payout antes de rendirse.

### Riesgos
- Coordinar con Fase 8 (PROCESSING ahora es estado esperado mientras MP retiene): el re-poll debe distinguir "esperando release" de "error".

### Dependencias
- Fase 8 (release real) y Fase 10 (procesar PAYOUT_SCHEDULED). Esta fase es el complemento que evita el limbo permanente.

### Migraciones (Prisma/backfills)
- Ninguna estructural. Posible campo de contador de reintentos (expand).

### Testing requerido
- Unit: PROCESSING viejo -> re-consultado; si MP confirma release -> PAID; si no -> escalado tras N intentos.

### Rollout en Railway
- Deploy de cron. Validar via Fase 1/2/14 mismo que los PROCESSING dejan de acumularse.

---

## Fase 15 — Ledger de fee/application_fee como fuente unica (decision de comision sobre extras)

**Severidad de origen:** medium (payments-mercadopago, "No application_fee reconciliation").
**Tamano:** M.

### Objetivo
Persistir un ledger de primera clase (platform fee, application_fee enviado a MP, neto al tasker) por pago, en vez de derivarlo de columnas de booking en lectura. Y decidir explicitamente si `platformFeePct` aplica a `subtotal+extras` o solo a `subtotal`. Hoy la comision se calcula solo sobre labor; extras (materiales, urgencia, viaje) pasan 100% al tasker sin comision, lo que puede ser sub-cobro sistematico si producto esperaba comision sobre el valor total.

### Archivos/modulos afectados
- `src/lib/marketplace-pricing.ts:23-53`.
- `src/app/api/bookings/checkout/route.ts:241-250`, `:386-435`, `:433`.
- `src/lib/payouts-processor.ts:69`.

### Cambios
1. **Decision de producto** documentada: comision sobre `subtotal` vs `subtotal+extras`.
2. Persistir una fila de ledger por pago con fee de plataforma, application_fee enviado a MP y neto a tasker, para que reporting y refunds netteen contra una sola fuente.

### Riesgos
- Cambiar la base de comision afecta pricing visible al cliente y payout del tasker: requiere comunicacion y posiblemente solo aplicar a bookings nuevos.

### Dependencias
- El ledger se comparte con Fase 9 (netting) y Fase 12 (porcion de fee en refund parcial).

### Migraciones (Prisma/backfills)
- Nueva tabla de ledger — migracion **expand**.
- Backfill opcional desde columnas de booking historicas.

### Testing requerido
- Unit de calculo de fee bajo la base elegida.
- Unit de que el ledger cuadra con application_fee enviado a MP y el neto.

### Rollout en Railway
- Aditivo. Escribir ledger en paralelo primero (shadow), validar que cuadra con la derivacion actual, luego usarlo como fuente.

---

## Fase 16 — Gate de cuenta MP ACTIVE en el path de payout (no liberar a collector desconectado)

**Severidad de origen:** high (payments-mercadopago, "Payout cron does not verify the collector's token is still valid/ACTIVE").
**Tamano:** S/M.

### Objetivo
No marcar escrow RELEASED hacia un collector deshabilitado/expirado. Hoy `processBookingsForPayout` usa `booking.pro.mpAccessToken` y, si es null, cae al **token de plataforma** (`getMercadoPagoPayment`), consultando el pago en el contexto de cuenta equivocado, y aun asi maneja el resultado como RELEASED. Nunca chequea `pro.mpAccountStatus`. El checkout si exige `mpAccountStatus==='ACTIVE'`, pero el payout no.

### Archivos/modulos afectados
- `src/lib/payouts-processor.ts:54-105`.
- `src/lib/account-cleanup-processor.ts:123-189` (refresh deja `mpAccessToken` stale al fallar, solo cambia status).
- `src/app/api/bookings/checkout/route.ts:271-287` (referencia del gate correcto).

### Cambios
1. En `processBookingsForPayout`, requerir `booking.pro.mpAccountStatus==='ACTIVE'` y `mpAccessToken` no-null para proceder; si no, dejar Payout PROCESSING y notificar al tasker para reconectar (integra con cola de Fase 5).
2. **Nunca** caer al token de plataforma para confirmar un release de marketplace.
3. En fallo de refresh, limpiar/flaggear el `mpAccessToken` stale (no solo el status).

### Riesgos
- Algunos payouts quedaran PROCESSING hasta reconexion (correcto). Cubierto por Fase 14 (escalamiento) y Fase 5 (cola de MP desconectado).

### Dependencias
- Fase 5 (visibilidad de pros desconectados), Fase 14 (escalamiento de PROCESSING).

### Migraciones (Prisma/backfills)
- Ninguna estructural.

### Testing requerido
- Unit: pro DISABLED -> Payout queda PROCESSING, no se usa token de plataforma, se notifica.
- Unit: pro ACTIVE con token valido -> flujo normal.

### Rollout en Railway
- Deploy directo de cron. Monitorear cuantos payouts caen en PROCESSING por MP desconectado.

---

## Fase 17 — Outbox durable para notificaciones de payout (fire-and-forget actual)

**Severidad de origen:** low (async-jobs-cron, "payout PAID side-effects run outside the transaction").
**Tamano:** M.

### Objetivo
Que la notificacion de payout no se pierda ni se envie prematuramente. Hoy `notifyPayoutReleased` corre fuera del tx; si el proveedor de email falla, solo se loguea y no hay retry, y como el DB ya dice PAID el siguiente cron no re-notifica.

### Archivos/modulos afectados
- `src/lib/payouts-processor.ts:107-212`, `:188-199`.

### Cambios
1. Tabla `NotificationOutbox`: escribir una fila **dentro** del tx que marca PAID; entregar via un paso/cron idempotente separado.
2. Enviar el email solo cuando el release real este confirmado (consume Fase 8).

### Riesgos
- Bajo. Aditivo.

### Dependencias
- Fase 8 (no notificar antes del release real). Patron de outbox reusable para otras notificaciones.

### Migraciones (Prisma/backfills)
- Nueva tabla `NotificationOutbox` — migracion **expand**.

### Testing requerido
- Unit: fallo de email -> fila outbox persiste y se reintenta.
- Unit: no se envia duplicado.

### Rollout en Railway
- Aditivo. Deploy del outbox + worker, sin ventana.

---

# BLOQUE C — CORRECTITUD DE LA RESERVA (state machine, cancelacion, disputas, onboarding)

---

## Fase 18 — Eliminar/blindar el route legacy /api/bookings/[bookingId]/status (sin auth, sin state machine)

**Severidad de origen:** critical (booking-integrity, "Legacy ... mutates status with NO auth and NO state machine").
**Tamano:** S. **CRITICO Y RAPIDO.**

### Objetivo
Cerrar el bypass total de gating de pago y de state machine. El PATCH no importa `getRequestIdentity/hasRole`, no autentica, y llama `prisma.booking.update({ data: { status, proId }})` directo sin `assertTransition`. Cualquiera que alcance el endpoint puede forzar COMPLETED sobre un booking impago, reasignar `proId`, o sacar una disputa.

### Archivos/modulos afectados
- `src/app/api/bookings/[bookingId]/status/route.ts:7-51`.
- Referencia que ya cubre el caso legitimo: `src/app/api/marketplace/bookings/[bookingId]/status/route.ts`.

### Cambios
- **Preferido:** eliminar el route legacy (el marketplace route ya cubre cambios de status PRO/ADMIN con `assertTransition`).
- **Alternativa:** gatearlo tras `requireAdminRequest` Y envolver el update con `assertTransition(booking.status, input.status, 'ADMIN')`.

### Riesgos
- Si algun cliente/integracion antigua usa este endpoint, se rompe. Verificar logs de acceso antes de eliminar; dado que no tiene auth, no deberia haber consumidores legitimos.

### Dependencias
- Ninguna. Maxima prioridad de seguridad de estado; idealmente se hace lo antes posible (puede ir junto al Bloque B).

### Migraciones (Prisma/backfills)
- Ninguna.

### Testing requerido
- Verificar que el flujo legitimo de cambio de status sigue por el marketplace route.
- Test de que el endpoint legacy retorna 404/401.

### Rollout en Railway
- Deploy directo. Vigilar 404s en logs por si aparece algun consumidor inesperado.

---

## Fase 19 — Endpoint de cancelacion con refund + liberacion de slot

**Severidad de origen:** high (booking-integrity, "No cancellation endpoint exists").
**Tamano:** M/L.

### Objetivo
Permitir cancelar bookings (cliente/pro/admin) con refund y liberacion de slot. La state machine define transiciones CANCELLED, pero no existe ningun route que cancele + reembolse + libere slot; el marketplace status route restringe a ADMIN/PRO (un CUSTOMER ni siquiera llega). Hoy cada cancelacion es operacion manual de soporte+finanzas y el slot queda `isAvailable=false` para siempre.

### Archivos/modulos afectados
- `src/lib/booking-state-machine.ts:30-59` (transiciones CANCELLED ya definidas).
- `src/app/api/marketplace/bookings/[bookingId]/status/route.ts:13-19` (roles ADMIN/PRO).
- Nuevo: `POST /api/marketplace/bookings/[bookingId]/cancel`.

### Cambios
1. `POST /api/marketplace/bookings/[bookingId]/cancel`: autenticar CUSTOMER (owner) o PRO (asignado) o ADMIN; `assertTransition(status -> CANCELLED, actor)`; en una transaccion: `status=CANCELLED`; si `paymentStatus=PAID` -> `refundProviderPayment` + `paymentStatus=REFUNDED`; `updateMany` del bookedSlot a `isAvailable=true`, `heldExpiresAt/heldByUserId=null`.
2. Politica de ventana/fee de cancelacion.

### Riesgos
- Interaccion con escrow ya liberado: si el payout ya salio, la cancelacion con refund cae en el problema de la Fase 9 (clawback). El cancel debe respetar el guard de escrow RELEASED de la Fase 9.
- El refund debe usar las protecciones de la Fase 13.

### Dependencias
- Fase 9 (guards de escrow liberado), Fase 13 (refund seguro).

### Migraciones (Prisma/backfills)
- Ninguna estructural.

### Testing requerido
- Unit: cancelacion CUSTOMER de booking PAID -> REFUNDED + slot liberado.
- Unit: cancelacion sobre escrow RELEASED -> bloqueada/enrutada a flujo manual.
- Unit: autorizacion por actor (no-owner rechazado).

### Rollout en Railway
- Feature flag para la politica de fee/ventana.
- Deploy tras Fase 9/13.

---

## Fase 20 — Cron de SLA de disputas (dueDateAt nunca se procesa)

**Severidad de origen:** high — reportado por booking-integrity y marketplace-trust ("Dispute dueDateAt is set but never enforced").
**Tamano:** M.

### Objetivo
Que las disputas no congelen el payout indefinidamente. `dueDateAt = now + 5 dias` se escribe pero **ningun cron lo lee**. Una disputa sin accion admin queda OPEN para siempre, excluyendo el booking del payout y dejando el escrow HELD.

### Archivos/modulos afectados
- `src/app/api/marketplace/disputes/route.ts:70-87`, `:70-82`.
- `src/lib/payouts-processor.ts:50-58`.
- `src/app/api/cron/process-bookings/route.ts`.
- `prisma/schema.prisma:518`, `:518-526`.
- `src/app/admin/disputes/page.tsx:59-60`.

### Cambios
1. Cron (nuevo `/api/cron/process-disputes`, o extension de process-bookings) que busque `DisputeTicket` con `status in (OPEN,IN_REVIEW)` y `dueDateAt < now` y aplique una resolucion default definida (auto-escalar a IN_REVIEW con alerta admin, o auto-release/auto-refund segun politica).
2. Como minimo, alertar a admins ante disputas vencidas.
3. Reconciliar `escrowStatus` contra `money_release_date` de MP para que el DB coincida con la realidad.

### Riesgos
- Definir la politica default es decision de producto. MVP seguro: solo escalar + alertar, sin auto-resolucion financiera hasta tener clawback (Fase 9).

### Dependencias
- Fase 1 (heartbeat del nuevo cron), Fase 9 (resolucion financiera segura).

### Migraciones (Prisma/backfills)
- Ninguna (el indice de dueDateAt ya existe, schema:518/526).

### Testing requerido
- Unit: disputa vencida -> escalada/alertada.
- Unit: disputa dentro de SLA -> intacta.

### Rollout en Railway
- Registrar el cron en QStash. Desplegar en modo "solo alertar" primero, luego habilitar resolucion default si se define.

---

## Fase 21 — Constraint de disputa unica activa por booking (anti-spam / re-freeze)

**Severidad de origen:** high (marketplace-trust, "No unique/active constraint on DisputeTicket.bookingId").
**Tamano:** M.

### Objetivo
Impedir que se abran disputas ilimitadas para el mismo booking y se re-congele el payout indefinidamente. `DisputeTicket` tiene `@@index([bookingId,status])` pero **ningun unique**; el POST no chequea disputa abierta existente. Tras cerrar una, se puede abrir otra inmediatamente (COMPLETED/PAYOUT_SCHEDULED -> DISPUTE permitido).

### Archivos/modulos afectados
- `prisma/schema.prisma:505-527`.
- `src/app/api/marketplace/disputes/route.ts:46-87`.
- `src/app/api/marketplace/bookings/[bookingId]/customer-confirm/route.ts:39-45`.

### Cambios
1. Indice unico parcial: solo una disputa no-terminal por booking (unique sobre bookingId where status in OPEN/IN_REVIEW — via guard + CHECK en DB, o columna `activeDisputeId` con `@unique`).
2. En el POST, antes de crear, rechazar si ya existe disputa sin resolver.
3. Bloquear reapertura una vez RESOLVED con refund o tras payout PAID.

### Riesgos
- Backfill: pueden existir bookings con multiples disputas activas que violarian el unique. Limpiar/consolidar antes de aplicar el constraint.

### Dependencias
- Fase 20 (manejo de SLA), Fase 9 (bloqueo post-payout).

### Migraciones (Prisma/backfills)
- **Backfill primero**: detectar y resolver duplicados de disputas activas por booking.
- Luego migracion **contract**: `CREATE UNIQUE INDEX CONCURRENTLY` parcial.

### Testing requerido
- Unit: segunda disputa OPEN para el mismo booking -> rechazada.
- Unit: reapertura tras RESOLVED+refund -> bloqueada.

### Rollout en Railway
- Desplegar guard de aplicacion primero (rechazo en POST), backfill de duplicados, luego el indice unico concurrente.

---

## Fase 22 — Onboarding: que APROBADO no aparezca en search antes de ACTIVO

**Severidad de origen:** high (provider-onboarding, "Approved-but-not-activated taskers become visible in search").
**Tamano:** M.

### Objetivo
Respetar el gate de dos pasos approve->activate. Hoy `approve` setea `isVerified=true` + crea TaskerServices activos, y el fallback "legacy-verified" de search (`search-professionals` lineas 352-356) publica perfiles APROBADO cuyos unicos requisitos faltantes son `{onboarding_completed, published, status_active}`, saltandose la validacion de comunas/slots que hace `activate`.

### Archivos/modulos afectados
- `src/app/api/admin/onboarding/cleaning/route.ts:368-445`, `:479-537`.
- `src/lib/tasker-publication.ts:266-390`, `:97-136`, `:319-358`, `:224`.
- `src/app/api/marketplace/search-professionals/route.ts:32`, `:342-361`, `:352-356`.

### Cambios
- **Opcion (b), preferida:** en `approve`, NO setear `isVerified=true` hasta activacion (pasar un flag a `syncTaskerMarketplaceServicesFromOnboarding` para crear TaskerServices pero dejar `profile.isVerified=false`); como la query de search filtra por `isVerified:true`, esto impide que APROBADO aflore.
- **Opcion (a):** remover el fallback legacy-verified (lineas 352-361) y dejar `canAppearInSearch` (que exige `status==='active'`) como autoritativo.

### Riesgos
- Cambiar `approve` puede afectar pros ya aprobados pero no activados que hoy estan visibles. Backfill: reconciliar `isVerified` de perfiles APROBADO no ACTIVO.

### Dependencias
- Fase 23 (validacion en approve) es complementaria.

### Migraciones (Prisma/backfills)
- Sin cambio de schema. **Backfill**: poner `isVerified=false` a perfiles APROBADO que no esten ACTIVO (opcion b), o aceptar que el fallback removido los oculta (opcion a).

### Testing requerido
- E2E: aprobar pro con MP conectado -> NO aparece en search hasta activate.
- E2E: activate -> aparece, con comunas validadas y slots generados.

### Rollout en Railway
- Backfill primero, luego deploy del cambio de approve/search. Validar que pros legitimos activos siguen visibles.

---

## Fase 23 — Onboarding: approve debe validar requisitos de publicacion (comuna/rate/categoria)

**Severidad de origen:** medium (provider-onboarding, "Approve action does not validate publication requirements").
**Tamano:** S/M.

### Objetivo
Alinear validacion de approve y activate. Hoy `approve` solo guarda sobre `sync.updated===0 && reason!=='synced'`, no llama `getTaskerPublicationState` ni exige `serviceCommunes>0`/rate/categoria como `activate`. Un perfil que fallaria activacion puede aprobarse y publicarse via el fallback.

### Archivos/modulos afectados
- `src/app/api/admin/onboarding/cleaning/route.ts:368-398`, `:479-537`, `:532-537`.

### Cambios
- En la rama `approve`, computar `getTaskerPublicationState` y rechazar (409 con missingRequirements, excluyendo published/status_active) igual que activate.
- Alternativa: si se adopta la opcion (b) de Fase 22 (no publicar en approve), approve no necesita estas validaciones.

### Riesgos
- Bajo si se combina con Fase 22.

### Dependencias
- Fase 22 (decision de cuando se publica).

### Migraciones (Prisma/backfills)
- Ninguna.

### Testing requerido
- Unit: approve con `serviceCommunes` vacio -> rechazado (si se mantiene publicacion en approve).

### Rollout en Railway
- Deploy directo tras Fase 22.

---

## Fase 24 — Eliminar/blindar rutas SMS muertas que rompen submit (phoneValidatedAt=null)

**Severidad de origen:** low pero status "dangerous" (provider-onboarding, "Dead SMS phone/send + phone/verify routes").
**Tamano:** S.

### Objetivo
Cerrar el lockout silencioso de onboarding. `phone/send` aun setea `cleaningOnboarding.phoneValidatedAt = null`, y `submit` exige `phoneValidatedAt` no-null sin UI para re-validar (SMS fue removido). Cualquier PRO autenticado, un build cacheado o un retry que pegue a `phone/send` deja al tasker sin poder enviar.

### Archivos/modulos afectados
- `src/app/api/onboarding/cleaning/phone/send/route.ts:61-71`.
- `src/app/api/onboarding/cleaning/phone/verify/route.ts:34-42`.
- `src/app/api/onboarding/cleaning/submit/route.ts:53`, `:313-326`.
- `src/app/trabaja-con-nosotros/registro/page.tsx:672,705,1126`.

### Cambios
- Eliminar `phone/send`, `phone/verify`, `phone/claim` (y variantes publicas) ahora que SMS fue removido; O cambiar `phone/send` para que ya no anule `phoneValidatedAt`.
- Como minimo, remover el write `data:{phoneVerificationCodeHash..., phoneValidatedAt:null}`.

### Riesgos
- Muy bajo (no hay caller de UI). Verificar que ningun build cliente referencia estas rutas.

### Dependencias
- Ninguna.

### Migraciones (Prisma/backfills)
- Ninguna. **Backfill operativo**: detectar taskers con `phoneValidatedAt=null` por este bug y re-setear a `now()`.

### Testing requerido
- Test de que las rutas eliminadas retornan 404 y submit no se rompe.

### Rollout en Railway
- Backfill de `phoneValidatedAt` afectados, luego deploy de eliminacion.

---

## Fase 25 — Unicidad de AvailabilitySlot para evitar slots duplicados / doble-booking

**Severidad de origen:** low (provider-onboarding, "AvailabilitySlot generation has no DB uniqueness").
**Tamano:** S/M.

### Objetivo
Evitar slots duplicados que permiten doble-booking del pro a la misma hora. `syncTaskerAvailabilitySlotsFromOnboarding` deduplica solo en memoria; no hay unique en `(professionalProfileId, startsAt, endsAt)`. Dos search concurrentes para un pro recien activado sin slots materializados pueden ambos `createMany` las mismas semanas.

### Archivos/modulos afectados
- `src/lib/tasker-publication.ts:392-479`, `:459-462`.
- `src/app/api/marketplace/search-professionals/route.ts:389-408`.

### Cambios
- Agregar unique constraint en `AvailabilitySlot(professionalProfileId, startsAt, endsAt)` y usar `createMany({ skipDuplicates: true })`; O envolver read-then-create en transaccion con lock (advisory lock keyed por professionalProfileId) para serializar syncs concurrentes.

### Riesgos
- Backfill: pueden existir duplicados que violen el constraint. Deduplicar antes.

### Dependencias
- Ninguna.

### Migraciones (Prisma/backfills)
- **Backfill primero**: deduplicar slots existentes con misma (profile, startsAt, endsAt).
- Luego **contract**: `CREATE UNIQUE INDEX CONCURRENTLY`.

### Testing requerido
- Concurrencia: dos syncs simultaneos no crean duplicados.

### Rollout en Railway
- `skipDuplicates` en codigo primero, backfill de dedupe, luego unique index concurrente.

---

## Fase 26 — Unificar check-in/on-the-way bajo assertTransition (eliminar arrays hardcoded)

**Severidad de origen:** low (booking-integrity, "check-in / on-the-way mutate booking without assertTransition").
**Tamano:** S.

### Objetivo
Hacer de la state machine la unica fuente de verdad. `check-in` gatea con `VALID_STATUSES` hardcoded + `canTransition(...,'PRO')` con fallback al estado actual pero **sin** `assertTransition`; `on-the-way` solo escribe `onTheWayAt`. Hoy son seguros por las allow-lists, pero el drift entre arrays y `BOOKING_TRANSITIONS` puede volverse bug a futuro.

### Archivos/modulos afectados
- `src/app/api/marketplace/bookings/[bookingId]/check-in/route.ts:71-110`.
- `src/app/api/marketplace/bookings/[bookingId]/on-the-way/route.ts:40-55`.

### Cambios
- Reemplazar los arrays `VALID_STATUSES` por `assertTransition`/`canTransition` contra la state machine central (CONFIRMED/ACCEPTED -> IN_PROGRESS ya existe). Mantener el guard `paymentStatus=PAID`.

### Riesgos
- Bajo. Mejora de mantenibilidad.

### Dependencias
- Ninguna.

### Migraciones (Prisma/backfills)
- Ninguna.

### Testing requerido
- Unit: check-in desde estado invalido -> rechazado por assertTransition.

### Rollout en Railway
- Deploy directo.

---

## Fase 27 — Consolidar el path canonico de payout-request

**Severidad de origen:** low (booking-integrity, "payout/request creates a Payout but the booking stays in AWAITING_CUSTOMER_CONFIRMATION").
**Tamano:** S.

### Objetivo
Eliminar el path pro-iniciado que no agrega valor y amplia la ventana donde el dinero se libera antes de la confirmacion/disputa del cliente. El `@unique` en `Payout.bookingId` ya evita filas duplicadas, pero los flujos no estan coordinados.

### Archivos/modulos afectados
- `src/app/api/marketplace/bookings/[bookingId]/payout/request/route.ts:22-69`.
- `src/lib/payouts-processor.ts:108-127`, `:110-119`.

### Cambios
- Remover el endpoint pro-iniciado de `payout/request` (apoyarse solo en `customer-confirm` + cron); O que solo programe (no habilite PAID) y respete completamente la ventana de disputa antes de cualquier release.
- Documentar el unico path canonico de payout y hacer los demas no-ops que convergen en el.

### Riesgos
- Bajo.

### Dependencias
- Fase 8/9 (ventana de disputa respetada por release real).

### Migraciones (Prisma/backfills)
- Ninguna.

### Testing requerido
- Unit: payout/request no libera antes de confirmacion/ventana de disputa.

### Rollout en Railway
- Deploy directo.

---

# BLOQUE D — CONFIANZA Y UX (proteccion del cliente, leakage, ratings, holds)

---

## Fase 28 — Auto-confirm a 24h: ventana mas larga + senal positiva de completitud

**Severidad de origen:** critical (marketplace-trust, "24h auto-confirm releases payout on customer silence").
**Tamano:** M/L.

### Objetivo
Que el silencio del cliente no auto-financie servicios no entregados. Hoy, tras 24h sin disputa, `processBookingsForPayout` libera el payout completo; el cliente que no abre la app pierde toda proteccion.

### Archivos/modulos afectados
- `src/lib/payouts-processor.ts:38-215`.
- `src/app/api/marketplace/bookings/[bookingId]/complete/route.ts:42-45`.
- `src/lib/booking-state-machine.ts:49-52`.

### Cambios
1. Alargar la ventana de auto-confirm (p.ej. 72h) y condicionar el auto-release a una senal positiva: `booking.checkOutAt != null` (los campos checkInAt/checkOutAt ya existen); si no hay check-out, enrutar a cola de revision manual en vez de PAYOUT_SCHEDULED.
2. Recordatorios escalonados T+6h/T+18h; auto-confirmar solo si al menos uno fue entregado (trackear en Notification).

### Riesgos
- Alarga el time-to-payout del tasker. Comunicar claramente; balancear con la proteccion al cliente.

### Dependencias
- Fase 8 (release real) y Fase 20 (SLA disputas) definen la ventana total.

### Migraciones (Prisma/backfills)
- Posible campo para trackear recordatorios enviados (o reusar Notification + dedupeKey de Fase 31). Expand.

### Testing requerido
- Unit: sin checkOutAt -> no auto-release, va a revision manual.
- Unit: con checkOutAt + ventana cumplida -> auto-confirm.

### Rollout en Railway
- Feature flag para la ventana (HOLD_HOURS) y el requisito de checkOutAt. Encender gradualmente.

---

## Fase 29 — Anti-desintermediacion: cerrar el chat antes de la entrega del servicio

**Severidad de origen:** high (marketplace-trust, "Chat anti-disintermediation only blocks BEFORE booking is CONFIRMED").
**Tamano:** M.

### Objetivo
Frenar la fuga de GMV/comision. `canShareContactDetails` retorna true para CONFIRMED/IN_PROGRESS/COMPLETED, y un booking pasa a CONFIRMED al aprobarse el pago (antes del servicio), por lo que el intercambio de contacto esta abierto casi todo el ciclo y el filtro se evade trivialmente.

### Archivos/modulos afectados
- `src/lib/chat-safety.ts:22-48`.
- `src/app/api/marketplace/bookings/[bookingId]/messages/route.ts:75-77`.

### Cambios
1. Restringir `canShareContactDetails` a estados genuinamente post-entrega (COMPLETED, o IN_PROGRESS tras check-in), NO CONFIRMED.
2. Mejor: nunca auto-permitir numeros en texto libre; **enmascarar** el contacto detectado y proveer relay/llamada enmascarada in-app.
3. Endurecer deteccion (normalizacion de digito-palabra, stripping de separadores, mas keywords de apps) y loguear intentos para scoring de reincidentes.

### Riesgos
- Falsos positivos que bloqueen comunicacion legitima; mitigar con enmascarado en vez de bloqueo duro.

### Dependencias
- Ninguna fuerte.

### Migraciones (Prisma/backfills)
- Posible tabla/columna para scoring de intentos. Expand.

### Testing requerido
- Unit: CONFIRMED bloquea contacto; deteccion de digito-palabra y separadores.

### Rollout en Railway
- Deploy directo. Monitorear tasa de bloqueos.

---

## Fase 30 — Permitir reviews en PAYOUT_SCHEDULED + race-safe rating aggregation

**Severidad de origen:** medium (marketplace-trust, "Customer cannot review on the common auto-confirm path" y "Rating aggregation ... not isolation-safe").
**Tamano:** M.

### Objetivo
1. No suprimir la senal de rating: la review se gatea a `status==='COMPLETED'`, pero el camino comun (customer-confirm y auto-confirm sin release confirmado) deja el booking en PAYOUT_SCHEDULED, donde el cliente no puede reseñar.
2. Corregir la agregacion de rating no aislada: dos reviews concurrentes pueden escribir un `ratingAvg`/`ratingsCount` stale bajo READ COMMITTED, aun dentro del mismo tx.

### Archivos/modulos afectados
- `src/app/api/marketplace/reviews/route.ts:36-38`, `:46-75`.
- `src/lib/payouts-processor.ts:130-139`.
- `src/app/api/marketplace/bookings/[bookingId]/customer-confirm/route.ts:49`.
- `prisma/schema.prisma:248-260`.

### Cambios
1. Permitir reviews cuando `status` sea COMPLETED **OR** PAYOUT_SCHEDULED (servicio entregado + pago en vuelo). Actualizar el check de `reviews/route.ts:36`.
2. Rating race-safe: o correr el recompute bajo isolation Serializable con retry + `SELECT ... FOR UPDATE` sobre `ProfessionalProfile`, o reemplazar el re-aggregate completo por update incremental atomico (`ratingsCount = {increment:1}` + columna de suma con `{increment: rating}`, avg = sum/count). El incremental es race-free sin locks.

### Riesgos
- Cambio de la base de calculo de rating: el approach incremental requiere columna de suma (backfill).

### Dependencias
- Relacionada con Fase 8/10 (estados PAYOUT_SCHEDULED/COMPLETED).

### Migraciones (Prisma/backfills)
- Si se adopta el incremental: nueva columna de suma de ratings — migracion **expand** + **backfill** del sum/count desde reviews existentes.

### Testing requerido
- Unit: review en PAYOUT_SCHEDULED -> aceptada.
- Concurrencia: dos reviews simultaneas -> count correcto (N+2).

### Rollout en Railway
- Backfill de suma antes de switchear a incremental. Deploy del gate de review (aditivo) primero.

---

## Fase 31 — Idempotencia robusta de booking-reminders (dedupeKey) + take: batching

**Severidad de origen:** medium + high — async-jobs-cron ("booking-reminders idempotency keyed on hardcoded title" y "unbounded findMany").
**Tamano:** M.

### Objetivo
1. Evitar spam o no-envio de recordatorios: hoy el dedupe compara igualdad de string del titulo en español + ventana de 6h, sin constraint. Si el copy cambia, se reenvia 2-4 veces; si la cadencia se desfasa, se dejan de enviar.
2. Acotar el findMany sin `take:` de booking-reminders (y de process-bookings) para no exceder el timeout serverless y caer en reintentos infinitos de QStash.

### Archivos/modulos afectados
- `src/app/api/cron/booking-reminders/route.ts:40-52`, `:54-67`.
- `src/lib/payouts-processor.ts:41-56`.
- `prisma/schema.prisma:529-542`.

### Cambios
1. Columna `Notification.dedupeKey String? @unique` con clave determinista `reminder:{bookingId}:{hoursUntil}`; `createMany` con `skipDuplicates`, eliminando el heuristico de titulo+ventana.
2. Agregar `take:` (p.ej. 50) y `orderBy` (updatedAt asc / scheduledAt asc) a process-bookings y booking-reminders para drenar slices acotados; el trabajo es idempotente, asi el progreso parcial es seguro.
3. Reemplazar el N+1 de idempotencia por una query batched (un `notification.findMany` por lote).

### Riesgos
- Backfill: aplicar `@unique` en `dedupeKey` requiere que no existan colisiones (es nullable, OK para filas viejas).

### Dependencias
- Fase 1 (heartbeat) para confirmar que el batching drena correctamente.

### Migraciones (Prisma/backfills)
- Columna `dedupeKey` nullable + unique — migracion **expand** (nullable evita romper filas existentes).

### Testing requerido
- Unit: misma reminder dos veces -> una sola notificacion (skipDuplicates).
- Carga: lote grande respeta `take:` y la siguiente corrida continua.

### Rollout en Railway
- Expand de columna, deploy de codigo que escribe dedupeKey, luego (opcional contract) endurecer.

---

## Fase 32 — refresh-mp-tokens: no deshabilitar tasker por error transitorio de OAuth

**Severidad de origen:** medium (async-jobs-cron, "refresh-mp-tokens disables tasker on ANY refresh exception").
**Tamano:** S/M.

### Objetivo
No expulsar pros activos del marketplace por un blip de MP. Hoy cualquier excepcion en `refreshMercadoPagoToken` (incluye 5xx, 429, red) marca `mpAccountStatus=DISABLED` y notifica reconectar.

### Archivos/modulos afectados
- `src/lib/account-cleanup-processor.ts:144-187`, `:165-180`.
- `src/lib/payments/providers/mercadopago.ts:223-250`, `:239-241`.

### Cambios
- DISABLE solo ante grant permanentemente invalido (`invalid_grant` / 400 con ese body, o HTTP 401). Ante 429/5xx/red: mantener ACTIVE y contar como `result.failed` para reintentar; umbral de reintentos-excedidos antes de deshabilitar.
- Que `refreshMercadoPagoToken` lance un error tipado con el status HTTP para que el processor ramifique.

### Riesgos
- Bajo. Mejora de resiliencia.

### Dependencias
- Fase 16 (que el payout no caiga a token de plataforma) se beneficia de estados de cuenta correctos.

### Migraciones (Prisma/backfills)
- Ninguna.

### Testing requerido
- Unit: 503 -> permanece ACTIVE, result.failed++.
- Unit: invalid_grant/401 -> DISABLED.

### Rollout en Railway
- Deploy directo de cron.

---

## Fase 33 — Refunds MP: validar status real del objeto refund (no asumir 2xx = refunded)

**Severidad de origen:** medium (payments-mercadopago, "refundMercadoPagoPayment treats any 2xx as a full success").
**Tamano:** S/M.

### Objetivo
No reportar reembolso completado cuando MP lo dejo `in_process`. Hoy `refundMercadoPagoPayment` retorna `status:'refunded'` ante cualquier `response.ok`, sin inspeccionar el `status` del objeto refund ni validar el monto.

### Archivos/modulos afectados
- `src/lib/payments/providers/mercadopago.ts:488-526`, `:513-525`.
- `src/app/api/marketplace/admin/disputes/route.ts:229-241`.

### Cambios
1. Parsear `payload.status` del refund y retornar `'refunded'` solo cuando MP confirme `'approved'`; si no, retornar un status `'pending'` que el route de disputas pueda sostener.
2. Job de reconciliacion que re-consulte el status del refund.
3. Validar que `payload.amount` iguale el `refundAmount` solicitado antes de persistir PARTIAL_REFUNDED vs REFUNDED.

### Riesgos
- Bajo.

### Dependencias
- Fase 12 (refunds parciales) y Fase 13 (refund route).

### Migraciones (Prisma/backfills)
- Ninguna estructural.

### Testing requerido
- Unit: refund `in_process` -> NO marca REFUNDED, queda pending.
- Unit: monto mismatch -> rechazado.

### Rollout en Railway
- Deploy directo.

---

## Fase 34 — Webhook: alerta en transicion ilegal en vez de estado contradictorio silencioso

**Severidad de origen:** medium (payments-mercadopago, "Webhook 'refunded'/'failed' ... silently desyncs Payment vs Booking").
**Tamano:** S/M.

### Objetivo
No persistir Payment.status=REFUNDED con Booking.status=COMPLETED (y Payout posiblemente PAID) sin senal. Hoy, cuando la transicion es ilegal, el webhook actualiza `Payment.status` pero deja `booking.status=COMPLETED` y no alerta.

### Archivos/modulos afectados
- `src/app/api/payments/webhook/mercadopago/route.ts:158-204`, `:166-180`, `:190-196`.
- `src/lib/payouts-processor.ts:88-90`.

### Cambios
1. Cuando llega `refunded`/`failed` pero la transicion es ilegal, levantar alerta de reconciliacion / crear tarea admin (e idealmente una DISPUTE) en vez de escribir un paymentStatus contradictorio en silencio.
2. Chequeo periodico de invariante: `Payment.status=REFUNDED` con `Payout.status=PAID`.

### Riesgos
- Bajo.

### Dependencias
- Fase 7 (webhook atomico), Fase 4 (visor de alertas/audit), Fase 9 (clawback para el caso ya pagado).

### Migraciones (Prisma/backfills)
- Ninguna estructural.

### Testing requerido
- Unit: refunded tardio sobre COMPLETED -> alerta creada, sin estado contradictorio silencioso.

### Rollout en Railway
- Deploy directo.

---

## Fase 35 — Hold de slot enforce real (ownership) + race customer-confirm/cron

**Severidad de origen:** low (booking-integrity "hold not re-validated atomically" + marketplace-trust "customer-confirm and the payout cron can race").
**Tamano:** S/M.

### Objetivo
1. Hacer el hold de 5 min realmente protector: hoy el guard `FOR UPDATE` del checkout solo chequea `isAvailable`, no la propiedad del hold, asi que un usuario que nunca lo tomo puede comprarlo si sigue `isAvailable=true` ("first to pay wins").
2. Evitar la race entre `customer-confirm` y el cron sobre el mismo booking (sin row lock): el `@unique` evita doble Payout pero genera 400 espurios y notificaciones duplicadas.

### Archivos/modulos afectados
- `src/app/api/bookings/slot-hold/route.ts:42-65`.
- `src/app/api/bookings/checkout/route.ts:129-170`, `:324-338`.
- `src/app/api/marketplace/bookings/[bookingId]/customer-confirm/route.ts:48-99`.
- `src/lib/payouts-processor.ts:68-180`.

### Cambios
1. En el guard `FOR UPDATE` del checkout, exigir que el hold pertenezca al comprador o este libre/expirado: `("heldByUserId" = ${customerId} OR "holdExpiresAt" IS NULL OR "holdExpiresAt" < now())`, retornando 409 en otro caso.
2. Para la race: envolver read+transition+payout en un tx con row lock (`SELECT booking ... FOR UPDATE`) o `updateMany` con guard de status (`where id AND status=AWAITING_CUSTOMER_CONFIRMATION`, tratando `count===0` como "ya manejado", no error). Hacer la creacion de Payout un upsert idempotente keyed por bookingId en ambos paths.

### Riesgos
- Bajo. Mejora de UX/consistencia.

### Dependencias
- Fase 10 (procesar PAYOUT_SCHEDULED) toca el mismo path del cron.

### Migraciones (Prisma/backfills)
- Ninguna.

### Testing requerido
- Concurrencia: usuario sin hold no puede comprar slot held por otro vigente.
- Concurrencia: customer-confirm + cron simultaneos -> sin 400 espurio ni doble notificacion.

### Rollout en Railway
- Deploy directo.

---

## Fase 36 — Documentos de identidad en R2 obligatorio en produccion (no base64 en DB)

**Severidad de origen:** medium (provider-onboarding, "Identity documents and profile photos stored as multi-MB base64 in DB when R2 is unconfigured").
**Tamano:** M.

### Objetivo
Evitar bloat de DB y persistencia de documentos sensibles en Postgres. Hoy, si R2 no esta configurado, el cliente cae a `fileToDataUrl` y guarda base64 (hasta 8MB por campo) dentro de `CleaningOnboarding`; la foto inicial siempre es base64 por schema. Esto degrada el admin queue y arriesga statement timeouts / TOAST bloat al escalar.

### Archivos/modulos afectados
- `src/lib/validators.ts:247-255`, `:314-331`, `:486-489`, `:653-662`.
- `src/app/trabaja-con-nosotros/registro/utils.ts:203-234`, `:226-234`.
- `src/lib/storage/r2.ts:82-89`, `:147-157`.
- `src/app/api/uploads/presign/route.ts:27-32`.
- `scripts/migrate-base64-to-r2.mjs` (ya existe).

### Cambios
1. En produccion, tratar la falta de config R2 como fallo duro para campos de documentos: presign retorna 503 solo en no-produccion; en submit/me, rechazar valores base64 para identidad/antecedentes cuando `isStorageConfigured()` es true pero el valor es data: URL (forzar re-upload como key).
2. Correr `scripts/migrate-base64-to-r2.mjs` para migrar filas legacy.
3. Health check de arranque que asegure R2 configurado antes de permitir submissions de onboarding.

### Riesgos
- Si R2 esta mal configurado en prod, taskers no pueden completar onboarding (intencional: mejor bloquear que guardar base64). Verificar config antes de activar el hard-fail.

### Dependencias
- Ninguna fuerte.

### Migraciones (Prisma/backfills)
- Sin cambio de schema. **Backfill**: ejecutar el script existente de migracion base64 -> R2 sobre filas legacy.

### Testing requerido
- Unit: en prod con R2 configurado, valor data: para identidad -> rechazado.
- Verificar health check.

### Rollout en Railway
- Confirmar env de R2 en prod, correr backfill, luego activar el hard-fail.

---

## Fase 37 — Garantizar ALLOW_HEADER_AUTH jamas activo en entornos alcanzables

**Severidad de origen:** low (marketplace-trust, "Header-auth fallback allows actor spoofing").
**Tamano:** S.

### Objetivo
Evitar manipulacion de ratings / spoofing. `getRequestIdentity` confia en `x-user-id`/`x-user-role` cuando `NODE_ENV!=='production'` Y `ALLOW_HEADER_AUTH==='true'`. Si esa flag se filtra a un entorno alcanzable, un pro puede forjar identidad de cliente y auto-reseñarse.

### Archivos/modulos afectados
- `src/lib/auth.ts:47-70`.
- `src/app/api/marketplace/reviews/route.ts:19-21`.
- `src/app/api/marketplace/bookings/[bookingId]/pro-review/route.ts:35`.

### Cambios
- Startup check que garantice que `ALLOW_HEADER_AUTH` no puede ser true salvo `NODE_ENV==='test'`.
- Largo plazo: remover header auth de request-identity e inyectar identidad de test solo en el harness.

### Riesgos
- Muy bajo.

### Dependencias
- Ninguna.

### Migraciones (Prisma/backfills)
- Ninguna.

### Testing requerido
- Test del startup check fallando si la flag esta activa fuera de test.

### Rollout en Railway
- Deploy directo; verificar env de prod/staging.

---

# Resumen de orden y criticidad

| Fase | Titulo | Severidad origen | Tamano | Bloque |
|------|--------|------------------|--------|--------|
| 1 | Heartbeat de crons + dead-letter | high | M | A Estabilidad |
| 2 | Cola de payouts FAILED + retry | critical | M | A |
| 3 | Cola de bookings/pagos atascados | high | M | A |
| 4 | Visor de AdminAuditLog | high | S/M | A |
| 5 | Trigger manual payouts + cola MP desconectado | medium/high | M | A |
| 6 | Reconcile no cancela bookings sanos en outage MP | critical | M | B Financiero |
| 7 | Webhook idempotente atomico | critical | M | B |
| 8 | Release real (money_release_date) | critical | L | B |
| 9 | Bloqueo refund post-release + clawback | critical | L/XL | B |
| 10 | Procesar PAYOUT_SCHEDULED | critical | S/M | B |
| 11 | Limpieza PENDING_PAYMENT stale / huerfanos / slots | medium | M | B |
| 12 | Refunds parciales ajustan payout/escrow | high | M | B |
| 13 | Endurecer refund route standalone | medium | S/M | B |
| 14 | PROCESSING re-poll + escalamiento | medium/low | M | B |
| 15 | Ledger de fee/application_fee | medium | M | B |
| 16 | Gate MP ACTIVE en payout | high | S/M | B |
| 17 | Outbox durable de notificaciones | low | M | B |
| 18 | Eliminar route legacy /status sin auth | critical | S | C Reserva |
| 19 | Endpoint de cancelacion + refund + slot | high | M/L | C |
| 20 | Cron SLA de disputas | high | M | C |
| 21 | Disputa unica activa por booking | high | M | C |
| 22 | APROBADO no visible en search | high | M | C |
| 23 | approve valida publicacion | medium | S/M | C |
| 24 | Rutas SMS muertas | low/dangerous | S | C |
| 25 | Unicidad AvailabilitySlot | low | S/M | C |
| 26 | check-in/on-the-way bajo assertTransition | low | S | C |
| 27 | Consolidar payout-request | low | S | C |
| 28 | Auto-confirm: ventana + senal positiva | critical | M/L | D Confianza |
| 29 | Anti-desintermediacion en chat | high | M | D |
| 30 | Reviews en PAYOUT_SCHEDULED + rating race-safe | medium | M | D |
| 31 | Reminders dedupeKey + take batching | medium/high | M | D |
| 32 | refresh-mp-tokens no DISABLE por error transitorio | medium | S/M | D |
| 33 | Refunds MP: validar status real | medium | S/M | D |
| 34 | Webhook: alerta en transicion ilegal | medium | S/M | D |
| 35 | Hold enforce ownership + race confirm/cron | low | S/M | D |
| 36 | Documentos en R2 obligatorio en prod | medium | M | D |
| 37 | ALLOW_HEADER_AUTH jamas en entorno alcanzable | low | S | D |

**Nota de secuenciamiento critico:** Las Fases 8, 9, 10 y 14 estan acopladas — la 8 (release real) expone los payouts diferidos que las 10 y 14 deben drenar, y habilita la 9 (no cerrar COMPLETED prematuramente). Deben planificarse como un mismo tren de release financiero, precedido por la observabilidad del Bloque A (especialmente Fases 1 y 2) para no desplegarlas a ciegas. La Fase 18 (route legacy sin auth) y la Fase 6 (outage MP) son las dos correcciones que conviene priorizar lo antes posible por su combinacion de severidad critica y bajo costo/riesgo.
