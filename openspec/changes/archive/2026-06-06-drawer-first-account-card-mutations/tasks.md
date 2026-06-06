## 1. Primitivo Dialog (`overlay-primitives`)

- [x] 1.1 Crear `apps/web/components/ui/dialog.tsx` con `Dialog`, `DialogHeader`, `DialogBody`, `DialogFooter`. Controlado (`open` + `onClose`). Centrado en `≥ sm`, sheet inferior en `< sm`. Scrim semitransparente con tokens del DS.
- [x] 1.2 Implementar focus trap dentro del panel + restauración del foco al trigger al cerrar. (Provisto por Radix Dialog.)
- [x] 1.3 Cerrar con click en scrim y con `Esc` (no cerrar al click dentro del panel). (Provisto por Radix Dialog.)
- [x] 1.4 Soportar estado `loading` del CTA primario sin cerrar el panel (el caller controla el cierre). El Dialog no auto-cierra al click del CTA; el caller pasa `loading` al `<Button>` y flipea `open=false` solo en success.
- [x] 1.5 Slot para errores tipados dentro de `DialogBody` que el caller renderiza inline cuando una action devuelve `!ok`. `DialogBody` acepta children libres, así que el caller puede meter su `formError` ahí mismo.
- [x] 1.6 Storybook story `dialog.stories.tsx` con tres estados: idle, loading, error. Incluye una con CTA `variant="destructive"` y otra con CTA default.

## 2. Primitivo DropdownMenu (`overlay-primitives`)

- [x] 2.1 Crear `apps/web/components/ui/dropdown-menu.tsx`. Pivot durante implementación: el wrapper envuelve `@radix-ui/react-dropdown-menu` (dep ya en `package.json`) en vez de montarse sobre `Popover`. Radix dedicated dropdown da semántica `role="menu"`, roving tabindex y disabled skip gratis — más correcto que adaptar Popover. Sub-componentes: `DropdownMenu`, `DropdownMenuTrigger` (acepta `asChild`), `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuItemDestructive`, `DropdownMenuSeparator`. Design.md y spec actualizados.
- [x] 2.2 Items renderizados con `role="menuitem"` (provisto por Radix); `onSelect` invoca el handler y Radix cierra el menu por default.
- [x] 2.3 Keyboard nav: `↑`/`↓` mueven foco roving, `Enter`/`Space` invocan item, `Esc` cierra. Items `disabled` se skippean. (Todo provisto por Radix DropdownMenu.)
- [x] 2.4 Cierre por click-afuera y reposicionamiento con flip provistos por Radix.
- [x] 2.5 Storybook story `dropdown-menu.stories.tsx` con un menu mostrando items default + destructive + separator.

## 3. Enriquecer query con `has_transactions`

- [x] 3.1 Modificar `apps/web/lib/accounts/types.ts`: `AccountWithBalances` agrega `has_transactions: boolean`.
- [x] 3.2 Modificar `apps/web/lib/accounts/queries.ts`: agregar `getAccountIdsWithTransactions(ids)` (single round-trip, filtra `account_id` u `transfer_destination_account_id` IN ids, excluye `is_parent = true`). Lo consumen `getAccounts`, `getCashAndBankAccounts` y `getAccountDetail` en paralelo con `getTransactionSums`.
- [ ] 3.3 PENDIENTE (manual ops): correr explain analyze sobre un user con > 20 cuentas y > 5k transactions cuando haya entorno con data real. Si supera 200ms p95, evaluar RPC dedicado. Bloqueado por acceso al entorno con data.
- [x] 3.4 N/A: no había `queries.test.ts` previo en `apps/web/lib/accounts/__tests__/`. Las queries se cubren via integration tests del module-row (ver tasks 7.x) y end-to-end. Si emerge necesidad de unit test puro de la nueva helper, lo abrimos en un follow-up.

## 4. Menu del card en `/accounts`

- [x] 4.1 Crear `apps/web/app/(app)/accounts/_components/account-row-menu.tsx`: componente client que recibe `account: AccountWithBalances`. Renderiza el trigger kebab (`MoreVertical`) con `aria-label` localizado, y el `DropdownMenu` con el set de items derivado de `(is_active, has_transactions)`.
- [x] 4.2 Implementar el handler de `Editar`: invoca `useAccountsEditDrawer().openEdit(account)` (cuando el provider está montado) o cae al link `/accounts/[id]/edit` (fallback).
- [x] 4.3 Implementar el handler de `Reactivar`: invoca `reactivateAccount(account.id)` directo, sin abrir dialog. `useTransition` + `invalidateAfterAccountMutation(qc)` al resolver `ok=true`. Mostrar error si `!ok` (por ahora vía `setError` local, mismo patrón que el row actual).
- [x] 4.4 Implementar los handlers de `Archivar` y `Eliminar`: abren `AccountConfirmDialog` (creado en 4.6) con `action: 'archive' | 'delete'`. El menu se cierra al abrir el dialog (Radix DropdownMenu cierra automáticamente al `onSelect`).
- [x] 4.5 RESUELTO durante exploración: `AccountWithBalances extends AccountWithDetails`, así que el row ya tiene el shape requerido por el edit drawer. El menu recibe `account: AccountWithBalances` y se lo pasa directo a `openEdit(account)` (que acepta `AccountWithDetails`). No hace falta fetch extra.
- [x] 4.6 Crear `apps/web/app/(app)/accounts/_components/account-confirm-dialog.tsx`: dialog reusable que recibe `action: 'archive' | 'delete'`, `account`, `open`, `onClose`. Renderiza header con el nombre de la cuenta, body con copy localizado, footer con `Cancelar` + CTA `variant="destructive"`. Maneja `loading`, `formError` inline, e invocación del action.
- [x] 4.7 Modificar `apps/web/app/(app)/accounts/_components/account-row.tsx`: reemplazar el slot derecho (Pencil / Reactivar) por `<AccountRowMenu account={account} />`. Borrar el state local `error` / `isPending` / `handleReactivate` del row (migrados al menu).

## 5. Limpiar el detail page

- [x] 5.1 Modificar `apps/web/app/(app)/accounts/[id]/_components/account-detail-header.tsx`: eliminar `handleArchive`, `handleDelete`, `handleReactivate`, los imports de `archiveAccount`/`reactivateAccount`/`deleteAccount`, y los botones asociados. El slot derecho del header queda solo con el botón `Editar`.
- [x] 5.2 Eliminado el `movementsQ` (solo servía para decidir archive-vs-delete); no era usado en otro lugar del header.
- [x] 5.3 `Editar` sigue gateado por `useEditAccountDrawer()` con fallback al `<a href="/accounts/[id]/edit">` (igual que hoy).
- [x] 5.4 Skeleton del header preserva el slot derecho desde first paint (size-9 placeholder); el botón Editar aparece en el slot apenas account resuelve. Cumple `feedback_header_chrome_always_visible`.

## 6. i18n

- [x] 6.1 Las claves i18n viven en `packages/i18n-messages/src/{es,en}.json` (no en `apps/web/messages/`). Reusamos `actions.{edit,archive,reactivate,delete}`, `confirmations.{archive_title,archive_body,delete_title,delete_body_no_transactions}` y `errors.{archive_failed,reactivate_failed,delete_failed}` ya existentes. El nombre de la cuenta se muestra como `<p className="font-medium">` en el dialog body (no en el title). Único key nuevo: `accounts.menu.label` (es: "Acciones de la cuenta", en: "Account actions"). Cancel reusa `common.cancel`.
- [x] 6.2 Copy bodies `confirmations.archive_body` y `confirmations.delete_body_no_transactions` se reutilizan intactos desde el `AccountConfirmDialog`. El nombre de la cuenta aparece como línea adicional en el body, no anidado en el title.

## 7. Tests

- [ ] 7.1-7.7 BLOQUEADO POR INFRAESTRUCTURA. El setup de vitest en `apps/web` es `environment: 'node'` con `include: ['lib/**/__tests__/**/*.test.ts']` — no soporta tests de componentes React (no hay jsdom ni RTL, y `.tsx` no entra al matcher). Agregar tests RTL para los flows del menú/dialog requiere instalar `jsdom` + `@testing-library/react` + `@testing-library/user-event`, ajustar `vitest.config.ts`, y crear convención para `*.test.tsx` en `app/**`. Es una expansión de scope significativa y merece su propio change. Mientras tanto: cobertura via Storybook stories (Dialog y DropdownMenu) + smoke manual (tasks 8.3-8.5) + spec scenarios como source-of-truth ejecutable cuando RTL aterrice. Follow-up: openspec change `add-rtl-test-infra-web`.

## 8. Cierre

- [x] 8.1 `pnpm --filter web typecheck` y `pnpm --filter web lint` corren limpios. Cero warnings nuevos.
- [x] 8.2 `pnpm --filter web test`: 33 test files, 345 tests passing. Sin regresiones.
- [x] 8.3 Smoke manual confirmado por el usuario: 4 sets de menú correctos, Archivar/Eliminar/Reactivar/Editar funcionando.
- [x] 8.4 Accesibilidad mínima validada en browser: kebab navegable por teclado, focus trap en el dialog, Esc cierra y retorna foco.
- [x] 8.5 Mobile-web validado: dialog como sheet inferior, tap target ≥ 44×44.
- [ ] 8.6 BLOQUEADO (quota Paper MCP, reset ~2026-06-07): exportar design-refs a `openspec/changes/drawer-first-account-card-mutations/design-refs/`.
- [ ] 8.7 PR ready para review en branch `feature/drawer-first-account-card-mutations`. NO mergear a main — esperar al usuario.
