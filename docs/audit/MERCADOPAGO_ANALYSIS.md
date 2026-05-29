# WeTask — MercadoPago Analysis

## Current Implementation
- **Integration**: Direct REST API calls to MercadoPago using `fetch` in `src/lib/payments/providers/mercadopago.ts`.
- **Checkout**: Creates payments via `/v1/payments`. Collects `token`, `payment_method_id`, `issuer_id`.
- **Webhooks**: Handled via `/api/payments/webhook/mercadopago/route.ts`.

## Flaws & Risks
### 1. Manual Integration
- By not using the official MercadoPago Node.js SDK, WeTask risks missing out on automatic retries, type safety for complex payloads, and backward compatibility handling.

### 2. Webhook Fragility
- Webhook relies on `req.nextUrl.searchParams.get("data.id")` or body parsing. MercadoPago webhook payloads can vary based on the event type (e.g., `payment.created`, `payment.updated`). If the parser misses an edge case, a successful payment might remain `PENDING` in WeTask.

### 3. Idempotency & Retries
- Idempotency keys are used when creating the payment, which is excellent. However, webhook idempotency is not strictly enforced. Processing the same webhook twice could trigger duplicate emails or incorrect state transitions if not wrapped in a strict transaction.

### 4. Payouts (The Missing Half)
- MercadoPago is only used for *collection* (Customer -> WeTask). 
- There is no implementation for *disbursement* (WeTask -> Provider). If using MercadoPago for payouts, it requires complex OAuth flows or manual transfers.

## Execution Recommendation
- **Refactor Webhooks**: Implement a strict, database-locked state machine for Webhooks. Only allow valid transitions (e.g., PENDING -> PAID, never REFUNDED -> PAID).
- **Adopt SDK**: Consider moving to the official MercadoPago SDK to reduce boilerplate and edge-case errors.
