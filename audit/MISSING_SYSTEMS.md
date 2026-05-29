# MISSING_SYSTEMS.md

What a real marketplace at scale needs and WeTask does not have.

## 1. Job queue / background processing
- **Why it matters:** Webhooks, emails, automated payouts, reconciliation, notification fan-out must be retried, observed, and idempotent.
- **State:** None. Everything inline.
- **Concrete missing:** Inngest / QStash / BullMQ / Trigger.dev.
- **Symptom today:** `void sendBookingStatusEmailToCustomer(...)` — failures invisible.

## 2. Event/outbox bus
- **Why it matters:** Today the booking write path triggers an email by directly calling Resend. Adding analytics / a second notification provider / a CRM sync requires modifying the route. With an outbox, side effects are durable and replayable.
- **State:** None.
- **Concrete missing:** Outbox table + worker.

## 3. Audit log
- **Why it matters:** Admin refunds, role grants, user deletions, dispute resolutions and payout adjustments must be inspectable months later. Today only Git commits exist.
- **State:** None.
- **Concrete missing:** `AdminAuditLog` table with `actorId`, `targetType`, `targetId`, `action`, `payload`, `before/after`, `createdAt`, written from a shared helper.

## 4. Fraud detection
- **Why it matters:** Card testing, refund abuse, fake reviews, collusion.
- **State:** None. No velocity checks, no device fingerprint, no risk score.
- **Concrete missing:** A `RiskSignal` table; rate limiters per user; a daily report job.

## 5. Customer support tooling
- **Why it matters:** Today admins have a disputes UI, but no way to:
  - See full booking history per customer,
  - Send a refund + a note,
  - Issue platform credit,
  - Suspend a user,
  - Trigger a re-verification.
- **State:** Partial — `/admin/users/[userId]` + `/admin/team` exist; refunds are a separate endpoint; no notes.
- **Concrete missing:** Unified back-office.

## 6. Payout reconciliation
- **Why it matters:** Even with a real payout integration, finance must reconcile platform records to bank statements.
- **State:** None.
- **Concrete missing:** Daily reconciliation job that pulls bank/MP statements and matches to `Payout` rows; flagged exceptions queue.

## 7. Real-time notification infrastructure
- **Why it matters:** Chat messages, booking state changes, new offers — all are polled today.
- **State:** Polling only.
- **Concrete missing:** WebSocket / SSE / Pusher / Ably + service worker for native push.

## 8. Analytics
- **Why it matters:** Funnel analysis (onboarding drop-off), conversion (search→book), pro performance, revenue dashboards.
- **State:** None. No tracking library, no warehouse, no dashboard.
- **Concrete missing:** PostHog/Mixpanel + read replica + Metabase or similar.

## 9. Feature flags
- **Why it matters:** Killing a broken feature without redeploy. Rolling out the real payment flow gradually.
- **State:** None.
- **Concrete missing:** Edge Config / Vercel Flags / GrowthBook / Unleash.

## 10. Observability
- **Why it matters:** Mean Time To Detect = hours/days right now. Error tracking, metric dashboards, and traces are non-negotiable for production.
- **State:** `console.*` only.
- **Concrete missing:** Sentry / Datadog / Grafana Cloud + OpenTelemetry spans on critical paths (checkout, webhook, refund).

## 11. Rate limiting
- **Why it matters:** Credential stuffing, OTP-cost abuse, lead-spam, scraping.
- **State:** None.
- **Concrete missing:** `@upstash/ratelimit` on `/api/auth/*`, `/api/onboarding/public/*`, `/api/leads`, `/api/support/contact`, `/api/admin/payments/refund`.

## 12. CAPTCHA / bot protection
- **Why it matters:** Public forms today take any payload from anyone.
- **State:** None.
- **Concrete missing:** Turnstile or hCaptcha on public submission forms.

## 13. Object storage
- **Why it matters:** Identity documents, chat attachments, dispute evidence currently in Postgres as base64.
- **State:** None.
- **Concrete missing:** S3/R2 + signed URLs + virus scan + admin viewer.

## 14. CDN / image optimisation
- **Why it matters:** Bandwidth, latency, mobile performance.
- **State:** None visible.
- **Concrete missing:** `next/image` with `domains` configured + Vercel/Cloudflare in front.

## 15. Email transactional pipeline
- **Why it matters:** Today Resend is called directly per email. No template versioning, no preference center, no unsubscribe.
- **State:** Templates inlined as HTML strings in `notifications.ts`.
- **Concrete missing:** A template store, a delivery status table, a preference UI.

## 16. SMS pipeline (idempotent + cost-controlled)
- **Why it matters:** Twilio bill control.
- **State:** Direct `fetch()` per send.
- **Concrete missing:** Rate limit + DLR tracking + per-user OTP cap.

## 17. Invoicing / receipts
- **Why it matters:** Chilean tax compliance (boleta electrónica), customer receipts.
- **State:** Not implemented.
- **Concrete missing:** Integration with an electronic invoicing provider (e.g. OpenFactura).

## 18. KYC / AML
- **Why it matters:** Background-check verification, sanctions screening for taskers and customers.
- **State:** Manual admin review against base64-uploaded docs.
- **Concrete missing:** Integration with a Chilean KYC provider; sanctions API hook.

## 19. Tasker performance / quality enforcement
- **Why it matters:** Cancellation rate, response time, completion rate, dispute rate per pro.
- **State:** Schema has `proReviewRating`, `ratingAvg`, `ratingsCount`. No code computes "cancellation rate" or "dispute rate".
- **Concrete missing:** Materialised view or daily job; auto-suspend thresholds.

## 20. Coupon / promo system
- **Why it matters:** Marketing levers.
- **State:** None.
- **Concrete missing:** Coupon model + redemption table + admin UI.

## 21. Multi-tasker / team support
- **Why it matters:** `CleaningOnboarding.workMode = SOLO | EQUIPO` exists but no team management code.
- **State:** Enum-only.

## 22. Recurring bookings / subscriptions
- **Why it matters:** Standard cleaning marketplace feature; customer retention multiplier.
- **State:** None.

## 23. Tasker calendar sync (iCal/Google)
- **Why it matters:** Pros want their WeTask schedule to appear in their personal calendar.
- **State:** None.

## 24. In-app help / FAQ system
- **State:** `/ayuda-soporte` is a static page. No ticket system, no chatbot.

## 25. Multi-language / multi-region
- **State:** Hardcoded `es-CL`. Acceptable for now.

## 26. Test infrastructure
- **State:** None — no Jest/Vitest/Playwright/RTL.

## 27. CI/CD
- **State:** None — no `.github/workflows`.

## 28. Backup verification / restore drill
- **State:** None in repo.

## 29. Documentation / runbook
- **State:** README.md is short; `docs/STRATMAP.md` exists (4 284 bytes per agent's report) — high-level only. No runbook for "Postgres is down", "MP is rejecting all charges", "Resend bounce rate spiked".

## 30. Status page / customer comms
- **State:** None. No `status.wetask.cl`.

## Priority

Of the 30 missing systems, these block "limited beta":
- Real payout settlement (#6)
- Fraud + rate limiting (#4, #11)
- Audit log (#3)
- Observability (#10)
- Object storage (#13)

These block "public launch":
- Job queue (#1)
- KYC / AML (#18)
- Invoicing (#17)
- Real-time notifications (#7)
- Backups verified (#28)

These should be planned but can wait:
- Coupons (#20), recurring bookings (#22), multi-language (#25), calendar sync (#23).
