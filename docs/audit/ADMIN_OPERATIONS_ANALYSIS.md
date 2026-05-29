# WeTask — Admin Operations Analysis

## Current Reality
The current WeTask admin capabilities are heavily restricted, putting the entire operational burden on manual database edits or rudimentary UI panels.

## 1. KYC & Provider Approval
- **Process**: Admin reads `CleaningOnboarding` records, views S3/uploaded images of IDs, and manually clicks "Approve".
- **Risk**: Extremely slow. Cannot scale past 10-20 providers a day. High risk of human error (e.g., missing expired IDs).
- **Need**: Integration with SumSub or Persona for automated KYC.

## 2. Payouts Management
- **Process**: Admin looks at `COMPLETED` bookings, calculates platform fees, manually creates a bank transfer via their corporate bank account, and updates the DB status to `PAID_OUT`.
- **Risk**: Accounting nightmare. Prone to double-paying or forgetting to pay.
- **Need**: Batch payout generation (e.g., exporting a CSV formatted for the bank) or automated Stripe Connect/MercadoPago Split Payments.

## 3. Dispute & Support
- **Process**: A `DisputeTicket` model exists.
- **Risk**: No real-time tooling. If a provider no-shows, the admin needs a "God Mode" to immediately refund the MercadoPago transaction and rebook the customer.
- **Need**: An Admin Dashboard with deep hooks into the MercadoPago API to issue partial or full refunds instantly.
