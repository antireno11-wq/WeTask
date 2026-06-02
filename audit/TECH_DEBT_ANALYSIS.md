# TECH_DEBT_ANALYSIS.md

Categorised by danger.

## Dangerous (touch within 2 weeks)

| Debt | Location | Risk |
| --- | --- | --- |
| **Two parallel payment paths** (real checkout vs simulated `/payment/confirm`) | `src/app/api/bookings/checkout/route.ts` vs `src/app/api/marketplace/bookings/[id]/payment/confirm/route.ts` | Free bookings (see [PAYMENTS_ANALYSIS](PAYMENTS_ANALYSIS.md)) |
| **Two parallel booking-create routes** (`POST /api/bookings` + `POST /api/marketplace/bookings`) | both create bookings differently; only the marketplace one assigns a pro automatically | Inconsistent state; risk of stale path being used by an admin tool |
| **Two parallel professional pipelines** (`Technician` model + `ProfessionalProfile` + `CleaningOnboarding`) | `audit/_schema_at_HEAD.prisma:530-567`; `/api/technicians/register` vs `/api/onboarding/cleaning/*` | Dual source of truth; admin team confused about which is canonical |
| **Default `Payment.provider = "STRIPE"`** but real provider is MercadoPago | `audit/_schema_at_HEAD.prisma:408`, `src/app/api/marketplace/bookings/route.ts:340`, `src/app/api/marketplace/bookings/[id]/payment/confirm/route.ts:55` | Reconciliation queries miss STRIPE-tagged rows |
| **Legacy unsigned JSON cookie acceptance** in middleware + auth lib | `src/middleware.ts:18-28`, `src/lib/auth.ts:24-34` | Authentication bypass (see SECURITY_ANALYSIS C4) |
| **`ALLOW_HEADER_AUTH` env switch** | `src/lib/auth.ts:66-78` | Full auth bypass if ever true in production |
| **`SESSION_SECRET` fallback constant** | `src/lib/security.ts:31,40`, `src/middleware.ts:39` | Session forgery if env missing |
| **`serverActions.allowedOrigins: ["*"]`** | `next.config.mjs:5` | CSRF via server actions |
| **`prisma db push --accept-data-loss` as migration** | `package.json:13`, `railway.json:7` | Schema can drop columns silently on deploy |
| **`prisma/schema.prisma` deleted in working tree** | `git status` | Next `prisma db push` from this tree could devastate the DB |
| **No payout settlement logic** | `Payout.status` never advances | Tasker payments do not happen automatically |
| **Dispute resolution does not call MP refund** | `src/app/api/marketplace/admin/disputes/route.ts:71-83` | Money kept by platform instead of refunded |
| **Webhook lacks signature verification** | `src/app/api/payments/webhook/mercadopago/route.ts:24-32` | Spoofed webhooks DoS, swallowed errors |
| **Demo seed on every login + every public catalog read** | `ensureMarketplaceDemoData()` in `auth/login/route.ts:14`, `marketplace/catalog/route.ts:9`, `marketplace/pros/route.ts:22`, `marketplace/availability/route.ts:10`, `marketplace/search-professionals/route.ts:85`, `marketplace/pros/[proId]/route.ts:9`, `marketplace/client/bookings/route.ts:11` | Demo accounts in production, DB write storm |
| **Public `/api/marketplace/demo`** returns credentials in plaintext | `src/app/api/marketplace/demo/route.ts` | Anyone can grab demo admin creds |

## Manageable (next quarter)

| Debt | Location | Risk |
| --- | --- | --- |
| Inconsistent admin guard (`requireAdminRequest` vs `hasRole`) | various admin routes | Forged cookie passes weak routes |
| `AuthSession` model defined and unused | `audit/_schema_at_HEAD.prisma:179-189` | No remote logout, no device list |
| `Address.country @default("ES")` while product is Chile | `audit/_schema_at_HEAD.prisma:322` | Wrong implicit fallback |
| `Booking.proReview*` inline fields instead of `ProReview` model | `audit/_schema_at_HEAD.prisma:355-357` | Cannot track edits, only one review per pro per booking |
| `Address` created every checkout, never reused | `src/app/api/bookings/checkout/route.ts:308-317` | DB bloat |
| `Booking.totalPriceClp` not recomputed on extras change | no trigger | Drift between extras and total |
| Reviews aggregation outside `$transaction` | `src/app/api/marketplace/reviews/route.ts:51-64` | Lost updates under concurrency |
| `pro-review` upsert without one-shot guard | `src/app/api/marketplace/bookings/[id]/pro-review/route.ts:42-55` | Silent overwrite |
| Mega pages (4 933 / 1 886 / 1 833 / 1 583 / 1 136 lines) | `trabaja-con-nosotros/registro/page.tsx`, `pro/page.tsx`, `pro/[proId]/page.tsx`, `reservar/page.tsx`, `cliente/page.tsx` | Bundle bloat, unmaintainable |
| Single 9 304-line CSS file | `src/app/globals.css` | Style debt |
| Google Fonts `@import` in CSS | `src/app/globals.css:1` | Render-blocking |
| Identity docs / selfies stored base64 in Postgres | `CleaningOnboarding.identityDocumentFile`, etc. | Backups bloat, no virus scan |
| `Notification` lacks `(userId, isRead)` index | schema | Inbox scan |
| `DisputeTicket` lacks `status`+`createdAt` index for admin list | schema | Slow admin queue |
| `Payment.status` no index | schema | Slow reconciliation |
| `z.any()` for `taskerAdditionalCategorySchema.scopeData` | `src/lib/validators.ts:272` | Validation bypass for the scope blob |
| One-shot `seed.mjs` instead of fixtures + reseed CLI | `prisma/seed.mjs` | Hard to run safely |
| Disconnected sister directories in repo (`stratmap-chile/`, `tmp_webel/`, `nomade-tareas-simple/`, `campamentos-control`) | repo root | Confusion, accidental imports |
| No tests, no CI | `.github/` absent | Regressions ship unnoticed |
| No structured logging | `console.*` only | Forensics impossible |

## Cosmetic (when bored)

| Debt | Location |
| --- | --- |
| `errors.detail` field always returned even in prod (leaks internal messages) | every route's catch |
| Repeated email-template gradient/shadow tokens hardcoded | `src/lib/notifications.ts` |
| `BookingStatus` enum has values never written (`PENDING`, `DISPUTE_OPEN`, `PAID_OUT`) | `audit/_schema_at_HEAD.prisma:40-57` |
| `Booking.proId` cascade is `SetNull` — orphaned booking after delete | schema |
| Inconsistent commit message style ("Compact support FAQ cards", "Remove duplicate service tag" — fine but no convention/prefix) | git log |
| `context.md` untracked file in working tree | `git status` |

## Mocked / fake / fallback / demo systems

- **`marketplace-demo-data.ts`** — 6 demo pros, demo customers, demo addresses, demo password hash hardcoded.
- **`admin-demo-data.ts`** — 308 lines of admin fixture data.
- **`/api/marketplace/demo`** — exposes the demo credentials publicly.
- **`/api/marketplace/bookings/[id]/payment/confirm`** — simulated payment.
- **`/api/auth/oauth`** — simulated OAuth.
- **Geo fallback** in `src/lib/geo.ts` — hash-based pseudo-coordinates when geocoding fails (so addresses appear "somewhere in Santiago").
- **Maps validate-address fallback** — commune inference if Google key absent.
- **Email skip** — `sendPlatformEmail` logs `[email] skipped: resend not configured` if env missing, returns silently.
- **SMS skip** — `sendTwilioSms` returns `{ ok: false, reason: "not_configured" }` if env missing.
- **`syncTaskerAvailabilitySlotsFromOnboarding`** in `src/lib/tasker-publication.ts` — not deep-read, behaviour unknown.

## Dead code / abandoned features

- `AuthSession` model — defined, never written.
- `BookingStatus` values `PENDING`, `DISPUTE_OPEN`, `PAID_OUT` — never set.
- `Technician` model — overlaps with `ProfessionalProfile`; one of the two should be removed.
- `tmp_webel/` directory — temp dir checked into repo.
- `stratmap-chile/` directory — excluded from tsconfig (`tsconfig.json:23`) — unrelated subproject.

## Untracked / deleted-but-not-committed

`git status` shows:
```
deleted:    campamentos-control
deleted:    nomade-tareas-simple/README.md
deleted:    nomade-tareas-simple/index.html
deleted:    prisma/schema.prisma     ← critical
Untracked:  context.md
```
The deletion of `prisma/schema.prisma` is **dangerous** because the Railway deploy runs `prisma db push` — without a schema file, Prisma would throw, but if a teammate re-creates a partial schema by mistake and pushes, the DB could lose tables.
