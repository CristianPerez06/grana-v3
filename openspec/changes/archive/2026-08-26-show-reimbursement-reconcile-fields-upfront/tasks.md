> Un archivo de código y un delta de spec. El delta no es opcional: el requirement vigente pide explícitamente el expand que la fase 1 borra, así que sin la fase 2 el repo queda contradiciéndose.

## 1. Los controles, visibles desde el primer paint

- [x] 1.1 En `apps/mobile/components/transactions/PendingReimbursementsBlock.tsx`, borrar el `useState` de `expanded` de `PendingRow`
- [x] 1.2 Sacar el gate `{expanded ? (…) : null}` del bloque de monto + fecha: pasa a render incondicional. Conservar el layout de dos columnas (monto | fecha) con el error inline debajo — **no** copiar la única fila envolvente de web, que en un teléfono deja los inputs en unos pocos caracteres
- [x] 1.3 Cambiar el `onPress` del botón primario de `expanded ? commit : () => setExpanded(true)` a `commit`
- [x] 1.4 Verificar por lectura que no se tocó nada más de la fila: `parseMoneyInput` + validación de monto positivo, `Alert.alert` destructivo del cancelar, `busy` por fila, error inline localizado y el `onDone('confirmed' | 'cancelled')` que reporta al bloque
- [x] 1.5 Actualizar el comentario de cabecera de `PendingRow`, que hoy describe el expand y el segundo press
- [x] 1.6 Confirmar que `transactions.reimbursement.pending.real_amount` / `.real_date` siguen siendo las únicas keys que consumen esos labels. Cero i18n nuevo

## 2. Corregir el requirement

- [x] 2.1 Reescribir el párrafo de **Confirmar**: controles visibles desde el primer paint, commit en el primer press, y la razón por la que no pueden esconderse detrás del botón. Sacar la frase "expand in-place" y la afirmación de que eso era paridad con web
- [x] 2.2 Partir el scenario "Confirmar reconcilia monto y fecha inline" en dos: uno que verifica los controles visibles **sin** interacción previa, otro que verifica el commit de un solo press
- [x] 2.3 Dejar intacto el resto del requirement (presentación, colapso, chip de categoría, cancelar, feedback después de actuar): este change no los toca

## 3. Cierre

- [x] 3.1 Verificar que el único archivo modificado bajo `apps/` es `apps/mobile/components/transactions/PendingReimbursementsBlock.tsx`
- [x] 3.2 Verificar que el andamiaje temporal de validación (`apps/*/lib/dev-mock-pending.ts` y sus puntos de inyección) **no** entra en el commit
- [x] 3.3 `pnpm typecheck:mobile` y `pnpm lint:mobile` sin errores
- [x] 3.4 `pnpm typecheck` y `pnpm lint` (web) sin errores
- [x] 3.5 Archivar el change antes del merge: mover a `openspec/changes/archive/YYYY-MM-DD-show-reimbursement-reconcile-fields-upfront/`, aplicar el delta a `openspec/specs/transactions/spec.md` (integrado en el `## Requirements` plano, sin secciones de delta) y correr `pnpm openspec:check`
