# PERFORMANCE_ANALYSIS.md

## Database

### N+1 risk surfaces
- `/api/marketplace/availability` ([route.ts:26-47](../src/app/api/marketplace/availability/route.ts#L26-L47)) eagerly includes `professionalProfile → user → cleaningOnboarding` (1 level deep) and `service`. Single query, no N+1.
- `/api/marketplace/bookings` GET includes `customer`, `pro`, `service`, `extras`, `payment` — five-way join in one query, OK.
- `/api/marketplace/admin/disputes` GET includes `booking → customer + pro` — OK.
- `/api/marketplace/pro/bookings` (not deep-read) likely paginates pro's own bookings.

The bigger risk is **commune filtering**: `taskerServesCommune` runs in JS against a JSON column ([src/app/api/bookings/checkout/route.ts:173-182](../src/app/api/bookings/checkout/route.ts#L173-L182)). Today acceptable; at scale every search becomes "list candidates then filter in app".

### Unbounded queries
- `/api/marketplace/admin/disputes` GET fetches **all disputes** — no pagination ([route.ts:21-33](../src/app/api/marketplace/admin/disputes/route.ts#L21-L33)). 10k disputes = 10k rows in memory.
- `/api/marketplace/bookings` GET caps at `limit` query param but server still does `Math.min(Math.max(limit,1),100)` — bounded but admin can change limit per request.
- `/api/marketplace/availability` defaults limit from validator — needs verification.
- `prisma.notification.findMany` (in routes serving the inbox) without explicit pagination caps would be a memory risk for very active users.

### Demo data on hot paths
- `ensureMarketplaceDemoData()` is invoked **on every login** and **on every public catalog / pros / availability / search request** ([src/lib/marketplace-demo-data.ts](../src/lib/marketplace-demo-data.ts) 1 184 lines). Even if idempotent via `upsert`, the function performs many DB writes per public hit. **Catastrophic at moderate read load.**

### Aggregation race
- Customer review submission recomputes pro rating average outside `$transaction` ([src/app/api/marketplace/reviews/route.ts:51-64](../src/app/api/marketplace/reviews/route.ts) per agent report). Two concurrent reviews can lose one update.

### Indexes
- See [DATABASE_ANALYSIS.md](DATABASE_ANALYSIS.md). Missing on `Notification(userId, isRead)`, `Payment(status)`, `DisputeTicket(status, createdAt)`, `Booking(paymentStatus)`.

## Frontend bundle

- Five mega-pages (4 933 + 1 886 + 1 833 + 1 583 + 1 136 = **11 371 lines** of client React).
- No dynamic imports for heavy widgets.
- No bundle analyzer wired.
- Single CSS file 9 304 lines served on every page (Next inlines critical and lazy-loads the rest, but the parsed cost is still real on mobile).
- `@import url(fonts.googleapis.com/css2?...)` at top of CSS → render-blocking remote fetch; FOIT/CLS risk. Not using `next/font`.

## Rendering strategy

- Most data-bound pages are client components fetching `/api/...` on mount. Time-to-interactive is high.
- `app/page.tsx` is server-rendered and lean.
- No Streaming SSR, no `loading.tsx`, no `error.tsx`.
- No revalidate tags / ISR for catalog pages.

## Image handling

- `next.config.mjs` does not configure `images`. `next/image` usage not surveyed; if used, defaults apply.
- Identity documents, selfies, criminal records, chat attachments — stored as **base64 in Postgres** (`CleaningOnboarding.identityDocumentFile`, `Message.imageUrl`?). Up to 8 MB each per `validators.ts:305`. Loading a tasker's onboarding row pulls megabytes.

## Email delivery

- Fire-and-forget via `void sendBookingStatusEmailToCustomer(...)` after the main transaction. Failures are invisible. At scale, Resend rate-limit responses get swallowed and lost.

## Hot paths to watch

1. **Login.** `ensureMarketplaceDemoData()` + `ensurePrimaryAdminUser()` + password hash check. Likely ~300-600ms per login under modest load due to bcrypt + many DB upserts.
2. **Catalog / pros listing.** Demo data seeding on every read.
3. **Tasker availability search.** Multi-include query + JS commune filter.
4. **Checkout.** Network-bound on MercadoPago response (~500-2000 ms).
5. **Webhook.** Re-fetches MP payment + double `$transaction`.

## Caching

- Zero. No Redis, no in-memory cache, no `unstable_cache`, no `revalidate` on catalog endpoints.
- Even immutable data like `Category` and `Service` is re-queried per request.

## Real-time gap

- No websockets / SSE / Pusher / Ably. Chat is HTTP polling. At scale this is expensive both client-side (battery) and server-side (Prisma + Postgres pool).

## Scalability ceilings

| Subsystem | Likely ceiling on current architecture |
| --- | --- |
| Reads on `/catalog`, `/pros`, `/availability` | a few QPS before demo-seeding swamps Postgres |
| Logins | ~5/s due to bcrypt + demo seed |
| Webhooks | ~50/s before duplicate-event-spam matters |
| Concurrent chat polling | ~500 active sessions before pool saturation |
| DB connections | depends on Railway plan; no pooler configured (`prisma.ts` doesn't use Data Proxy / Accelerate / PgBouncer) |

## Recommended fixes

1. **Move demo seeding out of hot paths** — gate behind `SEED_ON_BOOT` env or a one-shot CLI.
2. **Replace base64 file storage with object storage** (S3/R2 + presigned URLs).
3. **Add a real cache layer** (Upstash Redis) for `Category`/`Service`/`Catalog` reads.
4. **Replace polling with SSE or Pusher** for chat + notifications.
5. **Add bundle analyzer**, split mega-pages with `next/dynamic`, swap mega-CSS for Tailwind.
6. **Use `next/font`** and remove `@import` from globals.css.
7. **Pool/Proxy:** front Prisma with PgBouncer (transaction mode) or Prisma Accelerate.
8. **Index for the actual queries** (see DATABASE_ANALYSIS recommendations).
