# WeTask — Full Project Audit

## Executive Summary
The WeTask codebase is a Next.js (App Router) application using Prisma as an ORM and a PostgreSQL database. It is designed to be a transactional marketplace for local services (cleaning, ironing, pet care, etc.). The current state of the application contains significant architectural groundwork but is **NOT production-ready**. Several core flows are partially implemented, heavily mocked, or lack robust error handling and security measures necessary for a real-world financial marketplace.

## Stack Analysis
- **Framework**: Next.js 14.2 (App Router)
- **Database**: PostgreSQL with Prisma (v5.20.0)
- **Authentication**: Custom JWT-based cookie authentication (No Clerk, No Supabase).
- **Payments**: MercadoPago custom integration.
- **Styling**: Tailwind CSS.

## Core Systems Status

### 1. Authentication (Partial / Risky)
- Implemented as a custom JWT cookie (`wetask_session`).
- **Risks**: Custom auth is prone to security flaws (token hijacking, lack of proper rotation, CSRF). No robust OAuth (Google/Apple) implementation was found despite the schema having `AuthProvider` enums. Password resets and email verifications are defined but need battle-testing.

### 2. Provider Onboarding & KYC (Mocked / Partial)
- `CleaningOnboarding` model exists.
- KYC is purely manual. The schema holds references to identity documents and background checks.
- **Risks**: Admin review process is highly manual and error-prone. The transition from `CleaningOnboarding` to a live `ProfessionalProfile` lacks robust state machine validation.

### 3. Booking Flow (Implemented but Fragile)
- Checkout route (`/api/bookings/checkout/route.ts`) checks slot availability, creates the booking, and calls MercadoPago.
- **Risks**: If MercadoPago API fails after booking creation, the slot is restored, but concurrent requests could lead to race conditions. Idempotency keys are derived locally which is good, but edge cases in timeout scenarios are not fully mitigated.

### 4. Payments (Implemented / High Risk)
- MercadoPago is integrated via custom REST calls in `src/lib/payments/providers/mercadopago.ts`.
- **Risks**: The webhook handler updates booking states but lacks a strict state machine (e.g., preventing a transition from `CANCELLED` back to `CONFIRMED`). Payouts are entirely manual, relying on the `Payout` schema with no automated ledger.

### 5. Review System (Schema Only / Mocked)
- `Review` model exists.
- **Risks**: No anti-fraud mechanism to ensure reviews are only left by users who actually completed a paid booking.

### 6. Admin Panel (Partial)
- Contains basic views (`admin-hero-shell.tsx`, `admin-cleaning-review-actions.tsx`).
- **Risks**: Extremely limited operational tooling. Support for handling disputes, refunding MercadoPago via UI, and releasing payouts is missing or incomplete.

## Conclusion
The foundation is solid (schema is well thought out), but the operational and execution layers are deeply lacking. The marketplace cannot be launched in its current state without significant risk of financial loss, provider fraud, or customer dissatisfaction.
