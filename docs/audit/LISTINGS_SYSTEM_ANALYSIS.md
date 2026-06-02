# WeTask — Listings System Analysis

## Current Architecture
- Listings are dynamically generated from `TaskerCategoryProfile` and `TaskerService` joined with the `ProfessionalProfile`.
- A listing comprises a category (e.g., "Limpieza"), specific services (e.g., "Limpieza Profunda"), pricing, and available communes.

## Flexibility & Constraints
- The schema is highly normalized. `TaskerService` links a specific `Service` to a `ProfessionalProfile` and defines the `priceClp`.
- **Constraint**: Managing this from the provider's perspective requires a highly intuitive UI. If the provider cannot easily toggle services on/off or bulk-update pricing, they will abandon the platform.

## Marketplace Integrity
- Providers dictate their own `priceClp`. While this is standard for open marketplaces (like TaskRabbit), it can lead to massive price discrepancies.
- WeTask applies a platform fee on top (or inclusive) of this base price.

## Recommendation
- Implement strict "Suggested Pricing" constraints to avoid a race to the bottom or absurdly high pricing that damages marketplace perception.
- Build a robust Calendar Sync. A listing is useless if the `AvailabilitySlot` data is stale.
