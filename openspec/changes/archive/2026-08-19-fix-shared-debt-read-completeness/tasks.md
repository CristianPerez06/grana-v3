## 1. Infra de tests en `@grana/shared`

- [x] 1.1 Agregar `vitest` como devDependency y los scripts `test` / `test:watch` a `packages/shared/package.json`, espejando `packages/dashboard/package.json`
- [x] 1.2 Crear `packages/shared/__tests__/` con un cliente Supabase fake que modele las tablas (`shared_expense_split`, `transactions`, `settlement`), aplique los predicados `eq`/`in`/`gte`/`lt` y **honre `.range()`** con un techo por página configurable
- [x] 1.3 Fijar el baseline: test que corre `getCurrentAccount` sobre un dataset chico (por debajo de cualquier techo) y ancla el saldo, la ecuación y el orden del extracto **antes** de tocar los reads

## 2. Helper de paginación (D2)

- [x] 2.1 Agregar a `packages/shared/src/queries.ts` la constante `PAGE_SIZE = 1000` con el comentario que explica por qué es independiente del `max-rows` del servidor
- [x] 2.2 Implementar el helper privado `fetchAllRows` que itera `.range(offset, offset + PAGE_SIZE - 1)`, acumula, avanza por lo que efectivamente volvió, corta en página vacía y propaga el `error` del builder
- [x] 2.3 Test del helper aislado: con techo de servidor de 2 filas y 7 filas de dataset devuelve las 7 en 4 round-trips, y sin filas devuelve `[]` sin colgarse

## 3. `collectDebtInputs` — el camino de la deuda (D3, D4, D6)

- [x] 3.1 Paginar el read de `shared_expense_split` con `.order('transaction_id').order('user_id')` (orden total por el `unique` de la mig. 0023)
- [x] 3.2 Reemplazar el `.in('id', txIds)` de `transactions` por el predicado `.eq('household_id', …).eq('is_shared', true)`, paginado con `.order('id')`
- [x] 3.3 Verificar que el filtro defensivo `if (!tx || !tx.is_shared || !isBalanceCurrency(...))` queda **intacto** — con D3 es redundante por construcción pero sigue siendo la red de un split extraviado
- [x] 3.4 Resolver la etiqueta de los reintegros desde el `txById` ya cargado, dejando el read residual paginado **solo** para los `linked_transaction_id` ausentes del mapa (se espera vacío)
- [x] 3.5 Paginar el read de `settlement` con `.order('id')` y ampliarlo a las columnas ricas (`id, status, created_at, resolved_at`) para habilitar D5

## 4. Consolidar la lectura de `settlement` (D5)

- [x] 4.1 Cambiar el tipo de retorno de `collectDebtInputs` para devolver las filas ricas de `settlement` una sola vez
- [x] 4.2 Adaptar `getCurrentAccount` para derivar sus `LedgerSettlement` de ese resultado y **eliminar** su segundo read de `settlement` (L349)
- [x] 4.3 Adaptar `getHouseholdDebt` y `getHouseholdOutlook` para proyectar sus `DebtSettlement` desde las mismas filas, sin cambiar el mapeo de `status` ni el `counts`

## 5. Devengado del mes (D7)

- [x] 5.1 Reemplazar los dos `.limit(500)` de `getSharedAccruedMovements` (gastos y reintegros) por el helper paginado, **conservando** la ventana `[start, end)` del mes
- [x] 5.2 Paginar el read de `shared_expense_split` que resuelve "tu parte" (hoy acotado a un `.in()` que puede llegar a exactamente 1000 filas)
- [x] 5.3 Fijar `.order('id')` en los tres reads para que el paginado sea estable

## 6. Tests de no-regresión (D8)

- [x] 6.1 Test de completitud: con techo de servidor por debajo del dataset, la deuda, el saldo y el extracto de `getCurrentAccount` son **idénticos** a los del baseline de 1.3
- [x] 6.2 Test de equivalencia de D3: un movimiento compartido sin splits propios (la madre de cuotas, que el predicado ahora trae) no mueve el saldo
- [x] 6.3 Test de estabilidad: dos invocaciones consecutivas sobre datos sin cambios devuelven el mismo saldo y el mismo orden de extracto
- [x] 6.4 Test del devengado: un mes con más movimientos que el techo por página suma todos en "Gastaron juntos" y en el NETO
- [x] 6.5 Test de guarda: un dataset con un split cuya transacción tiene `is_shared = false` no aporta al saldo (ancla el filtro defensivo de 3.3)

## 7. Verificación y cierre

- [x] 7.1 `pnpm --filter @grana/shared test` en verde
- [x] 7.2 `pnpm typecheck` y `pnpm lint` en verde (web consume el paquete desde server components)
- [x] 7.3 `pnpm typecheck:mobile` y `pnpm lint:mobile` en verde — `apps/mobile/lib/shared/queries.ts` es wrapper fino y **no** debería requerir edición; si la requiere, es señal de que una firma pública cambió y hay que revisarlo
- [x] 7.4 Confirmar que ningún `.select()` del camino de deuda/devengado quedó sin `.range()`: `grep -n "\.from(" packages/shared/src/queries.ts` y revisar cada uno contra el spec delta
- [x] 7.5 QA manual en `/shared/cuenta-corriente`: el saldo, la ecuación y el extracto muestran exactamente lo mismo que antes del change (los volúmenes actuales no cruzan ningún techo, así que cualquier diferencia es un bug introducido)
- [x] 7.6 Archivar el change: mover a `openspec/changes/archive/YYYY-MM-DD-fix-shared-debt-read-completeness/`, sincronizar `openspec/specs/shared-data-access/spec.md` y correr `pnpm openspec:check`
