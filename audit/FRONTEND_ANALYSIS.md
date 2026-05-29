# FRONTEND_ANALYSIS.md

## Stack reality check

- Next.js 14.2 App Router.
- React 18.3.
- **No** Tailwind, **no** shadcn, **no** Radix, **no** Mantine, **no** MUI, **no** Chakra, **no** styled-components, **no** Emotion.
- **No** state library (no Zustand, no Redux, no Jotai, no react-query, no SWR).
- **No** form library (no react-hook-form, no Formik, no Conform).
- **No** date library (no date-fns, no dayjs, no luxon). Date math is inlined.
- **No** icon library (icons inlined as SVG/emoji).
- **Single** stylesheet: `src/app/globals.css` at **9 304 lines**.

The entire UI runs on `<className="..."/>` against utility classes hand-written in one giant CSS file. There is no design system in the codebase sense — only a visual language enforced by selectors.

## Page sizes (top 10 by lines)

| Page | Lines | Client? |
| --- | --- | --- |
| `trabaja-con-nosotros/registro/page.tsx` | **4 933** | yes |
| `pro/page.tsx` | 1 886 | yes |
| `pro/[proId]/page.tsx` | 1 833 | yes |
| `reservar/page.tsx` | 1 583 | yes |
| `cliente/page.tsx` | 1 136 | yes |
| `servicios/[categorySlug]/page.tsx` | 912 | yes |
| `ayuda-soporte/page.tsx` | 901 | mixed |
| `solicitar-tecnico/page.tsx` | 504 | yes |
| `admin/users/[userId]/page.tsx` | 469 | yes |
| `pro/reservas/[bookingId]/page.tsx` | 463 | yes |

**Five pages account for >11 000 lines of client-side React.** The largest is a single onboarding wizard.

## Server vs client split

- 34 of 57 page/component files contain `"use client"` at the top.
- The home page (`src/app/page.tsx`) and a few static marketing pages are server components.
- All data-bound pages (booking flow, customer dashboard, pro panel, admin views) are client components fetching `/api/...` via `fetch()`.
- Result: the App Router's RSC streaming, server data caching, and server actions are **largely unused**. The architecture is effectively a SPA built on top of Next.js routing.

## Component reuse

- `src/components/` has 10 files total:
  - `admin-cleaning-review-actions.tsx`, `admin-hero-shell.tsx`, `auth-hero-nav.tsx`, `booking-chat-panel.tsx`, `brand-logo.tsx`, `home-service-link.tsx`, `login-role-panel.tsx`, `market-nav.tsx`, `pwa-register.tsx`, `site-footer.tsx`.
- No shared `Button`, `Card`, `Input`, `Modal`, `Toast`, `Table`, `Tabs`, `Tag`, `Avatar`, `Skeleton` components — these are re-implemented inline in every page.
- This is why pages are massive: every form input, every modal, every card is duplicated per page.

## Hydration risk

- The home page uses no client-only logic and is safe.
- Mega-pages use `useState`/`useEffect` extensively for fetched data; SSR shells render empty placeholders → client hydrates → fetches → renders. Acceptable but slow time-to-interactive.
- No `Date.now()` / `Math.random()` in JSX render paths spotted in samples (would cause hydration mismatches).

## Data fetching

- No `react-query`/`SWR`. Every component does its own `fetch()`+`useState`+`useEffect`.
- No request deduplication. Open the customer dashboard twice → two fetches.
- No optimistic updates. Mutations refetch lists.
- No error boundaries at the route level (no `error.tsx` files spotted in the directory listing).
- No `loading.tsx` files spotted either.
- Suspense not used.

## Form handling

- All forms are uncontrolled or use raw `useState`.
- No `zod` resolver on the client; validation errors come back from the API and are displayed.
- Submit buttons typically toggle a local `loading` flag and disable on submit.
- No CSRF tokens beyond cookie SameSite reliance.

## Responsive design

- CSS uses `@media (max-width: ...)` in `globals.css`. The visual design (a marketplace) appears to be mobile-aware.
- Mega-pages on mobile will be heavy: 5 000 lines of React + inline DOM = sluggish on low-end Android.

## Accessibility

- Layout uses semantic tags (`<main>`, `<section>`, `<nav>`) at the top level (`page.tsx`).
- Form labels and `aria-*` not consistently audited across mega-pages.
- No skip-links spotted.
- Decorative gradients use `aria-hidden`. ✅

## Performance

- Mega-page bundles are extremely heavy. With no `dynamic(import(), { ssr: false })`, the 4 933-line registration page ships entirely on first load.
- No bundle analyzer wired (`@next/bundle-analyzer` absent).
- `next.config.mjs` has no `images.domains`, no `compress` config (Next defaults). `Image` component usage not surveyed but assumed present.

## Loading and error UX

- Skeleton states not standardised.
- Toasts/alerts are inline divs per page.
- No global notification provider.

## Routing & metadata

- `manifest.ts`, `robots.ts`, `sitemap.ts` correctly use Next 14 conventions.
- `layout.tsx` is 36 lines, clean.
- Metadata title `"WeTask Marketplace"` is global; page-level `metadata` not consistently exported on each page.

## PWA

- `PwaRegister` component registers a service worker. The file isn't deeply inspected here; assumed working since manifest is configured.

## Notable UX flows audited

- **Booking flow `/reservar`**: 1 583 lines. Likely contains step selection, address input, time picker, payment form. Will hold MercadoPago JS for tokenisation. Heavy.
- **Tasker onboarding `/trabaja-con-nosotros/registro`**: 4 933 lines. Multi-step with persistence to `CleaningOnboarding`. The single-file approach means a single import error or render mistake breaks the entire onboarding.
- **Customer dashboard `/cliente`**: 1 136 lines. Combines bookings, addresses, notifications, profile.
- **Pro panel `/pro`**: 1 886 lines. Combines calendar, bookings, profile, payouts.

## Frontend technical debt highlights

1. **No design system.** Every page reimplements buttons, cards, modals. A senior FE hire will spend weeks just extracting primitives.
2. **One 9 304-line CSS file.** No layering, no CSS Modules, no Tailwind, no co-located styles.
3. **Mega-pages.** Five pages collectively over 11 000 lines.
4. **No tests.** No Playwright, no Cypress, no RTL, no Storybook.
5. **No state management.** Repeated `useState`+`useEffect` with manual loading flags.
6. **No data layer.** Each page fetches its own endpoints; no cache, no deduplication.
7. **No error boundaries / loading boundaries.** Each page handles loading flags ad-hoc.
8. **Google Fonts import in CSS** ([globals.css:1](../src/app/globals.css#L1)) — render-blocking, not via `next/font`.
9. **Inline Google Maps key risk** — public key embedded by the maps API in client code.

## What is good

- Layout is minimalist and clean.
- PWA scaffolding in place.
- Server-only sections (home page) use the RSC model correctly.
- Spanish copy is consistent and on-brand.
- Visual design is cohesive across pages (per the user-supplied screenshots context).
