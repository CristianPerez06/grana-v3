## Context

Every money field in web renders through one shared component,
`apps/web/components/ui/money-amount-input.tsx` (`MoneyAmountInput`), used in 13
call sites. It is a bare, fully-controlled `<input type="text" inputMode="decimal">`:
`value` (canonical string) in, `onChange(canonical)` out, display grouped es-AR
via `formatForDisplay`. Parsing/validation happens upstream through
`parseMoneyInput` (`@grana/validation`, `decimal.js`-backed). Call-site layouts
are heterogeneous — a 46px borderless hero, fields with a left currency symbol,
narrow `w-28` caps, filter min/max — so no fixed adornment can be baked into the
input uniformly.

## Goals / Non-Goals

**Goals:**
- Let users enter an arithmetic expression in any money field and have it resolve
  to the total, without changing existing layouts or the canonical `onChange`
  contract.
- Provide a discoverable numeric keypad on primary amount fields.
- Keep the evaluator shared and precise (same `decimal.js` money semantics), so
  mobile can reuse it.

**Non-Goals:**
- Mobile UI (owned by the tech lead) — only the shared evaluator is prepared.
- Scientific/advanced functions (%, memory, exponent). Just `+ − × ÷` and `()`.
- Changing FX-rate or non-2dp fields' behavior (they opt out of grouping today;
  they also opt out of the keypad).

## Decisions

### 1. Evaluator lives in `@grana/validation` as `evaluateMoneyExpression(raw): number | null`
A hand-written recursive-descent parser over `Decimal` (tokenizer → expr/term/
factor grammar with `( )` and unary minus). Returns a JS number rounded to 2dp,
or `null` for an empty/invalid/malformed/divide-by-zero expression.
- **Why not `eval()` / `Function`**: code-injection and locale/precision hazards;
  banned. **Why not a lib** (mathjs, expr-eval): heavy dep for a 4-operator
  grammar; we already own `decimal.js`.
- **es-AR input**: the tokenizer accepts `,` and `.` as decimal, `×`/`*` and
  `÷`/`/`. It treats a bare number's separators the same way `toCanonical`/
  `parseMoneyInput` do so a single plain number round-trips identically (grouping
  `.` in a pasted "1.000" is ambiguous with a decimal — resolved below).
- **Single-number fast path**: if the text has no operator, we do NOT route it
  through the evaluator — the input keeps its exact current `toCanonical` path,
  preserving es-AR grouping semantics (`1.000` = 1000). The evaluator only runs
  when an operator is present, where `.`/`,` unambiguously mean decimal.

### 2. Inline expression mode inside `MoneyAmountInput` via local draft state
The input gains internal `draft: string | null` state.
- On change: if the raw text contains an operator char (beyond a leading
  `allowNegative` minus), set `draft = raw` and render it verbatim; do **not**
  call the parent `onChange` yet (canonical must stay a number upstream). Else
  clear `draft` and behave exactly as today.
- On commit (Enter key or blur): if `draft` is set, run `evaluateMoneyExpression`;
  on success call `onChange(canonicalFromNumber(result))` and clear `draft`; on
  failure keep the draft so the user can fix it (no silent wipe).
- Display value = `draft ?? formatForDisplay(value)`. When not editing an
  expression the component is byte-for-byte its current self, so all 13 fields
  are unaffected unless the user types an operator.
- **Why local state, not lift to parent**: parents store a canonical number; an
  in-progress `"1200+"` is not canonical. Keeping the draft internal avoids
  polluting every call site and every server action. External `value` changes
  (currency switch, edit prefill) still win because `draft` is null in the
  steady state.

### 3. Keypad as a separate opt-in component `MoneyCalculatorPopover`
A calculator-icon trigger + `Popover` (existing `@/components/ui/popover`)
containing a keypad and a running-expression/result display. On `=` it evaluates
and calls back with the canonical result. `MoneyAmountInput` gains an optional
`calculator?: { onResult: (canonical: string) => void }`-style prop (final shape
in tasks) that, when present, wraps the input in a `relative` container and
renders the trigger at the inline-end; absent, the render path is unchanged.
- **Why opt-in, not always-on**: layouts vary and narrow/filter fields can't host
  an icon cleanly; primary fields pass the prop, the rest don't.
- **Drawer gotcha**: the movement form, card pay, account/card forms render inside
  a Radix Dialog Drawer, which blocks wheel-scroll on body-portaled poppers. The
  popover MUST portal into the drawer container via `useDrawerContainer()` +
  `Portal container` (same fix already applied to the BankSelectors).

### 4. Keypad writes through the same commit path
Pressing `=` produces a canonical number and routes it through the input's normal
`onChange`, so validation/formatting downstream is identical to typing.

## Risks / Trade-offs

- [Ambiguous `.` in an operator expression] The evaluator treats `.`/`,` as
  decimal, so pasting `"1.000+5"` reads as `1.0 + 5`. → Mitigated: grouping is a
  display-only concern; a user building an expression types operators and cents
  with `,`. Documented in the component note; the no-operator fast path preserves
  paste-of-grouped-number behavior.
- [Draft not propagated to parent mid-edit] A form read while an unfinished
  expression is showing sees the pre-expression value. → Acceptable: commit
  happens on blur before any submit; submit buttons blur the field first.
- [Divide-by-zero / malformed] Evaluator returns `null`; the input keeps the
  draft rather than emitting garbage. → No invalid canonical ever leaves the
  component.
- [Keypad inside Drawer scroll] → Mitigated by the `useDrawerContainer` portal
  fix; covered in tasks and manual verification.
