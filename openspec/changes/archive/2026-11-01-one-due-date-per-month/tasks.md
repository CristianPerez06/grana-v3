## 1. Regla de proyección

- [x] 1.1 `dueAfterPreviousDueMonth` en `@grana/money-logic`: si el vencimiento proyectado no cae en un mes posterior al del vencimiento anterior, pasa al 1 del mes siguiente a ese.
- [x] 1.2 `suggestNextPeriodDates` la aplica con uno o con varios períodos previos. Sin historial no hay vencimiento anterior y no aplica.
- [x] 1.3 Tests en `packages/money-logic/__tests__/card-period-rollover.test.ts`: el caso Galicia (30/11 → 01/12), un solo período previo, una proyección que ya cae en otro mes queda igual, el cambio de año, y un rolling largo sin meses repetidos.

## 2. Datos existentes

- [x] 2.1 `supabase/migrations/0078_one_due_date_per_month.sql`. El número se eligió contra `main`, donde la última es 0075, pero 0076 y 0077 ya están tomadas por `bugfix/190-link-candidates-names-and-eligibility`. Corre solo el `due_date` de períodos estimados sin pago, en vueltas hasta que no quede ninguno.
- [x] 2.2 Pegar 0078 en el SQL Editor de Supabase (lo hace una persona).

## 3. Verificación

- [x] 3.1 `pnpm test` y `pnpm typecheck`.
