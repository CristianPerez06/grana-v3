## Why

El módulo global de Movimientos (`/transactions`) es hoy una **vitrina de solo lectura**: lista, filtra y muestra el detalle de cada movimiento, pero el usuario no puede operar desde ahí. Para editar o eliminar tiene que hacer un rodeo (detalle global → "Ver en cuenta" → detalle en-cuenta), para registrar tiene que entrar primero a una cuenta, y una compra en cuotas abierta desde el listado global queda intocable (la madre no tiene `account_id`, así que ni siquiera ofrece el link de rodeo). Es el dolor que el usuario siente a diario en el módulo que más usa.

Además, esta Fase incorpora el **rider de la decisión de Fase 0** (saldo negativo permitido + aviso no bloqueante, ya grabada en `CLAUDE.md`): el aviso vive en los mismos formularios que tocamos acá, así que se construye en el mismo lugar.

## What Changes

- **Editar / Eliminar desde el detalle global** (`/transactions/[txId]`): exponer las acciones que hoy solo viven en el detalle en-cuenta. El backend (`updateTransaction`, `deleteTransaction`, `deleteTransfer`, `deleteAdjustment`) ya existe; falta superficie de UI.
- **Arreglar el callejón de la compra en cuotas**: la madre (`is_parent=true`, `account_id=NULL`) debe ofrecer Editar/Eliminar desde el detalle global respetando las reglas existentes (editar solo categoría/descripción si hay alguna cuota pagada; eliminar solo si todas las hijas están `pending`). Deja de ser un dead-end.
- **Entrada global "Registrar movimiento"** en `/transactions`: hoy no existe ninguna; crear un movimiento obliga a entrar por una cuenta. Se agrega un punto de entrada en el módulo Movimientos.
- **Duplicar movimiento** (opcional dentro de esta Fase): acción que copia un movimiento con `date = getTodayAR()`. Paridad con v2.
- **Aviso no bloqueante de saldo negativo** (rider de Fase 0): en gasto, transferencia saliente, ajuste negativo, confirmar recurrencia y pago de resumen, cuando la operación dejaría el `disponible` de la cuenta origen por debajo de 0, el formulario muestra un aviso **antes de confirmar**. Informa, no impide registrar. La comparación es contra el `disponible` **de esa cuenta puntual**, por moneda (ARS/USD por separado, nunca combinado). Tarjetas de crédito son off-ledger y no lo disparan.

## Capabilities

### New Capabilities
<!-- Ninguna. Esta Fase opera sobre la capability existente `transactions`. -->

### Modified Capabilities
- `transactions`: se agregan requirements para (a) accionar (editar/eliminar/registrar/duplicar) desde el módulo global de Movimientos, no solo desde el contexto de cuenta; (b) el aviso no bloqueante de saldo negativo en los write paths que reducen el disponible. La parte "el saldo puede ser negativo" ya existe en el spec; lo nuevo es el aviso y la accionabilidad global.

## Impact

- **UI web** (`apps/web`):
  - `app/(app)/transactions/[txId]/_components/global-transaction-detail.tsx` — agregar acciones Editar/Eliminar (incl. caso madre de cuotas).
  - `app/(app)/transactions/page.tsx` — agregar entrada "Registrar movimiento".
  - Formularios de creación/edición y confirmación de recurrencia / pago de resumen — integrar el aviso de saldo negativo.
- **Server actions** (`apps/web/app/_actions/`): reutilizan las existentes; eventual acción `duplicateTransaction` si se incluye Duplicar.
- **Lógica de disponible**: el aviso necesita el `disponible` actual por cuenta y moneda (ya calculable vía `lib/transactions/balance.ts` + `@grana/money-logic`). Cálculo puro reutilizable, sin nueva columna ni persistencia.
- **Sin migraciones de schema** y **sin cambios en mobile** (mobile no implementa transactions todavía).
- **Documentación**: `CLAUDE.md:194` ya actualizado en Fase 0 (saldo negativo permitido + aviso). Sin cambios adicionales de governance.
