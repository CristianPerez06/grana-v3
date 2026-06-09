## Why

When a user navigates to a dynamic id route (e.g. `/cards/bogus-id`, `/accounts/missing-id`, `/transactions/[txId]`) and the resource doesn't exist, the page server-calls `notFound()`. There is no `not-found.tsx` in the app tree, so Next falls back to its built-in default — a bare `404 | This page could not be found` page with no AppShell chrome (sidebar gone), no PageHeader, no localization, and no back-link. The user lands in a dead end visually disconnected from the app.

This violates the canonical rule "Header chrome SIEMPRE visible desde first paint" (codified in `route-loading-and-errors:184-185`) and breaks symmetry with thrown errors, which already render inside `AppShell` via `(app)/error.tsx` + `<RouteError>`. The `route-loading-and-errors` spec covers loading and error variants but has no rule for not-found.

## What Changes

- Add `apps/web/app/(app)/not-found.tsx` — chrome-preserving floor that renders inside `AppShell`, localized, with a back link to `/dashboard`.
- Add per-module overrides where the back-link target meaningfully improves the dead-end UX:
  - `apps/web/app/(app)/cards/not-found.tsx` → "Card not found", back to `/cards`
  - `apps/web/app/(app)/accounts/not-found.tsx` → "Account not found", back to `/accounts`
  - `apps/web/app/(app)/transactions/not-found.tsx` → "Transaction not found", back to `/transactions`
  - `apps/web/app/(app)/settings/categories/not-found.tsx` → "Category not found", back to `/settings/categories`
- Introduce a `<RouteNotFound>` UI primitive at `apps/web/components/ui/route-not-found.tsx` mirroring `route-error.tsx`. Props: `title`, `description`, `backHref`, `backLabel`. Uses `next-intl`. Type lives in `@grana/ui-contracts`.
- Add a `notFound` namespace to next-intl messages (en + es) with generic + per-module keys.
- Extend `openspec/specs/route-loading-and-errors/spec.md` with a new section codifying:
  - Every dynamic-id route SHALL be covered by a chrome-preserving `not-found.tsx` up the tree (global floor or per-module override).
  - The global `(app)/not-found.tsx` SHALL render inside `AppShell`.
  - A per-module `not-found.tsx` SHALL render inside the module's chrome (sidebar + module header preserved when applicable) and SHALL link back to the module index.
  - Copy SHALL be localized through `next-intl`.
- Add a Storybook story for `<RouteNotFound>` parallel to `route-error.stories.tsx`.

## Capabilities

### New Capabilities

(none — this extends an existing capability)

### Modified Capabilities

- `route-loading-and-errors`: adds a normative section on not-found boundaries. New requirements: chrome-preserving `not-found.tsx` coverage for dynamic id routes; localized copy + back-link to module index; `<RouteNotFound>` primitive contract.

## Impact

- **Code:** new files only in `apps/web/app/(app)/**/not-found.tsx` (5 files) and `apps/web/components/ui/route-not-found.tsx` (+ stories). No edits to existing route files — the `notFound()` call sites stay as-is; the Next.js boundary lookup picks up the new files automatically.
- **Contracts:** `@grana/ui-contracts` gains a `RouteNotFoundProps` type alongside `RouteErrorProps`.
- **i18n:** new `notFound` namespace in `apps/web/messages/{en,es}.json`.
- **Spec:** `route-loading-and-errors/spec.md` gains a "Not-found boundary" requirement section.
- **Out of scope (for this change):**
  - Mobile parallel (Expo Router `+not-found.tsx`) — separate change.
  - Semantic split between true-missing / wrong-type / RLS-ownership conflations — current 404 collapse is preserved (RLS not-leakage is intentional).
  - The queued `/transactions/recurring/[id]` rework.
