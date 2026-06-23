## 1. Reloj devengado para el gasto del hogar (lectura)

- [x] 1.1 En `apps/web/lib/shared/queries.ts`, agregar una lectura devengada del gasto del hogar (p. ej. `getSharedSpendingBreakdown(supabase, month)`) que mirroree el scoping de `packages/dashboard/src/queries.ts` (`getMonthCategoryBreakdown`): filtro por `date`, excluir `is_parent`, excluir consumos de tarjeta con período ya pagado, cada cuota hija por su fecha; reutilizar `computeCategoryNet` de `@grana/money-logic` donde aplique.
- [x] 1.2 Diferencia de Compartido: sumar el **total del hogar** (`amount`, ambas partes), NO la parte propia; y devolver **ambas monedas** `{ ARS: Slice[], USD: Slice[] }` + totales por moneda. Dejar comentario explicando por qué total (≠ dashboard, que usa parte propia por `spending-counts-shared-split`).
- [x] 1.3 Mantener "tu parte" derivada del total (la mitad / split), sin cambiar su cálculo.
- [x] 1.4 Verificar el modelo de fecha de las cuotas hijas (que cada cuota tenga su `date` en su mes de devengo) para que "cada cuota en su mes" funcione; si el dashboard ya lo resuelve, reusar idéntico.

## 2. Home: consumir devengado + USD

- [x] 2.1 En `apps/web/app/(app)/shared/(home)/page.tsx`, reemplazar el dataset `impactMonth` por el devengado (1.1) para "Gastaron juntos" y el desglose por categoría. Dejar deuda, proyección y "Últimos movimientos" como están.
- [x] 2.2 Renderizar el desglose **USD** además del ARS (hoy solo `arsBreakdown`), USD subordinado y siempre visible (aunque sea cero). Conservar el drill inline por categoría para ambas monedas.
- [x] 2.3 Revisar el indicador "Impacta en {mes}" de "Últimos movimientos": ahora un consumo de tarjeta cuenta en el gasto del mes de compra, pero su impacto en la deuda sigue siendo el del resumen — el indicador debe seguir reflejando el impacto (deuda), no contradecir el devengado del gasto.

## 3. B4 — aviso de saldo negativo al saldar

- [x] 3.1 En `apps/web/app/(app)/shared/settle/_components/settle-form.tsx`, importar `NegativeBalanceNotice` y `checkNegativeBalance` (mismos que el alta de movimiento).
- [x] 3.2 Calcular `checkNegativeBalance(disponibleDeLaCuentaElegida, monto)` y mostrar el aviso cuando dé negativo; NO bloquear el submit. Asegurar que la ruta de saldar tenga el `disponible` por cuenta (si falta, traerlo de la misma fuente que el alta de movimiento).

## 4. Tests

- [x] 4.1 Tests de la lógica devengada compartida en `apps/web/lib/shared/__tests__/`: consumo de tarjeta comprado este mes con resumen futuro **cuenta** este mes; cuota cuenta en su mes; total del hogar (ambas partes); ARS y USD por separado; reintegros netean.
- [x] 4.2 Test del aviso de saldo negativo al saldar (la condición `disponible − monto < 0` dispara el aviso y no bloquea).
- [x] 4.3 Correr `pnpm --filter web test`, `pnpm typecheck`, `pnpm lint` — todo verde.

## 5. Cierre (en la branch, antes del merge)

- [x] 5.1 QA integral del Paso 2 + lo que quedó del Paso 1 (confirmar recepción de liquidación; revisar números devengados con datos reales). Reportes por ID; fixes en la branch.
- [x] 5.2 Archivar el change: mover a `openspec/changes/archive/AAAA-MM-DD-shared-spending-accrual-bimoneda/` y aplicar los deltas a `openspec/specs/shared/spec.md`.
- [x] 5.3 Verificar higiene de spec (sin TBD ni secciones delta residuales) y dejar la branch lista. El merge ff-only / squash lo hace el usuario.
