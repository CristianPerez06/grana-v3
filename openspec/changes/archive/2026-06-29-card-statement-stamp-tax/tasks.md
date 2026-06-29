## 1. Schema y tipos

- [x] 1.1 Crear migración `0046_card_stamp_tax_rate.sql`: agregar columna `stamp_tax_rate NUMERIC NULL` a `accounts`
- [x] 1.2 Extender el check `chk_credit_columns_only_for_credit` para exigir `stamp_tax_rate IS NULL` salvo en `type='credit'` (+ check de rango 0<rate<1)
- [x] 1.3 Actualizar tipos de Supabase (`packages/supabase/src/types.ts`): `stamp_tax_rate` en Row/Insert/Update de `accounts` — editado a mano (no se pudo correr `supabase gen types` sin conexión; conviene regenerar al aplicar la migración)

## 2. Lógica pura (money-logic)

- [x] 2.1 Agregar `deriveStampTaxRate(base, amount): number | null` en `packages/money-logic/src/cards.ts` (división plana, NO Money; null si base ≤ 0 o amount ≤ 0)
- [x] 2.2 Agregar `suggestStampTaxAmount(base, rate): number` en el mismo archivo (`Money.multiply`, redondeo a centavos)
- [x] 2.3 Agregar constante `COMMON_STAMP_TAX_RATES` (alícuotas comunes para sugerencias de primera vez)
- [x] 2.4 Tests unitarios de los tres helpers (en `apps/web/lib/cards/__tests__/utils.test.ts`), incluyendo los casos reales (Visa 0,1% y Amex 1,2%) y round-trip

## 3. Validación y server action

- [x] 3.1 Extender `payCardPeriodSchema` con `stamp_tax_amount` (number, ≥ 0, nullable, opcional)
- [x] 3.2 En `payCardPeriod`: cargar `stamp_tax_rate` de la tarjeta y recomputar la base ARS server-side (`stampTaxBaseARS`)
- [x] 3.3 Si `stamp_tax_amount > 0`: insertar el movimiento de sello (cuenta = tarjeta, `expense`, ARS, `date = period.end_date`, categoría `impuestos`/`impuesto-de-sellos`, `card_period_id`, `due_date`, `fx_rate_to_ars = NULL`) entre la expensa y el flip a `paid`
- [x] 3.4 Si la tarjeta tenía `stamp_tax_rate = NULL` y `stamp_tax_amount > 0`: derivar y persistir la alícuota
- [x] 3.5 Si `stamp_tax_amount` es 0 / ausente: no insertar movimiento ni tocar la alícuota
- [x] 3.6 Resolver los IDs de categoría/subcategoría `impuestos` / `impuesto-de-sellos` (system, `user_id IS NULL`); fallback a null si no se encuentran
- [x] 3.7 Incluir el sello en los dos rollbacks (fallo del flip y fallo de `period_payments`)

## 4. Query de detalle

- [x] 4.1 Exponer `stampTaxRate` en `getCardPeriodDetail` y en el tipo `CardPeriodDetail`; idem en `getCardPeriods` (vista de historial)
- [x] 4.2 Pasar la alícuota al form vía `…/pay/page.tsx`

## 5. UI del form de pago

- [x] 5.1 Estado `stampTax` + recálculo del total `amount = consumos + sello`
- [x] 5.2 Primera vez (`stamp_tax_rate` null): selector de montos (chips de sugerencias + input "Otro monto" + "No me cobraron sellos") con microcopy de "solo esta vez"
- [x] 5.3 Próximas veces (alícuota conocida): campo pre-cargado con `suggestStampTaxAmount(base, rate)`, editable
- [x] 5.4 Sumar el sello al total mostrado y enviarlo como `stamp_tax_amount`
- [x] 5.5 Manejar "No me cobraron sellos" → `stamp_tax_amount = 0`

## 6. i18n

- [x] 6.1 Claves de copy en `es.json` y `en.json` (`stamp_tax_label`, `stamp_tax_first_time_hint`, `stamp_tax_known_helper`, `stamp_tax_other_placeholder`, `stamp_tax_none`)
- [ ] 6.2 Reiniciar el dev server para refrescar el cache del paquete de mensajes y verificar que no haya `MISSING_MESSAGE`

## 7. Verificación

- [x] 7.1 Typecheck + lint + tests del repo en verde (472 tests)
- [x] 7.2 Aplicar la migración 0046 al proyecto Supabase
- [x] 7.3 Flujo manual primera vez: sello insertado con fecha `end_date`, categoría Impuestos, status paid; tasa derivada y persistida correctamente (verificado en user de prueba: base ≈ 50.333,34, chip 1 % → 503,33 → rate 0,00999993)
- [~] 7.4 Flujo manual segunda vez: pendiente (no había segundo resumen "A pagar" de la misma tarjeta el día del QA; lógica cubierta por el test de round-trip)
- [x] 7.5 Mecánica de derivación validada con datos de prueba (la verificación contra los resúmenes reales se hará en el user de producción)
- [x] 7.6 Caso "no me cobraron sellos": no inserta movimiento ni cambia la alícuota
- [ ] 7.7 Archivar el change OpenSpec y sincronizar specs EN la branch antes del merge
