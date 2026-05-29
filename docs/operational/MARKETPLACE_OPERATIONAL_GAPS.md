# WeTask — Marketplace Operational Gaps

Documento de fiabilidad operacional del marketplace. Cada brecha (gap) incluye: escenario de fallo real, consecuencia operacional (dinero / booking / confianza) y recomendación de fix a nivel de código con rutas de archivo. Las brechas estan numeradas (G1, G2, ...) y ordenadas por severidad: CRITICAL primero, luego HIGH, MEDIUM y LOW.

Dominios auditados: `booking-integrity`, `payments-mercadopago`, `provider-onboarding`, `admin-tooling`, `async-jobs-cron`, `marketplace-trust`.

Fecha del documento: 2026-05-29.

---

## CRITICAL

### G1 — Payouts de bookings `PAYOUT_SCHEDULED` nunca se procesan: el pago al pro confirmado por el cliente queda atascado para siempre
- Dominio: booking-integrity
- Archivos:
  - `src/app/api/marketplace/bookings/[bookingId]/customer-confirm/route.ts:49-99`
  - `src/lib/payouts-processor.ts:38-215`
  - `src/app/api/cron/process-bookings/route.ts:15-42`
- Comportamiento actual: cuando el cliente confirma vía `customer-confirm`, el booking transiciona `AWAITING_CUSTOMER_CONFIRMATION -> PAYOUT_SCHEDULED` y se crea un `Payout` con status `PENDING` dentro de una transacción (`customer-confirm/route.ts:62-99`). El unico procesador de payouts, `processBookingsForPayout` (`payouts-processor.ts:41-46`), consulta estrictamente `where: { status: AWAITING_CUSTOMER_CONFIRMATION, paymentStatus: PAID, updatedAt <= cutoff }`. `PAYOUT_SCHEDULED` se escribe en dos lugares pero nunca es SELECTeado por ninguna query del codebase.
- Escenario de fallo real: el cliente termina un trabajo limpio y pulsa "Confirmar servicio". El booking pasa a `PAYOUT_SCHEDULED` y se crea `Payout(status=PENDING)`. El cron horario `process-bookings` corre pero su cláusula WHERE excluye `PAYOUT_SCHEDULED`, asi que omite el booking para siempre. El pro nunca cobra y el dinero queda en el escrow de MercadoPago hasta que `release_date` lo fuerce (o nunca, según la config de MP).
- Consecuencia operacional (dinero/booking/confianza): todo cliente bien comportado que confirma rápido deja a su pro sin pagar — lo opuesto al incentivo deseado. Churn masivo de pros, tickets de soporte y responsabilidad de la plataforma por fondos retenidos. Es el bug de booking-integrity mas dañino.
- Fix recomendado: hacer que `processBookingsForPayout` consulte ambos estados: `status: { in: [AWAITING_CUSTOMER_CONFIRMATION, PAYOUT_SCHEDULED] }` (y relajar/eliminar el `updatedAt <= cutoff` de 24h para filas ya confirmadas en `PAYOUT_SCHEDULED`, dado que el cliente ya consintió). Alternativamente, que `customer-confirm` encole un job de payout inmediato vía QStash. Asegurar que la ruta `canTransition(PAYOUT_SCHEDULED -> COMPLETED, SYSTEM)` (legal según el state machine, línea 52) efectivamente se ejecute para estas filas.

---

### G2 — Ruta legacy `/api/bookings/[bookingId]/status` muta el estado SIN auth y SIN state machine
- Dominio: booking-integrity
- Archivos:
  - `src/app/api/bookings/[bookingId]/status/route.ts:7-51`
- Comportamiento actual: el handler PATCH no importa `getRequestIdentity`/`hasRole` y no realiza ninguna autenticación ni autorización. Parsea `input.status` y llama `prisma.booking.update({ data: { status: input.status, proId: ... } })` directamente. No hay `assertTransition`/`canTransition`, asi que acepta cualquier status del schema desde cualquier caller.
- Escenario de fallo real: cualquiera que alcance el endpoint hace PATCH `{status:'COMPLETED'}` o `{status:'CONFIRMED'}` sobre un `bookingId` arbitrario, o reasigna `proId`. Por ejemplo, forzar un `PENDING_PAYMENT` (impago) directo a `COMPLETED`, o revertir un booking en `DISPUTE` a `CONFIRMED` para desbloquear un payout, o fijar un pro arbitrario como destinatario del pago.
- Consecuencia operacional (dinero/booking/confianza): bypass total del gating de pago y de los holds de disputa: trabajos impagos marcados como completos, disputas borradas, payouts redirigidos. Pérdida financiera directa y pérdida total de integridad de estado. Las demás rutas cuidadosamente protegidas son irrelevantes mientras esta exista.
- Fix recomendado: eliminar esta ruta legacy por completo (la ruta `marketplace/bookings/[bookingId]/status` ya cubre cambios de estado PRO/ADMIN con `assertTransition`), o bien protegerla con `requireAdminRequest` Y envolver el update con `assertTransition(booking.status, input.status, 'ADMIN')`. No dejar un mutador de estado sin autenticación en producción.

---

### G3 — El webhook registra `ProcessedWebhookEvent` ANTES de mutar la DB: una transacción fallida pierde el evento permanentemente y congela el pago
- Dominio: payments-mercadopago
- Archivos:
  - `src/app/api/payments/webhook/mercadopago/route.ts:116-130`
  - `src/app/api/payments/webhook/mercadopago/route.ts:165-204`
- Comportamiento actual: la ruta hace `prisma.processedWebhookEvent.create({ eventId })` en la línea 117, devolviendo 200 'duplicate' ante un P2002. Solo DESPUÉS llama `getProviderPayment` y corre el `prisma.$transaction` (líneas 165-204) que actualiza `Payment` y `Booking`. Si esa transacción lanza (caída de DB, deadlock, fallo de serialización, edge de transición), el catch en 226 devuelve 500 — pero la fila `ProcessedWebhookEvent` ya está commiteada y NO se revierte.
- Escenario de fallo real: MP envía el webhook 'payment approved'. Se escribe la fila del evento, luego el `$transaction` falla (p.ej. caída de conexión Postgres). WeTask devuelve 500. MP reintenta el mismo webhook; `verifyMercadoPagoSignature` pasa, el create del evento choca con P2002 y el handler devuelve 200 `{duplicate:true}` (línea 127) SIN actualizar nunca `Payment`/`Booking`. El `Payment` queda `PENDING` y el `Booking` `PENDING_PAYMENT` para siempre aunque el cliente fue cobrado.
- Consecuencia operacional (dinero/booking/confianza): bookings pagados atascados en `PENDING_PAYMENT`: cliente cobrado, tasker nunca ve un trabajo confirmado, payout nunca agendado. Pérdida silenciosa de ingresos/booking que requiere cirugía manual en DB. `reconcilePendingPayments` rescata parcialmente esto (re-consulta payments PENDING >10min) pero solo si `providerPaymentId` ya estaba almacenado — en el primer webhook de aprobación `providerPaymentId` puede seguir null, por lo que la reconciliación puede no detectarlo.
- Fix recomendado: mover el insert de `ProcessedWebhookEvent` DENTRO del mismo `prisma.$transaction` que muta `Payment`/`Booking` (`tx.processedWebhookEvent.create` al inicio de la tx). Asi el dedupe por unique-constraint y el side effect commitean o revierten atómicamente. Mantener el corto-circuito P2002 -> 200, pero chequear el evento existente dentro de la tx para que una mutación fallida también revierta el marcador y permita reprocesar el reintento de MP.

---

### G4 — Reembolso tras `COMPLETED` es imposible: la ruta de disputas reembolsa en MP primero, luego falla la transición ilegal `COMPLETED->REFUNDED`, reembolsando al cliente mientras el tasker ya recibió el escrow
- Dominio: payments-mercadopago
- Archivos:
  - `src/app/api/marketplace/admin/disputes/route.ts:208-242`
  - `src/app/api/marketplace/admin/disputes/route.ts:271-279`
  - `src/lib/booking-state-machine.ts:56-72`
- Comportamiento actual: el PATCH de disputas valida `canTransition(status, REFUNDED, 'ADMIN')` (línea 208) y devuelve 409 si es ilegal. Pero el state machine solo permite `REFUNDED` desde `CONFIRMED/ACCEPTED/IN_PROGRESS/AWAITING_CUSTOMER_CONFIRMATION/PAYOUT_SCHEDULED/DISPUTE` — NO existe arista `COMPLETED->REFUNDED` (líneas 56-72). `COMPLETED` solo puede ir a `DISPUTE` (línea 72). Cuando se intenta reembolsar una `DISPUTE` que vino de `COMPLETED`, la llamada de refund de MP (línea 224) ocurre ANTES de la tx; el `assertTransition` interno (línea 272) puede pasar solo porque `DISPUTE->REFUNDED` es legal — pero el dinero del escrow ya fue `RELEASED` al tasker al completar, asi que MP reembolsa al cliente desde fondos de la plataforma mientras el tasker conserva el payout liberado.
- Escenario de fallo real: el cron auto-completa un booking a las 24h y libera el escrow al tasker. Dos dias después el cliente abre una disputa (`COMPLETED->DISPUTE` permitido), el admin resuelve con reembolso total. `refundProviderPayment` pega a MP y tiene éxito; el cliente recupera su dinero. Pero el tasker ya recibió el escrow. WeTask asume la pérdida sin débito contra el tasker.
- Consecuencia operacional (dinero/booking/confianza): pérdida financiera directa e irrecuperable igual al monto reembolsado en cualquier disputa post-completion. Escala con el volumen de auto-completion.
- Fix recomendado: dos partes. (1) No marcar `Booking COMPLETED` / escrow `RELEASED` hasta que la ventana de chargeback+refund de MP esté genuinamente cerrada (atar a `money_release_date` + un buffer). (2) Antes de reembolsar en la ruta de disputas, chequear `Payout.status===PAID`/`escrowStatus==='RELEASED'`; si está liberado, bloquear el reembolso automático y requerir un flujo explícito de clawback/saldo-negativo del tasker, o reembolsar solo la porción de fee de plataforma. Persistir una entrada de ledger que capture el netting payout-vs-refund.

---

### G5 — Payouts fallidos (`Payout.status=FAILED`) son completamente invisibles: se escriben pero nunca se leen, sin reintento
- Dominio: admin-tooling
- Archivos:
  - `src/lib/payouts-processor.ts:91-94`
  - `src/app/admin/page.tsx:223`
  - `src/app/api/admin/dashboard-stats/route.ts:61-63`
  - `prisma/schema.prisma:473-485`
- Comportamiento actual: `processBookingsForPayout` fija `payoutStatus = PayoutStatus.FAILED` cuando MP reporta que el pago subyacente ya fue reembolsado (`payouts-processor.ts:91-94`). Esa fila FAILED se persiste, pero el único lugar donde `PayoutStatus.FAILED` aparece fuera del processor es esta escritura. Tanto el dashboard (`admin/page.tsx:223`) como la API `dashboard-stats` (`dashboard-stats/route.ts:62`) cuentan payouts SOLO con status IN (`PENDING`, `PROCESSING`). No hay página `admin/payouts` ni API que liste payouts por status.
- Escenario de fallo real: un booking se completa, el payout se agenda, luego una disputa/reembolso voltea el pago a refunded; el siguiente cron marca ese `Payout` FAILED. O MP devuelve un status no-approved/no-refunded y queda `PROCESSING` para siempre. El tasker nunca cobra. Ningún operador lo ve porque el único KPI de payouts cuenta `PENDING+PROCESSING` (y un FAILED ni siquiera está en ese set).
- Consecuencia operacional (dinero/booking/confianza): taskers que nunca cobran por trabajo completado — daño financiero directo y colapso total de confianza con el lado de la oferta. El descubrimiento solo ocurre cuando el tasker reclama, y aun asi el operador no tiene pantalla para encontrar la fila.
- Fix recomendado: agregar `@@index([status])` a `Payout` en `prisma/schema.prisma`. Construir `/app/admin/payouts/page.tsx` + una ruta GET `/api/admin/payouts` filtrando por status (default `FAILED` + `PROCESSING`) mostrando `bookingId`, `proId`, `amountClp`, `updatedAt`. Agregar un endpoint POST 'Reintentar payout' por fila que re-corra la rama de booking individual de `processBookingsForPayout`. Agregar el conteo de payouts FAILED a `dashboard-stats` y una tarjeta roja en el dashboard que enlace a la cola.

---

### G6 — Una caída transitoria de MercadoPago cancela en masa bookings pagados sanos (reconcile-payments trata cualquier error HTTP como pago FAILED)
- Dominio: async-jobs-cron
- Archivos:
  - `src/lib/payments/providers/mercadopago.ts:466-486`
  - `src/lib/payments/providers/mercadopago.ts:87-103`
  - `src/lib/payouts-processor.ts:254-356`
- Comportamiento actual: `getMercadoPagoPayment()` devuelve `status:"failed"` cuando `response.ok` es false (`mercadopago.ts:468-484`) — es decir para CUALQUIER no-2xx incluyendo 429 rate-limit, 500/502/503 de MP, o un fallo de parse JSON. `mapStatus()` también devuelve `"failed"` para cualquier status desconocido (`mercadopago.ts:101` default). `reconcilePendingPayments` (`payouts-processor.ts:300-339`) alimenta eso a `PROVIDER_STATUS_TO_PAYMENT["failed"] = PaymentStatus.FAILED` y `PROVIDER_STATUS_TO_BOOKING["failed"] = BookingStatus.PAYMENT_FAILED`, commitea la transición y (líneas 327-332) voltea el `AvailabilitySlot` reservado a `isAvailable=true`. El cron corre cada ~hora sobre hasta 100 payments PENDING.
- Escenario de fallo real: MP tiene una caída parcial de 20 minutos (devuelve 503 / rate-limita el token del cron). El cron horario de reconcile toma 100 payments legítimamente PENDING (el webhook simplemente no había llegado), recibe 503 por cada uno, los mapea todos a `status:"failed"`, y commitea `Payment->FAILED`, `Booking->PAYMENT_FAILED`, y libera cada slot. Los clientes que sí pagaron son notificados de que el pago falló; sus slots se revenden a otros clientes (doble-booking del tasker).
- Consecuencia operacional (dinero/booking/confianza): pérdida directa de ingresos y doble-bookings ante un blip de un tercero; dinero del cliente capturado en MP pero booking mostrado como fallido; daño de confianza y carga de reembolsos/disputas. Incidente auto-infligido amplificado por el cron horario + los reintentos de QStash.
- Fix recomendado: distinguir fallo de transporte de fallo de negocio. En `mercadopago.ts`, cuando `!response.ok` lanzar un `TransientProviderError` (o devolver `status:"unreachable"`) en vez de `status:"failed"`. En `reconcilePendingPayments`, transicionar un Booking a `PAYMENT_FAILED` solo ante `cancelled`/`rejected` explícitos de MP; ante `unreachable`/`unknown` dejar el `Payment` PENDING para el siguiente ciclo e incrementar `result.failed` para observabilidad. Nunca liberar un slot por un error de transporte. Agregar un umbral de antigüedad (p.ej. marcar FAILED solo tras 48h de PENDING) para limpiar payments genuinamente abandonados sin destruir los sanos durante una caída.

---

### G7 — El cron de payout marca `Payout PAID` y escrow `RELEASED` mientras el dinero sigue en escrow de MercadoPago (`money_release_date` ignorado)
- Dominio: async-jobs-cron (corroborado por payments-mercadopago y booking-integrity)
- Archivos:
  - `src/lib/payouts-processor.ts:78-149`
  - `src/lib/payouts-processor.ts:38-66`
  - `src/lib/payouts-processor.ts:68-105` y `121-148`
- Comportamiento actual: `processBookingsForPayout` re-consulta el pago de MP y en las líneas 88-90 hace: si `providerResult.status === "approved"` -> `payoutStatus = PAID`, `escrowStatus = "RELEASED"`. El comentario (líneas 84-87) admite que es una heurística: asume que como el hold local de 24h (`HOLD_HOURS`) pasó y MP dice 'approved', el marketplace ya liberó fondos al collector. Luego escribe `Payout.status=PAID`, `Payout.paidAt=now`, `Payment.escrowStatus=RELEASED`, `escrowReleasedAt=now`, `Booking->COMPLETED`, y notifica a ambas partes que el payout fue liberado — todo sin leer `money_release_date`.
- Escenario de fallo real: un booking se paga, pasa el hold local de 24h, MP aun muestra el pago 'approved' con `money_release_date` 4 dias en el futuro. El cron marca `Payout PAID` y emaila al tasker "tu pago quedó liberado" (`notifyPayoutReleased`) y le dice al cliente "el pago del profesional quedó liberado". El tasker revisa su MercadoPago y no ve nada por dias, o el cliente disputa/hace chargeback durante la ventana de release aun abierta y los libros de la plataforma dicen PAID/COMPLETED.
- Consecuencia operacional (dinero/booking/confianza): los libros divergen de la realidad de MP: WeTask reporta payouts como completados mientras los fondos siguen en escrow. Taskers pierden confianza ("la app dice pagado, mi MP está vacío"); reconciliación/contabilidad incorrecta; chargebacks durante la ventana no liberada impactan un booking ya cerrado como COMPLETED. Ademas, como `COMPLETED` es terminal para reembolsos (ver G4), completar prematuramente cierra la vía de reembolso antes de que termine la ventana de chargeback de MP.
- Fix recomendado: exponer `money_release_date` / `date_released` / monto liberado en `getMercadoPagoMarketplacePayment`, y en `processBookingsForPayout` fijar `escrowStatus=RELEASED`/`Payout=PAID` solo cuando `status==="approved"` Y `money_release_date <= now` (o cuando MP reporta el release en el campo `released`). De lo contrario mantener escrow `HELD` y Payout en `PROCESSING`/`PAYOUT_SCHEDULED` hasta que un run posterior confirme el release. Usar el timestamp real de release para `escrowReleasedAt`. No enviar `notifyPayoutReleased` hasta confirmar el release real.

---

### G8 — El auto-confirm de 24h libera el payout ante el silencio del cliente; no hay fallback neutral para clientes que desaparecen
- Dominio: marketplace-trust
- Archivos:
  - `src/lib/payouts-processor.ts:38-215`
  - `src/app/api/marketplace/bookings/[bookingId]/complete/route.ts:42-45`
  - `src/lib/booking-state-machine.ts:49-52`
- Comportamiento actual: cuando el pro marca el trabajo hecho (ruta complete -> `AWAITING_CUSTOMER_CONFIRMATION`) y pasan 24h (`HOLD_HOURS=24`) con `paymentStatus PAID` y sin disputa `OPEN`/`IN_REVIEW`, `processBookingsForPayout()` transiciona el booking a `PAYOUT_SCHEDULED` (o `COMPLETED` si MP reporta approved) y marca el `Payout PAID` / escrow `RELEASED`. La inacción del cliente se interpreta como aprobación.
- Escenario de fallo real: el pro reserva un no-show o hace un mal trabajo, presiona "finalizar", el cliente está de vacaciones / no lee la notificación. 24h después el cron libera el payout completo al pro. El cliente vuelve y el dinero ya está con el pro en MercadoPago.
- Consecuencia operacional (dinero/booking/confianza): pérdida financiera directa / chargebacks: cada cliente que desaparece auto-financia al pro incluso por servicios no entregados. Entrena a malos pros a apurar "finalizar" y apostar a la inatención del cliente. Maximiza disputas de reembolso que ahora deben clawback de fondos ya liberados.
- Fix recomendado: alargar la ventana de silent-confirm (p.ej. 72h) Y hacer el auto-release condicional a una señal positiva de completion (`checkInAt`/`checkOutAt` ya existen). Antes de auto-liberar, requerir `booking.checkOutAt != null`; de lo contrario enrutar a una cola de revisión manual en vez de `PAYOUT_SCHEDULED`. Enviar recordatorios escalados en T+6h/T+18h y solo auto-confirmar si al menos uno fue entregado (rastrear en `Notification`).

---

### G9 — Se puede abrir una disputa DESPUÉS de que el payout ya fue liberado (`COMPLETED -> DISPUTE`) sin vía de clawback
- Dominio: marketplace-trust
- Archivos:
  - `src/lib/booking-state-machine.ts:72`
  - `src/app/api/marketplace/disputes/route.ts:58-87`
  - `src/app/api/marketplace/admin/disputes/route.ts:190-242`
- Comportamiento actual: `BOOKING_TRANSITIONS` permite `COMPLETED -> DISPUTE` por CUSTOMER/PRO/ADMIN. La ruta POST de disputas solo llama `assertTransition(status, DISPUTE)` y crea el ticket; no chequea si el `Payout` ya está `PAID` o el escrow ya `RELEASED`. La resolución del admin emite un reembolso de MercadoPago vía `refundProviderPayment` contra el pago original.
- Escenario de fallo real: el cliente auto-confirma a las 24h, payout `PAID` al pro. Dos dias después abre una disputa (`COMPLETED -> DISPUTE` legal). El admin resuelve RESOLVED con `refundAmountClp>0`; `refundProviderPayment` se llama sobre un pago cuyo escrow ya se liberó al collector. MP rechaza (502) o, peor, la plataforma asume el reembolso mientras el pro conserva el bruto.
- Consecuencia operacional (dinero/booking/confianza): la plataforma absorbe el reembolso como pérdida o el cliente queda sin remedio; doble pago (pro pagado + cliente reembolsado desde fondos de plataforma). Erosiona confianza en ambos lados.
- Fix recomendado: en el POST de disputas, bloquear la apertura cuando un `Payout` del booking ya está `PAID` (o `escrowStatus RELEASED`) y en su lugar enrutar a un flujo de 'reclamo post-payout' manual. En el resolve del admin, cuando el escrow ya está liberado, requerir un paso de clawback del pro (crear un Payout negativo / débito) antes de emitir el reembolso al cliente, o prohibir el auto-refund y forzar reconciliación manual. Agregar guards de estado de escrow/payout junto al `canTransition(REFUNDED)` existente.

---

## HIGH

### G10 — No existe endpoint de cancelación: los bookings no pueden cancelarse, reembolsarse, ni liberar su slot
- Dominio: booking-integrity
- Archivos:
  - `src/lib/booking-state-machine.ts:30-59`
  - `src/app/api/marketplace/bookings/[bookingId]/status/route.ts:13-19`
- Comportamiento actual: el state machine define muchas transiciones `CANCELLED` permitiendo a CUSTOMER y PRO cancelar (p.ej. `CONFIRMED/ACCEPTED -> CANCELLED`). Pero un grep de 'cancel'/'CANCELLED' en todas las rutas API solo encuentra `me/account` (chequeo de borrado de cuenta) y `pro/slots/[slotId]` (guard de borrado de slot). La ruta de status del marketplace restringe roles a ADMIN y PRO (línea 17), asi que un CUSTOMER ni siquiera puede alcanzarla, y no hay ruta dedicada de cancel que ademas reembolse + libere el slot.
- Escenario de fallo real: un cliente necesita cancelar un booking pagado (riesgo de no-show del pro, conflicto de agenda). No hay API para hacerlo; el slot queda `isAvailable=false` (reservado) para siempre y el pago queda `PAID` con dinero en escrow. Soporte debe editar la DB a mano y reembolsar manualmente.
- Consecuencia operacional (dinero/booking/confianza): cada cancelación se vuelve una operación manual de soporte+finanzas. Los slots quedan permanentemente consumidos por bookings muertos, reduciendo disponibilidad del pro. Los clientes se sienten atrapados; suben los chargebacks porque el reembolso self-serve es imposible.
- Fix recomendado: agregar `POST /api/marketplace/bookings/[bookingId]/cancel`: autenticar CUSTOMER (dueño) o PRO (asignado) o ADMIN, `assertTransition(status -> CANCELLED, actor)`, y en una transacción: fijar `status=CANCELLED`, si `paymentStatus=PAID` llamar `refundProviderPayment` + fijar `paymentStatus=REFUNDED`, y `updateMany` del `bookedSlot` a `isAvailable=true`, `heldExpiresAt/heldByUserId=null`. Agregar política de ventana/fee de cancelación.

---

### G11 — `dueDateAt` de disputas se fija pero nunca se hace cumplir: las disputas congelan payouts indefinidamente
- Dominio: booking-integrity (corroborado por marketplace-trust)
- Archivos:
  - `src/app/api/marketplace/disputes/route.ts:70-87`
  - `src/lib/payouts-processor.ts:50-58`
  - `src/app/api/cron/process-bookings/route.ts`
  - `prisma/schema.prisma:518`
- Comportamiento actual: crear una disputa fija `dueDateAt = now + 5 dias` y mueve el booking a `DISPUTE`. `processBookingsForPayout` excluye cualquier booking con disputa `OPEN`/`IN_REVIEW` (`payouts-processor.ts:50-58`) y `customer-confirm`/`payout-request` también bloquean mientras hay disputa abierta. Un grep muestra que `dueDateAt` se escribe en `disputes/route.ts` pero nunca lo lee ningún cron, job o query. No hay escalación de SLA ni auto-resolución.
- Escenario de fallo real: el cliente abre una disputa frívola (o el pro abre una) y el admin está de vacaciones. El `dueDateAt` de 5 dias pasa sin efecto. El booking queda atascado en `DISPUTE`, el `Payout` bloqueado, el escrow `HELD`, y ninguna parte recibe resolución. Actores maliciosos pueden congelar indefinidamente las ganancias de un pro abriendo una disputa.
- Consecuencia operacional (dinero/booking/confianza): fondos de payout congelados sin garantía de SLA; las disputas se acumulan sin límite; los pros pueden ser griefeados. Erosión de confianza en ambos lados y backlog operacional sin límite.
- Fix recomendado: agregar un cron (p.ej. extender `process-bookings` o un nuevo job `dispute-sla` / `/api/cron/process-disputes`) que encuentre `DisputeTicket` con `status in (OPEN,IN_REVIEW)` y `dueDateAt < now`, y aplique una resolución por defecto definida (auto-escalar a `IN_REVIEW` con alerta al admin, o auto-release/auto-refund por política). Como mínimo, alertar a los admins ante disputas vencidas. Reconciliar `escrowStatus` contra `money_release_date` de MP.

---

### G12 — Escrow `RELEASED` y `Payout PAID` se fijan por heurística, no por confirmación real de release de MercadoPago
- Dominio: booking-integrity (relacionado con G7; cita rutas y comportamiento del processor)
- Archivos:
  - `src/lib/payouts-processor.ts:78-105`
  - `src/lib/payouts-processor.ts:121-149`
- Comportamiento actual: en `processBookingsForPayout`, si MP devuelve `providerResult.status === 'approved'` el código fija `payoutStatus=PAID` y `escrowStatus='RELEASED'` (líneas 88-90), con un comentario admitiendo "Como heuristica pragmatica consideramos el approved estable como RELEASED tras pasar el hold local de 24h". No chequea `money_release_date` ni consulta el estado de disbursement/release de MP. Luego marca el `Payout` local `PAID` y el `Booking COMPLETED`.
- Escenario de fallo real: MP retiene los fondos del marketplace por, digamos, varios dias. 24h tras `AWAITING_CUSTOMER_CONFIRMATION` el cron ve `status=approved`, marca `Payout PAID` + `Booking COMPLETED` + escrow `RELEASED`, y emaila al pro "tu payout fue liberado". El pro revisa su cuenta MP y el dinero aun no está (sigue en escrow), generando carga de soporte y desconfianza; los libros de WeTask dicen PAID mientras MP dice held.
- Consecuencia operacional (dinero/booking/confianza): los libros divergen de la realidad de MercadoPago; pros notificados de pago que no recibieron; pesadilla de reconciliación; sub/sobre-conteo potencial de pasivos de la plataforma.
- Fix recomendado: fijar `escrowStatus=RELEASED` / `Payout=PAID` solo cuando MP confirme el release: inspeccionar `money_release_date` del pago (debe estar en el pasado) y/o consultar el estado de disbursement, no meramente `status=approved`. Hasta entonces mantener `Payout=PROCESSING` y re-pollear. Hacer que la notificación al pro refleje con precisión 'scheduled' vs 'released'.

---

### G13 — El cron de payout no verifica que el token del collector siga válido/ACTIVE antes de declarar release; un tasker DISABLED/expirado igual recibe escrow marcado `RELEASED`
- Dominio: payments-mercadopago
- Archivos:
  - `src/lib/payouts-processor.ts:54-105`
  - `src/lib/account-cleanup-processor.ts:123-189`
  - `src/app/api/bookings/checkout/route.ts:271-287`
- Comportamiento actual: `processBookingsForPayout` selecciona `booking.pro.mpAccessToken` y, si está presente, llama `getMercadoPagoMarketplacePayment` con él (líneas 80-82). Si `mpAccessToken` es null cae silenciosamente al token de PLATAFORMA `getMercadoPagoPayment` (línea 82). Nunca chequea `pro.mpAccountStatus`. `refreshExpiringMpTokens` fija `mpAccountStatus='DISABLED'` y deja el `mpAccessToken` ya revocado en su lugar cuando un refresh falla (`account-cleanup-processor.ts:166-180` solo actualiza status, no el token). Checkout sí exige `mpAccountStatus==='ACTIVE'` (línea 279) pero la ruta de payout no.
- Escenario de fallo real: el token MP de un tasker es revocado entre booking y el payout de 24h. El refresh cron lo voltea a DISABLED pero el booking ya está PAID y AWAITING_CONFIRMATION. El cron de payout igual corre: con el token stale la llamada al marketplace falla (caught -> PROCESSING) o, si el token fue nulificado por anonimización, cae al token de plataforma, puede ver 'approved', y marca escrow `RELEASED` para un tasker que ya no puede recibir fondos en MP.
- Consecuencia operacional (dinero/booking/confianza): escrow marcado liberado a un collector desconectado/deshabilitado; fondos varados en MP bajo un link revocado; tasker nunca pagado pero los libros de WeTask dicen pagado. Carga de confianza + reconciliación.
- Fix recomendado: en `processBookingsForPayout`, requerir `booking.pro.mpAccountStatus==='ACTIVE'` y un `mpAccessToken` no-null para proceder; de lo contrario dejar el `Payout PROCESSING` y notificar al tasker para reconectar. Nunca caer al token de plataforma para confirmar un release de marketplace. Ante fallo de refresh, también limpiar/flaggear el `mpAccessToken` stale.

---

### G14 — Reembolso parcial deja escrow/payout intactos: un pago `PARTIAL_REFUNDED` puede pagarse por completo, doble-pagando el monto reembolsado
- Dominio: payments-mercadopago
- Archivos:
  - `src/app/api/marketplace/admin/disputes/route.ts:244-291`
  - `src/lib/payouts-processor.ts:88-105`
- Comportamiento actual: en un reembolso parcial la ruta de disputas fija `Payment.status=PARTIAL_REFUNDED` y `Booking.status=REFUNDED` (líneas 244-279). El monto del payout se computa en otro lugar como `totalPriceClp - platformFeeClp` y nunca se reduce por el reembolso parcial. El processor de payout solo trata el status `'refunded'` (total) como bloqueador (líneas 91-94); un reembolso parcial sigue mostrando MP status `'approved'`.
- Escenario de fallo real: el admin emite un reembolso parcial del 50% por una queja de calidad. El booking pasa a `REFUNDED`, el `Payment` a `PARTIAL_REFUNDED`. Pero si un `Payout` aun no se finalizó, `processBookingsForPayout` (que opera sobre `AWAITING_CUSTOMER_CONFIRMATION`) no toma un booking `REFUNDED` — sin embargo la ruta de payout-request / customer-confirm ya pudo haber creado un `Payout` de monto completo. El tasker sigue agendado para recibir el monto completo pre-reembolso, asi que la plataforma paga dinero que ya reembolsó al cliente.
- Consecuencia operacional (dinero/booking/confianza): neto negativo en cada reembolso parcial donde exista un payout de valor completo: reembolso al cliente + payout completo al tasker. Dinero perdido igual a la porción reembolsada.
- Fix recomendado: en el reembolso parcial, recomputar y decrementar `Payout.amountClp` por el monto reembolsado (y la cuota correspondiente de `application_fee`), fijar `escrowStatus` a un estado `PARTIALLY_REFUNDED`, y hacer que `processBookingsForPayout` excluya pagos `REFUNDED`/`PARTIAL_REFUNDED` y honre el monto ajustado.

---

### G15 — El cron de payout no verifica el token MP / no escala payouts `PROCESSING` por expiración de token mid-lifecycle
- Dominio: payments-mercadopago
- Archivos:
  - `src/lib/account-cleanup-processor.ts:112-159`
  - `src/lib/payouts-processor.ts:78-101`
- Comportamiento actual: `refreshExpiringMpTokens` corre (diario por comentario de cron) y refresca tokens que expiran dentro de 7 dias, solo para `mpAccountStatus==='ACTIVE'`. El processor de payout usa `booking.pro.mpAccessToken` al momento del payout sin re-chequear expiración; si está expirado solo atrapa el error de MP y deja el `Payout PROCESSING` (líneas 98-101).
- Escenario de fallo real: el token de un tasker expira y el refresh diario no corrió / falló. Múltiples bookings quedan en `PROCESSING` payout a través de varios ciclos de cron sin alerta al operador, asi que los taskers silenciosamente no cobran.
- Consecuencia operacional (dinero/booking/confianza): payouts retrasados/atascados para taskers afectados; sin breach de SLA visible.
- Fix recomendado: agregar un umbral de max-retry/edad sobre payouts `PROCESSING` que escale a una alerta al admin y al tasker, e intentar un refresh de token on-demand dentro de la ruta de payout antes de rendirse.

(Nota: HIGH según el dominio payments; el dominio async-jobs marca la variante de severidad LOW de la misma raíz en G29.)

---

### G16 — Taskers aprobados-pero-no-activados se vuelven visibles en búsqueda antes de que corra el gate de activación
- Dominio: provider-onboarding
- Archivos:
  - `src/app/api/admin/onboarding/cleaning/route.ts:368-445`
  - `src/lib/tasker-publication.ts:266-390`
  - `src/app/api/marketplace/search-professionals/route.ts:32,342-361`
  - `src/lib/tasker-publication.ts:97-136`
- Comportamiento actual: la acción admin 'approve' (`route.ts:368`) fija status `APROBADO` y llama `syncTaskerMarketplaceServicesFromOnboarding`, que upserta el `ProfessionalProfile` con `isVerified:true` / `verificationStatus:'APPROVED'` y crea filas `TaskerService` activas (`tasker-publication.ts:319-358,224`). NO fija status `ACTIVO`. La acción separada 'activate' es la que exige `serviceCommunes>0` (`route.ts:479`) y requisitos completos de publicación (`route.ts:527-537`). Pero `search-professionals` consulta `professionalProfile where isVerified:true + user.mpAccountStatus ACTIVE`, luego aplica un fallback legacy (líneas 352-356) que admite cualquier perfil cuyos únicos requisitos faltantes estén en `{onboarding_completed, published, status_active}`. Tras approve, un tasker con MP conectado tiene `isVerified=true`, servicios activos, comuna y tarifa satisfechos — asi que los únicos requisitos faltantes son exactamente ese set legacy, y el tasker aparece en búsqueda y es reservable.
- Escenario de fallo real: el admin aprueba a un tasker para desbloquearlo, con intención de hacer un check de activación final luego. El tasker tiene MercadoPago conectado. En minutos aparece en resultados de búsqueda del cliente y recibe un booking pagado y confirmado — antes de que el admin corra el paso de activación que valida comunas de servicio y genera slots de disponibilidad. Si el perfil fue aprobado con un set de comunas erróneo/vacío que approve nunca chequeó, el cliente reserva a alguien que no sirve su área.
- Consecuencia operacional (dinero/booking/confianza): bookings llegan a proveedores que el operador cree que aun están 'pendientes de activación', socavando el gate de calidad manual. Clientes pueden ser emparejados con proveedores de cobertura no validada, produciendo no-shows / cancelaciones y reembolsos, erosionando la confianza en el marketplace curado.
- Fix recomendado: hacer que la publicación requiera status `ACTIVO`. Opción (a) eliminar el fallback legacy-verified en `search-professionals` (líneas 352-361) para que `canAppearInSearch` (que requiere `status==='active'`) sea autoritativa, o (b) en la acción approve, NO fijar `isVerified=true` hasta la activación — pasar un flag a `syncTaskerMarketplaceServicesFromOnboarding` para que cree los `TaskerService` pero deje `profile.isVerified=false` hasta que corra activate. Dado que la query DB filtra por `isVerified:true`, la opción (b) previene limpiamente que `APROBADO` aflore.

---

### G17 — No hay cola operacional de bookings atascados / pagos PENDING atascados
- Dominio: admin-tooling
- Archivos:
  - `src/app/admin/page.tsx:276-292`
  - `src/app/api/admin/dashboard-stats/route.ts:37-72`
  - `src/lib/payouts-processor.ts:274-356`
- Comportamiento actual: la única vista de bookings del dashboard es 'Actividad reciente' (`admin/page.tsx:276`) — los 5 bookings mas recientes por `createdAt desc`, sin importar el estado. `dashboard-stats` expone `todayBookings`, revenue, conteos de onboarding, `openDisputes`, `pendingPayouts` — pero nada sobre bookings atascados en `PENDING_PAYMENT`, `AWAITING_CUSTOMER_CONFIRMATION` mas allá del hold de 24h, o pagos `PENDING`. `reconcilePendingPayments` auto-sana payments PENDING via cron, pero si MP sigue devolviendo pending o el cron falla (`result.failed` incrementa, línea 350), nada los flaggea a un humano.
- Escenario de fallo real: un webhook de MP se pierde y el cron de reconcile también falla para un pago (blip de red a MP). El `Payment` queda `PENDING`, el `Booking PENDING_PAYMENT` indefinidamente. El cliente pudo haber sido cobrado. Sin tarjeta de dashboard, sin cola — el booking queda enterrado bajo filas mas nuevas en 'Actividad reciente' en minutos.
- Consecuencia operacional (dinero/booking/confianza): clientes cobrados sin servicio entregado, slots retenidos o perdidos, y el operador no tiene forma de encontrarlos y resolverlos proactivamente. Dinero en limbo sin dueño humano.
- Fix recomendado: agregar a `dashboard-stats` conteos de `booking.count` donde `status=PENDING_PAYMENT AND createdAt < now-30min`, `payment.count` donde `status=PENDING AND createdAt < now-30min`, y `booking.count` donde `status=AWAITING_CUSTOMER_CONFIRMATION AND updatedAt < now-48h`. Mostrarlos como tarjetas de dashboard que enlacen a una cola operacional `/admin/bookings?status=...` con una acción manual 'reconciliar ahora' llamando `reconcilePendingPayments` para ese pago.

---

### G18 — `AdminAuditLog` es write-only: no hay UI ni API de admin para leer el audit trail
- Dominio: admin-tooling
- Archivos:
  - `src/lib/audit-log.ts:26-41`
  - `prisma/schema.prisma:671-684`
  - `src/app/api/admin/payments/refund/route.ts:111`
  - `src/app/api/marketplace/admin/disputes/route.ts:320`
- Comportamiento actual: `recordAdminAction` escribe filas `AdminAuditLog` desde 11 call sites (reembolsos, resoluciones de disputa, runs manuales de payout, cron de refresh de token MP, onboarding). El modelo está bien diseñado con `actorId`, `action`, `before/afterJson`. Pero un grep de lecturas de `adminAuditLog`/`AdminAuditLog` muestra CERO rutas de lectura — sin página admin, sin ruta GET. No hay pantalla `/admin/audit`.
- Escenario de fallo real: un cliente disputa un chargeback alegando "WeTask nunca me reembolsó" o dos admins discrepan sobre quién cerró una disputa con un reembolso de $50.000. El operador on-call no tiene forma in-product de ver quién hizo qué y cuándo; debe pedir a un dev que corra SQL crudo contra `AdminAuditLog`.
- Consecuencia operacional (dinero/booking/confianza): respuesta a incidentes lenta/bloqueada, sin accountability entre admins, postura débil en disputas con procesador de pagos o legales pese a que el dato está capturado. La inversión en audit logging entrega poco valor operacional sin un visor.
- Fix recomendado: agregar `GET /api/admin/audit-log` (paginado, filtrable por `actorId`/`targetType`/`action`/fecha) y una tabla `/app/admin/audit/page.tsx`. Enlazar desde el dashboard y desde cada página de detalle de disputa/usuario (filtrar por `targetId`) para que el operador vea el historial completo de acciones de un booking/payment/disputa dado.

---

### G19 — No hay vista de proveedores con tokens de MercadoPago desconectados/expirados que tienen bookings activos
- Dominio: admin-tooling
- Archivos:
  - `src/lib/payouts-processor.ts:78-105`
  - `src/app/api/cron/refresh-mp-tokens/route.ts:1-43`
  - `src/app/admin/page.tsx:200-292`
- Comportamiento actual: el processor de payout ramifica sobre `booking.pro.mpAccessToken` (`payouts-processor.ts:80`): con token usa el endpoint marketplace, sin token cae al endpoint de plataforma. El cron `refresh-mp-tokens` deshabilita cuentas cuyo refresh falla y notifica al tasker. Pero un grep de `src/app/admin` por `mpAccessToken`/`mpConnected`/`mp_expired` no devuelve archivos — ninguna pantalla admin muestra qué proveedores tienen conexión MP faltante/expirada, y crucialmente ninguna lo cruza contra proveedores con bookings activos/próximos.
- Escenario de fallo real: el token MP de un tasker popular expira y el refresh falla (revocó acceso). El cron deshabilita payouts pero el tasker sigue siendo emparejado/reservado porque nada bloquea nuevos bookings según status MP, y ningún dashboard lo flaggea. Múltiples trabajos completados se acumulan que nunca pueden pagarse hasta que alguien persiga manualmente al tasker.
- Consecuencia operacional (dinero/booking/confianza): payouts impagables apilados, taskers frustrados, y un backlog de reconciliación que es invisible hasta volverse crisis. Los operadores no pueden intervenir temprano (p.ej. pausar matching para ese tasker).
- Fix recomendado: agregar una tarjeta de dashboard + cola listando `professionalProfiles` donde el token MP es null/expirado Y el usuario tiene bookings en estados activos (`ASSIGNED/ACCEPTED/CONFIRMED/IN_PROGRESS/AWAITING_CUSTOMER_CONFIRMATION`). Proveer una acción 'reenviar invitación a reconectar MP'. Opcionalmente gatear el nuevo matching sobre una conexión MP sana.

---

### G20 — `process-bookings` y `booking-reminders` usan `findMany` sin límite (`take:`): pueden exceder el timeout y QStash reintenta el mismo batch sobredimensionado para siempre
- Dominio: async-jobs-cron
- Archivos:
  - `src/lib/payouts-processor.ts:41-56`
  - `src/app/api/cron/booking-reminders/route.ts:40-52`
  - `src/app/api/cron/booking-reminders/route.ts:54-67`
- Comportamiento actual: la query de candidatos de `processBookingsForPayout` (`payouts-processor.ts:41`) no tiene límite `take:` — carga todos los bookings `AWAITING_CUSTOMER_CONFIRMATION+PAID` mas viejos de 24h, y por cada uno hace una llamada HTTP saliente síncrona a MP (líneas 78-105) mas una transacción DB. `booking-reminders` (`route.ts:40`) tampoco tiene `take:` y ademas corre una query de idempotencia N+1 por booking (`route.ts:56`) mas 2 envíos de notificación/email por booking. En contraste `reconcile-payments` (`take:100`), `refresh-mp-tokens` (`take:50`) y `hard-delete` (`take:100`) SÍ están acotados.
- Escenario de fallo real: se acumula un backlog de 500 bookings esperando payout (p.ej. tras el incidente de reconcile de G6, o un fin de semana ocupado). `process-bookings` hace 500 GETs secuenciales a MP + 500 transacciones en un request, sobrepasa el timeout serverless/QStash, no devuelve 200. QStash ve un no-2xx/timeout y reintenta el batch completo de 500; cada reintento vuelve a expirar, asi que el cron nunca progresa y los payouts se atascan indefinidamente.
- Consecuencia operacional (dinero/booking/confianza): payouts y recordatorios dejan de progresar justo cuando el volumen es mas alto; taskers no cobran; clientes no reciben recordatorios -> no-shows. Cómputo desperdiciado en timeouts reintentados infinitamente.
- Fix recomendado: agregar `take:` (p.ej. 50) a ambas queries y procesar oldest-first (`orderBy updatedAt asc` / `scheduledAt asc`) para que cada invocación drene un slice acotado y el siguiente run continúe. Como el trabajo es idempotente, el progreso parcial es seguro. Para `booking-reminders`, reemplazar el `findFirst` N+1 de idempotencia con una query batcheada (recolectar `bookingIds`, un `notification.findMany`) o una unique constraint (ver G27).

---

### G21 — Sin heartbeat de cron / dead-letter / alertas: un cron silenciosamente muerto (o QStash agotando reintentos) pasa desapercibido por dias
- Dominio: async-jobs-cron
- Archivos:
  - `src/app/api/cron/process-bookings/route.ts:15-42`
  - `src/app/api/cron/reconcile-payments/route.ts:16-46`
  - `src/app/api/cron/refresh-mp-tokens/route.ts:16-43`
  - `src/app/api/cron/hard-delete-accounts/route.ts:16-42`
  - `src/app/api/cron/booking-reminders/route.ts:25-145`
- Comportamiento actual: los crons solo hacen `recordAdminAction` cuando los conteos de resultado son >0 (p.ej. `process-bookings/route.ts:22`, `refresh-mp-tokens/route.ts:23`) — un run que revisa 0 candidatos no escribe registro, y un run que nunca corre no escribe nada por definición. Grep por `heartbeat`/`lastRunAt`/`CronRun`/`monitor` solo encontró `rate-limit.ts`; no hay tabla ni contador que rastree la última ejecución exitosa por cron, ni check de cadencia esperada, ni dead-letter/alerta cuando QStash agota reintentos. Sentry solo recibe excepciones lanzadas dentro de un run (`logError`), no la ausencia de runs.
- Escenario de fallo real: `QSTASH_CURRENT_SIGNING_KEY` se rota en Upstash pero no se redespliega a la app. Cada llamada de cron ahora devuelve 401 (`qstash.ts:93-101`). QStash reintenta unas veces, luego los dropea a su dead-letter. `refresh-mp-tokens` deja de correr; en 1-2 semanas los tokens MP de taskers expiran, los pagos del marketplace empiezan a fallar, y nadie lo sabe hasta que los taskers reclaman. Mismo punto ciego si `process-bookings` muere — los payouts simplemente paran.
- Consecuencia operacional (dinero/booking/confianza): el dinero deja de moverse (payouts/refresh) o la experiencia del cliente se rompe silenciosamente (recordatorios), y el operador se entera solo via reclamos downstream dias después. Es el mayor gap de fiabilidad.
- Fix recomendado: agregar una tabla `CronHeartbeat` (`cronName`, `lastSuccessAt`, `lastResultJson`) upserteada al final de cada run sin importar conteos. Agregar un monitor liviano (un endpoint admin pequeño o un 6to cron) que flaggee cualquier cron cuyo `lastSuccessAt` exceda su intervalo esperado y empuje un mensaje a Sentry / email / Slack. Configurar el callback de dead-letter de QStash para pegar a un endpoint de alerta. Agregar endpoints de re-run manual (admin-guarded) para los cuatro crons que hoy carecen de uno.

---

### G22 — Disputas nunca auto-expiran: `dueDateAt` SLA se fija pero ningún cron lo procesa; payout congelado para siempre ante inacción del admin
- Dominio: marketplace-trust
- Archivos:
  - `src/app/api/marketplace/disputes/route.ts:70-82`
  - `src/lib/payouts-processor.ts:50-58`
  - `prisma/schema.prisma:518-526`
  - `src/app/admin/disputes/page.tsx:59-60`
- Comportamiento actual: abrir una disputa fija `dueDateAt = now + 5 dias` y voltea el booking a `DISPUTE`. `processBookingsForPayout` excluye bookings con disputas `OPEN`/`IN_REVIEW` (filtro elegible `b.disputes.length===0`). `dueDateAt` solo se renderiza en la UI admin como badge 'Vence'. Grep no muestra cron ni job consultando `dueDateAt`.
- Escenario de fallo real: el cliente abre una disputa frívola y el pequeño equipo de ops está de vacaciones. El pro que genuinamente completó el trabajo nunca cobra; el booking queda en `DISPUTE` para siempre; los fondos de escrow pueden auto-liberarse del lado de MP (`money_release_date`) al collector mientras la DB de WeTask aun dice `HELD`, desincronizando los libros.
- Consecuencia operacional (dinero/booking/confianza): los pros dejan de confiar en la plataforma (trabajos completados impagos), desincronización dinero/escrow vs MercadoPago, backlog de soporte. Capital de trabajo congelado.
- Fix recomendado: agregar un cron (p.ej. `/api/cron/process-disputes`) que encuentre `DisputeTicket` con `status in (OPEN,IN_REVIEW)` y `dueDateAt < now`, y auto-escale (notificar admins + bump priority) o aplique una política de resolución por defecto. Como mínimo, alertar cuando `dueDateAt` se vence. Reconciliar `escrowStatus` contra `money_release_date` de MP. (Mismo problema raíz que G11, distinto dominio/citas.)

---

### G23 — Sin constraint unique/active en `DisputeTicket.bookingId`: las disputas pueden spamearse/reabrirse para re-congelar payouts
- Dominio: marketplace-trust
- Archivos:
  - `prisma/schema.prisma:505-527`
  - `src/app/api/marketplace/disputes/route.ts:46-87`
  - `src/app/api/marketplace/bookings/[bookingId]/customer-confirm/route.ts:39-45`
- Comportamiento actual: `DisputeTicket` tiene `@@index([bookingId,status])` pero NINGUNA unique constraint. La ruta POST no chequea una disputa abierta existente antes de crear; solo asierta la transición a `DISPUTE`. El bloqueo de payout está implementado en todos lados como `findFirst({status:{in:[OPEN,IN_REVIEW]}})`.
- Escenario de fallo real: el pro y el cliente no aceptan la resolución; el cliente reabre una nueva disputa cada vez que el admin cierra una. El payout (gateado solo por '¿hay una disputa OPEN/IN_REVIEW?') nunca se libera. O un actor malicioso abre 50 filas de disputa, inundando la cola del admin.
- Consecuencia operacional (dinero/booking/confianza): DoS de payout permanente sobre un único booking; spam de cola admin; pro nunca pagado; colapso de confianza.
- Fix recomendado: agregar un índice unique parcial para que exista solo una disputa no-terminal por booking (p.ej. unique en `bookingId` where `status in OPEN/IN_REVIEW` — implementar via guard + CHECK de DB o una columna separada `activeDisputeId` con `@unique`). En el POST de disputas, antes de crear, rechazar si ya existe una disputa sin resolver. Bloquear la reapertura una vez que una disputa fue `RESOLVED` con reembolso o tras payout `PAID`.

---

### G24 — La anti-desintermediación del chat solo bloquea ANTES de que el booking esté `CONFIRMED`: abierta durante toda la ventana de servicio pagada; el filtro se evade trivialmente
- Dominio: marketplace-trust
- Archivos:
  - `src/lib/chat-safety.ts:22-48`
  - `src/app/api/marketplace/bookings/[bookingId]/messages/route.ts:75-77`
- Comportamiento actual: el POST de messages bloquea info de contacto solo cuando `canShareContactDetails(status)` es false, y eso devuelve true para `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`. Un booking pasa a `CONFIRMED` en el momento en que el pago es aprobado (`PENDING_PAYMENT->CONFIRMED`), lo cual es antes de que el servicio se realice. El regex de teléfono es `/(?:\+?56...)9(...){8}/` y `/\d{8,}/`; la lista de keywords es pequeña.
- Escenario de fallo real: el cliente paga por una limpieza, el booking pasa a `CONFIRMED`, en el chat el pro envía "mi numero +56 9 1234 5678" que ahora está permitido, acuerdan hacer todas las limpiezas futuras en efectivo fuera de plataforma. WeTask pierde toda comisión futura de esa relación.
- Consecuencia operacional (dinero/booking/confianza): pérdida de GMV/comisión recurrente (la fuga de ingresos central del marketplace), y pérdida del sobre de seguridad/escrow que la plataforma vende. Es el vector clásico de leakage del marketplace.
- Fix recomendado: restringir `canShareContactDetails` a estados genuinamente post-completion (p.ej. `COMPLETED`/`IN_PROGRESS` tras check-in), NO `CONFIRMED`. Mejor aun: nunca auto-permitir números en texto libre; enmascarar la info de contacto detectada y proveer una llamada enmascarada/relay in-app. Endurecer la detección (normalización de dígitos-en-palabras, stripping de separadores, mas keywords de apps) y loggear intentos para scoring de reincidentes.

---

## MEDIUM

### G25 — Creación pública de bookings genera bookings huérfanos sin pago, sin pro, sin slot
- Dominio: booking-integrity
- Archivos:
  - `src/app/api/bookings/public/route.ts:45-95`
  - `src/app/api/bookings/route.ts:47-86`
- Comportamiento actual: `POST /api/bookings/public` y `POST /api/bookings` crean un `Booking` con solo `customerId`, `serviceId`, `scheduledAt`, campos de dirección y `totalPriceClp=service.basePriceClp`. Sin `proId`, sin `bookedSlotId`, sin fila `Payment`, y status default `PENDING` (`schema.prisma:362`). Nunca se inicia un pago y no hay auth en la ruta pública (upserta el usuario por email).
- Escenario de fallo real: un visitante envía el formulario de booking público. Se crea un `Booking PENDING` sin pago ni pro. Contamina dashboards/listas (el GET de bookings los devuelve), y representa una orden fantasma que nadie cumplirá. Emails spammy pueden crear masivamente usuarios + bookings.
- Consecuencia operacional (dinero/booking/confianza): la DB se llena de bookings huérfanos fantasma; métricas y dashboards de pro/cliente contaminados; vector potencial de abuso para creación no autenticada de usuario+booking. Los operadores no pueden distinguir intención real del ruido.
- Fix recomendado: eliminar estas rutas legacy de creación no autenticada en favor del flujo de checkout, o hacer que creen el booking en `PENDING_PAYMENT` atado a un payment intent y agregar un cron que expire bookings `PENDING`/`PENDING_PAYMENT` stale sin `Payment` tras N minutos. Agregar auth a la ruta pública o rate limiting estricto + verificación de email antes de persistir.

---

### G26 — Un slot puede perderse silenciosamente (huérfano con `isAvailable=false`) cuando la llamada al provider falla a mitad de vuelo
- Dominio: booking-integrity
- Archivos:
  - `src/app/api/bookings/checkout/route.ts:324-462`
  - `src/lib/payouts-processor.ts:223-239`
- Comportamiento actual: checkout marca el slot `isAvailable=false` dentro de la tx, luego llama a MP fuera de la tx. Ante excepción del provider corre una tx compensatoria que vuelve el slot a `isAvailable=true` (líneas 453-458) y ante webhook/reconcile `PAYMENT_FAILED` también libera el slot. `releaseExpiredHolds` (`payouts-processor.ts:223-239`) solo libera slots donde `isAvailable: true AND bookings: { none: {} }` — nunca libera un slot con `isAvailable=false`.
- Escenario de fallo real: el cliente inicia checkout; `createMercadoPagoMarketplacePayment` se cuelga y la función serverless expira tras reservar el slot y crear el `Payment` con `providerStatus='created'` pero sin `providerPaymentId`. El `Booking` queda atascado `PENDING_PAYMENT`, el slot `isAvailable=false` para siempre, y `reconcile-payments` lo omite (sin `providerPaymentId`, `payouts-processor.ts:282`). El slot queda permanentemente no-reservable.
- Consecuencia operacional (dinero/booking/confianza): fuga silenciosa de slots: los pros pierden inventario reservable sin señal. Con el tiempo el calendario de un pro se llena de slots muertos reservados. Requiere limpieza manual de DB.
- Fix recomendado: agregar un cron de limpieza para bookings `PENDING_PAYMENT` stale: si un booking es `PENDING_PAYMENT` sin `providerPaymentId` (o `Payment.providerStatus` aun 'created') mas viejo de ~15 min, transicionar a `PAYMENT_FAILED`/`CANCELLED` y liberar el `bookedSlot` (`isAvailable=true`). Incluir también tales bookings en reconcile re-consultando MP via `idempotencyKey`/`externalReference` aun cuando `providerPaymentId` sea null.

### G27 — La acción approve no valida requisitos de publicación (comuna/tarifa/categoría) que la activación sí exige
- Dominio: provider-onboarding
- Archivos:
  - `src/app/api/admin/onboarding/cleaning/route.ts:368-398,479-537`
- Comportamiento actual: la rama 'approve' solo guarda sobre `sync.updated===0 && reason!=='synced'` (`route.ts:382`). No llama `getTaskerPublicationState`, no exige `serviceCommunes>0`, ni chequea tarifa horaria o categoría como la rama 'activate' (`route.ts:479-537`). Como approve fija `isVerified=true` + servicios activos (ver G16), un perfil que FALLARÍA la activación puede aprobarse y publicarse via el fallback de búsqueda.
- Escenario de fallo real: una fila de onboarding tiene `serviceCommunes` vacío (p.ej. drift de datos, o solo `baseCommune` fijado). `syncTaskerServicesForCategory` tiene éxito (solo necesita `categorySlug` + un `Service` que matchee), asi que `sync.updated>0` y approve tiene éxito. El tasker ahora está verificado y, si tiene MP conectado, aflora en búsqueda. El gate de activate que lo habría rechazado por 'comuna' faltante nunca es lo que controla la visibilidad.
- Consecuencia operacional (dinero/booking/confianza): proveedores con datos de cobertura/precio incompletos salen en vivo, causando resultados de búsqueda desajustados y bookings rotos. El modelo mental del operador ('nada es público hasta que activo y pasa los checks') es falso.
- Fix recomendado: en la rama approve, antes/después del sync, computar `getTaskerPublicationState` para el usuario y rechazar (409 con `missingRequirements`, excluyendo `published`/`status_active`) exactamente como la rama activate (`route.ts:532-537`). Alternativamente, no publicar en approve (diferir `isVerified` a activate) para que approve nunca necesite estos checks.

### G28 — Documentos de identidad y fotos de perfil almacenados como base64 multi-MB en la DB cuando R2 no está configurado
- Dominio: provider-onboarding
- Archivos:
  - `src/lib/validators.ts:247-255,314-331,486-489,653-662`
  - `src/app/trabaja-con-nosotros/registro/utils.ts:203-234`
  - `src/lib/storage/r2.ts:82-89,147-157`
  - `src/app/api/uploads/presign/route.ts:27-32`
- Comportamiento actual: `uploadAssetViaPresign` (`utils.ts:226-234`) llama `/api/uploads/presign`; si el storage no está configurado la ruta devuelve 503, el cliente cae a `fileToDataUrl` y almacena el data URL base64 completo en el campo de onboarding. `validators.ts` (`imageDataUrlSchema`/`pdfOrImageDataUrlSchema`, 314-331) acepta O una storage key O un data URL base64 de hasta 8MB. El schema `profilePhotoUrl` de la ruta pública start (`validators.ts:247-255`) acepta SOLO `data:` base64. `resolveAssetUrl` (`r2.ts:147-157`) devuelve URLs `data:` tal cual para visualización admin.
- Escenario de fallo real: las env vars de R2 faltan/están mal configuradas en producción. Los taskers completan onboarding; sus carnets frente/dorso y PDFs de antecedentes se almacenan como strings base64 de ~8MB por campo por tasker. Los tamaños de fila se inflan, cada query de la cola admin (`admin/onboarding/cleaning` GET trae filas de onboarding) y cada GET de `onboarding/me` arrastra estos blobs por la red, degradando la herramienta de revisión admin y arriesgando statement timeouts / bloat de TOAST a medida que escalan los taskers.
- Consecuencia operacional (dinero/booking/confianza): bloat de DB y cola de revisión admin / autosave de onboarding lentos o fallidos a escala; documentos de ID sensibles persistidos en-DB en vez de object storage; backups inflados. Ocurre silenciosamente cuando R2 no está configurado, sin alarma al operador.
- Fix recomendado: en producción, tratar la config R2 faltante como fallo duro para campos de documentos: que presign devuelva 503 solo en no-producción, y en los handlers submit/me rechazar valores base64 para campos de identidad/antecedentes cuando `isStorageConfigured()` es true pero el valor es un `data:` URL (forzar re-upload como key). Correr el `scripts/migrate-base64-to-r2.mjs` existente para migrar filas legacy, y agregar un health/startup check que asierta R2 configurado antes de permitir submissions de onboarding.

### G29 — El status de webhook 'refunded'/'failed' puede aplicarse a un booking ya liberado/completado, desincronizando silenciosamente Payment vs Booking
- Dominio: payments-mercadopago
- Archivos:
  - `src/app/api/payments/webhook/mercadopago/route.ts:158-204`
  - `src/lib/payouts-processor.ts:88-90`
- Comportamiento actual: el webhook computa `transitionAllowed=canTransition(...)`. Cuando es false (p.ej. un webhook 'refunded' tardío llega tras `COMPLETED` — `COMPLETED->REFUNDED` ilegal), igual actualiza `Payment.status` a `REFUNDED` (líneas 166-180) pero solo fija `Booking.paymentStatus=REFUNDED` DEJANDO `booking.status=COMPLETED` (líneas 190-196).
- Escenario de fallo real: MP procesa un chargeback/reembolso fuera de banda tras que WeTask auto-completó el booking. El webhook marca `Payment REFUNDED` pero el booking queda `COMPLETED` con el tasker ya pagado. La contradicción es invisible para los operadores.
- Consecuencia operacional (dinero/booking/confianza): inconsistencia silenciosa de ledger: un booking completado y pagado cuyo pago está reembolsado. Reconciliación manual requerida; dinero ya liberado al tasker se pierde.
- Fix recomendado: cuando un status 'refunded'/'failed' llega pero la transición del booking es ilegal, levantar una alerta de reconciliación explícita / crear una tarea admin (e idealmente una `DISPUTE`) en vez de escribir silenciosamente un `paymentStatus` contradictorio. Agregar un check de invariante periódico para `Payment.status=REFUNDED` con `Payout.status=PAID`.

### G30 — `refundMercadoPagoPayment` trata cualquier 2xx como éxito total y no verifica el status del objeto de refund de MP
- Dominio: payments-mercadopago
- Archivos:
  - `src/lib/payments/providers/mercadopago.ts:488-526`
  - `src/app/api/marketplace/admin/disputes/route.ts:229-241`
- Comportamiento actual: `refundMercadoPagoPayment` hace POST a `/v1/payments/{id}/refunds` y, si `response.ok`, devuelve incondicionalmente `status:'refunded'` con `amount = payload.amount ?? input.amount` (líneas 513-525). No inspecciona el campo `status` propio del objeto refund (los refunds de MP pueden ser 'approved' o 'in_process'/pending). La ruta de disputas luego persiste `Payment REFUNDED`/`PARTIAL_REFUNDED` basándose puramente en ese 'refunded'.
- Escenario de fallo real: MP devuelve 201 con el refund en 'in_process'. WeTask registra el booking `REFUNDED` y emaila al cliente "se procesó un reembolso". Si MP luego rechaza/revierte el refund, el estado de WeTask es incorrecto y al cliente se le dijo que viene dinero que no viene.
- Consecuencia operacional (dinero/booking/confianza): cliente notificado de reembolso cuando está pending/failed; daño de confianza y disputas. Doble-refund potencial si un operador reintenta.
- Fix recomendado: parsear el `status` de la respuesta del refund (`payload.status`) y devolver 'refunded' solo cuando MP confirme 'approved'; de lo contrario devolver un status 'pending' que la ruta de disputas pueda retener. Agregar un job de reconcile que re-consulte el status del refund. Validar `payload.amount` igual al `refundAmount` solicitado antes de persistir `PARTIAL_REFUNDED` vs `REFUNDED`.

### G31 — Sin reconciliación de `application_fee`: la comisión se computa solo sobre el labor subtotal; los extras pasan 100% al tasker sin comisión
- Dominio: payments-mercadopago
- Archivos:
  - `src/lib/marketplace-pricing.ts:23-53`
  - `src/app/api/bookings/checkout/route.ts:241-250`
  - `src/app/api/bookings/checkout/route.ts:386-435`
  - `src/lib/payouts-processor.ts:69`
- Comportamiento actual: `calculateMarketplacePrice` computa `platformFeeClp = round(subtotal * pct)` — fee solo sobre LABOR, no extras (materiales/urgencia/viaje). `total = subtotal + extras + fee` (fee añadido encima, cobrado al cliente). Checkout envía `application_fee = price.platformFeeClp` a MP (`checkout línea 433`) y almacena `applicationFeeClp=platformFeeClp`. El collector recibe `total - fee = subtotal + extras`. El monto de payout = `totalPriceClp - platformFeeClp = subtotal + extras` (`payouts-processor línea 69`), internamente consistente con lo que MP paga al collector.
- Escenario de fallo real: no es un crash, sino un problema de margen/reporting: un booking con extras altos de viaje+materiales rinde al tasker los extras completos mientras la comisión de WeTask se computa solo sobre la porción de labor. Si el producto pretendía comisión sobre el valor total del servicio, WeTask sub-cobra en cada booking con extras.
- Consecuencia operacional (dinero/booking/confianza): sub-recaudación sistemática potencial de comisión y sin ledger de fee de primera clase para contabilidad/reconciliación de boleta. El reporting depende de recomputar desde columnas del booking.
- Fix recomendado: decidir explícitamente si `platformFeePct` aplica a `subtotal+extras` o solo `subtotal`, y documentarlo. Persistir una fila de ledger dedicada (fee de plataforma, `application_fee` enviado a MP, neto al tasker) por pago en vez de derivarlo de columnas del booking al leer, para que reporting y reembolsos puedan netear contra una única fuente de verdad.

### G32 — El trigger manual de payout existe pero no está cableado a ningún botón de UI admin
- Dominio: admin-tooling
- Archivos:
  - `src/app/api/marketplace/payouts/process-timeouts/route.ts:13-39`
  - `src/app/admin/page.tsx:1-501`
- Comportamiento actual: `POST /api/marketplace/payouts/process-timeouts` es un trigger manual sólido, admin-guarded, que corre `processBookingsForPayout` y registra una acción de auditoría cuando hay trabajo (`process-timeouts/route.ts:18-27`). Sin embargo, ninguna página admin hace fetch a este endpoint — solo la ruta de cron y este archivo lo referencian. La tarjeta de payout del dashboard (`admin/page.tsx:363-367`) es texto plano sin acción.
- Escenario de fallo real: el cron `process-bookings` de QStash está pausado o fallando por un dia. Los payouts se apilan. El operador quiere flushearlos manualmente pero el único path (el docstring dice que es el botón 'ejecutar ahora') no tiene botón real — debe llamar a un dev.
- Consecuencia operacional (dinero/booking/confianza): recuperación mas lenta de caídas de cron; la recuperación depende de ingeniería en vez de operaciones. Severidad baja porque la capacidad existe y es segura (idempotente), solo no está expuesta.
- Fix recomendado: agregar un botón 'Procesar payouts ahora' en la tarjeta de payouts del dashboard (y la futura `/admin/payouts`) que haga POST a `/api/marketplace/payouts/process-timeouts` y muestre el resumen `{scheduled, paidOut, failed}` devuelto. Agregar botones similares para `reconcile-payments`.

### G33 — Disputas cerca/sobre SLA son visibles por fila pero no hay conteo de breach ni alerta de cola agregada
- Dominio: admin-tooling
- Archivos:
  - `src/app/admin/disputes/page.tsx:57-72`
  - `src/app/api/admin/dashboard-stats/route.ts:58-60`
  - `src/app/admin/page.tsx:222`
- Comportamiento actual: la lista de disputas computa un badge SLA por fila desde `dueDateAt` (`disputes/page.tsx:57`) mostrando 'Vencida hace Nd' / 'Vence en <24h'. El modelo `DisputeTicket` tiene `dueDateAt` con índice (`schema.prisma:518,526`). Pero el dashboard y `dashboard-stats` solo exponen `openDisputes = count de OPEN+IN_REVIEW` (`dashboard-stats:58`, `admin/page.tsx:222`) — no hay conteo separado de disputas con SLA vencido/cerca, y la lista no puede ordenarse/filtrarse por `dueDateAt` (`orderBy` fijo a `createdAt desc` en `disputes/route.ts:73`).
- Escenario de fallo real: existen 20 disputas abiertas; 3 ya están vencidas pero quedan en la página 2 porque se crearon antes y la lista ordena solo por `createdAt desc`. El operador trabaja newest-first y las vencidas se pudren, escalando a chargebacks.
- Consecuencia operacional (dinero/booking/confianza): breaches de SLA y chargebacks que pudieron prevenirse; sin presión operacional para limpiar los casos mas urgentes primero.
- Fix recomendado: agregar una tarjeta de dashboard 'Disputas vencidas' = `disputeTicket.count` donde `status IN (OPEN,IN_REVIEW) AND dueDateAt < now`. Agregar un `orderBy=dueDateAt asc` opcional a la ruta GET de disputas y un toggle 'Urgentes primero' en la UI.

### G34 — La ruta de refund standalone depende solo de la transición de estado para protección anti-doble-refund; sin guard de payment-status ni idempotency key
- Dominio: admin-tooling
- Archivos:
  - `src/app/api/admin/payments/refund/route.ts:40-90`
  - `src/app/api/marketplace/admin/disputes/route.ts:195-242`
- Comportamiento actual: `POST /api/admin/payments/refund` trae el pago, asierta que el BOOKING puede transicionar a `REFUNDED` (`refund/route.ts:62`), luego llama `refundProviderPayment` ANTES de re-leer el estado, y escribe en una transacción. NO chequea `payment.status !== REFUNDED/PARTIAL_REFUNDED`, y la llamada a MP no está guardada por un lock a nivel de request ni idempotency key. La protección anti-doble-refund es indirecta: si el booking ya es `REFUNDED`, `assertTransition(REFUNDED -> REFUNDED)` debería lanzar. La ruta de disputas es mas estricta (chequea `providerPaymentId`, capea el monto a `amountClp`, usa `canTransition`).
- Escenario de fallo real: un admin hace doble-click en 'Reembolsar' sobre un booking en estado reembolsable. Ambos requests leen `status=CONFIRMED`, ambos pasan `assertTransition`, ambos llaman al refund de MP por el monto completo. MP puede procesar dos refunds parciales o rechazar el segundo, pero si el monto es pasado y MP lo permite, el cliente podría ser sobre-reembolsado. El rate limit de 10/h (`refund/route.ts:33`) reduce pero no elimina esto dentro del mismo segundo.
- Consecuencia operacional (dinero/booking/confianza): sobre-reembolso potencial (dinero perdido) y estado DB vs MP inconsistente requiriendo reconciliación manual. Acotado por el rate limiter, de ahi medium.
- Fix recomendado: en `refund/route.ts`: (1) rechazar temprano si `payment.status` es `REFUNDED` o `PARTIAL_REFUNDED`; (2) capear `input.amount` a `payment.amountClp` como la ruta de disputas; (3) envolver el read-validate-mutate en un `SELECT ... FOR UPDATE` sobre la fila del payment (o un `updateMany` condicional guardado por status) para serializar requests concurrentes; (4) pasar `payment.id` como idempotency key de MP a `refundProviderPayment`.

### G35 — `PROCESSING` de payout es un limbo de apariencia terminal sin path de escalación
- Dominio: admin-tooling
- Archivos:
  - `src/lib/payouts-processor.ts:95-105`
  - `src/lib/payouts-processor.ts:162-171`
- Comportamiento actual: cuando MP devuelve un status no-approved/no-refunded, o la llamada a MP lanza (`payouts-processor.ts:96,100`), el `Payout` se fija `PROCESSING` y el booking se mueve a `PAYOUT_SCHEDULED`. El processor solo re-actúa sobre bookings aun en `AWAITING_CUSTOMER_CONFIRMATION` (línea 43). Una vez movido a `PAYOUT_SCHEDULED` con payout `PROCESSING`, el siguiente run del cron NO lo re-selecciona (el status ya no matchea el WHERE), asi que un payout `PROCESSING` nunca es reintentado por el cron.
- Escenario de fallo real: MP hace timeout durante el check de status de release para un booking completado. `Payout -> PROCESSING`, `Booking -> PAYOUT_SCHEDULED`. El booking queda fuera del filtro `AWAITING_CUSTOMER_CONFIRMATION` del cron. Ningún run subsecuente re-consulta a MP. El tasker queda sin pagar indefinidamente y la única señal es un +1 opaco en el contador 'Payouts pendientes'.
- Consecuencia operacional (dinero/booking/confianza): payouts permanentemente atascados tras un error transitorio de MP; tasker impago, requiere intervención manual de DB para recuperar.
- Fix recomendado: agregar un segundo pase del processor (o ampliar la query de candidatos) que seleccione bookings en `PAYOUT_SCHEDULED` cuyo `Payout.status IN (PENDING, PROCESSING)` y `updatedAt` mas viejo que un umbral, re-consulte MP, y los complete o falle. Mostrar payouts `PROCESSING` mas viejos de N horas en la cola de payouts fallidos de G5 con un reintento manual.

### G36 — Idempotencia de `booking-reminders` basada en título de notificación hardcodeado + ventana de 6h: frágil, puede doble-enviar o dejar de enviar
- Dominio: async-jobs-cron
- Archivos:
  - `src/app/api/cron/booking-reminders/route.ts:54-67`
  - `prisma/schema.prisma:529-542`
- Comportamiento actual: el dedup se hace consultando `Notification` por una fila cuyo `title` iguala exactamente el string en español 'Tu servicio empieza pronto' / 'Recordatorio: tu servicio es mañana' creada en las últimas 6h (`route.ts:56-63`). No hay unique constraint; `Notification` no tiene columna marker/type (`schema.prisma:529-542`). La notificación real la crea downstream `notifyBookingReminder`, asi que el string de dedup debe quedar byte-idéntico a lo que ese helper escribe.
- Escenario de fallo real: marketing ajusta el texto del título del recordatorio en `notifyBookingReminder` pero no el literal en `route.ts:59`. El `findFirst` de dedup nunca matchea, asi que cada run de 15 minutos dentro de la ventana de 30 minutos reenvía los recordatorios de 24h y 1h 2-4 veces a cliente y tasker — spam de notificaciones y emails duplicados.
- Consecuencia operacional (dinero/booking/confianza): spam de notificación + email a cliente/tasker, o (si los títulos drift al revés) recordatorios silenciosamente nunca enviados llevando a no-shows. Impacto de confianza moderado.
- Fix recomendado: agregar una columna marker estable a `Notification` (p.ej. `dedupeKey String? @unique`) y escribir una key determinística como `reminder:{bookingId}:{hoursUntil}`. Que el cron haga `upsert`/`createMany` con `skipDuplicates` sobre esa key dentro del mismo path que envía, eliminando la heurística de título-string + ventana de tiempo por completo.

### G37 — `refresh-mp-tokens` deshabilita al tasker ante CUALQUIER excepción de refresh, incluyendo errores OAuth transitorios de MP
- Dominio: async-jobs-cron
- Archivos:
  - `src/lib/account-cleanup-processor.ts:144-187`
  - `src/lib/payments/providers/mercadopago.ts:223-250`
- Comportamiento actual: `refreshExpiringMpTokens` envuelve `refreshMercadoPagoToken` en try/catch; ante CUALQUIER error lanzado fija `mpAccountStatus=DISABLED` y notifica al tasker para reconectar (`account-cleanup-processor.ts:165-180`). `refreshMercadoPagoToken` lanza ante `!response.ok` O `access_token` faltante (`mercadopago.ts:239-241`), lo que incluye 5xx de MP, 429, y errores de red — no solo un refresh token genuinamente revocado.
- Escenario de fallo real: el endpoint OAuth de MP devuelve 503 durante el run diario. Cada tasker cuyo token expira dentro de 7 dias es marcado DISABLED y emailado 'reconecta tu MercadoPago'. Caen de la búsqueda y pierden bookings hasta que cada uno re-vincula manualmente, aunque sus tokens estaban bien.
- Consecuencia operacional (dinero/booking/confianza): taskers activos removidos erróneamente del marketplace -> GMV perdido para ellos y la plataforma, carga de soporte de taskers confundidos, churn. Auto-infligido ante un blip de tercero.
- Fix recomendado: deshabilitar solo ante errores que indican un grant permanentemente inválido (error MP `invalid_grant` / 400 con ese body, o HTTP 401). Ante 429/5xx/red lanzar, dejar `mpAccountStatus=ACTIVE` y contar como `result.failed` para que el siguiente run diario reintente; agregar un umbral de reintentos-excedidos antes de deshabilitar. Hacer que `refreshMercadoPagoToken` lance un error tipado portando el HTTP status para que el processor pueda ramificar.

### G38 — El cliente no puede reseñar en el path común de auto-confirm (review gateado a `COMPLETED`, pero el auto-confirm aterriza en `PAYOUT_SCHEDULED`)
- Dominio: marketplace-trust
- Archivos:
  - `src/app/api/marketplace/reviews/route.ts:36-38`
  - `src/lib/payouts-processor.ts:130-139`
  - `src/app/api/marketplace/bookings/[bookingId]/customer-confirm/route.ts:49`
- Comportamiento actual: el POST de review del cliente rechaza salvo que `booking.status === 'COMPLETED'`. El cron de 24h solo fija `COMPLETED` cuando MP reporta el pago 'approved' (`payoutStatus PAID`); de lo contrario fija `PAYOUT_SCHEDULED`. `customer-confirm` también transiciona `AWAITING_CUSTOMER_CONFIRMATION -> PAYOUT_SCHEDULED` (no `COMPLETED`).
- Escenario de fallo real: el cliente confirma vía el botón customer-confirm (status pasa a `PAYOUT_SCHEDULED`), luego intenta calificar al pro y recibe 'Solo puedes reseñar reservas finalizadas'. La reseña se pierde silenciosamente; `ratingsCount` queda bajo y el ranking de búsqueda se queda sin datos.
- Consecuencia operacional (dinero/booking/confianza): volumen de reseñas sistemáticamente deprimido -> `ratingAvg` poco confiable usado en el sorting de búsqueda; señal de confianza mas débil; los pros no pueden construir reputación; los clientes se sienten ignorados.
- Fix recomendado: permitir reseñas cuando el status sea `COMPLETED` O `PAYOUT_SCHEDULED` (servicio entregado + pago en vuelo), o introducir un flag `reviewable` dedicado. Actualizar el check de `reviews/route.ts` línea 36 para incluir `PAYOUT_SCHEDULED`.

### G39 — La agregación de rating corre en una transacción pero no es isolation-safe; reseñas concurrentes pueden escribir un `ratingAvg` stale
- Dominio: marketplace-trust
- Archivos:
  - `src/app/api/marketplace/reviews/route.ts:46-75`
  - `prisma/schema.prisma:248-260`
- Comportamiento actual: dentro de `prisma.$transaction` el código crea la `Review`, luego re-agrega TODAS las reviews del pro (`tx.review.aggregate where booking.proId`) y escribe `ratingAvg`/`ratingsCount` via `updateMany`. El comentario afirma que esto arregla la race del audit.
- Escenario de fallo real: dos clientes distintos del mismo pro envían reseñas en el mismo instante. Ambos agregados cuentan N reviews existentes; ambos escriben `ratingsCount=N+1` (en vez de N+2), y `ratingAvg` se computa desde N+1 reviews. El rating mostrado queda permanentemente off-by-one hasta la siguiente review (y aun entonces puede driftear de nuevo). Default Postgres es READ COMMITTED; poner el aggregate en la misma tx NO lo serializa sin `SELECT ... FOR UPDATE` o isolation Serializable.
- Consecuencia operacional (dinero/booking/confianza): ratings y conteos públicos inexactos que dirigen el ranking de búsqueda y la confianza del cliente. Drift de datos difícil de detectar; un pro podría aparecer con menos/peores reviews que la realidad (o viceversa).
- Fix recomendado: correr el recompute bajo isolation Serializable (`prisma.$transaction(fn,{isolationLevel:'Serializable'})` con retry ante conflicto) y lockear la fila del profile (`SELECT ... FOR UPDATE` sobre `ProfessionalProfile`), o reemplazar el re-aggregate completo con un update incremental atómico: `ratingsCount = {increment:1}` y una columna de suma corriente actualizada con `{increment: rating}`, computando `avg = sum/count`. El enfoque incremental es race-free sin locking.

---

## LOW

### G40 — El hold de slot no se re-valida atómicamente en checkout contra el hold vivo de otro usuario
- Dominio: booking-integrity
- Archivos:
  - `src/app/api/bookings/slot-hold/route.ts:42-65`
  - `src/app/api/bookings/checkout/route.ts:129-170`
  - `src/app/api/bookings/checkout/route.ts:324-338`
- Comportamiento actual: `slot-hold` usa un `updateMany` condicional (solo toma el slot si `holdExpiresAt` es null/expirado o el hold es del caller), previniendo correctamente holds concurrentes y devolviendo 409. Checkout re-chequea `slot.isAvailable` y luego dentro de la tx hace `SELECT ... FOR UPDATE` sobre `isAvailable=true` antes de fijar `isAvailable=false`, serializando correctamente checkouts concurrentes sobre el mismo slot. Sin embargo, checkout nunca verifica que `holdExpiresAt`/`heldByUserId` pertenezca al cliente que compra — solo chequea `isAvailable`.
- Escenario de fallo real: el usuario A tiene el slot S (`holdExpiresAt` futuro, `heldByUserId=A`). El usuario B, que nunca lo tuvo, corre un checkout para S; como `isAvailable` sigue true, el `SELECT FOR UPDATE` de B tiene éxito y B lo reserva, derrotando el hold de A. A termina su wizard y recibe un 409. Dentro del diseño esto es 'el primero que paga gana', pero hace que la UX del hold sea mentira.
- Consecuencia operacional (dinero/booking/confianza): bajo riesgo financiero (solo un booking tiene éxito, sin doble cargo) pero pobre UX/confianza: un cliente que 'reservó' un slot por 5 minutos puede perderlo ante un pagador mas rápido. Los holds dan confianza falsa.
- Fix recomendado: en el guard `FOR UPDATE` de checkout, requerir también que el hold pertenezca al comprador o esté unset/expirado: extender el WHERE del raw query a `("heldByUserId" = ${customerId} OR "holdExpiresAt" IS NULL OR "holdExpiresAt" < now())`, devolviendo el mismo 409 de lo contrario. Esto hace el hold realmente protector durante su ventana.

### G41 — `check-in` / `on-the-way` mutan el booking sin `assertTransition` (reglas de transición duplicadas en arrays hardcodeados)
- Dominio: booking-integrity
- Archivos:
  - `src/app/api/marketplace/bookings/[bookingId]/check-in/route.ts:71-110`
  - `src/app/api/marketplace/bookings/[bookingId]/on-the-way/route.ts:40-55`
- Comportamiento actual: `check-in` gatea sobre una lista hardcodeada `VALID_STATUSES` y `paymentStatus=PAID`, luego computa `nextStatus` via `canTransition(...,'PRO')` cayendo al status actual; actualiza el status dentro de una tx pero no hace `assertTransition` (tolera quedarse en el mismo status). `on-the-way` gatea sobre `VALID_STATUSES` y solo escribe `onTheWayAt` (sin cambio de status). Son funcionalmente seguros hoy por los allow-lists explícitos.
- Escenario de fallo real: si alguien luego agrega un nuevo `BookingStatus` o cambia el state machine, el array `VALID_STATUSES_FOR_CHECK_IN` hardcodeado en check-in no se actualizará en lockstep, permitiendo un check-in (y transición `IN_PROGRESS`) desde un estado que la máquina central prohibiría, p.ej. tras introducir un estado de partial-refund.
- Consecuencia operacional (dinero/booking/confianza): actualmente bajo; principalmente un riesgo de mantenibilidad/consistencia que podría volverse un bug de integridad a medida que los estados evolucionen. Fotos/geo podrían adjuntarse a bookings en estados inesperados.
- Fix recomendado: reemplazar los arrays hardcodeados `VALID_STATUSES` con `assertTransition`/`canTransition` contra el state machine central (la transición a `IN_PROGRESS` ya existe para `CONFIRMED`/`ACCEPTED`). Mantener el guard `paymentStatus=PAID`. Esto hace al state machine la única fuente de verdad para toda ruta que cambie status.

### G42 — `payout/request` crea un Payout pero el booking sigue en `AWAITING_CUSTOMER_CONFIRMATION`, generando un Payout potencialmente competidor con el cron
- Dominio: booking-integrity
- Archivos:
  - `src/app/api/marketplace/bookings/[bookingId]/payout/request/route.ts:22-69`
  - `src/lib/payouts-processor.ts:108-127`
- Comportamiento actual: `payout/request` (pro/admin) permite crear un Payout cuando el status es `AWAITING_CUSTOMER_CONFIRMATION` o `PAYOUT_SCHEDULED`, guardado por `Payout.bookingId @unique` y un check de existencia. Crea `Payout(PENDING)` pero NO cambia `Booking.status`. Por separado, `processBookingsForPayout` para `AWAITING_CUSTOMER_CONFIRMATION` reusa `booking.payout` si está presente (`payouts-processor.ts:110-119`), asi que la unique constraint previene una fila duplicada.
- Escenario de fallo real: el pro pega a `payout/request` justo tras marcar el trabajo hecho (y tras dejar una review). Existe un `Payout PENDING`. El cron de 24h luego lo paga basándose en la heurística approved. Si el cliente estaba por abrir una disputa en el dia 2, la disputa ahora colisiona con un payout ya `PAID` (`DISPUTE` desde `PAYOUT_SCHEDULED` permitido, pero los fondos pueden ya estar liberados).
- Consecuencia operacional (dinero/booking/confianza): bajo (sin filas duplicadas gracias a `@unique`) pero el path no coordinado de payout-request amplía la ventana donde los fondos se liberan antes de respetar la ventana de confirmación/disputa del cliente. Principalmente un tema de consistencia de política.
- Fix recomendado: eliminar el endpoint `payout/request` iniciado por el pro (confiar solo en `customer-confirm` + cron), o hacer que solo agende (no habilite `PAID`) y asegurar que la ventana de disputa se respete completamente antes de cualquier release. Documentar el único path canónico de payout y hacer que los demás sean no-ops que converjan en él.

### G43 — Rutas SMS muertas `phone/send` + `phone/verify` aun fijan `phoneValidatedAt=null` y pueden re-romper el submit
- Dominio: provider-onboarding
- Archivos:
  - `src/app/api/onboarding/cleaning/phone/send/route.ts:61-71`
  - `src/app/api/onboarding/cleaning/phone/verify/route.ts:34-42`
  - `src/app/api/onboarding/cleaning/submit/route.ts:53,313-326`
  - `src/app/trabaja-con-nosotros/registro/page.tsx:672,705,1126`
- Comportamiento actual: la verificación SMS fue removida de la UI: las rutas start/me auto-fijan `phoneValidatedAt` a `new Date()` (`start/route.ts:66`, `me/route.ts:206`) y la página registro solo lee `phoneValidatedAt`. Pero la ruta `phone/send` aun existe y, al ser POSTeada, corre una transacción que fija `cleaningOnboarding.phoneValidatedAt = null` (`send/route.ts:70`). `submit/route.ts` requiere `phoneValidatedAt` no-null (`listMissingFields línea 53`). `phone/verify` aun fija `currentStep:Math.max(.,9)` (`verify/route.ts:41`), stale respecto a la nueva numeración de 12 pasos.
- Escenario de fallo real: un tasker (o un build de cliente cacheado viejo, o un retry/automatización) pega a `POST /api/onboarding/cleaning/phone/send`. `phoneValidatedAt` se borra a null. El tasker ya no puede hacer submit ('Faltan campos obligatorios: phoneValidatedAt') y no hay path de UI para re-validar el teléfono porque el paso SMS fue removido — quedan atascados y deben contactar soporte.
- Consecuencia operacional (dinero/booking/confianza): bloqueo silencioso de onboarding para taskers afectados; carga de soporte; supply de proveedores perdido. Baja probabilidad (sin caller de UI) pero molesto y confuso de diagnosticar.
- Fix recomendado: eliminar las rutas `phone/send`, `phone/verify` y `phone/claim` (y variantes públicas) ahora que SMS fue removido, O cambiar `phone/send` para que ya no nulifique `phoneValidatedAt`. Como mínimo, remover la escritura `data:{phoneVerificationCodeHash..., phoneValidatedAt:null}` para que el endpoint no pueda regresar la elegibilidad de submit.

### G44 — La generación de `AvailabilitySlot` no tiene uniqueness en DB; syncs concurrentes disparados por búsqueda pueden crear slots duplicados
- Dominio: provider-onboarding
- Archivos:
  - `src/lib/tasker-publication.ts:392-479`
  - `src/app/api/marketplace/search-professionals/route.ts:389-408`
- Comportamiento actual: `syncTaskerAvailabilitySlotsFromOnboarding` construye slots próximos desde `availabilityBlocks`, lee `existingSlots`, deduplica in-memory via un Set de keys `startsAt-endsAt` (`tasker-publication.ts:459-462`), luego `createMany`. No hay unique constraint en `(professionalProfileId, startsAt, endsAt)`. `search-professionals` invoca este sync lazy para cualquier perfil con cero slots (`search route 389-408`), y corre en cada request de búsqueda relevante sin lock.
- Escenario de fallo real: dos clientes buscan la misma categoría/comuna casi al mismo tiempo para un tasker recién activado que tiene `availabilityBlocks` pero aun no slots materializados. Ambos requests pasan el check `slots.length===0`, ambos leen `existingSlots` vacío, ambos pasan el dedupe in-memory, ambos `createMany` las mismas 6 semanas de slots. El tasker ahora tiene slots duplicados para horas idénticas.
- Consecuencia operacional (dinero/booking/confianza): slots duplicados inflan la disponibilidad, pueden permitir que dos clientes cada uno 'tome' un slot de la misma hora via filas distintas (el `FOR UPDATE` de checkout lockea un único slot id, asi que una fila duplicada queda disponible), arriesgando doble-booking del proveedor para la misma hora. La limpieza requiere dedup manual.
- Fix recomendado: agregar una unique constraint en `AvailabilitySlot(professionalProfileId, startsAt, endsAt)` y usar `createMany({ skipDuplicates: true })`, o envolver el read-then-create en una transacción con row lock / advisory lock keyed por `professionalProfileId` para que los syncs concurrentes se serialicen.

### G45 — La expiración de token mid-lifecycle (entre cargo y payout de 24h) no se re-valida proactivamente; payouts `PROCESSING` sin escalación
- Dominio: payments-mercadopago
- Archivos:
  - `src/lib/account-cleanup-processor.ts:112-159`
  - `src/lib/payouts-processor.ts:78-101`
- Comportamiento actual: `refreshExpiringMpTokens` corre (diario) y refresca tokens que expiran dentro de 7 dias, solo para `mpAccountStatus==='ACTIVE'`. El processor de payout usa `booking.pro.mpAccessToken` al momento del payout sin re-chequear expiración; si expira solo atrapa el error de MP y deja el `Payout PROCESSING` (líneas 98-101).
- Escenario de fallo real: el token de un tasker expira y el refresh diario no corrió / falló. Múltiples bookings quedan en `PROCESSING` payout a través de varios ciclos de cron sin alerta al operador, asi que los taskers silenciosamente no cobran.
- Consecuencia operacional (dinero/booking/confianza): payouts retrasados/atascados para taskers afectados; sin breach de SLA visible.
- Fix recomendado: agregar un umbral de max-retry/edad sobre payouts `PROCESSING` que escale a una alerta al admin y al tasker, e intentar un refresh de token on-demand dentro de la ruta de payout antes de rendirse.

### G46 — Los side-effects de payout `PAID` (notificación + email) corren fuera de la transacción sin compensación
- Dominio: async-jobs-cron
- Archivos:
  - `src/lib/payouts-processor.ts:107-212`
- Comportamiento actual: la transacción (líneas 108-174) fija `Payout PAID`, `Booking COMPLETED`, `Payment RELEASED`, y crea la notificación in-app del cliente. Tras el commit, `notifyPayoutReleased` (líneas 188-199) envía el email del tasker + otra notificación; los fallos solo se loggean (catch -> logError). El comentario (líneas 184-187) acepta entradas de feed duplicadas. Es idempotente por booking porque `Payout.bookingId` es `@unique`.
- Escenario de fallo real: el run voltea el booking a `PAID`/`COMPLETED` en la tx, luego el proveedor de email hace 500; logError lo registra pero no hay retry. El tasker está `COMPLETED`/`PAID` en la DB pero nunca recibe el email de payout, y como la DB ahora dice `PAID` el siguiente cron omite re-notificar.
- Consecuencia operacional (dinero/booking/confianza): notificaciones de payout perdidas ocasionalmente sin path de recuperación; bajo impacto financiero pero un paper-cut de confianza. Mayormente una nota de correctness sobre G7/G20.
- Fix recomendado: dirigir las notificaciones desde un outbox durable (escribir una fila `NotificationOutbox` dentro de la tx, entregar via un paso/cron idempotente separado) para que un fallo transitorio de email se reintente en vez de perderse, y para que el email se envíe solo una vez confirmado el release real (ver G7).

### G47 — `customer-confirm` y el cron de payout pueden correr en race sobre el mismo booking (sin row lock alrededor de la transición)
- Dominio: marketplace-trust
- Archivos:
  - `src/app/api/marketplace/bookings/[bookingId]/customer-confirm/route.ts:48-99`
  - `src/lib/payouts-processor.ts:68-180`
- Comportamiento actual: tanto `customer-confirm` como `processBookingsForPayout` leen el booking, asiertan la transición `AWAITING_CUSTOMER_CONFIRMATION->PAYOUT_SCHEDULED`, luego en una tx upsertean el `Payout` (findUnique-then-create) y actualizan el booking. `Payout.bookingId` es `@unique`, lo que previene una fila Payout duplicada.
- Escenario de fallo real: en T+24h el cron dispara mientras el cliente también pulsa Confirmar. Ambos proceden; un `Payout.create` choca con la unique violation. El cliente recibe un 400 genérico 'No se pudo confirmar' aunque el servicio sí está agendado, o el pro recibe notificaciones duplicadas 'pago programado'.
- Consecuencia operacional (dinero/booking/confianza): notificaciones duplicadas confusas y un error spurio cara al usuario; sin pérdida financiera gracias a la unique constraint, pero ruido de soporte.
- Fix recomendado: envolver el read+transition+payout en una única tx con row lock (`SELECT booking ... FOR UPDATE` via `$queryRaw` o usar `updateMany` con guard de status: update where id AND status=AWAITING_CUSTOMER_CONFIRMATION, y tratar `count===0` como 'ya manejado' en vez de error). Hacer la creación de Payout un upsert idempotente keyed en `bookingId` en ambos paths.

### G48 — El fallback de header-auth permite spoofing de actor (auto-review / abrir disputa como la otra parte) fuera de producción
- Dominio: marketplace-trust
- Archivos:
  - `src/lib/auth.ts:47-70`
  - `src/app/api/marketplace/reviews/route.ts:19-21`
  - `src/app/api/marketplace/bookings/[bookingId]/pro-review/route.ts:35`
- Comportamiento actual: `getRequestIdentity` devuelve la identidad desde una cookie firmada. Si está ausente, en `NODE_ENV!=='production'` Y `ALLOW_HEADER_AUTH==='true'`, confía en los headers crudos `x-user-id` / `x-user-role`. Las rutas de review luego chequean `identity.userId` contra `booking.customerId`/`proId`.
- Escenario de fallo real: en un entorno staging seedeado con datos realistas (o un prod mal configurado con `ALLOW_HEADER_AUTH=true`), un pro forja headers de identidad de cliente y postea reviews de 5 estrellas de sus propios bookings completados, inflando el `ratingAvg` usado por el ranking de búsqueda.
- Consecuencia operacional (dinero/booking/confianza): manipulación de rating / señales de confianza falsas si el flag se habilita fuera de dev confiable; de lo contrario contenido en dev.
- Fix recomendado: garantizar que `ALLOW_HEADER_AUTH` nunca pueda ser true en ningún deployment alcanzable por internet (asertar en un startup check que es false salvo `NODE_ENV==='test'`). A largo plazo, remover header auth de request-identity por completo e inyectar una identidad de test solo en el harness de tests.

### G49 — `Payout PROCESSING` por expiración de token / sin escalación tras N reintentos (variante async-jobs)
- Dominio: async-jobs-cron
- Archivos:
  - `src/lib/account-cleanup-processor.ts:112-159`
  - `src/lib/payouts-processor.ts:78-101`
- Comportamiento actual: confía en un refresh de fondo que corre diariamente; un token puede seguir expirado en el momento exacto de la llamada de payout, y la única recuperación es `PROCESSING` indefinido sin escalación tras N reintentos.
- Escenario de fallo real: el token de un tasker expira y el refresh diario no corrió / falló. Múltiples bookings quedan en `PROCESSING` payout a través de varios ciclos de cron sin alerta al operador, asi que los taskers silenciosamente no cobran.
- Consecuencia operacional (dinero/booking/confianza): payouts retrasados/atascados; sin breach de SLA visible.
- Fix recomendado: agregar un umbral max-retry/edad sobre payouts `PROCESSING` que escale a alerta al admin y al tasker, e intentar un refresh de token on-demand dentro del path de payout antes de rendirse.

---

## Tabla de conteo por severidad

| Severidad | Gaps | IDs |
|-----------|------|-----|
| CRITICAL | 9 | G1, G2, G3, G4, G5, G6, G7, G8, G9 |
| HIGH | 15 | G10, G11, G12, G13, G14, G15, G16, G17, G18, G19, G20, G21, G22, G23, G24 |
| MEDIUM | 15 | G25, G26, G27, G28, G29, G30, G31, G32, G33, G34, G35, G36, G37, G38, G39 |
| LOW | 10 | G40, G41, G42, G43, G44, G45, G46, G47, G48, G49 |
| **Total** | **49** | — |

Nota: el dominio `provider-onboarding` incluye un hallazgo `production-ready` (gate de payout MP correctamente aplicado en search/availability/checkout) y el dominio `async-jobs-cron` incluye un hallazgo `production-ready` (verificación de firma QStash + aislamiento por item + idempotencia de Payout). Ambos tienen severidad `none` y no constituyen brechas operacionales, por lo que no se numeran arriba pero se documentan como controles que NO deben "arreglarse".
