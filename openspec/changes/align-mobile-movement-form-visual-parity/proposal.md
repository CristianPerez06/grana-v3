## Why

El comportamiento del alta de movimientos **ya está a la par** entre web-mobile y la app nativa: los requirements de `transactions` que salieron de `2026-08-13-simplify-movement-form-surface` (tabs Gasto/Ingreso + "Otros", ocultar la dimensión cuenta con una sola elegible, avanzado como chips de activación, cuotas junto a la cuenta de crédito, categoría sin peaje de subcategoría, fecha Hoy/Ayer) están implementados en **ambas** plataformas.

Lo que **no** está a la par es el **tratamiento visual** de la superficie. El web-mobile presenta el monto como un **hero** (número grande centrado, glifo de moneda tenue, moneda como chip inline, botón de calculadora) y agrupa los campos secundarios en **una sola tarjeta con divisores**. La app nativa cumple el mismo comportamiento pero con la maqueta anterior: label + input + segmented de moneda, y campos en tarjetas separadas. Esa diferencia **nunca fue un requirement** — es polish de implementación que solo aterrizó en web. El resultado es drift visual entre plataformas: dos superficies que "funcionan igual" pero "no se ven igual", justo el tipo de deuda que `grana-checkpoint` marca.

Hay además un gap adyacente: la calculadora (`money-input-calculator`) está documentada **solo en términos de web** — `MoneyCalculatorPopover`, "portal into the Drawer", teclado físico (`Escape`/`Backspace`/`Enter`). El spec nunca nombra *native* ni *sheet*, así que la capacidad quedó scopeada web-only sin decirlo, y el alta nativa no tiene keypad de calculadora.

Este change **no agrega comportamiento nuevo ni toca ninguna regla contable**: documenta la paridad visual como requirement explícito y extiende la calculadora a native, cerrando el hueco que los specs nunca reclamaron.

## What Changes

_(Solo superficie/presentación. Ninguna regla de balance, signo, corte temporal ni contrato del hook compartido cambia.)_

- **Paridad visual del alta entre mobile-web y native (nuevo requirement en `transactions`).** La superficie del formulario de alta SHALL presentar la misma jerarquía visual en las dos superficies mobile: el **monto como hero** (número grande centrado, glifo de moneda atenuado, la moneda como **chip inline** —no un control segmentado aparte— y un disparador de calculadora en la fila del monto), los campos secundarios (categoría, cuenta, cuotas, fecha) **agrupados en una sola tarjeta con divisores**, la **fecha** como disparador de calendario + chips Hoy/Ayer, y la **descripción** como una sola línea slim. En web sigue **gateado por breakpoint** (desktop intacto).
- **Calculadora en native (requirement extendido en `money-input-calculator`).** El keypad de calculadora SHALL estar disponible en las superficies mobile nativas sobre los mismos campos primarios, presentado como una **hoja (sheet) táctil** —no un `Popover`— y manejado por **gestos táctiles**, sin depender de un teclado físico. SHALL llenar el campo con el resultado canónico por el mismo `onChange` de `MoneyAmountInput`. El comportamiento web (popover + teclado físico) queda **sin cambios**.

**Fuera de alcance (Non-Goals):** no se agregan campos ni tipos de movimiento nuevos; no se cambia el contrato de `@grana/movement-form` ni la evaluación de expresiones (`evaluateMoneyExpression` ya es compartida y se reutiliza tal cual); no se toca el formulario **desktop**; no se altera ninguna regla contable.

## Capabilities

### Modified Capabilities

- `transactions`: suma un requirement sobre la **paridad visual de la superficie del alta** entre mobile-web y native. No modifica ninguna regla de balance, signo, corte temporal ni el significado de `transactions.status`.
- `money-input-calculator`: extiende el requirement del keypad para cubrir **native** (hoja táctil, sin teclado físico). No cambia el evaluador compartido ni el contrato de `MoneyAmountInput`.

## Impact

- **`apps/mobile`**: rework de presentación en `components/transactions/MovementForm.tsx` (hero de monto, chip de moneda, agrupación en tarjeta única, fecha, descripción, cuotas borderless) + **nuevo componente** de calculadora nativa (sheet/keypad).
- **`packages/*`**: sin cambios de contrato esperados. `evaluateMoneyExpression` (`@grana/validation`) se reutiliza.
- **`apps/web`**: sin cambios funcionales; sirve como fuente de verdad visual.
- **DB / server actions / reglas contables**: ninguno.
