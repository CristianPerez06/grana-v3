## 1. Wrappers de read mobile

- [x] 1.1 En `apps/mobile/lib/cards/queries.ts`, agregar 3 wrappers thin espejo del patrón existente (`getCreditCards`/`getCardNetworks`): `getCreditCardDetail(id)`, `getCardPeriods(id)`, `getActiveInstallments(id)` — cada uno inyecta `supabase` nativo + `getTodayAR()` donde aplique, conserva firma zero-arg salvo `id`, e importa la impl de `@grana/cards`.
- [x] 1.2 Re-exportar los tipos de retorno desde el wrapper (`CreditCardDetail`, `CardPeriodDetail`, `ActiveInstallment`, `ActiveInstallmentsResult`) para que la pantalla + componentes los importen desde `../../lib/cards/queries` (paridad con el listado).
- [x] 1.3 NO agregar `getCardPeriodDetail`/`getCardPeriodTransactionCount` (sólo los usan las rutas anidadas, deferidas).

## 2. Componentes de presentación nativos

- [x] 2.1 Crear `apps/mobile/components/cards/detail/CardDetailHeader.tsx` sobre `PageHeader` (título = nombre de la tarjeta con placeholder mientras carga, back-link siempre visible, subtítulo = banco/red; sin lápiz de edición). (+`CardStatusPill.tsx` para el pill de tono.)
- [x] 2.2 `LifecycleTimeline.tsx`: timeline a pagar / en curso / próximo, seleccionable (estado local `PeriodKey`), sobre campos del `vm` (`apagar`/`curso`/`prox`, fechas, `is_estimated`, `accent`); tokens estructurales, sin aliases shadcn (hexes de dots/rings centralizados en `detail/format.ts`, mirror de tokens como `lib/colors.ts`).
- [x] 2.3 `PayHeroCard.tsx`: **display-only** — monto a pagar + días a vencimiento, sin botón de pago.
- [x] 2.4 `EnCursoCard.tsx`: total del ciclo en curso (barra de progreso del ciclo + día X + cierre + días restantes).
- [x] 2.5 `ProximoMiniRow.tsx`: próximo cierre (fecha, estimado).
- [x] 2.6 `CardLimitPanel.tsx`: límite / uso (o hint "cargá el límite" sin CTA de edición).
- [x] 2.7 `CuotasEnCursoPane.tsx` (+`CuotaProgressDots.tsx`): cuotas en curso (progreso), renderizado **inline** (sin segmented).
- [x] 2.8 Todos consumen `CardDetailViewModel`/`LifecyclePeriod`/`PeriodKey`/`ActiveInstallment` de `@grana/cards`; nombres/props espejan los web `_components`; i18n vía `useT('cards.detail.*')`; rich `<b>` stripped para RN. Orquestador `CardDetailView.tsx` (read-only, sin tabs).

## 3. Pantalla `/cards/[id]`

- [x] 3.1 Crear `apps/mobile/app/(app)/cards/[id].tsx`: `useLocalSearchParams` para `id`; `useQuery({ queryKey: ['cards','detail', id], queryFn: fetch de los 3 reads → { cardDetail, periods, installments } })`.
- [x] 3.2 Render: `CardDetailHeader` siempre montado; loading → `Spinner` (sin skeleton de pantalla completa); error / `cardDetail` no-credit → mensaje `notFound.cards.*`.
- [x] 3.3 Invocar `resolveCardDetailState({ cardDetail, periods, installments, todayISO: formatDateISO(getTodayAR()) })` y `switch (state.kind)`:
  - `not-found` → mensaje de no encontrado.
  - `new-card` → estado informativo (reutiliza `cards.detail.ready_*`, **sin** CTA de primer consumo).
  - `archived-empty` → estado informativo (archivada sin pendientes).
  - `active` → stack overview: `LifecycleTimeline` → `PayHeroCard` (si `vm.apagar`) → `EnCursoCard` → `ProximoMiniRow` → `CardLimitPanel` → `CuotasEnCursoPane`.
- [x] 3.4 Sin ninguna acción de escritura en ninguna rama (read-only).

## 4. Navegación

- [x] 4.1 Verificado: `Wallet.tsx` y `ArchivedCardsSection.tsx` ya navegan a `/cards/${id}`; no sobrevive ningún `CreditCardItem` (el push a `/cards` en `CommittedSection` es link a la lista, intencional). Nada que corregir.

## 5. Cierre

- [x] 5.1 `pnpm --filter mobile typecheck` + `lint` verdes (sólo queda 1 warning pre-existente en `scripts/gen-icons.mjs`, ajeno a este change).
- [x] 5.2 Smoke de las cuatro ramas: tarjeta nueva sin historial, archivada sin pendientes, activa (con a-pagar / sin a-pagar), y id inexistente → no encontrado. Validado por el usuario en simulador.
- [x] 5.3 Smoke del timeline en sus combinaciones (con pagados, con próximo estimado) y del header chrome desde el primer paint. Validado por el usuario.
- [x] 5.4 Confirmar paridad visual con el detalle web a ancho angosto; sin hex literal (los únicos hexes viven en `detail/format.ts` como mirror de tokens; el resto usa clases estructurales + `accent` del VM). Validado por el usuario.
