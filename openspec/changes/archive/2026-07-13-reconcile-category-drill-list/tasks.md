# Tasks — reconcile-category-drill-list

## 1. Backend: query devengada por categoría (`@grana/dashboard`)

- [x] 1.1 Extraer las reglas drift-prone de la lente a `@grana/money-logic` (`category-lens.ts`: `categoryOwnPortion` + `countsAsCategorySpend`), usadas por el donut (`getMonthCategoryBreakdown` en `@grana/dashboard`), el sub-desglose (`getMonthSubcategoryBreakdown` en web) y la lista drilleada. Donut sin cambios de comportamiento. **Nota de ubicación**: la lista devengada NO puede vivir en `@grana/dashboard` (dependería de `@grana/transactions` para `toFinancialMovement` → ciclo, ya que transactions→dashboard). Vive en el web layer; dashboard solo aporta las reglas puras vía money-logic.
- [x] 1.2 Implementar `getMonthCategoryLines(supabase, month, categoryId, currency, subcategoryId?)` en `apps/web/lib/transactions/queries.ts`, reusando los helpers: cuota por vencimiento, tu parte de compartidos (filtrando por `user_id`), parte 0 fuera, pago de resumen fuera, reintegros recibidos de la categoría (heredada del gasto linkeado).
- [x] 1.3 Devolver `FinancialMovement[]` (reusa `toFinancialMovement`, con `amount` = tu parte) + `installments: Map<txId,{n,total}>` para el chip. `txId` real ⇒ el detalle funciona. Soporta `UNCATEGORIZED_ID`.
- [x] 1.4 Filtro por subcategoría cuando `subcategoryId` está presente (expensas + reintegros por subcategoría heredada; espejo de `getMonthSubcategoryBreakdown`).
- [x] 1.5 (N/A por el ciclo) — la query vive en web; no se exporta desde `@grana/dashboard`. Los helpers puros SÍ se exportan desde `@grana/money-logic`.

## 2. Test de invariante de reconciliación

- [x] 2.1 Test de invariante (`packages/dashboard/__tests__/category-lines-reconcile.test.ts`): replica ambos caminos de la lente (donut `neto` vs. suma firmada de la lista) sobre el mismo set de filas con los helpers compartidos, y asegura igualdad. Cubre gasto simple, cuota (madre excluida), pago de resumen (excluido), compartido 50/50 (tu parte), compartido 0/100 (excluido), reintegros own + shared (netean). ✅ pasa.

## 3. Frontend: consumo en el drill de `/transactions`

- [x] 3.1 `getMonthCategoryLines` vive en `apps/web/lib/transactions/queries.ts` (toma `DbClient`; se llama con `createClient()` en cliente). No hace falta wrapper aparte.
- [x] 3.2 `MovementListContainer` branchea: `categoryActive = filters.categoryId != null` ⇒ `getMonthCategoryLines` (mes, categoría, moneda visualizada, subcategoría); sin categoría ⇒ `getGlobalMovementsPage` de siempre. Query activa unificada (`activeQ`) para loading/error.
- [x] 3.3 Query key `QUERY_KEYS.categoryLines(month, categoryId, currency, subcategoryId)` + invalidación por prefijo `['transactions','category-lines']` en `invalidateAfterMovementMutation` y `invalidateAfterReimbursementMutation`.
- [x] 3.4 Render reusa `<MovementList>` sin UI nueva: filas `FinancialMovement` con `amount` = tu parte (override en backend) + `installmentChips` (Map txId→"Cuota n de N") por cuota hija.
- [x] 3.5 Reintegro reusa la fila de reimbursement existente (sign '+', estado "recibido"); junto al gasto (sign '-') el neto firmado = peso del donut. Sin forzar signos.
- [x] 3.6 Estado vacío: reusa el `variant` existente (`filter` cuando hay categoría) con onClear que limpia el filtro; no pagina (`hasMore=false`).

## 4. i18n

- [x] 4.1 Reusa `transactions.installment_pair` ("Cuota {n} de {total}", ya en es+en) para el chip; el badge "Compartido" ya lo pinta `MovementRow`. Sin claves nuevas.

## 5. Verificación

- [x] 5.1 QA con data real (usuario, junio 2026): drill de Entretenimiento muestra sub-donut (Netflix 60.000 + Salidas 50.200 = 110.200 = total categoría) con lista que reconcilia; Comida muestra gasto Restaurante −10.000 + reintegro +2.000 netean. Compartidos (Netflix −20.000, Salidas −200) con su parte. OK.
- [x] 5.2 Filas apuntan a la transacción real (detalle navegable) — verificado en el flujo.
- [x] 5.3 Volver a todas las categorías deja el estado limpio (sin moneda pegada) y el donut no revierte al seleccionar subcategoría. Confirmado por el usuario ("ok ahora si").
- [x] 5.4 `pnpm typecheck` + `pnpm lint` ✅ (0 errores, 0 warnings). Tests: `@grana/dashboard` (invariante) + web (466) verdes.

## 6. Cierre (en la branch, antes del merge)

- [ ] 6.1 Sincronizar la spec base `spending-by-category` con el delta y archivar el change OpenSpec en la branch.
- [ ] 6.2 Un commit squasheado; merge ff-only lo hace el usuario.
