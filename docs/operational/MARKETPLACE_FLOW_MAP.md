# MARKETPLACE_FLOW_MAP — Mapa operacional de flujos end-to-end de WeTask

> Documento de confiabilidad operacional para lanzamiento a producción.
> Basado exclusivamente en los hallazgos de auditoría de 6 dominios:
> `booking-integrity`, `payments-mercadopago`, `provider-onboarding`,
> `admin-tooling`, `async-jobs-cron`, `marketplace-trust`.
>
> Convención: cada flujo documenta **actores**, **APIs (rutas reales)**, **crons involucrados**,
> **transiciones de estado** (`BookingStatus` / `PaymentStatus` / `PayoutStatus` / `escrowStatus`),
> **dependencias asíncronas** y **dónde se rompe el flujo** (con cross-reference a los gaps de auditoría).

---

## 0. Glosario de estados y artefactos (fuente única de verdad)

### 0.1 BookingStatus (state machine: `src/lib/booking-state-machine.ts`)
- `PENDING` — creado por rutas legacy públicas sin pago ni pro (orphan). Default schema `prisma/schema.prisma:362`.
- `PENDING_PAYMENT` — slot reservado (`isAvailable=false`), pago iniciado en MP, esperando webhook.
- `CONFIRMED` — pago aprobado. **OJO: ocurre al momento del pago, antes del servicio.**
- `ASSIGNED` / `ACCEPTED` — pro asignado/aceptó.
- `IN_PROGRESS` — pro hizo check-in.
- `AWAITING_CUSTOMER_CONFIRMATION` — pro marcó trabajo terminado (ruta `complete`).
- `PAYOUT_SCHEDULED` — cliente confirmó (o cron aplazó la liberación).
- `COMPLETED` — payout liberado / escrow RELEASED.
- `DISPUTE` — disputa abierta (legal desde varios estados, incl. `COMPLETED → DISPUTE`, `booking-state-machine.ts:72`).
- `REFUNDED` — reembolsado (legal desde `CONFIRMED/ACCEPTED/IN_PROGRESS/AWAITING_CUSTOMER_CONFIRMATION/PAYOUT_SCHEDULED/DISPUTE`, `booking-state-machine.ts:56-72`). **NO existe `COMPLETED → REFUNDED`.**
- `CANCELLED` — modelado en la state machine (CUSTOMER/PRO desde CONFIRMED/ACCEPTED) pero **sin endpoint que lo implemente**.
- `PAYMENT_FAILED` — pago rechazado/cancelado por MP (o, peligrosamente, por error transitorio HTTP).

### 0.2 PaymentStatus
`PENDING` → `PAID` → (`REFUNDED` | `PARTIAL_REFUNDED`) | `FAILED`.
- `Payment.idempotencyKey` es `@unique` (dedupe de reintentos de checkout).
- `Payment.providerPaymentId` puede ser `null` hasta que el provider responde (clave en varios gaps).
- `Payment.escrowStatus`: `HELD` → `RELEASED` (decidido por heurística, no por confirmación real de MP).

### 0.3 PayoutStatus (`prisma/schema.prisma:473-485`)
`PENDING` → `PROCESSING` → `PAID` | `FAILED`.
- `Payout.bookingId` es `@unique` (impide filas duplicadas).
- **No hay `@@index([status])`** → consultas por estado son full table scan.
- `FAILED` se escribe pero **nunca se lee** (ver §10 admin).

### 0.4 Crons (5 disparados por QStash; auth correcta en `src/lib/qstash.ts`)
| Cron | Ruta | take: (límite) | Trigger manual |
|------|------|----------------|----------------|
| process-bookings | `src/app/api/cron/process-bookings/route.ts` | **sin límite** (peligro) | sí (`/api/marketplace/payouts/process-timeouts`) pero sin botón |
| reconcile-payments | `src/app/api/cron/reconcile-payments/route.ts` | take:100 | no |
| booking-reminders | `src/app/api/cron/booking-reminders/route.ts` | **sin límite** (peligro) | no |
| refresh-mp-tokens | `src/app/api/cron/refresh-mp-tokens/route.ts` | take:50 | no |
| hard-delete-accounts | `src/app/api/cron/hard-delete-accounts/route.ts` | take:100 | no |

---

## 1. FLUJO: Customer Booking (reserva del cliente — happy path)

### 1.1 Actores
- **Customer** (autenticado vía cookie firmada; fallback de headers fuera de prod — ver §11.9).
- **Pro** (debe tener `mpAccountStatus='ACTIVE'` + `mpAccessToken` + `mpUserId`).
- **MercadoPago** (collector = token del pro, con `application_fee`).
- **Cron** `process-bookings`, webhook MP.

### 1.2 APIs reales
- `POST /api/bookings/slot-hold` (`src/app/api/bookings/slot-hold/route.ts:42-65`) — hold conditional `updateMany`, 409 en colisión.
- `POST /api/bookings/checkout` (`src/app/api/bookings/checkout/route.ts`) — transacción real con `SELECT ... FOR UPDATE` (líneas 324-338), gate MP (271-287), llamada a MP fuera de la tx (386-435), compensación en excepción (453-458).
- `POST /api/payments/webhook/mercadopago` (`src/app/api/payments/webhook/mercadopago/route.ts`) — idempotente vía `ProcessedWebhookEvent`.
- `GET /api/marketplace/search-professionals` y `GET /api/marketplace/availability` — gating `mpAccountStatus='ACTIVE'`.

### 1.3 Diagrama de estados (happy path)
```
[Customer busca]  search-professionals (filtra mpAccountStatus=ACTIVE)
       |
       v
[slot-hold]  AvailabilitySlot.holdExpiresAt = now+5min, heldByUserId
       |
       v
[checkout]  TX: SELECT FOR UPDATE slot.isAvailable=true -> set isAvailable=false
            Booking: (nuevo) status=PENDING_PAYMENT, paymentStatus=PENDING
            Payment: idempotencyKey unique, providerStatus='created'
       |  (fuera de TX) createMercadoPagoMarketplacePayment(collector token, application_fee)
       v
[MP webhook 'approved']  TX(idealmente): Payment.PAID, Booking.CONFIRMED
       |
       v
[Pro check-in] IN_PROGRESS  -> [Pro complete] AWAITING_CUSTOMER_CONFIRMATION
       |
       v
[customer-confirm] PAYOUT_SCHEDULED + Payout(PENDING)
       |                         (o silencio 24h -> cron)
       v
[cron process-bookings]  Payout.PAID, escrow.RELEASED, Booking.COMPLETED
```

### 1.4 Dependencias asíncronas
- Webhook MP (idempotencia vía `ProcessedWebhookEvent`).
- Cron `process-bookings` (horario) para release del payout.
- `reconcilePendingPayments` como red de seguridad (sólo si `providerPaymentId != null`).

### 1.5 Dónde se rompe (cross-reference)
- **[CRÍTICO]** Tras `customer-confirm`, el booking queda en `PAYOUT_SCHEDULED` + `Payout(PENDING)` y **ningún cron lo procesa**: `processBookingsForPayout` sólo consulta `AWAITING_CUSTOMER_CONFIRMATION` (`payouts-processor.ts:41-46`). El payout del happy path más común **nunca se libera**. → §5.1.
- **[CRÍTICO]** El webhook escribe `ProcessedWebhookEvent` **antes** de mutar la DB; si la tx falla, el evento queda commiteado y el reintento de MP se trata como duplicado → booking atascado en `PENDING_PAYMENT` con cliente cobrado (`webhook/mercadopago/route.ts:116-130, 165-204`). → §6.1.
- **[MEDIO]** Slot puede quedar `isAvailable=false` huérfano si el proceso muere entre creación del booking y respuesta de MP (compensación nunca corre; `releaseExpiredHolds` salta slots con booking; `reconcile` requiere `providerPaymentId != null`) (`checkout/route.ts:324-462`, `payouts-processor.ts:223-239, 282`). → §8.1.
- **[BAJO]** El hold de 5 min es advisory: checkout sólo valida `isAvailable`, no `heldByUserId`, así que un usuario que nunca tuvo el hold puede ganar el slot ("first to pay wins") (`checkout/route.ts:129-170, 324-338`).

---

## 2. FLUJO: Provider Onboarding (alta de profesional)

### 2.1 Actores
- **Pro** (rol PRO), **Admin** (aprueba/activa), **MercadoPago** (conexión OAuth del collector).

### 2.2 APIs / artefactos reales
- Wizard de 12 pasos respaldado por `CleaningOnboarding`.
- `POST /api/onboarding/cleaning/start`, `/me`, `/submit` (`submit/route.ts:53,313-326` exige `phoneValidatedAt` no nulo).
- Admin: `src/app/api/admin/onboarding/cleaning/route.ts` — acciones `approve` (368-445) y `activate` (479-537).
- Publicación: `getTaskerPublicationState` + `syncTaskerMarketplaceServicesFromOnboarding` + `syncTaskerAvailabilitySlotsFromOnboarding` (`src/lib/tasker-publication.ts`).
- Gates de pago (PRODUCTION-READY): `search-professionals` (185-191), `availability` (30-37), `checkout` (271-287).

### 2.3 Diagrama de estados
```
[Pro completa wizard 12 pasos]  CleaningOnboarding (listMissingFields ~30 campos)
       |  submit (requiere phoneValidatedAt != null, docs, datos bancarios)
       v
[Admin approve]  status=APROBADO
                 ProfessionalProfile.isVerified=true, verificationStatus='APPROVED'
                 TaskerService rows activos
       |  (NO valida communes/rate; NO setea ACTIVO)
       v
[Admin activate]  status=ACTIVO  (valida serviceCommunes>0, rate, categoría)
                  genera AvailabilitySlots, activatedAt
```

### 2.4 Dónde se rompe (cross-reference)
- **[ALTO]** El fallback "legacy-verified" en search (`search-professionals/route.ts:352-361`) publica perfiles `APROBADO` antes de `activate`: un pro con MP conectado aparece en búsqueda y es reservable **saltando el gate de activación** (validación de communes, generación de slots) (`admin/onboarding/cleaning/route.ts:368-445`, `tasker-publication.ts:266-390`). Fix: requerir `status ACTIVO` o no setear `isVerified=true` hasta activate.
- **[MEDIO]** `approve` no valida `getTaskerPublicationState` (communes/rate/categoría) como sí hace `activate`; puede aprobar+publicar perfil incompleto (`route.ts:368-398,479-537`).
- **[MEDIO]** Documentos de identidad y fotos caen a **base64 multi-MB en la fila** de `CleaningOnboarding` cuando R2 no está configurado (`validators.ts:247-255,314-331`; presign devuelve 503 → fallback `fileToDataUrl`). Bloat de DB, lentitud del admin queue (`storage/r2.ts:82-89,147-157`, `uploads/presign/route.ts:27-32`).
- **[BAJO/peligroso]** Rutas SMS muertas `phone/send`/`phone/verify` siguen vivas; `phone/send` setea `phoneValidatedAt=null` (`phone/send/route.ts:61-71`), rompiendo `submit` sin path de UI para revalidar → lockout silencioso.
- **[BAJO]** `AvailabilitySlot` sin constraint único en `(professionalProfileId, startsAt, endsAt)`; dedupe sólo in-memory; syncs concurrentes (lazy desde search, `search-professionals/route.ts:389-408`) pueden crear slots duplicados → doble-booking del pro (`tasker-publication.ts:392-479`).

### 2.5 Lo que SÍ funciona (no tocar)
- El gate de MP (`mpAccountStatus='ACTIVE'` + token + userId) está correctamente aplicado en search, availability y checkout. Un pro sin capacidad de payout **no puede** recibir un booking pagado. (PRODUCTION-READY.)

---

## 3. FLUJO: Payout Lifecycle (liberación del pago al pro)

### 3.1 Actores
- **Customer** (confirma o guarda silencio), **Pro** (recibe), **Cron** `process-bookings`, **MercadoPago** (escrow + release).

### 3.2 APIs / procesador reales
- `POST /api/marketplace/bookings/[bookingId]/customer-confirm` (`customer-confirm/route.ts:48-99`) — AWAITING → PAYOUT_SCHEDULED + Payout(PENDING).
- `POST /api/marketplace/bookings/[bookingId]/payout/request` (`payout/request/route.ts:22-69`) — pro/admin crean Payout (no cambian status del booking).
- Procesador: `processBookingsForPayout` (`src/lib/payouts-processor.ts:38-215`), `HOLD_HOURS=24`.
- Trigger manual: `POST /api/marketplace/payouts/process-timeouts` (sin botón UI).

### 3.3 Diagrama de estados (camino del cron)
```
[Booking AWAITING_CUSTOMER_CONFIRMATION + PAID + updatedAt <= now-24h]
       |  (excluye bookings con dispute OPEN/IN_REVIEW, payouts-processor.ts:50-58)
       v
[re-query MP]  if status === 'approved':   <-- HEURÍSTICA, no lee money_release_date
       |          Payout.PAID, escrow.RELEASED, Payout.paidAt=now
       |          Booking.COMPLETED
       |       elif status === 'refunded':  Payout.FAILED
       |       else / throw:                Payout.PROCESSING, Booking.PAYOUT_SCHEDULED
       v
[notifyPayoutReleased]  (fuera de TX, fire-and-forget)
```

### 3.4 Transiciones de PayoutStatus
`PENDING` →(cron, approved)→ `PAID` | →(refunded)→ `FAILED` | →(no-approved/throw)→ `PROCESSING` (limbo).

### 3.5 Dónde se rompe (cross-reference)
- **[CRÍTICO]** `PAYOUT_SCHEDULED` no lo procesa nadie (happy path de `customer-confirm`) → pro nunca cobra (`payouts-processor.ts:41-46`). → §1.5, §5.1.
- **[CRÍTICO/ALTO]** `escrow=RELEASED` y `Payout=PAID` se setean por heurística `status==='approved'` tras 24h, **sin leer `money_release_date`** (`payouts-processor.ts:78-105, 121-149`). MP puede seguir reteniendo fondos días. Libros divergen de MP; pro avisado "pagado" sin dinero.
- **[ALTO]** El cron **no verifica `pro.mpAccountStatus==='ACTIVE'`** ni que el token siga válido; si `mpAccessToken` es null cae al **token de plataforma** (`getMercadoPagoPayment`, `payouts-processor.ts:80-82`) y consulta bajo el contexto equivocado, igual marca RELEASED. Checkout sí exige ACTIVE (271-287), el payout no.
- **[ALTO]** Reembolso parcial no ajusta `Payout.amountClp`; un payout de monto completo se libera tras un `PARTIAL_REFUNDED` → plataforma paga lo ya reembolsado (`disputes/route.ts:244-291`, `payouts-processor.ts:88-105`).
- **[MEDIO]** Payout en `PROCESSING` es limbo terminal: el cron sólo re-selecciona `AWAITING_CUSTOMER_CONFIRMATION`, no `PAYOUT_SCHEDULED`, así que un `PROCESSING` nunca se reintenta (`payouts-processor.ts:95-105,162-171`). → §10.8.
- **[BAJO]** `payout/request` (pro-iniciado) crea Payout sin cambiar status; amplía la ventana de release antes de la confirmación/disputa del cliente (`payout/request/route.ts:22-69`).
- **[BAJO]** Notificación de release fuera de TX, sin outbox/retry; si el email falla, el pro nunca se entera y el cron no reintenta (`payouts-processor.ts:107-212`).

---

## 4. FLUJO: Dispute Lifecycle (disputas)

### 4.1 Actores
- **Customer**, **Pro**, **Admin** (resuelve manualmente), **MercadoPago** (refund).

### 4.2 APIs reales
- `POST /api/marketplace/disputes` (`disputes/route.ts:46-87`) — `assertTransition(status→DISPUTE)`, setea `dueDateAt = now+5 días`.
- `PATCH /api/marketplace/admin/disputes` (`admin/disputes/route.ts:190-291`) — valida `canTransition(...,REFUNDED,'ADMIN')` (208), llama `refundProviderPayment` (224, **antes** de la TX), persiste estado.
- UI admin: `src/app/admin/disputes/page.tsx` (badge SLA por fila, sin sort por urgencia).

### 4.3 Diagrama de estados
```
[Booking en CONFIRMED/IN_PROGRESS/AWAITING/PAYOUT_SCHEDULED/COMPLETED]
       |  POST disputes -> Booking.DISPUTE, DisputeTicket(status=OPEN, dueDateAt=now+5d)
       v
[Payout bloqueado mientras dispute OPEN/IN_REVIEW]  (payouts-processor.ts:50-58)
       |
       v
[Admin PATCH resuelve]  -> REFUNDED (refund MP) | back to prior | CLOSED
       |  (única salida real; dueDateAt NUNCA se lee por ningún cron)
       v
[si nadie actúa]  DISPUTE para siempre, payout congelado
```

### 4.4 Dónde se rompe (cross-reference)
- **[ALTO]** `dueDateAt` se escribe pero **ningún cron/job lo lee** (`disputes/route.ts:70-87`, `payouts-processor.ts:50-58`, `prisma/schema.prisma:518`). No hay SLA ni auto-resolución → disputa congela el payout indefinidamente. Fix sugerido: cron `process-disputes`.
- **[ALTO/peligroso]** `DisputeTicket.bookingId` **sin constraint único**; el POST no chequea dispute abierta existente → se pueden spamear/reabrir disputas para re-congelar el payout (DoS de payout) (`prisma/schema.prisma:505-527`, `disputes/route.ts:46-87`).
- **[CRÍTICO]** Se puede abrir `COMPLETED → DISPUTE` **después** de que el payout fue PAID/escrow RELEASED, sin path de clawback (`booking-state-machine.ts:72`, `disputes/route.ts:58-87`, `admin/disputes/route.ts:190-242`). → §7.2, §6.3.
- **[ALTO]** El refund a MP se llama **antes** de la TX; si el booking venía de `COMPLETED` y escrow ya se liberó, MP reembolsa al cliente desde fondos de plataforma mientras el pro conserva el dinero (`admin/disputes/route.ts:208-242,271-279`, `booking-state-machine.ts:56-72`). → §6.3.
- **[MEDIO]** Disputas vencidas no tienen contador agregado ni sort por `dueDateAt` (orderBy fijo `createdAt desc`, `disputes/route.ts:73`) → tickets vencidos quedan enterrados (`admin/disputes/page.tsx:57-72`). → §10.6.

---

## 5. FLUJO: MercadoPago Lifecycle (charge → escrow → release/refund)

### 5.1 Actores y artefactos
- **MP Marketplace** con `application_fee` (escrow nativo).
- Cliente MP: `src/lib/payments/providers/mercadopago.ts`.
- Webhook idempotente vía `ProcessedWebhookEvent`.
- `Payment.idempotencyKey @unique`; refund llamado antes de la TX y persistido sólo si MP devuelve `"refunded"`.
- Token-refresh cron mantiene vivos los tokens del collector.

### 5.2 Diagrama de ciclo MP
```
[checkout] createMercadoPagoMarketplacePayment(collector token, application_fee=platformFeeClp)
       |   idempotency key; Payment.providerStatus='created'
       v
[MP cobra] -> webhook 'approved' -> Payment.PAID, Booking.CONFIRMED
       |
       v
[escrow HELD]  (money en MP hasta money_release_date — días)
       |
       v
[cron 24h] heurística status='approved' -> escrow RELEASED (puede ser FALSO)
       |
       +--[refund] POST /v1/payments/{id}/refunds -> si 2xx: status:'refunded' (no valida payload.status)
```

### 5.3 Pricing / application_fee (`src/lib/marketplace-pricing.ts:23-53`)
- `platformFeeClp = round(subtotal * pct)` — **fee sólo sobre labor**, NO sobre extras.
- `total = subtotal + extras + fee` (fee on top, lo paga el cliente).
- `application_fee` enviado a MP = `platformFeeClp` (`checkout/route.ts:433`).
- Collector recibe `total - fee = subtotal + extras`. Payout = `totalPriceClp - platformFeeClp` (`payouts-processor.ts:69`). Internamente consistente, pero **comisión sólo sobre labor** (extras 100% al pro).

### 5.4 Dónde se rompe (cross-reference)
- **[CRÍTICO]** `ProcessedWebhookEvent` commiteado antes de la mutación (`webhook/mercadopago/route.ts:116-130,165-204`). → §6.1.
- **[CRÍTICO/ALTO]** Release por heurística sin `money_release_date` (`payouts-processor.ts:68-105`). → §3.5.
- **[CRÍTICO]** Refund post-COMPLETED imposible / sin clawback (`admin/disputes/route.ts:208-242`, `booking-state-machine.ts:56-72`). → §6.3, §7.2.
- **[CRÍTICO]** **Cualquier HTTP no-2xx de MP (429/500/503) se colapsa a `status:'failed'`** (`mercadopago.ts:466-486,87-103`); `reconcilePendingPayments` mapea `'failed' → Payment.FAILED + Booking.PAYMENT_FAILED` y **libera el slot** (`payouts-processor.ts:254-356`). Un outage transitorio cancela en masa bookings sanos pagados. → §8.2.
- **[ALTO]** Payout sin verificar token ACTIVE (`payouts-processor.ts:54-105`). → §3.5.
- **[ALTO]** Reembolso parcial no ajusta payout/escrow (`disputes/route.ts:244-291`). → §3.5.
- **[MEDIO]** Webhook `'refunded'/'failed'` con transición ilegal escribe `paymentStatus=REFUNDED` pero deja `Booking.status=COMPLETED` → estado contradictorio silencioso (`webhook/mercadopago/route.ts:158-204`).
- **[MEDIO]** `refundMercadoPagoPayment` trata cualquier 2xx como éxito total, no inspecciona `payload.status` (`approved` vs `in_process`) (`mercadopago.ts:488-526`).
- **[MEDIO]** Fee sólo sobre labor, sin ledger dedicado de comisión vs `application_fee` → reporting recalcula desde columnas del booking (`marketplace-pricing.ts:23-53`).
- **[BAJO]** Token puede expirar entre charge y payout sin re-validación proactiva; recuperación = `PROCESSING` indefinido sin escalación (`account-cleanup-processor.ts:112-159`).

---

## 6. FLUJO: Webhook + Reconciliación (consistencia Payment/Booking)

### 6.1 [CRÍTICO] Webhook: idempotencia antes del side-effect
- Ruta: `src/app/api/payments/webhook/mercadopago/route.ts:116-130, 165-204`.
- `prisma.processedWebhookEvent.create({eventId})` (117) → 200 'duplicate' en P2002. Recién **después** la `$transaction` que muta Payment/Booking.
- **Rotura:** si la tx lanza (DB blip, deadlock), retorna 500 pero la fila `ProcessedWebhookEvent` ya está commiteada y NO se rollbackea. El reintento de MP cae en P2002 → 200 `{duplicate:true}` sin actualizar nada. **Payment queda PENDING, Booking PENDING_PAYMENT para siempre, cliente cobrado.**
- Rescate parcial: `reconcilePendingPayments` re-consulta PENDING >10min, **pero sólo si `providerPaymentId != null`** — en el primer webhook puede ser null.
- Fix: mover el insert de `ProcessedWebhookEvent` **dentro** de la misma `$transaction`.

### 6.2 Reconcile-payments (red de seguridad)
- `reconcilePendingPayments` (`payouts-processor.ts:274-356`), cron horario, take:100.
- Requiere `providerPaymentId != null` (282) → bookings sin él nunca se reconcilian.

### 6.3 [CRÍTICO] Refund tras COMPLETED — pérdida financiera irrecuperable
- No existe `COMPLETED → REFUNDED` en la state machine (`booking-state-machine.ts:56-72`). `COMPLETED` sólo va a `DISPUTE` (72).
- Camino tóxico: cron auto-completa a las 24h y libera escrow → 2 días después cliente abre `COMPLETED → DISPUTE` → admin resuelve full refund → `refundProviderPayment` reembolsa al cliente desde fondos de plataforma **mientras el pro ya recibió el escrow**. WeTask come la pérdida sin débito al pro.

---

## 7. FLUJO: Trust / Escrow (auto-confirm, anti-disintermediación, reviews, ratings)

### 7.1 [CRÍTICO] Auto-confirm a las 24h = silencio del cliente como aprobación
- `processBookingsForPayout` (`payouts-processor.ts:38-215`), `complete/route.ts:42-45`, `booking-state-machine.ts:49-52`.
- El cliente que nunca abre la app pierde toda protección a las 24h; única salida = abrir disputa activamente. No se exige señal de servicio real (no hay check-out obligatorio del cliente; `checkInAt/checkOutAt` no se usan como gate).
- **Rotura:** pro no-show o trabajo malo → 'finalizar' → 24h → payout liberado.

### 7.2 [CRÍTICO] Disputa post-payout sin clawback
- `booking-state-machine.ts:72` permite `COMPLETED → DISPUTE`; el POST de disputas no chequea `Payout.PAID`/`escrow RELEASED` (`disputes/route.ts:58-87`). Resolución intenta refund sobre un escrow ya liberado → MP rechaza o plataforma paga doble. → §6.3.

### 7.3 [ALTO] Anti-disintermediación abierta durante toda la ventana de servicio
- `canShareContactDetails(status)` (`chat-safety.ts:22-48`) devuelve true para `CONFIRMED/IN_PROGRESS/COMPLETED`. Como `CONFIRMED` ocurre al pagar (antes del servicio), el bloqueo está efectivamente apagado casi todo el ciclo. Regex de teléfono y keywords triviales de evadir (`messages/route.ts:75-77`). → fuga de comisión recurrente.

### 7.4 [MEDIO] Cliente no puede reseñar en `PAYOUT_SCHEDULED`
- Review POST exige `status === 'COMPLETED'` (`reviews/route.ts:36-38`), pero `customer-confirm` y muchos cierres dejan el booking en `PAYOUT_SCHEDULED` → reseña silenciosamente perdida, rating starved (`payouts-processor.ts:130-139`, `customer-confirm/route.ts:49`).

### 7.5 [MEDIO] Agregación de rating no isolation-safe
- Recompute dentro de `$transaction` pero bajo READ COMMITTED sin `FOR UPDATE`/Serializable → reviews concurrentes escriben `ratingAvg`/`ratingsCount` stale (`reviews/route.ts:46-75`, `prisma/schema.prisma:248-260`).

### 7.6 [BAJO] Race entre customer-confirm y el cron
- Ambos hacen read-then-write sin row lock; el `@unique` de `Payout.bookingId` salva la integridad pero genera 400 espurio / notificaciones duplicadas (`customer-confirm/route.ts:48-99`, `payouts-processor.ts:68-180`).

---

## 8. FLUJO: Booking Expiration / Cancellation / Slot release

### 8.1 [MEDIO] No hay limpieza de `PENDING_PAYMENT` stale → slot leak permanente
- `checkout/route.ts:324-462`, `payouts-processor.ts:223-239,282`.
- Si el proceso muere entre reservar slot (`isAvailable=false`) y manejar la respuesta de MP, la compensación nunca corre. `releaseExpiredHolds` salta slots con cualquier booking; `reconcile` requiere `providerPaymentId != null`. Slot queda inbookable para siempre.

### 8.2 [CRÍTICO] Expiración por error transitorio (mass-cancel)
- `reconcilePendingPayments` marca `PAYMENT_FAILED` y **libera slot** ante cualquier HTTP error de MP (`payouts-processor.ts:254-356`, `mercadopago.ts:466-486`). Un blip de MP cancela bookings pagados y re-vende slots (double-booking). → §5.4.

### 8.3 [ALTO] No existe endpoint de cancelación
- La state machine modela `CANCELLED` (CUSTOMER/PRO desde CONFIRMED/ACCEPTED, `booking-state-machine.ts:30-59`) pero un grep sólo encuentra `cancel` en `me/account` y `pro/slots/[slotId]`. La ruta marketplace status restringe a ADMIN/PRO (`marketplace/bookings/[bookingId]/status/route.ts:13-19`), el cliente no puede llegar. **No hay path que cancele + reembolse + libere slot.** Cada cancelación es operación manual de soporte+finanzas; slots quedan consumidos por bookings muertos.

### 8.4 Orphan bookings (rutas públicas legacy)
- `POST /api/bookings/public` y `POST /api/bookings` crean Booking sólo con `customerId/serviceId/scheduledAt`, `status=PENDING`, sin pro, sin slot, sin Payment, sin auth en la pública (`bookings/public/route.ts:45-95`, `bookings/route.ts:47-86`). Quedan en `PENDING` para siempre; nada los limpia. Vector de spam (crea usuarios + bookings).

---

## 9. FLUJO: Legacy status mutator (bypass total)

### 9.1 [CRÍTICO] `PATCH /api/bookings/[bookingId]/status` sin auth ni state machine
- `src/app/api/bookings/[bookingId]/status/route.ts:7-51`.
- No importa `getRequestIdentity/hasRole`, no llama `assertTransition`. `prisma.booking.update({data:{status, proId}})` directo con cualquier valor del schema.
- **Rotura:** cualquiera fuerza `{status:'COMPLETED'}` sobre un booking impago, borra disputas (`DISPUTE → CONFIRMED`), o reasigna `proId`. Bypass total del gating de pago, holds de disputa y redirección de payouts.
- Fix: borrar la ruta (la de marketplace ya cubre PRO/ADMIN con `assertTransition`) o gatearla tras `requireAdminRequest` + `assertTransition`.

### 9.2 [BAJO] check-in / on-the-way fuera de assertTransition
- `check-in/route.ts:71-110` usa `VALID_STATUSES` hardcoded + `canTransition('PRO')` con fallback; `on-the-way/route.ts:40-55` sólo escribe `onTheWayAt`. Seguros hoy por las allow-lists, pero riesgo de drift contra `BOOKING_TRANSITIONS`.

---

## 10. FLUJO: Admin Review Lifecycle (tooling operacional)

### 10.1 [CRÍTICO] Payouts FAILED invisibles
- `Payout.status=FAILED` se escribe (`payouts-processor.ts:91-94`) pero **nunca se lee**: dashboard y `dashboard-stats` cuentan sólo `PENDING+PROCESSING` (`admin/page.tsx:223`, `dashboard-stats/route.ts:61-63`). No hay `/admin/payouts`, ni API que liste por status, ni botón de retry, ni `@@index([status])` (`prisma/schema.prisma:473-485`). Pro nunca cobra y nadie lo ve.

### 10.2 [ALTO] Sin cola de bookings/payments atascados
- Dashboard sólo muestra "Actividad reciente" (5 últimos por `createdAt`, `admin/page.tsx:276-292`). No hay vista de `PENDING_PAYMENT`, `PENDING` payment, ni `AWAITING_CUSTOMER_CONFIRMATION` >24h (`dashboard-stats/route.ts:37-72`).

### 10.3 [ALTO] AdminAuditLog write-only
- `recordAdminAction` escribe desde 11 sitios (`audit-log.ts:26-41`, p.ej. `payments/refund/route.ts:111`, `admin/disputes/route.ts:320`) pero **cero read paths** — sin `/admin/audit` ni GET. Sin valor operacional/forense en producto.

### 10.4 [ALTO] Sin vista de pros con MP desconectado/expirado y bookings activos
- El signal existe por-usuario (`payouts-processor.ts:78-105`, `refresh-mp-tokens`) pero nunca se agrega para operadores (`admin/page.tsx:200-292`). Payouts impagos se apilan invisibles.

### 10.5 [MEDIO] Trigger manual de payout sin botón
- `POST /api/marketplace/payouts/process-timeouts` (`process-timeouts/route.ts:13-39`) es sólido y admin-guarded pero ninguna página lo invoca → sólo curl. Recuperación de cron caído depende de ingeniería.

### 10.6 [MEDIO] Disputas SLA sin contador agregado ni sort por urgencia
- Badge por fila (`disputes/page.tsx:57-72`), pero `dashboard-stats` sólo expone `openDisputes` (OPEN+IN_REVIEW) y orderBy fijo `createdAt desc` (`disputes/route.ts:73`). → §4.4.

### 10.7 [MEDIO] Refund route standalone sin guard de payment-status ni idempotency
- `POST /api/admin/payments/refund` (`refund/route.ts:40-90`) asierta transición del booking pero no chequea `payment.status != REFUNDED/PARTIAL_REFUNDED`, no capea `amount` y la llamada MP no tiene idempotency key ni lock → riesgo de over-refund por doble-click (rate limit 10/h mitiga pero no elimina). La ruta de disputas es más estricta.

### 10.8 [MEDIO] Payout PROCESSING sin escalación
- `processBookingsForPayout` sólo re-actúa sobre `AWAITING_CUSTOMER_CONFIRMATION`; una vez en `PAYOUT_SCHEDULED` con Payout `PROCESSING` el cron no lo re-selecciona (`payouts-processor.ts:95-105,162-171`). Limbo permanente tras un timeout transitorio de MP. → §3.5.

---

## 11. FLUJO: Async Jobs / Cron (confiabilidad de la maquinaria)

### 11.1 Lo que SÍ funciona (PRODUCTION-READY — no tocar)
- `verifyQStashSignature` (`qstash.ts:31-121`): HS256 + body-hash + exp/nbf, timing-safe, rotación de llaves; `assertQStashRequest` rechaza 401 y no corre sin verificar en prod.
- Aislamiento per-item (try/catch + `logError`) en la mayoría de procesadores (`payouts-processor.ts:176-180`, `account-cleanup-processor.ts:54-99`, reconcile 349-352).
- `Payout.bookingId @unique` + patrón create-or-reuse (`payouts-processor.ts:110-119`) → idempotente bajo at-least-once.
- `logError` → Sentry en prod (`logger.ts:64-74`).

### 11.2 [CRÍTICO] Outage transitorio de MP cancela en masa
- → §5.4 / §8.2 (`mercadopago.ts:466-486,87-103`, `payouts-processor.ts:254-356`).

### 11.3 [CRÍTICO] Release prematuro sin `money_release_date`
- → §3.5 / §5.4 (`payouts-processor.ts:78-149`).

### 11.4 [ALTO] `process-bookings` y `booking-reminders` con `findMany` sin `take:`
- `payouts-processor.ts:41-56` y `booking-reminders/route.ts:40-67` cargan todo + round-trips por item → exceden timeout serverless; QStash reintenta el mismo batch gigante para siempre → payouts/reminders nunca progresan. (reconcile/refresh/hard-delete sí están acotados.)

### 11.5 [ALTO] Sin heartbeat / dead-letter / alerting
- Crons sólo `recordAdminAction` cuando counts >0; una corrida de 0 candidatos o una que nunca dispara no escribe nada. No hay tabla `CronHeartbeat`/`lastRunAt` ni check de cadencia (`process-bookings/route.ts:15-42`, etc.). Si rotan mal la signing key (401), QStash agota retries y todo degrada en silencio por días.

### 11.6 [MEDIO] booking-reminders idempotencia por string de título + ventana 6h
- Dedup por igualdad exacta del título en español + 6h (`booking-reminders/route.ts:54-67`), sin constraint único ni columna de tipo (`prisma/schema.prisma:529-542`). Editar el copy rompe el dedup → spam, o drift → reminders nunca enviados.

### 11.7 [MEDIO] refresh-mp-tokens deshabilita el pro ante CUALQUIER excepción
- `refreshExpiringMpTokens` marca `mpAccountStatus=DISABLED` en cualquier throw, incluyendo 429/5xx/red transitorios (`account-cleanup-processor.ts:144-187`, `mercadopago.ts:223-250`). Un blip de OAuth saca pros sanos del marketplace.

### 11.8 [BAJO] Notificación de payout fuera de TX sin outbox
- → §3.5 (`payouts-processor.ts:107-212`).

### 11.9 [BAJO] Header-auth fallback permite spoofing fuera de prod
- `getRequestIdentity` confía en `x-user-id`/`x-user-role` si `NODE_ENV!=='production'` && `ALLOW_HEADER_AUTH==='true'` (`auth.ts:47-70`). Riesgo de self-review / disputas como otra parte en staging mal configurado (`reviews/route.ts:19-21`, `pro-review/route.ts:35`).

---

## 12. Matriz de roturas por severidad (resumen accionable)

| # | Severidad | Flujo | Síntoma | Archivos clave |
|---|-----------|-------|---------|----------------|
| 1 | CRÍTICO | Payout/Booking | `PAYOUT_SCHEDULED` nunca procesado; pro nunca cobra | `customer-confirm/route.ts:49-99`, `payouts-processor.ts:38-215` |
| 2 | CRÍTICO | Webhook MP | event commiteado antes de mutar; booking atascado PENDING_PAYMENT | `webhook/mercadopago/route.ts:116-130,165-204` |
| 3 | CRÍTICO | Legacy status | `PATCH /api/bookings/[id]/status` sin auth ni state machine | `bookings/[bookingId]/status/route.ts:7-51` |
| 4 | CRÍTICO | Refund/Dispute | refund post-COMPLETED sin clawback; doble pago | `admin/disputes/route.ts:208-242`, `booking-state-machine.ts:56-72` |
| 5 | CRÍTICO | Reconcile/Cron | outage MP → mass-cancel + slot release | `mercadopago.ts:466-486`, `payouts-processor.ts:254-356` |
| 6 | CRÍTICO | Payout/Escrow | release por heurística sin `money_release_date` | `payouts-processor.ts:78-149` |
| 7 | CRÍTICO | Trust | auto-confirm 24h libera por silencio del cliente | `payouts-processor.ts:38-215`, `complete/route.ts:42-45` |
| 8 | CRÍTICO | Trust/Dispute | `COMPLETED → DISPUTE` post-payout sin clawback | `booking-state-machine.ts:72`, `disputes/route.ts:58-87` |
| 9 | CRÍTICO | Admin | Payout FAILED invisible, sin retry | `payouts-processor.ts:91-94`, `dashboard-stats/route.ts:61-63` |
| 10 | ALTO | Onboarding | APROBADO visible en search antes de activate | `search-professionals/route.ts:352-361`, `onboarding/cleaning/route.ts:368-445` |
| 11 | ALTO | Dispute | `dueDateAt` nunca leído; payout congelado | `disputes/route.ts:70-87`, `payouts-processor.ts:50-58` |
| 12 | ALTO | Dispute | sin unique en `DisputeTicket.bookingId`; DoS de payout | `prisma/schema.prisma:505-527` |
| 13 | ALTO | Trust | anti-disintermediación abierta desde CONFIRMED | `chat-safety.ts:22-48`, `messages/route.ts:75-77` |
| 14 | ALTO | Cancellation | sin endpoint de cancel/refund/release de slot | `booking-state-machine.ts:30-59`, `marketplace/bookings/[id]/status/route.ts:13-19` |
| 15 | ALTO | Payout/MP | payout sin verificar token ACTIVE; fallback a token plataforma | `payouts-processor.ts:54-105` |
| 16 | ALTO | Payments | reembolso parcial no ajusta payout/escrow | `disputes/route.ts:244-291` |
| 17 | ALTO | Cron | `process-bookings`/`booking-reminders` sin `take:` | `payouts-processor.ts:41-56`, `booking-reminders/route.ts:40-67` |
| 18 | ALTO | Cron | sin heartbeat/dead-letter/alerting | `process-bookings/route.ts:15-42` (+ resto) |
| 19 | ALTO | Admin | sin cola de stuck-bookings/payments | `dashboard-stats/route.ts:37-72` |
| 20 | ALTO | Admin | AdminAuditLog write-only | `audit-log.ts:26-41` |
| 21 | ALTO | Admin | sin vista de pros MP desconectados con bookings activos | `payouts-processor.ts:78-105` |
| 22 | ALTO | Onboarding | refresh deshabilita pro ante error transitorio | `account-cleanup-processor.ts:144-187` |
| 23 | MEDIO | Onboarding | approve no valida communes/rate | `onboarding/cleaning/route.ts:368-398,479-537` |
| 24 | MEDIO | Onboarding | docs base64 multi-MB en DB sin R2 | `validators.ts:247-255,314-331`, `storage/r2.ts:82-89` |
| 25 | MEDIO | Booking | slot leak en PENDING_PAYMENT stale | `checkout/route.ts:324-462`, `payouts-processor.ts:223-239` |
| 26 | MEDIO | Booking | orphan bookings públicos sin pago/pro/slot | `bookings/public/route.ts:45-95`, `bookings/route.ts:47-86` |
| 27 | MEDIO | Payments | webhook refunded/failed deja estado contradictorio | `webhook/mercadopago/route.ts:158-204` |
| 28 | MEDIO | Payments | refund MP cualquier 2xx = éxito (no valida `payload.status`) | `mercadopago.ts:488-526` |
| 29 | MEDIO | Payments | fee sólo sobre labor; sin ledger dedicado | `marketplace-pricing.ts:23-53` |
| 30 | MEDIO | Trust | review bloqueada en PAYOUT_SCHEDULED | `reviews/route.ts:36-38`, `payouts-processor.ts:130-139` |
| 31 | MEDIO | Trust | rating aggregation no isolation-safe | `reviews/route.ts:46-75` |
| 32 | MEDIO | Admin | trigger manual de payout sin botón | `process-timeouts/route.ts:13-39` |
| 33 | MEDIO | Admin | disputas SLA sin contador ni sort | `disputes/page.tsx:57-72`, `disputes/route.ts:73` |
| 34 | MEDIO | Admin | refund route sin guard payment-status ni idempotency | `admin/payments/refund/route.ts:40-90` |
| 35 | MEDIO | Payout | PROCESSING sin escalación | `payouts-processor.ts:95-105,162-171` |
| 36 | MEDIO | Cron | reminders idempotencia por string+ventana | `booking-reminders/route.ts:54-67` |
| 37 | BAJO | Onboarding | rutas SMS muertas anulan `phoneValidatedAt` | `phone/send/route.ts:61-71` |
| 38 | BAJO | Onboarding | AvailabilitySlot sin unique; syncs concurrentes duplican | `tasker-publication.ts:392-479` |
| 39 | BAJO | Booking | hold no re-validado por ownership en checkout | `checkout/route.ts:129-170,324-338` |
| 40 | BAJO | Booking | check-in/on-the-way fuera de assertTransition | `check-in/route.ts:71-110`, `on-the-way/route.ts:40-55` |
| 41 | BAJO | Payout | payout/request pro-iniciado descoordinado | `payout/request/route.ts:22-69` |
| 42 | BAJO | Trust | race customer-confirm vs cron (notif duplicadas) | `customer-confirm/route.ts:48-99` |
| 43 | BAJO | Auth | header-auth fallback permite spoofing fuera de prod | `auth.ts:47-70` |

---

## 13. Componentes verificados como PRODUCTION-READY (no regresionar)
- Gate de MP en search/availability/checkout (`search-professionals/route.ts:185-191`, `availability/route.ts:30-37`, `checkout/route.ts:271-287`).
- Checkout con `SELECT ... FOR UPDATE` para reclamar slots; `slot-hold` conditional `updateMany` (409 en colisión).
- `Payment.idempotencyKey @unique`, `Payout.bookingId @unique`.
- Webhook idempotente vía `ProcessedWebhookEvent` (con la salvedad crítica de §6.1).
- State machine aplicada en marketplace status/complete/check-out/customer-confirm/disputes/refund.
- QStash auth (`qstash.ts:31-121`) + aislamiento per-item + idempotencia de payout.
