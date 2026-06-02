# WeTask — Principal Technical Audit (2026-05-19)

> Brutal, evidence-based audit of the WeTask Next.js marketplace in its current state. This document is the index and executive summary; deep findings live in the sibling files in this directory.

---

## Method

- Repository: `wetask/` on branch `main` (commit `2a0fb9a`).
- Auditor read source files directly, not docs.
- Every claim is cited as `file:line` so it can be re-verified.
- "REAL" / "PARTIAL" / "STUB" / "DEMO" labels are used throughout.

## Snapshot

| Dimension | State |
| --- | --- |
| Stack | Next.js 14.2 App Router, React 18, Prisma 5, PostgreSQL, MercadoPago, Resend, Twilio, Railway |
| Source size | 172 TS/TSX files in `src/`. Pages dominated by 5 mega-files (4933, 1886, 1833, 1583, 1136 lines) |
| Stylesheet | Single `globals.css` of 9 304 lines, no Tailwind, no shadcn, no component library |
| Tests | None (no `*.test.*`, no `*.spec.*`, no `jest`/`vitest`/`playwright` in `package.json`) |
| Migrations | None — Railway runs `prisma db push --accept-data-loss` on every deploy ([package.json:13](../package.json#L13), [railway.json:7](../railway.json#L7)) |
| Schema | 27 Prisma models, payments + payouts + disputes + reviews defined, real index coverage |
| Auth | Custom HMAC-SHA256 cookie session, plain header-auth backdoor controlled by `ALLOW_HEADER_AUTH` ([src/lib/auth.ts:66-78](../src/lib/auth.ts#L66-L78)) |
| Payments | Real MercadoPago checkout path AND a parallel simulated "mark paid" path — the second one is a critical bypass |
| CI/CD | None (`.github/` absent) |
| Observability | None — `console.log/error` only, no Sentry / Datadog / OpenTelemetry |

## Verdict in one paragraph

WeTask is a **mid-fidelity MVP with a real payment integration nailed on top**. The Prisma model, the MercadoPago checkout (`/api/bookings/checkout`), the Resend email sender, the Twilio SMS sender, the chat-safety filter, the dispute / payout / refund flows, and the role-based middleware are all wired up and recognisable from a real marketplace. But the implementation has at least four issues that would cause **direct financial loss in production**: (1) `/api/marketplace/bookings/[bookingId]/payment/confirm` lets any authenticated customer mark a booking PAID without paying ([src/app/api/marketplace/bookings/[bookingId]/payment/confirm/route.ts:40-65](../src/app/api/marketplace/bookings/[bookingId]/payment/confirm/route.ts#L40-L65)); (2) `/api/auth/oauth` blindly trusts a client-supplied email and provider name as proof of OAuth identity ([src/app/api/auth/oauth/route.ts:32-65](../src/app/api/auth/oauth/route.ts#L32-L65)); (3) admin dispute resolution flips DB status to `REFUNDED` without calling MercadoPago's refund API ([src/app/api/marketplace/admin/disputes/route.ts:71-83](../src/app/api/marketplace/admin/disputes/route.ts#L71-L83)); (4) `Payout` records are created with status `PENDING` but **nothing in the codebase ever transitions them to `PAID` or actually moves money** — there is no Money-Out integration. Combine that with `SESSION_SECRET` defaulting to `"dev-insecure-change-me"`, `serverActions.allowedOrigins: ["*"]`, no rate limiting on auth, demo seed data running on every login, and `prisma db push` as the production migration strategy, and the verdict is **not production-safe**.

## Stage classification

**Operational MVP — not beta-ready.** The product can run an end-to-end booking against real MercadoPago in `/api/bookings/checkout`, but multiple parallel write paths exist that bypass it, the back-office for finance is missing, and there is no observability, no rate limiting, no migration history, and no automated payout settlement.

## Top 10 risks (sorted by blast radius)

1. **Free bookings via `/payment/confirm` bypass.** Any logged-in customer can mark their booking PAID/CONFIRMED. ([PAYMENTS_ANALYSIS.md](PAYMENTS_ANALYSIS.md), [SECURITY_ANALYSIS.md](SECURITY_ANALYSIS.md))
2. **OAuth identity spoofing.** `/api/auth/oauth` accepts `provider`+`email`+`fullName` in JSON with no token validation; account takeover of any email. ([AUTH_ANALYSIS.md](AUTH_ANALYSIS.md))
3. **Dispute "refund" leaks money.** Admin resolving a dispute updates DB but never refunds via MercadoPago. ([PAYMENTS_ANALYSIS.md](PAYMENTS_ANALYSIS.md))
4. **Payouts never settle.** No process moves `PayoutStatus.PENDING` → `PAID`, no provider call; taskers will not be paid by the system. ([PAYMENTS_ANALYSIS.md](PAYMENTS_ANALYSIS.md))
5. **Default session secret.** `SESSION_SECRET || "dev-insecure-change-me"` ([src/lib/security.ts:31,40](../src/lib/security.ts#L31)); session forgery if the env var is missing in any env. ([SECURITY_ANALYSIS.md](SECURITY_ANALYSIS.md))
6. **Header-auth backdoor.** With `ALLOW_HEADER_AUTH=true` any caller can claim any `x-user-id` + `x-user-role`. ([src/lib/auth.ts:66-78](../src/lib/auth.ts#L66-L78))
7. **`prisma db push` as prod migration.** No history, `--accept-data-loss` flag, runs on every Railway boot. ([package.json:13](../package.json#L13))
8. **`serverActions.allowedOrigins: ["*"]`** ([next.config.mjs:5](../next.config.mjs#L5)) — any origin can invoke server actions.
9. **No rate limiting anywhere** — login, register, OTP, leads, refunds all unbounded.
10. **Demo data hot-seeded on `/api/auth/login` and 5 marketplace endpoints** — demo taskers and demo accounts permanently inhabit production. ([RISK_ANALYSIS.md](RISK_ANALYSIS.md))

## Files in this audit

| File | Topic |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Stack, layering, server vs client, data flow |
| [CURRENT_FEATURES.md](CURRENT_FEATURES.md) | Inventory of every implemented feature |
| [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) | Per-feature maturity: real / partial / stub / broken |
| [DATABASE_ANALYSIS.md](DATABASE_ANALYSIS.md) | Prisma schema, indexes, lifecycles, normalisation |
| [API_ANALYSIS.md](API_ANALYSIS.md) | Every API route, auth posture, validation, gaps |
| [AUTH_ANALYSIS.md](AUTH_ANALYSIS.md) | Sessions, OAuth, roles, password reset, primary admin |
| [PAYMENTS_ANALYSIS.md](PAYMENTS_ANALYSIS.md) | MercadoPago, webhook, refunds, payouts, money risk |
| [MARKETPLACE_OPERATIONS_ANALYSIS.md](MARKETPLACE_OPERATIONS_ANALYSIS.md) | Booking lifecycle, chat, reviews, disputes, availability |
| [FRONTEND_ANALYSIS.md](FRONTEND_ANALYSIS.md) | App Router usage, mega-pages, hydration, forms |
| [DESIGN_SYSTEM_ANALYSIS.md](DESIGN_SYSTEM_ANALYSIS.md) | CSS organisation, component reuse, design debt |
| [SECURITY_ANALYSIS.md](SECURITY_ANALYSIS.md) | CVE-grade findings with severities |
| [PERFORMANCE_ANALYSIS.md](PERFORMANCE_ANALYSIS.md) | N+1, payload sizes, bundle bloat, hot paths |
| [TECH_DEBT_ANALYSIS.md](TECH_DEBT_ANALYSIS.md) | Mocks, leftovers, dead code, demo paths |
| [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) | Env, migrations, logs, ops, deploy |
| [SCALABILITY_ANALYSIS.md](SCALABILITY_ANALYSIS.md) | Query patterns, caching, websocket gap, storage |
| [RISK_ANALYSIS.md](RISK_ANALYSIS.md) | Operational, financial, fraud risks |
| [MISSING_SYSTEMS.md](MISSING_SYSTEMS.md) | What a real marketplace needs and this one lacks |
| [ROADMAP_RECOMMENDATIONS.md](ROADMAP_RECOMMENDATIONS.md) | Prioritised, evidence-grounded next steps |

## How to read

- Start with this file, then **PAYMENTS_ANALYSIS** and **SECURITY_ANALYSIS** — these contain the production-blocking findings.
- For onboarding a senior engineer: read **ARCHITECTURE** → **DATABASE_ANALYSIS** → **API_ANALYSIS** → **CURRENT_FEATURES**.
- For investor diligence: read this file, then **IMPLEMENTATION_STATUS**, **RISK_ANALYSIS**, **ROADMAP_RECOMMENDATIONS**.
