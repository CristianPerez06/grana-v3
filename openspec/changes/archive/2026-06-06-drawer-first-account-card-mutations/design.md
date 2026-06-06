## Context

Estado de `/accounts` después del rediseño visual de 2026-05-31:

- `AccountRow` muestra avatar + nombre/institución + balances + **una sola acción inline** (lápiz `Editar` para activas, link `Reactivar` para archivadas).
- `Editar` ya abre un drawer compartido (`AccountsEditDrawerProvider`), no navega a `/edit`.
- `Reactivar` ejecuta directo desde la fila.
- `Archivar` y `Eliminar` **solo existen en `/accounts/[id]`** (`account-detail-header.tsx`), y ahí siguen usando `window.confirm()` browser-nativo.

Constraints relevantes:

- **Radix bajo el capó.** El repo SÍ usa Radix internamente: `Drawer` envuelve `@radix-ui/react-dialog`, `Popover` envuelve `@radix-ui/react-popover`. El monorepo ya tiene como deps `@radix-ui/react-dialog`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-popover`, `@radix-ui/react-dropdown-menu`. La convención es: primitivo del repo (slim wrapper) sobre Radix, tokens y className via `cn()`.
- **Auto-derivar `has_transactions` por cuenta** es la única forma honesta de mostrar el set de acciones correcto en la lista sin un round-trip por fila. Hoy ese dato lo derivamos en el detail page leyendo `getAccountMovementsAscendingAction` desde el cache de TanStack — barato cuando el usuario ya entró al detalle, pero la lista no tiene ese cache.
- **`has_transactions` debe excluir `is_parent=true`** para mantenerse coherente con el cálculo de balance (ver spec `accounts` requirement "El sistema computa el saldo…").
- **Mobile-web (< sm) importa:** la lista de cuentas es de las primeras superficies a las que el usuario llega en mobile-web. El kebab tiene que ser tappable (44×44 mínimo) y el dialog tiene que comportarse como sheet de pantalla completa, no como modal centrado chiquito.
- **Feedback canónico:** `feedback_header_chrome_always_visible` (el header del detalle no puede quedar parpadeando — al sacar archive/delete, el slot derecho del header sigue presente desde first paint con solo `Editar`).

Lo que ya tenemos sin reescribir:

- `archiveAccount`, `deleteAccount`, `reactivateAccount` server actions con `ActionResult` tipado y `formError`.
- `invalidateAfterAccountMutation(qc)` que ya cubre el fan-out de invalidations post-mutation.
- `AccountsEditDrawerProvider` + `useAccountsEditDrawer()` que el row consume.
- Tokens `bg-card`, `border-border-soft`, `text-destructive`, `text-positive`, `bg-warning-soft` ya definidos.

## Goals / Non-Goals

**Goals:**

1. Las cuatro mutaciones del card (Editar, Archivar, Eliminar, Reactivar) se disparan desde el propio card, sin navegar al detalle.
2. Reemplazar `window.confirm()` por un dialog tokenizado que muestra contexto (nombre de la cuenta), copy localizado y errores tipados del action.
3. La regla "Eliminar si no hay transacciones, Archivar si hay" se vuelve **discoverable en la lista** — no hay que entrar al detalle para descubrirla.
4. El detalle queda con una sola acción de mutación visible (Editar) — superficie consolidada.
5. Los primitivos `Dialog` y `DropdownMenu` agregados son reusables por otros módulos (cards, transactions detail, settings) sin que este change especule sobre cómo.

**Non-Goals:**

- Reemplazar el drawer de edit por un dialog — el drawer ya funciona y es la convención del repo para forms.
- Tocar tarjetas (`/cards`) en este change.
- Tocar mobile nativo (`apps/mobile`).
- Tocar `/accounts/[id]/edit` page (sigue como fallback no-JS).
- Mover Reactivar dentro de un confirm — Reactivar no necesita confirmación (es trivialmente reversible).
- Cambiar el comportamiento de `archiveAccount`/`deleteAccount`/`reactivateAccount` server actions.

## Decisions

### 1. `has_transactions` se calcula en `getCashAndBankAccounts`, no en runtime por fila

**Decisión:** Enriquecer el SELECT de `getCashAndBankAccounts` con una subquery `EXISTS` que devuelve `has_transactions` por cuenta. El resultado se agrega a `AccountWithBalances` y consume directamente el row.

**Alternativas consideradas:**

- (a) Una query por fila (`useQuery` por `accountId`): suma N round-trips para una lista que casi siempre tiene < 10 cuentas. Descartado.
- (b) Server-side render decide el menu set y el row recibe ya el set de items: acopla el server con la presentación del menu. Descartado.
- (c) Lazy: el menu hace la query al abrirse: el primer click siente lag y el ícono del item correcto (Archivar vs Eliminar) aparece a destiempo. Descartado.

**Por qué (enriquecer la query) gana:** un single round-trip incremental. La subquery `EXISTS` con `LIMIT 1` sobre `transactions` filtrado por `(account_id = X OR transfer_destination_account_id = X) AND is_parent = false` es barata aún sin índice dedicado (los índices existentes sobre `account_id` ya cubren el OR vía dos index scans). El usuario más cargado del modelo de uso esperado (≈ docena de cuentas) lo mantiene < 50ms p95 según el costo estimado por el equivalente del detail page.

### 2. Nuevo primitivo `Dialog` separado de `Drawer`

**Decisión:** Agregar `apps/web/components/ui/dialog.tsx` como primitivo nuevo, envuelviendo `@radix-ui/react-dialog` (igual que `Drawer` ya lo hace) pero con posicionamiento **centrado en desktop / full-screen sheet en mobile-web**, no como panel lateral. Sub-componentes: `Dialog`, `DialogHeader`, `DialogBody`, `DialogFooter`. Sin variantes "alert-dialog" separadas — el caller pone `<Button variant="destructive">` cuando quiere la acción destructive. Radix Dialog cubre focus trap, focus restoration y Esc gratis — no es necesario reimplementarlo.

**Alternativas:**

- Reusar `Drawer` con `widthPx={420}` y `side="bottom"` (sheet en mobile, centered en desktop): forzaría a Drawer a aceptar `side="center"` y "bottom-sheet", lo cual lo vuelve un component-of-everything. Descartado.
- Browser `confirm()` con copy mejorada: imposible mostrar errores tipados del server action en línea y no respeta tokens. Descartado (es lo que tenemos hoy).

**Por qué (Dialog dedicado) gana:** mantiene `Drawer` enfocado en "panel lateral" (su contract actual), y le da al patrón de confirmación su propia identidad — lo cual habilita reuso desde otros módulos (settings, transactions detail) sin contorsionar Drawer.

### 3. `DropdownMenu` envuelve `@radix-ui/react-dropdown-menu`

**Decisión:** Agregar `apps/web/components/ui/dropdown-menu.tsx` como slim wrapper sobre `@radix-ui/react-dropdown-menu` (dep ya en `apps/web/package.json`). Expone `<DropdownMenu>`, `<DropdownMenuTrigger>`, `<DropdownMenuContent>`, `<DropdownMenuItem>`, `<DropdownMenuItemDestructive>`, `<DropdownMenuSeparator>`. Radix da `role="menuitem"`, foco roving con `↑`/`↓`, `Enter`/`Space`/`Esc`, click-outside y reposicionamiento con flip — todo built-in.

**Por qué Radix Dropdown Menu en vez de Popover:** Radix tiene un primitivo dedicado para menus que es semánticamente más correcto (`role="menu"`, roving tabindex, `disabled` skip) que cualquier composición sobre Popover. Como ya está en deps, el costo es cero.

**Trade-off:** Diverge del approach inicial de "montar sobre Popover existente". El spec en `overlay-primitives` se queda agnóstico al engine (describe el contract, no Radix). En el código, igual queda como un slim wrapper de Radix con tokens propios — mismo patrón que `Drawer` y `Popover` ya existentes.

### 4. Slot único de acción en el row → `MoreVertical` kebab

**Decisión:** El slot derecho de `AccountRow` (hoy "Pencil o Reactivar") pasa a un único `<button>` con ícono `MoreVertical` (lucide). Click abre el menu. El set de items se decide por `(account.is_active, account.has_transactions)`:

| Estado | Items en el menú |
|---|---|
| Activa, con tx | Editar · Archivar (destructive) |
| Activa, sin tx | Editar · Archivar · Eliminar (destructive) |
| Archivada, con tx | Reactivar |
| Archivada, sin tx | Reactivar · Eliminar (destructive) |

**Alternativa considerada:** mantener Editar/Reactivar como botón inline visible + kebab solo para destructive. Descartado: dos triggers por fila satura el ancho en mobile-web y diluye el patrón. Mejor un único punto de entrada.

**Trade-off:** Reactivar pierde su descubrimiento inmediato (era un link visible). Mitigación: el copy del menu-item dice "Reactivar" en `text-positive`, y la sección archivada sigue siendo visualmente distinta (border dashed + pill).

### 5. El detail page mantiene solo `Editar` en el header

**Decisión:** `account-detail-header.tsx` deja de renderizar los botones de Archivar y Eliminar. El slot derecho del header queda con solo `Editar` (drawer-first, ya implementado). El `EditAccountDrawerProvider` del detail-page se mantiene tal como está.

**Alternativa considerada:** poner también el kebab en el detail header. Descartado por ahora — duplica el patrón en dos superficies, y mantener una sola surface de mutación reduce la matriz de tests y la chance de divergencia.

**Riesgo:** un usuario que está acostumbrado a archivar desde el detalle no encuentra la acción. Mitigación: la acción está disponible un click antes (en la lista), no más profundo. Si emerge feedback contrario, mover el kebab también al detail page es una extensión barata.

### 6. Reactivar sigue ejecutándose sin confirm

**Decisión:** click en "Reactivar" del menu ejecuta directo (no abre dialog). Esto preserva el comportamiento actual y honra que Reactivar es trivialmente reversible.

### 7. Estado de carga durante una mutación

**Decisión:** mientras el server action está en flight, el `DropdownMenuItem` que se clickeó queda en estado `loading` (spinner inline + disabled). El menú **no se cierra** automáticamente al click — se cierra cuando la action devuelve `ok: true` (success path) o cuando el dialog se cierra por error. Para los flows con dialog, el menu cierra al abrir el dialog; el loading vive en el dialog footer.

**Alternativa:** cerrar el menu al click y mostrar un toast con el resultado. Descartado porque no tenemos toast primitivo y el dialog ya cubre los errores de archive/delete.

### 8. Test surface

`AccountRow` con menú es testable con React Testing Library:
- Render row activo con/sin tx → assert items del menu.
- Click "Archivar" → assert dialog abierto, click "Confirmar" → assert action invocada con `accountId`.
- Mock action devuelve `!ok` → assert error renderizado en dialog footer.
- Render row archivada con tx → assert "Eliminar" no aparece.

## Risks / Trade-offs

- **[Riesgo] Costo de query enriquecida:** `EXISTS` subquery por cuenta agrega ~N comparaciones al SELECT principal. → Mitigación: medirlo con explain analyze sobre un user con ~30 cuentas y >5k transactions; si supera 200ms p95, fallback a un RPC dedicado `accounts_with_balance_and_tx_flag` que junta en una sola query con join lateral. Spec deja la implementación abierta — el contract es el flag, no el SQL exacto.
- **[Riesgo] Pérdida de descubrimiento de "Reactivar":** ya no es un link visible — se esconde detrás del kebab. → Mitigación: la sección archivada sigue siendo visualmente distinta y el menu se abre con un único click. Si métricas (cuando existan) muestran caída en reactivaciones, exponerlo de nuevo es trivial.
- **[Riesgo] Dialog primitivo es nuevo — fácil hacer una versión inconsistente:** otros módulos podrían reimplementar su propio confirm. → Mitigación: spec en `overlay-primitives` deja el contract explícito, y este change es el first consumer. Storybook story con los 3 estados (idle, loading, error) sirve de referencia.
- **[Trade-off] El menu desaparece al scrollear (limitación del Popover):** documentado en el spec como comportamiento esperado, no bug.
- **[Trade-off] Aumento de bundle:** `Dialog` + `DropdownMenu` agregan ~3-4 KB minified gzipped al chunk del shell. Aceptable — son primitivos generalmente útiles, no específicos de accounts.
- **[Trade-off] El detail page pierde su affordance de "delete account":** si el usuario está mirando el detalle y decide eliminarla, tiene que volver a la lista. → Aceptable para reducir matriz de surfaces; reversible cuando emerja necesidad real.

## Open Questions

1. **¿El dialog cubre toda la pantalla en mobile-web (`< sm`) o sigue siendo modal centrado pequeño?** Sketch: sheet desde abajo en mobile-web. A confirmar visualmente cuando Paper quote se libere (post 2026-06-07).
2. **¿`has_transactions` se computa en SQL puro (subquery) o vale la pena un RPC?** A medir antes de implementar.
3. **¿El kebab se renderiza también en el row del detail-page (no, según decisión 5) o se evalúa con dogfood?** Quedó cerrado pero abierto a revisión post-merge.
