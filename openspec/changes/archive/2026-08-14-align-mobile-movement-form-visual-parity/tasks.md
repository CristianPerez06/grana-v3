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

> **Nota:** hecha en un follow-up sobre `main` (branch `feature/movement-form-grouped-field-card`),
> espejando el `fieldGroup` mobile del web: una tarjeta única con divisores que
> contiene chips frecuentes → categoría → cuenta → cuotas → destino → fecha.

- [x] 3.1 Envolver los campos secundarios en **un único contenedor** con divisores (`GroupCard`). Los pickers ganan un modo `grouped` opt-in (fila slim de categoría, eyebrow + filas para cuenta, cuotas borderless).
- [x] 3.2 **Fecha** como fila dentro del contenedor: `DateField bare` (calendario) + chips Hoy/Ayer.
- [x] 3.3 **Descripción**: una sola línea slim. **Ya hecho** en la base (`e9ff06f`).
- [x] 3.4 **Cuotas**: fila borderless dentro del contenedor. **Ya hecho** en la base (`faf0f07`), reubicada dentro de la tarjeta.
- [~] 3.5 Verificar estados de **edición** (cuotas madre, reintegro read-only): typecheck en verde; falta **QA visual en device**.

## 4. Paridad de entrada de monto (miles + coma + cap)

- [x] 4.1 Mover la agrupación de miles es-AR (`toCanonical`/`formatForDisplay`) a **`@grana/validation`** (fuente única) y que web (re-export) y native la usen — antes vivía solo en web.
- [x] 4.2 **Cap de 10 dígitos** enteros en `toCanonical`, compartido por las dos superficies.
- [x] 4.3 Native `MoneyAmountInput` **agrupa miles** al tipear (`654545` → `654.545`) emitiendo el canónico sin cambios.
- [x] 4.4 Native mapea el `.` tipeado a la **coma decimal** es-AR (contraparte del keydown de web).

## 5. Verde + entrega

- [x] 5.1 Typecheck + lint de mobile **y web** en verde; tests de `@grana/validation` (17) y web (550) en verde.
- [~] 5.2 Revisión visual del alta (native + web-mobile): **QA en device/navegador** por el usuario (no reproducible en este entorno headless).
- [x] 5.3 Commits con títulos conventional-commits; push a la branch (rebasada sobre la de chips).
