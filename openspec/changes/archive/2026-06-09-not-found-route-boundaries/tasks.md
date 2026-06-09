## 1. Contracts and i18n

- [x] 1.1 Add `RouteNotFoundProps` type to `packages/ui-contracts/src/index.ts`, parallel to `RouteErrorProps`. Document why no callback (navigation, not retry).
- [x] 1.2 Add `notFound` namespace to `packages/i18n-messages/src/es.json` with sub-namespaces `generic`, `cards`, `accounts`, `transactions`, `categories`. Each has `title`, `description`, `back_label`.
- [x] 1.3 Add the same namespace to `packages/i18n-messages/src/en.json` with English translations. Verify key parity between locales.

## 2. RouteNotFound component

- [x] 2.1 Create `apps/web/components/ui/route-not-found.tsx` implementing `RouteNotFoundProps`. Visual parity with `route-error.tsx` (centered, `min-h-[50vh]`, padding, typography). Action is a Next `<Link>` wrapped in `<Button variant="primary">`. No `role="alert"`.
- [x] 2.2 Create `apps/web/components/ui/route-not-found.stories.tsx` mirroring `route-error.stories.tsx`: default (generic) story + per-module variants for Cards / Accounts / Transactions / Categories. Use the `NextIntlClientProvider` decorator with Spanish messages.

## 3. Global floor

- [x] 3.1 Create `apps/web/app/(app)/not-found.tsx` as a Server Component. Imports `getTranslations` from `next-intl/server`, reads the `notFound.generic` sub-namespace, renders `<RouteNotFound title=… description=… backHref="/dashboard" backLabel=… />`.
- [~] 3.2 Smoke check locally: navigate to `/some-nonsense-path` and confirm AppShell remains visible, generic copy shows, button links to `/dashboard`.
  - **Hallazgo:** `/blahblah` (URL que no entra a ningún route group) cae al fallback default de Next.js — NO está cubierto por `(app)/not-found.tsx`. Spec actualizada para reflejarlo. La cobertura aplica a `notFound()` desde dentro de `(app)` y a route-mismatches dentro de subárboles de módulo (ej. `/cards/<id>/wild`).

## 4. Per-module overrides

- [x] 4.1 Create `apps/web/app/(app)/cards/not-found.tsx` consuming `notFound.cards` and linking to `/cards`.
- [x] 4.2 Create `apps/web/app/(app)/accounts/not-found.tsx` consuming `notFound.accounts` and linking to `/accounts`.
- [x] 4.3 Create `apps/web/app/(app)/transactions/not-found.tsx` consuming `notFound.transactions` and linking to `/transactions`.
- [x] 4.4 Create `apps/web/app/(app)/settings/categories/not-found.tsx` consuming `notFound.categories` and linking to `/settings/categories`.

## 5. Manual verification

- [x] 5.1 Navigate to `/cards/bogus-id`. Confirm AppShell + Cards header visible; "Card not found" copy + "Volver a tarjetas" link. **(User verified.)**
- [x] 5.2 Navigate to `/accounts/bogus-id`. Confirm AppShell + Accounts header visible; account-specific copy + link to `/accounts`. **(User verified.)**
- [x] 5.3 Navigate to `/transactions/bogus-tx-id`. Confirm AppShell + transactions header visible; transaction-specific copy + link to `/transactions`. **(User verified.)**
- [x] 5.4 Navigate to `/settings/categories/bogus-id/edit`. Confirm AppShell + categories chrome visible; category-specific copy + link to `/settings/categories`. **(User verified.)**
- [~] 5.5 Navigate to `/blahblah`. Confirm AppShell visible; generic copy + link to `/dashboard`. **(See task 3.2 finding — out of scope; falls to Next default.)**
- [x] 5.6 In each case, confirm the literal text "404 | This page could not be found" does NOT appear anywhere on the page. **(User verified.)**
- [x] 5.7 Confirm Storybook renders both the default story and all per-module variants without console errors. **(User verified.)**

## 6. Quality gates

- [x] 6.1 `pnpm lint` clean.
- [x] 6.2 `pnpm typecheck` clean.
- [x] 6.3 `pnpm test` (web) green — no regressions from the new files.

## 7. Wrap-up

- [x] 7.1 Squash the feature branch into a single commit with title `feat(web): chrome-preserving not-found boundaries for dynamic id routes` (no body, no trailers — repo convention).
- [x] 7.2 Stop. Do not merge to `main` — the user merges.
