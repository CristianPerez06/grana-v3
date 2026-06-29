## Context

Las tarjetas de crédito se modelan como filas de `accounts` con `type='credit'`; cada resumen es un `card_periods` con `start_date`/`end_date`/`due_date`, y el pago se registra en `period_payments`. El total a pagar de un resumen (`pendingAmountARS` / `pendingAmountUSD`) se computa al leer, en `getCardPeriodDetail` (`apps/web/lib/cards/queries.ts`), sumando las transacciones `pending` del período y restando reintegros.

El pago se ejecuta en la server action `payCardPeriod` (`apps/web/app/_actions/credit-cards.ts`), que: confirma el ciclo corriente, inserta una expensa en la cuenta de pago por `data.amount` (calculado en el cliente), marca las transacciones del período como `paid` e inserta la fila en `period_payments`. El form web vive en `…/pay/_components/pay-card-period-form.tsx`.

El impuesto de sellos es un cargo real del banco que hoy queda fuera de Grana salvo que el usuario lo cargue a mano. No existía en v2 (solo como subcategoría manual). Las alícuotas varían por jurisdicción y, como se verificó con tarjetas reales del mismo usuario (Visa 0,1% / Amex 1,2%), varían **por tarjeta**, no por usuario.

## Goals / Non-Goals

**Goals:**
- Que el resumen de Grana cuadre con el resumen real del banco, incluyendo el sello, sin pedirle al usuario que entienda porcentajes ni la ley.
- Pedir la información una sola vez por tarjeta y recordarla.
- Persistir el sello como un movimiento real dentro del período (categorizado), no como un ajuste opaco.
- Dejar la lógica pura y los contratos listos para que mobile (tech lead) los reuse.

**Non-Goals:**
- App mobile (la implementa el tech lead).
- Resúmenes con deuda en USD (la base de cálculo se limita al total ARS).
- Pantalla de settings para editar la alícuota recordada.
- Aplicar el sello automáticamente al cierre del resumen (se hace en el pago, ver decisión abajo).

## Decisions

### 1. La alícuota se guarda por tarjeta, en `accounts.stamp_tax_rate`
Nueva columna nullable `stamp_tax_rate NUMERIC` en `accounts`. `NULL` = todavía no conocida (primera vez). Se extiende el check `chk_credit_columns_only_for_credit` para exigir que sea `NULL` salvo en `type='credit'`, igual que `credit_limit`.

**Por qué por tarjeta y no por usuario:** los dos casos reales del usuario tienen alícuotas distintas (0,1% vs 1,2%), así que el dato pertenece a la tarjeta. **Alternativa descartada:** una tabla de alícuotas por provincia + selección de provincia del usuario — exige que el usuario conozca su jurisdicción y no cubre que dos tarjetas suyas difieran.

### 2. Todo ocurre en el flujo de pago, no al cierre
**Por qué:** al cerrar el resumen el documento real del banco todavía no está disponible, así que el usuario no puede confirmar el monto exacto. Recién al ir a pagar tiene el número en mano. Integrar el campo en el form de pago deja todo en un solo paso y hace que el "monto a pagar" ya incluya el sello.
**Trade-off:** durante la ventana "A pagar" (antes de pagar) el total mostrado no incluye el sello. Se acepta; el sello entra al confirmar el pago.

### 3. Se le pide un monto, no un porcentaje; la alícuota se deriva
**Primera vez** (`stamp_tax_rate IS NULL`): el form muestra un selector de **montos en pesos** — un par de sugerencias calculadas desde las alícuotas más comunes, "Otro monto" (entrada libre para copiar el número exacto del resumen), y "No me cobraron sellos". Microcopy: se pregunta solo esta vez. Al confirmar con monto > 0, se deriva `rate = monto ÷ base` y se persiste en la tarjeta.
**Próximas veces** (`stamp_tax_rate` conocida): el campo viene pre-cargado con `round(base × rate)`, editable.
**Por qué derivar en vez de pedir %:** el usuario no sabe ni le importa la alícuota; sí tiene el monto delante. Derivar cubre cualquier jurisdicción y los redondeos del banco con una UX uniforme.

### 4. Base = total ARS del resumen, congelada antes de insertar
La base es `pendingAmountARS` (consumos `pending` en ARS menos reintegros), computada **antes** de insertar el movimiento de sello, para que el sello no se incluya en su propia base. El cálculo lo hace y revalida el server (no se confía en el número del cliente para derivar/sugerir).

### 5. El sello se persiste como movimiento de tarjeta dentro del período
Al confirmar el pago, si el monto del sello es > 0, se inserta una transacción: `account_id` = la tarjeta, `type='expense'`, `currency_code='ARS'`, `date = period.end_date`, `category` = `impuestos` / subcategoría `impuesto-de-sellos`, `card_period_id = period_id`, `due_date = period.due_date`, `fx_rate_to_ars = NULL`, `is_parent = false`. Se inserta **después** de la confirmación del ciclo corriente y **antes** del flip a `paid` (o directamente con `status='paid'`), de modo que quede barrido dentro del resumen pagado. Esto satisface los invariantes del trigger `trg_fn_credit_transaction_invariants` (toda expensa de crédito requiere `card_period_id`; ARS exige `fx_rate_to_ars = NULL`).

El monto total pagado (la expensa en la cuenta de pago) pasa a ser `consumos + sello`. La base se computó antes, así que no hay doble conteo.

### 6. Lógica pura aislada y testeable
Dos helpers en `packages/money-logic/src/cards.ts`, con aritmética decimal `Money`:
- `deriveStampTaxRate(base, amount): number | null` — `amount / base` (null si base ≤ 0 o amount ≤ 0).
- `suggestStampTaxAmount(base, rate): number` — `round(base × rate)`.
Y una constante de alícuotas comunes para generar las sugerencias de primera vez. Reusables por mobile.

## Risks / Trade-offs

- **[La alícuota derivada puede quedar "sucia" por redondeo del banco]** → Se guarda la tasa cruda; la sugerencia del próximo mes es editable, así que cualquier desvío se corrige sin fricción. Opcional (diferible): "snap" a la alícuota conocida más cercana dentro de una tolerancia para que la sugerencia salga prolija.
- **[Editar el monto en un resumen posterior no debería re-escribir la alícuota recordada]** → Por defecto, editar el monto en un pago NO modifica `stamp_tax_rate`; es una corrección puntual. Cambiar la alícuota recordada queda fuera de alcance (futuro: settings).
- **[Resumen sin sello / exento (CABA)]** → "No me cobraron sellos" / monto 0 no inserta movimiento ni toca la alícuota guardada.
- **[Total "A pagar" no refleja el sello hasta pagar]** → Aceptado por la decisión 2; el sello se suma al confirmar el pago.
- **[Resúmenes USD]** → Fuera de alcance; la base es solo ARS. Si el resumen tiene deuda USD, el sello se calcula igual sobre la base ARS y el USD no lleva sello en esta iteración.
