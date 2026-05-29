# WeTask — Documentación completa del proyecto

> Marketplace chileno de servicios al hogar. Una sola app web con tres roles:
> **CLIENTE** (CUSTOMER), **TASKER** (PRO) y **ADMIN**. Pagos vía MercadoPago
> Marketplace con escrow (el dinero queda retenido hasta que el cliente confirma).
>
> Stack: Next.js 14 (App Router) · Prisma · PostgreSQL · MercadoPago · Resend ·
> Cloudflare R2 · Upstash (Redis + QStash) · Sentry · Railway.
>
> Dominio: https://wetask.cl · Última actualización: 2026-05.

---

## 1. Configuración (qué está montado y dónde)

### Servicios externos

| Servicio | Para qué | Crítico |
|---|---|---|
| **Railway** | Hosting de la app + Postgres + auto-deploy desde GitHub | Sí |
| **PostgreSQL** (Railway) | Base de datos | Sí |
| **MercadoPago** | Cobros + Marketplace OAuth (escrow, split de comisión) | Sí |
| **Resend** | Emails transaccionales | Sí |
| **Cloudflare R2** | Documentos de onboarding (carnet, antecedentes, foto) | Recomendado |
| **Upstash Redis** | Rate limiting (anti fuerza bruta) | Recomendado |
| **Upstash QStash** | Crones (libera pagos, recordatorios, limpieza) | Sí |
| **Sentry** | Monitoreo de errores | Recomendado |
| **Google Maps** | Geocoding / autocompletado de direcciones | Opcional |
| ~~Twilio~~ | ~~SMS~~ — **Removido**: ya no se verifica teléfono por SMS | No |

### Variables de entorno

**Obligatorias:** `DATABASE_URL`, `SESSION_SECRET` (≥16 chars), `NEXT_PUBLIC_APP_URL`,
`APP_URL`, `PRIMARY_ADMIN_EMAIL`, `PRIMARY_ADMIN_PASSWORD`, `PRIMARY_ADMIN_FULL_NAME`.

**Pagos:** `MERCADOPAGO_ACCESS_TOKEN`, `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`,
`MERCADOPAGO_WEBHOOK_SECRET`, `MERCADOPAGO_APP_ID`, `MERCADOPAGO_APP_SECRET`,
`MERCADOPAGO_OAUTH_REDIRECT_URI`.

**Infra:** `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `QSTASH_TOKEN`,
`QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.

**Opcionales:** `GOOGLE_MAPS_API_KEY`, `GOOGLE_OAUTH_CLIENT_ID`, `NEXT_PUBLIC_SENTRY_DSN`,
`SENTRY_DSN`, `OPENFACTURA_*` (boleta SII), `SUPPORT_EMAIL`, `CONTACT_EMAIL`,
`ADMIN_ONBOARDING_ALERT_EMAILS`.

**Nunca en producción:** `SEED_DEMO_DATA`, `ALLOW_HEADER_AUTH`, `SMS_CODE_PREVIEW`.

### Deploy (Railway)

- Auto-deploy en cada push a `main`.
- `scripts/railway-start.sh` corre al arrancar: `prisma db push` (sincroniza schema) →
  seed de `TermsVersion` (idempotente) → `next start`.
- Crones programados en QStash (5 schedules, ver §7).

---

## 2. Modelo de acceso y seguridad

- **Sesión:** cookie `wetask_session` firmada con HMAC-SHA256 (JWT-shape), validada en
  `src/middleware.ts` (Edge) y `src/lib/security.ts` (server). Sin estado server-side.
- **Roles:** `CUSTOMER`, `PRO`, `ADMIN`. El middleware protege rutas por rol:
  - `/cliente/*`, `/reservar/*`, `/booking/*` → CUSTOMER o ADMIN
  - `/pro` → PRO o ADMIN
  - `/admin/*`, `/api/admin/*` → solo ADMIN
  - `/api/marketplace/admin/*` → ADMIN; `/pro/*` → PRO; `/client/*` → CUSTOMER
- **Rate limiting** (Upstash): login, OAuth, reset de contraseña, OTP, refund admin,
  formularios públicos. Falla **abierto** si Upstash no está configurado.
- **Webhook MP:** valida firma HMAC; rechaza 401 sin firma válida en prod.
- **Crones:** validan firma QStash; rechazan 401 sin firma.
- **Idempotencia de webhooks:** tabla `ProcessedWebhookEvent` evita doble procesamiento.
- **Auditoría:** `AdminAuditLog` registra cada acción de admin (refund, disputas, roles).

---

## 3. Modelo de datos (entidades principales)

| Modelo | Rol |
|---|---|
| `User` | Cuenta (CUSTOMER/PRO/ADMIN). Incluye tokens MP del tasker, soft-delete, T&C. |
| `Role` / `UserRoleAssignment` | Roles multi-asignables a un usuario. |
| `Category` / `Service` | Catálogo de categorías y servicios con precio base y comisión. |
| `ProfessionalProfile` | Perfil público del tasker (bio, cobertura, rating). |
| `TaskerService` / `TaskerCategoryProfile` | Servicios y categorías que ofrece cada tasker, con su precio. |
| `AvailabilitySlot` | Bloques de disponibilidad del tasker (con hold temporal). |
| `CleaningOnboarding` | Estado del wizard de alta del tasker + datos KYC + tokens MP. |
| `Booking` | Reserva. Núcleo del sistema (ver state machine §4). |
| `BookingExtra` | Extras de la reserva (materiales, urgencia). |
| `Payment` | Pago de una reserva (estado, escrow, boleta). |
| `Payout` | Liquidación al tasker. |
| `Review` | Calificación del cliente al tasker (y `proReview*` inverso). |
| `DisputeTicket` | Disputa/reclamo de una reserva. |
| `Message` | Chat cliente↔tasker dentro de la reserva. |
| `Notification` | Notificación in-app. |
| `Address` / `CustomerPaymentMethod` | Direcciones y tarjetas guardadas del cliente. |
| `EmailVerificationToken` / `PasswordResetToken` | Tokens de verificación/reset. |
| `AuthSession` | **Reservado** (revocación futura, hoy sin uso). |
| `ServiceLead` / `CoverageWaitlist` | Leads y lista de espera de cobertura. |
| `ProcessedWebhookEvent` / `AdminAuditLog` / `OnboardingReviewEvent` | Idempotencia, auditoría, historial de revisiones. |
| `MercadoPagoOAuthState` | State CSRF del OAuth de MP. |
| `TermsVersion` | Versionado de Términos y Condiciones. |

---

## 4. State machine de reservas (BookingStatus)

Las transiciones están en `src/lib/booking-state-machine.ts` y se validan en cada ruta
que cambia el estado. Actor: `CUSTOMER`, `PRO`, `ADMIN`, `SYSTEM` (webhook/cron).

```
PENDING_PAYMENT ──(SYSTEM: pago aprobado)──► CONFIRMED
PENDING_PAYMENT ──(SYSTEM: pago falla)─────► PAYMENT_FAILED
CONFIRMED ──(PRO)──► ACCEPTED ──(PRO)──► IN_PROGRESS
IN_PROGRESS ──(PRO: check-out)──► AWAITING_CUSTOMER_CONFIRMATION
AWAITING_CUSTOMER_CONFIRMATION ──(CUSTOMER confirma / SYSTEM 24h)──► PAYOUT_SCHEDULED
PAYOUT_SCHEDULED ──(SYSTEM cron libera escrow)──► COMPLETED
AWAITING_CUSTOMER_CONFIRMATION / PAYOUT_SCHEDULED ──(disputa)──► DISPUTE
DISPUTE ──(ADMIN)──► REFUNDED | PAYOUT_SCHEDULED | COMPLETED
* ──(CUSTOMER/PRO/ADMIN según estado)──► CANCELLED
```

Estados que existen en el enum pero **no se escriben** en runtime: `PENDING`,
`DISPUTE_OPEN`, `PAID_OUT` (legacy, no usar).

`PaymentStatus`: PENDING · AUTHORIZED · PAID · FAILED · REFUNDED · PARTIAL_REFUNDED.
`Payment.escrowStatus`: HELD · RELEASED · REFUNDED · CONTESTED.
`PayoutStatus`: PENDING · PROCESSING · PAID · FAILED.
`TicketStatus` (disputas): OPEN · IN_REVIEW · RESOLVED · CLOSED.

---

## 5. Casos de uso — todo lo que se puede hacer

### 5.1 Visitante (sin sesión)
- Ver home, cómo funciona, sobre nosotros, ayuda/soporte, legal/privacidad.
- Explorar catálogo de servicios (`/servicios`, `/servicios/[categoria]`).
- Ver lista de profesionales por categoría (`/servicios/[categoria]/pros`).
- Ver perfil público de un tasker (`/pro/[proId]`).
- Buscar profesionales por comuna/servicio.
- Dejar lead / lista de espera de cobertura / contacto de soporte.
- Registrarse como cliente (`/registro`) o iniciar alta como tasker (`/trabaja-con-nosotros/registro`).

### 5.2 Cliente (CUSTOMER)
- **Crear cuenta** (email+contraseña o Google OAuth), aceptar T&C.
- **Verificar email** (token por correo).
- **Reset de contraseña** (forgot → email → reset).
- **Buscar y reservar** (`/reservar`): elegir servicio → tasker → fecha/hora → dirección
  → pagar. El slot se reserva temporalmente (hold de 5 min).
- **Pagar** con tarjeta (token MercadoPago). El dinero queda en **escrow (HELD)**.
- **Ver sus reservas** (`/cliente`, `/cliente/reservas/[id]`): estado, detalle, ubicación.
- **Chatear** con el tasker dentro de la reserva (con filtro anti-datos-de-contacto).
- **Confirmar servicio terminado** → libera el flujo de payout.
- **Calificar** al tasker (`/cliente/reservas/[id]/calificar`): estrellas + sub-scores + tags.
- **Abrir disputa/problema** (`/cliente/reservas/[id]/problema`).
- **Gestionar tarjetas** guardadas y direcciones.
- **Ver notificaciones** (`/notificaciones`).
- **Exportar sus datos** (`GET /api/me/data-export`) y **eliminar su cuenta**
  (`DELETE /api/me/account`, soft-delete con gracia de 30 días).

### 5.3 Tasker (PRO)
- **Onboarding** (`/trabaja-con-nosotros/registro`): wizard de ~11 pasos —
  teléfono (sin verificación SMS), datos personales + foto + RUT + dirección,
  cobertura (comunas), categoría, experiencia, scope del servicio, disponibilidad,
  tarifas, documentos (carnet frente/dorso + antecedentes) + datos bancarios, T&C.
- **Guardar progreso** (autosave) y reanudar.
- **Enviar a revisión** (`/submit`) → estado PENDIENTE_REVISION → pantalla `/en-revision`.
- Tras aprobación: **ver `/pro/perfil-aprobado`** (celebración) y **conectar MercadoPago**
  (OAuth). Sin MP conectado, **no aparece en búsqueda ni puede recibir reservas**.
- **Panel `/pro`**: resumen, perfil, agenda (disponibilidad), reservas, reseñas, notificaciones.
- **Gestionar disponibilidad** (slots).
- **Sobre una reserva** (`/pro/reservas/[id]`): "voy en camino", check-in (geo),
  check-out (→ AWAITING_CUSTOMER_CONFIRMATION).
- **Solicitar/recibir payout** (se libera automático por cron tras hold).
- **Chatear** con el cliente.

### 5.4 Admin (ADMIN)
- **Dashboard** (`/admin`): KPIs (reservas, ingresos, taskers pendientes, disputas).
- **Cola de onboarding** (`/admin/onboarding-limpieza`): buscar, filtrar, ver detalle
  con documentos (signed URLs), aprobar / pedir corrección / rechazar (con historial).
- **Activar tasker** (sincroniza servicios + disponibilidad al marketplace).
- **Disputas** (`/admin/disputes`): ver, resolver, **reembolsar de verdad** (refund MP real).
- **Usuarios** (`/admin/users`): listar, ver/editar, asignar roles.
- **Equipo** (`/admin/team`): crear miembros del equipo.
- **Reglas de categorías** (comisión, fees).
- **Reembolsos manuales** (`/api/admin/payments/refund`).
- **Disparar payouts** manualmente (`/api/marketplace/payouts/process-timeouts`).
- Toda acción queda en `AdminAuditLog`.

### 5.5 Sistema (crones automáticos)
- **process-bookings** (cada hora): libera escrow + crea payouts tras hold de 24h.
- **reconcile-payments** (cada hora): re-consulta a MP pagos PENDING + libera holds de slot vencidos.
- **booking-reminders** (cada 15 min): recordatorios 24h / 1h antes del servicio.
- **refresh-mp-tokens** (diario): refresca tokens MP próximos a expirar; si falla, desactiva al tasker.
- **hard-delete-accounts** (diario): anonimiza cuentas con grace vencido (preserva Payment/Booking por ley contable).

---

## 6. Flujos end-to-end completos

### Flujo A — Reserva y pago (cliente)
1. Cliente busca servicio → elige tasker → fecha/hora → dirección.
2. `POST /api/bookings/slot-hold` reserva el slot 5 min.
3. `POST /api/bookings/checkout` con token de tarjeta → crea `Booking` (PENDING_PAYMENT)
   + `Payment`. Si el tasker tiene MP, usa **marketplace payment con escrow (HELD)** y
   `application_fee` = comisión. Si no tiene MP → **409** (rechaza).
4. MercadoPago procesa → **webhook** `POST /api/payments/webhook/mercadopago` (firmado)
   → `Payment.status=PAID`, `Booking.status=CONFIRMED`.
5. Cliente ve la reserva confirmada + email.

### Flujo B — Ejecución del servicio (tasker)
1. Tasker: "voy en camino" → notifica al cliente.
2. Check-in (geo) → notifica al cliente.
3. Check-out → `Booking.status=AWAITING_CUSTOMER_CONFIRMATION`.
4. Cliente recibe email "califica tu servicio".

### Flujo C — Confirmación y payout
1. Cliente confirma (o pasan 24h sin reclamo) → `PAYOUT_SCHEDULED`.
2. Cron **process-bookings** libera el escrow en MP → `Payment.escrowStatus=RELEASED`,
   `Payout.status=PAID`, `Booking.status=COMPLETED`.
3. Tasker recibe email "pago liberado".

### Flujo D — Disputa
1. Cliente abre disputa → `Booking.status=DISPUTE`, `DisputeTicket` OPEN.
2. Admin revisa evidencia y resuelve. Si hay reembolso → **refund real en MP** →
   `Payment.status=REFUNDED`. Solo persiste REFUNDED si MP confirmó.

### Flujo E — Alta de tasker
1. Tasker completa wizard → sube docs a R2 → `POST /submit` → PENDIENTE_REVISION.
2. Admin recibe email → revisa → aprueba.
3. Tasker recibe email → conecta MP (OAuth) → aparece en búsqueda → recibe reservas.

---

## 7. Crones (QStash schedules)

| Endpoint | Frecuencia | Qué hace |
|---|---|---|
| `/api/cron/process-bookings` | `0 * * * *` | Libera escrow + payout tras hold 24h |
| `/api/cron/reconcile-payments` | `0 * * * *` | Sincroniza pagos PENDING + libera holds |
| `/api/cron/booking-reminders` | `*/15 * * * *` | Recordatorios 24h/1h |
| `/api/cron/refresh-mp-tokens` | `0 3 * * *` | Refresca tokens MP por expirar |
| `/api/cron/hard-delete-accounts` | `0 4 * * *` | Anonimiza cuentas con grace vencido |

---

## 8. Qué puede fallar si no se previene o no se prueba

> Esta sección es la **base para armar el plan de pruebas**. Cada ítem es un riesgo
> concreto con su prueba sugerida.

### 8.1 Dinero / pagos (RIESGO ALTO)
| Riesgo | Si no se previene | Cómo probar |
|---|---|---|
| Webhook MP sin firma válida aceptado | Alguien marca reservas como pagadas sin pagar | POST al webhook sin firma → debe dar 401 |
| Webhook duplicado procesado dos veces | Doble payout / doble actualización | Reenviar el mismo evento → 2ª vez `{duplicate:true}` |
| Checkout contra tasker sin MP | Pago sin posibilidad de split/escrow | Reservar a tasker sin MP → 409 |
| Escrow nunca liberado | El tasker nunca cobra | Forzar booking >24h y correr cron → Payout PAID |
| Refund de disputa que no refunda | Cliente reclama, no recibe plata | Resolver disputa con monto → MP devuelve; si MP falla, DB no queda REFUNDED |
| Pago queda PENDING (webhook perdido) | Reserva colgada | Cron reconcile lo sincroniza |
| Token MP del tasker expira | Pagos fallan en silencio | Cron refresh-mp-tokens; si falla, tasker DISABLED + notificado |
| Comisión mal calculada | Pérdida de ingresos | Revisar `application_fee` vs `marketplace-pricing` |
| Boleta no emitida (sin OpenFactura) | Incumplimiento SII | `Payment.boletaStatus=SKIPPED` reintentable |

### 8.2 Estados de reserva (RIESGO ALTO)
| Riesgo | Si no se previene | Cómo probar |
|---|---|---|
| Transición ilegal de estado | Reserva en estado inconsistente | Intentar COMPLETED→CONFIRMED → 400 |
| Doble check-in / check-out | Timestamps pisados | Repetir check-in → idempotente o rechazo |
| Cancelar una reserva ya completada | Inconsistencia + plata mal movida | Cancelar COMPLETED → rechazado |
| Confirmar servicio sin check-out | Payout prematuro | Confirmar antes de AWAITING → rechazado |
| Slot hold no se libera | Slot bloqueado para siempre | Abandonar checkout → cron libera a los 5 min |
| Doble reserva del mismo slot | Sobreventa | Dos clientes mismo slot → el 2º falla (hold) |

### 8.3 Autenticación / acceso (RIESGO ALTO)
| Riesgo | Si no se previene | Cómo probar |
|---|---|---|
| Acceso a `/admin` sin ser admin | Takeover de panel | Cliente entra a `/admin` → redirige a login |
| API admin sin sesión | Fuga de datos / acciones | GET `/api/admin/*` sin sesión → 401/403 |
| Cliente accede a reserva de otro | Fuga de datos privados | Pedir booking ajeno → 403/404 |
| Tasker ve datos de otro tasker | Fuga | Pedir perfil/reservas ajenas → 403 |
| Fuerza bruta en login | Cuentas comprometidas | 6+ logins/min → 429 (requiere Upstash) |
| SESSION_SECRET débil/ausente en prod | Cookies falsificables | App debe NO arrancar sin SESSION_SECRET en prod |
| OAuth con id-token falso | Suplantación de identidad | OAuth sin token válido → 401 |
| Reset de contraseña abusado | Spam/enumeración | 3+ forgot/h por email → 429 |

### 8.4 Onboarding tasker (RIESGO MEDIO)
| Riesgo | Si no se previene | Cómo probar |
|---|---|---|
| Submit con campos faltantes | Taskers incompletos en cola | Submit incompleto → lista de campos faltantes |
| Aprobar sin poder publicar | Tasker aprobado pero invisible | Aprobar → sincroniza servicios+slots; si no puede, rechaza approve |
| Documentos no suben a R2 | Onboarding sin KYC real | Subir doc → genera key R2 (no base64) |
| Autosave pierde datos | Frustración / abandono | Cerrar y reabrir → carga lo guardado |
| Tasker sin disponibilidad publicado | Aparece pero no se puede reservar | Aprobar sin slots → no aparece o sin horarios |

### 8.5 Datos / privacidad / compliance (RIESGO MEDIO)
| Riesgo | Si no se previene | Cómo probar |
|---|---|---|
| Tabla faltante en prod (schema drift) | App crashea (ej. TermsVersion) | Signup funciona; `db push` sincroniza al deploy |
| Borrado de cuenta pierde datos contables | Incumplimiento legal | Hard-delete anonimiza pero preserva Payment/Booking |
| Export de datos incompleto | Incumplimiento Ley 19.628 | `/api/me/data-export` devuelve todo |
| T&C sin versionar | No hay prueba de aceptación | `User.termsVersionId` apunta a versión vigente |
| PII en logs | Fuga | Logger redacta passwordHash/tokens/mpAccessToken |
| Chat filtra teléfono/email | Desintermediación | Mensaje con teléfono → bloqueado/filtrado |

### 8.6 Infra / operación (RIESGO MEDIO)
| Riesgo | Si no se previene | Cómo probar |
|---|---|---|
| Cron sin firma QStash aceptado | Cualquiera dispara payouts | POST cron sin firma → 401 |
| Deploy crashea por migración | App caída | `/api/health` 200 tras deploy |
| Email no se envía (Resend caído) | Usuarios sin avisos | Health marca resend; envío con try/catch no rompe flujo |
| DB caída | App inutilizable | `/api/health` devuelve 503 |
| Rate limit falla abierto sin Upstash | Vulnerable a abuso | Confirmar Upstash configurado en prod |
| Demo data en producción | Cuentas falsas visibles | `SEED_DEMO_DATA` ausente; `/api/marketplace/demo` → 404 |

### 8.7 UX / negocio (RIESGO BAJO)
| Riesgo | Cómo probar |
|---|---|
| Búsqueda no filtra por comuna | Buscar en comuna sin cobertura → mensaje claro |
| Precio en vivo no actualiza | Cambiar extras → total se recalcula |
| Notificaciones no marcan leído | Marcar todas → badge desaparece |
| Página rota / 404 | Navegar a URL inexistente → not-found amigable |
| Error 500 no se reporta | Provocar error → aparece en Sentry |

---

## 9. Checklist de smoke test (flujo completo, sandbox MP)

1. [ ] Tasker se registra → completa wizard → sube documentos → submit.
2. [ ] Admin recibe email → revisa en `/admin/onboarding-limpieza` → aprueba.
3. [ ] Tasker recibe email → ve `/pro/perfil-aprobado` → conecta MercadoPago.
4. [ ] Tasker configura disponibilidad.
5. [ ] Cliente se registra → busca servicio → ve al tasker en resultados.
6. [ ] Cliente reserva (wizard 3 pasos) → paga con tarjeta sandbox → escrow HELD.
7. [ ] Booking aparece en `/cliente/reservas` y `/pro/reservas`.
8. [ ] Tasker "voy en camino" → check-in (geo) → cliente recibe email + notificación.
9. [ ] Tasker check-out → booking pasa a AWAITING_CUSTOMER_CONFIRMATION.
10. [ ] Cliente recibe email "califica tu servicio".
11. [ ] Cliente califica → rating visible en perfil del tasker.
12. [ ] Cron de payout libera escrow → Payout PAID + email al tasker.
13. [ ] `Payment.boletaStatus` = EMITTED (si OpenFactura) o SKIPPED.

Checks de seguridad adicionales:
- [ ] `GET /api/health` → 200 con DB/MP/Resend ok.
- [ ] Webhook sin firma → 401. · Demo en prod → 404. · Brute-force login → 429.
- [ ] Rutas admin sin sesión → 401/403.

---

## 10. Tests automatizados existentes

- **Unitarios (Vitest):** `marketplace-pricing`, `booking-state-machine`, `chat-safety`,
  `security`, `communes` (29 tests). Corren en CI en cada push/PR.
- **E2E (Playwright):** 8 suites en `e2e/` — públicas, auth, catálogo, seguridad,
  onboarding, reserva, admin, pro. Los tests autenticados se saltan si no hay credenciales
  (GitHub Secrets). Corren en CI en push a `main` contra staging (`PLAYWRIGHT_BASE_URL`).
- **CI:** `.github/workflows/ci.yml` — typecheck, lint, vitest, build, + job e2e.

### Cómo correr local
```
npm test            # unitarios
npm run e2e         # E2E (requiere server corriendo o PLAYWRIGHT_BASE_URL)
npm run typecheck   # tsc --noEmit
npm run build       # build de producción
```

---

## 11. Archivos clave (mapa rápido)

| Archivo | Qué tiene |
|---|---|
| `src/middleware.ts` | Guards de ruta por rol |
| `src/lib/security.ts` | Hash, sesión, tokens |
| `src/lib/booking-state-machine.ts` | Transiciones de reserva |
| `src/lib/marketplace-pricing.ts` | Cálculo de precio único |
| `src/lib/payments/providers/mercadopago.ts` | Toda la integración MP |
| `src/lib/payouts-processor.ts` | Lógica de payouts/reconciliación |
| `src/lib/account-cleanup-processor.ts` | Hard-delete + refresh tokens |
| `src/lib/notification-events.ts` | Eventos de notificación + email |
| `src/lib/rate-limit.ts` | Rate limiting |
| `src/lib/logger.ts` | Logger estructurado + Sentry |
| `prisma/schema.prisma` | Modelo de datos completo |
| `DEPLOY.md` | Runbook de despliegue |
| `audit/` y `docs/audit/` | Análisis técnico profundo (referencia) |
