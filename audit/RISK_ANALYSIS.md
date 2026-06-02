# RISK_ANALYSIS.md

Risks here are framed as **"what could go wrong with real users and real money"**, not "what is theoretically possible".

## Financial risks (money loss / regulatory)

### F1 — Free bookings via `/payment/confirm` (CRITICAL)
**Scenario:** A user creates a booking via the legacy `POST /api/marketplace/bookings`, then POSTs to `/api/marketplace/bookings/[id]/payment/confirm`. The booking is marked PAID and CONFIRMED. A tasker performs the service. WeTask receives nothing.
**Probability:** High once anyone reads the route.
**Impact:** 100% loss per fraudulent booking + tasker payout obligation.

### F2 — Dispute "refund" doesn't refund (CRITICAL)
**Scenario:** A customer files a dispute. An admin resolves it with a refund amount. The DB says REFUNDED; the customer's card was never credited. The customer files a chargeback. Bank charges a chargeback fee. Reputation damage.
**Probability:** High in any dispute.
**Impact:** ~$15-25 USD chargeback fee per case + amount lost twice (refunded "on paper" and again via chargeback).

### F3 — Payouts never settle (CRITICAL)
**Scenario:** Marketplace runs normally. Customers pay (via the real path). `Payout` rows accumulate in `PENDING`. Taskers complain they aren't being paid. Manual settlement must happen via MP web UI / bank.
**Probability:** Certain.
**Impact:** Operational chaos + tasker churn + class-action labour disputes (Chile labour law).

### F4 — OAuth identity takeover → spending on saved cards (CRITICAL)
**Scenario:** Attacker POSTs `/api/auth/oauth` with a victim's email. The session it returns lets them call `/api/marketplace/client/payment-methods` (saved cards) and `/api/bookings/checkout` with `savedCardId`. MP charges the victim's card; service is delivered to the attacker.
**Probability:** Trivial once discovered.
**Impact:** Direct credit-card fraud.

### F5 — Admin session forgery (CRITICAL if `SESSION_SECRET` ever absent)
**Scenario:** Env misconfiguration leaves `SESSION_SECRET` unset. Default fallback is `"dev-insecure-change-me"`. Attacker signs an admin token and refunds their own purchases, exfiltrates customer data, drops the DB.

### F6 — Double-booking on legacy `/api/marketplace/bookings`
**Scenario:** Two customers book the same slot via the legacy POST endpoint at the same moment. Both succeed. One pro, two customers, one time slot.
**Probability:** Moderate in a busy commune.
**Impact:** Tasker no-shows, refunds, ratings damage.

### F7 — Booking total drift via direct DB
**Scenario:** Admin adds a `BookingExtra` manually. `Booking.totalPriceClp` is not recomputed. Customer pays the old total, the pro's payout calculation uses the old total. Refund disputes ensue.

### F8 — Refund + dispute resolution race
**Scenario:** Admin clicks both "Refund" (real MP refund) and "Resolve dispute with refund amount" (DB-only). The customer sees two refunds in the dispute view; only one happens. Confusion + audit gaps.

## Account / privilege risks

### A1 — Legacy unsigned cookie acceptance (CRITICAL)
Set `wetask_session={"userId":"<any>","role":"ADMIN"}` → admin.

### A2 — Header-auth backdoor (HIGH)
`ALLOW_HEADER_AUTH=true` in any env = total bypass.

### A3 — Admin guard inconsistency (HIGH)
Most admin write routes trust the cookie only. A forged or stale cookie passes them.

### A4 — Demo accounts on production (MEDIUM)
`/api/marketplace/demo` returns demo credentials publicly. The seed function ensures `admin-demo@wetask.cl` exists in any environment that runs login.

## Operational risks

### O1 — `prisma db push --accept-data-loss` on every deploy
Schema drift → silent column drops. With the working tree currently missing `prisma/schema.prisma`, a careless commit could cripple the DB.

### O2 — No backups / no restore drill in the repo
Railway likely provides backups by tier; recovery procedure is not documented.

### O3 — No audit log
Admin actions (refunds, dispute resolutions, role grants, user edits) leave no traceable history beyond commit-level git.

### O4 — Webhook DoS via spoofed event ids
No signature check. An attacker POSTs `?data.id=<random>` repeatedly. Server pings MP API for each (rate-limited but expensive in MP quota and DB writes).

### O5 — Public `/api/onboarding/public/phone/send` (Twilio cost)
No rate limit. Attacker can drain Twilio balance via OTP spam.

### O6 — Public `/api/leads`, `/api/coverage-waitlist`, `/api/support/contact` (spam)
No CAPTCHA, no rate limit.

### O7 — Identity documents in DB
Backup leaks all PII at once. Database breach = front, back, selfie, criminal record for every applicant exposed.

### O8 — Health endpoint reports green when DB is down
Railway will keep routing traffic to a broken instance.

### O9 — `tmp_webel/`, `stratmap-chile/`, `nomade-tareas-simple/`, `campamentos-control` in repo
Confusion, accidental imports, secrets-leak risk.

## Fraud risks

### Fr1 — Self-bookings to inflate ratings
A pro can create a customer account, book themselves, leave a 5-star review. No deduplication.

### Fr2 — Review bombs
A jilted customer can file multiple disputes for the same booking; no per-booking rate cap.

### Fr3 — Coupon / discount abuse
N/A — no coupon system yet, so no abuse.

### Fr4 — Card-testing attacks
With no rate limit on `/api/bookings/checkout`, an attacker can probe stolen cards (MP will block at provider level, but the platform reputation suffers).

### Fr5 — Tasker collusion
No anti-collusion: a pro can mass-create CUSTOMER accounts and accept their own bookings.

### Fr6 — Chat bypass to disintermediate
Regex filter is bypassable. A pro and a customer can exchange "nueve seis cinco" and meet outside the platform after the first booking, never returning.

## UX risks (silent failures the user feels)

### U1 — Notifications never delivered in realtime
Customer must refresh to see new messages.

### U2 — Email sends fail silently
Resend down → users don't get verification/reset emails; backend just logs `[email] resend delivery failed`.

### U3 — Stale slot availability
After a booking is `CANCELLED`, the slot is not released. Apparent "no availability" while the calendar shows times.

### U4 — Mega-pages slow on mobile
The 4 933-line onboarding wizard ships to every PRO applicant. Drop-off likely.

## Compliance risks (Chile specifics)

### Cm1 — Ley 19.628 (data protection)
- Stores national ID + criminal record + bank account + birthdate.
- No retention policy.
- No deletion endpoint.
- No data export / portability.

### Cm2 — SII (taxation)
- Marketplace platforms acting as withholding agents have specific obligations.
- No invoice/boleta generation in code.
- `Payout` lacks tax-withholding columns.

### Cm3 — SBIF / consumer protection (SERNAC)
- Disputes resolved without refunds → SERNAC complaints likely.
- No clear cancellation policy in code.

## Risk register summary

| ID | Category | Severity | Likelihood | Net |
| --- | --- | --- | --- | --- |
| F1 | Money loss | Critical | High | **Critical** |
| F2 | Money loss | Critical | High | **Critical** |
| F3 | Operational | Critical | Certain | **Critical** |
| F4 | Fraud | Critical | High | **Critical** |
| F5 | Auth | Critical | Low-Medium | **High** |
| F6 | Operational | High | Medium | **High** |
| A1 | Auth | Critical | Medium | **Critical** |
| A2 | Auth | High | Low (env flag) | **Medium** |
| A3 | Auth | High | Low | **Medium** |
| O4 | Ops | Medium | High | **Medium** |
| O5 | Ops/$ | High | Medium | **High** |
| O7 | Compliance | High | Low | **High** |
| Cm1 | Compliance | High | N/A | **High** |
| Cm2 | Compliance | High | N/A | **High** |
| Cm3 | Compliance | High | Medium | **High** |
