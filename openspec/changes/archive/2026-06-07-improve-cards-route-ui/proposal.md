# Mejorar el estilo visual de la ruta `/cards`

## Why

La ruta `/cards` ya tiene su comportamiento de producto specificado en `cards` y su chrome de carga en `route-loading-and-errors`. Lo que falta es **fijar el handoff visual** acordado en `docs/design/cards/` como referencia normativa para la ruta raíz, dejando explícito qué se mantiene igual y qué queda fuera de alcance — siguiendo el mismo patrón que se usó para `/accounts` (`improve-accounts-route-ui`, archivado el 2026-06-07).

Hoy la pantalla muestra header con CTA "Agregar tarjeta", hero "A pagar este mes" con monto ARS primario / USD subordinado y lista de próximos vencimientos, sección "Mis tarjetas" con wallet (grilla en web, carrusel horizontal en mobile) y sección secundaria colapsable de archivadas — todo composado por componentes existentes (`CardsHeader`, `AddCardButton`, `CardsMonthHero`, `WalletSection`, `Wallet`, `WalletCard` / `CreditCardItem`, `ArchivedCardsSection`). El handoff en `docs/design/cards/` reorganiza la jerarquía visual de esos componentes (densidad de filas de próximos vencimientos, jerarquía interna del `WalletCard`, header de sección "Mis tarjetas" + hint subordinado, separación entre bloques) sin tocar datos, queries ni acciones.

Esta propuesta deja escrito que la implementación:

- Usa **solo** los componentes y los datos que la ruta ya expone hoy.
- **No** agrega resúmenes, totales nuevos, búsqueda, filtros, ordenamiento, analítica, métricas derivadas, cards nuevas ni acciones de tarjeta nuevas.
- Mantiene **ARS primario / USD secundario** en el hero del mes, en cada fila de próximo vencimiento y en cada `WalletCard`; nunca suma ni convierte monedas.
- Mantiene el `Button` primitivo para las acciones tipo CTA (header + empty state).
- Trata web y mobile como **implementaciones nativas en paralelo** (JSX no se comparte; el contrato es la paridad de estructura y de jerarquía visual, no JSX compartido).
- A diferencia de `improve-accounts-route-ui`, este change **sí implementa ambas plataformas** porque la ruta `/cards` ya tiene paridad web/mobile en producción y el handoff cubre ambas.

Además, durante la inspección de diseño se detectó un **bug de navegación en mobile**: `apps/mobile/components/cards/CreditCardItem.tsx` navega a `router.push('/cards')` al tocar una tarjeta en lugar de a `/cards/[id]`. La spec ya dice que el tap debe ir a `/cards/[id]` (requirement "El listado de tarjetas se muestra como wallet con hero de pago mensual"), por lo cual el código está fuera de spec. La corrección entra en este change como tarea de implementación, no como cambio de requirement.

## What Changes

- **AGREGAR** un requirement en `cards` que fija `docs/design/cards/` como handoff visual normativo de la ruta `/cards` (raíz), enumera los componentes y datos sobre los que opera el rediseño, codifica los no-goals (no totales nuevos, no búsqueda, no filtros, no ordenamiento, no analítica, no acciones nuevas, no queries nuevas), confirma la regla bimoneda en el hero, en las filas de próximos vencimientos y en el `WalletCard`, confirma el uso del `Button` primitivo en las acciones, codifica la regla de stacking responsive en `< sm` (filas de próximos vencimientos + densidad interna del `WalletCard` + header de sección "Mis tarjetas" + hint), y fija que web y mobile se implementan como dos vistas nativas en paralelo (ambas alcanzan paridad de estructura y jerarquía en este mismo change).
- **DOCS** nuevos archivos en `docs/design/cards/` (ya presentes en el repo, no commiteados): `README.md`, `shared.css`, `web/cards.html`, `mobile/cards.html`, y `components/*.html`. Son referencia visual; la implementación usa los componentes del codebase.
- **FIX** en `apps/mobile/components/cards/CreditCardItem.tsx`: el `onPress` SHALL navegar a `/cards/[id]` con el `id` de la tarjeta, no a `/cards`. Esto alinea el código con el requirement existente "El listado de tarjetas se muestra como wallet con hero de pago mensual" → "El click/tap en una card SHALL navegar a `/cards/[id]`".
- **NO** se modifican: las queries (`getCreditCards`, `getCardsMonthSummary`, `getInstitutions`, `getCardNetworks`), el server-side data shape (`CardListItem`, `CardsMonthSummary`), los server actions, las rutas (`/cards`, `/cards/new`, `/cards/[id]`), las acciones del wallet card, ni el shell de Suspense con sus boundaries de error.
- **NO** se agregan: totales nuevos al pie de la sección, búsqueda, chips de filtros, controles de ordenamiento, métricas, cards de resumen extras, ni acciones de tarjeta más allá del tap → detalle.

## Capabilities

### New Capabilities

_Ninguna._ Esta propuesta agrega un requirement de superficie visual sobre la capability existente `cards`; no introduce datos, queries ni mutaciones nuevas.

### Modified Capabilities

- `cards`: agrega un requirement que fija el handoff visual de `/cards` (raíz) — referencia normativa a `docs/design/cards/`, no-goals explícitos, regla bimoneda en hero / fila de próximo vencimiento / wallet card, uso del `Button` primitivo, stacking responsive en `< sm`, web y mobile como implementaciones nativas en paralelo. NO modifica los requirements existentes del listado (`El listado de tarjetas se muestra como wallet con hero de pago mensual`) ni del scaffold de carga (`El header de /cards se renderiza desde el primer paint…`); el nuevo requirement los complementa con la capa de estilo y los límites de alcance.

## Impact

- **Rutas afectadas**: `/cards` (raíz). `/cards/new`, `/cards/[id]` y los segmentos hijos (`/cards/[id]/periods/...`) quedan fuera de alcance — sus rediseños viven en otros changes (ej. `2026-05-25-redesign-card-detail-page`, `2026-06-01-redesign-card-edit-as-drawer`).
- **Código afectado por la implementación** (este change SÍ implementa, a diferencia del precedente de accounts):
  - **Web**: `apps/web/app/(app)/cards/_components/{cards-month-hero,wallet-section,wallet,wallet-card,archived-cards-section}.tsx` — ajustes de tipografía, divisores, separación entre bloques, stacking responsive de filas de próximos vencimientos, densidad interna del wallet card (long card names, status pill, ARS/USD amounts, opcional barra de límite). `cards-header.tsx` queda como referencia para asegurar que el botón "+ Agregar tarjeta" sigue usando el `Button` primitivo (no requiere cambios funcionales).
  - **Mobile**: `apps/mobile/components/cards/{CardsMonthHero,CreditCardItem}.tsx` y `apps/mobile/app/(app)/cards.tsx` (sección "Mis tarjetas" inline) — ajustes de stacking de filas de próximos vencimientos (incluyendo agregar la línea USD que el código actual omite), densidad interna del item del carrusel (nombre wrappea, pill responsive), header de sección + hint, y **fix de navegación** en `CreditCardItem.tsx` (`router.push('/cards')` → `router.push('/cards/[id]')` con el `id` de la tarjeta). `CardsHeader` mobile no requiere cambios (subtítulo + CTA disabled placeholder ya están correctos). `Wallet.tsx` y `ArchivedCardsSection.tsx` no requieren cambios. La paridad funcional completa de `CreditCardItem` con `WalletCard` web (meta `Crédito · <red>`, stats triada resumen/cierra/vence, footer cuotas + "Ver resumen") queda fuera de alcance — es un change futuro.
- **Data layer**: sin cambios. Sin nuevas queries, sin nuevos campos en `CardListItem` o `CardsMonthSummary`, sin nuevos server actions.
- **Dependencias**: ninguna nueva. Usa tokens existentes en `@grana/ui-tokens` y primitivos existentes en `apps/web/components/ui/` (web) y `@grana/ui-mobile` (mobile).
- **i18n**: ninguna clave nueva. Las copys del header, hero, sección "Mis tarjetas", hint, archivadas y estado vacío ya existen en `@grana/i18n-messages`.
- **CTA mobile "Agregar tarjeta"**: queda en estado disabled placeholder mientras `/cards/new` mobile no exista, per requirement existente (`listado de tarjetas se muestra como wallet con hero de pago mensual` → scenario "CTA 'Agregar tarjeta' disabled placeholder en mobile"). Este change NO implementa `/cards/new` mobile.
