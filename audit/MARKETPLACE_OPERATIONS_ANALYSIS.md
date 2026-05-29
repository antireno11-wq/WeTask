# MARKETPLACE_OPERATIONS_ANALYSIS.md

## Booking lifecycle in practice

Statuses actually written by code:

| Status | Set by |
| --- | --- |
| `CREATED` | `POST /api/marketplace/bookings` when no pro assigned ([route.ts:313](../src/app/api/marketplace/bookings/route.ts#L313)) |
| `ASSIGNED` | `POST /api/marketplace/bookings` when pro assigned ([route.ts:313](../src/app/api/marketplace/bookings/route.ts#L313)) |
| `PENDING_PAYMENT` | `POST /api/bookings/checkout` ([route.ts:326](../src/app/api/bookings/checkout/route.ts#L326)) |
| `CONFIRMED` | Checkout success, payment/confirm, webhook approved |
| `PAYMENT_FAILED` | Checkout failure, webhook rejected — slot released |
| `REFUNDED` | Admin refund, dispute resolution, webhook refunded |
| `ACCEPTED`, `IN_PROGRESS`, `AWAITING_CUSTOMER_CONFIRMATION`, `CANCELLED` | PRO via `PATCH /api/marketplace/bookings/[id]/status` |
| `PAYOUT_SCHEDULED` | Auto-payout sweep ([process-timeouts/route.ts:48-51](../src/app/api/marketplace/payouts/process-timeouts/route.ts#L48-L51)) |
| `DISPUTE` | `/api/marketplace/disputes` POST |
| `COMPLETED` | `/api/marketplace/bookings/[id]/complete` |

**Statuses defined but never set:** `PENDING` (default value but never explicitly set), `DISPUTE_OPEN` (only `DISPUTE` is used), `PAID_OUT` (no payout settlement). These dangling enum values create confusion.

**No central state machine.** Transition validation is local to each route. `PATCH .../status` constrains PRO to a whitelist of next statuses but allows ADMIN to set any. Customer-driven status changes go through dedicated routes (`/customer-confirm`, `/complete`), not `/status`. The path `CREATED → ASSIGNED → ACCEPTED → IN_PROGRESS → AWAITING_CUSTOMER_CONFIRMATION → PAYOUT_SCHEDULED → COMPLETED` is implicit and unenforced — an ADMIN can jump straight to `COMPLETED` or skip payment.

## Double-booking prevention

Two creation paths, different safety:

- **`/api/bookings/checkout`** locks the slot inside `$transaction` via `availabilitySlot.updateMany where isAvailable:true` ([route.ts:299-306](../src/app/api/bookings/checkout/route.ts#L299-L306)). Throws if the lock fails. ✅
- **`/api/marketplace/bookings` POST** reads `isAvailable` ([route.ts:124](../src/app/api/marketplace/bookings/route.ts#L124)), then writes the booking *without* updating `isAvailable`. Two concurrent requests both see `isAvailable=true`, both succeed. ⛔

## Auto-assignment

`/api/marketplace/bookings` POST has an `autoAssign` branch ([route.ts:159-222](../src/app/api/marketplace/bookings/route.ts#L159-L222)):
- Lists up to 80 candidate slots ordered by `startsAt asc`.
- Filters by `isVerified=true` and tasker offers the service.
- Picks the **first** candidate whose pro covers the commune.

Behaviour:
- Earliest slot wins regardless of distance, rating, or fairness.
- The same high-rated pro who keeps the earliest slot open always wins.
- No round-robin, no load balancing, no distance scoring.
- No "decline" mechanism — assigned pros cannot reject; only an ADMIN can re-assign.

## Availability

- `AvailabilitySlot` is created via `POST /api/marketplace/pro/slots` and synced from onboarding via `POST /api/marketplace/pro/slots/sync`.
- `isAvailable` is the optimistic-lock flag.
- The webhook releases the slot on `PAYMENT_FAILED` but does **not** release it on `CANCELLED` or `REFUNDED` — a cancelled booking permanently consumes the slot. ⛔
- No "blackout" / vacation mode beyond manually deleting slots.

## Chat

`Message` model + `/api/marketplace/bookings/[id]/messages` GET/POST.
- Access guard via `canAccessBooking` (booking parties + ADMIN). ✅
- Polled by frontend (no realtime).
- On POST, runs `messageContainsRestrictedContactInfo` from `src/lib/chat-safety.ts`.

Chat-safety filter:
- Blocks keywords: `whatsapp`, `telefono`, `celular`, `llamame`, etc. (16 keywords).
- Blocks email pattern.
- Blocks two phone patterns: `(?:\+?56[\s.-]*)?9(?:[\s.-]*\d){8}` and `\b\d{8,}\b`.
- Only enforced when booking is **not** in `CONFIRMED|IN_PROGRESS|COMPLETED` — i.e. before payment is confirmed.

Bypasses:
- `9-6-5-3-2-1-0-0-7` — hyphens between digits defeat `\b\d{8,}\b`. The first pattern requires `[\s.-]*` between groups so it might catch this. Let's verify: regex is `(?:\+?56[\s.-]*)?9(?:[\s.-]*\d){8}` — for `9-6-5-3-2-1-0-0-7` it would match (`9`, then `-`, `6`, etc.). ✅ catches dashed format.
- `nueve seis cinco...` (word spelling) — bypasses everything.
- Unicode lookalikes (`9́`) — bypasses email regex.
- Emojis between digits — bypasses both.

The filter is OK but it's a regex, not a real safety layer. It deters but does not prevent.

## Reviews

### Customer reviews (`POST /api/marketplace/reviews`)
- Validates customer ownership.
- Creates `Review` row (unique on bookingId so double-submit returns conflict). ✅
- Recomputes pro rating average **outside** any transaction — concurrent reviews can lose updates ([src/app/api/marketplace/reviews/route.ts:51-64](../src/app/api/marketplace/reviews/route.ts) per agent report).

### PRO reviews customer (`POST /api/marketplace/bookings/[id]/pro-review`)
- `upsert` keyed on bookingId without enforcing one-write-only semantics. PRO can edit silently. ⚠️
- Required before `/payout/request` (good — provides cross-incentive for two-sided ratings).

## Disputes

`POST /api/marketplace/disputes`:
- Auth: booking parties or ADMIN.
- Body: `bookingId, openedById, category?, reason, evidence?[≤3]`.
- Creates `DisputeTicket(status="OPEN")`.
- Updates booking to `DISPUTE`.
- Sends notifications to both parties.
- Sends email via `sendBookingStatusEmailToCustomer`.

`PATCH /api/marketplace/admin/disputes`:
- ADMIN-only.
- Updates ticket status, resolution text, refund amount.
- If `RESOLVED` + `refundAmountClp > 0`: updates booking to `REFUNDED`, payment to `PARTIAL_REFUNDED`. **No MercadoPago refund call.**

Operational gaps:
- No SLA timer / aging.
- No evidence storage beyond base64 in the JSON column.
- No comment thread between admin and parties.
- No escalation, no reopen flow.
- No payout reversal if a payout was already scheduled (currently impossible to reach because payouts don't settle).

## Notifications

- DB rows in `Notification`.
- `/api/marketplace/notifications` returns inbox.
- No realtime delivery — the customer/pro must refresh.
- Email side-channel exists for booking-status changes (`src/lib/booking-status-email.ts`); not all notification creators trigger emails.
- No push, no SMS for booking events.
- No "preferences" — every event notifies every party.

## Professional onboarding (cleaning)

State machine in [src/lib/cleaning-onboarding.ts](../src/lib/cleaning-onboarding.ts) (103 lines) defines the step labels & required-field map.

Flow:
1. Start: `POST /api/onboarding/cleaning/start` (auth required).
2. Edit per step: `PATCH /api/onboarding/cleaning/me` (multi-section payload).
3. Phone verification: SMS via Twilio.
4. Submit: `POST /api/onboarding/cleaning/submit` — validates required fields, alerts admin email, sets status `PENDIENTE_REVISION`.
5. Admin reviews via `/admin/onboarding-limpieza` page using `GET/POST/PATCH /api/admin/onboarding/cleaning` — can request corrections (`REQUIERE_CORRECCION`), approve (`APROBADO`), activate (`ACTIVO`).

Strengths:
- Multi-category support (cleaning, pet, babysitter, trainer, teacher, chef, makeup, ironing) each with its own scope helper module.
- Real phone OTP via Twilio.
- Admin email alert via Resend.

Weaknesses:
- 4 933-line single-page client component for the registration UI — see [FRONTEND_ANALYSIS.md](FRONTEND_ANALYSIS.md).
- Identity documents stored as base64 data URLs in `CleaningOnboarding.identityDocument*File` columns — DB bloat, no virus scan, no admin pre-view.
- "Activation" sets `status="ACTIVO"` but the system also accepts bookings against any pro with `isVerified=true` on `ProfessionalProfile` — two parallel verification truths.

## Cancellation & no-show

- No formal cancellation flow with refunds. `CANCELLED` status exists; setting it does not refund or release the slot.
- No no-show recording.
- No cancellation policy enforcement (e.g. cancel within 24h → 50% fee). The category model has no policy fields.

## Edge cases that will surface in production

1. **Past-time bookings.** No code prevents scheduling for `scheduledAt < now()`.
2. **Slot expiry.** No code reclaims `AvailabilitySlot` rows whose `endsAt` is in the past.
3. **Pro deletion mid-flight.** `Booking.pro onDelete: SetNull` orphans the booking; payout creation would fail (no proId).
4. **Address re-use.** Every checkout *creates a new Address row*, never re-uses the customer's saved address ([src/app/api/bookings/checkout/route.ts:308-317](../src/app/api/bookings/checkout/route.ts#L308-L317)). Bloat over time.
5. **`provider:"STRIPE"` placeholder.** The legacy booking POST writes a `Payment` row with `provider:"STRIPE"` ([route.ts:340](../src/app/api/marketplace/bookings/route.ts#L340)). The webhook handler keys on `provider:"MERCADOPAGO"` so these stay unaffected — but the rest of the system treats them as legit payments.
6. **Demo data in production.** `ensureMarketplaceDemoData()` runs on every login + every public catalog request. Real customers see "Camila Demo" and "Antonia Demo" in the pro listings.
7. **Booking total never recomputed.** Adding/removing `BookingExtra` rows directly does not adjust `Booking.totalPriceClp`.

## Operational maturity by area

| Area | Maturity |
| --- | --- |
| Booking lifecycle | MVP — works for happy path, no state guard for adversarial inputs |
| Availability & slots | MVP — race in legacy path |
| Auto-assignment | Prototype — first-come picker |
| Chat | MVP — polled, regex-filtered |
| Reviews | MVP — aggregation race condition |
| Disputes | Prototype — admin UX present, money flow missing |
| Tasker onboarding | Production-ish — heavy but functional |
| Cancellation / no-show | Not implemented |
| Receipts / invoices | Not implemented |
| Multi-tasker (teams) | Not implemented |
| Recurring bookings | Not implemented |
