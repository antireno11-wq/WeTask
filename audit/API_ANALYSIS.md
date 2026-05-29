# API_ANALYSIS.md — Route inventory and posture

Total route handlers: **62 `route.ts` files** under `src/app/api/`.

## Route inventory

### Auth
| Route | Methods | Auth | Validation | Notes |
| --- | --- | --- | --- | --- |
| `/api/auth/login` | POST | none | ad-hoc | Hot-seeds demo data + primary admin every call. No rate limit. |
| `/api/auth/register` | POST | none | ad-hoc | Returns verification code in dev mode |
| `/api/auth/logout` | POST | cookie | — | Clears cookie |
| `/api/auth/session` | GET | cookie | — | Returns decoded session |
| `/api/auth/oauth` | POST | none | ad-hoc | **CRITICAL — accepts client email without OAuth token** |
| `/api/auth/verify/request` | POST | none | ad-hoc | Sends verification email |
| `/api/auth/verify/confirm` | POST | none | ad-hoc | Confirms token; marks email verified |
| `/api/auth/password/forgot` | POST | none | ad-hoc | Sends reset email |
| `/api/auth/password/reset` | POST | none | ad-hoc | Resets via hashed token |

### Bookings (mix of legacy + production)
| Route | Methods | Auth | Validation | Notes |
| --- | --- | --- | --- | --- |
| `/api/bookings` | POST | session | zod | Legacy. Always sets `provider:"STRIPE"` placeholder payment without charging |
| `/api/bookings/public` | GET | none | — | Public listing |
| `/api/bookings/checkout` | POST | CUSTOMER/ADMIN | zod | Real MercadoPago, idempotency, slot lock |
| `/api/bookings/[bookingId]/status` | PATCH | session | zod | Status updates |

### Marketplace
| Route | Methods | Auth | Validation | Notes |
| --- | --- | --- | --- | --- |
| `/api/marketplace/catalog` | GET | public | — | Seeds demo data on every hit |
| `/api/marketplace/pros` | GET | public | — | Seeds demo data |
| `/api/marketplace/pros/[proId]` | GET | public | — | Seeds demo data |
| `/api/marketplace/availability` | GET | public | zod | Seeds demo data |
| `/api/marketplace/search-professionals` | GET | public | zod | Seeds demo data; filters by `isVerified=true` |
| `/api/marketplace/demo` | GET | public | — | Returns demo credentials in plaintext |
| `/api/marketplace/service-preparation` | POST | session | zod | Returns server-derived content |
| `/api/marketplace/bookings` | GET/POST | ADMIN / CUSTOMER+ADMIN | zod | Legacy create with race condition |
| `/api/marketplace/bookings/[id]` | GET | session | — | Detail |
| `/api/marketplace/bookings/[id]/status` | PATCH | PRO/ADMIN | zod | Limited state machine for PRO; ADMIN unrestricted |
| `/api/marketplace/bookings/[id]/messages` | GET/POST | parties | zod | Chat with safety filter |
| `/api/marketplace/bookings/[id]/complete` | POST | session | — | Marks complete |
| `/api/marketplace/bookings/[id]/customer-confirm` | POST | CUSTOMER | — | Customer ack |
| `/api/marketplace/bookings/[id]/payment/confirm` | POST | CUSTOMER/ADMIN | — | **Simulated payment — bypass risk** |
| `/api/marketplace/bookings/[id]/payout/request` | POST | PRO/ADMIN | — | Creates `Payout` row PENDING |
| `/api/marketplace/bookings/[id]/pro-review` | POST | PRO | — | upserts review, can overwrite |
| `/api/marketplace/client/bookings` | GET | CUSTOMER | — | Customer's own bookings |
| `/api/marketplace/client/payment-methods` | GET/POST/DELETE | CUSTOMER | zod | Real MercadoPago card-on-file |
| `/api/marketplace/disputes` | POST | parties | zod | Opens ticket, sets booking DISPUTE |
| `/api/marketplace/notifications` | GET/PATCH | session | — | Inbox + mark-read |
| `/api/marketplace/payouts/process-timeouts` | POST | ADMIN | — | Manual sweep |
| `/api/marketplace/pro/bookings` | GET | PRO | — | Pro's bookings |
| `/api/marketplace/pro/profile` | GET/PATCH | PRO | zod | Edit own profile |
| `/api/marketplace/pro/categories` | GET/POST | PRO | zod | Per-category profile + scope |
| `/api/marketplace/pro/slots` | GET/POST | PRO | zod | Slot CRUD |
| `/api/marketplace/pro/slots/[slotId]` | PATCH/DELETE | PRO | zod | Slot edit |
| `/api/marketplace/pro/slots/sync` | POST | PRO | — | Sync from onboarding |
| `/api/marketplace/reviews` | POST | CUSTOMER | zod | Recomputes pro rating outside transaction |
| `/api/marketplace/admin/categories/rules` | PATCH | ADMIN | zod | Update fees |
| `/api/marketplace/admin/disputes` | GET/PATCH | ADMIN | zod | List + resolve. DB-only refund |

### Onboarding
| Route | Methods | Auth | Validation | Notes |
| --- | --- | --- | --- | --- |
| `/api/onboarding/cleaning/start` | POST | PRO | zod | Creates `CleaningOnboarding` |
| `/api/onboarding/cleaning/me` | GET/PATCH | PRO | zod | Self-edit |
| `/api/onboarding/cleaning/submit` | POST | PRO | zod (289 lines!) | Final validation + admin alert |
| `/api/onboarding/cleaning/phone/send` | POST | PRO | zod | Twilio SMS |
| `/api/onboarding/cleaning/phone/verify` | POST | PRO | zod | Verify code |
| `/api/onboarding/cleaning/phone/claim` | POST | PRO | zod | Bind phone to user |
| `/api/onboarding/public/phone/send` | POST | none | zod | Anonymous SMS — exploit surface |
| `/api/onboarding/public/phone/verify` | POST | none | zod | Anonymous verify |

### Admin
| Route | Methods | Auth | Validation | Notes |
| --- | --- | --- | --- | --- |
| `/api/admin/email/health` | GET | ADMIN | — | Resend status |
| `/api/admin/payments/health` | GET | ADMIN | — | MP credential / probe |
| `/api/admin/payments/refund` | POST | ADMIN | zod | Real MP refund |
| `/api/admin/team` | GET/POST | ADMIN | zod | Manage team |
| `/api/admin/technicians` | GET/POST | ADMIN | zod | Technician approval |
| `/api/admin/users/[userId]` | GET | ADMIN | — | User detail |
| `/api/admin/onboarding/cleaning` | GET/POST/PATCH | ADMIN | zod | Onboarding queue |

### Misc
| Route | Methods | Auth | Validation | Notes |
| --- | --- | --- | --- | --- |
| `/api/health` | GET | none | — | `{ ok: true, service: "wetask", timestamp }` — does **not** check DB |
| `/api/leads` | POST | none | zod | Lead capture; no rate limit |
| `/api/coverage-waitlist` | POST | none | zod | Coverage waitlist |
| `/api/maps/autocomplete` | GET | none | — | Google Places proxy |
| `/api/maps/validate-address` | GET | none | — | Google geocoding |
| `/api/support/contact` | POST | none | zod | Sends support email |
| `/api/technicians/register` | POST | none | zod | Public technician form |
| `/api/services` | GET | none | — | Public service listing |
| `/api/payments/webhook/mercadopago` | POST | provider | — | No signature; re-fetches payment |

## Common posture findings

### Validation
- `zod` is widely used and centralised in `src/lib/validators.ts` (665 lines).
- Some routes still parse ad-hoc (notably `auth/login`, `auth/oauth`, payment/confirm).
- One `z.any()` in `taskerAdditionalCategorySchema.scopeData` ([src/lib/validators.ts:272](../src/lib/validators.ts#L272)) — escape hatch for the entire scope blob.

### Authorisation patterns
- Middleware enforces role at edge for `/api/admin/*` and `/api/marketplace/*` (except 5 public endpoints).
- Routes additionally call `getRequestIdentity(req)` + `hasRole(...)`.
- `requireAdminRequest` (the *DB-checked* admin guard) is only used by `admin/users/[userId]` and `admin/team`. Other admin routes use the simpler cookie-only `hasRole(..., ADMIN)`. **Inconsistent — an attacker with a forged session secret can hit non-`requireAdminRequest` routes without the DB cross-check.**

### Error handling
- Every route wraps body in `try/catch` and returns `{ error, detail }`. Detail field can leak internal messages (e.g. `error instanceof Error ? error.message : "Error desconocido"`).
- HTTP status codes are mostly correct (`400` for validation, `401` for missing identity, `403` for wrong role, `404` for missing entity).

### Idempotency
- Only `/api/bookings/checkout` implements an idempotency key (`Payment.idempotencyKey @unique`).
- Webhook handler does not store a "processed" record — relies on re-fetching and overwriting state. Two webhooks racing the same payment can produce one redundant write but not split-brain.

### Rate limiting
- Zero. No middleware, no `rate-limiter-flexible`, no `next-rate-limit`, no Cloudflare config.

### Logging
- `console.log/info/error` only. Notifications log `[email] sent` and `[email] resend delivery failed`. No request-id propagation.

### CORS
- Default Next.js (no `cors` middleware). Server actions are wide-open due to `serverActions.allowedOrigins: ["*"]` in `next.config.mjs:5`.

### Caching
- Routes declare `export const dynamic = "force-dynamic"` consistently for state-changing endpoints — correct.

## Priority follow-ups

1. Replace `/api/marketplace/bookings/[id]/payment/confirm` with a real MercadoPago verification (or delete it if `/api/bookings/checkout` is canonical).
2. Replace `/api/auth/oauth` with NextAuth or verified id-token flow.
3. Add MercadoPago webhook signature check (`x-signature`) and an `ProcessedWebhook` idempotency table.
4. Unify admin guard — make `requireAdminRequest` the single helper.
5. Rate-limit `/api/auth/*`, `/api/onboarding/public/phone/*`, `/api/leads`, `/api/support/contact`, `/api/admin/payments/refund`.
6. Wire `/api/health` to `prisma.$queryRaw\`SELECT 1\`` and report MP/Resend health.
