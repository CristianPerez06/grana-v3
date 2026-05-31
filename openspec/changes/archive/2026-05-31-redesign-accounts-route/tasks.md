## 1. Page-level: header con `PageHeader`

- [x] 1.1 En `apps/web/app/(app)/accounts/page.tsx`, importar `PageHeader` y reemplazar el `<PageHeader title={...} actions={<Link ...>} />` artesanal por el componente compartido manteniendo el mismo título (`t('title')`) y la misma acción CTA "+ Nueva cuenta" (link a `/accounts/new`). _Ya estaba usando `PageHeader` con la action correcta — no hizo falta cambio._
- [x] 1.2 Confirmar que el contenedor exterior queda `flex flex-col gap-6` (o lo que dicte `PageHeader` ya en uso en otras rutas) y que no hay duplicación de tipografía/spacing. _Ya era `flex flex-col gap-6`._

## 2. `AccountSection` — card blanca + label refinado

- [x] 2.1 En `apps/web/app/(app)/accounts/_components/account-section.tsx`, refactor del label de sección: caps + count en muted (`text-text-soft`), un componente o markup local que renderice "EFECTIVO · 2" con la jerarquía descrita en design §2.
- [x] 2.2 Cambiar el contenedor de filas a `bg-card border border-border-soft rounded-2xl divide-y divide-border-soft`.
- [x] 2.3 Borrar el `opacity-70` que se aplica cuando `archived`. La diferenciación visual se mueve a las filas y al borde del card (siguiente sección).

## 3. `AccountRow` — layout en columnas alineadas

- [x] 3.1 En `apps/web/app/(app)/accounts/_components/account-row.tsx`, reescribir el JSX del row con flex y columnas: slot avatar (`flex-shrink-0`), bloque meta (nombre + institución, `min-w-0` para truncar), slot balances (ancho fijo, columna), slot action (ancho fijo, end-aligned).
- [x] 3.2 Ajustar tipografía: nombre en `text-text` semibold (~`text-[15px] font-semibold`), institución/subtítulo en `text-text-soft text-[13px]`. Balance ARS en `text-text` semibold; balance USD en `text-text-soft text-[13px]`.
- [x] 3.3 Acción inline: para activas, `Editar` como `Link` muted con hover ink. Para archivadas, `Reactivar` como botón `text-positive` con hover semibold (mismo flujo de `reactivateAccount` que el código actual; sin tocar la server action).
- [x] 3.4 Evaluar `size` del `AccountAvatar` (`sm` vs `md`) sobre el render real y dejar el que mejor jerarquía dé. Documentar la elección final en el commit message. _Elegido `md` (44px) para sostener el peso visual del row de 56px+ que pide el nuevo padding; queda para validar contra el render real._

## 4. Sección Archivadas — pill + borde dashed

- [x] 4.1 En `AccountSection`, cuando `archived={true}`, aplicar `border-dashed` al contenedor en lugar de `border` sólido y omitir el `opacity-70` global.
- [x] 4.2 En `AccountRow`, cuando `!account.is_active`, renderizar el pill "Archivada" inline al lado del nombre con `bg-warning-soft text-warning rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide`. Reusar la clave i18n `accounts.badges.archived` (ya existe en el código actual).

## 5. Empty / hint — tokens unificados

- [x] 5.1 En `apps/web/app/(app)/accounts/_components/empty-accounts-state.tsx`, cambiar el CTA a `bg-positive text-positive-foreground` (o el equivalente al primary actual del repo, ver dashboard) para que no diverja del CTA del header. Mantener copy y action. _El CTA ya usaba `bg-primary text-primary-foreground` (la convención unificada del repo); se mantuvo. Además se le envolvió en card `bg-card border-border-soft rounded-2xl` para que el empty state se lea como sección._
- [x] 5.2 En `apps/web/app/(app)/accounts/_components/accounts-hint.tsx`, cambiar `bg-muted/40` por `bg-card border-border-soft` y unificar el botón de dismiss a `text-positive` (mantiene la mecánica de `localStorage` intacta).

## 6. i18n

- [x] 6.1 Verificar `apps/web/messages/<locale>/accounts.json`: que existan `title`, `actions.create`, `actions.edit`, `actions.reactivate`, `sections.cash`, `sections.bank`, `sections.archived`, `badges.archived`, `empty.title`, `empty.description`, `hint.title`, `hint.description`, `hint.dismiss`. Si falta alguna, agregarla en `es` y dejar el TODO de `en` siguiendo la convención del repo. _Todas presentes en `packages/i18n-messages/src/{es,en}.json`. Sin cambios necesarios._
- [x] 6.2 Si el design pide copy nuevo (por ejemplo `sections.bank` cambia de "Bancarias" a "Bancos" para alinear con el mock), actualizar la clave en ambos locales. _Se mantiene el copy real del repo (`sections.bank = "Cuentas bancarias"` en es). El mock de Paper queda como referencia visual; el copy es autoridad del repo._

## 7. Verificación local

- [x] 7.1 `pnpm --filter @grana/web typecheck` pasa. _Corrido vía `pnpm typecheck` — clean._
- [x] 7.2 `pnpm --filter @grana/web lint` pasa sobre los archivos tocados. _Corrido vía `pnpm lint` — sólo 1 warning preexistente en `credit-cards.ts` ajeno al change._
- [ ] 7.3 Levantar `apps/web` en dev, navegar a `/accounts` con (a) 0 cuentas (empty state), (b) 1 cuenta activa (hint visible), (c) 2+ activas + 1 archivada (caso rico). Sanity check visual contra los artboards `MM-0` (desktop) y `R5-0` (web-mobile). _Pendiente del usuario — requiere auth + dev DB._
- [ ] 7.4 Sanity check responsive: el card y las columnas no se rompen en viewport mobile (`<md`); las balances mantienen alineación a la derecha sin desbordar. _Pendiente del usuario._

## 8. Cierre del change

- [x] 8.1 `openspec validate redesign-accounts-route --strict` pasa.
- [ ] 8.2 Squash + branch ready para PR (no merge a main — eso lo hace el usuario).
- [ ] 8.3 Cuando vuelva la cuota de Paper: exportar `MM-0` y `R5-0` (PNG + SVG + JSX representativo) a `openspec/changes/redesign-accounts-route/design-refs/` con README no-autoritativo, siguiendo el patrón de `auth-minimal-redesign`.
