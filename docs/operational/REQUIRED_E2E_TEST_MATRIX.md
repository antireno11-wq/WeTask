# REQUIRED E2E TEST MATRIX — WeTask Marketplace

> Documento de cobertura E2E obligatoria para el lanzamiento a producción de WeTask.
> Construido **exclusivamente** a partir de los hallazgos de auditoría reales en 6 dominios
> (booking-integrity, payments-mercadopago, provider-onboarding, admin-tooling, async-jobs-cron, marketplace-trust).
> Cada test referencia archivos reales del repo y el gap que protege. No se inventan flujos no presentes en la auditoría.

## Cómo leer esta matriz

- **Actor**: quién origina la acción — `CUSTOMER`, `PRO`, `ADMIN`, `SYSTEM` (cron/QStash/webhook).
- **Nivel de riesgo**: `CRÍTICO` (pérdida directa de dinero o integridad de estado), `ALTO` (fondos congelados / fuga / confianza), `MEDIO` (desync / abuso / margen), `BAJO` (UX / mantenibilidad).
- **Gap que protege**: hallazgo de auditoría que el test verifica que NO ocurra (o que está mitigado tras el fix).
- Cada caso usa: ID, escenario, precondiciones, pasos, resultado esperado, gap protegido.

### Convención de IDs

`E2E-<ACTOR>-<NN>` donde ACTOR ∈ {CUST, PRO, ADM, SYS}. Los casos transversales de concurrencia/webhook usan `E2E-CONC-<NN>`.

### Mapa de severidad → cantidad de hallazgos cubiertos

| Dominio | Hallazgos | Críticos | Altos | Medios | Bajos | Production-ready (verificación positiva) |
|---|---|---|---|---|---|---|
| booking-integrity | 10 | 2 | 3 | 2 | 3 | 0 |
| payments-mercadopago | 10 | 3 | 3 | 3 | 1 | 0 |
| provider-onboarding | 6 | 0 | 1 | 3 | 2 | 1 |
| admin-tooling | 8 | 1 | 3 | 4 | 0 | 0 |
| async-jobs-cron | 8 | 2 | 2 | 2 | 1 | 1 |
| marketplace-trust | 9 | 2 | 3 | 2 | 2 | 0 |

---

# 1. ACTOR: CUSTOMER

## 1.1 Riesgo CRÍTICO

| ID | Escenario | Precondiciones | Pasos | Resultado esperado | Gap que protege |
|---|---|---|---|---|---|
| E2E-CUST-01 | Cliente confirma servicio explícitamente y el payout del pro se libera | Booking en `AWAITING_CUSTOMER_CONFIRMATION`, `paymentStatus=PAID`, sin dispute, pro con `mpAccountStatus=ACTIVE` | 1) POST customer-confirm (`customer-confirm/route.ts:49-99`). 2) Verificar transición a `PAYOUT_SCHEDULED` + `Payout(PENDING)`. 3) Ejecutar cron process-bookings. 4) Re-consultar booking/payout. | El cron `processBookingsForPayout` DEBE seleccionar también `PAYOUT_SCHEDULED`, transicionar a `COMPLETED`, marcar `Payout=PAID` y `escrowStatus=RELEASED`. El payout NO debe quedar `PENDING` para siempre. | booking-integrity #1 (PAYOUT_SCHEDULED nunca procesado; `payouts-processor.ts:38-215`, `customer-confirm/route.ts:62-99`, `cron/process-bookings/route.ts:15-42`) |
| E2E-CUST-02 | Cliente NO confirma (ghosting) y el servicio no se realizó | Pro marcó `complete` → `AWAITING_CUSTOMER_CONFIRMATION`, `checkOutAt=null`, cliente nunca abre la app, pasan 24h+ | 1) Avanzar reloj 24h. 2) Ejecutar process-bookings. 3) Verificar destino del booking y del payout. | Con `checkOutAt=null` el auto-release NO debe liberar payout automáticamente; debe enrutarse a cola de revisión manual o exigir señal positiva de completitud. Recordatorios escalonados (T+6h/T+18h) registrados en Notification. | marketplace-trust #1 (auto-confirm por silencio; `payouts-processor.ts:38-215`, `complete/route.ts:42-45`, `booking-state-machine.ts:49-52`) |
| E2E-CUST-03 | Cliente abre dispute DESPUÉS de que el payout ya fue liberado | Booking `COMPLETED`, `Payout=PAID`, `escrowStatus=RELEASED` | 1) POST disputes (`marketplace/disputes/route.ts:58-87`) sobre booking COMPLETED. 2) Admin resuelve con `refundAmountClp>0`. | Abrir dispute debe bloquearse si `Payout=PAID`/`escrow=RELEASED` y enrutar a flujo "post-payout claim". El refund automático NO debe ejecutarse sin clawback al pro (Payout negativo / débito). No debe producirse doble pago (pro pagado + cliente reembolsado de fondos de plataforma). | marketplace-trust #2 (`booking-state-machine.ts:72`, `marketplace/disputes/route.ts:58-87`, `admin/disputes/route.ts:190-242`); payments-mercadopago #3 |
| E2E-CUST-04 | Refund de cliente tras `COMPLETED` (no existe edge COMPLETED→REFUNDED) | Booking `COMPLETED`, escrow `RELEASED`, pago `approved` en MP | 1) Admin intenta refund vía disputes route. 2) Observar orden: llamada a MP antes de la tx (`admin/disputes/route.ts:208-242`). | El refund a MP NO debe ejecutarse antes de validar la transición; si escrow ya liberado debe bloquear refund automático o reembolsar solo la porción de fee. No debe reembolsarse al cliente mientras el pro conserva el escrow liberado. | payments-mercadopago #3 (`admin/disputes/route.ts:208-242,271-279`, `booking-state-machine.ts:56-72`) |

## 1.2 Riesgo ALTO

| ID | Escenario | Precondiciones | Pasos | Resultado esperado | Gap que protege |
|---|---|---|---|---|---|
| E2E-CUST-05 | Cliente cancela una reserva pagada (no existe endpoint de cancelación) | Booking `CONFIRMED`/`ACCEPTED`, `paymentStatus=PAID`, slot `isAvailable=false` | 1) CUSTOMER invoca cancelación. 2) Verificar refund + liberación de slot. | Debe existir `POST /api/marketplace/bookings/[bookingId]/cancel`: autentica owner, `assertTransition(→CANCELLED)`, en una tx setea `CANCELLED`, llama `refundProviderPayment`, marca `paymentStatus=REFUNDED` y devuelve el slot a `isAvailable=true` con `heldExpiresAt/heldByUserId=null`. | booking-integrity #3 (no existe cancel endpoint; `booking-state-machine.ts:30-59`, `marketplace/bookings/[bookingId]/status/route.ts:13-19`) |
| E2E-CUST-06 | Cliente intenta exponer/leer historial de acciones admin sobre su booking | Booking con refund/dispute resueltos, `AdminAuditLog` poblado | 1) Operador consulta acciones de dinero del booking. | Debe existir `GET /api/admin/audit-log` y `/admin/audit` para revisar quién hizo qué (refunds, disputes, payouts). Hoy `AdminAuditLog` es write-only. | admin-tooling #3 (`audit-log.ts:26-41`, `schema.prisma:671-684`) |
| E2E-CUST-07 | Cliente con hold de 5 min pierde el slot ante un comprador más rápido sin hold | User A mantiene hold (`heldByUserId=A`, `holdExpiresAt` futuro), slot `isAvailable=true` | 1) User B (sin hold) corre checkout sobre el mismo slot. 2) Verificar guard `FOR UPDATE` (`checkout/route.ts:324-338`). | El guard `FOR UPDATE` debe exigir además que el hold pertenezca al comprador o esté vacío/expirado (`"heldByUserId"=customerId OR holdExpiresAt IS NULL OR holdExpiresAt < now()`), devolviendo 409 a B. El hold debe ser protector durante su ventana. | booking-integrity #8 (`slot-hold/route.ts:42-65`, `checkout/route.ts:129-170,324-338`) |

## 1.3 Riesgo MEDIO

| ID | Escenario | Precondiciones | Pasos | Resultado esperado | Gap que protege |
|---|---|---|---|---|---|
| E2E-CUST-08 | Cliente no puede reseñar tras confirmar (queda en PAYOUT_SCHEDULED) | Cliente usó customer-confirm → booking `PAYOUT_SCHEDULED` | 1) CUSTOMER intenta POST reviews (`reviews/route.ts:36-38`). | El review debe permitirse cuando `status ∈ {COMPLETED, PAYOUT_SCHEDULED}` (servicio entregado + pago en curso). No debe perderse silenciosamente la reseña ni bloquearse con "Solo puedes reseñar reservas finalizadas". | marketplace-trust #6 (`reviews/route.ts:36-38`, `payouts-processor.ts:130-139`, `customer-confirm/route.ts:49`) |
| E2E-CUST-09 | Reembolso parcial de cliente recordado como completo aunque MP lo deja `in_process` | MP responde 201 con refund en `in_process` | 1) Admin emite partial refund. 2) Verificar status persistido. | El sistema debe parsear `payload.status` del objeto refund y solo marcar `refunded` cuando MP confirma `approved`; si `in_process` debe quedar `pending`. No notificar "se procesó un reembolso" prematuramente. | payments-mercadopago #7 (`providers/mercadopago.ts:488-526`, `admin/disputes/route.ts:229-241`) |
| E2E-CUST-10 | Booking público huérfano creado por visitante sin pago ni pro | Visitante usa formulario público | 1) POST `/api/bookings/public` (`bookings/public/route.ts:45-95`). 2) Verificar estado y limpieza. | El booking NO debe quedar `PENDING` indefinidamente sin Payment/pro/slot. Debe crearse en `PENDING_PAYMENT` ligado a intent y un cron debe expirar bookings stale sin Payment tras N minutos; ruta pública con auth/rate-limit/verificación de email. | booking-integrity #6 (`bookings/public/route.ts:45-95`, `bookings/route.ts:47-86`) |

## 1.4 Riesgo BAJO

| ID | Escenario | Precondiciones | Pasos | Resultado esperado | Gap que protege |
|---|---|---|---|---|---|
| E2E-CUST-11 | Pro forja identidad de cliente y se auto-reseña (header-auth fuera de prod) | Entorno staging con `ALLOW_HEADER_AUTH=true`, datos reales | 1) Pro envía `x-user-id`=customer, `x-user-role`=CUSTOMER. 2) POST reviews 5★ de su propio booking. | `ALLOW_HEADER_AUTH` NUNCA debe ser true en entornos accesibles desde internet (startup check). El test confirma que en prod el header-auth no se usa y el spoofing falla. | marketplace-trust #9 (`auth.ts:47-70`, `reviews/route.ts:19-21`, `pro-review/route.ts:35`) |

---

# 2. ACTOR: PRO

## 2.1 Riesgo CRÍTICO

| ID | Escenario | Precondiciones | Pasos | Resultado esperado | Gap que protege |
|---|---|---|---|---|---|
| E2E-PRO-01 | Pro espera su payout tras confirmación happy-path del cliente | Booking llega a `PAYOUT_SCHEDULED` por customer-confirm, `Payout(PENDING)` | 1) Ejecutar process-bookings repetidamente. 2) Verificar `Payout` final. | El `Payout` DEBE pasar a `PAID` y `escrowStatus=RELEASED`. NO debe quedar congelado en `PENDING` por exclusión del WHERE del cron. | booking-integrity #1 (`payouts-processor.ts:41-46`, `customer-confirm/route.ts:62-99`) |

## 2.2 Riesgo ALTO

| ID | Escenario | Precondiciones | Pasos | Resultado esperado | Gap que protege |
|---|---|---|---|---|---|
| E2E-PRO-02 | Pro recibe email "payout liberado" pero MP aún retiene fondos (money_release_date futuro) | Pago `approved`, `money_release_date` 4 días en el futuro, pasaron 24h | 1) Ejecutar process-bookings. 2) Verificar `escrowStatus`, `Payout`, notificación. | `Payout=PAID`/`escrow=RELEASED` SOLO cuando `status=approved` AND `money_release_date <= now`. Mientras tanto `Payout=PROCESSING` y NO enviar `notifyPayoutReleased`. `escrowReleasedAt` debe usar el timestamp real de release, no `new Date()`. | payments-mercadopago #2, async-jobs-cron #2, booking-integrity #5 (`payouts-processor.ts:68-149`) |
| E2E-PRO-03 | Pro pierde conexión MP entre booking y payout (token revocado) | Booking `PAID`/`AWAITING_CONFIRMATION`, `mpAccountStatus=DISABLED`, token stale | 1) Ejecutar process-bookings. 2) Verificar que NO haga fallback al token de plataforma. | El cron debe exigir `pro.mpAccountStatus=ACTIVE` y `mpAccessToken` no nulo; si no, dejar `Payout=PROCESSING` y notificar reconexión. NUNCA confirmar release con el token de plataforma. | payments-mercadopago #4 (`payouts-processor.ts:54-105`, `account-cleanup-processor.ts:123-189`, `checkout/route.ts:271-287`) |
| E2E-PRO-04 | Payout del pro queda en PROCESSING tras timeout de MP, sin reintento | MP hace timeout en el release-check → `Payout=PROCESSING`, booking `PAYOUT_SCHEDULED` | 1) Ejecutar varios ciclos de cron. 2) Verificar que el payout se reintenta. | Una segunda pasada del processor debe seleccionar bookings `PAYOUT_SCHEDULED` con `Payout ∈ {PENDING, PROCESSING}` antiguos, re-consultar MP y completar/fallar. NO debe quedar limbo permanente. | admin-tooling #8 (`payouts-processor.ts:95-105,162-171`) |
| E2E-PRO-05 | Pro queda `DISABLED` por error transitorio de OAuth de MP (503) | Endpoint OAuth de MP responde 503 en refresh diario | 1) Ejecutar refresh-mp-tokens. 2) Verificar `mpAccountStatus`. | Solo se debe `DISABLE` ante grant permanentemente inválido (`invalid_grant`/401). Ante 429/5xx/red debe mantenerse `ACTIVE`, contar `failed` y reintentar el siguiente día. No debe sacarse al pro de la búsqueda por un blip. | async-jobs-cron #6 (`account-cleanup-processor.ts:144-187`, `providers/mercadopago.ts:223-250`) |

## 2.3 Riesgo MEDIO

| ID | Escenario | Precondiciones | Pasos | Resultado esperado | Gap que protege |
|---|---|---|---|---|---|
| E2E-PRO-06 | Pro aprobado-pero-no-activado aparece en búsqueda antes del gate de activación | Onboarding `APROBADO` (no `ACTIVO`), MP conectado, `isVerified=true`, servicios activos | 1) Cliente busca categoría/comuna. 2) Verificar si el pro aparece (`search-professionals/route.ts:342-361`). | El pro NO debe surgir en búsqueda hasta `status=ACTIVO`. La activación valida `serviceCommunes>0` y genera slots. Eliminar el fallback legacy-verified o diferir `isVerified=true` hasta activar. | provider-onboarding #1 (`admin/onboarding/cleaning/route.ts:368-445`, `tasker-publication.ts:266-390`, `search-professionals/route.ts:32,342-361`) |
| E2E-PRO-07 | Aprobación publica perfil con comuna/tarifa incompletas (approve no valida) | Onboarding con `serviceCommunes` vacío, solo `baseCommune` | 1) Admin ejecuta `approve`. 2) Verificar publicación. | El branch `approve` debe computar `getTaskerPublicationState` y rechazar (409 con `missingRequirements`) como hace `activate`, o no publicar en approve. | provider-onboarding #2 (`admin/onboarding/cleaning/route.ts:368-398,479-537`) |
| E2E-PRO-08 | Reembolso parcial deja payout en monto completo → doble pago de lo reembolsado | Payment `PARTIAL_REFUNDED`, booking `REFUNDED`, existe `Payout` de monto completo | 1) Admin emite 50% partial refund. 2) Verificar `Payout.amountClp`. | El partial refund debe decrementar `Payout.amountClp` (y la cuota de `application_fee`), setear `escrowStatus=PARTIALLY_REFUNDED` y excluir `REFUNDED/PARTIAL_REFUNDED` del processor. No pagar al pro el monto pre-refund. | payments-mercadopago #5 (`admin/disputes/route.ts:244-291`, `payouts-processor.ts:88-105`) |

## 2.4 Riesgo BAJO

| ID | Escenario | Precondiciones | Pasos | Resultado esperado | Gap que protege |
|---|---|---|---|---|---|
| E2E-PRO-09 | Documentos de identidad del pro se guardan como base64 multi-MB en DB (R2 no configurado) | Vars R2 ausentes en prod, pro completa onboarding | 1) Pro sube carnet/antecedentes. 2) Verificar storage (DB vs R2). | En prod, R2 ausente debe ser hard-failure para campos de documentos; rechazar valores `data:` cuando `isStorageConfigured()`. Health check de R2 antes de aceptar submissions. | provider-onboarding #3 (`validators.ts:247-255,314-331`, `registro/utils.ts:203-234`, `storage/r2.ts:82-89,147-157`) |
| E2E-PRO-10 | Pro queda bloqueado de submit tras golpear ruta muerta phone/send | SMS removido de la UI, pro o cliente cacheado golpea `phone/send` | 1) POST `/api/onboarding/cleaning/phone/send`. 2) Intentar submit. | `phone/send` NO debe poner `phoneValidatedAt=null` (rompe submit sin ruta de re-validación). Eliminar rutas phone/send, phone/verify, phone/claim o quitar el write nullificador. | provider-onboarding #4 (`phone/send/route.ts:61-71`, `phone/verify/route.ts:34-42`, `submit/route.ts:53,313-326`) |
| E2E-PRO-11 | Pro auto-solicita payout-request descoordinado con el cron | Booking `AWAITING_CUSTOMER_CONFIRMATION`, pro hace payout/request | 1) POST payout/request (`payout/request/route.ts:22-69`). 2) Esperar cron 24h. | `Payout.bookingId @unique` previene fila duplicada; el `payout/request` no debe habilitar `PAID` ni adelantar el release antes de respetar la ventana de dispute. Documentar el único camino canónico de payout. | booking-integrity #10 (`payout/request/route.ts:22-69`, `payouts-processor.ts:108-127`) |
| E2E-PRO-12 | Pro no recibe email de payout (envío fire-and-forget falla tras commit) | Tx pone `PAID/COMPLETED/RELEASED`, proveedor de email responde 500 | 1) Ejecutar process-bookings con email mockeado a fallar. 2) Verificar reintento. | La notificación debe salir de un outbox durable (fila en tx, entrega idempotente por cron) para reintentar; el email solo se envía una vez confirmado el release real. | async-jobs-cron #7 (`payouts-processor.ts:107-212`) |

---

# 3. ACTOR: ADMIN

## 3.1 Riesgo CRÍTICO

| ID | Escenario | Precondiciones | Pasos | Resultado esperado | Gap que protege |
|---|---|---|---|---|---|
| E2E-ADM-01 | Admin debe poder ver y reintentar payouts FAILED | Existe `Payout.status=FAILED` (pago refundeado bajo payout programado) | 1) Abrir `/admin/payouts`. 2) Filtrar `FAILED`. 3) Click "Reintentar payout". | Debe existir `GET /api/admin/payouts` y `/admin/payouts/page.tsx` que listen por status (default `FAILED`+`PROCESSING`) con `bookingId/proId/amountClp/updatedAt`, endpoint POST de reintento por fila, índice `@@index([status])` y card rojo en dashboard. El pro NO debe quedar invisible/impago. | admin-tooling #1 (`payouts-processor.ts:91-94`, `admin/page.tsx:223`, `dashboard-stats/route.ts:61-63`, `schema.prisma:473-485`) |

## 3.2 Riesgo ALTO

| ID | Escenario | Precondiciones | Pasos | Resultado esperado | Gap que protege |
|---|---|---|---|---|---|
| E2E-ADM-02 | Admin busca bookings/payments atascados en estado no-terminal | Booking `PENDING_PAYMENT` >30min, Payment `PENDING` >30min, `AWAITING_CUSTOMER_CONFIRMATION` >48h | 1) Consultar dashboard-stats. 2) Abrir cola operativa `/admin/bookings?status=...`. | `dashboard-stats` debe exponer counts de bookings/payments atascados y una cola operativa con acción "reconciliar ahora" que llame `reconcilePendingPayments`. El operador debe poder responder "¿qué está atascado ahora?". | admin-tooling #2 (`admin/page.tsx:276-292`, `dashboard-stats/route.ts:37-72`, `payouts-processor.ts:274-356`) |
| E2E-ADM-03 | Admin revisa el trail de auditoría de un booking/payment/dispute | `AdminAuditLog` con refunds/disputes/payouts registrados | 1) `GET /api/admin/audit-log` filtrando por `targetId`. 2) Render `/admin/audit`. | Debe existir API paginada (filtro por `actorId/targetType/action/date`) y UI tabla enlazada desde dashboard y detalle de dispute/usuario. Hoy es write-only desde 11 call sites. | admin-tooling #3 (`audit-log.ts:26-41`, `schema.prisma:671-684`, `payments/refund/route.ts:111`, `admin/disputes/route.ts:320`) |
| E2E-ADM-04 | Admin ve pros con MP desconectado/expirado que tienen bookings activos | Pro con token MP null/expirado + bookings en estados activos | 1) Abrir dashboard. 2) Verificar card/cola que cruce MP-status con bookings activos. | Debe existir card+cola listando `professionalProfiles` con token MP null/expirado AND bookings en `ASSIGNED/ACCEPTED/CONFIRMED/IN_PROGRESS/AWAITING_CUSTOMER_CONFIRMATION`, con acción "reenviar invitación a reconectar MP". | admin-tooling #4 (`payouts-processor.ts:78-105`, `cron/refresh-mp-tokens/route.ts:1-43`, `admin/page.tsx:200-292`) |
| E2E-ADM-05 | Disputas vencidas no tienen señal agregada ni orden por urgencia | 20 disputes abiertas, 3 con `dueDateAt < now` en página 2 | 1) Abrir dashboard. 2) Listar disputes. 3) Ordenar por `dueDateAt`. | Card "Disputas vencidas" = count `status ∈ {OPEN,IN_REVIEW}` AND `dueDateAt < now`; route GET con `orderBy=dueDateAt asc` y toggle "Urgentes primero". | admin-tooling #6 (`admin/disputes/page.tsx:57-72`, `dashboard-stats/route.ts:58-60`, `admin/page.tsx:222`) |

## 3.3 Riesgo MEDIO

| ID | Escenario | Precondiciones | Pasos | Resultado esperado | Gap que protege |
|---|---|---|---|---|---|
| E2E-ADM-06 | Admin dispara payouts manualmente desde la UI tras caída del cron | Cron process-bookings pausado/fallando, payouts acumulados | 1) Click "Procesar payouts ahora" en dashboard. 2) Ver resumen `{scheduled, paidOut, failed}`. | Debe existir botón que haga POST a `/api/marketplace/payouts/process-timeouts` (endpoint ya sólido e idempotente) y muestre el resumen; botón análogo para reconcile-payments. No depender de curl. | admin-tooling #5 (`payouts/process-timeouts/route.ts:13-39`, `admin/page.tsx:1-501`) |
| E2E-ADM-07 | Doble-click / dos admins ejecutan refund simultáneo (doble reembolso) | Booking en estado refundable, dos requests concurrentes | 1) Disparar dos POST `/api/admin/payments/refund` en la misma ventana. | El route debe (1) rechazar si `payment.status ∈ {REFUNDED, PARTIAL_REFUNDED}`, (2) capar `amount` a `payment.amountClp`, (3) `SELECT ... FOR UPDATE`/updateMany guardado por status para serializar, (4) pasar `payment.id` como idempotency key a MP. No debe sobre-reembolsar. | admin-tooling #7 (`admin/payments/refund/route.ts:40-90`, `admin/disputes/route.ts:195-242`) |
| E2E-ADM-08 | Webhook tardío de refund deja Payment REFUNDED y Booking COMPLETED (desync silencioso) | Booking `COMPLETED`, llega webhook `refunded` (transición ilegal) | 1) Enviar webhook refunded post-completion. 2) Verificar estado. | Cuando la transición es ilegal, NO debe escribirse `paymentStatus=REFUNDED` silenciosamente dejando `status=COMPLETED`; debe levantar alerta de reconciliación / crear tarea admin (idealmente DISPUTE). Chequeo periódico de invariante `Payment.REFUNDED` con `Payout.PAID`. | payments-mercadopago #6 (`webhook/mercadopago/route.ts:158-204`, `payouts-processor.ts:88-90`) |

---

# 4. ACTOR: SYSTEM (cron / webhook / QStash)

## 4.1 Riesgo CRÍTICO

| ID | Escenario | Precondiciones | Pasos | Resultado esperado | Gap que protege |
|---|---|---|---|---|---|
| E2E-SYS-01 | Outage transitorio de MP NO debe cancelar bookings pagados sanos | 100 payments legítimamente `PENDING`, MP devuelve 503/429 para cada uno | 1) Ejecutar reconcile-payments durante outage simulado. 2) Verificar estados de bookings y slots. | El error de transporte (no-2xx) NO debe mapearse a `PAYMENT_FAILED`. Solo `cancelled/rejected` explícito de MP cancela. Ante `unreachable/unknown` dejar `PENDING` para el próximo ciclo e incrementar `failed`. NUNCA liberar slot por error de transporte. Umbral de abandono (~48h) antes de FAILED. | async-jobs-cron #1 (`providers/mercadopago.ts:466-486,87-103`, `payouts-processor.ts:254-356`) |
| E2E-SYS-02 | Webhook idempotente: tx falla → el evento NO debe quedar marcado como procesado | Webhook `payment approved`, la `$transaction` lanza (DB blip) | 1) Recibir webhook, `ProcessedWebhookEvent.create`. 2) Forzar fallo de tx. 3) MP reintenta el mismo webhook. | El insert de `ProcessedWebhookEvent` debe ir DENTRO de la misma `$transaction` que muta Payment/Booking, para que el rollback elimine el marcador y el reintento de MP reprocese. El Payment NO debe quedar `PENDING` para siempre. | payments-mercadopago #1 (`webhook/mercadopago/route.ts:116-130,165-204`) |
| E2E-SYS-03 | Payout cron no debe declarar RELEASED si MP aún retiene (money_release_date futuro) | Pago `approved`, `money_release_date` días en el futuro, 24h pasadas | 1) Ejecutar process-bookings. 2) Verificar `escrowStatus`/`Payout`/notificación. | `PAID`/`RELEASED` solo cuando `approved` AND `money_release_date <= now` (o `date_released`/released). Si no, `Payout=PROCESSING`, booking `PAYOUT_SCHEDULED`, sin `notifyPayoutReleased`. | async-jobs-cron #2, payments-mercadopago #2 (`payouts-processor.ts:78-149,38-66`) |

## 4.2 Riesgo ALTO

| ID | Escenario | Precondiciones | Pasos | Resultado esperado | Gap que protege |
|---|---|---|---|---|---|
| E2E-SYS-04 | Cron pesado con findMany ilimitado excede timeout y QStash reintenta el batch para siempre | Backlog de 500 bookings esperando payout | 1) Ejecutar process-bookings con backlog grande. 2) Medir progreso por invocación. | Ambas queries (process-bookings y booking-reminders) deben tener `take:` (~50) y `orderBy` oldest-first para drenar un slice acotado por corrida. El trabajo idempotente permite progreso parcial; el cron NO debe atascarse en timeouts infinitos. | async-jobs-cron #3 (`payouts-processor.ts:41-56`, `cron/booking-reminders/route.ts:40-67`) |
| E2E-SYS-05 | Cron muere silenciosamente (signing key rotada / schedule borrado) sin alerta | `QSTASH_CURRENT_SIGNING_KEY` rotada pero no redeployada → todos los crons 401 | 1) Simular 401 sostenido. 2) Verificar detección. | Debe existir tabla `CronHeartbeat` (`cronName`, `lastSuccessAt`, `lastResultJson`) upserteada al final de cada corrida sin importar counts, y un monitor que alerte (Sentry/email/Slack) cuando `lastSuccessAt` excede el intervalo esperado. Dead-letter de QStash debe golpear endpoint de alerta. Re-run manual para los 4 crons sin trigger. | async-jobs-cron #4 (`cron/process-bookings/route.ts:15-42`, `cron/reconcile-payments/route.ts:16-46`, `cron/refresh-mp-tokens/route.ts:16-43`, `cron/hard-delete-accounts/route.ts:16-42`, `cron/booking-reminders/route.ts:25-145`) |
| E2E-SYS-06 | Dispute con `dueDateAt` vencido nunca se auto-resuelve (payout congelado) | DisputeTicket `OPEN`, `dueDateAt < now`, admin inactivo | 1) Avanzar reloj más allá de `dueDateAt`. 2) Verificar acción automática. | Debe existir cron (p.ej. `/api/cron/process-disputes`) que encuentre `status ∈ {OPEN,IN_REVIEW}` AND `dueDateAt < now` y aplique resolución por defecto / escale a admin. Mínimo: alerta por SLA vencido. Reconciliar `escrowStatus` vs `money_release_date`. | marketplace-trust #3, booking-integrity #4 (`marketplace/disputes/route.ts:70-87`, `payouts-processor.ts:50-58`, `cron/process-bookings/route.ts`, `schema.prisma:518`) |

## 4.3 Riesgo MEDIO

| ID | Escenario | Precondiciones | Pasos | Resultado esperado | Gap que protege |
|---|---|---|---|---|---|
| E2E-SYS-07 | booking-reminders duplica/omite envíos por idempotencia basada en string de título | Título de reminder editado en `notifyBookingReminder` pero no en el cron | 1) Ejecutar cron cada 15 min dentro de la ventana de 30 min. 2) Contar notificaciones. | La dedup debe basarse en columna `dedupeKey @unique` determinística (`reminder:{bookingId}:{hoursUntil}`) con `createMany skipDuplicates`, no en igualdad de string + ventana de 6h. No debe spamear ni omitir reminders. | async-jobs-cron #5 (`cron/booking-reminders/route.ts:54-67`, `schema.prisma:529-542`) |
| E2E-SYS-08 | RELEASED/PAID en heurística "approved" sin confirmación real de MP | Pago `approved` estable post-24h pero MP aún en escrow | 1) Ejecutar process-bookings. 2) Verificar consistencia con MP. | No conflar "payment approved" con "fondos liberados al pro". Inspeccionar `money_release_date`/disbursement; mantener `PROCESSING` y re-poll hasta confirmar. Notificación debe reflejar "programado" vs "liberado". | booking-integrity #5 (`payouts-processor.ts:78-105,121-149`) |
| E2E-SYS-09 | application_fee solo sobre labor; extras pasan 100% al pro sin comisión | Booking con extras altos (materiales/urgencia/viaje) | 1) Crear booking con extras. 2) Verificar `platformFeeClp`, `application_fee` y payout. | Los números son auto-consistentes, pero debe decidirse y documentarse si `platformFeePct` aplica a `subtotal+extras` o solo `subtotal`, y persistir una fila de ledger dedicada (fee de plataforma, application_fee a MP, neto al pro) por payment como fuente única de verdad. | payments-mercadopago #8 (`marketplace-pricing.ts:23-53`, `checkout/route.ts:241-250,386-435`, `payouts-processor.ts:69`) |

## 4.4 Riesgo BAJO

| ID | Escenario | Precondiciones | Pasos | Resultado esperado | Gap que protege |
|---|---|---|---|---|---|
| E2E-SYS-10 | Slot huérfano (isAvailable=false) tras crash mid-checkout no se reconcilia | Crash entre creación de booking (slot reservado) y resultado de MP; Payment `created` sin `providerPaymentId` | 1) Simular timeout en `createMercadoPagoMarketplacePayment`. 2) Verificar slot tras reconcile. | Cron de limpieza de `PENDING_PAYMENT` stale (sin `providerPaymentId` o `providerStatus=created` >~15 min) debe transicionar a `PAYMENT_FAILED/CANCELLED` y liberar el slot (`isAvailable=true`). Reconcile debe re-consultar MP por `idempotencyKey/externalReference` aunque `providerPaymentId` sea null. | booking-integrity #7 (`checkout/route.ts:324-462`, `payouts-processor.ts:223-239,282`) |
| E2E-SYS-11 | Token MP expira justo en el momento del payout sin escalamiento tras N reintentos | Refresh diario falló/no corrió; múltiples bookings en `PROCESSING` | 1) Ejecutar varios ciclos. 2) Verificar escalamiento. | Umbral de max-retry/edad sobre payouts `PROCESSING` que escale a alerta admin + pro, e intento de refresh on-demand dentro del payout path antes de rendirse. | payments-mercadopago #10 (`account-cleanup-processor.ts:112-159`, `payouts-processor.ts:78-101`) |

---

# 5. CONCURRENCIA Y EDGE CASES TRANSVERSALES

## 5.1 Riesgo CRÍTICO / ALTO

| ID | Escenario | Precondiciones | Pasos | Resultado esperado | Gap que protege |
|---|---|---|---|---|---|
| E2E-CONC-01 | Doble booking del mismo slot por checkouts concurrentes | Dos clientes corren checkout sobre el mismo `slotId` | 1) Disparar dos POST checkout simultáneos. 2) Verificar que solo uno gana. | El `SELECT ... FOR UPDATE` en `checkout/route.ts:324-338` debe serializar; solo un booking se crea, el otro recibe 409. Sin doble cobro. (Verificación positiva del core, complementada por E2E-CUST-07 para ownership del hold.) | booking-integrity #8; provider-onboarding #5 (slots duplicados) |
| E2E-CONC-02 | Slots de disponibilidad duplicados por syncs concurrentes en búsqueda | Pro recién activado con `availabilityBlocks` pero sin slots materializados, dos búsquedas simultáneas | 1) Dos requests a search-professionals que disparan `syncTaskerAvailabilitySlotsFromOnboarding`. 2) Contar slots. | Debe existir `@@unique(professionalProfileId, startsAt, endsAt)` + `createMany skipDuplicates`, o lock/advisory-lock por `professionalProfileId`. NO deben crearse slots duplicados (que permitirían doble-booking de la misma hora). | provider-onboarding #5 (`tasker-publication.ts:392-479`, `search-professionals/route.ts:389-408`) |
| E2E-CONC-03 | Doble payout / fila duplicada de Payout bajo runs concurrentes | customer-confirm y cron 24h corren a la vez sobre el mismo booking | 1) Disparar customer-confirm exactamente cuando el cron procesa. 2) Verificar Payout y notificaciones. | `Payout.bookingId @unique` debe prevenir fila duplicada; envolver read+transition+payout en tx con row lock (`FOR UPDATE` o updateMany guardado por status, `count===0` ⇒ "ya manejado", no error). Sin doble notificación ni error espurio "No se pudo confirmar". | marketplace-trust #8, booking-integrity #10 (`customer-confirm/route.ts:48-99`, `payouts-processor.ts:68-180`) |
| E2E-CONC-04 | Duplicación de webhook MP (entrega at-least-once) | MP envía el mismo `eventId` dos veces | 1) Enviar webhook duplicado. 2) Verificar `ProcessedWebhookEvent` y mutación única. | El dedupe por `ProcessedWebhookEvent` (idealmente dentro de la tx, ver E2E-SYS-02) debe procesar el evento exactamente una vez. El segundo retorna 200 sin re-mutar. | payments-mercadopago #1 (`webhook/mercadopago/route.ts:116-130`) |
| E2E-CONC-05 | Dispute spam / reapertura repetida para re-congelar payout | Sin unique constraint en `DisputeTicket.bookingId`; admin cierra dispute | 1) Cliente abre nueva dispute tras cada cierre. 2) Verificar payout. | Índice único parcial: solo una dispute no-terminal por booking (`bookingId` where `status ∈ {OPEN,IN_REVIEW}`). POST debe rechazar si ya existe una sin resolver. Bloquear reapertura tras RESOLVED con refund o tras `Payout=PAID`. No debe poder hacerse DoS al payout. | marketplace-trust #4 (`schema.prisma:505-527`, `marketplace/disputes/route.ts:46-87`, `customer-confirm/route.ts:39-45`) |
| E2E-CONC-06 | Bypass total del state machine vía ruta legacy sin auth | Ruta legacy `PATCH /api/bookings/[bookingId]/status` accesible | 1) PATCH `{status:'COMPLETED'}` sobre un booking `PENDING_PAYMENT` impago sin auth. 2) Reasignar `proId`. | La ruta debe eliminarse o gatear tras `requireAdminRequest` + `assertTransition`. NO debe permitir mutar `status`/`proId` sin auth ni state machine. Forzar COMPLETED en impago, borrar disputes o redirigir payouts debe fallar. | booking-integrity #2 (`bookings/[bookingId]/status/route.ts:7-51`) |
| E2E-CONC-07 | Chat: intercambio de contacto abierto durante toda la ventana del servicio | Booking `CONFIRMED` (pago aprobado, antes del servicio) | 1) Pro envía número de teléfono en chat (`messages/route.ts:75-77`). 2) Verificar bloqueo/masking. | `canShareContactDetails` debe restringirse a estados realmente post-completion, NO `CONFIRMED`. Idealmente enmascarar contacto detectado en vez de permitirlo; endurecer detección (normalización dígito-palabra, separadores, más keywords) y loggear intentos. | marketplace-trust #5 (`chat-safety.ts:22-48`, `messages/route.ts:75-77`) |

## 5.2 Riesgo MEDIO / BAJO

| ID | Escenario | Precondiciones | Pasos | Resultado esperado | Gap que protege |
|---|---|---|---|---|---|
| E2E-CONC-08 | Reviews concurrentes producen ratingAvg/ratingsCount stale | Dos clientes del mismo pro reseñan en el mismo instante | 1) Disparar dos POST reviews simultáneos. 2) Verificar `ratingAvg`/`ratingsCount`. | Recompute bajo isolation `Serializable` con retry + lock de `ProfessionalProfile` (`FOR UPDATE`), o update incremental atómico (`ratingsCount {increment:1}`, suma corriente). El conteo NO debe quedar off-by-one. | marketplace-trust #7 (`reviews/route.ts:46-75`, `schema.prisma:248-260`) |
| E2E-CONC-09 | check-in / on-the-way mutan estado sin assertTransition central | Booking en estado válido según arrays hardcoded | 1) Ejecutar check-in/on-the-way. 2) Verificar consistencia con state machine. | Reemplazar los arrays `VALID_STATUSES` por `assertTransition/canTransition` contra el state machine central (manteniendo guard `paymentStatus=PAID`), evitando drift al evolucionar estados. | booking-integrity #9 (`check-in/route.ts:71-110`, `on-the-way/route.ts:40-55`) |
| E2E-CONC-10 | refundMercadoPagoPayment trata cualquier 2xx como éxito completo | MP responde 2xx con refund `in_process` o shape de partial no validado | 1) Mock refund `in_process`. 2) Verificar persistencia. | Parsear `payload.status` y solo retornar `refunded` con `approved`; validar `payload.amount == refundAmount` antes de persistir `PARTIAL_REFUNDED` vs `REFUNDED`. Job de reconcile re-consulta status del refund. | payments-mercadopago #7 (`providers/mercadopago.ts:488-526`) |

---

# 6. VERIFICACIONES POSITIVAS (NO ROMPER — regression guards)

Estos casos confirman comportamiento ya production-ready según la auditoría. El objetivo es que un futuro cambio NO los rompa.

| ID | Escenario | Resultado esperado | Referencia |
|---|---|---|---|
| E2E-REG-01 | Gate de payout MP en search, availability y checkout | Un pro sin MP conectado (`mpAccountStatus≠ACTIVE` o sin `mpAccessToken/mpUserId`) NO aparece en search, NO expone availability, y checkout retorna 409 `tasker_mp_not_connected` antes de crear Booking/Payment. Nunca se captura dinero sin camino de payout. | provider-onboarding #6 — production-ready (`search-professionals/route.ts:185-191`, `availability/route.ts:30-37`, `checkout/route.ts:271-287`) |
| E2E-REG-02 | Verificación de firma QStash + aislamiento per-item + idempotencia | Firma HS256 + body-hash + exp/nbf timing-safe con rotación de keys; firma inválida ⇒ 401 y rechazo de correr sin verificar en prod. Un item que lanza no aborta el batch. `Payout.bookingId @unique` + patrón create-or-reuse hace la creación de payout idempotente bajo retries. `releaseExpiredHolds` con updateMany guardado es idempotente. | async-jobs-cron #8 — production-ready (`qstash.ts:31-121`, `payouts-processor.ts:176-180`, `account-cleanup-processor.ts:54-99`, `schema.prisma:473-485`) |

---

# 7. RESUMEN DE GAPS POR CASO (trazabilidad inversa)

| Gap (hallazgo de auditoría) | Severidad | Casos E2E que lo cubren |
|---|---|---|
| PAYOUT_SCHEDULED nunca procesado | CRÍTICO | E2E-CUST-01, E2E-PRO-01 |
| Ruta legacy status sin auth/state machine | CRÍTICO | E2E-CONC-06 |
| No existe endpoint de cancelación | ALTO | E2E-CUST-05 |
| Dispute dueDateAt nunca enforced | ALTO | E2E-SYS-06 |
| Escrow RELEASED por heurística (no MP) | ALTO | E2E-PRO-02, E2E-SYS-03, E2E-SYS-08 |
| Bookings públicos huérfanos | MEDIO | E2E-CUST-10 |
| Slot huérfano tras crash mid-checkout | MEDIO | E2E-SYS-10 |
| Hold no validado por ownership en checkout | BAJO | E2E-CUST-07 |
| check-in/on-the-way sin assertTransition | BAJO | E2E-CONC-09 |
| payout/request descoordinado con cron | BAJO | E2E-PRO-11 |
| Webhook marca processed antes de mutar | CRÍTICO | E2E-SYS-02, E2E-CONC-04 |
| Payout PAID sin money_release_date | CRÍTICO/ALTO | E2E-PRO-02, E2E-SYS-03 |
| Refund post-COMPLETED imposible / doble pago | CRÍTICO | E2E-CUST-03, E2E-CUST-04 |
| Payout sin verificar token MP ACTIVE | ALTO | E2E-PRO-03 |
| Partial refund no ajusta payout | ALTO | E2E-PRO-08 |
| Webhook refund tardío deja desync | MEDIO | E2E-ADM-08 |
| refund MP cualquier 2xx = éxito | MEDIO | E2E-CUST-09, E2E-CONC-10 |
| application_fee solo sobre labor | MEDIO | E2E-SYS-09 |
| Token expira mid-lifecycle sin escalamiento | BAJO | E2E-SYS-11 |
| Pro APROBADO visible antes de activar | ALTO | E2E-PRO-06 |
| approve no valida publicación | MEDIO | E2E-PRO-07 |
| Documentos base64 en DB sin R2 | MEDIO | E2E-PRO-09 |
| Rutas muertas phone/send rompen submit | BAJO | E2E-PRO-10 |
| Slots duplicados por sync concurrente | BAJO | E2E-CONC-02 |
| Gate MP en search/availability/checkout | (positivo) | E2E-REG-01 |
| Payouts FAILED invisibles sin retry | CRÍTICO | E2E-ADM-01 |
| Sin cola de bookings/payments atascados | ALTO | E2E-ADM-02 |
| AdminAuditLog write-only | ALTO | E2E-ADM-03, E2E-CUST-06 |
| Sin vista de pros con MP desconectado + bookings activos | ALTO | E2E-ADM-04 |
| Trigger manual de payout sin botón | MEDIO | E2E-ADM-06 |
| Disputas vencidas sin señal agregada | MEDIO | E2E-ADM-05 |
| Refund route sin guard de status/idempotencia | MEDIO | E2E-ADM-07 |
| Payout PROCESSING en limbo sin escalamiento | MEDIO | E2E-PRO-04 |
| Outage MP cancela bookings sanos | CRÍTICO | E2E-SYS-01 |
| Payout PAID/RELEASED ignorando money_release_date | CRÍTICO | E2E-SYS-03 |
| findMany ilimitado / timeout / retry infinito | ALTO | E2E-SYS-04 |
| Sin heartbeat/dead-letter/alerting de cron | ALTO | E2E-SYS-05 |
| booking-reminders idempotencia por string | MEDIO | E2E-SYS-07 |
| refresh-mp-tokens DISABLE en error transitorio | MEDIO | E2E-PRO-05 |
| Notificación payout fire-and-forget | BAJO | E2E-PRO-12 |
| QStash auth + aislamiento + idempotencia | (positivo) | E2E-REG-02 |
| Auto-confirm por silencio del cliente | CRÍTICO | E2E-CUST-02 |
| Dispute tras payout liberado sin clawback | CRÍTICO | E2E-CUST-03 |
| Disputas no auto-expiran | ALTO | E2E-SYS-06 |
| Sin unique constraint en DisputeTicket | ALTO | E2E-CONC-05 |
| Chat anti-disintermediation abierto en CONFIRMED | ALTO | E2E-CONC-07 |
| Cliente no puede reseñar en PAYOUT_SCHEDULED | MEDIO | E2E-CUST-08 |
| Rating aggregation no isolation-safe | MEDIO | E2E-CONC-08 |
| Race customer-confirm vs cron | BAJO | E2E-CONC-03 |
| Header-auth fallback permite spoofing | BAJO | E2E-CUST-11 |

---

_Fin de la matriz. Total: 7 secciones, 47 casos E2E (incluye 2 verificaciones positivas de regresión)._
