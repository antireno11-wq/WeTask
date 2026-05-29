# SECURITY_ANALYSIS.md — Findings with severities

Severities: **CRITICAL** (immediate money loss / account takeover possible) · **HIGH** (privilege escalation / data exfil possible) · **MEDIUM** (abuse / spam / DoS / sensitive disclosure) · **LOW** (defence-in-depth gap).

---

## CRITICAL

### C1 — OAuth identity spoofing
- **File:** `src/app/api/auth/oauth/route.ts:32-65`
- **Issue:** The route trusts client-provided `provider`, `email`, `fullName` and creates/upserts the user, then issues a signed session cookie. No id-token verification, no nonce, no provider call.
- **Impact:** Any unauthenticated POST with `{"provider":"GOOGLE","email":"<victim>","fullName":"x","acceptTerms":true}` results in a session for the victim. Combined with the saved-payment-method APIs, an attacker can buy services on stored cards. Targeting `PRIMARY_ADMIN_EMAIL` yields admin access.
- **Fix:** Adopt NextAuth or verify id-token via Google/Apple JWKS before upsert.

### C2 — Simulated payment confirm endpoint
- **File:** `src/app/api/marketplace/bookings/[bookingId]/payment/confirm/route.ts:40-65`
- **Issue:** Authenticated customer can POST and the route sets `paymentStatus="PAID"`, writes `providerPaymentId:"sim_<bookingId>"`, and transitions booking to `CONFIRMED`. No payment-method validation, no MercadoPago call.
- **Impact:** Free bookings. Tasker performs the service unpaid.
- **Fix:** Delete the route, or replace with a flow that calls `getProviderPayment` and refuses unless MP returned `approved`.

### C3 — Default `SESSION_SECRET`
- **Files:** `src/lib/security.ts:31`, `src/lib/security.ts:40`, `src/middleware.ts:39`
- **Issue:** `process.env.SESSION_SECRET || "dev-insecure-change-me"`. If env missing in any environment, every session token is forgeable.
- **Impact:** Full session forgery → admin takeover → arbitrary refunds.
- **Fix:** Throw at startup if `SESSION_SECRET` is unset in production; remove the fallback constant.

### C4 — Legacy unsigned-JSON cookie accepted
- **Files:** `src/middleware.ts:18-28`, `src/lib/auth.ts:24-34`
- **Issue:** If the signed-cookie path fails, both code paths fall back to JSON-parsing the cookie and accepting `{userId, role}` without any signature.
- **Impact:** A client that sets `wetask_session={"userId":"admin-id","role":"ADMIN"}` becomes admin.
- **Fix:** Delete `decodeLegacySessionCookie` / `safeParseSessionCookie` (the unsigned variant).

### C5 — Dispute "refund" never refunds
- **File:** `src/app/api/marketplace/admin/disputes/route.ts:71-83`
- **Issue:** Admin resolves a dispute with `refundAmountClp`. The route sets DB booking to `REFUNDED` and payment to `PARTIAL_REFUNDED` but does **not** call MercadoPago. The customer's money stays with the platform.
- **Impact:** Chargebacks, regulatory exposure, support cost.
- **Fix:** Call `refundProviderPayment("MERCADOPAGO", {providerPaymentId, amount: refundAmountClp})` and only persist `REFUNDED` after a successful provider response.

---

## HIGH

### H1 — Header-auth backdoor
- **File:** `src/lib/auth.ts:66-78`
- **Issue:** When `ALLOW_HEADER_AUTH=true`, callers can set `x-user-id` and `x-user-role` headers to claim any identity.
- **Impact:** Single env flag flip = full bypass.
- **Fix:** Hard-disable in any non-development build (`if (process.env.NODE_ENV === "production") return ...`).

### H2 — Server actions accept all origins
- **File:** `next.config.mjs:5`
- **Issue:** `experimental.serverActions.allowedOrigins: ["*"]`. Server actions can be invoked from any origin.
- **Impact:** CSRF + cross-origin server-action abuse.
- **Fix:** Restrict to `process.env.NEXT_PUBLIC_APP_URL`.

### H3 — Inconsistent admin guard
- **Files:** `src/lib/admin-access.ts` (strong) vs. most admin routes (weak)
- **Issue:** Only `/api/admin/team` and `/api/admin/users/[userId]` use `requireAdminRequest` (cookie + DB cross-check). `/api/admin/payments/refund`, `/api/marketplace/admin/disputes`, `/api/marketplace/payouts/process-timeouts`, `/api/admin/onboarding/cleaning` use only `hasRole(identity.role, ADMIN)`.
- **Impact:** A forged session cookie or a stale ADMIN session passes the weak check.
- **Fix:** Unify on `requireAdminRequest`.

### H4 — Webhook lacks signature verification
- **File:** `src/app/api/payments/webhook/mercadopago/route.ts:24-32`
- **Issue:** Reads `data.id` from query or body, fetches the payment via server credentials and updates the DB. No `x-signature` check.
- **Impact:** Spoofed webhooks can cause unbounded DB writes and email sends (DoS), although money state is protected by the re-fetch.
- **Fix:** Validate the `x-signature` + `x-request-id` HMAC per MP docs; reject on mismatch.

### H5 — Identity documents stored in DB as base64
- **Files:** `src/lib/validators.ts:302-316`, `CleaningOnboarding.identityDocument*File` columns, `Technician.identityDocument`/`identitySelfie`/`criminalRecordFile`
- **Issue:** Uploaded sensitive PII (national ID front/back, selfie, criminal record) stored as base64 data URLs (up to 8 MB each) in Postgres.
- **Impact:** Backups bloat; in a SQL-level breach, every applicant's documents leak in one shot; no encryption at rest beyond Postgres defaults; no virus scan.
- **Fix:** Upload to S3/R2 with KMS/SSE, store only the object key, sign URLs for the admin viewer.

---

## MEDIUM

### M1 — No rate limiting
- **Files:** `src/app/api/auth/login/route.ts`, `src/app/api/auth/oauth/route.ts`, `src/app/api/auth/password/forgot/route.ts`, `src/app/api/onboarding/public/phone/send/route.ts`, `src/app/api/leads/route.ts`, `src/app/api/support/contact/route.ts`, `src/app/api/coverage-waitlist/route.ts`, `src/app/api/admin/payments/refund/route.ts`
- **Impact:** Credential stuffing, OTP-cost abuse (Twilio bill), spam waitlists/leads.
- **Fix:** Add `@upstash/ratelimit` or Cloudflare Rate Limit Rules at the perimeter.

### M2 — Default `Payment.provider = "STRIPE"`
- **Files:** `audit/_schema_at_HEAD.prisma:408`, `src/app/api/marketplace/bookings/route.ts:340`, `src/app/api/marketplace/bookings/[bookingId]/payment/confirm/route.ts:55`
- **Impact:** Confused data; webhook handler keys on `"MERCADOPAGO"` so STRIPE-tagged rows are ignored by reconciliation logic.
- **Fix:** Change default to `"MERCADOPAGO"`; backfill existing rows; update placeholder code.

### M3 — Verification code echoed in API response (dev)
- **File:** `src/app/api/auth/register/route.ts:317-318`
- **Impact:** If a non-prod Railway preview shares the same UI testers use, codes leak.
- **Fix:** Gate behind a separate `EXPOSE_VERIFICATION_CODES` env var rather than `NODE_ENV !== "production"`.

### M4 — SMS preview leak
- **File:** `src/app/api/onboarding/public/phone/send/route.ts:25,36` per agent report
- **Impact:** `SMS_CODE_PREVIEW` env var causes the OTP to be returned in the response body. Combined with the public route (no auth), creates an oracle for phone enumeration if left enabled in prod.
- **Fix:** Remove the preview from public response; log to server only.

### M5 — Bcrypt 72-byte truncation
- **File:** `src/lib/security.ts:6`
- **Impact:** Long passphrases silently truncated; collision risk; user confusion when their actual password is "anything" past the limit.
- **Fix:** Enforce `password.length <= 64` in validator, or pre-hash with SHA-256 before bcrypt.

### M6 — `dangerouslySetInnerHTML` not surveyed
- Not detected in spot checks, but a full grep is recommended before any client-rendered admin notes / reviews go to production.

### M7 — `Address.country` defaults to `"ES"`
- **File:** `audit/_schema_at_HEAD.prisma:322`
- **Impact:** Latent bug; could affect tax/legal logic if added later.
- **Fix:** Default to `"CL"`.

### M8 — Demo accounts publicly enumerable
- **File:** `src/app/api/marketplace/demo/route.ts`
- **Impact:** Endpoint returns credentials for `cliente-demo@wetask.cl`, `admin-demo@wetask.cl`, etc. Even if the password is "demo", admin demo accounts grant admin role in any environment running the seed.
- **Fix:** Disable in production via env flag.

### M9 — Maps API key handling
- **Files:** `src/app/api/maps/autocomplete/route.ts`, `src/app/api/maps/validate-address/route.ts`, possibly client-side usage
- **Impact:** If the key leaks to client (search confirms `GOOGLE_MAPS_API_KEY` is server-only here, but client usage in `cliente/page.tsx:330` per agent report — needs verification), abuse → bill.
- **Fix:** Constrain key by HTTP referrer and API in Google Cloud console.

---

## LOW

### L1 — `AuthSession` model defined but unused
- No remote logout, no device list, no session revocation.
- Hard to invalidate sessions during incident response.

### L2 — `console.*` only for logs
- No structured logging; correlation between user, request, and effect is manual.

### L3 — No CSP / security headers
- `next.config.mjs` does not configure `headers()`. Missing CSP, X-Frame-Options, Permissions-Policy, Strict-Transport-Security.

### L4 — `errors.detail` field leaks internal messages
- Every route returns `detail: error.message`. Could leak Prisma error texts, DB column names.
- Fix: only leak detail in non-prod.

### L5 — No CAPTCHA on public lead/waitlist/contact forms
- Spam vector.

### L6 — `tsconfig.json` `strict: true` ✅
- `allowJs: false` ✅
- `skipLibCheck: true` (acceptable).

### L7 — `.gitignore` not surveyed for `.env` / `.env.local`
- Worth verifying secrets aren't accidentally committed.

---

## Tally

| Severity | Count |
| --- | --- |
| CRITICAL | 5 |
| HIGH | 5 |
| MEDIUM | 9 |
| LOW | 7 |

The five CRITICAL findings can each cause real money loss or full takeover. Two of them (C1 OAuth, C2 simulated confirm) require no privilege beyond an authenticated user; C3, C4 require either a missing env or one HTTP request setting a custom cookie.
