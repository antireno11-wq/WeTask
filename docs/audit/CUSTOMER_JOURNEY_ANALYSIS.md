# WeTask — Customer Journey Analysis

## Phase 1: Discovery (Marketplace Browsing)
- **Flow**: User lands on WeTask, views categories, and explores provider profiles.
- **Current State**: Search and filtering are based on simple exact matches or basic Prisma relations (`comuna`, `serviceId`).
- **Issues**:
  - Discovery is highly reliant on manual category selection.
  - No algorithmic ranking of providers (e.g., sorting by rating, response time, or completion rate).
  - The UI for browsing requires heavy DB queries which may slow down the experience.

## Phase 2: Checkout (Booking Flow)
- **Flow**: User selects a service, a provider (or auto-assign), a time slot, enters their address, and proceeds to payment.
- **Current State**: Handled via `/api/bookings/checkout/route.ts`. The API does a good job of validating address coverage and slot availability.
- **Issues**:
  - The flow is rigid. If a customer wants to change details midway, they might lose their slot.
  - Price calculations handle urgency and travel fees, but UI transparency around these fees is crucial for conversion.

## Phase 3: Post-Booking (Execution & Review)
- **Flow**: Customer waits for service, service happens, customer reviews.
- **Current State**: Notifications exist (email via Resend/SendGrid is mocked or basic), but there is no real-time status tracking (e.g., "Provider is on the way").
- **Issues**:
  - Dispute resolution flow is missing from the customer UI.
  - Marking a service as "Completed" is not strictly enforced, which breaks the payout lifecycle.
