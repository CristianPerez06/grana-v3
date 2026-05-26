## Context

El módulo global de Movimientos (`/transactions`) es hoy de solo lectura. Las acciones de operar ya existen pero están atadas al contexto de cuenta:

- **Editar/Eliminar** viven en `TransactionDetailHeader` (`apps/web/app/(app)/accounts/[id]/transactions/[txId]/_components/`), que tiene la lógica de borrado por tipo (`deleteTransaction` / `deleteTransfer` / `deleteAdjustment`) y el link a `/accounts/[id]/transactions/[txId]/edit`. El detalle global (`global-transaction-detail.tsx`) solo muestra datos y un link "Ver en cuenta" — y ese link **no aparece** para la madre de cuotas (`account_id=NULL`).
- **Registrar** solo existe vía `/accounts/[id]/transactions/new`; no hay entrada global.
- El **aviso de saldo negativo** no existe: v2 lo hacía pero como bloqueo (`validateDisponibleAfterOperation` + `DisponibleErrorAlert`, invariante I-AH-1). La decisión de Fase 0 (CLAUDE.md:194) lo cambia a aviso no bloqueante.

El `disponible` por cuenta y moneda ya es calculable desde `apps/web/lib/transactions/balance.ts` (wrapper sobre `@grana/money-logic.calculateTransactionSums`). No hay columna de saldo: todo es derivado.

## Goals / Non-Goals

**Goals:**
- Que editar, eliminar, registrar y duplicar sean alcanzables desde el módulo global, sin rodeo y sin dead-ends.
- Reusar al máximo el backend y los componentes existentes (no duplicar formularios ni lógica de borrado).
- Incorporar el aviso de saldo negativo en los write paths acordados, por cuenta y moneda, no bloqueante.

**Non-Goals:**
- Cambios de schema o migraciones (no hay).
- Enforcement server-side de saldo no negativo (la decisión de Fase 0 es explícitamente permitirlo; el aviso es UX, no un guard).
- Paridad mobile (mobile no implementa transactions todavía).
- Transferencia multimoneda y autocategorizador (Fases 2 y 3).

## Decisions

### D1 — Acciones globales reusando componente, no duplicando

Extraer las acciones Editar/Eliminar a un bloque reutilizable y montarlo también en `global-transaction-detail.tsx`, en lugar de reimplementar la lógica de borrado. `TransactionDetailHeader` ya parametriza `showActions` y `returnHref`; la opción de menor riesgo es **factorizar el bloque de acciones** (los botones + `handleDelete` por tipo) en un componente que ambos detalles consuman, pasando `returnHref="/transactions"` desde el global.

- **Alternativa descartada:** duplicar los botones y `handleDelete` en el detalle global. Genera dos copias de la lógica de borrado por tipo → divergencia segura.

### D2 — Edición global reusa la ruta de edición existente

La acción "Editar" del detalle global navega a la ruta de edición ya existente `/accounts/[id]/transactions/[txId]/edit?from=transactions`, derivando el `accountId` del propio movimiento. El back-nav con `from=transactions` ya está soportado por la página de detalle en-cuenta.

- **Caso madre de cuotas (`account_id=NULL`):** el `accountId` se deriva de cualquier hija vía `getInstallmentFamily(parentId)` (la cuenta de la tarjeta vive en `source_account` de las hijas). Así la edición de la compra en cuotas usa el flujo existente y respeta sus reglas (categoría/descripción si hay `paid`).
- **Alternativa descartada:** crear `/transactions/[txId]/edit` nuevo. Más superficie y un segundo formulario de edición a mantener.

### D3 — Eliminar la madre de cuotas desde el global

La eliminación de la compra en cuotas reusa la regla existente (solo si todas las hijas están `pending`) y el camino de borrado en cascada (madre + hijas). El `accountId` requerido para revalidar se deriva de una hija. El detalle global de la madre deja de ser dead-end: ofrece Editar/Eliminar directamente.

### D4 — Registrar desde el global: form unificado v2-style (revisado 2 veces tras QA)

Evolución: (1) primer corte "selector → redirect a `/accounts/[id]/transactions/new`" descartado por fricción; (2) segundo corte "wrapper con selector de cuenta arriba que cambia de form" descartado en QA porque ponía la cuenta **antes** del tipo y redirigía a la cuenta/tarjeta.

Decisión final: `/transactions/new` renderiza un **form unificado nuevo** `movement-form.tsx` (`MovementForm`), modelado en el RegistrarV3 de v2:

- **Tipo arriba** (tabs ingreso/gasto/transferencia/ajuste), **cuenta como campo debajo**.
- Cuentas por tipo: ingreso/transferencia/ajuste → solo efectivo/banco; gasto → efectivo/banco **+ tarjetas**.
- Para gasto + tarjeta, **cuotas (ARS) / cotización (USD) inline** tras el monto.
- Branching del submit a las acciones existentes (`createIncome/createExpense/createTransfer/createAdjustment`, `registerCardPurchase`, `registerInstallments`) + recurrencia (excluida en ajuste y cuotas).
- **Redirect a `/transactions`** tras guardar.
- Aviso de saldo negativo solo para salidas cash/bank; nunca tarjeta (off-ledger).

Se descartó unificar dentro de `TransactionForm`/`RegisterCardPurchaseForm` (tocaría los flujos por-cuenta que ya funcionan y triplicaría contratos de redirect). Trade-off aceptado: duplicación de **markup** (no de lógica) entre `MovementForm` y los forms por-cuenta; extraer subcomponentes compartidos queda como refactor posterior. Los flujos por-cuenta (`/accounts/[id]/transactions/new`) quedan intactos, con su redirect propio correcto.

### D5 — Aviso de saldo negativo: cálculo y ubicación

- **Dónde se evalúa:** en los formularios/CTA de gasto, transferencia saliente, ajuste negativo, confirmar recurrencia y pago de resumen — antes de confirmar.
- **Contra qué compara:** el `disponible` actual de la **cuenta origen**, en la **moneda de la operación**. ARS y USD se evalúan por separado. Nunca contra un total agregado entre cuentas.
- **Cómo se obtiene el disponible:** el server provee el `disponible` actual por moneda de la cuenta seleccionada (reusando `balance.ts`). En el registro global, se obtiene al elegir la cuenta.
- **Aritmética:** la comparación (disponible − salida proyectada < 0) usa `@grana/money-logic` / `Money` (decimal.js). Prohibido `+ - * /` crudo sobre dinero (CLAUDE.md).
- **En edición:** se compara el `disponible` **proyectado** = disponible actual excluyendo el efecto del movimiento que se edita, menos la nueva salida. Así editar un gasto existente no "se avisa a sí mismo".
- **No bloqueante:** el aviso es inline y el submit procede igual. Es distinto del `DisponibleErrorAlert` (error) de v2; acá es advertencia.

## Risks / Trade-offs

- **[Disponible mostrado puede estar levemente desactualizado en el cliente]** → El aviso es best-effort (UX), no un guard contable; el ledger real se deriva server-side al registrar. Aceptable por diseño.
- **[Reusar la ruta de edición de cuenta acopla el global al routing de cuenta]** → Mitigación: es una dependencia ya existente (el link "Ver en cuenta" ya navega ahí); D2 no agrega acoplamiento nuevo, solo lo hace directo.
- **[Selector de cuenta → redirect agrega un paso extra al registrar]** → Mitigación: primer corte de bajo riesgo; si molesta, D4-alternativa lo colapsa a una pantalla.
- **[La madre de cuotas necesita el accountId de una hija para editar/borrar]** → Mitigación: `getInstallmentFamily` ya devuelve las hijas con su `source_account`.
- **[El aviso podría confundirse con un bloqueo]** → Mitigación: copy explícito ("podés registrarlo igual") y estilo de advertencia, no de error.

## Open Questions

- ¿Duplicar movimiento entra en esta Fase o se difiere? (el proposal lo marcó opcional). Si entra, requiere una acción `duplicateTransaction` que reusa el alta con `date=getTodayAR()`.
- ¿El registro global arranca con selector→redirect (D4) o con ruta `/transactions/new` propia (D4-alternativa)?
- Copy exacto del aviso de saldo negativo (pendiente de definición de UX/i18n).
