# Proposal: split-web-wallet-filter-axes

## Why

El filtro de la billetera en `/cards` web mete **dos ejes distintos en un solo control**. `apps/web/app/(app)/cards/_components/cards-compact-view.tsx:34` declara `FILTERS: ViewFilter[] = ['by-bank', 'all', 'in-use', 'due-soon', 'with-balance']` y los reparte en un único `Segmented`. Pero `by-bank` decide **cómo se muestra** la lista (agrupada o plana) y las otras cuatro deciden **qué tarjetas entran**. Al ser opciones excluyentes de un mismo control:

- elegir "Vencen pronto" saca al usuario de la vista agrupada como efecto colateral, y
- volver a "Por banco" **borra** el predicado elegido — espiar el agrupado cuesta la selección.

Encima, `Segmented` reparte `flex-1` en partes iguales (`apps/web/components/ui/segmented.tsx:40`), así que a ancho de teléfono las cinco etiquetas se aplastan: "Vencen pronto" y "Con saldo" no entran legibles en 390px.

`apps/mobile/components/cards/Wallet.tsx:68` ya resolvió los dos problemas separando los ejes, y **la lógica compartida ya está escrita y testeada**: `CardPredicateFilter` (`packages/cards/src/grouping.ts:22`), `CARD_PREDICATE_FILTERS` (:109) y `countByFilter` (:120, construido sobre `applyFilter` para que el contador no pueda divergir de lo que el filtro muestra, con tests en `packages/cards/src/__tests__/grouping.test.ts:154`). Falta únicamente el consumidor web.

Cierra el issue [#72](https://github.com/CristianPerez06/grana-v3/issues/72).

## What Changes

- **El estado se parte en dos ejes, en las dos plataformas.** `CardsCompactView` pasa de un `useState<ViewFilter>` a `mode: 'by-bank' | 'list'` + `filter: CardPredicateFilter`, calcado de `Wallet.tsx`. Un solo estado alimenta las dos composiciones de controles: no hay dos fuentes de verdad que reconciliar.
- **Bajo `md`, la composición nativa**: `Segmented` de dos opciones (`Por banco` / `Lista`) más una fila de chips de predicado con conteo, visible **solo** en modo Lista. Chips dimensionados por contenido, scroll horizontal, y el chip con 0 resultados deshabilitado — el filtro vacío se ve antes de tocarlo en vez de llevar a una lista vacía.
- **En `md` y hacia arriba, desktop no cambia de composición**: sigue el `Segmented` único de cinco opciones en una fila, ahora como **proyección** del mismo estado (`Por banco` ↔ modo agrupado; cada predicado implica modo plano).
- **Las opciones de predicado con 0 resultados se renderizan deshabilitadas también en el control de desktop.** `SegmentedOption.disabled` ya existe en el contrato (`packages/ui-contracts/src/index.ts:574`) y `Segmented` ya lo pinta (`disabled:opacity-40`). Sin esto, el efecto de guarda del punto siguiente sería incoherente en desktop: el usuario elegiría un segmento y la vista lo devolvería a "Todas" sin explicación. Es la única diferencia de comportamiento que este change introduce en desktop, y es aditiva: gana el mismo aviso previo que ya tiene el teléfono.
- **Efecto de guarda portado desde el nativo**: si un refetch deja el predicado activo en 0 resultados, la vista cae a `Todas`. Con las opciones vacías deshabilitadas en ambas composiciones, el efecto solo puede dispararse por un refetch, nunca por una selección del usuario.
- **Nuevo `apps/web/app/(app)/cards/_components/wallet-filter-chips.tsx`** — mismo nombre y mismas props que `apps/mobile/components/cards/WalletFilterChips.tsx`, implementación web. No se comparte JSX.

Sin cambios de datos, queries, migraciones, validación ni semántica contable. Sin strings nuevas: `cards.compact.filters.list` ya existe en `es.json` y `en.json`.

**Bifurcación por CSS, no por JS.** Las dos composiciones se montan siempre y se alternan con clases (`md:hidden` / `hidden md:flex`), siguiendo la convención mobile-first de `web-responsive-layout`. El repo tiene un hook `useIsMobile` (`apps/web/lib/use-is-mobile.ts`), pero su propio docstring aclara que devuelve `false` hasta montar: sirve para un drawer que se abre por interacción, no para un control que forma parte del primer paint de la ruta. Usarlo acá mostraría el segmentado de cinco opciones por un frame en un teléfono.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `cards`: el requirement **"El listado de tarjetas se muestra como wallet con hero de pago mensual"** cambia su punto 3 ("Controles de vista"). Hoy codifica la divergencia como *plataforma* — "Web: un único control segmentado de cinco opciones" / "Mobile: dos controles separados". Pasa a codificar (a) la regla de **dos ejes con un estado** y el **fallback por conteo vacío** como comportamiento común a las dos plataformas, y (b) la **composición** como función del ancho disponible: dos controles en mobile nativo y en web bajo `md`; segmentado único de cinco opciones en web `md+`, con las opciones sin resultados deshabilitadas. En consecuencia, tres scenarios hoy tagueados `(mobile)` —controles separados, chip sin resultados no seleccionable, filtro que sobrevive al ida y vuelta— pierden el tag: el comportamiento deja de ser exclusivo del nativo. Se agrega un scenario `(web)` para la composición de desktop.
- `cards`: el requirement **"El estilo visual de `/cards` (raíz) sigue el handoff `docs/design/cards/` y respeta sus no-goals"** actualiza dos textos que quedan desactualizados: la bala **Web** de "Reglas de presentación de la vista compacta" (hoy dice `Default "Por banco"; toggle "Todas" (plano)`) y el scenario "La ruta sigue el mockup de la vista compacta" (hoy dice `en web "Por banco" / "Todas" en un segmented único; en mobile el segmented "Por banco" / "Lista" más los chips de filtro`).

**Pre-change check.** Las changes activas (`add-mobile-money-calculator`, `align-mobile-movement-form-surface`, `close-movement-form-parity-gaps`, `fix-native-movement-form-spec-drift`, `mirror-native-chrome-on-web-mobile`) tocan `money-input-calculator`, `transactions`, `overlay-primitives`, `page-header` y `web-app-shell`. Ninguna toca `cards` ni `apps/web/app/(app)/cards/`. Sin solapamiento.

**Drift preexistente, fuera de alcance.** El segundo requirement contiene la línea "El CTA mobile permanece disabled placeholder mientras `/cards/new` mobile no exista", que ya es falsa (la ruta nativa existe y el primer requirement manda lo contrario). Este change la restata **verbatim** en su delta: corregirla es otro change, no un efecto colateral de mover un filtro.

## Impact

- `apps/web/app/(app)/cards/_components/cards-compact-view.tsx` — estado partido en `mode` + `filter`, las dos composiciones de controles, el efecto de guarda, y el mapeo del segmentado de desktop sobre el estado compartido.
- `apps/web/app/(app)/cards/_components/wallet-filter-chips.tsx` — **nuevo**. Espejo web de `WalletFilterChips`.
- `openspec/specs/cards/spec.md` — vía los deltas de arriba.

Nada más. `packages/cards`, `packages/ui-contracts`, `packages/i18n-messages`, `apps/mobile` y el resto de `apps/web` quedan sin tocar: la lógica, el contrato y las strings ya existen.
