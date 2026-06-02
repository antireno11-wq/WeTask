# ARCHITECTURE.md — What the real architecture looks like

## Stack

- **Runtime:** Node ≥ 20 (`package.json:36`).
- **Framework:** Next.js 14.2.18 App Router, React 18.3 ([package.json:18-23](../package.json#L18-L23)).
- **ORM/DB:** Prisma 5.20 + PostgreSQL (`audit/_schema_at_HEAD.prisma:5-8`, recovered from HEAD — the working tree has `schema.prisma` *deleted*).
- **Validation:** `zod` (one centralised `src/lib/validators.ts` at 665 lines + ad-hoc schemas in routes).
- **Auth crypto:** `bcryptjs` (rounds = 12, [src/lib/security.ts:4](../src/lib/security.ts#L4)), Node `crypto.createHmac` for session signing.
- **Email:** Resend HTTP API (`src/lib/notifications.ts:31-78`).
- **SMS:** Twilio REST API (`src/lib/twilio-sms.ts:43-91`).
- **Payments:** MercadoPago REST API (`src/lib/payments/providers/mercadopago.ts`).
- **Maps:** Google Maps Places & Geocoding (`src/app/api/maps/*`).
- **Hosting:** Railway NIXPACKS builder; start command `npm run prisma:push && npm run start` ([railway.json:7](../railway.json#L7)).

There is **no Tailwind, no shadcn, no Radix, no headless UI, no Zustand/Redux, no react-query, no NextAuth, no Sentry, no tRPC**.

## Layering

```
src/
├── middleware.ts           Next.js Edge middleware — cookie session decode, route guards
├── app/                    App Router pages + /api routes
│   ├── (public marketing)
│   ├── ingresar/*          Auth pages, role-segregated
│   ├── registro/           Customer registration
│   ├── trabaja-con-nosotros/registro/   Pro onboarding (single 4 933-line client component)
│   ├── reservar/           Booking flow
│   ├── cliente/            Customer panel
│   ├── pro/                Tasker panel
│   ├── admin/              Admin back-office
│   └── api/                Route handlers
├── components/             10 shared components total (very thin)
└── lib/                    Domain helpers, validators, integrations
```

`/components/` only contains 10 files (`admin-cleaning-review-actions.tsx`, `admin-hero-shell.tsx`, `auth-hero-nav.tsx`, `booking-chat-panel.tsx`, `brand-logo.tsx`, `home-service-link.tsx`, `login-role-panel.tsx`, `market-nav.tsx`, `pwa-register.tsx`, `site-footer.tsx`). Almost everything else is inlined inside each page.

## Server vs client split

- 34 files contain `"use client"` (out of 57 page files + 10 components).
- Mega-pages are all client components — see [FRONTEND_ANALYSIS.md](FRONTEND_ANALYSIS.md).
- Page-level data is mostly fetched client-side via `fetch("/api/...")` instead of server components reading Prisma directly. The App Router's RSC benefits are largely unused.

## Data flow (booking happy path)

```
Browser → POST /api/bookings/checkout (real path)
        ↳ verifies pricing, locks AvailabilitySlot, creates Booking + Payment in $transaction
        ↳ calls MercadoPago /v1/payments
        ↳ updates Booking.status from provider result
        ↳ writes Notification rows
        ↳ fires sendBookingStatusEmailToCustomer (Resend)

MercadoPago → POST /api/payments/webhook/mercadopago
        ↳ re-fetches payment via server credentials (no signature check, but re-fetch validates state)
        ↳ updates Payment + Booking + AvailabilitySlot.isAvailable in $transaction
```

```
Browser → POST /api/marketplace/bookings/[id]/payment/confirm (simulated path, parallel)
        ↳ just sets paymentStatus=PAID with providerPaymentId=`sim_<bookingId>` (no real payment) ⚠️
```

These two paths coexist and the second one bypasses the first.

## Middleware (`src/middleware.ts`)

- Matches `/cliente/*`, `/pro/*`, `/admin/*`, `/reservar/*`, `/booking/*`, `/api/admin/*`, `/api/marketplace/*` ([middleware.ts:128-138](../src/middleware.ts#L128-L138)).
- Decodes signed cookie via `crypto.subtle.importKey` HMAC-SHA256.
- Falls back to a **legacy unsigned JSON cookie** (`decodeLegacySessionCookie`) — this is a backwards-compat backdoor accepting any JSON payload as a session. ([middleware.ts:18-28](../src/middleware.ts#L18-L28))
- Public marketplace API allowlist: `/api/marketplace/catalog`, `/pros`, `/availability`, `/search-professionals`, `/demo` ([middleware.ts:6-12](../src/middleware.ts#L6-L12)).
- Role enforcement is repeated in middleware AND in every route via `getRequestIdentity` + `hasRole` — fine, defence-in-depth, but doubled work that often desyncs.

## Auth model

- Cookie name `wetask_session`, 7-day expiry, `httpOnly`, `sameSite=lax`, `secure` only in prod ([src/app/api/auth/login/route.ts:103-111](../src/app/api/auth/login/route.ts#L103-L111)).
- Payload `{ userId, role, email, fullName, exp }`; signed by HMAC-SHA256 using `SESSION_SECRET || "dev-insecure-change-me"` ([src/lib/security.ts:30-36](../src/lib/security.ts#L30-L36)).
- No `AuthSession` DB row is created on login despite the table existing in the schema — the session is purely cookie-based. The `AuthSession` model is **defined and unused**.
- A user can be globally `ADMIN` (`User.role`) AND have additional roles via `UserRoleAssignment`. Admin requests are double-checked against the DB role assignments ([src/lib/admin-access.ts:21-44](../src/lib/admin-access.ts#L21-L44)).

## Pricing engine

Single pure function `calculateMarketplacePrice` in [src/lib/marketplace-pricing.ts](../src/lib/marketplace-pricing.ts):
```ts
subtotal = pricingModel === "fixed" ? rate : rate * hours
extras   = materials? + urgency? + travelFee
platformFee = round(subtotal * platformFeePct / 100)
total = subtotal + extras + platformFee
```
Used by `/api/bookings/checkout` and `/api/marketplace/bookings`.

## Persistence patterns

- Single `PrismaClient` global ([src/lib/prisma.ts](../src/lib/prisma.ts)).
- Use of `$transaction` is correct in the checkout flow and webhook handler; partially in dispute and refund flows; **absent** in many other write paths (review aggregation, status updates).
- `Prisma.Decimal` for `basePlatformFeePct` and rating averages.
- Money is stored as integer CLP (`amountClp`, `priceClp`) — no rounding error from float, but no currency abstraction either.

## External services (configured)

| Service | Used where | Optional? |
| --- | --- | --- |
| MercadoPago `/v1/payments`, `/v1/customers`, `/v1/customers/{id}/cards`, `/v1/payments/{id}/refunds` | checkout, refund, saved cards | required for paying |
| Resend `/emails` | verification, password reset, admin onboarding alerts, booking status emails | gracefully skipped if `RESEND_API_KEY` missing |
| Twilio `/Accounts/{sid}/Messages.json` | phone-verification SMS in onboarding | gracefully skipped if creds missing |
| Google Maps Places & Geocoding | address autocomplete, validation | falls back to inferred commune if absent |

## What is **missing** in the architecture

- **No background jobs / queue.** Everything inline. The "auto-payout after 24h" relies on an admin POSTing to `/api/marketplace/payouts/process-timeouts` ([src/app/api/marketplace/payouts/process-timeouts/route.ts:8-13](../src/app/api/marketplace/payouts/process-timeouts/route.ts#L8-L13)); no cron, no worker, no scheduler.
- **No real-time layer.** Chat messages are polled via plain REST. No websockets, no SSE, no Pusher/Ably.
- **No event bus / outbox.** Side effects (emails, notifications) are fired-and-forgotten with `void` after the main transaction.
- **No file/blob storage.** Identity documents, selfies, criminal records and chat images are stored as base64 data URLs in Postgres ([src/lib/validators.ts:302-316](../src/lib/validators.ts#L302-L316)).
- **No feature flag system.**
- **No observability primitives** (logger, tracer, metric, error tracker).
- **No CDN configuration** in `next.config.mjs` (only `serverActions.allowedOrigins: ["*"]`).
- **No tests, no CI** (`.github/` absent).
