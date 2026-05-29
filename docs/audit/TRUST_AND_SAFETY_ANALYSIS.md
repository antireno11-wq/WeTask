# WeTask — Trust & Safety Analysis

A marketplace is only as strong as its weakest provider. If customers do not feel safe letting strangers into their homes, the business fails.

## Risks & Mitigations

### 1. The "Fake Provider" Risk
- **Risk**: A bad actor signs up using a stolen ID to scope out homes for theft.
- **Mitigation**: Manual KYC is a start, but human eyes cannot detect deepfakes or stolen identities easily. 
- **Action**: Implement a third-party liveness check (e.g., user must record a 3-second video moving their head) paired with automated government ID validation (SumSub, Stripe Identity).

### 2. Platform Leakage (Off-Platform Payments)
- **Risk**: Customer and Provider use WeTask for the first cleaning, exchange phone numbers, and do all future cleanings off-platform for cash.
- **Mitigation**: 
  - Obfuscate phone numbers in the chat interface. Only reveal numbers 2 hours before the booking.
  - Incentivize sticking to the platform by offering WeTask guarantee insurance (e.g., "If something breaks, we cover up to $1,000,000 CLP, but only if booked here").

### 3. Review Manipulation
- **Risk**: Providers create fake customer accounts to book themselves for 1 hour, pay the platform fee, and leave a 5-star review.
- **Mitigation**: 
  - Rate limiting (e.g., a customer can't review the same provider 5 times in a week).
  - Device fingerprinting or IP tracking to ensure Customer and Provider aren't logging in from the same WiFi.

### 4. Provider No-Shows & Reliability
- **Risk**: Provider cancels 30 minutes before a 5-hour deep cleaning. Customer is furious.
- **Mitigation**:
  - Automatic penalty system. If a provider cancels within 24h, they are auto-suspended for 7 days or lose their "Super Provider" badge.
  - WeTask must have a "Backup Provider" operations protocol where the Admin calls available providers and offers them a 2x bonus to cover the dropped shift.
