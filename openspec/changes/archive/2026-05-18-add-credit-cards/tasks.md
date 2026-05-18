## 1. Schema y migración

- [x] 1.1 Crear migración: ALTER `accounts` para extender el CHECK de `type` y aceptar `'credit'`.
- [x] 1.2 Crear migración: agregar a `accounts` las columnas `credit_limit NUMERIC(18,2) NULL`, `network_id UUID NULL FK card_networks`, `other_network_name TEXT NULL`.
- [x] 1.3 Agregar constraint `chk_credit_columns_only_for_credit`: si `type != 'credit'` entonces `credit_limit IS NULL AND network_id IS NULL AND other_network_name IS NULL`.
- [x] 1.4 Agregar constraint `chk_network_xor`: si `type='credit'` entonces `(network_id IS NULL) <> (other_network_name IS NULL)`.
- [x] 1.5 Agregar constraint `chk_credit_initial_balance` sobre `account_currencies`: si la cuenta padre es `type='credit'` entonces `initial_balance = 0` (vía trigger o constraint check con subquery).
- [x] 1.6 Crear tabla `card_networks (id, slug UNIQUE, name, brand_color, icon_key, display_order, is_active)`. Habilitar RLS: SELECT all authenticated, deny INSERT/UPDATE/DELETE.
- [x] 1.7 Seed inicial de `card_networks`: visa, mastercard, amex, cabal, naranja, naranja_x, mercado_pago con sus colores de marca.
- [x] 1.8 Crear tabla `card_periods (id, account_id FK CASCADE, start_date, end_date, due_date, is_estimated BOOLEAN DEFAULT false, created_at)` + constraint `chk_period_dates` (`start_date < end_date < due_date`) + UNIQUE `(account_id, start_date)`. Habilitar RLS heredada de `accounts`.
- [x] 1.9 Crear tabla `period_payments (id, period_id UUID UNIQUE FK card_periods CASCADE, transaction_id UUID FK transactions, created_at)`. Habilitar RLS heredada.
- [x] 1.10 ALTER `transactions`: agregar `status TEXT NULL CHECK (status IN ('pending','paid'))`, `due_date DATE NULL`, `is_parent BOOLEAN NOT NULL DEFAULT false`, `parent_id UUID NULL FK transactions(id) CASCADE`, `installment_n SMALLINT NULL`, `installments_total SMALLINT NULL`, `card_period_id UUID NULL FK card_periods`, `fx_rate_to_ars NUMERIC(18,6) NULL`.
- [x] 1.11 Agregar constraint que enforce `I-CRED-6`: si la cuenta padre es `type='credit'` y `type='expense'` y `is_parent=false`, entonces `card_period_id IS NOT NULL` y `status IN ('pending','paid')`.
- [x] 1.12 Agregar constraint que enforce `I-CRED-9`: si `installments_total > 1` o `is_parent=true` con N>1, entonces `currency_code='ARS'`.
- [x] 1.13 Agregar constraint que enforce `I-CRED-11`: `fx_rate_to_ars NOT NULL > 0` si y solo si la cuenta padre es `type='credit'` AND `currency_code != 'ARS'` AND `type='expense'` AND `is_parent=false`.
- [x] 1.14 Regenerar `packages/supabase/src/types.ts` con `supabase gen types typescript --project-id <id>`.

## 2. Validación (packages/validation)

- [x] 2.1 Schema Yup para alta de tarjeta (experto): banco obligatorio, red XOR custom name, nombre opcional 1–50, monedas ARS forzada + USD opcional, credit_limit opcional > 0, 4 fechas cronológicas + sanity check (cierre actual ≥ hoy−40d, venc próximo ≤ hoy+90d).
- [x] 2.2 Schema Yup para alta novato (single date): fecha de cierre obligatoria, no anterior a hoy−7d.
- [x] 2.3 Schema Yup para registrar consumo en tarjeta: monto > 0, moneda activa, fecha, categoría obligatoria; si moneda != ARS y account.type='credit', exigir `fx_rate_to_ars > 0`.
- [x] 2.4 Schema Yup para compra en cuotas: igual que consumo + `N ≥ 2`, `currency='ARS'`.
- [x] 2.5 Schema Yup para pago de resumen: amount > 0, payment_account_id existe y activa con ARS, payment_date válido, `next_end_date > current.end_date`, `next_due_date > next_end_date`, sanity `next_end_date ≤ today + 90d`.
- [x] 2.6 Schema Yup para edición de fechas de período: end_date y due_date con cronología estricta; campo `is_estimated` no editable directamente.

## 3. Lógica del motor (packages compartidos)

- [x] 3.1 Helper `derivePeriodStatus(period, today, hasPayment): 'open' | 'closed' | 'overdue' | 'paid'`.
- [x] 3.2 Helper `derivePeriodVariant(period, today, hasPayment, txCount): 'futuro' | 'actual' | 'tarjeta_nueva' | 'cerrado_esperando_pago' | 'vencido' | 'pagado'`.
- [x] 3.3 Helper `suggestNextPeriodDates(periods): { suggestedEndDate, suggestedDueDate }` — algoritmo de promedios con fallback `hoy+30/hoy+45`.
- [x] 3.4 Helper `assignTransactionToPeriod(periods, txDate): period | null` y `getOrCreatePeriodForDate(...)` (rolling lazy).
- [x] 3.5 Helper `splitAmountIntoInstallments(amount, N): Money[]` — residuo a la primera, sin pérdida de centavos.
- [x] 3.6 Helper `getCreditCardDebtCheck(accountId): { hasPendingDebt, reason }` para R-tarjeta-deshabilitación.

## 4. Server actions (apps/web)

- [x] 4.1 `createCreditCard(data)` — alta experto, 4 fechas, transacción atómica de 4 efectos (account + currencies + 2 periodos), validación cronológica.
- [x] 4.2 `createNovatoCreditCard(data)` — alta novato, 1 fecha, transacción atómica (account + currency ARS + 2 periodos `is_estimated=true`).
- [x] 4.3 `registerCardPurchase(data)` — consumo simple 1 cuota (ARS o USD), valida `assignTransactionToPeriod` o dispara rolling, rechaza si cae en período `paid`.
- [x] 4.4 `registerInstallments(data)` — compra en cuotas N>1, valida ARS-only, crea madre + N hijas atómicamente.
- [x] 4.5 `payCardPeriod(periodId, data)` — flujo atómico de 5 efectos (expense + period_payment + UPDATE cuotas + INSERT siguiente período).
- [x] 4.6 `reverseCardPayment(paymentId)` — flujo atómico inverso (UPDATE cuotas a pending + DELETE period_payment + DELETE expense). Documentar que NO toca el período siguiente creado durante el pago.
- [x] 4.7 `updatePeriodDates(periodId, data)` — solo si estado derivado != paid; preview de impacto si reubica tx; rechazo si reubicaría a período inexistente.
- [x] 4.8 `deactivateCreditCardAccount(accountId)` — implementa R-tarjeta-deshabilitación: bloquea si hay períodos no-paid con tx imputadas.
- [x] 4.9 `updateCreditCard(id, data)` — edita nombre, institución, monedas, `credit_limit`; rechaza cambios a `type`, `network_id`, `other_network_name`.
- [x] 4.10 `updateInstallmentParent(parentId, data)` — propaga categoría/descripción a hijas siempre; rechaza monto/fecha/N si alguna hija está `paid`.
- [x] 4.11 `deleteInstallmentParent(parentId)` — rechaza si alguna hija está `paid`; cascada de delete a hijas.
- [x] 4.12 Adaptar `deleteAccount` y `deactivateAccount` para delegar a la variante credit-card cuando `account.type='credit'`.

## 5. Queries (apps/web)

- [x] 5.1 `getCreditCards(userId)` — listado con período activo computado, alertas, métricas para el carrusel.
- [x] 5.2 `getCreditCardDetail(accountId)` — hero, período activo, periodos open (actual + próximo), último período conocido si inactiva, debt check.
- [x] 5.3 `getCardPeriods(accountId)` — todos los períodos de la tarjeta con totales, variantes, info de pago, ordenados por start_date desc.
- [x] 5.4 `getCardPeriodDetail(periodId)` — período + movimientos imputados (ordering determinístico) + info de pago si paid.
- [x] 5.5 `getCardPeriodTransactionCount(periodId)` — para decidir UI de "Editar fechas" (link vs muted).
- [x] 5.6 `getCardNetworks()` — catálogo seed (cached, RLS read-all).
- [x] 5.7 Adaptar `getAccountsGrouped(userId)` para incluir el grupo credit con el carrusel.
- [x] 5.8 Adaptar `getAccountBalances` para excluir transacciones `expense` con `account.type='credit'` y para excluir `is_parent=true`.

## 6. Frontend — listado y detalle de tarjeta

- [x] 6.1 Componente `CreditCardCarousel` (carrusel horizontal con scroll-snap).
- [x] 6.2 Componente `CreditCardItem` (card individual con grilla KPI + alertas).
- [x] 6.3 Componente `CardDatesFooter` (3 modos: normal, ámbar, rojo, sin ciclo).
- [x] 6.4 Componente `CardHero` con eyebrows contextuales + USD subordinado + banner ámbar para overdue.
- [x] 6.5 Componente `PaymentCTABlock` con 5 variantes (estándar/cerrado/vencido/tarjeta_nueva/inactiva).
- [x] 6.6 Componente `QuickActions` variante credit (Registrar consumo + Cuotas con chip "Próximamente").
- [x] 6.7 Componente `PeriodsSection` con 2 cards (actual + próximo) + link "Ver historial completo".
- [x] 6.8 Componente `PeriodCard` con bimoneda stackeada + indicador `is_estimated`.
- [x] 6.9 Componente `EstimatedDateBadge` (iconito 📅) reutilizable.
- [x] 6.10 Componente `CardDetailsSection` (límite con barra + % disp, fecha de alta, fecha de archivado).
- [x] 6.11 Componente `InactiveCardBanner` (cuando archive).
- [x] 6.12 Componente `DeactivateBlockDialog` (cuando R-tarjeta bloquea).
- [x] 6.13 Página `app/(app)/cards/page.tsx` — listado.
- [x] 6.14 Página `app/(app)/cards/[id]/page.tsx` — detalle de tarjeta.

## 7. Frontend — historial y detalle de período

- [x] 7.1 Componente `PeriodsListScreen` portado desde v2 con todas las variantes (futuro/actual/cerrado_esperando_pago/vencido/pagado).
- [x] 7.2 Componente `PeriodDetailScreen` con lista de movimientos imputados + info de pago si paid.
- [x] 7.3 Componente `EditDatesSheet` (bottom-sheet con 2 inputs date + validación cronológica + server-side double-check).
- [x] 7.4 Página `app/(app)/cards/[id]/periods/page.tsx`.
- [x] 7.5 Página `app/(app)/cards/[id]/periods/[periodId]/page.tsx`.

## 8. Frontend — flujos de alta y edición de tarjeta

- [x] 8.1 Componente `CreateCreditCardForm` (experto, 4 fechas, campos en el orden: banco → red → nombre opcional → monedas → límite → fechas).
- [x] 8.2 Componente `EditCreditCardForm` (nombre, institución, monedas, límite; red read-only).
- [x] 8.3 Componente `NetworkSelector` (catálogo + opción "otra red" inline).
- [x] 8.4 Componente `CardCycleSection` (4 inputs date con sub-grupos visuales "Período actual" / "Período siguiente").
- [x] 8.5 Componente `LimitInputWithSuffix` (input numérico + sufijo "ARS" + helper de aclaración bimoneda).
- [x] 8.6 Página `app/(app)/cards/new/page.tsx`.
- [x] 8.7 Página `app/(app)/cards/[id]/edit/page.tsx`.

## 9. Frontend — registrar consumo y cuotas

- [x] 9.1 Componente `RegisterCardPurchaseForm` — extensión del form de gasto cuando la cuenta es credit (agrega selector de cuotas si moneda=ARS, agrega input de cotización si moneda!=ARS).
- [x] 9.2 Adaptar el form de creación de transacción para mostrar selector de cuotas solo si `account.type='credit'` y `currency='ARS'`.
- [x] 9.3 Adaptar el detalle de transacción para mostrar la compra completa cuando la fila es hija (renderiza datos de la madre + lista de cuotas hermanas).

## 10. Frontend — pagar resumen y reversión

- [x] 10.1 Componente `PayCardPeriodForm` con 2 secciones (Datos del pago + Fechas del próximo resumen) + helper-callout A/B + StatementSchema SVG reutilizable.
- [x] 10.2 Componente `USDSubordinatedNote` (cuando hay deuda USD en el período).
- [x] 10.3 Componente `StatementSchema` SVG reusable (compartido con flujo de alta experto).
- [x] 10.4 Componente `ReversePaymentDialog` con confirmación explícita y copy del impacto (cuotas vuelven a pending, expense se borra).
- [x] 10.5 Página `app/(app)/cards/[id]/periods/[periodId]/pay/page.tsx`.
- [x] 10.6 Adaptar el selector de "cuenta de pago" para ser fijo en modo novato ("Mi plata") y selector libre en modo experto (cash/bank ARS).

## 11. Onboarding novato

- [x] 11.1 Paso del onboarding con la pregunta "¿Cuándo cierra tu actual resumen?" y un único `<input type="date">`.
- [x] 11.2 Server action `completeNovatoOnboarding(data)` — atómica: crea "Mi plata" + "Mi tarjeta" + sus `account_currencies` + 2 `card_periods` con fechas calculadas e `is_estimated=true`.
- [ ] 11.3 Tests del onboarding novato end-to-end.

## 12. Tests críticos

- [ ] 12.1 Test schema: insertar `accounts type='credit'` con `initial_balance != 0` falla.
- [ ] 12.2 Test schema: insertar `expense` en tarjeta sin `card_period_id` falla.
- [ ] 12.3 Test schema: insertar `expense` en tarjeta USD sin `fx_rate_to_ars` falla.
- [ ] 12.4 Test schema: insertar compra en cuotas con `currency='USD'` falla.
- [ ] 12.5 Test action `createCreditCard`: crea exactamente 2 períodos con `start P1 = end P1 − 30d` y `start P2 = end P1 + 1d`.
- [ ] 12.6 Test action `createCreditCard`: violación cronológica (R1) rechaza.
- [x] 12.7 Test action `registerInstallments`: $1000 en 3 cuotas → $333.34 + $333.33 + $333.33 (residuo a la primera).
- [ ] 12.8 Test action `registerInstallments`: dispara rolling cuando la cuota cae fuera del último período.
- [ ] 12.9 Test action `payCardPeriod`: marca solo cuotas del período pagado (no de períodos posteriores).
- [ ] 12.10 Test action `payCardPeriod`: crea el siguiente período con `start = current.end + 1d`.
- [ ] 12.11 Test action `payCardPeriod`: pago en período `open` o `paid` falla.
- [ ] 12.12 Test action `reverseCardPayment`: cuotas vuelven a `pending`, expense se borra, period_payment se borra.
- [ ] 12.13 Test action `reverseCardPayment`: el período siguiente creado durante el pago sobrevive a la reversión.
- [ ] 12.14 Test action `registerCardPurchase`: backdating en período `paid` falla.
- [ ] 12.15 Test action `deactivateCreditCardAccount`: con período `closed` no pagado, bloquea con `pending_debt`.
- [ ] 12.16 Test action `deactivateCreditCardAccount`: con todos los períodos `paid`, permite archivar.
- [ ] 12.17 Test action `updatePeriodDates`: en período `paid`, falla.
- [ ] 12.18 Test action `updatePeriodDates`: reubicación que cae fuera de períodos existentes, falla.
- [ ] 12.19 Test action `completeNovatoOnboarding`: con fecha de cierre = `2026-06-15`, crea períodos con las fechas calculadas esperadas (P1 end=`2026-06-15` due=`2026-06-30`, P2 end=`2026-07-15` due=`2026-07-30`), `is_estimated=true`.
- [x] 12.20 Test invariante: helper `derivePeriodStatus` retorna los 4 estados en los 4 escenarios de borde (today=end_date, today=due_date, etc.).
- [ ] 12.21 Test invariante: cuenta `cash` con `credit_limit != NULL` falla.
- [ ] 12.22 Test invariante: cuenta `credit` con `network_id` y `other_network_name` ambos NOT NULL falla.
- [ ] 12.23 Test invariante: cuenta `credit` con `network_id` y `other_network_name` ambos NULL falla.
- [ ] 12.24 Test invariante: SUM saldo de cuenta excluye `expense` con `account.type='credit'`.
- [ ] 12.25 Test invariante: SUM saldo excluye `is_parent=true`.
- [ ] 12.26 Test RLS: usuario no puede leer `card_periods` de otra cuenta.
- [ ] 12.27 Test RLS: usuario no puede modificar `card_networks`.

## 13. Documentación y revisiones

- [x] 13.1 Actualizar `CLAUDE.md` con la nueva entrada del módulo `cards` en la tabla de módulos (status: en curso).
- [x] 13.2 Verificar que los invariantes I-CRED-* estén explícitamente listados en CLAUDE.md sección "Cross-cutting principles".
- [ ] 13.3 Revisar copy del onboarding novato con el PO (pregunta exacta, helper texts).
- [ ] 13.4 Smoke test manual: onboarding novato → registrar consumo → pagar resumen → revertir pago.
- [ ] 13.5 Smoke test manual: onboarding experto → crear tarjeta (4 fechas) → compra en cuotas → editar fechas → pagar resumen.
