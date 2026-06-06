## 1. `/transactions/recurring/` — chrome textual con CTA gateado

- [x] 1.1 Crear `apps/web/app/(app)/transactions/recurring/layout.tsx` (server sync) que renderice `<PageHeader title={t('title')} description={t('description')} backLink={{ href: '/transactions', label: t('back_label') }} actions={<CreateRecurrenceButton />} />`. Importar tRec server-side via `getTranslations('recurrences')` o pasar via I18nProvider del root. Wrapper: `<div className="flex max-w-3xl flex-col gap-6">{children}</div>` para que `loading.tsx` y `page.tsx` ya hereden el container.
- [x] 1.2 Refactor `CreateRecurrenceButton` (`apps/web/app/(app)/transactions/recurring/_components/create-recurrence-button.tsx`) para fetchear sus catálogos (accounts + categories) con `useQueries` propios usando las mismas queryKeys que el resto del app (replica del patrón en `TransactionsHeader`); arrancar `disabled={!ready}` hasta que ambas resuelvan. Quitar las props `accounts` y `categories` del contract.
- [x] 1.3 Reescribir `apps/web/app/(app)/transactions/recurring/loading.tsx`: quitar `PageHeaderSkeleton`, dejar solo los skeletons del cuerpo (tabs + filas). Wrapper debe ser un `<div>` ligero, NO redeclarar el `max-w-3xl flex flex-col gap-6` (lo hereda del layout).
- [x] 1.4 Reescribir `apps/web/app/(app)/transactions/recurring/page.tsx`: quitar el `<PageHeader />` y el `<CreateRecurrenceButton />` propios (ahora viven en el layout). Page renderiza solo `<PendingRecurrencesBlock />`, `<UpcomingRecurrences />`, `<RecurringTabs />`. Quitar el wrapper `<div className="flex max-w-3xl flex-col gap-6">` (lo hereda del layout).

## 2. `/transactions/recurring/[id]/` — chrome con back-link estático

- [x] 2.1 Crear `apps/web/app/(app)/transactions/recurring/[id]/layout.tsx` (server sync). **Desviación**: en lugar de PageHeader con placeholder, se eligió opción B del design.md (Decision 1 + Open Question): layout monta solo back-link `← Recurrencias`; el título dinámico vive en el page como `PageHeader` sin backLink. Razón: una page cuyo valor central es el título dinámico no gana nada con un placeholder.
- [x] 2.2 Reescribir `[id]/page.tsx`: el page renderiza ahora `<PageHeader title={title} description={description} />` (sin backLink) + body. Wrapper `flex max-w-2xl flex-col gap-8` lo aporta el layout.
- [x] 2.3 (Opcional según design.md Open Question) Si el placeholder en title se ve raro, mover el título dinámico (descripción de la regla) dentro del cuerpo como sub-header y dejar el chrome del layout con solo back-link. **Decidido**: opción B aplicada en 2.1/2.2.
- [x] 2.4 (Agregado durante implementación) Crear `apps/web/app/(app)/transactions/recurring/[id]/loading.tsx` con skeletons del título + form + instances list. Sin esto la ruta caería al loading del padre `/recurring/loading.tsx` (skeleton de la lista, UX incorrecta).

## 3. `/transactions/[txId]/` — chrome con back-link + slot kebab vacío

- [x] 3.1 Crear `apps/web/app/(app)/transactions/[txId]/layout.tsx` (server sync). **Mejora**: en vez de back-link estático, layout monta `<TxBackLink />` (client component nuevo, lee `useSearchParams().get('from')`) para que el back-link respete la perspectiva desde el first paint, no solo después de que el body resuelva.
- [x] 3.2 Reescribir `apps/web/app/(app)/transactions/[txId]/loading.tsx`: quitar `PageHeaderSkeleton`, dejar solo skeletons del cuerpo (Card + meta rows + Card de descripción). Wrapper sin redeclarar contenedor del layout.
- [x] 3.3 **Refactor mayor**: `GlobalTransactionDetail` deja de renderizar `TxHeader` (back-link + actions); el back-link vive en el layout y el kebab se monta solo (sin label) right-aligned arriba de TxHero. Page deja de pasar prop `backHref`. `tx-header.tsx` queda sin consumidores y se borra. Trade-off visual chico (kebab en su propia row) por consistencia con chrome-always-visible.

## 4. `/transactions/[txId]/edit/` — herencia del padre

- [x] 4.1 Verificar que `/transactions/[txId]/edit/page.tsx` hereda el chrome del layout de `[txId]/`. Si el back-link "← Movimientos" no es adecuado para `/edit` (debería ser "← Detalle"), agregar `[txId]/edit/layout.tsx` con su propio chrome. Confirmar visualmente. **Decidido**: necesita layout propio porque back-link va al detalle (no a la section). Creado `[txId]/edit/layout.tsx` + `EditChrome` client component (lee searchParams para preservar `from` en el detailHref) + `[txId]/edit/loading.tsx` (skeleton del form).

## 5. `/accounts/[id]/` — chrome solo back-link

- [x] 5.1 Crear `apps/web/app/(app)/accounts/[id]/layout.tsx` (server sync). Renderiza únicamente: `<div className="flex flex-col gap-8 max-w-2xl"><Link href="/accounts" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← {t('title')}</Link>{children}</div>`. Usar `getTranslations('accounts')` server-side.
- [x] 5.2 Crear `apps/web/app/(app)/accounts/[id]/loading.tsx`: skeleton de `AccountDetailHeader` (avatar + nombre + balances) + skeletons de pending reimbursements + skeletons de movement list. **NO** incluye `PageHeaderSkeleton` ni el back-link.
- [x] 5.3 Refactor `account-detail-content.tsx`: quitar el `<Link>` propio del back-link (ahora vive en el layout) y el wrapper externo si solo existía para ese link. Resto del componente queda igual.

## 6. `/accounts/[id]/edit/` — herencia

- [x] 6.1 Verificar que `/accounts/[id]/edit/page.tsx` hereda el back-link `← Cuentas` del layout padre. Si necesita uno propio (`← {account name}`), agregar `[id]/edit/layout.tsx`. Confirmar visualmente. **Decidido**: layout propio (`← {account.name}` → `/accounts/[id]`) + loading.tsx skeleton del form. Mini-fetch de `getAccountDetail` server-side para el nombre.

## 7. `/cards/[id]/` — chrome solo back-link

- [x] 7.1 Crear `apps/web/app/(app)/cards/[id]/layout.tsx` (server sync). Renderiza únicamente el back-link `← Tarjetas` con estilo canónico, wrapping `{children}` en el mismo `max-w-3xl flex flex-col gap-6` que hoy usa el page.
- [x] 7.2 Crear `apps/web/app/(app)/cards/[id]/loading.tsx`: skeleton de `CardDetailHeader` (avatar + nombre + status pill) + skeleton del `CardDetailView` (apagar / curso / prox). NO incluye `PageHeaderSkeleton` ni el back-link.
- [x] 7.3 Refactor `apps/web/app/(app)/cards/[id]/page.tsx`: quitar el `<Link href="/cards">` propio (vive en layout). Borrar el wrapper externo `max-w-3xl flex flex-col gap-6` si lo redeclara. Mantener `CardDetailHeader` y resto. **Nota**: reescritura completa por las 3 ramas (empty-state new, archived-no-pendings, principal); todas pierden su wrapper + back-link.

## 8. `/cards/[id]/edit/` — herencia

- [x] 8.1 Verificar herencia del back-link `← Tarjetas` desde `/cards/[id]/`. Si necesita uno propio (`← {card name}`), agregar layout. **Decidido**: layout propio (`← {card.name}` → `/cards/[id]`) + loading.tsx skeleton del form. Mini-fetch de `getCreditCardDetail` server-side para el nombre.

## 9. `/cards/[id]/periods/` — chrome con back-link dinámico

- [x] 9.1 Crear `apps/web/app/(app)/cards/[id]/periods/layout.tsx` (server async). Fetchea `getCreditCardDetail(id)` mínimo para obtener `name` (o un helper más liviano `getCardName(id)` si vale crearlo). Renderiza `<PageHeader title={t('list.periods_title')} backLink={{ href: '/cards/' + id, label: cardName ?? ' ' }} />`.
- [x] 9.2 Crear `apps/web/app/(app)/cards/[id]/periods/loading.tsx`: skeletons de filas de período. NO incluye `PageHeaderSkeleton`.
- [x] 9.3 Refactor `apps/web/app/(app)/cards/[id]/periods/page.tsx`: quitar el `<PageHeader />` propio. Cuerpo solo.

## 10. `/cards/[id]/periods/[periodId]/` — chrome con título dinámico

- [x] 10.1 Crear `apps/web/app/(app)/cards/[id]/periods/[periodId]/layout.tsx` (server async). Fetchea el periodo mínimo para obtener su label. Renderiza `<PageHeader title={periodLabel ?? ' '} backLink={{ href: '/cards/' + id + '/periods', label: t('list.periods_title') }} />`. **Nota**: el chrome también monta `EditDatesSheet` (action slot) cuando el período es editable. Doble fetch del período (layout + page) — aceptable por simplicidad.
- [x] 10.2 Crear `apps/web/app/(app)/cards/[id]/periods/[periodId]/loading.tsx`: skeletons del detalle del período.
- [x] 10.3 Refactor `apps/web/app/(app)/cards/[id]/periods/[periodId]/page.tsx`: quitar el `<PageHeader />` propio.

## 11. `/cards/[id]/periods/[periodId]/pay/` — herencia

- [x] 11.1 Verificar que el chrome del padre (`[periodId]/`) es razonable para `/pay`. Si no, agregar layout propio con back-link `← {periodLabel}`. **Decidido**: layout propio sync (title `payment.title` + back-link `← payment.back_label` al período) + loading.tsx skeleton del form.

## 11.5. `/settings/categories/*` — per-route layouts (agregado mid-implementation)

- [x] 11.5.1 Identificado problema: `CategoriesHeader` switcheaba 5 variantes via `usePathname` + `useParams` desde el cliente; ventana de race entre los dos hooks deja chrome vacío durante la transición.
- [x] 11.5.2 Crear `apps/web/app/(app)/settings/categories/new/layout.tsx` (server sync) + `loading.tsx` (skeleton del form de creación).
- [x] 11.5.3 Crear `apps/web/app/(app)/settings/categories/[id]/edit/layout.tsx` (server async, fetchea categoría para descripción) + `loading.tsx`.
- [x] 11.5.4 Crear `apps/web/app/(app)/settings/categories/[id]/subcategories/layout.tsx` (server async + Add button) + `loading.tsx` (skeleton de filas).
- [x] 11.5.5 Crear `apps/web/app/(app)/settings/categories/[id]/subcategories/new/layout.tsx` (server async) + `loading.tsx`.
- [x] 11.5.6 Simplificar `CategoriesHeader` para que solo renderice el chrome del root y devuelva `null` off-root.

## 12. Verificación

- [x] 12.1 `pnpm --filter web typecheck` limpio.
- [x] 12.2 `pnpm --filter web lint` limpio.
- [x] 12.3 Browse manual de las 13 rutas hijas: el chrome (back-link + slot acciones) está visible desde el first paint en cada una. Botones empiezan disabled si dependen de data y se habilitan al cargar. **Verificado tras varios rounds**: las layouts con `await getTranslations` solo (no DB) funcionan como `/cards/[id]`. Las que tenían `PageHeader` en layout y faltaba subdivisión chrome/body (subcategories) se fixearon hoisteando título + Add button a un client header en el layout (patrón AccountsHeader).
- [x] 12.4 Sanity de las section roots (`/transactions`, `/accounts`, `/cards`, `/dashboard`): siguen funcionando como antes; no se rompió ningún chrome existente.
- [x] 12.5 Verificar `loading.tsx` de cada section root y de cada ruta hija nueva: ninguno usa `PageHeaderSkeleton`. **Verificado**: `grep -rn PageHeaderSkeleton apps/web/app/(app)` retorna 0 matches.

## 13. Spec sync

- [x] 13.1 `openspec validate always-render-child-route-chrome --strict` limpio.
- [x] 13.2 Archivar el change con `/opsx:archive`.
