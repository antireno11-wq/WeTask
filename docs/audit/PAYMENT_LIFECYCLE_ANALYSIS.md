# WeTask — Payment Lifecycle Analysis

## The Happy Path
1. **Checkout Initiated**: Booking created (`PENDING_PAYMENT`). Payment record created (`PENDING`).
2. **MercadoPago Called**: MP returns `approved`.
3. **Webhook Received**: System updates Booking to `CONFIRMED`.
4. **Service Completed**: Customer or Pro marks it done (Status -> `COMPLETED`).
5. **Payout Scheduled**: Admin queues the payout (Status -> `PAYOUT_SCHEDULED`).
6. **Payout Sent**: Admin transfers money (Status -> `PAID_OUT`).

## The Unhappy Paths (Risks)

### Failed Payments
- If MP returns `failed`, the system frees up the availability slot. This is handled correctly in the current `/api/bookings/checkout/route.ts`.

### Customer Cancels (Refunds)
- Currently, refunds require manual API calls or admin intervention. If a customer cancels within the free cancellation window, the system must hit MercadoPago's Refund API.
- **Risk**: Partial refunds (e.g., late cancellation fees) are complex and not fully modeled.

### Provider No-Show
- If the provider never arrives, the money is still sitting in WeTask's MercadoPago account.
- **Risk**: The customer must complain, open a `DisputeTicket`, and the admin must manually verify and issue the refund. This creates high operational drag.

## Architecture Verdict
The ledger is split across `Booking`, `Payment`, and `Payout` tables. This is standard, but lacks an immutable ledger table (e.g., `LedgerEntry` or `Transaction`) to track debits and credits securely. Relying purely on status enums for financial tracking is risky at scale.
