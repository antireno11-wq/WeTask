# SCALABILITY_ANALYSIS.md

## Estimated ceilings on current code

Assuming a single Railway service with no Redis, no PgBouncer, no CDN beyond Vercel/Railway defaults:

| Subsystem | Current ceiling | Bottleneck |
| --- | --- | --- |
| Catalog / pros / availability reads | ~5–20 RPS | `ensureMarketplaceDemoData()` upserts on every hit |
| Login | ~5 RPS | bcrypt rounds=12 + demo seed + primary-admin upsert |
| Checkout | ~3–5 RPS | MercadoPago round-trip + two `$transaction` blocks |
| Webhook | ~30 RPS | MP refetch + transaction |
| Active chat sessions | ~500 | client polling consumes Postgres connections |
| Admin disputes view | unbounded list — degrades at low thousands |

Move to "production-ready" and the same code should handle 10× more.

## Architectural bottlenecks

### Hot-path demo seeding
`ensureMarketplaceDemoData()` runs on the highest-traffic public endpoints. Each call performs many `upsert`s. Even when idempotent, it's a write storm for every read.

### No cache
- `Category` and `Service` are immutable on the day scale but re-queried on every public catalog request.
- `marketplace/pros` returns hundreds of fields per pro per request.
- No HTTP cache headers, no `unstable_cache`, no SWR on the client.

### Polling chat
- No SSE/WebSocket.
- 500 concurrent users polling every 5s = 100 QPS on `messages` endpoint, each touching Postgres twice (auth + message list).

### Prisma without pooler
- `src/lib/prisma.ts` instantiates a single client globally; fine for serverless but the app runs in a long-lived Railway container.
- No PgBouncer, no Prisma Accelerate, no Data Proxy. The DB connection pool size depends on the Postgres `max_connections` and Prisma's default.

### Synchronous side effects
- Email + notification sends run inside or right after the main transaction. A slow Resend response stalls the user request.
- No outbox pattern, no retry, no DLQ.

### Background jobs
- None. Auto-payouts depend on an admin manually POSTing `/api/marketplace/payouts/process-timeouts`. At scale this becomes a backlog of pending payouts the platform must process each day.

## Query patterns that will hurt

1. **`taskerServesCommune` in JS** — every booking creation lists candidate slots then filters in Node. A single high-demand commune at peak hours fetches many candidates.
2. **Repeated `prisma.role.upsert`** during registration ([src/app/api/auth/register/route.ts:135-139](../src/app/api/auth/register/route.ts#L135-L139)) — every registration writes the same role row.
3. **`prisma.user.upsert` in `ensureMercadoPagoCustomer`** flow — each saved-card flow does `find` + `create` instead of relying on MP search caching.
4. **`prisma.notification.createMany` inside booking transactions** — fine, but the booking transaction grows and lock duration matters.

## Storage scaling concerns

- **Identity documents as base64** — 5 MB front + 5 MB back + 5 MB selfie + 5 MB criminal record per tasker ≈ **20 MB row** in `CleaningOnboarding`. 10 000 taskers = 200 GB in a single table. Postgres backups become expensive, query latency degrades.
- **Chat image attachments** as base64 URLs — same problem in `Message.imageUrl`.
- **Dispute evidence** as JSON with up to 3 × 3 MB base64 attachments per ticket (`disputes/route.ts` schema).
- **`Payment.rawResponseJson`** stores entire MP responses — grows linearly.

## Webhook scaling

- No idempotency table → duplicate webhooks cause duplicate work (email sends, notification rows).
- MP can deliver many webhooks per payment (created, in_process, approved). With 10 000 daily payments and ~3 webhook deliveries each, ~30 000/day, ~0.35 RPS average, ~10× burst. Survivable.

## Money operations scaling

- Admin manual sweep for payouts becomes a daily job at low scale and a multi-hour cron job at high scale. Needs to become automated + a real reconciliation report.
- Refund volume × manual admin clicks = support team becomes the bottleneck.

## File storage scaling

- Even modestly successful onboarding flow (100 taskers / day × 4 docs × 5 MB) = ~2 GB/day into Postgres. Object storage is mandatory.

## Recommended scaling moves

### Short-term (no architectural change)
1. Move `ensureMarketplaceDemoData()` out of hot paths.
2. Cache `Category` + `Service` (`unstable_cache` with a short TTL or in-process memo).
3. Add missing indexes per [DATABASE_ANALYSIS.md](DATABASE_ANALYSIS.md).
4. Add explicit pagination cap to admin endpoints.
5. Run side-effects via `Promise.allSettled` instead of `void` for visibility, and log failures.

### Medium-term
1. Add Redis (Upstash).
2. Add a queue (Inngest or QStash) for: webhook fan-out, emails, automated payouts, reconciliation.
3. Add PgBouncer / Prisma Accelerate.
4. Move file uploads to S3/R2.

### Long-term
1. Realtime layer (Pusher/Ably or self-hosted) for chat + notifications.
2. Read replica for analytics / admin queries.
3. CDN for static assets.
4. Split `CleaningOnboarding` JSON blobs into normalised tables where indexed access matters (e.g. `TaskerCoverageCommune`).

## What scales today

- The Prisma schema itself is reasonably indexed for transactional workloads.
- Money math uses integer CLP — no rounding drift at scale.
- Idempotency on the production checkout path prevents double-charges.
- The codebase is small (172 TS/TSX) — refactors are feasible.
