## 1. Lógica pura (`@grana/money-logic`)

- [x] 1.1 Agregar `planPeriodRollForward(periods, throughDate, today)`: devuelve los períodos contiguos a crear hasta cubrir `throughDate`, con un tope de 120. Verificar con tests: tarjeta al día → `[]`; último cierre 25/07 y fecha 06/10 → tres períodos, el último contiene 06/10; tope respetado.
- [x] 1.2 Agregar la variante `sin_consumos` a `PeriodVariant` / `derivePeriodVariant` (`closed`/`overdue` con `txCount === 0`). Verificar con tests de las cuatro combinaciones closed/overdue × con/sin consumos, y que `open` y `paid` no cambian.
- [x] 1.3 Agregar `planPeriodEndEdit` (absorber estimados vacíos o rechazar), siguiendo el estilo de `planRunningCycleConfirmation`. Verificar con tests: próximo estimado vacío → absorber; con transacciones, pago o `is_estimated=false` → rechazar; sin pisar → cascada normal; nada queda después → crear estimado.

## 2. Creación de períodos (`@grana/transactions-mutations`)

- [x] 2.1 Agregar y exportar `rollCardPeriodsForward(supabase, accountId, throughDate, today)` sobre el plan de 1.1, tolerando `23505` (relee y sigue). Verificar con un test de doble de Supabase: inserta los N planificados; si hay conflicto no falla.
- [x] 2.2 Hacer que la rama 4 de `getOrCreatePeriodForDate` use `rollCardPeriodsForward` y devuelva el período que contiene la fecha. Verificar con un test nuevo (consumo del 06/10 con último cierre 25/07 → imputado al período que contiene 06/10) y que `paid-period-assignment` y `predates-history` siguen en verde.

## 3. Lecturas y mutaciones de tarjeta (`@grana/cards`)

- [x] 3.1 `getCreditCards` (solo tarjetas activas) y `getCreditCardDetail` (si `is_active`) completan el calendario hasta hoy antes de leer períodos. Verificar con un test: una tarjeta al día no dispara inserts; una parada sí, una sola vez.
- [x] 3.2 Sumar `'empty'` a `CardTone` y actualizar `cardTone`, `pillTone`, `TONE_RANK`, `applyFilter('due-soon')` y el badge de grupo (todo `empty` → `empty`). Verificar con tests de `grouping` y `presentation`: tarjeta vacía → `empty`, fuera de `Vencen pronto`, grupo mixto → `ok`, `defaultCollapsed` sin cambios.
- [x] 3.3 `updatePeriodDates` aplica `planPeriodEndEdit` (lee todos los posteriores, borra los estimados vacíos absorbidos, cascada sobre el siguiente, crea un estimado si no queda ninguno). Verificar con tests de los escenarios de la spec: absorbe; próximo con consumos bloquea igual.
- [x] 3.4 `payCardPeriod` rechaza un período sin transacciones con un `messageKey` nuevo (`cards.errors.period_empty`). Verificar con un test.
- [x] 3.5 Agregar `orderCycleDateWrites` (orden actual/próximo) y testear el caso de las capturas (actual 25/06 → 22/10, próximo 25/07 → 30/11 ⇒ próximo primero) y el caso normal (actual primero).

## 4. Textos (`@grana/i18n-messages`)

- [x] 4.1 Agregar `cards.pill.empty` («Sin consumos» / «No charges») y `cards.errors.period_empty` en `es.json` y `en.json`, y la etiqueta de la variante `sin_consumos` para el listado de resúmenes (reusar `period.no_movements` si el texto aplica). Verificar que las claves existen en ambos catálogos.

## 5. Web (`apps/web`)

- [x] 5.1 `CardStatusPill` y el `GroupBadge` de `cards-compact-view` soportan el tono `empty` con tokens neutros existentes. Verificar con `pnpm typecheck` y con una story/estado visible en `/cards`.
- [x] 5.2 `periods-list` mapea `sin_consumos` a etiqueta y estilo neutros. El detalle del resumen y la página de pago no cambian de código (ya filtran por `vencido`/`cerrado_esperando_pago`), y se verifica abriendo un resumen vacío: sin CTA y la página de pago redirige.
- [x] 5.3 `EditCardForm` usa `orderCycleDateWrites`. Verificar reproduciendo en el navegador el caso de las capturas: guarda sin error.

## 6. Mobile (`apps/mobile`)

- [x] 6.1 Extender la unión de `lib/cards/types.ts` y `PeriodStatusPill` con `sin_consumos`, y el indicador del `Wallet` con el tono `empty`. Verificar con `pnpm typecheck:mobile`.
- [x] 6.2 `EditCardForm` nativo usa `orderCycleDateWrites`. Verificar con `pnpm typecheck:mobile` y revisando el código del submit.
- [x] 6.3 Grep cruzado de `pill.empty`, `sin_consumos` y `orderCycleDateWrites` en ambas apps para confirmar la paridad.

## 7. Cierre

- [ ] 7.1 Correr `pnpm verify` en verde.
- [ ] 7.2 Probar en la web a ancho de escritorio y de teléfono con una tarjeta parada: muestra "Sin consumos", el ciclo en curso, no suma en "A pagar", y editar las fechas guarda sin error.
