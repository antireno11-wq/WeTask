# WeTask — Master Execution Plan

## Phase 0: Codebase Stabilization & Architecture Audit Fixes
- **Objective**: Fix critical security, data integrity, and tech debt issues before adding features.
- **Features**: Implement strict Prisma schema validations, fix Custom JWT auth vulnerabilities, set up secure file uploads (S3/R2).
- **Risks**: High regression risk. Must ensure existing mocked data isn't broken.

## Phase 1: Authentication & Provider Onboarding 
- **Objective**: Move to robust auth and streamline the provider onboarding pipeline.
- **Features**: Migrate to Supabase Auth or Clerk. Implement `CleaningOnboarding` to `ProfessionalProfile` state machine.
- **Risks**: Auth migration requires careful data mapping for existing test users.

## Phase 2: Marketplace Browsing & Listings UX
- **Objective**: Optimize the conversion funnel and trust UI.
- **Features**: Enhance Service Cards, Provider Profiles, and add dynamic search filtering (communes, availability).
- **Risks**: Performance bottlenecks with complex spatial/temporal queries.

## Phase 3: Booking Flow & Availability System
- **Objective**: Bulletproof the booking and calendar system.
- **Features**: Real-time slot locking, bulk availability management for providers, timezone-aware booking UI.
- **Risks**: Deadlocks during concurrent slot bookings.

## Phase 4: MercadoPago Integration & Payment Integrity
- **Objective**: Secure financial transactions.
- **Features**: Strict state machine for Webhooks, idempotency guarantees, robust error handling for MP timeouts.
- **Risks**: Financial loss, duplicate charges.

## Phase 5: Booking Execution & Payout Release Workflow
- **Objective**: Operationalize the post-booking lifecycle.
- **Features**: Customer service verification (mark as done), Admin payout ledger UI, manual payout tracking.
- **Risks**: Provider dissatisfaction if payouts are delayed. Admin bottleneck.

## Phase 6: Reviews & Trust Systems
- **Objective**: Build marketplace trust.
- **Features**: Post-service review prompts, anti-fraud checks (only paid users can review), rating aggregations.
- **Risks**: Fake reviews, retaliatory reviews.

## Phase 7: Admin Operational Tooling
- **Objective**: Give operations team super-powers.
- **Features**: Dispute handling UI, KYC review UI, forced refund triggers, impersonation (for support).
- **Risks**: Admin panel security must be airtight.

## Phase 8: Notifications & Reliability Infrastructure
- **Objective**: Ensure nobody misses a booking.
- **Features**: Email (Resend), SMS (Twilio), In-app notifications. Retry queues for failed notifications.
- **Risks**: Notification spam, failed delivery leading to no-shows.

## Phase 9: Security & Production Hardening
- **Objective**: Prepare for real-world attacks.
- **Features**: Rate limiting, DDoS protection, DB query optimization, PII encryption.
- **Risks**: Exposed sensitive provider KYC data.

## Phase 10: Scalability & Optimization
- **Objective**: Support 10x growth.
- **Features**: Redis caching for marketplace search, read-replicas, image optimization CDN.
- **Risks**: Cache invalidation bugs leading to stale marketplace listings.
