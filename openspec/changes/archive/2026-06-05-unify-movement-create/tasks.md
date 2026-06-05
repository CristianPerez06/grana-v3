## 1. Reubicar `MovementForm` y dejar el call-site del drawer apuntando al nuevo path

- [x] 1.1 Crear `apps/web/lib/transactions/components/movement-form.tsx` con el contenido actual de `apps/web/app/(app)/transactions/new/_components/movement-form.tsx`, removiendo la prop `createReturnHref` y simplificando el cálculo de `returnHref` (solo lee de `edit.returnHref`). **La branch `variant="page"` se conserva** — la usa `apps/web/app/(app)/transactions/[txId]/edit/page.tsx` (descubrimiento durante la implementación; la edición sigue siendo out-of-scope y necesita la branch). Resto de la API sin cambios.
- [x] 1.2 Actualizar la importación de `MovementForm` dentro de `apps/web/app/(app)/transactions/_components/movement-drawer.tsx` al nuevo path.
- [x] 1.3 Actualizar la importación de `MovementFormAccount` dentro de `apps/web/app/(app)/transactions/_components/movement-drawer-loader.tsx` al nuevo path.
- [x] 1.4 Actualizar las importaciones en `apps/web/app/(app)/transactions/[txId]/edit/page.tsx`, `apps/web/app/(app)/transactions/[txId]/_components/global-transaction-detail.tsx` y `apps/web/lib/transactions/edit-context.ts` al nuevo path.
- [x] 1.5 `pnpm --filter web typecheck` clean (sin errores referentes al path viejo del form).

## 2. Mover `<MovementDrawerLoader>` adentro de `AppShell`

- [x] 2.1 Importar `MovementDrawerLoader` dentro de `apps/web/app/(app)/_components/app-shell.tsx`.
- [x] 2.2 Envolver el contenido del slot `{children}` con `<MovementDrawerLoader>` dentro de `<main>` en `AppShell`.
- [x] 2.3 `AppShell` ya recibe `children` y tiene `'use client'`; no requiere props adicionales.
- [x] 2.4 Eliminar el wrap `<MovementDrawerLoader>` de `apps/web/app/(app)/transactions/layout.tsx`. El layout queda con solo `TransactionsHeader` + slot.
- [x] 2.5 `MovementDrawerLoader` no requirió cambios de contrato — solo se movió su mount point.

## 3. Convertir los entry-points externos a `useMovementDrawer().openCreate(...)`

- [x] 3.1 `apps/web/app/(app)/dashboard/_components/dashboard-header.tsx`: el botón "Nuevo movimiento" pasa a `onClick={() => drawer.openCreate()}` con `disabled = isLoading || !drawer`. Sin `<Link>`.
- [x] 3.2 `apps/web/app/(app)/accounts/[id]/_components/account-detail-content.tsx`: CTA "+ Agregar transacción" llama `drawer?.openCreate(accountId)` y queda disabled cuando `drawer === null`.
- [x] 3.3 `apps/web/app/(app)/cards/[id]/_components/card-header-actions.tsx`: CTA "Registrar consumo" llama `movementDrawer?.openCreate(cardId)`. Renombrado el `drawer` local del editor a `editDrawer` para evitar shadowing con el opener de movimientos.
- [x] 3.4 `apps/web/app/(app)/cards/[id]/page.tsx`: el CTA "Registrar primer consumo" del empty state se extrajo a un nuevo client component `apps/web/app/(app)/cards/[id]/_components/register-first-purchase-button.tsx` (la page es server-side y no puede leer el hook directamente).
- [x] 3.5 `apps/web/app/(app)/transactions/_components/movement-list-container.tsx`: removida la branch `addHref` del empty state; queda solo el handler `onAdd` que abre el drawer.
- [x] 3.6 `apps/web/lib/transactions/components/register-movement-button.tsx`: removida la branch de fallback con `<Link>`; ahora solo dos estados (disabled o `onClick`). Removida importación de `next/link`.
- [x] 3.7 `apps/web/lib/transactions/components/quick-add-fab.tsx`: removida la branch de fallback con `<Link>`; ahora solo dos estados (disabled o `onClick`). Removida importación de `next/link`.
- [x] 3.8 Confirmado con `grep -r "transactions/new" apps/web --include "*.ts" --include "*.tsx"` que no quedó ninguna referencia (los comentarios JSDoc que mencionaban la ruta también fueron actualizados).

### 3.9 (nuevo) Entry point descubierto durante implementación

- [x] 3.9 `apps/web/app/(app)/accounts/[id]/_components/movement-list-account-container.tsx`: el empty state del listado embedded de account detail también generaba un `addHref` a `/transactions/new`. Convertido a `onAdd: drawer ? () => drawer.openCreate(accountId) : undefined`.
- [x] 3.10 (nuevo) `apps/web/lib/transactions/components/movement-list.tsx`: removida la prop `addHref` del tipo `MovementEmptyState` y la branch que renderizaba `<Link href={addHref}>`. Removida importación de `next/link`.

## 4. Eliminar la ruta `/transactions/new` y el plumbing exclusivo de creación

- [x] 4.1 Eliminado el folder `apps/web/app/(app)/transactions/new/` completo (page, loading, _components).
- [x] 4.2 `resolveReturnHref` se eliminó automáticamente con el borrado del folder (era local a `new/page.tsx`).
- [x] 4.3 Prop `createReturnHref` eliminada del tipo `Props` y del destructuring de `MovementForm` en el archivo nuevo; confirmado por typecheck.
- [x] 4.4 La branch `variant="page"` del `MovementForm` se conserva por la dependencia de `/transactions/[txId]/edit/page.tsx` (ver Task 1.1).
- [x] 4.5 El path de creación ya no consume `from` ni `returnHref` en su success path: el form solo lee `edit?.returnHref` (edit-page únicamente). El path de creación entra siempre por `onSuccess()` del drawer.
- [x] 4.6 Confirmado con grep que no quedan referencias a `createReturnHref` ni `resolveReturnHref` en el código (la `variant="page"` se mantiene; otras superficies como CardForm no tocadas).

## 5. Success path del form

- [x] 5.1 El form ya invocaba `router.refresh()` en `onMutationSuccess` y `onSuccess?.()` (el drawer lo provee). El fallback `router.push(returnHref)` solo se ejecuta cuando `onSuccess` es undefined — la única ruta que cae ahí ahora es `/transactions/[txId]/edit`, que es el comportamiento deseado.
- [x] 5.2 `MovementDrawerProvider` (`apps/web/app/(app)/transactions/_components/movement-drawer.tsx`) ya pasa `onSuccess={() => setOpen(false)}` y `onClose={() => setOpen(false)}` al form. Sin cambios.
- [x] 5.3 El provider no consume `createReturnHref` (la prop nunca existió en el provider). Sin cambios.

## 6. Verificación

- [x] 6.1 `pnpm --filter web typecheck && pnpm --filter web lint` clean.
- [x] 6.2 Manual con `/run`: abrir `/dashboard`, click "Nuevo movimiento" — el drawer se abre sobre el dashboard, sin navegación.
- [x] 6.3 Manual con `/run`: abrir `/accounts/<id>`, click "+ Agregar transacción" — drawer abre con cuenta pre-seleccionada; guardar — cierra y la lista refleja el nuevo movimiento.
- [x] 6.4 Manual con `/run`: abrir `/cards/<id>`, activar CTA de alta del header — drawer abre con tarjeta pre-seleccionada y tipo Gasto.
- [x] 6.5 Manual con `/run`: en `/transactions` mobile-web (viewport `<sm`), tocar el FAB — drawer abre.
- [x] 6.6 `/transactions/new` 404 — verificado vía route table del build de producción (la ruta no aparece) + manifest del dev server.
- [x] 6.7 Back-nav del detalle intocado — verificado por diff (cero cambios en `apps/web/app/(app)/transactions/[txId]/page.tsx`).
- [x] 6.8 Cold-load `/settings` compila dentro del nuevo AppShell + loader chain — verificado por `pnpm build` clean.
- [x] 6.9 Manual con `/run`: cold-load lento sobre `/dashboard` — durante la ventana drawer-null, el botón "Nuevo movimiento" se ve disabled (estado disabled estándar del componente `Button`, sin `cursor: pointer`); al resolver, pasa a habilitado con `cursor: pointer`.

## 7. Cleanup de specs y archivo

- [x] 7.1 `openspec validate unify-movement-create --strict` clean.
- [x] 7.2 `openspec archive unify-movement-create` aplica los deltas a las specs y mueve el change folder a `openspec/changes/archive/<date>-unify-movement-create/`.

## 8. Design-system cleanup (discovered during verification)

Usuario reportó que el CTA "Registrar movimiento" del header de `/transactions` no mostraba `cursor: pointer`. La causa: `RegisterMovementButton` era un `<button>` crudo, no componía sobre el `Button` compartido. Convención de la app: todos los CTAs (especialmente de header) usan `@/components/ui/button`.

- [x] 8.1 Refactorizar `apps/web/lib/transactions/components/register-movement-button.tsx` para componer sobre `<Button variant="primary" size="md">`. Hereda `cursor-pointer`, `disabled:pointer-events-none disabled:opacity-50`, focus ring y hover/active states del design system.
- [x] 8.2 Agregar size `fab` al `@/components/ui/button` (`h-16 w-16 p-0 rounded-2xl shadow-lg`) y al contrato `ButtonSize` en `@grana/ui-contracts` para que mobile pueda implementarla cuando aterrice.
- [x] 8.3 Refactorizar `apps/web/lib/transactions/components/quick-add-fab.tsx` para usar `<Button variant="primary" size="fab">` con `className="fixed bottom-10 right-10 z-40 sm:hidden"` para la posición y la visibilidad responsive.
- [x] 8.4 Actualizar las menciones de `opacity-60` en `proposal.md`, `design.md`, `specs/transactions/spec.md`, `specs/dashboard/spec.md` y `tasks.md` por la convención "estado disabled estándar del componente `Button`" (el design system gobierna el visual, no la spec).
- [x] 8.5 `pnpm --filter web typecheck` clean.
