## Why

Hoy las únicas mutaciones accesibles desde el card de cuenta en `/accounts` son **Editar** (drawer) y **Reactivar** (botón inline en archivadas). Para **archivar** o **eliminar** una cuenta, el usuario tiene que entrar al detalle (`/accounts/[id]`) — un round-trip de navegación para una acción que conceptualmente pertenece a la fila. Encima, esas mutaciones siguen usando `window.confirm()` browser-nativo en `account-detail-header.tsx`, que rompe el lenguaje visual de la app (no usa tokens, no es accesible por teclado consistentemente, no permite mostrar el contexto de la cuenta ni el error tipado).

El objetivo de este change es **mover todas las mutaciones de una cuenta al propio card de la fila** en `/accounts`, con un menú kebab que abre el conjunto idiomático según el estado de la cuenta (activa vs archivada, con vs sin transacciones), y reemplazar el `confirm()` nativo por un **dialog de confirmación tokenizado**. La regla "eliminar si no hay transacciones, archivar si hay" — ya codificada en el spec — pasa a ser visible directamente en el menú del card en vez de descubrirse en el detalle.

## What Changes

- **AGREGAR** `apps/web/components/ui/dialog.tsx`: primitivo de dialog modal (Radix-less, sobre `@/components/ui/drawer` o nuevo) para confirmaciones bloqueantes. Reemplaza `window.confirm()` en flujos donde el contexto (nombre de cuenta, cuerpo del mensaje, error tipado) importa. Patrón mínimo: `<Dialog open onClose><DialogHeader/><DialogBody/><DialogFooter/></Dialog>`, con foco trapped y `Esc`/click-outside cerrando.
- **AGREGAR** `apps/web/components/ui/dropdown-menu.tsx`: primitivo de menu (sobre `Popover` ya existente) con `MenuItem`/`MenuItemDestructive`/`MenuSeparator`. Trigger es agnóstico (cualquier botón); el menu se ancla al trigger.
- **AGREGAR** `apps/web/app/(app)/accounts/_components/account-row-menu.tsx`: kebab (`MoreVertical`) en cada `AccountRow`. Reemplaza el `Pencil` inline actual. Reglas:
  - Cuenta **activa con transacciones**: `Editar` → abre edit drawer existente (vía `useAccountsEditDrawer`); `Archivar` → abre confirm dialog.
  - Cuenta **activa sin transacciones**: `Editar`; `Archivar`; `Eliminar` (destructive). El submit de Eliminar abre el confirm dialog con copy específico.
  - Cuenta **archivada con transacciones**: `Reactivar` → ejecuta directo (sin confirm, como hoy); el item queda en el menú.
  - Cuenta **archivada sin transacciones**: `Reactivar`; `Eliminar` (destructive).
- **AGREGAR** `apps/web/app/(app)/accounts/_components/account-confirm-dialog.tsx`: dialog reusable para los tres flows (archivar, eliminar, eliminar tarjeta — este último out of scope acá). Recibe `action: 'archive' | 'delete'`, `account`, `onSuccess` y `onCancel`. Muestra el nombre de la cuenta, copy localizado por action, `formError` si la action devuelve `!ok`, y el CTA destructive cuando aplica.
- **MODIFICAR** `apps/web/lib/accounts/queries.ts`: `getCashAndBankAccounts` (y su tipo `AccountWithBalances`) SHALL incluir `has_transactions: boolean` derivado de un single round-trip (count > 0 en transactions del usuario para esa cuenta, considerando origen y destino-de-transferencia). Reemplaza el fetch de movimientos ascendentes que hoy hace el detail page solo para decidir archive-vs-delete.
- **MODIFICAR** `apps/web/app/(app)/accounts/_components/account-row.tsx`: el slot de acción al final de la fila pasa de "ícono Pencil o link Reactivar" a "ícono `MoreVertical` que abre el menu". El path de fallback `/accounts/[id]/edit` deja de mostrarse en la lista (sigue accesible vía URL directa). Reactivar sigue siendo inline-only en mobile-web si el espacio del menu fuera incómodo — a decidir en `design.md`.
- **MODIFICAR** `apps/web/app/(app)/accounts/[id]/_components/account-detail-header.tsx`: elimina los handlers `handleArchive`/`handleDelete` y los botones asociados; el detalle pasa a tener **solo el botón Editar** (drawer) en el slot derecho del header. Las mutaciones de baja viven en la lista. **MOTIVACIÓN**: una única superficie de mutación reduce duplicación de copy/errores y elimina la inconsistencia entre `confirm()` nativo del detalle vs dialog tokenizado de la lista.
- **MODIFICAR** `apps/web/app/_actions/accounts.ts`: ningún cambio funcional. `archiveAccount`/`deleteAccount`/`reactivateAccount` ya soportan el contrato.
- **AGREGAR** claves i18n en `apps/web/messages/<locale>/accounts.json`:
  - `actions.archive` / `actions.delete` (si no existen ya — verificar)
  - `menu.aria_label` ("Acciones de la cuenta")
  - `confirmations.archive_cta` / `confirmations.delete_cta` / `confirmations.cancel`
  - Las copy bodies (`confirmations.archive_body`, `confirmations.delete_body_no_transactions`) ya existen del detail page; se reusan.
- **OUT OF SCOPE** (explícito):
  - **Tarjetas (`/cards`)**: el patrón análogo es candidato para un change siguiente; este se queda en `/accounts` para no expandir el blast radius.
  - **Mobile nativo (`apps/mobile`)**: no aplica todavía (la pantalla de cuentas mobile usa un patrón distinto y aún no tiene mutations completas).
  - **El detail page como surface de mutación**: queda solo Editar; archive/delete se borran del header del detalle (no se mueven a un kebab del detalle).
  - **`/accounts/[id]/edit` page**: sigue como fallback no-JS (no se borra).

## Capabilities

### New Capabilities

<!-- Ninguna capability nueva. -->

### Modified Capabilities

- `accounts`: se modifica la requirement "El usuario puede ver la lista de sus cuentas agrupadas por tipo" para reemplazar la acción inline (Editar / Reactivar) por un menú kebab por fila que expone el set completo de mutaciones (Editar, Archivar, Eliminar, Reactivar) según el estado. Se modifica la requirement "El usuario puede ver el detalle de una cuenta" para sacar archive/delete del header del detalle (solo queda Editar). Se modifica la requirement "El usuario puede eliminar permanentemente una cuenta sin historial" — en particular el scenario "La UI ofrece eliminar o archivar según el caso" — para fijar que la decisión se ve en el menú del card de la lista, no en la pantalla de detalle.
- `overlay-primitives`: se agrega un requirement para el primitivo `Dialog` (confirm modal tokenizado) y un requirement para el primitivo `DropdownMenu` (sobre `Popover`). Ambos consumibles por otros módulos.

## Impact

- **Código (solo `apps/web`):**
  - **Agrega**: `components/ui/dialog.tsx`, `components/ui/dropdown-menu.tsx`, `app/(app)/accounts/_components/account-row-menu.tsx`, `app/(app)/accounts/_components/account-confirm-dialog.tsx`.
  - **Modifica**: `app/(app)/accounts/_components/account-row.tsx` (menu trigger en vez de pencil/reactivar inline), `app/(app)/accounts/[id]/_components/account-detail-header.tsx` (saca archive/delete), `lib/accounts/queries.ts` (+`has_transactions`), `lib/accounts/types.ts` (tipo enriquecido).
- **Queries / data:** `getCashAndBankAccounts` agrega `has_transactions` por cuenta. Implementación posible: subquery `EXISTS` sobre `transactions` (origen `account_id` o destino `transfer_destination_account_id`), excluyendo `is_parent=true`. Un único round-trip — no por fila. Si el costo de la subquery es alto en cuentas con mucho historial, fallback a un RPC `accounts_with_transaction_flag` (a evaluar en design).
- **Server actions:** sin cambios funcionales. `archiveAccount`/`deleteAccount`/`reactivateAccount` ya devuelven `ActionResult` tipado.
- **i18n:** nuevas claves bajo `accounts.menu.*` y `accounts.confirmations.*_cta` (~5 strings).
- **Tests:** primitivos nuevos (`Dialog`, `DropdownMenu`) con stories en Storybook si el patrón del repo los pide; integration test del menu con los tres flows (archive, delete con/sin tx, reactivate) sobre `AccountRow`.
- **Dependencia bloqueante:** ninguna. El change se monta sobre `main` actual.
- **Diseño:** falta validar en Paper el visual del kebab + dialog en ambos viewports (desktop y web-mobile). Bloqueado por la cuota Paper MCP hasta ~2026-06-07 (ver `project_accounts_paper_state`). Se puede arrancar specs/tasks sin la design-ref final y exportarla al cierre del change.
