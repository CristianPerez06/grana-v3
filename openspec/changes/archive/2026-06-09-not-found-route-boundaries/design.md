## Context

The web app uses Next.js App Router. Every dynamic id route calls `notFound()` from `next/navigation` when a resource isn't found. Without a `not-found.tsx` file in the route tree, Next falls back to its built-in default — a chromeless, untranslated page that visually disconnects the user from the app.

The repo already has a similar pattern for errors:
- `apps/web/app/(app)/error.tsx` mounts `<RouteError>` inside `AppShell`.
- `<RouteError>` lives in `apps/web/components/ui/route-error.tsx` with a Storybook story and a `RouteErrorProps` contract in `@grana/ui-contracts`.
- Localized strings live in `@grana/i18n-messages` under the `error` namespace.

The `route-loading-and-errors` spec (Variants A/B/C) prescribes loading + error coverage for every route, but says nothing about not-found.

Next.js's `not-found.tsx` lookup walks **up** the segment tree from the segment that called `notFound()` until it finds the nearest file, and renders that file **inside every layout above it**. Concretely:

```
app/(app)/layout.tsx           ← AppShell (sidebar + main area)
app/(app)/cards/layout.tsx     ← CardsHeader chrome
app/(app)/cards/[id]/layout.tsx
app/(app)/cards/[id]/page.tsx  ← calls notFound()
```

- A `not-found.tsx` at `app/(app)/` preserves AppShell.
- A `not-found.tsx` at `app/(app)/cards/` preserves AppShell + CardsHeader.
- A `not-found.tsx` deeper (e.g. `cards/[id]/`) would preserve the card detail header too, but the back-link target is less useful (you'd link back to the same id that wasn't found).

So the design space has two natural levels: the global `(app)` floor, and per-module overrides at the module root.

## Goals / Non-Goals

**Goals:**
- Eliminate the chromeless default 404 inside the authenticated app.
- Give the user a localized message and a back-link target on every not-found route.
- Preserve AppShell (sidebar) on every 404; preserve the module header where a module-level override exists.
- Codify the rule in `route-loading-and-errors` so future dynamic id routes inherit the requirement.

**Non-Goals:**
- Differentiating semantically between "resource truly missing" vs "RLS-ownership rejected" vs "wrong type" (`cardDetail.type !== 'credit'`). The current conflation is intentional: leaking ownership-existence over RLS would be a security regression.
- Mobile parallel — Expo Router has its own `+not-found.tsx`; it's a separate change.
- Handling "resource was deleted while you're on the page" (this is a query-error case in Variant B routes like `/accounts/[id]`, already covered by inline error handling).
- Adding `not-found.tsx` for routes that don't currently call `notFound()` (e.g. `/dashboard`, `/cards` index).

## Decisions

### D1: Two-level coverage — global floor + selective per-module overrides

**Choice:** One `(app)/not-found.tsx` as the floor (always renders inside AppShell). Per-module overrides at `cards/`, `accounts/`, `transactions/`, `settings/categories/` because each has user-facing dynamic id pages and a meaningful back-link target.

**Alternatives considered:**
- *Global only.* Simpler (1 file), but every 404 sends the user back to `/dashboard` regardless of which module they were in. Worse UX.
- *Per-route (`cards/[id]/not-found.tsx`, etc.).* Maximally specific, but the back-link can't usefully target the same id that wasn't found — it has to go to the module index anyway. The per-route file gives nothing the per-module file doesn't, and multiplies files (~13 instead of 5).
- *No per-module, but pass a module hint via headers.* Over-engineered for static copy.

The chosen split also matches the chrome hierarchy: AppShell at the floor, module header at the module level.

### D2: `<RouteNotFound>` as a sibling to `<RouteError>`, not a shared "RoutePlaceholder"

**Choice:** A new component `<RouteNotFound>` in `apps/web/components/ui/route-not-found.tsx`. Props: `title`, `description`, `backHref`, `backLabel`, `className`. No callback. Uses `next-intl` for any defaults.

**Visual style:** identical container to `<RouteError>` (`flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 py-12 text-center`). Heading uses the same `text-lg font-semibold text-text`. The CTA is a `<Button variant="primary">` wrapped in a Next `<Link>` to `backHref`.

**Why two components instead of one parameterized "RoutePlaceholder":**
- Different semantics ("error" vs "not found") → different ARIA roles (`role="alert"` for error, no role / `role="status"` is acceptable for not-found).
- Different props shape: error takes `error: Error` + `onRetry: () => void`; not-found takes static copy + a link target.
- The two will probably diverge over time (e.g. error grows debug detail in dev; not-found may grow a search affordance later).

**Contract location:** `RouteNotFoundProps` exported from `@grana/ui-contracts`, parallel to `RouteErrorProps`. No domain callback (it's navigation, not a retry action), so the "no `onPress`" rule doesn't bite.

### D3: Per-module files import `<RouteNotFound>` and pass module-specific strings; no shared "module config" indirection

**Choice:** Each per-module `not-found.tsx` is ~15 lines: a server component that calls `getTranslations('notFound')` and renders `<RouteNotFound title={t('cards.title')} description={t('cards.description')} backHref="/cards" backLabel={t('cards.back_label')} />`. Five files, all the same shape.

**Alternatives considered:**
- *A `<ModuleNotFound module="cards" />` helper that internally selects strings.* Cuts the per-file LOC but introduces an enum tied to module identity. Three lines saved per file isn't worth the indirection.
- *Generated from a `modules.ts` table.* Same objection — over-abstraction for five files.

### D4: i18n keys — flat `notFound.generic.*` + `notFound.<module>.*`

**Choice:** Add a `notFound` namespace to `packages/i18n-messages/src/{en,es}.json`:

```jsonc
"notFound": {
  "generic": {
    "title": "We couldn't find that page",
    "description": "It may have been deleted or never existed.",
    "back_label": "Back to dashboard"
  },
  "cards": {
    "title": "Card not found",
    "description": "It may have been deleted or never existed.",
    "back_label": "Back to cards"
  },
  "accounts": { /* ... */ },
  "transactions": { /* ... */ },
  "categories": { /* ... */ }
}
```

Spanish translations are the source of truth (project default locale); English mirrors them.

### D5: No `not-found.tsx` inside `(auth)` or `(onboarding-wizard)` groups

**Choice:** Scope this change strictly to `(app)`. The `(auth)` and `(onboarding-wizard)` groups have their own `error.tsx` files but currently no dynamic id routes that call `notFound()`. If they ever do, the requirement extends naturally.

### D6: Storybook coverage

**Choice:** Add `route-not-found.stories.tsx` mirroring `route-error.stories.tsx`: a default story plus per-module variants (Cards / Accounts / Transactions / Categories). Uses the same `NextIntlClientProvider` decorator pattern with Spanish messages.

## Risks / Trade-offs

- **[Risk]** Adding a `(app)/not-found.tsx` changes Next's lookup for *every* `notFound()` call inside `(app)`, including any future call site. → **Mitigation:** That's the intent. The spec requirement makes the new behavior the contract.
- **[Risk]** Per-module overrides could be triggered by a typo route (`/cards/anything/random`) that Next.js doesn't recognize, surfacing "Card not found" for a non-card 404. → **Mitigation:** Acceptable — the back-link still goes to the right place and the user can navigate out. Next's lookup is based on path prefix, which is the right heuristic here.
- **[Risk]** `<RouteNotFound>` and `<RouteError>` will visually drift if maintained independently. → **Mitigation:** Tracked by the spec section + Storybook stories; a future change can extract a shared `<RoutePlaceholder>` base if drift becomes a real problem. Don't pre-factor.
- **[Trade-off]** Five new files vs one. The decision favors UX (back-link relevance) over file-count minimalism. Each file is ~15 lines.
- **[Trade-off]** No nested `not-found.tsx` (e.g. `cards/[id]/periods/`). Period not-found will surface as "Card not found" via the `cards/` boundary. Acceptable — periods are a sub-resource of a card and the back-link to `/cards` (then user re-enters the card) is a coherent recovery path.

## Migration Plan

No data migration. No flag. The change is additive:
1. Land `<RouteNotFound>` + contract + stories.
2. Land i18n keys.
3. Land `(app)/not-found.tsx` (global floor) — this immediately fixes every existing `notFound()` call site.
4. Land per-module overrides — these refine the back-link for the four modules.
5. Land spec update.

Steps 3–4 are independently shippable. If a step is reverted, the previous step still leaves the app in a better state than today (chromed generic 404 > bare default).

## Open Questions

- None blocking. The "should the generic floor have a search CTA?" question was decided in proposal: no, just back-to-dashboard.
