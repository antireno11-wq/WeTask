# WeTask — Marketplace Failure Scenarios

A robust marketplace anticipates failure. Here are the most dangerous scenarios WeTask must handle.

## 1. The "Ghost Booking"
- **Scenario**: Customer books a service. Webhook from MP is delayed. The 15-minute checkout timeout expires and unlocks the slot. 5 minutes later, the MP webhook arrives saying `approved`. 
- **Result**: Customer paid, but the slot was released and might have been booked by someone else.
- **Handling Protocol**:
  - The Webhook handler MUST check if the `AvailabilitySlot` is still assigned to this booking. If it has been taken by another `CONFIRMED` booking, the system must IMMEDIATELY trigger an automatic refund via MercadoPago API and email the customer: "We're sorry, your payment was delayed and the slot was taken. We have refunded you."

## 2. The "Overlapping Payout"
- **Scenario**: A provider completes two jobs in one day. Admin processes payout for Job 1. Before it clears, Admin accidentally processes a batch payout for both Job 1 and Job 2.
- **Result**: Provider is double-paid.
- **Handling Protocol**:
  - The `Payout` table MUST have a unique constraint on `bookingId` to prevent duplicate payout rows.
  - State transition must be strict: If `status === 'PROCESSING'`, reject any new payout attempts.

## 3. Provider Ransom
- **Scenario**: Provider arrives at the house, looks at the job, and says "This will cost 50% more, give me cash now or I leave."
- **Result**: Customer feels extorted.
- **Handling Protocol**:
  - Clear UX in the app: "Never pay in cash. All extras must be requested through the app."
  - If a provider is reported for this, they hit an immediate `SUSPENDED` state pending investigation.

## 4. The Payment Desync
- **Scenario**: Customer pays. MercadoPago says `approved`. Database goes down before the webhook is processed.
- **Result**: WeTask has the money, but WeTask DB says `PENDING_PAYMENT`.
- **Handling Protocol**:
  - Nightly Reconciliation Job. Fetch all `PENDING_PAYMENT` bookings older than 2 hours. Hit MercadoPago API. If MP says `paid`, sync the database and execute the `CONFIRMED` side effects (emails, notifications).
