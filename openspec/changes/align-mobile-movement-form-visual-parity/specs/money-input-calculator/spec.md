## ADDED Requirements

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
