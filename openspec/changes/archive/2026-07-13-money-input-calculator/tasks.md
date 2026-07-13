## 1. Shared evaluator (`@grana/validation`)

- [x] 1.1 Add `evaluateMoneyExpression(input: string): number | null` in `packages/validation/src/money.ts` (tokenizer + recursive-descent over `decimal.js`; `+ − × ÷`, `( )`, unary minus; `,`/`.` decimals; 2dp result; `null` on empty/invalid/÷0). No `eval`/`Function`.
- [x] 1.2 Export it from `packages/validation/src/index.ts`.
- [x] 1.3 Add unit tests covering precedence, parentheses, es-AR decimals, rounding, whitespace, unary minus, and invalid/÷0 → null.

## 2. Inline expression mode in `MoneyAmountInput`

- [x] 2.1 Add internal `draft` state; render `draft ?? formatForDisplay(value)`; detect operator chars (respecting `allowNegative` leading `-`) to enter/exit expression mode without calling parent `onChange`.
- [x] 2.2 Commit on Enter and on blur: evaluate the draft, emit canonical result via `onChange` on success, keep draft on failure. Preserve exact current behavior when no operator is present (both grouped and `groupThousands={false}` paths).
- [x] 2.3 Update the component's header note to document expression mode and the `.`-vs-grouping caveat inside expressions.

## 3. Calculator keypad popover (web)

- [x] 3.1 Create `apps/web/components/ui/money-calculator-popover.tsx`: calculator-icon trigger + `Popover` with numeric keypad (`+ − × ÷`, `( )`, clear/⌫), a running-expression display, and `=` that evaluates via `evaluateMoneyExpression` and returns the canonical result.
- [x] 3.2 Portal into the drawer container (`useDrawerContainer()` + `Portal container`) so it scrolls inside Drawer-hosted forms.
- [x] 3.3 Wire it as a sibling adjacent to `MoneyAmountInput` in each primary call site (positioned per layout), routing `onResult` through the same canonical setter that feeds `onChange`. NOT baked into `MoneyAmountInput` — layouts (borderless 46px hero, currency-prefixed fields) vary too much for a uniform wrapper.

## 4. Wire keypad into primary fields

- [x] 4.1 Movement form: amount hero (create/edit) + exchange destination amount.
- [x] 4.2 Card statement pay form (`pay-card-period-form.tsx`).
- [x] 4.3 Create/edit account (`account-form-ui.tsx` / create form).
- [x] 4.4 Create/edit card (`create-card-form.tsx`, `edit-card-form.tsx`).
- [x] 4.5 Recurrences (`create-recurrence-modal.tsx`, `recurrence-edit-drawer.tsx`, pending-recurrences amount).
- [x] 4.6 Shared settle (`settle-form.tsx`).
- [x] 4.7 Confirm no keypad on filter min/max and narrow cap/reimbursement fields (inline expression still active there).

## 5. Verify

- [x] 5.1 `pnpm typecheck` + `pnpm test` (evaluator suite) green.
- [x] 5.2 Manually drive: type `1200+350*2` in the movement amount → Enter → `1.900`; open keypad inside the movement Drawer, build an expression, `=` fills; confirm popover scrolls in the Drawer.
- [x] 5.3 Regression: plain-number entry, es-AR grouping, `groupThousands={false}` FX field, and `allowNegative` opening balance all behave as before.
