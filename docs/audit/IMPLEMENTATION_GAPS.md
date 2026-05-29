# WeTask — Implementation Gaps

## What is Missing for Launch?

### 1. Robust Payout Engine
- **Gap**: Providers have no way to withdraw money or see their earnings ledger.
- **Action**: Build a Payout Dashboard for providers. Integrate a batch payout system for Admins.

### 2. Dispute Resolution UI
- **Gap**: Customers can open a dispute, but there is no Admin UI to view the evidence, chat with both parties, and issue partial refunds via MercadoPago.
- **Action**: Build the `Admin > Disputes` view with direct MP Refund API integration.

### 3. Comprehensive Notifications
- **Gap**: Critical emails/SMS (e.g., "Provider is arriving in 30 mins", "Payment failed") are mostly mocked or incomplete.
- **Action**: Integrate Resend + Twilio into a centralized Notification Service.

### 4. Marketplace Discovery Enhancements
- **Gap**: Search relies on manual filtering and exact string matching. No intelligence on who is highly rated or close by.
- **Action**: Implement algorithmic sorting for provider cards to boost conversion.

### 5. Automated KYC Workflow
- **Gap**: Reviewing `CleaningOnboarding` records manually does not scale.
- **Action**: Integrate SumSub for automated document and liveness checks before hitting the Admin queue.
