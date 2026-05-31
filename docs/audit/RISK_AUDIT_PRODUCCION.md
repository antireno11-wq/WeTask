# Auditoría de Riesgos para Producción — WeTask

> Revisión a nivel de **código real** (no documental) de todos los flujos de cara a producción.
> Fecha: 2026-05-31. Estado del repo: `main` post-cierre de gaps operacionales G1–G9.
> Los hallazgos marcados ✅ fueron verificados leyendo el código directamente.

## Veredicto

**NO está listo para producción.** Hay **bypass total de autenticación**, **fuga de documentos de identidad/antecedentes penales** en un endpoint público, y **rutas de creación/lectura de reservas sin ninguna autorización**. Cualquiera de estos por sí solo es bloqueante. El núcleo de pagos (escrow, idempotencia de webhook, payouts en 2 fases) está bien diseñado, pero tiene fugas de dinero en refunds y un posible fallo de sincronización de estado.

Conteo: **11 CRÍTICOS**, ~23 ALTOS, ~20 MEDIOS, resto BAJOS.

---

## P0 — BLOQUEANTES (arreglar antes de exponer a internet)

### 1. AUTH-01 ✅ — Login sin contraseña vía `userId` (apropiación total de cualquier cuenta, incl. ADMIN)
`src/app/api/auth/login/route.ts:30,72-94`
Si el body trae `userId`, **todo el bloque de verificación de contraseña y email (líneas 72-94) se salta**. `POST /api/auth/login {"userId":"<id>"}` devuelve una cookie de sesión válida sin contraseña. Los `userId` se filtran en decenas de respuestas (pros, mensajes, reviews, listados). Enviando el `userId` de un admin se obtiene sesión admin.
**Fix:** Eliminar el camino de login por `userId`. Login = email + contraseña (o token OAuth verificado) **siempre**. Si algún flujo interno necesitaba `userId`, va por otro endpoint autenticado que nunca emita sesión sin prueba de identidad.

### 2. AUTH-02 / AUTH-03 / AUTH-04 — Sesión y autorización admin falsificables
`src/lib/security.ts:6-13,39-65`, `src/lib/auth.ts:24-69`, `src/middleware.ts:86-101`
- **Secreto de sesión con fallback `"dev-insecure-change-me"`** fuera de producción. Si `NODE_ENV` no es exactamente `production` en un entorno accesible, cualquiera firma su propia cookie con `role:"ADMIN"`.
- **`ALLOW_HEADER_AUTH`**: si está `true` (y no es prod), `getRequestIdentity` confía en headers `x-user-id`/`x-user-role` → ADMIN con solo enviar un header. Backdoor que depende de 2 env vars.
- **El middleware autoriza `/api/admin/**` leyendo el rol de la cookie**, sin re-validar en DB. La autorización entera depende de un único secreto HMAC + de que el rol de la cookie sea confiable.
**Fix:** Fallar el arranque si `SESSION_SECRET` no está presente en **cualquier** entorno servible (no solo prod). Validar `header.alg==="HS256"` y usar `timingSafeEqual`. Eliminar `ALLOW_HEADER_AUTH` o protegerlo con un secret adicional. Re-validar rol admin contra DB en los endpoints sensibles (ya existe `requireAdminRequest`; aplicarlo en todos).

### 3. BOOK-01 / BOOK-08 ✅ — `/api/bookings` (GET y POST) sin autenticación
`src/app/api/bookings/route.ts:8-45,47-96` y `src/app/api/bookings/public/route.ts`
- `GET /api/bookings?customerId=X` (o `?proId=X`) devuelve **todas las reservas de cualquier usuario** (direcciones, montos, contraparte) → fuga masiva de PII por IDOR.
- `POST /api/bookings` crea reservas con `customerId` arbitrario (spam de reservas fantasma).
- `POST /api/bookings/public` hace `user.upsert` por email → permite **sobrescribir nombre/teléfono de cualquier cliente** existente enviando su email.
**Fix:** Exigir identidad (`getRequestIdentity`) y `customerId === identity.userId` (salvo ADMIN), como ya hace `checkout/route.ts:71`. En el flujo público, separar "crear lead" de "mutar usuario": nunca actualizar un `User` existente con datos no verificados. Si estas rutas legacy ya no se usan, **borrarlas**.

### 4. PRO-02 ✅ — Endpoint público filtra documentos de identidad y antecedentes penales
`src/app/api/marketplace/pros/[proId]/route.ts:7,23-24,50-52`
GET público (sin auth) que devuelve `user.email`, `user.phone` y las storage keys de `identityDocumentFrontFile`, `identityDocumentBackFile`, `criminalRecordFile`. Enumerando `proId` se extrae teléfono/email de todos los taskers y la existencia/estructura de sus documentos de cédula y antecedentes. Incumple Ley 19.628 (datos sensibles).
**Fix:** Crear un serializador público de perfil con lista blanca de campos (nombre, foto, comuna, servicios, rating). Nunca devolver email/teléfono/documentos en respuestas públicas. Filtrar por `isVerified=true` + estado `ACTIVO`.

### 5. PRO-01 ✅ — Auto-verificación de taskers sin aprobación admin
`src/lib/tasker-publication.ts:319-347` (invocada desde `pro/categories` POST y `pro/slots/sync`)
El `professionalProfile.upsert` hardcodea `isVerified:true` / `verificationStatus:"APPROVED"` en create **y** update, sin mirar el estado del onboarding. Un usuario PRO puede dispararlo (p.ej. añadiendo una categoría) y quedar "verificado" saltándose la revisión humana (KYC, antecedentes, datos bancarios). El listado `GET /api/marketplace/pros` filtra solo por `isVerified`.
**Fix:** Derivar `isVerified`/`verificationStatus` del estado real del onboarding (replicar `onboarding-tasker-services.ts:54-61`, que sí lo condiciona a APROBADO/ACTIVO). El único punto que sube a verificado debe ser la acción `approve`/`activate` del admin. Unificar las dos funciones `sync` con reglas divergentes.

### 6. PAY-02 ✅(lógica) — Doble refund posible
`src/app/api/admin/payments/refund/route.ts:40-90`
No hay guarda `if (payment.status === REFUNDED)`. La única protección es `assertTransition`, pero `canTransition` devuelve `true` cuando `from===to` (`booking-state-machine.ts:90`), así que `REFUNDED→REFUNDED` pasa y se ejecuta un **segundo refund real** contra MP. Dos requests = doble devolución.
**Fix:** Guarda temprana `if (payment.status === REFUNDED) return 409`. Enviar `X-Idempotency-Key` en `refundMercadoPagoPayment`.

### 7. PAY-03 — Refund total tras escrow liberado, sin clawback
`src/app/api/admin/payments/refund/route.ts:76-110`
El refund admin devuelve el monto **total** al cliente y está permitido desde `PAYOUT_SCHEDULED`, donde el escrow puede estar ya `RELEASED` (dinero en la cuenta del tasker). No verifica `payment.escrowStatus` ni crea `PayoutClawback`. La plataforma cubre de su bolsillo la parte ya pagada al tasker.
**Fix:** Si `escrowStatus==="RELEASED"`, crear `PayoutClawback` por el monto liberado y/o limitar el refund automático al application_fee que la plataforma sí controla. Setear `escrowStatus="REFUNDED"` en el refund (hoy queda inconsistente).

### 8. PAY-04 — Tokens de MercadoPago almacenados en claro
`src/app/api/payments/mp/oauth/callback/route.ts:55-67`
`mpAccessToken`/`mpRefreshToken` se guardan sin cifrar en `User`. Permiten mover dinero en la cuenta MP del tasker. Un dump/backup/SQLi en otro endpoint = compromiso financiero de todos los taskers.
**Fix:** Cifrar at-rest con AES-GCM (clave en env/KMS), descifrar solo en memoria al usar. No seleccionar estos campos en queries que no los necesiten.

### 9. PAY-01 — Webhook/reconcile consultan el pago con el token equivocado (verificar contra el modelo MP usado)
`src/app/api/payments/webhook/mercadopago/route.ts:128`, `src/lib/payouts-processor.ts:404`
El pago se **crea** con el token del collector (tasker) pero el webhook y `reconcilePendingPayments` lo **leen** con el token de la plataforma (`getMercadoPagoPayment`). En el modelo marketplace de MP, un `payment.id` de la cuenta del vendedor puede no ser consultable con el token de la plataforma → el webhook sincroniza como `pending` y el booking nunca pasa a `CONFIRMED` por webhook. Hoy funciona porque el checkout síncrono setea el estado; un pago `in_process` que se aprueba después quedaría colgado con el dinero cobrado.
**Fix:** Resolver primero el `Payment` por `external_reference`/`bookingId`, obtener el access token del collector y usar `getMercadoPagoMarketplacePayment(id, collectorToken)` (patrón que ya usa `processBookingsForPayout`). **Validar el comportamiento real con una notificación de prueba de MP antes de cerrar.**

### 10. UX-01 — Códigos de verificación / tokens de reset renderizados en la UI
`src/app/registro/page.tsx:90-94,171-172,331-333`, `src/components/login-role-panel.tsx:133-137,175-179`
El cliente renderiza `verificationTokenPreview`/`codePreview`/`tokenPreview` sin ningún gate de entorno; confía en que el backend solo los mande sin email configurado. Si el flag se desconfigura en prod, el código de verificación de email o el token de reset aparecen en pantalla → bypass de verificación / toma de cuenta.
**Fix:** No incluir estos campos en el payload de la API en producción, y en el cliente no renderizarlos salvo `NODE_ENV !== "production"`.

---

## P1 — ALTOS (arreglar en la primera ola post-lanzamiento o antes si hay tiempo)

### Autenticación
- **AUTH-05** — El reset de contraseña **no invalida las sesiones existentes** (JWT stateless de 7 días sin revocación) ni los otros tokens de reset pendientes. Un atacante con sesión activa la conserva tras el reset de la víctima. → Añadir `passwordChangedAt`/`sessionVersion` a la cookie y rechazar sesiones previas; invalidar todos los reset tokens del usuario en la misma tx. `src/app/api/auth/password/reset/route.ts:31-36`
- **AUTH-06** — Rate limiting **falla abierto**: sin Upstash configurado o si Upstash falla, `rateLimit` devuelve `success:true`. Además `register`, `verify/request` y `verify/confirm` **no tienen rate limit** → el código de verificación de 6 dígitos es fuerza-bruteable. `src/lib/rate-limit.ts:88-104`
- **AUTH-07** — Enumeración de usuarios: login devuelve `404 "Usuario no encontrado"` vs `401 "Credenciales inválidas"`; register responde `409 "Ese correo ya existe"`. → Mensaje y status únicos. `login/route.ts:58-88`

### Reservas
- **BOOK-02** ✅ — **Doble reserva del mismo slot**: no existe constraint único sobre `bookedSlotId`; la exclusión depende solo del flag `isAvailable` + `FOR UPDATE`, y el hold no se valida dentro de la tx de checkout (el hold puede "robarse" al pagar). → Añadir índice único parcial sobre `bookedSlotId IS NOT NULL` y validar `heldByUserId`/`holdExpiresAt` dentro de la tx. `schema.prisma:333,394`, `checkout/route.ts:324-338`
- **BOOK-04** — `customer-confirm` salta `COMPLETED` (solo el cron lo setea al liberar escrow), y `reviews`/`pro-review` exigen `status==="COMPLETED"` → **reviews bloqueadas** hasta que se libere el escrow (días). Además devuelve la fila pre-update. → Permitir review desde `PAYOUT_SCHEDULED`. `customer-confirm/route.ts:35-78`
- **BOOK-05** ✅ — Se puede **completar sin check-in real**: check-in es opcional, sus coordenadas no se comparan con la dirección, y `checkOutAt` (única señal anti-fraude del auto-payout) se setea sin verificación. → Exigir `checkInAt` antes de check-out/complete; validar geo dentro de radio. `complete/route.ts:30-49`, `check-in/route.ts`
- **BOOK-06** — **Disputas múltiples** sin unicidad; `COMPLETED→DISPUTE` permitido sin límite → un usuario puede spamear disputas y bloquear indefinidamente el payout. La ventana de reclamo no aplica si `checkOutAt` es null. → Rechazar si ya hay ticket OPEN/IN_REVIEW; acotar la ventana con otro ancla temporal. `disputes/route.ts:73-101`

### Pagos
- **PAY-05** — Webhook acepta `unverifiable` si falta `MERCADOPAGO_WEBHOOK_SECRET` y no es prod; y no valida `body.type==="payment"`. → Fallar deploy si falta el secret con credenciales MP reales; filtrar por tipo. `webhook/route.ts:42-103`
- **PAY-06** — Refund parcial sin validar `amount <= payment.amountClp` ni acumulado de refunds previos → over-refund. `refund/route.ts:18-21`
- **PAY-07** — `disconnect` de MP no verifica payouts/escrow pendientes → dinero del tasker atrapado eternamente en `PROCESSING`. `mp/oauth/disconnect/route.ts:14-24`
- **PAY-08** — Race condition payout vs refund: el cron lee candidatos fuera de la tx y no re-bloquea dentro → doble disposición del mismo dinero. → `SELECT ... FOR UPDATE` dentro de la tx y abortar si cambió el estado. `payouts-processor.ts:84-235`
- **PAY-09** — **Ninguna llamada a MercadoPago tiene timeout** → un MP colgado cuelga el checkout (cargo posible sin booking) o el cron. → `AbortSignal.timeout(10000)` en `mpRequest`. `providers/mercadopago.ts`

### Onboarding / Pro
- **PRO-03** — Verificación SMS **efectivamente bypasseada**: el registro marca `phoneValidatedAt = now()` con solo teclear el número; los endpoints SMS existen pero no se llaman. → Decidir: cablear SMS de verdad o eliminar el código muerto. `onboarding/cleaning/start/route.ts:64-66`
- **PRO-04** — `GET /api/marketplace/pros` muestra perfiles solo por `isVerified` (sin estado ACTIVO) y expone `email`. `pros/route.ts:37-58`
- **PRO-05** — Verificación de OTP SMS **sin límite de intentos** → fuerza bruta del código de 6 dígitos. `onboarding/.../phone/verify/route.ts`
- **PRO-06** — `cleaning/phone/send` (autenticado) **sin rate limit** → gasto ilimitado de saldo Twilio (toll fraud). El endpoint público sí lo tiene; replicarlo. `cleaning/phone/send/route.ts:11-59`
- **PRO-07** — El límite de tamaño de subida **no se aplica** (presign PUT solo firma ContentType; `sizeBytes` es opcional y client-side) → subida de archivos enormes al bucket. → `createPresignedPost` con `content-length-range`. `lib/storage/r2.ts:118-130`
- **PRO-08** ✅(riesgo TZ) — Slots de disponibilidad generados con `setHours` en hora local del proceso (UTC en prod) → toda la disponibilidad publicada queda corrida 3-4h respecto a Chile. → Construir fechas en `America/Santiago`. `tasker-publication.ts:63-68`
- **PRO-09** — `getClientIp` confía en `X-Forwarded-For` sin validar → rate-limit por IP evadible (agrava SMS pumping). `rate-limit.ts:110-116`

### Admin / Infra / GDPR
- **ADM-01** ✅ — `/api/maps/autocomplete` y `/validate-address` **sin auth ni rate-limit** → bucle `?input=...` quema la cuota facturable de Google Maps. → Rate-limit + sesión + restringir la API key en Google Cloud. `maps/autocomplete/route.ts`
- **ADM-02** — `/api/health` (público) devuelve `err.message` crudo de la conexión a Postgres y enumera env vars faltantes. → Solo `status` en prod. `health/route.ts:33-56`
- **ADM-03** — `/api/admin/payments/health` autoriza con el rol de la cookie (no `requireAdminRequest`) → privilegio persistente hasta 7 días tras revocar el rol. `admin/payments/health/route.ts:8-12`
- **ADM-07** — El **borrado de cuenta GDPR no toca `CleaningOnboarding`**: deja cédula, fotos de carnet, antecedentes penales y datos bancarios intactos tras el "borrado". Incumple el derecho de supresión. `lib/account-cleanup-processor.ts:59-90`

### UX
- **UX-02** — "Confirmar servicio" sin `disabled`/loading → doble confirmación (dispara payout). `cliente/reservas/[bookingId]/page.tsx:188-203`
- **UX-03** — Panel pro queda **en blanco** si falla la sesión/carga (errores tragados con `catch {}`), sin redirect a login ni spinner. `pro/page.tsx:392-425`
- **UX-04** — Detalle de reserva: pantalla casi vacía con `data.detail` técnico crudo si falla el fetch. `cliente/reservas/[bookingId]/page.tsx`
- **UX-05** — Links a taskers "fallback" (`/pro/fallback-0`) → 404 en el primer punto de conversión. `solicitar-tecnico/page.tsx:213-227`
- **UX-12** — Total de checkout calculado en el **cliente** (`subtotal*0.12`); si el backend redondea distinto, se muestra un monto y se cobra otro. → Quote autoritativo del backend. `reservar/page.tsx:275-279`

---

## P2 — MEDIOS / pulido

**Transversales (afectan a varios flujos, arreglar de una vez):**
- **Fugas de `error.message` al cliente** en casi todos los `catch` (register, login, oauth, leads, support, pros, etc.) → fingerprinting del schema. Mapear a mensajes genéricos y loggear server-side.
- **`ALLOW_HEADER_AUTH` / `NODE_ENV`** aparecen como vector en auth, booking y admin: asegurar `NODE_ENV=production` en todos los deploys servibles y eliminar/blindar el header-auth.
- **Rate-limit fail-open**: para scopes de coste (OTP, login) degradar a limiter en memoria o fallar cerrado.
- **Zona horaria Chile**: `scheduledAt`/slots sin normalizar a `America/Santiago`; validar `startsAt > now`. (BOOK-13, PRO-08, PRO-11)

**Otros medios:** BOOK-09 (slot bloqueado por pago `pending` hasta 48h), BOOK-10 (holds sin tope → DoS de agenda), BOOK-11 (crons aceptan `unverifiable` fuera de prod), BOOK-12 (recordatorios idempotencia frágil), BOOK-14/PAY-10 (`travelFeeClp` del cliente sin validar; fee no aplica sobre extras), BOOK-15 (chat sin rate-limit + filtro de contacto evadible), PRO-10/12/13/14, ADM-04/05/08/09/10/11, UX-07/08/09/10/11/13/15.

**Bajos / cosmético:** PAY-12/13/14/16, AUTH-13/14/15, BOOK-16/17/18/19, PRO-15/16/17/18, ADM-12/13, UX-16/17/18/19 (incl. voseo es-AR mezclado con es-CL).

---

## Lo que está BIEN (no tocar, sirve de referencia del estándar a replicar)

- **Idempotencia del webhook MP**: `ProcessedWebhookEvent` con unique `(provider,eventId)` insertado dentro de la misma tx que la mutación, con manejo de P2002 y rollback. Diseño correcto.
- **Firma `x-signature` del webhook**: HMAC-SHA256 con `timingSafeEqual` y manifest correcto.
- **Crons protegidos por firma QStash** (HS256, `timingSafeEqual`, valida exp/nbf/body, rechaza en prod sin key).
- **Payout en 2 fases** respetando `money_release_date`, `Payout.bookingId @unique`, clawback para refunds post-liberación, auto-confirm exige `checkOutAt` real + hold de 72h.
- **Idempotencia del checkout** (`Payment.idempotencyKey @unique` + key determinística + replay) y `SELECT ... FOR UPDATE` del slot con rollback.
- **Reconciliación resiliente**: no marca FAILED pagos jóvenes (48h) ni cancela por fallo de transporte MP.
- **Autorización por propiedad en endpoints `marketplace/*`** (a diferencia de los legacy `/api/bookings`): verifican `identity.userId === booking.proId/customerId`.
- **Hashing bcrypt cost 12**, tokens de reset/verify hasheados (sha256) en DB con uso único y expiración, `password/forgot` no enumera.
- **`requireAdminRequest`** re-valida rol contra DB (patrón correcto a generalizar). Logger redacta secretos. Todo Prisma parametrizado (sin SQL injection). Borrado escalonado con grace de 30 días.
- **Frontend**: `error.tsx` global con Sentry, idempotencyKey estable en checkout, AbortController+debounce en autocomplete, `calificar` protegido server-side.

---

## Plan de ejecución sugerido

**Sprint 0 (bloquea producción) — los 11 P0.** Empezar por AUTH-01, BOOK-01, PRO-02, PRO-01 (cambios pequeños y de altísimo impacto), luego AUTH-02/03/04 (config de secretos + middleware), luego los de pagos (PAY-02/03/04/01) y UX-01.

**Sprint 1 — P1 de seguridad/dinero:** AUTH-05/06/07, BOOK-02/05/06, PAY-05..09, PRO-03..09, ADM-01/02/03/07.

**Sprint 2 — P1 de UX + P2 transversales:** UX-02..12, fugas de `error.message`, TZ Chile, rate-limit fail-open, crons.

**Sprint 3 — P2/P3 restantes y pulido.**

**Antes de cada despliegue, checklist de entorno:** `NODE_ENV=production`, `SESSION_SECRET` presente y fuerte, `ALLOW_HEADER_AUTH` ausente, `MERCADOPAGO_WEBHOOK_SECRET` presente, Upstash configurado, API key de Google restringida.
