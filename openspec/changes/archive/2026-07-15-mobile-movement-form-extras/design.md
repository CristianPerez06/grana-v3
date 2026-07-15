# Design — mobile-movement-form-extras

## Contexto

El form de alta ya funciona y el hook `useMovementForm` ya soporta ajuste, cambio y recurrencia en `submitCreate` (rutea por `tab`, dispara `createRecurrenceFromMovement` cuando `isRecurrent`). Esto es **puro pintado** sobre estado ya expuesto: cero lógica nueva, cero cambios a `@grana/*`. Cada pieza mapea 1:1 al web (`apps/web/lib/transactions/components/movement-form.tsx`) traducida a primitivos nativos. Un solo archivo cambia: `apps/mobile/components/transactions/MovementForm.tsx`.

## Decisión 1 — Un change, no tres

Ajuste, cambio y recurrencia se hacen juntos: tocan el mismo archivo, el mismo render pass, y son todos aditivos sobre estado ya cableado (sin riesgo de capa compartida). Partirlos serían tres proposals/ramas/reviews para una única historia coherente ("terminar el form de alta"). El gating entre ellos ya lo resuelve el hook (ajuste/cambio ocultan categoría y recurrencia; recurrencia se oculta en cuotas).

## Decisión 1b — Selector de tabs: pill group de dos filas (no `Segmented`)

El `Segmented` compartido da `flex-1` a cada opción en una sola fila — bien para las 3 tabs de hoy, pero con **5** tabs en un teléfono ~360px "Transferencia" recibe ~40px y wrapea a 2–3 líneas. No hay mock nativo del selector. Se resuelve rindiendo el selector de tabs como un **pill group local a `MovementForm` que wrapea a dos filas** (pills content-sized, activo = `bg-card`, inactivo = muted), conceptualmente el mismo control que web pero con layout idiomático mobile (ver [[feedback_cross_platform_components]]). El `Segmented` compartido se conserva para los controles de 2–3 opciones cortas (moneda, split, dirección de ajuste). Descartado el scroll horizontal: escondería Ajuste/Cambio en el primer paint. Confirmado con el usuario en apply.

## Decisión 2 — Ajuste: `Segmented` para la dirección (a diferencia del target del reintegro)

La dirección Suma/Resta son **dos labels cortos** ("Suma (+)" / "Resta (−)") → `Segmented` es el control correcto y ya existe en mobile. Esto contrasta deliberadamente con el target del reintegro, que quedó como radio vertical porque sus labels son frases largas (ver `mobile-select-field`, Decisión 4). Regla: `Segmented` para 2–3 opciones de label corto; radio vertical cuando los labels wrapean.

Piezas del ajuste, espejo del web:
- Toggle dirección (`Segmented`, `form.adjustmentDirection` / `form.setAdjustmentDirection`).
- Banner informativo (`drawer.adjust_banner_title` + `_body`), card de warning suave.
- Preview "Saldo quedará" (`drawer.balance_will_be`): `current → next` con `Money.add`/`Money.subtract` sobre `selectedAccount.balances[currencyCode]`, sólo en create (mismo cálculo que web `adjustmentPreview`).
- Descripción re-etiquetada a "Motivo del ajuste" (`drawer.adjust_reason` + placeholder) cuando `tab === 'adjustment'`.
- Categoría oculta (ya lo está: `showCategory = expense || income`).

## Decisión 3 — Cambio: reusar `AccountSelectField` + segunda money-card

- Cuenta destino: se reusa `AccountSelectField` (el mismo que transferencia) sobre `form.cashBankAccounts`, `form.destinationAccountId`, `form.setDestinationAccountId`. La ranura de destino se comparte: se renderiza cuando `tab === 'transfer' || tab === 'exchange'` (lista `otherAccounts` para transfer, `cashBankAccounts` para exchange — ambas ya salen del hook).
- Monto recibido: card bordeada con un segundo `MoneyAmountInput` (`form.destinationAmount` / `form.setDestinationAmount`) y el chip de moneda destino (`form.exchangeDestCurrency`, la opuesta a la de origen). Hint de tasa implícita `1 {dst} = {sym}{rate} {src}` derivado de ambos montos (read-only), igual que web.
- Sin moneda destino: cuando `exchangeDestCurrency` es null (la cuenta destino no habilita la otra moneda) se muestra `exchange.no_other_currency_hint` en vez de la card; el hook ya bloquea el submit con `errors.destination_account_no_other_currency`.
- La moneda de **origen** se elige con el `Segmented` de moneda que ya existe (aparece cuando la cuenta tiene ARS+USD).

## Decisión 4 — Recurrencia: card con chips, unidad custom como chip-row

Card "Repetir" (tercer card del form, siguiendo el idiom mobile de reintegro/compartir como cards separadas, no el `togglesGroup` agrupado del web):
- `Switch` (`form.isRecurrent`) + nota (`labels.make_recurrent`, `drawer.repeat_note`).
- Al abrir: hint (`drawer.repeat_hint`), pregunta (`drawer.repeat_question`), y **chips de frecuencia** semanal/quincenal/mensual/anual/personalizado (mismo patrón visual que los chips de cuotas; `frequencies.*`).
- `frequency === 'custom'`: `count` en un `Input` number-pad + **chip-row de unidad** día/semana/mes/año (en vez del `<select>` web — se mantiene nativo y consistente con los chips de frecuencia). Las unidades usan `recurrences.custom_interval.units.*`, que son ICU plural resueltos por el translator manual de Hermes (ver `project_mobile_hermes_intl_plurals`).
- `DateField` de "repetir hasta" opcional (`drawer.repeat_until`), min = `form.date`.
- Gating: lo da el hook/`submitCreate` — recurrencia sólo en gasto-no-cuotas / ingreso / transferencia. En mobile: `showRepeat = tab !== 'adjustment' && tab !== 'exchange' && !form.isInstallments`.

## Decisión 5 — i18n: cero keys nuevas

Todas las keys ya existen en `@grana/i18n-messages` porque web las renderiza; el catálogo mobile carga el objeto entero (`apps/mobile/lib/i18n.ts` importa `es`/`en` completos y hace lookup por path). Las custom-interval units viven bajo el namespace `recurrences.*` (no `transactions.*`), así que se llaman con el `t` global directo (`t('recurrences.custom_interval.units.month', { count })`), no vía el `translate` del hook que prefixea `transactions.`.

## Riesgos / notas

- **Sin tests de negocio nuevos**: no hay lógica; el ruteo de ajuste/cambio/recurrencia ya está cubierto en `@grana/movement-form` (9 tests). Verificación = typecheck + lint + smoke en device.
- **Orden de campos**: el ajuste inserta dirección+banner cerca del monto y el preview tras la descripción (espejo del orden web: hero → adjustmentSign → banner → … → adjustmentPreviewRow). El cambio inserta la card de recibido tras la fecha. La recurrencia va con los otros cards de toggle al final.
- **Cero diffs fuera de mobile**: si aparece un diff en `packages/` o `apps/web/`, algo se salió de scope.
