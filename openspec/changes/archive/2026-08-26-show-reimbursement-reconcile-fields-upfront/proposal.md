# Proposal: show-reimbursement-reconcile-fields-upfront

## Why

En el bloque **"Reintegros a confirmar"** de la app nativa, "Monto real" y "Fecha" no se ven. Están, pero detrás de un press: `PendingRow` arranca con `expanded = false`, la fila muestra sólo `Confirmar` / `Cancelar`, el primer press en Confirmar revela los dos controles y el segundo commitea (`apps/mobile/components/transactions/PendingReimbursementsBlock.tsx`).

Web no hace eso. `apps/web/lib/transactions/components/pending-reimbursements-block.tsx:201` renderiza en cada fila, **sin condición**, los cuatro controles: `MoneyAmountInput`, `DatePicker`, Confirmar y Cancelar. No hay estado de expand en el componente.

El costo no es el press de más. Un reintegro pendiente es una **expectativa**: `estimated_amount` es lo que el usuario creyó que le iban a devolver, es inmutable, y confirmar es el único momento en que puede declarar cuánto llegó **realmente**. Con los controles escondidos, lo único visible es un botón que aparenta aceptar el estimado tal cual, y corregirlo queda detrás de él. Es exactamente el dato que la fila existe para capturar.

Cierra el issue [#80](https://github.com/CristianPerez06/grana-v3/issues/80).

## What Changes

- **Los dos controles se renderizan sin condición** y el botón primario commitea en su primer press. Se va el estado `expanded` de `PendingRow`; el resto de la fila (parseo del monto, `Alert` destructivo del cancelar, error inline, `busy` por fila, el reporte de `onDone`) no se toca.

- **La fila conserva su layout de dos filas** en vez de copiar la única fila envolvente de web (`flex flex-wrap items-end gap-2`, que mete inputs y botones en el mismo renglón). En un teléfono los cuatro controles en línea dejan los inputs en unos pocos caracteres. Nativo mantiene: monto + fecha en dos columnas, botones abajo. Es la misma decisión de siempre —mismos nombres y semántica, implementación idiomática por plataforma— y no cambia qué datos se piden ni en qué orden.

- **Se corrige spec drift, no sólo el código.** El requirement *"La app nativa muestra los reintegros pendientes accionables en el feed"* declara hoy que el expand in-place es *"paridad con web"*, y no lo es. La frase entró en `2026-07-19-mobile-reimbursement-confirm-cancel` y se restateó verbatim en `2026-08-26-close-native-reimbursements-block-parity` sin cotejarla contra el componente web. El delta la saca y deja el scenario describiendo controles visibles desde el primer paint.

Sin cambios de datos, de mutadores ni de i18n: `transactions.reimbursement.pending.real_amount` / `.real_date` ya se consumen — sólo dejan de estar gateadas.

**Fuera de alcance:** el subtítulo de la fila (web muestra `target · accountName`, nativo muestra la categoría) y el `PendingRecurrencesBlock` nativo, que sigue plano y arrastra el mismo bug de feedback que se arregló en el bloque de reintegros. Ninguno de los dos es este issue.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `transactions`: el requirement **"La app nativa muestra los reintegros pendientes accionables en el feed"** (`openspec/specs/transactions/spec.md`) pide hoy explícitamente el comportamiento que este change borra — *"la fila SHALL exponer inline (expand in-place, sin sheet)"* — y su scenario *"Confirmar reconcilia monto y fecha inline"* arranca en **WHEN** el usuario toca "Confirmar" para recién ahí describir los controles. El delta reescribe el párrafo de **Confirmar** (controles visibles desde el primer paint, commit en el primer press, y la razón por la que no pueden esconderse detrás del botón) y parte el scenario en dos: uno para los controles visibles sin interacción, otro para el commit de un solo press.

**Pre-change check.** El único otro change activo es `mirror-native-chrome-on-web-mobile`, que toca `overlay-primitives`, `page-header` y `web-app-shell` — chrome web, ningún archivo de `apps/mobile`. No toca `transactions`. El change `close-native-reimbursements-block-parity` toca el **mismo requirement**, pero ya está archivado y aplicado al master spec, así que este delta parte del texto vigente y no compite con él.

## Impact

**Mobile — el único código que cambia**

- `apps/mobile/components/transactions/PendingReimbursementsBlock.tsx` — se va el `useState` de `expanded`, el bloque de inputs pasa a render incondicional y el `onPress` del botón primario pasa de `expanded ? commit : () => setExpanded(true)` a `commit`.

**No cambia**

- `apps/mobile/lib/transactions/queries.ts`, `mutators.ts`, `invalidate.ts`.
- `packages/i18n-messages` — cero keys nuevas.
- `apps/web/**` — es la referencia, no el objeto del change.

**Specs**

- `openspec/specs/transactions/spec.md` — vía el delta de arriba.
