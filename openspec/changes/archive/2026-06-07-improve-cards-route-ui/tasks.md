# Tasks — `improve-cards-route-ui`

> Este change es una propuesta de **estilo/layout** + un **fix de navegación mobile** discovered durante la inspección de diseño. La implementación visual se ejecuta en pasos pequeños sobre componentes existentes en **ambas plataformas**.

## 1. Alineación previa

- [x] 1.1 Confirmar con el usuario que `docs/design/cards/` es la referencia normativa (no autoritaria pixel-a-pixel, sí en jerarquía y composición).
- [x] 1.2 Releer el inventario de componentes y datos en `docs/design/cards/README.md` para validar que no aparecieron campos nuevos en las queries desde el handoff.

## 2. Web — refinamientos visuales sobre componentes existentes

> Todos los pasos modifican **solo** estilo / layout / tipografía. No tocan props públicas, no agregan estado, no agregan acciones, no agregan datos.

- [x] 2.1 `CardsMonthHero` — afinar jerarquía visual del hero "A pagar este mes": monto ARS primario grande, USD subordinado más chico y por separado (sin sumar), destacar próximo vencimiento, y separar visualmente la lista de "Próximos vencimientos" del bloque del total. (Estructura previa ya cumplía; cambios concretos viven en 2.2.)
- [x] 2.2 Filas de próximos vencimientos dentro del hero — bajo `< sm`, cada fila apila identidad (nombre de tarjeta + fecha) arriba y montos (ARS primario / USD subordinado) abajo, sin competir en una sola línea horizontal. Bajo `≥ sm`, vuelve al layout horizontal con monto alineado a la derecha.
- [x] 2.3 `WalletSection` — header alineado con `/accounts`: título compacto (caps + tracking + muted) + hint subordinado. Bajo `< sm`, título y hint apilados.
- [x] 2.4 `WalletCard` (componente del wallet grid web) — mejorar densidad interna sin tocar datos:
  - [x] 2.4.a Nombre de tarjeta wrappea a múltiples líneas (`break-words` en lugar de `truncate`); banco/meta también `break-words`.
  - [x] 2.4.b Pill de estado tiene ancho intrínseco; el header usa `items-start` para que un nombre que wrappea no empuje el pill.
  - [x] 2.4.c Stats triada apila verticalmente bajo `< sm` (`grid-cols-1 sm:grid-cols-3`); ARS primario / USD subordinado.
  - [x] 2.4.d Barra de límite ya se omite cuando `credit_limit=null`; sin cambios.
  - [x] 2.4.e Footer (cuotas + "Ver resumen") apila bajo `< sm` y vuelve a horizontal en `sm+`; sigue siendo link al detalle.
- [x] 2.5 `ArchivedCardsSection` — secundaria/colapsable con `<details>` nativo, título "Archivadas (N)", solo renderiza cuando hay ≥1 archivada. **Ya correcto; sin cambios.**
- [x] 2.6 `CardsHeader` — `AddCardButton` sigue usando el `Button` primitivo; `PageHeader` ya tiene el fix de stacking responsive desde `improve-accounts-route-ui`. **Sin cambios.**
- [x] 2.7 Skeletons — los shapes existentes siguen siendo válidos para los paddings y separaciones nuevos (ningún cambio de min-height ni de bloques principales). **Sin cambios.**

## 3. Mobile — refinamientos visuales sobre componentes existentes

> Mismas reglas que web: solo estilo / layout / tipografía; ningún cambio de datos, queries, ni navegación (excepto el fix dedicado en sección 4).

- [x] 3.1 `CardsHeader` (mobile) — `PageHeader` custom + CTA disabled placeholder ya correctos. **Sin cambios.**
- [x] 3.2 `CardsMonthHero` (mobile) — jerarquía visual ya alineada con web; cambios concretos viven en 3.3.
- [x] 3.3 Filas de próximos vencimientos dentro del hero mobile — apilan identidad (tarjeta + fecha) arriba y monto (ARS primario / USD subordinado) abajo, con `border-t border-border-soft` separando ambos bloques. La línea USD se agregó (paridad con web) cuando `due.amountUSD > 0`. El `numberOfLines={1}` sobre el nombre se removió.
- [x] 3.4 Header de sección "Mis tarjetas" + hint (mobile, inline en `cards.tsx`) — título compacto (caps + tracking + `text-text-soft`) sobre hint subordinado, apilados.
- [x] 3.5 `Wallet` (mobile) — sin cambios estructurales.
- [x] 3.6 `CreditCardItem` (mobile, item del carrusel) — densidad mejorada sobre el set de datos actual:
  - [x] 3.6.a `numberOfLines={1}` removido del nombre; ahora wrappea a múltiples líneas.
  - [x] 3.6.b Pill de estado (Vencido / Por vencer) ahora tiene `shrink-0` para preservar ancho intrínseco bajo nombres largos.
  - [x] 3.6.c Montos ARS primario / USD subordinado ya correctos; sin cambios.
  - [x] 3.6.d Barra de límite ya se omite cuando `credit_limit=null`; sin cambios.
- [x] 3.7 `ArchivedCardsSection` (mobile) — sin cambios.

## 4. Mobile — fix de navegación

> Bug detectado durante la inspección de diseño: el código está fuera de spec.

- [x] 4.1 `apps/mobile/components/cards/CreditCardItem.tsx:48` — `onPress` ahora navega a `/cards/${card.id}` (mismo patrón que `ArchivedCardsSection.tsx`). Nota: el segmento `/cards/[id]` mobile aún no existe como ruta, por lo cual el push queda como no-op hasta que esa pantalla aterrice; el fix alinea el código con la spec y prepara el camino.

## 5. Web — auditoría de no-goals

- [x] 5.1 Sin totales nuevos: el hero sigue mostrando ARS primario + USD subordinado solamente; ningún total al pie de upcoming, wallet, ni archivadas.
- [x] 5.2 Sin búsqueda, filtros ni ordenamiento. Orden del wallet sigue siendo el del query existente.
- [x] 5.3 Wallet card sin acciones nuevas: el único click sigue siendo navegar al detalle (`<Link href="/cards/[id]">`).
- [x] 5.4 Bimoneda respetada: ARS primario / USD subordinado en hero amount, upcoming rows, y stats triada del wallet card.
- [x] 5.5 Sin queries, server actions, ni campos nuevos. Solo cambios CSS/JSX.

## 6. Mobile — auditoría de no-goals

- [x] 6.1 Mismas verificaciones aplican: sin totales nuevos, sin búsqueda/filtros, sin acciones nuevas, bimoneda respetada en hero + upcoming rows + CreditCardItem.
- [x] 6.2 `Wallet` mobile sigue siendo `FlatList horizontal` con `snapToInterval` (carrusel con peek); sin cambios estructurales.
- [x] 6.3 CTA "Agregar tarjeta" sigue siendo el `AddCardPlaceholder` disabled (`apps/mobile/components/cards/CardsHeader.tsx`); este change NO implementa `/cards/new` mobile.

## 7. Validación

- [x] 7.1 `pnpm openspec validate improve-cards-route-ui --strict` → `Change 'improve-cards-route-ui' is valid`.
- [x] 7.2 `pnpm openspec:check` → `openspec:check OK`.
- [x] 7.3 `pnpm --filter web lint` → pass.
- [x] 7.4 `pnpm --filter mobile lint` → pass (2 warnings pre-existentes en `apps/mobile/lib/cards/queries.ts` y `apps/mobile/scripts/gen-icons.mjs`, archivos no tocados).
- [x] 7.5 `pnpm --filter web typecheck` → pass. `pnpm --filter mobile typecheck` → pass.
- [ ] 7.6 Snapshot manual en navegador de `/cards` (web): empty, una tarjeta, múltiples, archivadas, errores. Pendiente para el usuario antes de mergear.
- [ ] 7.7 Snapshot manual en simulador de `/cards` (mobile): empty, una tarjeta, carrusel con peek, archivadas colapsada/expandida. Verificar que tap en card haga push a `/cards/[id]` aún cuando esa ruta no existe todavía (push debería ser no-op silencioso). Pendiente para el usuario.
