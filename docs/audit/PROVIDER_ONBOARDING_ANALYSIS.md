# WeTask — Provider Onboarding Analysis

## Current Architecture
- Modeled around the `CleaningOnboarding` schema which acts as a staging area.
- Uses massive JSON fields (`experienceTypes`, `offeredServices`, `cleaningScope`) to hold complex form state.

## Operational Evaluation
- **Pros**: The `CleaningOnboarding` model isolates unverified data from the live `ProfessionalProfile`, protecting the marketplace from instant manipulation.
- **Cons**: It is extremely monolithic. Any new service category requires a new schema update (e.g., `petScope`, `makeupScope`). 

## Friction Points
1. **Document Uploads**: Asking for Identity Document Front, Back, Selfie, and Criminal Record all at once is intimidating.
2. **Bank Details**: Asking for bank details before a provider is even approved reduces completion rates.

## Recommendation
- Shift to a phased onboarding flow. 
- Phase 1: Basic details + Service Area.
- Phase 2: Identity Verification (Automated via third party).
- Phase 3: Profile Polish (Photos, Descriptions).
- Wait to collect Bank Details until their first booking is completed, leveraging the concept of "Earnings Pending".
