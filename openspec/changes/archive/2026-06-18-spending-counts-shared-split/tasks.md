## 1. getMonthCategoryBreakdown (@grana/dashboard)

- [x] 1.1 `uid` vía `supabase.auth.getUser()`.
- [x] 1.2 `id, is_shared` en el select de gastos y reintegros.
- [x] 1.3 `sharedIds` (gastos+reintegros) → `shared_expense_split` filtrado por `user_id = uid` → mapa `transaction_id → amount_assigned`.
- [x] 1.4 Loop de gastos: compartido → parte (`ownPortion`); sin fila propia → saltear; propio → completo.
- [x] 1.5 Loop de reintegros: misma regla; categoría derivada del gasto linkeado intacta.

## 2. getMonthSubcategoryBreakdown (web)

- [x] 2.1 Misma lógica `ownPortion` (gastos + reintegros) para el drill.

## 3. Tests

- [ ] 3.1 (Diferido) La lógica vive en funciones de integración (Supabase); el split base (`amount_assigned`) y el neto se validan con el smoke (4.4) + los tests de `computeCategoryNet`. Extraer `ownPortion` a helper puro = opcional follow-up.

## 4. Verificación

- [x] 4.1 `@grana/dashboard` 16/16 + suite web 390/390.
- [x] 4.2 `typecheck` web + mobile verdes.
- [x] 4.3 `eslint` web limpio (el package no tiene script de lint; el typecheck lo cubre).
- [x] 4.4 Smoke con datos reales: Transporte = `165.000,51` (gastos tu-parte 173.610,97 − reintegros tu-parte 8.610,46), coincide exacto con la app. ✓
- [x] 4.5 `openspec validate spending-counts-shared-split --strict` ✓.
