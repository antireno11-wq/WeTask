# WeTask — Provider Journey Analysis

## Phase 1: Onboarding
- **Flow**: Provider registers, fills out `CleaningOnboarding` form, uploads documents.
- **Current State**: Lengthy data model with specific scopes (`cleaningScope`, `petScope`, etc.).
- **Issues**:
  - Very high friction. Uploading multiple documents without instant feedback (automated OCR/KYC) means high drop-off rates.
  - The form state management is complex and prone to data loss if the user refreshes.

## Phase 2: Listing Management
- **Flow**: Once approved, provider sets availability slots and category profiles.
- **Current State**: `TaskerCategoryProfile` and `AvailabilitySlot` models control what the customer sees.
- **Issues**:
  - Calendar management is notoriously difficult to build correctly. If a provider forgets to update their WeTask calendar and gets booked while busy, the platform suffers a severe trust hit.
  - No Google Calendar / iCal sync exists.

## Phase 3: Fulfillment & Payout
- **Flow**: Provider receives booking, does the job, waits for payout.
- **Current State**: Payouts are tracked via the `Payout` model but entirely manual in execution.
- **Issues**:
  - Lack of visibility into payout status will cause massive support volume.
  - No built-in messaging system to communicate with the customer before arrival (or if there is, it lacks safety filters like blocking phone numbers to prevent off-platform transactions).
