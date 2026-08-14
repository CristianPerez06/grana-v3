# money-input-calculator Specification

## Purpose

Arithmetic entry for money fields. A shared, `decimal.js`-backed expression
evaluator lets any amount field resolve a typed expression (e.g. `1200+350*2`)
to its total inline, and an opt-in calculator keypad (mouse- and
keyboard-driven) offers the same on the primary amount-entry fields. Keeps the
canonical `onChange` contract of `MoneyAmountInput` unchanged so all downstream
parsing/validation is unaffected.

## Requirements
### Requirement: Arithmetic expression evaluation

The system SHALL provide a shared `evaluateMoneyExpression(input: string): number | null`
in `@grana/validation` that evaluates an arithmetic expression using
`decimal.js` precision, supporting `+`, `−` (`-`), `×` (`*`), `÷` (`/`),
parentheses, unary minus, and es-AR decimals (comma or dot). It SHALL NOT use
`eval`/`Function`. It SHALL return the result rounded to 2 decimal places, or
`null` for empty, malformed, or non-computable input (including division by
zero).

#### Scenario: Sum of terms with precedence

- **WHEN** `evaluateMoneyExpression("1200+350*2")` is called
- **THEN** it returns `1900`

#### Scenario: Parentheses and es-AR decimal

- **WHEN** `evaluateMoneyExpression("(1000,50 + 0,50) / 2")` is called
- **THEN** it returns `500.5`

#### Scenario: Result rounded to two decimals

- **WHEN** `evaluateMoneyExpression("10/3")` is called
- **THEN** it returns `3.33`

#### Scenario: Invalid expression returns null

- **WHEN** `evaluateMoneyExpression("1200+")` or `evaluateMoneyExpression("5/0")` is called
- **THEN** it returns `null`

### Requirement: Inline expression entry in money fields

The shared `MoneyAmountInput` SHALL let the user type an arithmetic expression
directly. While the field's text contains an operator, the component SHALL show
the expression as typed and SHALL NOT emit a canonical value upstream. On commit
(Enter key or blur) it SHALL evaluate the expression and, on success, emit the
canonical result through its normal `onChange`. A field whose text contains no
operator SHALL behave exactly as before (unchanged canonical/grouping path).

#### Scenario: Expression resolves on Enter

- **WHEN** the user types `1200+350` in a money field and presses Enter
- **THEN** the field displays the grouped total `1.550` and `onChange` receives canonical `1550`

#### Scenario: Expression resolves on blur

- **WHEN** the user types `2*999` and moves focus away
- **THEN** the field displays `1.998` and `onChange` receives canonical `1998`

#### Scenario: Invalid expression is preserved for correction

- **WHEN** the user types `1200+` and blurs
- **THEN** the field keeps the text `1200+` and does not emit a canonical value

#### Scenario: Plain number unaffected

- **WHEN** the user types a plain amount with no operator
- **THEN** the field behaves identically to the pre-change grouping/canonical behavior

### Requirement: Calculator keypad popover on primary fields

The system SHALL provide a `MoneyCalculatorPopover` opened from a calculator-icon
trigger, rendering a numeric keypad with `+ − × ÷`, parentheses/clear, a
running-expression display, and an equals action that fills the associated field
with the canonical result via its normal commit path. The keypad SHALL be opt-in
per field and SHALL be enabled only on primary amount-entry fields (movement
create/edit amount, card-statement pay, create/edit account, create/edit card,
recurrence amount, shared settle). When rendered inside a Drawer, the popover
SHALL portal into the drawer container so it remains scrollable.

#### Scenario: Keypad fills the field

- **WHEN** the user opens the keypad on the movement amount field, taps `1 2 0 0 + 3 5 0`, then `=`
- **THEN** the amount field receives canonical `1550` through the same path as typing

#### Scenario: Keypad accepts the physical keyboard

- **WHEN** the keypad is open and the user types digits and operators on the physical keyboard, then presses Enter
- **THEN** the keys drive the running expression (mapping `*`/`x`→`×`, `/`→`÷`, `.`→`,`), Backspace deletes, Escape closes, and Enter applies the canonical result

#### Scenario: Keypad absent on non-primary fields

- **WHEN** a filter min/max or narrow cap money field renders
- **THEN** no calculator trigger is shown, while inline expression entry still works

#### Scenario: Popover scrolls inside a Drawer

- **WHEN** the keypad opens within a Drawer-hosted form
- **THEN** the popover content is scrollable (portaled into the drawer container)

### Requirement: Calculator keypad on native primary fields

The system SHALL provide a touch calculator keypad on the native (React Native)
surfaces for the same primary amount-entry fields where the web keypad is
enabled (movement create/edit amount and the other primary fields listed for the
web keypad). On native it SHALL be presented as a **sheet** (bottom sheet /
overlay) opened from a calculator-icon trigger — **not** a `Popover` — and it
SHALL be driven entirely by **on-screen taps**, without depending on a physical
keyboard. The keypad SHALL render `+ − × ÷`, parentheses/clear, a
running-expression display, and an equals action.

The native keypad SHALL evaluate its expression with the shared
`evaluateMoneyExpression` (`@grana/validation`) and, on equals, SHALL fill the
associated field with the canonical result through the **same `onChange` commit
path** as `MoneyAmountInput`, leaving all downstream parsing/validation
unchanged. Opening the keypad SHALL take over amount entry (dismissing the
field's soft keyboard) so the two input modes do not conflict. The web keypad
behavior (`MoneyCalculatorPopover`, physical-keyboard mapping, portal into a
Drawer) is unchanged by this requirement.

#### Scenario: Native keypad fills the field

- **WHEN** the user opens the calculator sheet on the native movement amount field, taps `1 2 0 0 + 3 5 0`, then `=`
- **THEN** the amount field receives canonical `1550` through the same path as typing
- **AND** the sheet closes

#### Scenario: Native keypad needs no physical keyboard

- **WHEN** the native calculator sheet is open
- **THEN** every operation (digits, `+ − × ÷`, parentheses, clear, delete, equals) is available as an on-screen tap target
- **AND** no action depends on a hardware `Enter`, `Escape`, or `Backspace` key

#### Scenario: Opening the keypad takes over entry

- **WHEN** the user opens the calculator sheet while the amount field's soft keyboard is up
- **THEN** the soft keyboard is dismissed and the keypad drives the value
- **AND** applying the result returns focus/commit to the amount field via its normal `onChange`

#### Scenario: Invalid native expression is not committed

- **WHEN** the user builds an incomplete expression such as `1200+` and taps `=`
- **THEN** no canonical value is emitted and the expression is kept for correction

#### Scenario: Web keypad unaffected

- **WHEN** the web movement amount field renders
- **THEN** it keeps using `MoneyCalculatorPopover` with its physical-keyboard mapping and drawer portalling, unchanged
