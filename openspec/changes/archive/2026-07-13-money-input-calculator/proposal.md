## Why

Users routinely need to add up several figures before entering a single amount
(splitting a bill, summing receipts, applying a quantity × price). Today they
must reach for a separate calculator, compute the total, and type it back in —
error-prone and slow. Every money field in web already flows through one shared
component, so we can give all of them arithmetic support in one place.

## What Changes

- Add a shared `evaluateMoneyExpression()` to `@grana/validation`: a safe,
  `decimal.js`-backed recursive-descent evaluator for `+ − × ÷` and parentheses
  with es-AR decimals (comma), **no `eval()`**. Lives in the shared package so
  mobile can reuse it later.
- Teach the shared web `MoneyAmountInput` an **inline expression mode**: when the
  typed text contains an operator, the field shows the expression as typed and
  resolves it to the total on Enter/blur, emitting the same canonical value as
  today. No layout change → all existing money fields gain this automatically.
- Add a new web `MoneyCalculatorPopover`: a calculator-icon trigger that opens a
  numeric keypad (built on the existing `Popover`) with a running-result display;
  pressing `=` fills the field. Opt-in via a prop on `MoneyAmountInput`.
- Wire the keypad into the **primary** amount fields only (movement create/edit
  hero, card-statement pay, create/edit account & card, recurrences, shared
  settle) — not filter min/max or narrow cap fields, where a keypad is noise.

## Capabilities

### New Capabilities
- `money-input-calculator`: arithmetic entry for money fields — inline expression
  evaluation shared across all fields, plus an opt-in keypad popover on primary
  fields. Covers the evaluator's grammar/precision contract and the input's
  commit behavior.

### Modified Capabilities
<!-- No existing spec's requirements change; MoneyAmountInput has no dedicated spec today. -->

## Impact

- **New**: `packages/validation` — `evaluateMoneyExpression()` + tests.
- **Modified**: `apps/web/components/ui/money-amount-input.tsx` — inline
  expression mode + optional keypad prop.
- **New**: `apps/web/components/ui/money-calculator-popover.tsx`.
- **Modified**: primary amount call sites (movement form, card pay form,
  account/card create+edit, recurrences, shared settle) opt into the keypad.
- **Out of scope**: `apps/mobile` (owned by the tech lead) — only the shared
  `evaluateMoneyExpression` util is prepared for reuse.
- Watch the Drawer + portaled Popover scroll gotcha (`useDrawerContainer` +
  `Portal container`).
