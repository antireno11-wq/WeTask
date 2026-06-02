# WeTask — Operational Bottlenecks

As WeTask scales from 10 to 1,000 bookings a week, these systems will break first.

## 1. The KYC Backlog
- **Current Process**: Admin manually reviews every uploaded ID and selfie.
- **The Break Point**: At 50 signups a day, an admin will spend 4 hours just squinting at photos. Providers will be stuck in `PENDING_REVIEW` for days, leading to supply-side churn.
- **Solution**: Implement fully automated ID verification (Stripe Identity / SumSub) that instantly transitions providers to `APPROVED` if they pass, leaving only the 5% of edge cases for manual admin review.

## 2. Manual Payouts
- **Current Process**: Admin calculates fees, opens BancoEstado/Santander, manually types RUT and account numbers, and sends money.
- **The Break Point**: At 100 completed jobs a week, this becomes a full-time accounting job highly prone to typos. A single wrong digit delays a provider's pay, destroying trust.
- **Solution**: Generate standardized bank-transfer CSV files directly from the Admin Panel, or integrate an automated payout API (like Fintoc or MercadoPago Split if supported locally).

## 3. Customer Support Routing
- **Current Process**: Customers email a generic `support@wetask.cl` address.
- **The Break Point**: Admins won't know which booking the customer is emailing about. Resolving a simple issue takes 5 back-and-forth emails.
- **Solution**: In-app "Report Issue" button on the booking details page that automatically attaches the `bookingId`, Provider details, and creates a pre-populated `DisputeTicket` in the Admin Dashboard.
