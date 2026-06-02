# PAYMENTS_ANALYSIS.md — Money flow audit (critical)

## TL;DR

There are **two parallel payment paths** in the codebase:

1. `POST /api/bookings/checkout` — **REAL** MercadoPago integration with idempotency, slot locking and `$transaction` rollback. Production-grade modulo signature & webhook idempotency.
2. `POST /api/marketplace/bookings/[bookingId]/payment/confirm` — **SIMULATED**. Sets `paymentStatus="PAID"`, writes `providerPaymentId: "sim_<bookingId>"`, never charges anything.

Both are reachable by an authenticated CUSTOMER. The second one is a **free-money exploit**.

There are **no automated payouts**. `Payout` rows are created `PENDING` and never advance. Taskers will not be paid by the system as it stands.

## MercadoPago integration ([src/lib/payments/providers/mercadopago.ts](../src/lib/payments/providers/mercadopago.ts))

REAL functions implemented:
- `createMercadoPagoPayment` — `POST /v1/payments` with `X-Idempotency-Key` header (line 218-222).
- `getMercadoPagoPayment` — `GET /v1/payments/{id}` (line 245-265).
- `refundMercadoPagoPayment` — `POST /v1/payments/{id}/refunds` (line 267-305).
- `ensureMercadoPagoCustomer` / `createMercadoPagoCustomer` / `findMercadoPagoCustomerByEmail` — `/v1/customers[/search]`.
- `createMercadoPagoCustomerCard` / `listMercadoPagoCustomerCards` / `deleteMercadoPagoCustomerCard` — `/v1/customers/{id}/cards`.
- `checkMercadoPagoHealth` — probes credentials and tries an inert search.

Provider adapter abstraction at `src/lib/payments/provider-adapter.ts` dispatches to the MP implementation.

## Path 1 — Production checkout (REAL) ([src/app/api/bookings/checkout/route.ts](../src/app/api/bookings/checkout/route.ts))

Sequence:
1. Identity check (`CUSTOMER` or `ADMIN`).
2. Zod validate.
3. Resolve service + category + customer.
4. Resolve assigned pro / slot, recompute hourly rate from `TaskerService.priceClp`.
5. Validate coverage commune (`taskerServesCommune`).
6. Compute price via `calculateMarketplacePrice` — recomputed server-side, ignoring any client-supplied price.
7. Bail if MP credentials missing (`/v1/customers` probe earlier).
8. Derive idempotency key:
   `idempotencyKey = sanitizeIdempotencyKey(input.idempotencyKey ?? "checkout_${customerId}_${slotId}_${startsAt}_${total}")`.
9. Return cached response if `Payment.idempotencyKey` matches an existing row.
10. **In `$transaction`**: optimistic-lock slot (`updateMany where isAvailable=true`), create `Address`, create `Booking` with `status:"PENDING_PAYMENT"`, create `Payment` with `status:"PENDING"`.
11. Call `createMercadoPagoPayment` (outside the transaction, so the DB writes commit even if the provider call later fails).
12. On provider error: roll back to `FAILED` state and **release the slot** via a second transaction.
13. On provider success: in a second `$transaction`, write provider details and transition booking to `CONFIRMED`/`PENDING_PAYMENT`/`PAYMENT_FAILED`/`REFUNDED` based on `mapStatus`.
14. Fire `Notification` rows and (outside the transaction) the booking-status email.

**Strengths:**
- Server recomputes the price; client cannot under-pay.
- Real MP API call.
- Idempotency at the DB level.
- Optimistic slot lock.
- Proper rollback on failure.

**Weaknesses:**
- The idempotency key includes `selectedSlotId` and `customerId`, but if a user retries with the same parameters at exactly the same `startsAt`, the second request returns the original booking even if the first failed and was released. Acceptable.
- Provider call happens outside the transaction; if the process dies after MP charges but before the second `$transaction` commits, the DB sees `Payment.status="PENDING"` with a charged MP payment — orphaned. Webhook handler recovers this only if the user uses the `external_reference`/`metadata.booking_id` correctly, which the code does set ([src/app/api/bookings/checkout/route.ts:378](../src/app/api/bookings/checkout/route.ts#L378)).
- No reconciliation cron to catch persistently-pending payments.

## Path 2 — Simulated payment confirm (DANGEROUS) ([src/app/api/marketplace/bookings/[bookingId]/payment/confirm/route.ts](../src/app/api/marketplace/bookings/[bookingId]/payment/confirm/route.ts))

Sequence:
1. Identity check (`CUSTOMER` or `ADMIN`).
2. Fetch booking + payment.
3. If `paymentStatus === "PAID"` return early.
4. **In `$transaction`**: lock the slot, then either:
   - Update existing `Payment`: set `status:"PAID"`, `paidAt: now`, `providerPaymentId: "sim_<bookingId>"` (if not already set).
   - Create new `Payment`: `provider:"STRIPE"`, `status:"PAID"`, `paidAt: now`, `providerPaymentId: "sim_<bookingId>"`.
5. Update booking to `CONFIRMED` if pro assigned, else `PENDING`.
6. Insert notifications.

**Why this is critical:**
- No payment-method validation. No MP call. The customer (or anyone who can guess a booking id of their own) marks the booking PAID.
- The booking then enters the rest of the lifecycle as a paid booking — the assigned tasker performs work, the system schedules a payout, and even though `Payout.status` never advances, the financial trust signal is corrupted.
- This is reachable from the customer UI/`/cliente/reservas/[id]` after a booking is created by the legacy `POST /api/marketplace/bookings` (which never calls MP).
- Even if frontend never calls it, an authenticated user can call it directly.

## Webhook ([src/app/api/payments/webhook/mercadopago/route.ts](../src/app/api/payments/webhook/mercadopago/route.ts))

```ts
const providerPaymentId = req.nextUrl.searchParams.get("data.id") ?? body?.data?.id ?? body?.id;
const providerResult = await getProviderPayment("MERCADOPAGO", providerPaymentId);
// finds payment by providerPaymentId OR booking external_reference
// updates Payment + Booking + (if PAYMENT_FAILED) releases slot
```

**What is present:**
- Re-fetches the payment via server credentials — even if anybody hits this endpoint with a forged `data.id`, the server only believes MP's response.
- Idempotent in practice — repeat webhooks just overwrite the same state with the same data.
- Resolves payment via two keys (provider id and external_reference) — robust to early-arriving webhooks.

**What is missing:**
- **No signature verification.** MercadoPago can send an `x-signature` header per their docs; this code ignores it. Allows webhook spoofing to cause DB churn / log spam (not a money loss because of the re-fetch).
- **No processed-event registry.** Two parallel webhooks for the same payment cause two DB updates.
- **Always returns 200** even on internal errors via the outer catch — but errors return 400, which MP will retry. Acceptable.
- **`sendBookingStatusEmailToCustomer` is `void`-fired** — failures invisible.

## Refunds

Two paths exist; only one actually refunds money.

### `/api/admin/payments/refund` — REAL ([src/app/api/admin/payments/refund/route.ts](../src/app/api/admin/payments/refund/route.ts))
- Calls `refundProviderPayment("MERCADOPAGO", ...)`.
- Refuses if `provider !== "MERCADOPAGO"` or `providerPaymentId` missing.
- Inside `$transaction`, marks `Payment.status="REFUNDED"`, `Booking.status="REFUNDED"`.

### `/api/marketplace/admin/disputes` PATCH — FAKE ([src/app/api/marketplace/admin/disputes/route.ts:71-83](../src/app/api/marketplace/admin/disputes/route.ts#L71-L83))
```ts
if (input.status === "RESOLVED" && refundAmountClp > 0) {
  await prisma.booking.update({ ... status: "REFUNDED", paymentStatus: "PARTIAL_REFUNDED" });
  await prisma.payment.updateMany({ ... status: "PARTIAL_REFUNDED" });
}
```
**No MercadoPago call.** Admin "resolves" a dispute with a refund; system records the refund; **money never goes back to the customer**. Customer support ticket → chargeback → bank fees → reputational damage.

## Payouts

Path: PRO completes service → customer confirms → either PRO calls `/payout/request` or cron-equivalent sweeps `/payouts/process-timeouts` → `Payout` row created.

`Payout.status` lifecycle:
- Created with `"PENDING"`.
- **Never set to `PROCESSING`, `PAID`, or `FAILED` in any code path.**
- `PayoutStatus` enum and `Booking.PAYOUT_SCHEDULED` / `PAID_OUT` statuses are defined for a workflow that does not yet exist in the code.

Implications:
- The tasker side of the marketplace economy is **not closed**. Even if every customer pays via the real path, no money is transferred to taskers. Admin must export `Payout` rows and pay manually via MP web UI or bank transfer.
- Combined with the simulated-payment exploit, a malicious customer can create "paid" bookings, the system schedules a payout, the tasker performs the work, and nobody is paid (worse than the no-payout problem alone).

## Dispute → payout freeze

[/payout/request](../src/app/api/marketplace/bookings/[bookingId]/payout/request/route.ts#L26-L35) does check `disputeTicket where status in ["OPEN","IN_REVIEW"]` and refuses. ✅

But `/payouts/process-timeouts` also checks ([route.ts:33](../src/app/api/marketplace/payouts/process-timeouts/route.ts#L33)). ✅

So the freeze works at the boundaries. However:
- Existing `Payout` rows are not retroactively cancelled if a dispute is later opened (impossible today since payouts are never `PAID`, but a future settlement layer must respect this).
- Dispute status `IN_REVIEW` blocks payouts; once `RESOLVED`/`CLOSED`, payouts unfreeze even if the resolution did not actually refund.

## Idempotency, concurrency, race conditions

- ✅ Production checkout uses `Payment.idempotencyKey @unique` + MP `X-Idempotency-Key` header.
- ✅ Slot lock via `updateMany where isAvailable=true` in `$transaction`.
- ⛔ Legacy `POST /api/marketplace/bookings` does not lock the slot — two concurrent bookings can both win.
- ⛔ Webhook handler has no `ProcessedWebhook` deduplication table.
- ⛔ Manual refund + dispute resolution can race; nothing prevents a double refund (admin clicks resolve, then also clicks "refund" in the dedicated admin tool).
- ⛔ `pro-review` upsert can be called twice; second call overwrites the first review silently.

## PCI scope

- The code never touches raw card PAN / CVV. Tokens are created client-side via MercadoPago.js (the public key `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` is exposed). The backend only stores `cardId` references from MP.
- PCI scope is therefore **SAQ-A-ish**, consistent with using MP's tokenisation.

## Currency

- Hardcoded `"CLP"`. Integer cents (`amountClp`) — no float rounding issues.
- No FX, no multi-currency.

## Concrete production failure scenarios

1. **Customer marks booking PAID via `/payment/confirm` without paying.** Money loss: 100% of fraudulent bookings.
2. **Admin "refunds" a dispute via the disputes UI.** Money never returns to customer; chargeback risk + customer support cost.
3. **Tasker completes a booking and customer confirms.** Payout row created `PENDING`. Tasker never paid by the system.
4. **MP webhook arrives twice for the same payment.** No idempotency log — duplicate notifications fire.
5. **MP service blip during checkout.** Checkout returns 502 to the user; slot is released — recoverable. But if process dies between MP success and DB second transaction commit: orphaned charge, webhook eventually reconciles (correct), unless the booking was deleted in the meantime.
6. **`SESSION_SECRET` missing.** Attacker forges admin cookie, calls `/api/admin/payments/refund` to refund their own purchase.

## Recommended priority fixes

1. **Delete or harden `/api/marketplace/bookings/[id]/payment/confirm`.** Either remove entirely (let only the real `/api/bookings/checkout` create payments), or verify a real `providerPaymentId` against MP `getProviderPayment` before flipping state.
2. **Wire dispute resolution to `refundProviderPayment`.** Make the admin disputes PATCH call MP refunds when a refund amount is set.
3. **Implement payout settlement.** Either integrate MercadoPago Money Out / bank-transfer SDK, or formalise a manual settlement script that writes `Payout.status` transitions with a CSV import of bank-confirmation IDs.
4. **Verify MP webhook signature** (`x-signature`/`x-request-id` per MP docs) and store a `ProcessedWebhook` row keyed on event id.
5. **Add reconciliation cron**: every 5 min, list `Payment.status=PENDING` older than 10 min, call `getProviderPayment`, update.
6. **Make `pro-review` idempotent** (constraint: one review per booking per author).
7. **Add admin audit log** for every refund, payout state change, and dispute resolution.
