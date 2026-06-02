# DESIGN_SYSTEM_ANALYSIS.md

## There is no design system

There is a **visual language** encoded in a single 9 304-line stylesheet (`src/app/globals.css`). There is no component library, no token system file, no Storybook, no Figma reference checked into the repo.

## What does exist

### Tokens (CSS variables)
`globals.css:3-15` defines a small palette:
```css
:root {
  --bg: #f2f6fb;
  --surface: #ffffff;
  --ink: #132a57;
  --ink-soft: #3b4d73;
  --line: #cfe2f3;
  --brand: #18a6d5;
  --brand-deep: #1656b0;
  --accent: #ff6a00;
  --ok: #177245;
  --err: #b00020;
  --site-footer-space: 230px;
}
```
That's the entire token system. No spacing scale, no typography scale, no radius scale, no shadow scale, no z-index scale.

### Fonts
- Loaded via `@import url("https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;700;800&family=Space+Grotesk:wght@600;700&display=swap")` ([globals.css:1](../src/app/globals.css#L1)).
- This is render-blocking and ignores Next's `next/font` optimisation. Cumulative Layout Shift risk and FOIT.

### Class system
- Hand-written BEM-like classes (`.auth-flow-panel`, `.home-hero-strip`, `.market-nav`, `.home-auth-content`).
- Massive duplication of layout rules across page-specific selectors.
- No utility framework; specific use-cases like flexbox alignment require their own class.

### Reusable components (10 in `src/components/`)
- `BrandLogo` — WeTask logomark.
- `MarketNav` — top nav.
- `SiteFooter` — footer (referenced from `app/layout.tsx`).
- `AuthHeroNav` — auth-page hero nav.
- `LoginRolePanel` — role chooser used on `/ingresar`.
- `HomeServiceLink` — service tile on home.
- `BookingChatPanel` — embeddable chat for booking pages.
- `AdminHeroShell` — admin layout shell.
- `AdminCleaningReviewActions` — admin onboarding review buttons.
- `PwaRegister` — service-worker registration.

No `<Button>`, no `<Card>`, no `<Input>`, no `<Modal>`, no `<Toast>`, no `<Avatar>`, no `<Tabs>`, no `<Tooltip>`, no `<Select>`, no `<Table>`, no `<Skeleton>`.

## Consistency assessment

### Typography
- Two font families. Sizes inlined as raw pixel values per selector. No `--text-md`, `--text-lg` variables.
- Verified by inspection of email templates and CSS samples: headers use 28-34px, body 14-16px. The system is implicit.

### Spacing
- Padding and margins are raw pixel values per selector (`padding: 32px 36px 36px;`). No spacing scale.

### Colour
- Tokens defined; many components use the same raw hex values inlined in TSX style props for one-off gradients (email templates use `linear-gradient(135deg,#173e73 0%,#1d7fc6 100%)` in 4+ places).

### Radius
- No radius scale. `border-radius: 28px`, `999px`, `12px`, `20px`, `22px` all appear in the email templates alone.

### Shadows
- No shadow scale. `box-shadow: 0 18px 46px rgba(21,58,97,0.14)` repeated literally across templates.

## Dark mode
- Not implemented. Single light theme.

## Responsive coverage
- Media queries are present but not systematically audited. The visual design appears mobile-aware.

## Component duplication examples

The same "card with rounded corners, soft shadow, brand-coloured CTA" is re-implemented in:
- `BookingChatPanel`
- `AdminHeroShell`
- `LoginRolePanel`
- Inside `cliente/page.tsx`, `pro/page.tsx`, `reservar/page.tsx` (inlined)

Email templates in `notifications.ts` reinvent the wheel a third time as HTML strings.

## What this costs

- New page = re-implementing core UI primitives from scratch.
- A button visual tweak requires touching ~20 places.
- Type-safety for component props is absent — every page invents its own internal sub-component.
- Mega-pages exist partly because there is nothing to import.

## Recommended fixes (priority order)

1. **Adopt a primitives layer.** Either Tailwind + shadcn, or hand-rolled Headless UI + custom Tailwind config. Even a minimal `@/components/ui/button`, `card`, `input`, `modal`, `toast`, `tabs` set will halve mega-page size.
2. **Migrate to `next/font`.** Replace the `@import` at the top of `globals.css` with `localFont`/`Google` imports in `layout.tsx`.
3. **Define real tokens.** Spacing scale, type scale, radius scale, shadow scale — even as CSS variables.
4. **Co-locate styles.** Use CSS Modules per component, or migrate to Tailwind utility classes.
5. **Storybook (optional but valuable)** for the primitives layer once it exists.
6. **Dark mode and i18n** — both will be much cheaper to add after the design system exists.
