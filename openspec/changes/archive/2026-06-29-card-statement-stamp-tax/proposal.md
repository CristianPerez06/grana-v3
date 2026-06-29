## Why

Todo resumen de tarjeta de crédito en Argentina incluye **impuesto de sellos**: un porcentaje del total del resumen que el banco cobra y que varía por jurisdicción (1,5% / 1,2% / 1,0% / 0,6% / 0,44% / 0,3% / 0,1% según la provincia; CABA hoy exento). Hoy el usuario tiene que cargar ese cargo a mano cada mes, y cuando se olvida el total de Grana no coincide con el resumen real. El usuario no sabe ni le interesa el porcentaje ni la ley: solo quiere que su resumen cuadre.

Verificado con resúmenes reales del usuario: Visa total $24.421,97 → sellos $24,42 (0,1%); Amex total $127.313,30 → sellos $1.527,76 (1,2%). Ambos cuadran exacto sobre el total del resumen, confirmando que **la alícuota es por tarjeta** y **la base es el total del resumen**.

## What Changes

- Cada tarjeta guarda, de forma oculta para el usuario, su **alícuota de sellos** (`stamp_tax_rate`). El usuario nunca ve ni elige un porcentaje.
- En el **flujo de pago de un resumen**, Grana incorpora el impuesto de sellos al monto a pagar:
  - **Primera vez** (la tarjeta aún no tiene alícuota): se le muestra al usuario un selector de **montos en pesos** (un par de sugerencias calculadas a partir de las alícuotas más comunes, una opción "Otro monto" para copiar el número exacto del resumen, y "No me cobraron sellos"). Microcopy que aclara que **solo se pregunta esta vez** y que en adelante Grana lo sugiere solo. Al confirmar, Grana deriva y guarda la alícuota (`monto ÷ base`) en la tarjeta.
  - **Próximas veces** (alícuota conocida): el campo viene pre-cargado con la sugerencia (`round(base × alícuota)`), siempre **editable**.
- Al confirmar el pago, el sello se registra como un **movimiento de la tarjeta** con fecha = último día del resumen, categoría `impuestos` / subcategoría `impuesto-de-sellos`, dentro del período pagado. El total pagado (expensa en la cuenta de pago) pasa a ser `consumos + sello`.
- Si el monto del sello es 0 / "no me cobraron", no se inserta movimiento ni se modifica la alícuota guardada.

Fuera de alcance (diferido): app mobile (la lleva el tech lead; dejamos la capa compartida y los contratos listos), resúmenes con deuda en USD, y edición de la alícuota recordada desde settings.

## Capabilities

### New Capabilities
<!-- ninguna nueva: extiende una capability existente -->

### Modified Capabilities
- `cards`: nuevas reglas sobre cómo el pago de un resumen calcula, sugiere, confirma y persiste el impuesto de sellos, y cómo la tarjeta recuerda su alícuota.

## Impact

- **Schema/DB**: nueva columna nullable `stamp_tax_rate NUMERIC` en `accounts` (las tarjetas son `accounts` con `type='credit'`), respetando el check `chk_credit_columns_only_for_credit`. Migración `0046`. Regeneración de tipos de Supabase.
- **Server action**: `payCardPeriod` (`apps/web/app/_actions/credit-cards.ts`) — inserta el movimiento de sello dentro del período y, en la primera vez, persiste la alícuota derivada en la tarjeta.
- **Validación**: `payCardPeriodSchema` (`packages/validation/src/credit-cards.ts`) — nuevo campo opcional para el monto del sello confirmado.
- **Lógica pura**: helpers en `packages/money-logic/src/cards.ts` para derivar alícuota desde un monto y para sugerir el monto desde la alícuota (testeables, reusables por mobile).
- **UI web**: form de pago (`apps/web/app/(app)/cards/[id]/periods/[periodId]/pay/_components/pay-card-period-form.tsx`) — selector de primera vez + campo de sello editable; query de detalle expone la alícuota de la tarjeta.
- **i18n**: nuevas claves de copy (selector, microcopy, etiquetas).
- **Categorías**: reusa la categoría sistema `impuestos` / subcategoría `impuesto-de-sellos` (ya seedeadas).
