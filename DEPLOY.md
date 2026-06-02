# WeTask — Runbook de despliegue a producción

Guía ordenada para llevar WeTask a producción (Railway + servicios externos).
Seguir los pasos **en orden**. Marca cada uno al completarlo.

> Estado del código: el repo está production-ready a nivel de seguridad
> (SESSION_SECRET enforced, header-auth deshabilitado en prod, crones con
> firma QStash, demo data gateada, admin guard unificado, rate limiting,
> migrations versionadas, Sentry, boleta electrónica, retención LGPD).
> Lo que falta es **configuración de entorno y un smoke test**.

---

## 0. Pre-requisitos (cuentas externas)

| Servicio | Para qué | Plan mínimo |
| --- | --- | --- |
| Railway | Hosting + Postgres | Hobby/Pro |
| MercadoPago | Pagos + Marketplace OAuth | Cuenta de cobro CL + app developer |
| Resend | Email transaccional | Free tier |
| Twilio | OTP SMS onboarding tasker | Pay-as-you-go |
| Cloudflare R2 | Documentos onboarding | Free tier |
| Upstash | Redis (rate limit) + QStash (crones) | Free tier |
| OpenFactura (Haulmer) | Boleta electrónica SII | Según volumen |
| Sentry | Observabilidad errores | Free tier |
| Google Cloud | OAuth login + Maps | Free tier |

---

## 1. Variables de entorno

Configurar todas en Railway → Variables. Referencia completa en `.env.example`.

### Obligatorias (la app no arranca o falla sin ellas)

- [ ] `DATABASE_URL` — Postgres de Railway (se autoinyecta si usás el plugin).
- [ ] `SESSION_SECRET` — string aleatorio **mínimo 16 chars**. Generar: `openssl rand -base64 32`. **Si falta, el server tira error al boot en prod** (intencional).
- [ ] `NEXT_PUBLIC_APP_URL` — URL pública final (ej. `https://wetask.cl`). Usado para CORS de server actions, redirects OAuth y links de email.
- [ ] `APP_URL` — mismo dominio público.
- [ ] `PRIMARY_ADMIN_EMAIL` / `PRIMARY_ADMIN_PASSWORD` / `PRIMARY_ADMIN_FULL_NAME` — admin sembrado al boot.

### Pagos (obligatorias para cobrar)

- [ ] `MERCADOPAGO_ACCESS_TOKEN` — token de la cuenta de cobro (APP_USR-...).
- [ ] `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` — public key del mismo entorno.
- [ ] `MERCADOPAGO_WEBHOOK_SECRET` — del panel MP → Webhooks → Secret. **Sin esto el webhook devuelve 401 en prod.**
- [ ] `MERCADOPAGO_APP_ID` / `MERCADOPAGO_APP_SECRET` — app developer para Marketplace OAuth (tasker conecta su cuenta).
- [ ] `MERCADOPAGO_OAUTH_REDIRECT_URI` — opcional; si vacío se deriva de `NEXT_PUBLIC_APP_URL`.

### Infra de soporte (obligatorias para funcionar bien)

- [ ] `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — rate limiting. Sin esto el rate-limit es no-op (fail-open) → vulnerable a brute-force.
- [ ] `QSTASH_TOKEN` — para programar crones.
- [ ] `QSTASH_CURRENT_SIGNING_KEY` — **obligatoria en prod**: sin ella los `/api/cron/*` devuelven 401.
- [ ] `QSTASH_NEXT_SIGNING_KEY` — opcional (rotación de keys).
- [ ] `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_ENDPOINT` / `R2_BUCKET` — storage de documentos. Sin esto el onboarding cae a base64 (legacy, no recomendado en prod).
- [ ] `RESEND_API_KEY` / `RESEND_FROM_EMAIL` — emails. Sin esto los emails se omiten (log warn).

### Compliance + comms (recomendadas)

- [ ] `OPENFACTURA_API_KEY` / `OPENFACTURA_RUT_EMISOR` / `OPENFACTURA_AMBIENTE` — boleta electrónica. Sin esto los pagos marcan `boletaStatus="SKIPPED"` (reintentable).
- [ ] `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` — OTP SMS del onboarding tasker.
- [ ] `ADMIN_ONBOARDING_ALERT_EMAILS` — destinatarios de alertas de nuevos taskers.
- [ ] `SUPPORT_EMAIL` / `CONTACT_EMAIL` — destinatario del form de soporte.

### Observabilidad (recomendada)

- [ ] `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` — sin DSN, Sentry no se activa (fail-suave). `SENTRY_ORG` / `SENTRY_PROJECT` solo para upload de source maps.

### Login social + mapas (opcional)

- [ ] `GOOGLE_OAUTH_CLIENT_ID` — login con Google. Sin esto `/api/auth/oauth` devuelve 503.
- [ ] `GOOGLE_MAPS_API_KEY` — geocoding/mapas.

### NUNCA setear en producción

- `SEED_DEMO_DATA` (dejar en `false` o ausente) — sembraría cuentas demo.
- `ALLOW_HEADER_AUTH` — bypass de auth por headers; en prod se ignora igual, pero no lo configures.
- `SMS_CODE_PREVIEW` — expondría códigos OTP en la respuesta.

---

## 2. Base de datos — bootstrap de migrations (UNA sola vez)

El repo usa migrations versionadas (`prisma/migrations/`). Como la DB de prod
fue creada antes con `prisma db push`, el primer deploy con `migrate deploy`
fallaría con "table already exists". Hay que marcar el baseline como aplicado:

```bash
# En el shell de Railway (o con DATABASE_URL apuntando a prod), UNA vez:
npx prisma migrate resolve --applied 0_init
```

Después de esto, `railway.json` ya corre `prisma migrate deploy` en cada deploy.
Detalle en `prisma/migrations/README.md`.

> Si la DB de prod está **vacía** (primer deploy real), saltear el `resolve`:
> `migrate deploy` aplicará `0_init` limpio.

---

## 3. Seed inicial

Una vez la DB tiene schema:

```bash
# Sembrar la versión vigente de Términos y Condiciones + backfill usuarios
node scripts/seed-terms-version-v1.mjs
```

El admin primario se siembra automáticamente al primer boot (vía
`ensurePrimaryAdminUser`).

---

## 4. Webhooks y OAuth en paneles externos

### MercadoPago — Webhook
- [ ] Panel MP → tu app → Webhooks → agregar URL: `https://<dominio>/api/payments/webhook/mercadopago`
- [ ] Eventos: `payment`.
- [ ] Copiar el **Secret** generado → `MERCADOPAGO_WEBHOOK_SECRET`.

### MercadoPago — Marketplace OAuth
- [ ] Panel MP → tu app → Redirect URIs → agregar: `https://<dominio>/api/payments/mp/oauth/callback`

### Google OAuth
- [ ] Google Cloud Console → Credenciales → OAuth Client → Authorized JavaScript origins: `https://<dominio>`.

---

## 5. Crones (QStash schedules)

En el dashboard de Upstash QStash, crear schedules apuntando a cada endpoint
(método POST, con firma automática). Frecuencias sugeridas:

| Endpoint | Frecuencia | Qué hace |
| --- | --- | --- |
| `/api/cron/process-bookings` | cada hora | Libera escrow + crea payouts tras hold 24h |
| `/api/cron/reconcile-payments` | cada hora | Sincroniza pagos PENDING + libera holds de slot expirados |
| `/api/cron/booking-reminders` | cada 15 min | Recordatorios 24h/1h |
| `/api/cron/refresh-mp-tokens` | diario | Refresca tokens MP próximos a expirar |
| `/api/cron/hard-delete-accounts` | diario | Anonimiza cuentas con grace de 30d vencido |

URL completa: `https://<dominio>/api/cron/<endpoint>`.

---

## 6. Smoke test post-deploy

Correr **con cuenta sandbox de MercadoPago** antes de abrir a usuarios reales.
Cada paso debe completar sin error 500 ni estado inconsistente.

1. [ ] **Tasker se registra** → completa wizard → sube documentos (verificar que van a R2, no base64) → submit. Redirige a `/trabaja-con-nosotros/en-revision`.
2. [ ] **Admin recibe email** de nuevo tasker → entra a `/admin/onboarding-limpieza` → revisa → aprueba.
3. [ ] **Tasker recibe email** + entra → ve `/pro/perfil-aprobado` → conecta MercadoPago (OAuth completo, `mpUserId` guardado).
4. [ ] **Tasker configura disponibilidad** en el panel.
5. [ ] **Cliente** entra al home → busca servicio → ve al tasker en resultados (solo aparece si `mpAccountStatus="ACTIVE"`).
6. [ ] **Cliente reserva** con el wizard de 3 pasos → paga con tarjeta sandbox → confirmación con confetti. Verificar `Payment.escrowStatus="HELD"`.
7. [ ] Booking aparece en `/cliente/reservas` y en `/pro/reservas`.
8. [ ] **Tasker hace check-in** (geo del navegador) → cliente recibe email + notificación in-app.
9. [ ] **Tasker hace check-out** → booking pasa a `AWAITING_CUSTOMER_CONFIRMATION`.
10. [ ] **Cliente recibe email** "Califica tu servicio".
11. [ ] **Cliente califica** en `/cliente/reservas/[id]/calificar` → rating se refleja en el perfil público del tasker.
12. [ ] **Forzar el cron de payout** (o esperar): `Payout` pasa a PAID, `Payment.escrowStatus="RELEASED"`, MP sandbox refleja la transferencia, tasker recibe email.
13. [ ] **Verificar boleta**: `Payment.boletaStatus` es `EMITTED` (si OpenFactura configurado) o `SKIPPED` (si no).

Extra:
- [ ] `GET /api/health` devuelve 200 con DB/MP/Resend OK.
- [ ] Provocar un error → aparece en Sentry.
- [ ] `POST /api/payments/webhook/mercadopago` sin firma válida → 401.
- [ ] `POST /api/marketplace/demo` en prod → 404.
- [ ] Intento de brute-force en `/api/auth/login` (>5/min) → 429.

---

## 7. Monitoreo continuo (post-launch)

- [ ] Apuntar un uptime monitor (UptimeRobot / BetterStack) a `GET /api/health` (devuelve 503 si DB/MP caídos).
- [ ] Configurar alertas de Sentry a Slack/email.
- [ ] Configurar backups automáticos de Postgres en Railway (snapshots diarios).

---

## Rollback

Si un deploy rompe producción:
1. Railway → Deployments → redeploy del último deploy estable.
2. Si una migración causó el problema: **no** hay rollback automático de schema. Crear una migración correctiva (`prisma migrate dev --name fix_xxx`) y redeploy. Nunca editar una migración ya aplicada.
