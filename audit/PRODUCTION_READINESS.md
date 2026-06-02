# PRODUCTION_READINESS.md

## Verdict

**Not production-ready.** OK for an invite-only beta with no real money flowing, provided the **CRITICAL** items in [SECURITY_ANALYSIS.md](SECURITY_ANALYSIS.md) and [PAYMENTS_ANALYSIS.md](PAYMENTS_ANALYSIS.md) are fixed first.

## Per-environment checklist

### Local / development
- ✅ `npm run dev`, Prisma `db push`, seed via `prisma:seed`.
- ✅ Email / SMS / MP gracefully no-op if creds absent.
- ⚠️ Header-auth backdoor active when `ALLOW_HEADER_AUTH=true`.

### Staging
- ⚠️ Same code as prod minus env. Demo data still seeds.
- ⚠️ Verification code echo in API response if `NODE_ENV !== "production"` (set explicitly on Railway preview).

### Limited beta
- Mandatory before this stage:
  - Fix C1–C5 (see SECURITY_ANALYSIS).
  - Disable `/api/marketplace/demo` endpoint.
  - Gate `ensureMarketplaceDemoData` behind `SEED_ON_BOOT` env.
  - Rate-limit `/api/auth/*` and `/api/onboarding/public/phone/*`.
  - Wire `Sentry` for error tracking.

### Public launch
- Mandatory:
  - Switch to versioned Prisma migrations (`prisma migrate deploy`).
  - Implement payout settlement.
  - Implement dispute → real refund.
  - Move file uploads off the DB.
  - Add CSP and other security headers.
  - Add admin audit log.
  - CI with `npm run lint`, `tsc --noEmit`, and integration tests for payment flows.

### Scale (>1 000 active users)
- Cache layer for catalog.
- Pool/proxy for Prisma.
- Realtime layer.
- Backups + restore drill.
- Observability (logs/metrics/traces).

## Environment management

`.env.example` declares the following variables:
```
DATABASE_URL
PRIMARY_ADMIN_EMAIL, PRIMARY_ADMIN_PASSWORD, PRIMARY_ADMIN_FULL_NAME
NEXT_PUBLIC_APP_URL, APP_URL
GOOGLE_MAPS_API_KEY
SESSION_SECRET
RESEND_API_KEY, RESEND_FROM_EMAIL
ADMIN_ONBOARDING_ALERT_EMAILS
MERCADOPAGO_ACCESS_TOKEN, NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY
TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, TWILIO_MESSAGING_SERVICE_SID
SMS_CODE_PREVIEW
```

**Missing safeguards:**
- No `process.env.SESSION_SECRET` validation at startup — falls back to `"dev-insecure-change-me"`.
- No `ALLOW_HEADER_AUTH` documented in `.env.example` (it should be explicitly listed and forbidden in prod).
- No `NODE_ENV` listed — Railway sets it automatically.
- `SMS_CODE_PREVIEW="0"` default is good; nothing prevents `"1"` in prod.

## Migrations

- `prisma db push --accept-data-loss` runs on every deploy (`package.json:13` + `railway.json:7`).
- **No `prisma/migrations/` directory** — no migration history.
- The current working tree has `prisma/schema.prisma` deleted. A naive deploy from this branch would fail Prisma generate; a recovered partial schema could destroy data.
- No backup/restore documented anywhere in the repo.

## Logging & observability

- `console.log/info/error` only.
- ~9 log call sites (per agent report): `notifications.ts`, `booking-status-email.ts`, a handful of client pages.
- No request id, no correlation id, no structured fields, no log shipper.
- No Sentry, no Datadog, no OpenTelemetry, no Honeycomb.
- `/api/health` returns `{ ok: true, service: "wetask", timestamp }` and **does not check DB or providers** ([src/app/api/health/route.ts](../src/app/api/health/route.ts)). The Railway health probe will report green even if Postgres is offline.

## Monitoring

- No metric collection. No alerting. No SLOs.

## Retries

- HTTP calls to MP/Resend/Twilio use a single `fetch()` call. No `p-retry`, no exponential backoff.
- Webhook handler returns 400 on error; MP retries automatically.
- Email sends are `void`-fired — no DLQ.

## Background processing & queues

- None.
- `payouts/process-timeouts` is a manual POST.
- No cron, no Inngest, no QStash, no BullMQ, no SQS.

## Backups

- Not configured in the repo (would be at Railway level).
- No backup verification routine.
- No PITR / WAL archival mentioned.

## CI / CD

- No `.github/workflows/` directory.
- Railway auto-deploys on push to the connected branch.
- No PR checks. No required reviews. No automated tests. No lint gate.

## Tests

- Zero `*.test.*` / `*.spec.*` files in the repo.
- No `jest.config`, no `vitest.config`, no `playwright.config`.

## Deployment

- Railway NIXPACKS builder ([railway.json](../railway.json)).
- Start command: `npm run prisma:push && npm run start` — destructive on every deploy.
- `restartPolicyType: "ON_FAILURE"`, `maxRetries: 10`. If `prisma db push` repeatedly fails (e.g. divergent prod schema), the container will crash-loop ten times.

## Rollback strategy

- None visible. Re-deploying a previous commit would re-run `prisma db push` against the current schema — meaning rolling back code without rolling back schema may fail.

## Secrets management

- Plain env vars on Railway (no SOPS, no Vault, no Doppler integration in the repo).
- No rotation procedure.

## Data privacy

- PII columns: `User.fullName`, `User.email`, `User.phone`, `User.birthDate`, `Address.*`, `CleaningOnboarding.documentId`, `bankAccount*`, identity images.
- No data retention policy in code.
- No GDPR/LGPD/CL-19628 deletion endpoint.
- No consent log beyond `User.termsAcceptedAt`.

## Concrete blockers before "limited beta"

1. Remove `/payment/confirm` simulated path **or** fix it.
2. Remove `/api/auth/oauth` **or** wire real token verification.
3. Remove legacy unsigned cookie acceptance.
4. Hard-fail on missing `SESSION_SECRET` in production.
5. Restrict `serverActions.allowedOrigins` to actual origin.
6. Restore `prisma/schema.prisma` to the working tree and switch to `prisma migrate deploy`.
7. Make demo seeding opt-in.
8. Disable header-auth in production.

## Concrete blockers before "public launch"

In addition to the above:
- Real payout settlement.
- Real dispute refund.
- Webhook signature verification + idempotency table.
- Object storage for identity files.
- Sentry / error tracking.
- Rate limiting.
- Backups verified.
- CI with type-check + lint at minimum.
- Admin audit log.
