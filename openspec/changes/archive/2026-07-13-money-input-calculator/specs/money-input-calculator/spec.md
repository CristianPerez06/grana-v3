## ADDED Requirements

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
