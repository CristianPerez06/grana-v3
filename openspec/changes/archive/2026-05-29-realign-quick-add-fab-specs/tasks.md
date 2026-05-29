## 1. Code already shipped (verify, do not re-implement)

- [x] 1.1 Confirm `feature/quick-add-fab-redesign` exists locally and the squashed commit is `feat(transactions): mobile-only square green FAB on web and mobile.`
- [x] 1.2 Re-read `apps/web/lib/transactions/components/quick-add-fab.tsx` and verify the FAB has classes `sm:hidden`, `bottom-10 right-10`, `size-16`, `rounded-2xl`, `bg-success`, `text-success-foreground`
- [x] 1.3 Re-read `apps/web/app/(app)/dashboard/_components/dashboard-header.tsx` and verify the "Nuevo movimiento" button is `hidden sm:inline-flex` in both branches (disabled and enabled)
- [x] 1.4 Re-read `apps/mobile/components/transactions/QuickAddFab.tsx` and verify the FAB is `h-20 w-20`, `rounded-2xl`, `bg-emerald`, anchored `absolute bottom-10 right-10`, with `DISABLED = true` and the wired-but-blocked `router.push('/transactions/new')`
- [x] 1.5 Re-read `apps/mobile/app/(app)/dashboard.tsx` and `apps/mobile/app/(app)/transactions.tsx` and verify `<QuickAddFab />` is rendered as a sibling to the scrollable content (so it sits above the tab bar) and the dashboard `ScrollView` uses `pb-28`
- [x] 1.6 Re-read `apps/web/app/(app)/dashboard/page.tsx` and `apps/web/app/(app)/transactions/page.tsx` and verify they apply `pb-24 sm:pb-0` to the content wrapper

## 2. Validate the spec deltas before merging

- [x] 2.1 Run `openspec validate realign-quick-add-fab-specs --strict` and resolve any failures
- [x] 2.2 Run `openspec change show realign-quick-add-fab-specs --json` and confirm each MODIFIED requirement's header matches the live spec header (whitespace-insensitive) and each ADDED requirement has at least one scenario
- [x] 2.3 Confirm no other spec under `openspec/specs/` references "Nuevo movimiento", "FAB", or "register_movement" in a way that becomes inconsistent after this delta lands (grep across `openspec/specs/`) — extended the delta to also MODIFY `transactions/spec.md` "El encabezado de Movimientos es minimalista y pelado" so the `acceso para registrar pasa por el FAB` sentence matches the as-shipped behavior and the desktop-web register-access gap is explicit.

## 3. Land the change

- [ ] 3.1 Merge `feature/quick-add-fab-redesign` to `main` (user-driven per AGENTS.md — do not auto-merge)
- [ ] 3.2 After the code is on `main`, archive this proposal via `openspec archive realign-quick-add-fab-specs` so the spec deltas fold into `openspec/specs/dashboard/spec.md` and `openspec/specs/transactions/spec.md`
- [ ] 3.3 Verify the archive ran cleanly: `git diff openspec/specs/dashboard/spec.md openspec/specs/transactions/spec.md` should show exactly the requirement changes described in `specs/**/*.md`, nothing else
- [ ] 3.4 Commit the archive result with a `chore(openspec): archive realign-quick-add-fab-specs.` title (no body, no trailers) and merge to main
