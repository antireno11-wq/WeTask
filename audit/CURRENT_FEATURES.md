# CURRENT_FEATURES.md — Inventory of what exists in code

Each entry is grounded in a route, page or library file that actually exists.

## Public marketing

- Home page with categories, hero, "how it works" section ([src/app/page.tsx](../src/app/page.tsx)).
- Static informational pages: `/como-funciona`, `/sobre-nosotros`, `/empleo`, `/legal`, `/ayuda-soporte` (901 lines), `/solicitar-tecnico` (504 lines).
- Service catalogue: `/servicios`, `/servicios/[categorySlug]` (912 lines), `/servicios/[categorySlug]/pros` (436 lines).
- Public pro profile: `/profesionales/[proId]`, `/pro/[proId]` (1 833 lines).
- Coverage waitlist `/api/coverage-waitlist` saves email + commune to `CoverageWaitlist` model.
- Lead capture `/api/leads` writes to `ServiceLead`.
- Support contact `/api/support/contact` sends email via Resend.
- PWA support via `src/app/manifest.ts`, `robots.ts`, `sitemap.ts`, and a client-side `PwaRegister` component.

## Authentication & accounts

- Email + password registration `/api/auth/register` with role-specific validation; PRO requires identity + background-check URL.
- Login `/api/auth/login` validates password via bcrypt, requires email verification unless ADMIN.
- Logout `/api/auth/logout` clears cookie.
- Session inspection `/api/auth/session`.
- "OAuth" `/api/auth/oauth` — accepts `provider`+`email`+`fullName` JSON and creates a session **without verifying any token** (see [AUTH_ANALYSIS.md](AUTH_ANALYSIS.md)).
- Email verification flow with 6-digit code: `/api/auth/verify/request` + `/api/auth/verify/confirm`; tokens hashed with SHA-256 and stored in `EmailVerificationToken`.
- Password reset: `/api/auth/password/forgot` + `/api/auth/password/reset`; tokens in `PasswordResetToken`, 30-minute expiry.
- Primary admin auto-provisioning from `PRIMARY_ADMIN_EMAIL`/`PASSWORD` on every login call ([src/lib/primary-admin.ts:19-61](../src/lib/primary-admin.ts)).
- Role-segregated login pages: `/ingresar/cliente`, `/ingresar/tasker`, `/ingresar/equipo`, `/ingresar/admin`.

## Customer surface

- Customer dashboard `/cliente` (1 136 lines, single client component) — bookings, addresses, notifications.
- Customer bookings list `/cliente/reservas` + detail `/cliente/reservas/[bookingId]` (427 lines) + open dispute `.../problema` (261 lines).
- Notifications inbox `/notificaciones` (148 lines) consuming `/api/marketplace/notifications`.
- Booking flow `/reservar` (1 583 lines client component) — service selection, scheduling, address, payment.
- Booking new `/booking/new`, detail `/booking/[bookingId]`.
- Stored payment-methods management: `/api/marketplace/client/payment-methods` (GET, POST, DELETE) uses MercadoPago `/v1/customers/{id}/cards`.

## Professional (tasker) surface

- Tasker onboarding `/trabaja-con-nosotros/registro` — 4 933-line single-page wizard with bank account, scope JSON per category (cleaning, pet, babysitter, trainer, teacher, chef, makeup, ironing), training acceptance, identity uploads, phone verification.
- Tasker dashboard `/pro` (1 886 lines) — slots calendar, bookings, profile.
- Booking detail `/pro/reservas/[bookingId]` (463 lines).
- Public tasker profile `/pro/[proId]` (1 833 lines).
- Availability slot CRUD `/api/marketplace/pro/slots` + `/[slotId]`.
- Slot sync from onboarding `/api/marketplace/pro/slots/sync` (calls `syncTaskerAvailabilitySlotsFromOnboarding`).
- Profile management `/api/marketplace/pro/profile`.
- Categories pricing `/api/marketplace/pro/categories`.

## Admin surface

- Admin dashboard `/admin` (393 lines) with shortcuts to onboarding queue, users, technicians, team.
- Cleaning onboarding review queue `/admin/onboarding-limpieza` + detail `/admin/onboarding-limpieza/[onboardingId]`. Backed by `/api/admin/onboarding/cleaning`.
- Users list `/admin/users` and detail `/admin/users/[userId]`.
- Technicians review `/admin/technicians` (legacy “technician” concept distinct from `ProfessionalProfile`).
- Team management `/admin/team`, `/admin/team/new` (create admin user, grant/revoke role, send reset).
- Marketplace category fee rules: `PATCH /api/marketplace/admin/categories/rules`.
- Disputes back-office: `GET/PATCH /api/marketplace/admin/disputes` — list + resolve with refund amount; **does not call MercadoPago refund**.
- Manual refund: `POST /api/admin/payments/refund` — does call MercadoPago refund.
- Payment health: `GET /api/admin/payments/health` exposes credential mode + provider reachability.
- Email health: `GET /api/admin/email/health` checks Resend config.

## Bookings & lifecycle

- Internal "legacy" booking endpoint `POST /api/bookings` and `GET /api/bookings/public`.
- Full marketplace booking endpoint `POST /api/marketplace/bookings` — assigns pro, computes price, creates booking + extras + placeholder `Payment` (with `provider: "STRIPE"` — see leftover) without charging.
- Production checkout `POST /api/bookings/checkout` — real MercadoPago charge with idempotency, slot locking inside `$transaction`, error rollback that releases the slot.
- Booking status transitions:
  - `PATCH /api/marketplace/bookings/[id]/status` — partial state machine (PRO can only set `ACCEPTED`, `IN_PROGRESS`, `AWAITING_CUSTOMER_CONFIRMATION`, `CANCELLED`; ADMIN unrestricted).
  - `POST /api/marketplace/bookings/[id]/complete` — mark complete.
  - `POST /api/marketplace/bookings/[id]/customer-confirm` — customer confirms execution.
  - `POST /api/marketplace/bookings/[id]/payment/confirm` — **simulated payment** (parallel to real checkout).
  - `POST /api/marketplace/bookings/[id]/payout/request` — PRO requests payout.
  - `POST /api/marketplace/bookings/[id]/pro-review` — PRO reviews customer.
- Auto-payout sweep `POST /api/marketplace/payouts/process-timeouts` (ADMIN-only manual trigger).

## Reviews & disputes

- Customer review: `POST /api/marketplace/reviews` creates `Review` row, recomputes pro average.
- Disputes: `POST /api/marketplace/disputes` opens ticket and sets booking to `DISPUTE`.
- Admin resolve: `PATCH /api/marketplace/admin/disputes` updates ticket + booking + payment status (DB-only).

## Chat & messaging

- `GET/POST /api/marketplace/bookings/[id]/messages` — persisted `Message` rows.
- Inline chat-safety filter blocks phone/email/contact keywords before `CONFIRMED`/`IN_PROGRESS`/`COMPLETED` ([src/lib/chat-safety.ts](../src/lib/chat-safety.ts)).
- Notification side-effect on each incoming message.
- No realtime — polling only.

## Notifications

- DB-backed `Notification` model; `/api/marketplace/notifications` returns the inbox.
- Email side-channel via Resend for: verification, password reset, admin tasker-review alert, tasker status updates, booking status changes (`src/lib/booking-status-email.ts`).
- SMS via Twilio for onboarding phone OTPs.
- No push notifications, no in-app realtime banner.

## Search & catalogue

- `GET /api/marketplace/catalog` — categories + services.
- `GET /api/marketplace/pros` and `/api/marketplace/pros/[proId]`.
- `GET /api/marketplace/search-professionals` — filters by service, commune, urgency.
- `GET /api/marketplace/availability` — slot listing.
- `GET /api/marketplace/service-preparation` — server-computed list of "what to prepare before the service" content.

## Coverage / geo

- `GET /api/maps/autocomplete` and `GET /api/maps/validate-address` proxy Google Maps with the server-side key.
- `src/lib/communes.ts` defines normalised commune list for coverage gating.
- `src/lib/geo.ts` computes hash-based pseudo-coordinates when geocoding fails.

## Onboarding (cleaning)

- Multi-step state machine `CleaningOnboardingStatus = { BORRADOR, PENDIENTE_REVISION, REQUIERE_CORRECCION, APROBADO, ACTIVO }`.
- `POST /api/onboarding/cleaning/start`
- `GET /api/onboarding/cleaning/me`
- `POST /api/onboarding/cleaning/submit`
- Phone verification: `/api/onboarding/cleaning/phone/{send,verify,claim}` and the unauthenticated `/api/onboarding/public/phone/{send,verify}` variants.
- Each tasker category has a scope helper: `cleaning-scope.ts`, `pet-scope.ts`, `babysitter-scope.ts`, `trainer-scope.ts`, `teacher-scope.ts`, `chef-scope.ts`, `makeup-scope.ts`, `ironing-scope.ts`.

## Legacy / parallel concepts

- `Technician` model + `/api/technicians/register` + `/admin/technicians` exists in addition to `ProfessionalProfile` + `CleaningOnboarding`. Two distinct professional pipelines coexist.
- Two parallel directories in the repo root: `stratmap-chile/`, `tmp_webel/`, `nomade-tareas-simple/`, `campamentos-control` (last three appear deleted per `git status`). `stratmap-chile/` is explicitly excluded from `tsconfig.json:23`.

## What is **not** implemented

- No invoice/receipt generation (no PDF, no email with receipt).
- No automated payout to bank — `Payout.status` never transitions out of `PENDING`.
- No KYC / SII integration; identity documents stored as base64 only.
- No analytics tracking (no Mixpanel, GA, PostHog, Segment).
- No A/B testing or feature flags.
- No mobile app — PWA manifest only.
- No tasker rating moderation, no review report flow.
- No fraud detection (velocity checks, device fingerprinting).
- No multi-tenancy / multi-region; single tenant, hardcoded for Chile.
