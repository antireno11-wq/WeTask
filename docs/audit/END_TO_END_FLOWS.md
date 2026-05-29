# WeTask — End-to-End Flows Analysis

## 1. Provider Flow (Supply Side)
### Current Implementation
- **Registration**: Providers sign up using custom JWT auth. They submit profiles into `CleaningOnboarding` schema.
- **Admin Review**: Manual process. Admin reviews `CleaningOnboarding` and moves it to `ProfessionalProfile`.
- **Listings**: Providers manage `TaskerCategoryProfile` and `AvailabilitySlot`.

### Risks
- Manual transition from Onboarding to Active is error-prone.
- Image uploads (ID, Selfie, Background Check) need secure handling. No clear integration with secure blob storage with presigned URLs.
- Availability slots might be mismanaged if provider timezone changes or if bulk updates fail.

## 2. Customer Flow (Demand Side)
### Current Implementation
- **Browse & Search**: Customers view services. Search relies on Prisma queries filtering active services and available taskers in the user's commune.
- **Auth**: Required before checkout. Custom JWT.
- **Booking**: Customer selects service, tasker (optional), slot (optional), address, and checks out via `/api/bookings/checkout/route.ts`.

### Risks
- Availability slot locking has a basic implementation but under high concurrency could face deadlocks or race conditions.
- If a customer drops out mid-checkout, the availability slot might be locked or MercadoPago intent left dangling.

## 3. Payment Flow
### Current Implementation
- **Money Flow**: Customer -> MercadoPago -> WeTask. Payouts are manually created and tracked via `Payout` schema.
- **Checkout**: Creates `Booking` as `PENDING_PAYMENT`, `Payment` as `PENDING`. Calls MercadoPago to create intent.
- **Webhook**: `/api/payments/webhook/mercadopago/route.ts` listens for MP events and updates Booking to `CONFIRMED` or `PAYMENT_FAILED`.

### Risks
- Webhook relies on MercadoPago `data.id` resolving perfectly. If MP changes payload structure, webhooks fail.
- Idempotency key logic is good, but replay attacks on webhooks must be strictly prevented.
- Duplicate webhooks could cause multiple `CONFIRMED` notifications.

## 4. Service Execution & Review Flow
### Current Implementation
- **Execution**: Status changes are mostly manual or missing.
- **Payout**: Purely manual tracking (`Payout` model).
- **Review**: `Review` schema exists, but anti-fraud is missing.

### Risks
- No automated escrow release or automated split logic. Admin burden scales linearly with bookings.
- Customer-provider disputes have a `DisputeTicket` model but lack operational UI.
