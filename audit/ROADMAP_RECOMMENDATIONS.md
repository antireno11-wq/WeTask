# ROADMAP_RECOMMENDATIONS.md

Concrete, evidence-grounded prioritisation. Estimates assume one senior full-stack engineer.

## Phase 0 — Stop the bleeding (1 sprint, ~5–7 days)

These are the actions without which no real users should ever transact on WeTask.

1. **Kill the simulated payment confirm**
   - Delete `src/app/api/marketplace/bookings/[bookingId]/payment/confirm/route.ts` (or rewrite to require a real `providerPaymentId` and verify against MP).
   - Find every front-end caller and re-route to `/api/bookings/checkout`.
   - **Why:** Free-bookings exploit, see [PAYMENTS_ANALYSIS](PAYMENTS_ANALYSIS.md).

2. **Fix `/api/auth/oauth`**
   - Either: integrate NextAuth (Auth.js v5) with Google + Apple providers; OR verify the id-token server-side using each provider's JWKS before upsert.
   - **Why:** Identity spoofing → admin takeover, see [AUTH_ANALYSIS](AUTH_ANALYSIS.md).

3. **Wire dispute resolution to real refund**
   - In `src/app/api/marketplace/admin/disputes/route.ts`, when `status === "RESOLVED"` with `refundAmountClp > 0`, call `refundProviderPayment("MERCADOPAGO", { providerPaymentId, amount })` and only persist `REFUNDED` after a successful provider response.
   - **Why:** Money kept by platform → chargebacks + SERNAC complaints.

4. **Hard-fail on missing `SESSION_SECRET` in production**
   - `src/lib/security.ts:31,40` and `src/middleware.ts:39`: replace `|| "dev-insecure-change-me"` with `throw new Error("SESSION_SECRET required")` when `process.env.NODE_ENV === "production"`.

5. **Delete the legacy unsigned-cookie path**
   - Remove `decodeLegacySessionCookie` (`src/middleware.ts:18-28`) and `safeParseSessionCookie` (`src/lib/auth.ts:24-34`).

6. **Restrict `serverActions.allowedOrigins`**
   - `next.config.mjs:5`: set to `[process.env.NEXT_PUBLIC_APP_URL]`.

7. **Disable header-auth in production**
   - `src/lib/auth.ts:66-78`: gate behind `process.env.NODE_ENV !== "production"`.

8. **Restore `prisma/schema.prisma` to the working tree**
   - Currently deleted. Either restore from HEAD or commit the deletion deliberately. Add a CI check that `prisma/schema.prisma` exists.

9. **Gate demo-data seeding**
   - Wrap `ensureMarketplaceDemoData()` calls with `if (process.env.SEED_DEMO_DATA === "true")`.
   - Disable `/api/marketplace/demo` in production.

10. **Hard-fail on duplicate `Booking.proReview` upserts**
    - Make `/api/marketplace/bookings/[id]/pro-review` `create` not `upsert`; unique on `bookingId`.

## Phase 1 — Beta-ready (3–4 weeks)

11. **Payout settlement**
    - Decide: manual via admin CSV export + MercadoPago Money Out web UI, OR programmatic via MercadoPago Money Out API / bank transfer integration.
    - Implement transition of `Payout.status` PENDING → PROCESSING → PAID/FAILED with provider call.
    - Add `Payout.providerTransferId`, `Payout.failureReason`, `Payout.attemptedAt`.

12. **Webhook signature + idempotency**
    - Validate MercadoPago `x-signature`/`x-request-id`.
    - Create `ProcessedWebhookEvent` table keyed on `(provider, eventId)`; short-circuit if seen.

13. **Versioned Prisma migrations**
    - `prisma migrate dev`, commit `prisma/migrations/`, switch Railway start command to `prisma migrate deploy && npm run start`.
    - Document the rollback procedure (revert commit + run migration).

14. **Admin audit log**
    - `AdminAuditLog` table; helper in `src/lib/audit-log.ts`; called from every admin route.

15. **Rate limiting**
    - `@upstash/ratelimit` on `/api/auth/*`, `/api/onboarding/public/phone/*`, `/api/leads`, `/api/support/contact`, `/api/admin/payments/refund`.

16. **Error tracking**
    - Sentry; capture server-side route handlers, MP/Twilio/Resend failures.

17. **Real health check**
    - `/api/health` runs `prisma.$queryRaw\`SELECT 1\`` and pings MP / Resend / Twilio (cached for ≥30s).

18. **Object storage for identity files**
    - S3/R2; store object keys in DB; admin viewer uses signed URLs; backfill existing base64 docs in a one-shot script.

19. **Unify admin guard**
    - Replace every `hasRole(identity.role, ADMIN)` in admin write routes with `requireAdminRequest`.

20. **Cancellation policy + slot release**
    - When `Booking.status` transitions to `CANCELLED`, release the slot; partial refund per category rules.

21. **Booking state machine**
    - Extract into `src/lib/booking-state-machine.ts` with allowed transitions; reject invalid transitions in every route.

22. **Fix `Address.country` default → `"CL"`**, and `Payment.provider` default → `"MERCADOPAGO"`.

23. **Reconciliation cron (manual button or QStash)** that lists `Payment.status=PENDING` older than 10 min and reconciles via `getProviderPayment`.

24. **Light load test** of `/api/bookings/checkout` at 5 RPS to confirm idempotency and lock behaviour.

## Phase 2 — Public launch (6–10 weeks)

25. **Job queue** (Inngest/QStash) for emails, automated payouts, reconciliation, daily reports.
26. **Outbox pattern** for side effects from booking and payment transitions.
27. **Real-time layer** for chat (SSE first, then Ably/Pusher).
28. **Frontend primitives layer** — pull out `Button`, `Card`, `Input`, `Modal`, `Toast`, `Tabs` from the mega-pages.
29. **Migrate to Tailwind** + co-located CSS Modules.
30. **`next/font`** migration; drop the `@import` in `globals.css`.
31. **Split mega-pages** (`pro/page.tsx`, `pro/[proId]/page.tsx`, `reservar/page.tsx`, `cliente/page.tsx`) using `next/dynamic` and shared primitives.
32. **CI** with `npm run lint`, `tsc --noEmit`, plus a minimal Vitest suite for `marketplace-pricing`, `chat-safety`, `communes`, `security` modules and a Playwright E2E for booking + checkout against a Mercado Pago test account.
33. **Backups + restore drill** documented.
34. **Tasker performance dashboard** — cancellation rate, dispute rate, response time per pro.
35. **Invoicing/boleta integration** (OpenFactura or similar).
36. **CAPTCHA** on public forms.
37. **CSP and other security headers**.

## Phase 3 — Scale (3–6 months)

38. **Cache layer** (Upstash Redis) for catalog reads, pro listings.
39. **Postgres pooler / proxy** (PgBouncer or Prisma Accelerate).
40. **Read replica** for analytics + admin queries.
41. **PostHog/Mixpanel** + warehouse for product analytics.
42. **Coupon / promo system**.
43. **Recurring bookings / subscriptions**.
44. **Tasker calendar sync (iCal/Google)**.
45. **Push notifications via service worker** for booking events.

## Anti-roadmap (do NOT do)

- **Do not rewrite the project from scratch.** The schema, the MercadoPago integration, and the onboarding state machine are real value — keep them.
- **Do not adopt Stripe instead of MercadoPago.** Chile-specific local payment methods are why MP is the right choice for the target market.
- **Do not add a microservice split.** The codebase is small (172 TS/TSX); a monolith with a queue and a cache is the right shape.
- **Do not add multi-region until you have backups, observability, and a payout pipeline.**

## Recommended "next 3 PRs"

1. **PR #1 — "Kill simulated payment confirm + tighten session secret"** — addresses Phase 0 items 1, 4, 5.
2. **PR #2 — "OAuth via NextAuth + admin guard unified"** — addresses Phase 0 items 2, 7 and Phase 1 item 19.
3. **PR #3 — "Real dispute refund + webhook signature + ProcessedWebhookEvent"** — addresses Phase 0 item 3 and Phase 1 item 12.

Each PR is scoped, reversible, and removes one CRITICAL finding. After these three, WeTask moves from "would lose money in production" to "could plausibly run a closed beta".

## Final executive assessment

**Current stage:** Operational MVP. The product can take a real payment end-to-end via the production checkout, the schema is mature, the onboarding flow is substantial, and the admin tools exist. It is **not** beta-ready due to five concrete CRITICAL findings, missing payout settlement, and absence of observability / rate limiting / migration discipline.

**Biggest strengths**
- Real MercadoPago integration with idempotency + slot locking on the production checkout.
- Comprehensive Prisma schema with reasonable indexes.
- Multi-step tasker onboarding with phone OTP, admin review queue, per-category scope JSON.
- Resend + Twilio integrations are real, not stubs.
- Email templates are well designed.
- Spanish copy and visual identity are cohesive.

**Biggest weaknesses**
- Two parallel payment paths, one of which is a free-money exploit.
- No payout settlement code.
- OAuth route trusts client.
- Default session secret + legacy unsigned cookie + header-auth backdoor = three independent auth bypasses.
- Mega-pages and a 9 304-line CSS file with no design system.
- No tests, no CI, no observability, no rate limiting, no migrations, no backups verified.

**Most dangerous risks**
1. Free bookings via `/payment/confirm`.
2. OAuth identity takeover.
3. Dispute "refund" never refunds.
4. Payouts never settle.
5. Default `SESSION_SECRET` if env missing.

**Fastest wins**
- Phase 0 items 1, 4, 5, 6, 7 are each <1 day of work and remove four CRITICAL findings.
- Disabling demo-data seeding in production removes background DB churn.

**Top 5 recommended next priorities**
1. Phase 0 (Stop the bleeding) — 1 sprint.
2. Real payout settlement (Phase 1, item 11).
3. Versioned migrations + admin audit log (Phase 1, items 13, 14).
4. Rate limiting + Sentry + real health check (Phase 1, items 15, 16, 17).
5. Object storage for identity documents (Phase 1, item 18).
