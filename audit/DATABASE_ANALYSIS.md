# DATABASE_ANALYSIS.md — Prisma schema deep dive

Schema source: `prisma/schema.prisma` (currently **deleted** in the working tree — recovered from HEAD into `audit/_schema_at_HEAD.prisma`). 653 lines, 27 models, 9 enums.

## Enums

| Enum | Values |
| --- | --- |
| `UserRole` | `CUSTOMER`, `PRO`, `ADMIN` |
| `AuthProvider` | `EMAIL`, `GOOGLE`, `APPLE` |
| `CleaningOnboardingStatus` | `BORRADOR`, `PENDIENTE_REVISION`, `REQUIERE_CORRECCION`, `APROBADO`, `ACTIVO` |
| `CleaningWorkMode` | `SOLO`, `EQUIPO` |
| `CleaningAvailabilityMode` | `FIJA`, `VARIABLE` |
| `BookingStatus` | 16 values — see lifecycle below |
| `PaymentStatus` | `PENDING`, `AUTHORIZED`, `PAID`, `FAILED`, `REFUNDED`, `PARTIAL_REFUNDED` |
| `PayoutStatus` | `PENDING`, `PROCESSING`, `PAID`, `FAILED` |
| `TicketStatus` | `OPEN`, `IN_REVIEW`, `RESOLVED`, `CLOSED` |
| `TechnicianVerificationStatus` | `PENDING`, `UNDER_REVIEW`, `APPROVED`, `REJECTED` |

## Entity inventory

| Model | Purpose | Maturity |
| --- | --- | --- |
| `User` | Identity, role, MP customer id, terms acceptance, optional birthDate | Mature |
| `CustomerPaymentMethod` | MP card-on-file references | Mature |
| `Role` + `UserRoleAssignment` | Many-to-many roles | Mature (but only ADMIN double-checks DB) |
| `EmailVerificationToken` / `PasswordResetToken` / `AuthSession` | Tokens hashed at rest | First two used; `AuthSession` is **defined but never written** |
| `Category` + `Service` | Catalogue with platform fee per category | Mature |
| `ProfessionalProfile` | Verification, coverage, rating aggregate, hourly-rate floor | Mature |
| `TaskerService` | Junction `ProfessionalProfile`↔`Service` with price per service | Mature |
| `TaskerCategoryProfile` | Per-category profile with `scopeData JSON`, communes, hourly rate | Heavy use, JSON-shaped |
| `AvailabilitySlot` | Time blocks with `isAvailable` flag | Mature, but `isAvailable` is used as optimistic lock without DB-level uniqueness |
| `Address` | Customer addresses | Country defaults to `"ES"` — bug for a Chile-only product (see TECH_DEBT) |
| `Booking` | Main lifecycle entity | Mature |
| `BookingExtra` | Line items | Mature |
| `Message` | Per-booking chat | Mature |
| `Payment` | Single per booking (`bookingId @unique`). Default `provider = "STRIPE"` despite MP being the real provider | Mature schema, wrong default |
| `Payout` | One-to-one with booking | Defined; never settles |
| `Review` | Customer→pro review with sub-scores | Mature |
| `DisputeTicket` | Per-booking ticket with evidence JSON, refund amount | Mature, never wired to provider refund |
| `Notification` | Per-user inbox | Mature |
| `ServiceLead` | Public lead form storage | Mature |
| `CoverageWaitlist` | Coverage-gate waitlist email + commune | Mature |
| `Technician` | Legacy / parallel professional pipeline with own verification + RUT + JSON fields | **Coexists with `ProfessionalProfile`/`CleaningOnboarding`** — dual-source-of-truth risk |
| `CleaningOnboarding` | 70+ field tasker onboarding state | Mature, heavily JSON-laden |

## Indexing

Reasonable coverage:
- `Booking`: `[customerId, status]`, `[proId, status]`, `[scheduledAt, status]`, `[bookedSlotId]`
- `AvailabilitySlot`: `[professionalProfileId, startsAt, isAvailable]`
- `Payment`: `[provider, providerPaymentId]`, `[providerStatus]`
- `TaskerService`: `[professionalProfileId, isActive]`, `[categoryId, isActive]`, `[serviceId, isActive]`
- `Message`: `[bookingId, createdAt]`

**Missing critical indexes:**
- `Booking` has no index on `paymentStatus` alone — used in `process-timeouts` filter ([src/app/api/marketplace/payouts/process-timeouts/route.ts:18-23](../src/app/api/marketplace/payouts/process-timeouts/route.ts)).
- `Notification` has no index on `(userId, isRead)` — the inbox unread badge will scan.
- `DisputeTicket` lacks an index on `status` alone (only `(bookingId, status)`), and the admin listing orders by `createdAt desc` without index ([src/app/api/marketplace/admin/disputes/route.ts:21-34](../src/app/api/marketplace/admin/disputes/route.ts)).
- `Payment` has no index on `paymentStatus` for back-office filtering.

## Referential integrity / cascading

- `Booking.customer` and `Booking.service` use `onDelete: Restrict` — good (prevents accidental data loss).
- `Booking.pro` uses `onDelete: SetNull` — operationally reasonable but loses payout ownership history.
- `Booking.bookedSlot` and `Booking.address` use `SetNull`.
- `Payment`, `Payout`, `Review`, `Notification`, `Message` cascade with their booking — irreversible but consistent.
- `Service.category` uses `SetNull` — services orphaned if category deleted; the pricing logic uses `service.category.basePlatformFeePct`, so orphaned services would crash checkout ([src/app/api/bookings/checkout/route.ts:89-95](../src/app/api/bookings/checkout/route.ts)).

## Lifecycles encoded by enums

### Booking
16 statuses (`BookingStatus`):
```
CREATED → PENDING_PAYMENT → CONFIRMED → ASSIGNED → ACCEPTED → IN_PROGRESS
        → AWAITING_CUSTOMER_CONFIRMATION → PAYOUT_SCHEDULED → PAID_OUT
        → COMPLETED
PAYMENT_FAILED, CANCELLED, DISPUTE, DISPUTE_OPEN, REFUNDED
PENDING (legacy default)
```
- `PENDING`, `DISPUTE_OPEN`, `PAID_OUT` are defined but never set by any code path (only `DISPUTE`, never `DISPUTE_OPEN`; payouts never settle to `PAID_OUT`).
- `CREATED` is the initial value for the legacy `/api/marketplace/bookings` POST; production checkout starts at `PENDING_PAYMENT`.
- No state-machine helper / no allowed-transitions table; transitions are sprinkled across routes.

### Payment
- Default `provider = "STRIPE"` (`Payment` model) — a fossil. Real provider is `"MERCADOPAGO"`.
- `idempotencyKey @unique` is set in checkout flow.
- Status transitions: `PENDING → AUTHORIZED|PAID|FAILED → REFUNDED|PARTIAL_REFUNDED`.

### Payout
- Created `PENDING`. No code path transitions to `PROCESSING`, `PAID`, or `FAILED`. The audit found zero references to setting `Payout.status` to anything other than `PENDING`.

### Dispute
- Created `OPEN`. Admin can update to `IN_REVIEW`, `RESOLVED`, `CLOSED`. `refundAmountClp` is stored but **only updates DB**, never charges MP refund.

## JSON columns

These models hide important structure inside `Json` fields, escaping Prisma's typing and Postgres indexing:
- `CleaningOnboarding.experienceTypes`, `offeredServices`, `cleaningScope`, `petScope`, `babysitterScope`, `trainerScope`, `teacherScope`, `chefScope`, `makeupScope`, `ironingScope`, `languages`, `serviceCommunes`, `availabilityBlocks`, `trainingTopics`
- `TaskerCategoryProfile.scopeData`
- `Technician.specialties`, `certifications`, `portfolioImages`, `availableCommunes`, `serviceCommunes`
- `DisputeTicket.evidence`
- `Payment.rawResponseJson`

The `serviceCommunes` JSON pattern means filtering "taskers that serve commune X" cannot use SQL indexes; the runtime helper `taskerServesCommune` does it in JS after a broader query (see [src/app/api/bookings/checkout/route.ts:173-182](../src/app/api/bookings/checkout/route.ts) and `src/lib/communes.ts`).

## Money & types

- All monetary fields are integer CLP (`Int`). No `Decimal`, no minor units helper.
- `Category.basePlatformFeePct` uses `Decimal(5,2)` — correct.
- `ProfessionalProfile.ratingAvg` uses `Decimal(3,2)` — correct.

## Notable data-shape concerns

- `Address.country @default("ES")` — inconsistent with Chile-only product (`src/app/api/bookings/checkout/route.ts:315` writes `"CL"` explicitly).
- `User.role` and `UserRoleAssignment[]` partly duplicate — login resolution at `src/lib/user-roles.ts` reconciles them, but admin checks live only against `UserRoleAssignment`. Two-source-of-truth risk.
- `Booking.proReviewRating`, `proReviewComment`, `proReviewedAt` are *fields on Booking* not a separate review entity. So a tasker cannot review the same booking twice without losing the original.
- `Booking.totalPriceClp` is not recomputed when extras change — extras can be inserted/deleted without affecting the total (no DB trigger).

## Migrations

- No `prisma/migrations/` directory.
- Production deploy runs `prisma db push --accept-data-loss` ([package.json:13](../package.json#L13), [railway.json:7](../railway.json#L7)). This:
  - Has no history;
  - Will drop columns silently if the schema diverges;
  - Cannot be rolled back;
  - Cannot be code-reviewed via `git diff` on migrations.
- The current state has the schema **deleted** in the working tree, while still present at HEAD. A naive `prisma db push` in this state would attempt to push from an absent schema. This is a fragile situation.

## Recommended schema follow-ups (priority order)

1. Switch to `prisma migrate deploy` with versioned migrations.
2. Restore `prisma/schema.prisma` to the working tree.
3. Add a `WebhookEvent`/`ProviderEvent` table for idempotency.
4. Add `Audit Log` table for admin actions.
5. Replace `Booking.proReview*` inline fields with a `ProReview` model.
6. Normalise `serviceCommunes` JSON into a `TaskerCoverageCommune` join table (real indexes).
7. Set `Address.country` default to `"CL"`.
8. Change `Payment.provider` default to `"MERCADOPAGO"`.
9. Index `Notification(userId, isRead)`, `Payment(status)`, `DisputeTicket(status, createdAt)`.
10. Decide between `Technician` and `ProfessionalProfile` and drop the loser.
