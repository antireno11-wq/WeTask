# WeTask — Final Execution Architecture & Roadmap

This is the concrete, technical execution blueprint to transform WeTask from its current state into a production-grade, highly reliable marketplace.

---

## The Stack Blueprint

| Layer | Technology | Justification |
|-------|------------|---------------|
| **Frontend** | Next.js 14 (App Router) | Excellent SEO, Server Components for fast initial loads. |
| **Database** | PostgreSQL + Prisma | Strongly typed, robust relational mapping. |
| **Auth** | Supabase Auth | Replaces the brittle custom JWT. Native OAuth, secure session management, built-in rate limiting. |
| **Payments** | MercadoPago SDK | Robust financial intent management and webhook parsing. |
| **Async Jobs** | Inngest | Crucial for webhook retries, timeouts, and temporal crons without managing a separate worker server. |
| **KYC** | SumSub (Phase 2) | Automated ID verification to unblock operational bottlenecks. |

---

## The Master Execution Plan

### Phase 0: The Core Stabilization (Days 1-7)
- **Goal**: Stop the bleeding on security and integrity.
- **Tasks**:
  1. Strip out custom JWT (`wetask_session`) and implement Supabase Auth.
  2. Implement strict row-level security (RLS) or API route middleware guards.
  3. Refactor `api/bookings/checkout` to use strict DB locking (`SELECT FOR UPDATE`) for availability slots.

### Phase 1: The Ironclad Checkout & Webhooks (Days 8-14)
- **Goal**: Guarantee zero financial loss.
- **Tasks**:
  1. Rewrite MercadoPago webhook handler with strict idempotency and DB locking.
  2. Implement "Fallback 1" (Sync state on user redirect to success page).
  3. Add Inngest integration and create the "15-minute checkout timeout" job to safely release locked slots.

### Phase 2: Provider Onboarding & Automated KYC (Days 15-21)
- **Goal**: Fix the supply-side bottleneck.
- **Tasks**:
  1. Break `CleaningOnboarding` into a 3-step wizard.
  2. Move image uploads to secure, private S3 buckets with presigned URLs.
  3. (Optional) Integrate SumSub for automated document validation.

### Phase 3: The Operational Engine (Days 22-28)
- **Goal**: Give Admins the tools to run the business.
- **Tasks**:
  1. Build the Admin "God Mode" dashboard (Booking overrides, force cancellations).
  2. Integrate MercadoPago Refund API into the Admin dashboard.
  3. Build the Payout Generator (Exports CSV of all `ELIGIBLE` payouts formatted for BancoEstado/Santander).

### Phase 4: Trust, Safety & UX Polish (Days 29-35)
- **Goal**: Maximize conversion.
- **Tasks**:
  1. Implement Review Lifecycle (14-day blind reviews).
  2. Enhance Service Cards with "Verified Identity" badges.
  3. Implement automated emails/SMS (T-24h, T-2h reminders).

### Phase 5: Scale & Observability (Days 36-40)
- **Goal**: Prepare for heavy traffic.
- **Tasks**:
  1. Implement Elasticsearch or Redis for fast spatial querying of providers (replacing Prisma `where` clauses for communes).
  2. Set up Sentry for error tracking.
  3. Load test the checkout flow with 100 concurrent users booking the same slot.

---

## Conclusion
By executing this plan strictly in this order, WeTask will establish a secure financial core, unblock operational bottlenecks, and finally layer on conversion-optimized UX, resulting in a true Stripe/Airbnb-tier marketplace architecture.
