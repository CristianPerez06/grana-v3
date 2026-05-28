# Diseño técnico — Rediseño visual del módulo Movimientos

## Contexto

El módulo `transactions` tiene los componentes ya implementados y estables tras el roadmap previo (Changes 1-4 del rediseño funcional). Este change toca exclusivamente la **capa de presentación**. Lógica pura en `@grana/money-logic`, queries en `apps/web/lib/transactions/queries.ts`, y reglas DB no se tocan.

## Decisiones técnicas

### 1. Color semántico como tokens, no clases Tailwind hardcodeadas

**Decisión**: agregar un nuevo token `--expense: #B56A5A` en `packages/ui-tokens/src/theme.css` y exponer la variant `text-expense` (y `bg-expense`, `border-expense`) en `apps/web/app/globals.css`. El cambio de `text-red-600` → `text-expense` se aplica con `Grep + Edit replace_all` en los componentes afectados (`MovementRow`, `GlobalTransactionDetail`, `TransactionActions`, banners, etc.).

**Por qué**: el color terracota es un cambio de criterio cross-cutting. Si se hardcodea como Tailwind crudo (`text-[#B56A5A]`), futuros cambios de tono requieren grep en cien lugares. Con token, un solo cambio en el theme propaga.

**Tokens semánticos adicionales** (mismo theme.css):
- `--income: #10B981` (alias del emerald existente, para uso explícito en montos de income).
- `--text-neutral-amount: var(--ink)` (alias semántico de navy primario para transferencias / cambios / ajustes neutros).
- `--text-pending: var(--text-muted)` (alias semántico de gris medio para reintegros pendientes y "esperado").

Los aliases son intencionalmente livianos: hoy mapean a colores existentes, pero la indirección permite ajustarlos si en el futuro queremos que "pendiente" tenga un treatment propio sin tocar `text-muted` global.

### 2. Tailwind 4 slash notation para opacidades de fondos de íconos

Los fondos de íconos de categoría usan el color de la categoría a 14% de opacidad. Tailwind 4 acepta `bg-cat-1/14` con slash notation, pero NO en Tailwind 3.

**Decisión**: usar slash notation. Si la versión de Tailwind del repo no la resuelve (probablemente Tailwind 4 según `AGENTS.md`, pero validar), caer al patrón CSS variable: `style={{ backgroundColor: 'color-mix(in srgb, var(--cat-1) 14%, transparent)' }}`. NO crear tokens nuevos `--cat-1-soft` etc. — multiplican la superficie de cambio y son derivables del color base.

### 3. Donut estático con SVG puro, sin lib de charts

**Decisión**: renderizar el donut con `<svg>` + `<circle>` y `stroke-dasharray` para los segmentos. Cinco segmentos de tamaño calculado desde los porcentajes del ranking (los primeros cuatro + "otros" agregando el resto). Sin animación de entrada.

**Por qué**: el research mostró que los usuarios de Spendee castigan las "excessive animations and layers". El donut como hook visual sirve solo si es rápido y silencioso. Lib externa (Recharts, visx, etc.) traería 50-200 KB para algo que cinco circles SVG resuelven sin dependencias.

**Cálculo del dasharray** vive en `@grana/money-logic` como helper puro `buildDonutSegments(slices)` que devuelve `Array<{ color, length, offset }>`. Se testea con casos: una sola categoría, dos, cinco, "otros" colapsando 6+ categorías.

### 4. Skeleton del listado: componente nuevo `MovementListSkeleton`

**Decisión**: crear `apps/web/lib/transactions/components/movement-list-skeleton.tsx` con tres "filas placeholder" que replican la anatomía visual (40x40 cuadrado de ícono, dos líneas de texto, monto a la derecha) usando `bg-muted` con animación `animate-pulse` de Tailwind. Mostrar dos day groups con tres y cuatro filas, para que la jerarquía del header se mantenga durante la carga.

**Por qué**: `Spinner` centrado rompe la apuesta editorial. Un skeleton que respeta la grilla del listado se siente "la página ya está, los datos están entrando", no "la página se rompió".

### 5. Empty state contextual del mes vacío: refinar copy del `none`

**Decisión**: no agregar una cuarta variant al enum (`none | search | filter`). En cambio, dentro de `none`, decidir la copy según contexto:

- Si el usuario no tiene ningún movimiento histórico en cualquier mes → copy de bienvenida ("Acá va a aparecer cada peso que se mueva").
- Si el usuario tiene movimientos en otros meses pero solo navegó a un mes vacío → copy contextual ("No registraste nada en {mes} todavía").

La distinción se hace en el server component que renderiza `MovementList`: con una query liviana (`SELECT 1 FROM transactions WHERE user_id = $1 LIMIT 1`) se decide cuál copy pasar. No requiere migración ni cambio de schema.

### 6. Link "Ver recurrencias →" dentro del subtítulo

**Decisión**: el subtítulo del header pasa de un `<p>` plano a un `<p>` con texto + `<Link>` inline. Tipográficamente: peso 500, 13px, color `text-slate` (`#3A6B8A`), con `Chevron Right` lucide 12px al lado. `hover:text-ink` para feedback. Sin underline (sería ruido visual).

**Alternativas descartadas**:
- **Sub-tabs ("Movimientos · Recurrencias · Plantillas")**: agrega una capa de jerarquía visual que el módulo no necesita y rompe el header narrativo.
- **Botón outline en la barra de filtros (variante C que se exploró)**: confunde categorías visuales (filtros y recurrencias son conceptualmente distintos: filtros operan sobre la lista, recurrencias es otra página).
- **Volver al botón secondary del header (mantener el status quo)**: justamente lo que esta change rechaza por "ruido sobre el display de mes".

### 7. `CategorySpendingOverview` actualizado, no reemplazado

**Decisión**: editar el componente existente para que renderice la variante híbrida (donut grande + ranking enriquecido). No crear un componente nuevo. El call site (`apps/web/app/(app)/transactions/page.tsx`) ya pasa los props correctos (`breakdown`, `currency`, `monthLabel`, `prevHref`, `nextHref`); el componente cambia su `return` pero mantiene su contrato.

**Por qué**: el componente ya está ubicado, importado y testeado en el render server-side. Crear uno nuevo obligaría a tocar el call site, los imports, y dejaría código muerto del viejo.

**Meta enriquecida en cada fila del ranking**: la prop `breakdown` (slices con `categoryId`, `label`, `amount`, `share`, `color`) ya existe; agregamos un campo derivado `metaLine` que la query construye según la categoría:
- Si la categoría tiene una compra en cuotas dominante → `"{share}% · cuotas {descripción}"`.
- Si la categoría tiene recurrencias detectadas → `"{share}% · {n} recurrentes"`.
- Por defecto → `"{share}% · {n} movimientos"`.

La construcción de la meta es lógica de presentación, no contable. Vive en una función pura nueva en `@grana/money-logic`: `buildSliceMetaLine(slice, stats)`. Se testea unitariamente.

### 8. Header narrativo como variante del `PageHeader` existente, no componente nuevo

**Decisión**: extender `PageHeader` con una variant `narrative` (props nuevos: `eyebrow?: string`, `monthLabel?: string`, `prevMonthHref?: string`, `nextMonthHref?: string`, `subtitle?: ReactNode`). Cuando se pasan, renderiza el patrón narrativo; si no, cae al patrón clásico.

**Por qué**: hay otras pantallas (cuenta, detalle, form) que siguen necesitando el `PageHeader` clásico con `title` + `description` + `actions`. Crear un `NarrativeHeader` separado duplica primitive. La variant es más limpia.

**Contrato compartido**: actualizar `packages/ui-contracts/src/page-header.ts` agregando los nuevos props como opcionales. El tech lead replica en `apps/mobile/`.

## Alternativas consideradas y descartadas

### Variante B del breakdown (ranking puro sin donut)

Probada y descartada en explore. El ranking solo, sin donut, se lee como "lista cualquiera" — pierde el efecto vidriera de la sección. El donut es el hook que invita a hacer click en "Ver el detalle".

### Variante C del breakdown (donut compacto + top 3)

Buena para el dashboard como teaser, pero subordina demasiado el breakdown en `/transactions`. Como esta es la pantalla principal del módulo, el breakdown merece protagonismo. C queda como referencia para el futuro dashboard.

### Botón "Recurrencias" en el header como secondary

Descartado: confunde la jerarquía del display "Mayo 2026" y duplica el sidebar del repo (que no tiene Recurrencias top-level porque es funcionalidad secundaria del módulo Movimientos). El link en el subtítulo da el acceso sin el peso visual.

### Color rojo de Tailwind para gastos

Lo que estaba. Se siente bancario, agresivo. La paleta del repo ya tiene una terracota mineral en sus tokens — usarla es coherencia con el design system existente, no invención.

### Lib de charts (Recharts, visx)

Descartado por peso (50-200 KB) para algo que SVG puro hace bien. Y porque las libs traen animaciones por default que el research pide evitar.

### Crear componente `NarrativeHeader` separado

Descartado: `PageHeader` con variant es más simple. Una sola primitive, dos modos.
