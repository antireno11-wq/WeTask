# WeTask — Operational Timelines

A transactional marketplace runs on the clock. This document outlines the exact temporal flow of a transaction.

## The Perfect Transaction Timeline

**T-Minus 3 Days:**
- Customer books slot.
- Funds are captured by MercadoPago and held by WeTask.
- Notification sent to Provider.

**T-Minus 24 Hours:**
- **Async Job**: System sends reminder email/SMS to Customer: "Your service is tomorrow at 10 AM."
- **Async Job**: System sends reminder to Provider: "You have a job tomorrow at 10 AM. Don't be late."

**T-Zero (Service Start - 10:00 AM):**
- Booking state transitions from `CONFIRMED` to `IN_PROGRESS`.
- **Async Job**: If Provider hasn't opened the app/acknowledged within 30 mins, escalate to Admin.

**T-Plus 2 Hours (Service End - 12:00 PM):**
- Booking state transitions to `AWAITING_CUSTOMER_CONFIRMATION`.
- **Async Job**: Send notification to Customer: "Has the provider finished? Please confirm."

**T-Plus 24 Hours:**
- **Async Job**: Send reminder to Customer: "Please confirm service completion to release payment."

**T-Plus 48 Hours:**
- **Auto-Approval Cron**: If the customer hasn't replied, the system assumes success.
- State transitions to `COMPLETED`.
- Funds are unlocked. Booking added to `PENDING` Payout queue.
- **Side Effect**: Review phase opens.

**T-Plus 7 Days:**
- **Admin Operations Day (e.g., Every Tuesday)**: Admin processes all `PENDING` payouts from the previous week.
- Payout state transitions to `PAID`.

## The Failure Timelines

### Cancellation by Customer (T-Minus 48h)
- Full refund automatically issued via MercadoPago API.
- Slot unblocked for the provider.

### Cancellation by Customer (T-Minus 2h)
- Late cancellation policy applies.
- MP Payment is partially refunded (e.g., 50%). WeTask retains platform fee, Provider receives partial payout.

### Provider No-Show (T-Plus 1 Hour)
- Customer clicks "Provider didn't arrive".
- Booking moves to `DISPUTE`.
- Admin reviews chat logs. If true, Admin forces `REFUNDED`, strikes provider profile (reduces trust score), and helps customer rebook.

### Payment Timeout (T-Zero Checkout)
- Customer abandons checkout.
- **Async Job**: After 15 minutes, the `AvailabilitySlot` lock is released automatically so others can book.
