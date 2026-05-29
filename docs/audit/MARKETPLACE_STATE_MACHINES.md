# WeTask — Marketplace State Machines

This document defines the strict allowed transitions for the critical models. 

## 1. Booking State Machine

**States**: `CREATED`, `PENDING_PAYMENT`, `PAYMENT_FAILED`, `CONFIRMED`, `IN_PROGRESS`, `AWAITING_CUSTOMER_CONFIRMATION`, `COMPLETED`, `CANCELLED`, `DISPUTE`, `REFUNDED`

### Allowed Transitions & Triggers:
- `CREATED` -> `PENDING_PAYMENT`: User clicks "Pay".
- `PENDING_PAYMENT` -> `CONFIRMED`: MP Webhook `approved`.
- `PENDING_PAYMENT` -> `PAYMENT_FAILED`: MP Webhook `rejected` or Checkout Timeout.
- `PAYMENT_FAILED` -> `PENDING_PAYMENT`: User retries with new card.
- `CONFIRMED` -> `IN_PROGRESS`: Automated cron (Start Time reached) OR Provider clicks "Start Job".
- `IN_PROGRESS` -> `AWAITING_CUSTOMER_CONFIRMATION`: Automated cron (End Time reached) OR Provider clicks "Finish Job".
- `AWAITING_CUSTOMER_CONFIRMATION` -> `COMPLETED`: Customer clicks "Approve Service" OR automated 48-hour timeout.
- `CONFIRMED` -> `CANCELLED`: Customer/Provider cancels before start time.
- `COMPLETED` -> `DISPUTE`: Customer opens ticket within 48 hours of completion.
- `DISPUTE` -> `COMPLETED`: Admin resolves in favor of Provider.
- `DISPUTE` -> `REFUNDED`: Admin resolves in favor of Customer.

### Admin Interventions:
- Admin can force transition to `CANCELLED` or `REFUNDED` from any state prior to `COMPLETED`.
- Admin can force transition to `COMPLETED` from `DISPUTE`.

## 2. Payment State Machine

**States**: `PENDING`, `AUTHORIZED`, `PAID`, `FAILED`, `REFUNDED`, `PARTIAL_REFUNDED`

### Allowed Transitions & Triggers:
- `PENDING` -> `PAID`: MP Webhook `approved`.
- `PENDING` -> `FAILED`: MP Webhook `rejected`.
- `PAID` -> `REFUNDED`: Admin clicks "Full Refund" -> API call to MP.
- `PAID` -> `PARTIAL_REFUNDED`: Admin clicks "Partial Refund" -> API call to MP.

### Guardrails:
- A `REFUNDED` payment CANNOT transition back to `PAID`.
- If a webhook tries to transition `FAILED` to `PAID`, it requires strict idempotency and timestamp checking to ensure it's not an out-of-order delayed message.

## 3. Payout State Machine

**States**: `PENDING`, `PROCESSING`, `PAID`, `FAILED`

### Allowed Transitions & Triggers:
- `PENDING` -> `PROCESSING`: Admin selects booking batch and clicks "Initiate Payouts".
- `PROCESSING` -> `PAID`: Bank confirms transfer success.
- `PROCESSING` -> `FAILED`: Bank rejects (e.g., wrong RUT).
- `FAILED` -> `PENDING`: Admin corrects bank details and retries.

### Side Effects:
- `PAID`: Provider receives Email/Push Notification: "Your funds are on the way".
