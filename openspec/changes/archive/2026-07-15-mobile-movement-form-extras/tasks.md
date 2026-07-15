# Tasks — mobile-movement-form-extras

## 1. Tabs (Decisión 1, 1b)

- [x] 1.1 Agregar `'adjustment'` y `'exchange'` a `TABS` en `MovementForm.tsx`. Reemplazar el `Segmented` de tabs por un **pill group local de dos filas** (`flex-row flex-wrap`, pills content-sized, activo `bg-card`) — el `Segmented` de 5 opciones `flex-1` wrapea "Transferencia" en un teléfono angosto. Conservar `Segmented` para moneda/split/dirección. Labels de `transactions.types.*`. Verificar que `setTab` sigue reseteando las cascadas.

## 2. Ajuste (Decisión 2)

- [x] 2.1 Toggle de dirección Suma/Resta con `Segmented` (2 opciones, labels cortos `directions.increase`/`decrease` + signo), sobre `form.adjustmentDirection` / `form.setAdjustmentDirection`. Mostrar sólo en `tab === 'adjustment'`, después del bloque de monto.
- [x] 2.2 Banner informativo del ajuste (`drawer.adjust_banner_title` + `drawer.adjust_banner_body`) como card de warning suave; visible en `tab === 'adjustment'`.
- [x] 2.3 Preview "Saldo quedará" (`drawer.balance_will_be`): `current → next` con `Money.add`/`Money.subtract` sobre `form.selectedAccount.balances[form.currencyCode]` según la dirección; sólo create. Colocar tras la descripción (espejo web).
- [x] 2.4 Re-etiquetar la descripción a "Motivo del ajuste" (`drawer.adjust_reason` label + `drawer.adjust_reason_placeholder`) cuando `tab === 'adjustment'`.

## 3. Cambio (Decisión 3)

- [x] 3.1 Extender la ranura de cuenta destino a `tab === 'transfer' || tab === 'exchange'`: para exchange usar `AccountSelectField` sobre `form.cashBankAccounts` → `form.setDestinationAccountId`, label `drawer.account_toward`.
- [x] 3.2 Card de **monto recibido** (`labels.exchange_received`): segundo `MoneyAmountInput` sobre `form.destinationAmount` / `form.setDestinationAmount`, con chip de moneda destino (`form.exchangeDestCurrency`) y hint de tasa implícita `1 {dst} = {sym}{rate} {src}` derivado de ambos montos (read-only). Visible sólo cuando `tab === 'exchange'` y hay `exchangeDestCurrency`.
- [x] 3.3 Hint "sin otra moneda" (`exchange.no_other_currency_hint`, con `{currency}` = la opuesta) cuando `tab === 'exchange'` y `!form.exchangeDestCurrency`; el submit ya lo bloquea el hook.

## 4. Recurrencia (Decisión 4)

- [x] 4.1 Card "Repetir" con `Switch` (`form.isRecurrent` / `form.setIsRecurrent`) + `labels.make_recurrent` + `drawer.repeat_note`. Gate `showRepeat = tab !== 'adjustment' && tab !== 'exchange' && !form.isInstallments`.
- [x] 4.2 Al abrir: hint (`drawer.repeat_hint`), pregunta (`drawer.repeat_question`) y chips de frecuencia `weekly·biweekly·monthly·annual·custom` (patrón visual de los chips de cuotas; `frequencies.*`) sobre `form.frequency` / `form.setFrequency`.
- [x] 4.3 `frequency === 'custom'`: `Input` number-pad para `form.intervalCount` + chip-row de unidad `day·week·month·year` para `form.intervalUnit`, labels con `t('recurrences.custom_interval.units.*', { count })` (plural via translator Hermes) + `recurrences.custom_interval.every`.
- [x] 4.4 `DateField` "repetir hasta" opcional (`drawer.repeat_until`) sobre `form.recurrenceEndDate` / `form.setRecurrenceEndDate`. Nota: el `DateField` mobile no expone `min`, así que no se pone piso de fecha en el picker (el orquestador valida `end_date ≥ start` server-side); es aceptable porque el campo es opcional.

## 5. Verificación

- [x] 5.1 Typecheck mobile en verde; `pnpm -r lint` en verde (salvo el warning pre-existente de `gen-icons.mjs`).
- [x] 5.2 Cero diffs en `packages/` y en `apps/web/` (grep del diff). Cero keys nuevas de i18n.
- [x] 5.3 Smoke en device: **Ajuste** → dirección Suma/Resta cambia el preview de saldo, guarda vía `createAdjustment`. **Cambio** → elegir cuenta destino con otra moneda muestra la card de recibido + tasa; una sin otra moneda muestra el hint y bloquea; guarda vía `createExchange`. **Recurrencia** → activar Repetir en gasto/ingreso/transferencia, elegir frecuencia (y custom: count+unidad+hasta), guarda y crea la regla; no aparece en ajuste/cambio/cuotas.
