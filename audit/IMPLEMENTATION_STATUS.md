# IMPLEMENTATION_STATUS.md — Per-feature maturity matrix

Legend:
- ✅ **REAL** — implementation calls real services, persists durable state, handles errors.
- 🟡 **PARTIAL** — works for happy path but missing key safeguards.
- 🧪 **STUB / SIMULATED** — code path exists but does not do what its name suggests.
- ⛔ **BROKEN / DANGEROUS** — exists but causes bugs or vulnerabilities.
- ⚪ **NOT IMPLEMENTED** — referenced in UI/model but no code.

| Feature | Status | Evidence | Note |
| --- | --- | --- | --- |
| Customer registration (email/password) | ✅ | `src/app/api/auth/register/route.ts` | bcrypt rounds=12, validates terms, sends verification email |
| PRO registration | 🟡 | `src/app/api/auth/register/route.ts:93-117` | Requires identity URL strings only; no actual verification of docs |
| OAuth (Google/Apple) | ⛔ | `src/app/api/auth/oauth/route.ts:32-65` | Accepts client-claimed email — full account takeover surface |
| Login + bcrypt verify | ✅ | `src/app/api/auth/login/route.ts:65-82` | Brute force unbounded (no rate limit) |
| Email verification | ✅ | `src/app/api/auth/verify/{request,confirm}/route.ts` | Real Resend; token hashed (SHA-256) at rest |
| Password reset | ✅ | `src/app/api/auth/password/{forgot,reset}/route.ts` | 30-min token expiry, hashed at rest |
| Session cookie (HMAC) | 🟡 | `src/lib/security.ts:30-56` | Fallback secret `"dev-insecure-change-me"` if env missing |
| Legacy unsigned cookie acceptance | ⛔ | `src/middleware.ts:18-28`, `src/lib/auth.ts:24-34` | Backdoor: middleware accepts plain JSON cookie if signed path fails |
| Header-based auth (`x-user-id`) | ⛔ | `src/lib/auth.ts:66-78` | Active when `ALLOW_HEADER_AUTH=true` — any role spoof |
| Role enforcement in middleware | ✅ | `src/middleware.ts:81-123` | Defence-in-depth combined with per-route checks |
| Admin role double-check (DB) | ✅ | `src/lib/admin-access.ts:21-44` | Solid, but rest of admin endpoints rely on `getRequestIdentity` not `requireAdminRequest` (inconsistent) |
| Primary admin from env | 🟡 | `src/lib/primary-admin.ts:19-61` | Re-hashes password on every login — harmless but wasteful and effectively rotates pw on env change |
| Booking — internal legacy POST | 🟡 | `src/app/api/marketplace/bookings/route.ts:43-356` | No idempotency, no slot lock — race condition |
| Booking — production checkout | ✅ | `src/app/api/bookings/checkout/route.ts` | Real MercadoPago, idempotency key, slot lock in `$transaction`, rollback on provider failure |
| Booking payment confirm — simulated | ⛔ | `src/app/api/marketplace/bookings/[id]/payment/confirm/route.ts:40-65` | Customer can mark PAID with `providerPaymentId: "sim_<id>"` and no charge |
| MercadoPago webhook handler | 🟡 | `src/app/api/payments/webhook/mercadopago/route.ts:24-99` | No signature verification, but re-fetches payment from MP (eventual consistency safety). No idempotency table |
| Refund (admin manual) | ✅ | `src/app/api/admin/payments/refund/route.ts:30-83` | Calls MP refunds API |
| Refund (dispute resolution) | ⛔ | `src/app/api/marketplace/admin/disputes/route.ts:71-83` | Marks booking REFUNDED in DB only — money is **not returned** |
| Payout request | 🟡 | `src/app/api/marketplace/bookings/[id]/payout/request/route.ts` | Creates `Payout` row with `PENDING`. Nothing transitions to `PAID`. |
| Auto-payout sweep | 🟡 | `src/app/api/marketplace/payouts/process-timeouts/route.ts` | ADMIN-only manual POST; no cron, no actual money transfer |
| Payout settlement (bank) | ⚪ | — | No code that pays the tasker their money |
| Booking status state machine | 🟡 | `src/app/api/marketplace/bookings/[id]/status/route.ts:29-37` | Only PRO is constrained; ADMIN can set any status; CUSTOMER has separate routes; no global transition validator |
| Slot locking in checkout | ✅ | `src/app/api/bookings/checkout/route.ts:297-306` | Correct optimistic lock via `updateMany` with `isAvailable: true` filter |
| Slot locking in internal POST | ⛔ | `src/app/api/marketplace/bookings/route.ts:124, 306-354` | Reads `isAvailable`, then writes without locking — double-book |
| Auto-assignment | 🟡 | `src/app/api/marketplace/bookings/route.ts:159-222` | Earliest-time picks first match; no fairness/load balancing |
| Chat / messages | 🟡 | `src/app/api/marketplace/bookings/[id]/messages/route.ts` | Persisted; safety regex; **polled** (no realtime); spaced digits bypass phone filter |
| Chat-safety filter | 🟡 | `src/lib/chat-safety.ts:22-48` | Phone regex requires consecutive digits; emoji/spacing trivially bypasses |
| Reviews — customer | 🟡 | `src/app/api/marketplace/reviews/route.ts` | Aggregation outside `$transaction` — concurrent race |
| Reviews — PRO of customer | ⛔ | `src/app/api/marketplace/bookings/[id]/pro-review/route.ts:42-55` | `upsert` without "only once" guard; can overwrite |
| Disputes — open | 🟡 | `src/app/api/marketplace/disputes/route.ts` | Sets status DISPUTE; does NOT freeze payouts at the data layer |
| Disputes — admin resolution | ⛔ | `src/app/api/marketplace/admin/disputes/route.ts:71-83` | Updates DB only |
| Notifications — DB row | ✅ | `Notification` model + writers across routes | Real persistence |
| Notifications — realtime delivery | ⚪ | — | No websockets, no push, no SSE — relies on polling |
| Email notifications (booking status) | ✅ | `src/lib/booking-status-email.ts`, `src/lib/notifications.ts` | Real Resend send; gracefully skipped if unconfigured |
| SMS OTP (onboarding) | ✅ | `src/lib/twilio-sms.ts:43-91` | Real Twilio; `SMS_CODE_PREVIEW=1` env var leaks code in response (dev only) |
| Push notifications | ⚪ | — | None |
| Availability slot CRUD | ✅ | `/api/marketplace/pro/slots` | Overlap check on new slots |
| Slot sync from onboarding | ❓ | `/api/marketplace/pro/slots/sync` calls `syncTaskerAvailabilitySlotsFromOnboarding` in `src/lib/tasker-publication.ts` (not deep-read) | Unknown idempotency & overwrite semantics |
| Public catalog | ✅ | `/api/marketplace/catalog`, `/api/marketplace/pros` | Always seeds demo data first (see below) |
| Demo data seeding | 🧪 | `src/lib/marketplace-demo-data.ts` (1 184 lines) | `ensureMarketplaceDemoData()` upserts 6 demo pros on every login + every catalog/pros/availability/search request |
| Demo accounts endpoint | 🧪 | `/api/marketplace/demo/route.ts` | Returns demo credentials in plaintext (public) |
| Saved payment methods | ✅ | `/api/marketplace/client/payment-methods`, `src/lib/payments/providers/mercadopago.ts:353-389` | Real MP customer + card APIs |
| Address autocomplete | ✅ | `/api/maps/autocomplete` | Google Places; gracefully skipped if key missing |
| Address validation | ✅ | `/api/maps/validate-address` | Falls back to commune inference |
| Coverage waitlist | ✅ | `/api/coverage-waitlist` | Writes `CoverageWaitlist` |
| Service leads | ✅ | `/api/leads` | Writes `ServiceLead` |
| Support contact | ✅ | `/api/support/contact` | Sends email |
| Technician registration (legacy) | 🟡 | `/api/technicians/register`, model `Technician` | Parallel concept to `ProfessionalProfile`; unclear which is canonical |
| Admin onboarding queue | ✅ | `/api/admin/onboarding/cleaning` + `/admin/onboarding-limpieza` pages | Review + approve flow real |
| Admin team management | ✅ | `/api/admin/team`, `/api/admin/users/[id]` | Grant/revoke + send reset |
| Cleaning onboarding state machine | ✅ | `CleaningOnboardingStatus` enum + page flow | Multi-step persistence works |
| Background jobs / cron | ⚪ | — | None |
| Tests (unit/integration/E2E) | ⚪ | — | None |
| CI/CD | ⚪ | `.github/` absent | None |
| Observability (logs/metrics/traces/errors) | ⚪ | only `console.*` | None |
| Rate limiting | ⚪ | — | None |
| Audit log of admin actions | ⚪ | — | None |
| Receipts / invoices | ⚪ | — | None |
| Refund reconciliation | ⚪ | — | None |
| Webhook idempotency table | ⚪ | — | Relies on DB state checks only |
| File storage (S3 / R2) | ⚪ | base64 in Postgres | Severe scale risk |
| Multi-currency | ⚪ | CLP hardcoded | OK for Chile, not for scale |
| Dark mode | ⚪ | `globals.css` single light theme | None |
| Internationalisation | ⚪ | Spanish hardcoded | None |
