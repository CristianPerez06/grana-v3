> **Alcance:** paridad **visual** del alta de movimientos entre web-mobile y native + calculadora nativa. Solo presentación; sin cambios de contrato en `@grana/movement-form`, sin server actions, sin DB, sin reglas contables. Fuente de verdad visual: `apps/web/lib/transactions/components/movement-form.tsx` (rama `isMobile`). Web y desktop no se tocan.

## 1. Hero de monto (native)

- [x] 1.1 Reestructurar el bloque de monto de `apps/mobile/components/transactions/MovementForm.tsx` como **hero**: tarjeta con borde, fila superior con eyebrow "MONTO" a la izquierda y, a la derecha, disparador de calculadora + chip de moneda.
- [x] 1.2 Número **centrado**: signo del tipo (`+`/`−`), símbolo de moneda **atenuado**, y `MoneyAmountInput` en tamaño grande con `tabular-nums`, espejando la escala relativa del web-mobile.
- [x] 1.3 **Chip de moneda** inline (reemplaza el `Segmented` actual): muestra la moneda activa + chevron cuando hay más de una; rota con el handler de moneda existente (`cycleCurrency`/`currencyOptions` del hook); inerte con una sola moneda.
- [x] 1.4 Mantener helpers/avisos existentes del bloque (helper de ingreso/ajuste, hint de recálculo de cuotas). _(El aviso de saldo negativo nativo no vivía en el bloque de monto; se mantiene donde estaba.)_

## 2. Calculadora nativa (sheet)

- [x] 2.1 Nuevo componente `apps/mobile/components/ui/MoneyCalculator.tsx`: bottom-sheet (`BottomSheet`) con keypad táctil `+ − × ÷`, paréntesis/clear/borrar, display de expresión y `=`.
- [x] 2.2 Evaluar con `evaluateMoneyExpression` de `@grana/validation`; en `=` llenar el campo por el mismo `onChangeText` del `MoneyAmountInput`; expresión inválida no emite valor.
- [x] 2.3 Al abrir, cerrar el teclado del input (`Keyboard.dismiss()`) para no competir.
- [x] 2.4 Cablear el disparador de calculadora del hero (tarea 1.1) para abrir la hoja, con `seed` = monto actual.

## 3. Agrupación de campos secundarios (native)

> **Nota de base:** esta branch se rebasó sobre `feature/movement-form-frequent-chips`,
> que ya trae buena parte de la paridad de campos (descripción slim, cuotas como
> fila borderless antes de fecha, cuentas como filas full-width, credit chips).
> Por eso la "tarjeta única con divisores" quedó como **polish opcional pendiente**
> sobre campos que ya están prolijos, y la descripción slim ya viene **hecha**.

- [ ] 3.1 Envolver categoría, cuenta y fecha en **un único contenedor** con divisores (`GroupCard`). **Pendiente** sobre esta base (los campos ya son filas prolijas; falta la cáscara de tarjeta).
- [ ] 3.2 **Fecha** como fila calendario + Hoy/Ayer dentro del contenedor agrupado. **Pendiente** (depende de 3.1).
- [x] 3.3 **Descripción**: una sola línea slim. **Ya hecho** en la base (`e9ff06f`).
- [x] 3.4 **Cuotas**: fila borderless antes de fecha. **Ya hecho** en la base (`faf0f07`).
- [~] 3.5 Verificar estados de **edición** (cuotas madre, reintegro read-only): typecheck en verde; falta **QA visual en device**.

## 4. Verde + entrega

- [x] 4.1 Typecheck + lint del workspace mobile **y web** en verde.
- [~] 4.2 Revisión visual del alta (native + web-mobile): **pendiente de QA en device/navegador** (no reproducible en este entorno headless).
- [x] 4.3 Commits con títulos conventional-commits; push a la branch (rebasada sobre la de chips).
