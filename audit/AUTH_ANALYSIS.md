# AUTH_ANALYSIS.md — How auth REALLY works

## Sessions

Cookie name: `wetask_session` ([src/lib/auth.ts:5](../src/lib/auth.ts#L5)).

Set on login:
```ts
response.cookies.set({
  name: SESSION_COOKIE_NAME,
  value: encodeSessionCookie({ userId, role, email, fullName }),
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 7   // 7 days
});
```
([src/app/api/auth/login/route.ts:103-111](../src/app/api/auth/login/route.ts#L103-L111))

Cookie value is a custom JWT-shaped HMAC-SHA256 token:
```ts
header = base64url({alg:"HS256", typ:"JWT"})
body   = base64url({ userId, role, email, fullName, exp })
sig    = HMAC-SHA256(`${header}.${body}`, SESSION_SECRET || "dev-insecure-change-me")
cookie = `${header}.${body}.${sig}`
```
([src/lib/security.ts:30-36](../src/lib/security.ts#L30-L36))

### Critical: default secret
- `SESSION_SECRET || "dev-insecure-change-me"` is duplicated in both Node (`src/lib/security.ts:31,40`) and Edge (`src/middleware.ts:39`).
- If env var is missing in any environment, every session is forgeable.

### Legacy plain-JSON cookie acceptance
- `decodeLegacySessionCookie` in [src/middleware.ts:18-28](../src/middleware.ts#L18-L28) and [src/lib/auth.ts:24-34](../src/lib/auth.ts#L24-L34) accepts a *URL-decoded JSON* `{userId, role}` cookie with no signature.
- If a client sets `wetask_session` to e.g. `{"userId":"abc","role":"ADMIN"}`, the legacy path will accept it.
- Verified: signed path tried first; legacy fallback if signature missing or invalid. **The fallback is a complete authentication bypass when the `wetask_session` cookie is a plain JSON object.**

### Header-auth backdoor
```ts
const allowHeaderAuth = process.env.ALLOW_HEADER_AUTH === "true";
if (!allowHeaderAuth) return { userId: null, role: null };
const userId = req.headers.get("x-user-id");
const rawRole = req.headers.get("x-user-role");
if (rawRole === UserRole.ADMIN || ...) return { userId, role: rawRole, ... };
```
([src/lib/auth.ts:66-78](../src/lib/auth.ts#L66-L78))

This is intended for local/dev. If `ALLOW_HEADER_AUTH=true` ever ships, **any HTTP caller can claim any role/user**.

### `AuthSession` DB model
- Defined ([audit/_schema_at_HEAD.prisma:179-189](../audit/_schema_at_HEAD.prisma#L179-L189)) with `tokenHash`, `expiresAt`, `revokedAt`.
- **No code path ever inserts, queries or revokes an `AuthSession` row.** Logout only clears the cookie. There is no remote logout, no session revocation, no device list.

## Passwords

- Hashed with `bcryptjs`, rounds = 12 ([src/lib/security.ts:4-7](../src/lib/security.ts#L4-L7)).
- Validation: only `password.length >= 8` ([src/app/api/auth/register/route.ts:89-91](../src/app/api/auth/register/route.ts#L89-L91)). No complexity, no breach-list check, no max length (bcrypt 72-byte silent truncation).
- Login compares with `bcrypt.compare` ([src/app/api/auth/login/route.ts:70](../src/app/api/auth/login/route.ts#L70)).

## OAuth — broken

`/api/auth/oauth` accepts JSON `{provider, email, fullName, role, acceptTerms}` and:
1. Performs `prisma.user.upsert` keyed on the **client-provided email**.
2. Sets `emailVerifiedAt: new Date()`.
3. Issues a signed session cookie.

No id-token verification, no `nonce`, no audience check, no provider-side call. **Any unauthenticated POST with `{"provider":"GOOGLE","email":"victim@example.com","fullName":"x","acceptTerms":true}` will create or hijack the matching account.**

If the targeted email is a customer, the attacker can buy services on the victim's MercadoPago saved cards (`/api/marketplace/client/payment-methods` then `/api/bookings/checkout` with `savedCardId`). If the email is an admin, the attacker gains the admin panel (the existing `User.role` field is used in the session resolution, so admin emails will return `role=ADMIN`).

## Email verification

- Generates 6-digit code; stores SHA-256 hash in `EmailVerificationToken` with 24h expiry.
- Sends via Resend if `RESEND_API_KEY` + `RESEND_FROM_EMAIL` are set.
- Code preview returned in API response when `NODE_ENV !== "production"` ([src/app/api/auth/register/route.ts:317-318](../src/app/api/auth/register/route.ts#L317-L318)). Acceptable for dev, must not leak in any preview/staging using the same flag.

## Password reset

- `/forgot` creates random hex token, hashes (SHA-256), stores in `PasswordResetToken` with 30-min expiry, sends Resend email with `/restablecer-contrasena?token=...`.
- `/reset` looks up by hash, validates not expired/used, marks used, updates `passwordHash`.
- No re-authentication of existing session, no "log me out everywhere" action.

## Primary admin

- `ensurePrimaryAdminUser()` runs on every login. Re-upserts the admin from `PRIMARY_ADMIN_EMAIL`/`PRIMARY_ADMIN_PASSWORD`/`PRIMARY_ADMIN_FULL_NAME`. Re-hashes the password each call ([src/lib/primary-admin.ts:19-61](../src/lib/primary-admin.ts#L19-L61)).
- Effect: rotating the env var rotates the admin password; deleting the env disables the auto-provision. The admin can also be changed at runtime via `/admin/team`, but the env vars will re-upsert on next login.

## Role enforcement

Two parallel sources:
1. `User.role` enum.
2. `UserRoleAssignment[]` with `Role.code` (UserRole).

Routes call `getRequestIdentity` (cookie or header) and `hasRole`. The cookie carries the *resolved* role from `resolveLoginRole(user, requestedRole)` (`src/lib/user-roles.ts`), which considers `roleAssignments`. So a CUSTOMER with an additional PRO assignment can choose to log in as PRO.

ADMIN routes use either:
- `hasRole(identity.role, UserRole.ADMIN)` — cookie-only (`marketplace/admin/disputes`, `admin/payments/refund`, `payouts/process-timeouts`, etc.).
- `requireAdminRequest(req)` — cookie + DB role assignment check (`admin/team`, `admin/users/[userId]`).

A forged or stolen cookie with `role=ADMIN` will pass the first family of routes but **not** the second. The inconsistency is significant: most admin write-routes use the weaker check.

## CSRF

- Cookie is `sameSite: "lax"` — protects against cross-site POSTs from third-party sites for state-changing requests in modern browsers.
- No double-submit token, no CSRF middleware.
- `serverActions.allowedOrigins: ["*"]` in [next.config.mjs:5](../next.config.mjs#L5) **negates** server-action origin protection. Any origin can invoke Next.js server actions on this deployment.

## Brute-force / rate limiting

- None on `/api/auth/login`, `/api/auth/oauth`, `/api/auth/password/forgot`, `/api/auth/verify/request`, `/api/onboarding/public/phone/*`, `/api/admin/payments/refund`.
- Bcrypt rounds=12 introduces ~250ms/attempt slowdown — only mitigates trivial CPU-bound brute force, does nothing for credential stuffing or password spray at scale.

## Token cookies & secrets summary

| Mechanism | Algorithm | Storage | Rotation |
| --- | --- | --- | --- |
| Session | HMAC-SHA256(JWT-shape) | cookie only | 7d expiry; no revocation list |
| Email verification | SHA-256 of plaintext code | DB `EmailVerificationToken.tokenHash` | 24h expiry, one-time `usedAt` |
| Password reset | SHA-256 of hex token | DB `PasswordResetToken.tokenHash` | 30min expiry, one-time `usedAt` |
| Phone OTP | SHA-256 of digits (stored on `CleaningOnboarding.phoneVerificationCodeHash`) | DB on onboarding row | 10-15 min (see route) |

## Concrete vulnerabilities (sorted by severity)

1. **CRITICAL — OAuth identity spoofing** (`/api/auth/oauth`). Bypasses login entirely for any email.
2. **CRITICAL — Legacy unsigned JSON cookie accepted** (middleware + lib). Direct session forgery.
3. **CRITICAL — Default `SESSION_SECRET` fallback** (`"dev-insecure-change-me"`). One leaked env file = forgery.
4. **HIGH — `ALLOW_HEADER_AUTH=true` is a single env flip away from full bypass.**
5. **HIGH — Server actions accept all origins** (`next.config.mjs`). CSRF + arbitrary server-action invocation from third-party sites.
6. **HIGH — Inconsistent admin guard** — most admin write-paths trust only cookie role.
7. **MEDIUM — No rate limiting** on login, OAuth, password reset, OTP send.
8. **MEDIUM — Bcrypt 72-byte silent truncation** — long passphrases get truncated unknowingly.
9. **MEDIUM — Verification code returned in API response in non-prod** — fine for `development`, but Railway preview environments inherit unless explicitly set.
10. **LOW — `AuthSession` model exists but is unused** — no remote logout, no device list.
