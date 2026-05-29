# WeTask — Complete System Lifecycles

This document outlines the 12 critical operational lifecycles of the WeTask marketplace. Each lifecycle is mapped with strict state definitions, transitions, async jobs, and failure scenarios.

---

## 1. Provider Lifecycle

### States
- `UNREGISTERED`: Visitor.
- `REGISTERED`: Account created, no profile.
- `ONBOARDING`: Currently filling out profile.
- `PENDING_REVIEW`: Profile submitted, waiting for admin.
- `ACTIVE`: Approved, can receive bookings.
- `SUSPENDED`: Temporarily disabled (e.g., due to disputes or low ratings).
- `BANNED`: Permanently removed.

### Allowed Transitions & Triggers
- `REGISTERED` → `ONBOARDING`: Provider starts profile creation.
- `ONBOARDING` → `PENDING_REVIEW`: Provider clicks "Submit for Review".
- `PENDING_REVIEW` → `ACTIVE`: Admin clicks "Approve".
- `PENDING_REVIEW` → `ONBOARDING`: Admin clicks "Request Corrections".
- `ACTIVE` → `SUSPENDED`: Admin action OR Auto-trigger (e.g., 3 no-shows).
- `SUSPENDED` → `ACTIVE`: Admin action (Dispute resolved in favor of provider).
- `SUSPENDED` → `BANNED`: Admin action (Fraud confirmed).

### Side Effects
- `ACTIVE`: Triggers "Welcome to WeTask" email. Unlocks listing creation.
- `SUSPENDED`: Immediately hides all active listings. Cancels all upcoming unstarted bookings (triggering customer refunds).
- `BANNED`: Revokes auth tokens immediately.

### Async Jobs
- **Stale Onboarding Reminder**: If `ONBOARDING` > 7 days, send email: "Complete your profile to start earning".

### Failure Handling
- **Fraudulent Signups**: If rapid signups from same IP, auto-flag and move to `SUSPENDED` instantly.

### Admin Intervention Points
- Force suspend provider.
- Impersonate provider to fix profile issues.

---

## 2. KYC Lifecycle

### States
- `DRAFT`: Documents being uploaded.
- `SUBMITTED`: Locked for editing, in admin queue.
- `IN_REVIEW`: Admin currently reviewing.
- `REJECTED`: Documents invalid.
- `APPROVED`: Documents verified.

### Allowed Transitions & Triggers
- `DRAFT` → `SUBMITTED`: Form submission.
- `SUBMITTED` → `IN_REVIEW`: Admin opens ticket.
- `IN_REVIEW` → `APPROVED`: Admin validates documents.
- `IN_REVIEW` → `REJECTED`: Admin marks as invalid (e.g., blurry ID, expired).

### Side Effects
- `APPROVED`: Automatically transitions Provider Lifecycle to `ACTIVE`.
- `REJECTED`: Unlocks fields for provider to re-upload. Emails provider with specific rejection reason.

### Async Jobs
- **ID Expiration Monitor**: Daily cron checking if approved IDs have expired. If yes, flags for re-verification.

### Failure Handling
- **Image Upload Failure**: If S3 upload fails, fallback to local temporary storage and retry.

### Admin Intervention Points
- Override automated KYC flags.
- Request secondary documentation (e.g., proof of address).

---

## 3. Listing Lifecycle

### States
- `DRAFT`: Setting up category and pricing.
- `PUBLISHED`: Visible in search.
- `UNAVAILABLE`: Temporarily hidden by provider.
- `MODERATED`: Hidden by Admin due to policy violation.

### Allowed Transitions & Triggers
- `DRAFT` → `PUBLISHED`: Provider publishes.
- `PUBLISHED` → `UNAVAILABLE`: Provider toggles "Pause Listing".
- `PUBLISHED` → `MODERATED`: Admin action (e.g., pricing too low/high, inappropriate description).

### Side Effects
- `PUBLISHED`: Updates search index (e.g., Elasticsearch/Redis).

### Async Jobs
- **Search Index Sync**: Keep DB and Search Index in sync upon state change.

### Failure Handling
- **Sync Failure**: If DB updates but search index fails, queue a retry job.

### Admin Intervention Points
- Force hide listing (`MODERATED`).

---

## 4. Booking Lifecycle

### States
- `CREATED`: Customer selected slot.
- `PENDING_PAYMENT`: Customer at checkout.
- `PAYMENT_FAILED`: Checkout failed.
- `CONFIRMED`: Paid.
- `IN_PROGRESS`: Service happening.
- `AWAITING_CUSTOMER_CONFIRMATION`: Service done, waiting for approval.
- `COMPLETED`: Customer approved.
- `CANCELLED`: Cancelled before start.
- `DISPUTED`: Issue raised.

### Allowed Transitions & Triggers
- `CREATED` → `PENDING_PAYMENT`: User proceeds to MP.
- `PENDING_PAYMENT` → `CONFIRMED`: MP Webhook `approved`.
- `PENDING_PAYMENT` → `PAYMENT_FAILED`: MP Webhook `rejected` or 15m timeout.
- `CONFIRMED` → `IN_PROGRESS`: Automated (Start Time reached) or Provider clicks "Start".
- `IN_PROGRESS` → `AWAITING_CUSTOMER_CONFIRMATION`: Automated (End Time reached) or Provider clicks "Finish".
- `AWAITING_CUSTOMER_CONFIRMATION` → `COMPLETED`: Customer clicks "Approve" or 48h timeout.
- `CONFIRMED` → `CANCELLED`: Customer/Provider action.

### Side Effects
- `CONFIRMED`: Email to both parties.
- `COMPLETED`: Triggers Review Lifecycle. Moves funds to Payout queue.
- `CANCELLED`: Triggers Refund logic.

### Async Jobs
- **Checkout Timeout**: 15m cron to mark `PAYMENT_FAILED` and release slot.
- **Auto-Complete**: 48h cron to auto-approve if customer unresponsive.

### Failure Handling
- **Webhook Missed**: Nightly reconciliation job syncs `PENDING_PAYMENT` with MP API.

### Admin Intervention Points
- Force transition to `CANCELLED` or `COMPLETED`.

---

## 5. Availability Lifecycle

### States
- `AVAILABLE`: Open for booking.
- `LOCKED`: Temporarily held during checkout.
- `BOOKED`: Confirmed booking.
- `BLOCKED`: Provider manually blocked it off.

### Allowed Transitions & Triggers
- `AVAILABLE` → `LOCKED`: Customer enters checkout.
- `LOCKED` → `BOOKED`: Payment `approved`.
- `LOCKED` → `AVAILABLE`: Payment `failed` or timeout.
- `AVAILABLE` → `BLOCKED`: Provider action.

### Side Effects
- `LOCKED`: Prevents other users from selecting the slot.

### Async Jobs
- **Unlock Stale Slots**: Cron job runs every minute looking for `LOCKED` slots older than 15 mins.

### Failure Handling
- **Deadlock**: If DB transaction hangs, the 15-minute cron ensures the slot eventually frees up.

### Admin Intervention Points
- Admin can manually free a stuck slot.

---

## 6. Payment Lifecycle

### States
- `PENDING`: Intent created.
- `PAID`: Funds captured by WeTask.
- `FAILED`: Card rejected.
- `REFUNDED`: Full refund.
- `PARTIAL_REFUNDED`: Partial refund (cancellation fee).

### Allowed Transitions & Triggers
- `PENDING` → `PAID`: MP Webhook.
- `PAID` → `REFUNDED`: Admin/System triggers refund API.

### Side Effects
- `PAID`: Updates Booking to `CONFIRMED`.

### Async Jobs
- **Reconciliation**: Nightly sync with MP.

### Failure Handling
- **Refund Failure**: If MP API is down during refund, queue job to retry refund hourly.

### Admin Intervention Points
- Trigger manual refund.

---

## 7. MercadoPago Webhook Lifecycle

### States
- `RECEIVED`: Payload hit the endpoint.
- `PROCESSING`: DB transaction running.
- `PROCESSED`: State updated.
- `FAILED`: Processing error.

### Allowed Transitions & Triggers
- `RECEIVED` → `PROCESSING`: Immediate.
- `PROCESSING` → `PROCESSED`: Successful DB commit.
- `PROCESSING` → `FAILED`: DB lock timeout, invalid payload.

### Side Effects
- Updates Payment and Booking states.

### Async Jobs
- **DLQ Retry**: Failed webhooks go to Dead Letter Queue and are retried with exponential backoff.

### Failure Handling
- **Duplicate Webhooks**: Handled via DB strict transaction locking and idempotency checks.

### Admin Intervention Points
- View raw webhook payloads in Admin Dashboard.

---

## 8. Payout Lifecycle

### States
- `ELIGIBLE`: Booking `COMPLETED`.
- `PENDING`: Batched for next payout run.
- `PROCESSING`: Bank transfer initiated.
- `PAID`: Transfer confirmed.
- `FAILED`: Bank rejected.

### Allowed Transitions & Triggers
- `ELIGIBLE` → `PENDING`: Automatic.
- `PENDING` → `PROCESSING`: Admin initiates payout batch.
- `PROCESSING` → `PAID`: Admin confirms bank processed the batch.
- `PROCESSING` → `FAILED`: Bank error reported.

### Side Effects
- `PAID`: Email to Provider. Updates WeTask internal ledger.

### Async Jobs
- **Batch Generation**: Cron job generates the bank CSV every Tuesday at 2 AM.

### Failure Handling
- **Wrong RUT/Account**: Moves to `FAILED`. Notifies provider to update bank details.

### Admin Intervention Points
- Freeze payout (e.g., if fraud detected post-completion).

---

## 9. Review Lifecycle

### States
- `PENDING`: Waiting for submission.
- `SUBMITTED`: Written but hidden.
- `PUBLISHED`: Visible.
- `FLAGGED`: Reported for abuse.
- `REMOVED`: Admin deleted.

### Allowed Transitions & Triggers
- `PENDING` → `SUBMITTED`: User submits.
- `SUBMITTED` → `PUBLISHED`: Both parties submit, OR 14-day timeout.
- `PUBLISHED` → `FLAGGED`: User clicks "Report".

### Side Effects
- `PUBLISHED`: Updates Provider's aggregate rating score.

### Async Jobs
- **Auto-Publish**: 14-day cron to publish one-sided reviews.

### Failure Handling
- **Rating Recalculation Failure**: If aggregate score update fails, queue a recalculation job.

### Admin Intervention Points
- Delete abusive reviews.

---

## 10. Dispute Lifecycle

### States
- `OPEN`: Raised by user. Funds frozen.
- `IN_REVIEW`: Admin investigating.
- `RESOLVED_CUSTOMER`: Refund issued.
- `RESOLVED_PROVIDER`: Payout released.

### Allowed Transitions & Triggers
- `OPEN` → `IN_REVIEW`: Admin assigns ticket to themselves.
- `IN_REVIEW` → `RESOLVED_CUSTOMER`: Admin clicks "Refund Customer".

### Side Effects
- Freezes associated Payout.
- Triggers emails to both parties requesting evidence.

### Async Jobs
- **Dispute SLA Monitor**: Alert admin channel if a dispute is `OPEN` for > 48 hours.

### Failure Handling
- **Refund API Error**: If `RESOLVED_CUSTOMER` but MP API fails, revert to `IN_REVIEW` and alert admin.

### Admin Intervention Points
- Full control over resolution.

---

## 11. Notification Lifecycle

### States
- `QUEUED`: Ready to send.
- `SENT`: Dispatched to Resend/Twilio.
- `DELIVERED`: Confirmed receipt.
- `FAILED`: Bounce.

### Allowed Transitions & Triggers
- `QUEUED` → `SENT`: Worker processes queue.
- `SENT` → `FAILED`: Webhook from Resend/Twilio.

### Side Effects
- N/A.

### Async Jobs
- **Notification Worker**: Processes the queue.

### Failure Handling
- Retry failed sends up to 3 times.

### Admin Intervention Points
- View notification logs for a user.

---

## 12. Admin Moderation Lifecycle

### States
- `ALERT_GENERATED`: System flags an issue.
- `TRIAGED`: Admin acknowledges.
- `ACTION_TAKEN`: Admin executes decision.
- `RESOLVED`: Closed.

### Allowed Transitions & Triggers
- `ALERT_GENERATED` → `TRIAGED`: Admin clicks "Investigate".
- `TRIAGED` → `ACTION_TAKEN`: Admin suspends user or refunds payment.

### Side Effects
- Audit log entry created for accountability.

### Async Jobs
- **Fraud Detection Cron**: Sweeps DB for suspicious patterns (e.g., multiple failed payments from same IP) and generates alerts.

### Failure Handling
- **Audit Log Failure**: If audit log fails to write, the admin action must rollback to prevent untraceable actions.

### Admin Intervention Points
- Supervisor review of junior admin actions.
