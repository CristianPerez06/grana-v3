## Why

El módulo Movimientos arrastra una **duplicación estructural** entre la jerarquía global `/transactions/*` y la scoped `/accounts/[id]/transactions/*`. Hoy conviven **cinco formularios** de alta/edición y **dos detalles**:

- creación global: `movement-form.tsx` (ya registra los cinco tipos — ingreso, gasto, transferencia, ajuste, cambio — más consumos y cuotas);
- creación scoped: `transaction-form.tsx` + `register-card-purchase-form.tsx`;
- edición scoped: `edit-transaction-form.tsx` + `edit-exchange-form.tsx`.

El formulario global de creación ya sabe crear todo, pero **no edita**; la edición vive sólo en el árbol scoped. Esa bifurcación es la causa raíz de los bugs del módulo (las dos listas ya divergieron en el Change 1) y obliga a mantener la misma regla de negocio en dos lugares.

Además quedan dos observaciones del usuario sin resolver: al **elegir cuenta en el alta no se ve su saldo**, y **editar es una pantalla distinta y más acotada** que crear.

Este change (Change 3 del rediseño de Movimientos, sobre los Changes 1 y 2 ya integrados) unifica el formulario y colapsa las rutas.

## What Changes

- **Formulario único crear+editar**: `MovementForm` gana un **modo edición** que absorbe la edición de los cinco tipos (incluye consumo de tarjeta y madre de cuotas) y reemplaza a los cuatro formularios scoped. Queda **un solo formulario** en todo el módulo.
- **Editabilidad como lógica pura**: una función `getEditableFields(tx)` en `@grana/money-logic` se vuelve la **única fuente de verdad** de qué campos son editables/visibles por tipo y estado. Las reglas **NO cambian** (ingreso/gasto, transferencia, ajuste, consumo `pending`/`paid`, madre de cuotas con o sin cuota paga, pago de resumen sin categoría); se centralizan. El formulario pasa a ser un renderizador que consulta ese contrato. Reutilizable por mobile.
- **Colapso de rutas — BREAKING (rutas)**: se elimina el árbol scoped `/accounts/[id]/transactions/*` (alta, detalle, edición). **Un movimiento = una URL canónica**: detalle en `/transactions/[txId]`, edición en `/transactions/[txId]/edit`, alta en `/transactions/new`. Las URLs scoped dejan de existir (**borrado duro, sin redirects**: app personal en rebuild, sin consumidores externos; todos los enlaces internos se recablean en este mismo change).
- **Cuenta como contexto, no como jerarquía**: el contexto de cuenta se transmite por query params — `?account=<id>` pre-selecciona la cuenta en el alta (lo usan los CTA de cuenta y de tarjeta); `?from=...` controla el back-nav y la perspectiva (mecanismo ya existente del Change 1).
- **Saldo de la cuenta en el selector**: el selector de cuenta del alta muestra el saldo disponible actual por moneda (bimoneda-aware; las tarjetas de crédito no muestran saldo, son off-ledger). El balance ya llega al form; sólo faltaba renderizarlo.
- **Sin migraciones de base**: es unificación de UI + rutas + extracción de lógica pura.

## Capabilities

### Modified Capabilities
- `transactions`: unifica creación y edición en **un formulario único** gobernado por una función pura de editabilidad (`getEditableFields`), **canoniza las rutas de movimiento** bajo `/transactions/*` (eliminando el árbol scoped por cuenta) con el contexto de cuenta transmitido por query params, y muestra el **saldo de la cuenta en el selector** del alta.

## Impact

- **Web — formularios**: `MovementForm` suma modo edición (prefill desde la transacción + submit a las actions `updateIncome/Transfer/Adjustment/Exchange/InstallmentParent`). Se borran `transaction-form.tsx`, `register-card-purchase-form.tsx`, `edit-transaction-form.tsx`, `edit-exchange-form.tsx`.
- **Web — rutas**: se borra el subárbol `apps/web/app/(app)/accounts/[id]/transactions/*` (new/detail/edit + sus `_components` y `transaction-detail-header.tsx`). Nueva ruta `apps/web/app/(app)/transactions/[txId]/edit`. El alta `/transactions/new` lee `?account=`/`?from=`.
- **Web — enlaces**: se recablean los CTA y filas que apuntaban a rutas scoped (`accounts/[id]/page.tsx`, `cards/[id]/page.tsx`, `cards/[id]/periods/[periodId]/page.tsx`, `payment-cta-block.tsx`, `global-transaction-detail.tsx`) hacia las canónicas con `?account=`/`?from=`.
- **Web — actions**: los `revalidatePath('/accounts/${accountId}/transactions/${id}')` (×4 en `transactions.ts`, más los equivalentes en `credit-cards`) pasan a `revalidatePath('/transactions/${id}')`.
- **money-logic**: nueva función pura `getEditableFields(tx)` + tests exhaustivos (cada tipo × cada estado).
- **i18n**: claves para el saldo en el selector si hicieran falta; reuso de las claves de edición existentes.
- **Sin migraciones**; **sin cambios en mobile** (lo maneja el tech lead; `getEditableFields` queda disponible para reuso).
- **Se apila sobre los Changes 1 y 2**; debe mergearse después de ellos.
- **Fuera de alcance**: quick-add/FAB, detalle como drawer/bottom-sheet, empty states de 3 variantes (Change 4); resumen por moneda en el dashboard.
