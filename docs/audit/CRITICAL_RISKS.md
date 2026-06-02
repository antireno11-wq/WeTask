# WeTask — Critical Risks

## 1. Authentication Security
- **Current State**: Custom JWT cookie implementation (`wetask_session`).
- **Risk**: Lacks robust session invalidation, MFA, and automated password reset flows. If a token is stolen, there is no easy way to revoke it without changing the secret key and logging everyone out.
- **Severity**: Critical.

## 2. Payment Webhook Race Conditions
- **Current State**: `/api/payments/webhook/mercadopago/route.ts` updates booking state based on MercadoPago events.
- **Risk**: If MP sends duplicate webhooks or out-of-order webhooks (e.g., `refunded` arrives before `approved`), the final state might be incorrect. The state machine is currently implicit, not explicitly guarded.
- **Severity**: Critical (Financial).

## 3. Provider Onboarding & KYC Fraud
- **Current State**: Manual admin review of uploaded documents.
- **Risk**: Lack of automated verification means bad actors can easily submit fake IDs. The operational bottleneck of manual review will choke supply growth. Furthermore, storing unencrypted IDs/Background checks is a massive liability.
- **Severity**: High (Legal/Operational).

## 4. Availability Slot Deadlocks
- **Current State**: Booking checkout uses `updateMany` to lock an availability slot.
- **Risk**: While basic locking exists, high concurrency for popular providers could lead to checkout failures or deadlocks if the transaction takes too long to resolve MP API calls.
- **Severity**: Medium.

## 5. Manual Payouts Bottleneck
- **Current State**: WeTask collects all funds; payouts are manual.
- **Risk**: As volume grows, manually calculating and initiating bank transfers for every provider will become impossible. Mistakes will lead to overpayments or missing payouts, destroying provider trust.
- **Severity**: High (Operational).
