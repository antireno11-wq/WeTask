# Configuración para Producción — WeTask

Guía única para dejar la app lista para recibir pagos reales con el modelo **Marketplace / split** de MercadoPago.
Cada sección dice **qué variable**, **de dónde se obtiene** y el **gotcha** específico de este proyecto.

> ⚠️ **Seguridad:** nunca pegues secretos de **producción** en chats, issues ni los commitees. El archivo `.env`
> está en `.gitignore` (verificado). Si un secreto se expuso, **renuévalo** en el panel correspondiente.

---

## 0. Estado actual (qué falta para producción)

- ✅ Seguridad (P0/P1/P2), flujos no-pago (registro, login, reserva hasta el pago) y lógica de payout: **validados**.
- ⏳ **Gate pendiente:** validar el **pago real + split + webhook + liberación** con MercadoPago (sandbox → prod).
  Esto **solo se puede probar sobre el deploy** (OAuth del vendedor = navegador; webhook = URL pública).

---

## 1. Variables de entorno

Marcar `[x]` a medida que se configuran en Railway.

### Núcleo (obligatorias)
| Variable | De dónde / valor | Notas |
| --- | --- | --- |
| `DATABASE_URL` | Railway Postgres | — |
| `NEXT_PUBLIC_APP_URL` | `https://<tudominio>` | Usada para OAuth redirect y links de email |
| `APP_URL` | `https://<tudominio>` | — |
| `NODE_ENV` | `production` | **Crítico**: activa el modo fail-closed de seguridad |
| `SESSION_SECRET` | string aleatorio ≥ 32 chars | **Obligatoria fuera de dev/test** (si falta, la app no firma sesiones). Generar: `openssl rand -base64 32` |
| `TOKEN_ENCRYPTION_KEY` | string aleatorio ≥ 16 chars | **Obligatoria** (cifra at-rest los tokens MP, PAY-04). Si cambia, los tokens ya cifrados dejan de descifrarse |
| `PRIMARY_ADMIN_EMAIL` | tu correo admin | Crea/asegura el admin principal al boot |
| `PRIMARY_ADMIN_PASSWORD` | clave admin fuerte | — |
| `PRIMARY_ADMIN_FULL_NAME` | nombre admin | — |

### Seguridad — dejar SIN setear en producción
| Variable | Valor en prod |
| --- | --- |
| `SEED_DEMO_DATA` | `false` (o ausente) — si es `true` siembra datos demo |
| `ALLOW_HEADER_AUTH` | ausente — backdoor de tests; en prod se ignora igual, pero no lo pongas |
| `HEADER_AUTH_SECRET` | ausente |

### MercadoPago (6) — ver sección 3
| Variable | De dónde |
| --- | --- |
| `MERCADOPAGO_ACCESS_TOKEN` | App MP → Credenciales de producción → Access Token (`APP_USR-…`) |
| `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | Mismo → Public Key (`APP_USR-…`) |
| `MERCADOPAGO_APP_ID` | El **Client ID** de tu aplicación |
| `MERCADOPAGO_APP_SECRET` | App MP → **Client Secret** |
| `MERCADOPAGO_WEBHOOK_SECRET` | El secret que defines en la sección Webhooks del panel |
| `MERCADOPAGO_OAUTH_REDIRECT_URI` | `https://<tudominio>/api/payments/mp/oauth/callback` |

### Storage R2 (obligatoria — documentos del onboarding)
| Variable | De dónde |
| --- | --- |
| `R2_ENDPOINT` | Cloudflare R2 → endpoint S3-compatible |
| `R2_BUCKET` | nombre del bucket |
| `R2_ACCESS_KEY_ID` | token R2 |
| `R2_SECRET_ACCESS_KEY` | token R2 |

> Sin R2 el tasker **no puede subir cédula/antecedentes** → el onboarding falla al subir documentos.

### Email — Resend (recomendada fuerte)
| Variable | De dónde |
| --- | --- |
| `RESEND_API_KEY` | resend.com → API Keys |
| `RESEND_FROM_EMAIL` | remitente, ej. `WeTask <noreply@tudominio.cl>` |
| `SUPPORT_EMAIL` / `CONTACT_EMAIL` | (opcional) inbox de soporte; si faltan cae a `ADMIN_ONBOARDING_ALERT_EMAILS` |
| `ADMIN_ONBOARDING_ALERT_EMAILS` | correos que reciben alertas de nuevos taskers |

> Resend exige **verificar el dominio** (DNS SPF/DKIM). Sin esto los correos de verificación/confirmación no salen.

### Rate-limit — Upstash Redis (recomendada)
| Variable | De dónde |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` | Upstash → Redis → REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash → Redis → REST Token |

> Sin esto, el rate-limit degrada a memoria (por instancia, no distribuido). Funciona, pero conviene el Redis real.

### Crons — QStash (obligatoria para payouts/recordatorios)
| Variable | De dónde |
| --- | --- |
| `QSTASH_TOKEN` | Upstash → QStash |
| `QSTASH_CURRENT_SIGNING_KEY` | Upstash → QStash → Signing Keys |
| `QSTASH_NEXT_SIGNING_KEY` | Mismo |

### Maps / Google OAuth
| Variable | De dónde |
| --- | --- |
| `GOOGLE_MAPS_API_KEY` | Google Cloud → API key (restringir a Places/Geocoding + referrer) |
| `GOOGLE_OAUTH_CLIENT_ID` | (opcional) login con Google |

### Boleta SII — OpenFactura (opcional al inicio, requerido legalmente)
`OPENFACTURA_API_KEY`, `OPENFACTURA_BASE_URL`, `OPENFACTURA_AMBIENTE`, `OPENFACTURA_RUT_EMISOR`.
La emisión es best-effort (si falla no rompe el pago); se puede lanzar sin ella y agregarla después.

### Errores en producción — Sentry (opcional, recomendado)
`SENTRY_DSN` (o `NEXT_PUBLIC_SENTRY_DSN`). Solo se activa con `NODE_ENV=production`. Ya strippea body/cookies.

---

## 2. Migraciones de base de datos

Aplicar con `prisma migrate deploy` (Railway ya lo corre en cada deploy). Migraciones del repo:

- `0_init`
- `20260531120000_sprint1_security` → añade `User.sessionVersion` + índice único `Booking_bookedSlotId_key`
- `20260531130000_booking_reminder_flags` → añade `reminder24hSentAt` / `reminder1hSentAt`

> ⚠️ El índice único de slot **falla si ya hay 2 bookings sobre el mismo `bookedSlotId`**. En una DB nueva no hay problema (se probó). En una DB con datos, revisar antes.

---

## 3. MercadoPago — setup paso a paso

Modelo: **Marketplace / split payments**. El cliente paga, la plata entra a la cuenta MP **del proveedor**
(menos tu comisión = `application_fee`). La "retención" es el `money_release_date` de MP; tu app adelanta el
estado al confirmar, pero MP libera según su calendario.

### 3.1 En el panel de MercadoPago Developers (cuenta = plataforma WeTask)
1. **App con Marketplace habilitado.** Tu código usa `application_fee` + OAuth de vendedores. Si tu cuenta no
   tiene el modelo marketplace, **solicítalo a MP**.
2. **OAuth** → registrar Redirect URI: `https://<tudominio>/api/payments/mp/oauth/callback`.
   (Es lo que usa cada proveedor para conectar su cuenta desde su panel.)
3. **Webhooks/Notificaciones** → URL: `https://<tudominio>/api/payments/webhook/mercadopago`, evento **Pagos**.
   Copiar el secret → `MERCADOPAGO_WEBHOOK_SECRET`.

### 3.2 Mapeo de credenciales → variables
- **Producción:** Access Token y Public Key `APP_USR-…` de producción; Client ID → `MERCADOPAGO_APP_ID`; Client Secret → `MERCADOPAGO_APP_SECRET`.
- **Sandbox (para probar primero):** mismos `APP_ID`/`APP_SECRET` (son de la app), pero Access Token y Public Key **`TEST-…`**.

### 3.3 Cómo funciona el cobro en el código (referencia)
- Tarjeta nueva: el cardForm tokeniza en el navegador (public key) → el backend cobra en la cuenta del proveedor con `application_fee`.
- Tarjeta guardada: se regenera un **token fresco con CVV** (`mp.createCardToken({ cardId, securityCode })`) — el Customer/tarjeta vive en la cuenta de la plataforma y NO se puede cobrar directo en la del proveedor.
- Webhook (PAY-01): consulta el pago con el **token del collector** (proveedor), no el de la plataforma.

---

## 4. Crones (QStash schedules)

En el dashboard de QStash, crear schedules **POST** (firma automática) a cada endpoint:

| Endpoint | Frecuencia | Qué hace |
| --- | --- | --- |
| `https://<dominio>/api/cron/process-bookings` | cada hora | Libera escrow + crea payouts tras hold |
| `https://<dominio>/api/cron/reconcile-payments` | cada hora | Sincroniza pagos PENDING + libera slots; cierra pending estancados >24h (BOOK-09) |
| `https://<dominio>/api/cron/booking-reminders` | cada 15 min | Recordatorios 24h/1h (idempotente, BOOK-12) |
| `https://<dominio>/api/cron/refresh-mp-tokens` | diario | Refresca tokens MP por expirar |
| `https://<dominio>/api/cron/hard-delete-accounts` | diario | Anonimiza cuentas con grace de 30d vencido |

> Sin los crons: los payouts no se liberan y los pagos pending no se reconcilian.

---

## 5. Guion de prueba SANDBOX (cierra el gate)

Hacerlo **sobre el deploy** con credenciales **TEST** antes de abrir a usuarios reales.

### 5.1 Preparación
1. En Railway: env **TEST** de MP + `NEXT_PUBLIC_APP_URL=https://<dominio>` + el resto de variables.
2. Panel MP → **Cuentas de prueba**: necesitas **dos** test users distintos:
   - una **VENDEDORA** tipo *Marketplace* (la que se conecta por OAuth),
   - una **COMPRADORA** (su email se usa como pagador).
3. Configurar el **Webhook** apuntando al dominio Railway (evento Pagos) con su secret.

### 5.2 Flujo
1. Panel del tasker → **Conectar MercadoPago** → autorizar con la **cuenta vendedora de prueba**. Verificar que se guardó su `mpUserId`/`mpAccountStatus=ACTIVE`.
2. Tasker configura disponibilidad.
3. Como **cliente** (logueado), reserva y paga con **tarjeta de prueba** (ver 5.3). Usar el email de la **cuenta compradora de prueba** como pagador.
4. Verificar la cadena:
   - Pago aprobado → booking `CONFIRMED` (`Payment.escrowStatus="HELD"`).
   - Llega el **webhook** (revisar logs) y sincroniza estado.
   - Cliente confirma el servicio → `PAYOUT_SCHEDULED` + payout `PENDING`.
   - Cuando pase el `money_release_date`, el cron `process-bookings` marca el payout liberado.
5. Probar **tarjeta guardada**: guardar una tarjeta, reusarla → debe pedir **CVV** y cobrar igual (valida la re-tokenización).

### 5.3 Tarjetas de prueba (Chile)
| Tarjeta | Número | CVV | Vto |
| --- | --- | --- | --- |
| Mastercard | 5416 7526 0258 2580 | 123 | 11/30 |
| Visa | 4168 8188 4444 7115 | 123 | 11/30 |
| Amex | 3757 781744 61804 | 1234 | 11/30 |

El **nombre del titular** define el resultado en sandbox: `APRO` = aprobado, `OTHE` = rechazado, `CONT` = pendiente.

### 5.4 Nota sobre el error `Payer email forbidden` (4390)
En sandbox no se puede cobrar usando el token de la cuenta **dueña de la app** como collector, ni con un email
de pagador inventado. El pago de prueba debe ir con el **token del vendedor de prueba** (vía OAuth) como collector
y el **email de un comprador de prueba distinto** como pagador. Por eso este paso se hace por la UI sobre el deploy,
no por API suelta.

### 5.5 Qué quedó validado por API (ya hecho)
- ✅ Access token de plataforma válido.
- ✅ Tokenización de tarjeta de prueba funciona.
- ⏳ Pago aprobado + split + webhook + liberación → pendiente (requiere 5.1–5.2 sobre el deploy).

---

## 6. Checklist final (orden recomendado)

1. [ ] Postgres + `prisma migrate deploy` (2 migraciones nuevas) OK.
2. [ ] Env núcleo: `SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY`, `NODE_ENV=production`, `NEXT_PUBLIC_APP_URL`, admin.
3. [ ] **R2** configurado (onboarding de documentos).
4. [ ] **Resend** + dominio verificado (emails).
5. [ ] **Upstash Redis** (rate-limit) + **QStash** (crons) + schedules creados.
6. [ ] **MercadoPago TEST** + Webhook + cuentas de prueba (vendedor/comprador) → correr guion §5.
7. [ ] Cambiar a **MercadoPago PROD** + un pago real chico de prueba propio.
8. [ ] **Sentry** + revisar logs los primeros días.
9. [ ] Google Maps API key restringida (referrer/IP + solo Places/Geocoding).
10. [ ] Correr el **smoke test** de `DEPLOY.md §6`.
11. [ ] 🔐 Renovar cualquier credencial que se haya expuesto.

---

## 7. Recordatorio de seguridad (fixes que dependen de config)

- `SESSION_SECRET` y `TOKEN_ENCRYPTION_KEY` son **obligatorias** fuera de dev/test (fail-closed). Sin ellas, sesiones/tokens MP no funcionan.
- `MERCADOPAGO_WEBHOOK_SECRET` es **obligatoria** fuera de dev/test para que el webhook acepte notificaciones.
- Los crons exigen firma QStash válida fuera de dev/test.
- No setear `ALLOW_HEADER_AUTH` en producción.
