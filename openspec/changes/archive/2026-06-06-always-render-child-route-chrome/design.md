## Context

Next.js App Router renderiza segmentos en cadena: `layout.tsx` envuelve `page.tsx` y todo descendiente que no tenga su propio layout. `loading.tsx` es un fallback de Suspense ligado a un segmento: aplica a su `page.tsx` y desciende a cualquier segmento hijo que no tenga su propio `loading.tsx`. Variant C ya codificada en `route-loading-and-errors` aprovecha esto: el layout monta chrome persistente, el loading skeletonea solo el body.

Estado actual de cada ruta hija problemática:

| Ruta | Tiene `layout.tsx` propio | Tiene `loading.tsx` propio | Loading visible al navegar hacia ella |
|---|---|---|---|
| `/transactions/recurring` | ❌ | ✅ usa `PageHeaderSkeleton` | Su propio `loading.tsx` con header skeleton |
| `/transactions/recurring/[id]` | ❌ | ❌ | Hereda de `/transactions/recurring/loading.tsx` (header skeleton) |
| `/transactions/[txId]` | ❌ | ✅ usa `PageHeaderSkeleton` | Su propio `loading.tsx` con header skeleton |
| `/transactions/[txId]/edit` | ❌ | ❌ | Hereda de `/transactions/[txId]/loading.tsx` (header skeleton) |
| `/accounts/[id]` | ❌ | ❌ | Hereda de `/accounts/loading.tsx` (que skeletonea active+archived wallets — UX incorrecta para un detail) |
| `/accounts/[id]/edit` | ❌ | ❌ | Idem |
| `/cards/[id]` | ❌ | ❌ | Hereda de `/cards/loading.tsx` (month hero + wallet + archived — incorrecto) |
| `/cards/[id]/edit` | ❌ | ❌ | Idem |
| `/cards/[id]/periods` | ❌ | ❌ | Idem |
| `/cards/[id]/periods/[periodId]` | ❌ | ❌ | Idem |
| `/cards/[id]/periods/[periodId]/pay` | ❌ | ❌ | Idem |

Patrón canónico de Variant C ya implementado en section roots y en `/settings/categories/`:
- `layout.tsx` es server component (puede ser sync o async dependiendo de fetches), monta el chrome persistente.
- `loading.tsx` renderiza solo skeletons del body, dentro de los mismos containers de layout (max-w, gap, etc.) para que el reflow al cargar sea cero.
- Las acciones del chrome con dependencia de data se renderizan disabled (placeholder funcional, no skeleton visual).

Patrón canónico de título dinámico con placeholder ya implementado en `CategoriesHeader`:
```ts
// Non-breaking space (U+00A0) reserves the description line height without
// showing any visible text, so the title doesn't reflow when category resolves.
const categoryName = category ? getCategoryName(category, (k) => t(k)) : ' '
```

## Goals / Non-Goals

**Goals:**

- Que el chrome (back-link + slot de acciones) esté visible desde el first paint en todas las rutas hijas listadas.
- Que botones del chrome que dependen de data asincrónica empiecen disabled y se habiliten cuando la data resuelve.
- Que el `loading.tsx` de cada ruta jamás skeletonee el back-link ni el slot de acciones.
- Codificar la regla en `route-loading-and-errors` para que rutas hijas futuras la sigan automáticamente.

**Non-Goals:**

- No tocar mobile (no hay loading.tsx server-side en Expo Router para este caso de uso).
- No tocar section roots (ya cumplen Variant C).
- No remover `PageHeaderSkeleton`: queda en el toolkit por si una página futura no puede montar chrome persistente (caso edge, no hoy).
- No reemplazar `AccountDetailHeader`, `CardDetailHeader` ni el header interno de `GlobalTransactionDetail` por `PageHeader`. Esos widgets compuestos viven en el body, el layout solo monta el back-link.
- No tocar `/transactions/[txId]/edit` ni `/cards/[id]/periods/[periodId]/pay` como segmentos propios — heredan el layout y loading del padre y eso es suficiente.

## Decisions

### Decisión 1: Layout monta back-link + (opcionalmente) action slot. Título dinámico vive en el cuerpo.

Para rutas con título dinámico que es realmente un widget rico (avatar + nombre + status pill), el layout monta solo el back-link (estilo canónico `← {label}` ya codificado por `unify-child-route-headers`). El widget compuesto sigue siendo del page (con su propio skeleton acotado en `loading.tsx`).

Rutas que aplican este patrón:
- `/accounts/[id]`: layout monta `← Cuentas` y nada más. `AccountDetailHeader` queda en el page.
- `/cards/[id]`: layout monta `← Tarjetas`. `CardDetailHeader` queda en el page.

Para rutas con título textual simple (no widget rico), el layout monta un `PageHeader` completo. El page no declara header.

Rutas que aplican este patrón:
- `/transactions/recurring`: layout monta `PageHeader title="Recurrencias" + back-link "← Movimientos" + actions={<CreateRecurrenceButton disabled={!data} />}`. Page solo cuerpo.
- `/cards/[id]/periods`: layout monta `PageHeader title="Resúmenes" + back-link "← {cardName ?? ' '}"`. Page solo cuerpo.
- `/cards/[id]/periods/[periodId]`: layout monta `PageHeader title="{periodLabel ?? ' '}" + back-link "← Resúmenes"`. Page solo cuerpo.

Para rutas con título medio rico (titulo + sub-info pero sin avatar):
- `/transactions/recurring/[id]`: layout monta `PageHeader title="..." + back-link "← Recurrencias"` con placeholder en title.
- `/transactions/[txId]`: layout monta el chrome `TxHeader` (back-link + slot de actions). Slot de actions (`TxActionsMenu`) hoy depende de data del page — el layout lo deja disabled hasta que resuelva, igual que `RegisterMovementButton`.

**Alternativa considerada**: que el layout monte un `PageHeader` completo en todas las rutas y los widgets compuestos del cuerpo desaparezcan. Descartada: los widgets compuestos son el título visual primario por diseño (esto está documentado como excepción explícita en `page-header` spec `:200-208`), y reemplazarlos rompería la UX establecida.

### Decisión 2: Cómo el layout pasa data al chrome cuando depende del page

Para `/cards/[id]/periods`, el back-link es `← {cardName}` — cardName es data del segmento padre `/cards/[id]/page.tsx`. El layout `periods/layout.tsx` no tiene acceso directo a esa data en runtime de manera elegante (Next no comparte estado entre layouts).

**Opción A (elegida)**: `periods/layout.tsx` es async y fetchea el nombre de la tarjeta server-side (`getCreditCardDetail(id)` mínimo, o un query nuevo `getCardName(id)` más liviano). El back-link se pinta sincrónicamente sin depender de que el page resuelva.

**Opción B (descartada)**: layout client component que useQuery el nombre. Implica `loading.tsx` skeleton para el back-link → vuelve al problema original.

**Opción C (descartada)**: layout sync, placeholder fijo, page sobrescribe via portal. Frágil.

Opción A agrega un fetch redundante en `periods/layout.tsx`, pero (a) el dato es liviano (solo nombre), (b) RSC dedupea fetches si se usa el mismo query helper que el page, así que el costo real depende del cache layer. Aceptable.

Aplica el mismo principio a:
- `cards/[id]/periods/[periodId]/layout.tsx` también necesita el `periodLabel` → fetch server-side acotado.
- `transactions/recurring/[id]/layout.tsx` (si lo agregamos): la descripción del recurso fluye via `getRecurrence(id)` mínima.

Para `accounts/[id]/layout.tsx` y `cards/[id]/layout.tsx` solo hace falta back-link estático (`← Cuentas`, `← Tarjetas`), no hay fetch.

### Decisión 3: Botones disabled como expresión del placeholder funcional

Los slots de acciones (botones que abren drawers o navegan) reciben prop `disabled={true}` cuando la data no resuelve. Esto ya existe en `TransactionsHeader` (`<RegisterMovementButton disabled={!drawerReady} />`). Replicamos en los nuevos chromes con la misma técnica: el layout dispara `useQueries` cuando el botón depende de data client-side; cuando depende de data server-side ya disponible al renderizar el layout, queda enabled de entrada.

Casos:
- `/transactions/recurring/layout.tsx`: monta `CreateRecurrenceButton`. Hoy el page fetchea `accounts + categories` server-side y los pasa props. El layout no puede recibir esa data del page. Alternativas: (a) el layout fetchea esos catálogos también y los pasa al botón; (b) el botón se vuelve client component con `useQueries` propio. Recomendado: **(b)** — `CreateRecurrenceButton` (que ya es client) hace su propio `useQueries` con keys compartidas; TanStack dedupea si el cuerpo del page también fetchea via cliente.
- `/transactions/[txId]/layout.tsx`: monta `TxHeader` con slot de actions vacío (sin kebab); cuando el page rinde el body, este monta `TxActionsMenu` adentro del page (no como prop del chrome). Trade-off: el kebab no aparece desde first paint, solo el back-link. Aceptable por simplicidad — el back-link es la prioridad.

### Decisión 4: Spec delta — nuevo requirement, no modificación de uno existente

`route-loading-and-errors:184-185` ya establece la regla para section roots ("La acción primaria del header SHALL estar disabled..."). Agregamos un requirement nuevo en ADDED Requirements que explícitamente extiende esa regla a rutas hijas, en lugar de MODIFICAR el existente. Razón: el requirement existente sigue siendo verdadero como está. El nuevo es aditivo.

Scenarios concretos: dos casos representativos (`/transactions/recurring` para "chrome textual" y `/cards/[id]/periods` para "chrome con back-link dinámico").

## Risks / Trade-offs

- **Riesgo**: agregar `layout.tsx` async a cada ruta hija introduce un await server-side antes del first paint, que en teoría puede ralentizar el TTFB del segmento. → **Mitigación**: los fetches del layout son acotados (`getCardName`, `getRecurrence`) o nulos (back-link estático). Para casos como `/accounts/[id]` y `/cards/[id]` el layout es sync (back-link estático), zero overhead.
- **Riesgo**: el `TxActionsMenu` (kebab) deja de aparecer en el chrome durante el loading. → **Trade-off** aceptado: el back-link es lo que el usuario más necesita durante un loading; el kebab puede aparecer junto con el body.
- **Riesgo**: el `CreateRecurrenceButton` ya client component necesita refactor para fetchear sus propios catálogos via `useQueries` con keys compartidas. → **Mitigación**: patrón ya en uso en `TransactionsHeader`; no es código nuevo, solo migración.
- **Trade-off**: rutas tipo `/transactions/[txId]/edit` no tienen su propio layout/loading y heredan del padre. Si el padre incluye un kebab que en /edit no aplica, podría aparecer fuera de contexto. → Hoy `[txId]/edit/page.tsx` monta su propio `PageHeader` con backLink — habrá que reconciliar: el layout padre solo monta el back-link "← Movimientos" y deja el sub-header al page; o `/edit` define su propio layout sobrescribiendo. La decisión específica se documenta en tasks.

## Migration Plan

- Rollout atómico via merge a `main` después de `unify-child-route-headers`. Sin migración de datos.
- Rollback: revertir el PR. Cero efectos colaterales.
- Verificación: browse manual de cada ruta hija + sanity de las section roots para confirmar zero regresión.

## Open Questions

- ¿`/transactions/[txId]/edit` y `/cards/[id]/periods/[periodId]/pay` necesitan layout propio o heredan? **Propuesta**: heredan del padre por simplicidad. El page de `/edit` reemplaza su `PageHeader` por solo el body; el back-link sigue siendo el del segmento padre (`← Movimientos` o `← {tx-detail}` — vale decidir cuál es más útil). Si el back-link del padre no encaja, agregar su propio layout. Esto se decide cuando se implementa.
- ¿`/transactions/recurring/[id]` mantiene su propio layout o solo modifica page para que su `PageHeader` quede dentro del cuerpo y el chrome lo herede del segmento `recurring/`? **Propuesta inicial**: layout propio con back-link `← Recurrencias` y título placeholder; page renderiza solo el cuerpo del form/detail. Esto se confirma cuando se implementa.
