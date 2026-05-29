# WeTask — Financial Integrity Analysis

## Core Principle
WeTask is a financial escrow agent. We collect money, hold it, and distribute it. If the ledger is incorrect, the company loses money or faces legal action.

## 1. Duplicate Charges (The Checkout Race)
- **Risk**: A customer on a slow 3G connection clicks the "Pagar con MercadoPago" button 4 times. 
- **Prevention Model**:
  - The frontend MUST disable the button instantly and show a loading spinner.
  - The backend (`/api/bookings/checkout/route.ts`) MUST generate a deterministic `idempotencyKey` based on: `hash(customerId + serviceId + slotId + price)`.
  - This key is passed to MercadoPago (`X-Idempotency-Key`). MP guarantees that exact same payload with the same key within 24h will not create a new charge, but return the original intent.

## 2. Payment Desync (The Ghost Webhook)
- **Risk**: Customer pays on MercadoPago. MP redirects them back to WeTask. The webhook from MP fails due to a temporary network blip on WeTask's Vercel deployment.
- **Prevention Model**:
  - **Primary**: The MP Webhook handler.
  - **Fallback 1**: When the user is redirected back to the `/booking/success` page, the page's `getServerSideProps` or Server Component MUST fetch the payment status from MP directly using the `payment_id` in the URL, and update the DB if it's still `PENDING`.
  - **Fallback 2**: An hourly async job (Inngest/Cron) sweeps the DB for all `PENDING_PAYMENT` bookings older than 30 mins, queries MP, and rectifies the state.

## 3. Webhook Race Conditions (The Double Processing)
- **Risk**: MercadoPago fires two `payment.updated` webhooks at the exact same millisecond. Both hit the Next.js edge functions. Both read the DB state as `PENDING_PAYMENT`. Both update it to `CONFIRMED`. Both send a "Booking Confirmed" email to the provider.
- **Prevention Model**:
  - Webhooks MUST be processed sequentially per `bookingId` or use strict DB locks.
  - Implementation in Prisma:
    ```typescript
    await prisma.$transaction(async (tx) => {
      // SELECT FOR UPDATE locks the row
      const payment = await tx.$queryRaw`SELECT status FROM Payment WHERE id = ${id} FOR UPDATE`;
      if (payment.status !== 'PENDING') return; // Already processed
      // ... update state
    });
    ```

## 4. Payout Mismatches (The Altered Booking)
- **Risk**: Booking is made for 3 hours ($30,000 CLP). Customer and Provider agree to reduce it to 2 hours ($20,000 CLP) via support. Admin updates the booking price. Later, the payout system still tries to pay out based on the original $30,000.
- **Prevention Model**:
  - The `Payout` record MUST NOT be created at checkout.
  - The `Payout` record is generated **only** when the booking transitions to `COMPLETED`.
  - The Payout generation logic reads the *final* `totalPriceClp` and recalculates the platform fee dynamically at the moment of generation, minus any recorded partial refunds.

## 5. Refund Integrity
- **Risk**: Admin clicks "Refund" twice quickly. MP issues a double refund.
- **Prevention Model**:
  - MercadoPago Refund API calls MUST also include an idempotency key: `hash("refund" + bookingId)`.
  - DB state must update to `REFUNDING_IN_PROGRESS` before calling MP API, blocking any other admin from clicking the button.
