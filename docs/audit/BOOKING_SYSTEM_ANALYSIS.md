# WeTask — Booking System Analysis

## Core Mechanics
- The `Booking` model is the central source of truth for the transaction lifecycle.
- State transitions: `PENDING` -> `PENDING_PAYMENT` -> `CONFIRMED` -> `IN_PROGRESS` -> `COMPLETED` -> `PAYOUT_SCHEDULED` -> `PAID_OUT`.

## Technical Weaknesses
1. **Concurrency Control**: 
   - Uses Prisma's `updateMany` for locking availability slots during checkout. This is optimistic but could fail under heavy load. A dedicated Redis lock or strict Postgres advisory locks would be safer.
2. **State Machine Enforcement**:
   - There is no central code enforcing valid state transitions. Code scattered across API routes can technically update a booking from `CANCELLED` back to `CONFIRMED`.
3. **Availability Management**:
   - `AvailabilitySlot` uses explicit start/end times. Finding a matching slot requires intersection logic which is currently done via code (`requestedStartMs >= slotStartMs`). This is fine for low volume, but terrible for DB-level searching and filtering.

## Execution Requirements
- Move booking state transitions into a centralized service layer (e.g., `transitionBookingState(id, nextState, context)`).
- Migrate availability querying to PostGIS or Postgres range types (`tstzrange`) with GiST indexes for extremely fast temporal querying.
