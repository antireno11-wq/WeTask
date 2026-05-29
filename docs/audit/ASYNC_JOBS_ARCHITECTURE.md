# WeTask — Async Jobs Architecture

A marketplace cannot rely entirely on synchronous user requests (like clicking a button) to move state forward. Background processing is strictly required for reliability and operational scaling.

## Recommended Stack
- **Option A**: Inngest or Trigger.dev (Best for Next.js App Router, fully typed, resilient).
- **Option B**: Redis + BullMQ (Requires a separate worker server).
- *Recommendation: Inngest for Vercel/Railway compatibility without extra server costs.*

## Critical Async Jobs Needed

### 1. Booking Checkout Timeout (15 mins)
- **Trigger**: When a booking is created (`PENDING_PAYMENT`).
- **Action**: Sleeps for 15 mins. Wakes up, checks if status is still `PENDING_PAYMENT`. If so, transitions booking to `PAYMENT_FAILED` and unlocks the `AvailabilitySlot`.

### 2. Service Reminders (T-24h, T-2h)
- **Trigger**: When booking becomes `CONFIRMED`.
- **Action**: Schedules jobs at `StartsAt - 24h` and `StartsAt - 2h` to send Emails/SMS to the customer and provider.

### 3. Auto-Complete Service (T+48h)
- **Trigger**: When booking status changes to `AWAITING_CUSTOMER_CONFIRMATION`.
- **Action**: Schedules job for 48 hours later. If status hasn't changed to `DISPUTE` or `COMPLETED`, forcefully moves it to `COMPLETED` and queues the payout.

### 4. Review Unlock & Publishing
- **Trigger**: When service is `COMPLETED`.
- **Action**: Schedules a job 14 days out. If only one party reviewed, it forces publication of that review so the other party can no longer retaliate.

### 5. MercadoPago Reconciliation (Nightly)
- **Trigger**: Nightly Cron Job.
- **Action**: Fetches all `PENDING` payments older than 24 hours from WeTask DB. Queries MercadoPago API directly. If MP says they are failed/abandoned, updates WeTask DB to sync states.

## Failure Handling (Dead Letter Queues)
- If a webhook or job fails (e.g., SendGrid is down, MercadoPago times out), the Async Job engine must automatically retry with exponential backoff (e.g., 1 min, 5 mins, 1 hour).
- If it fails 5 times, it gets sent to a Dead Letter Queue (DLQ) and an alert fires to the Admin Slack/Discord channel.
