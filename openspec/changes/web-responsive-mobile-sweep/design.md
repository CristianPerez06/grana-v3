## Context

`apps/web` usa Tailwind con tokens de marca (`@grana/ui-tokens`). El shell autenticado renderiza un sidebar flotante en `md+` y un drawer bajo `md`; el contenido va en `<main>` dentro de un wrapper `max-w-5xl`. La mayoría de las pantallas se ajustaron a ojo en desktop, así que conviven dos situaciones: componentes que SÍ son responsive (ej. `account-row` apila con `sm:`, el dashboard usa `clamp()` en montos) y componentes que no (padding global fijo, heros con `text-[42px]` fijo, grids `grid-cols-N` sin breakpoint, overlays con ancho/padding fijo).

Una auditoría módulo por módulo ya ubicó los puntos concretos (ver proposal). Este diseño define el **patrón** común para arreglarlos de forma consistente y sin regresiones de desktop, no un listado línea por línea (eso vive en tasks.md).

## Goals / Non-Goals

**Goals:**
- Que toda ruta autenticada de `apps/web` se vea bien y sin scroll horizontal desde 320px de ancho.
- Establecer un patrón único y repetible (mobile-first) para que futuros componentes nazcan responsive.
- Cero cambios de comportamiento de negocio, datos o rutas: solo presentación.

**Non-Goals:**
- `apps/mobile` (lo lleva el tech lead) — no se toca, pero se preservan los contratos que la capa compartida expone.
- Dark mode (diferido).
- Rediseños de layout: no reordenamos secciones ni cambiamos la jerarquía visual desktop; solo hacemos que lo existente colapse bien.
- Optimizar para <320px (ej. 280px). El piso es 320px (iPhone SE / Android chico).

## Decisions

### 1. Mobile-first preservando el valor desktop actual

Patrón: la clase base es la de **mobile**, y el valor **desktop actual** se reintroduce en el breakpoint correspondiente. Ejemplos:
- Padding global: `px-8 py-8` → `px-4 py-5 md:px-8 md:py-8`.
- Hero de cuenta: `text-[42px]` → `text-[28px] sm:text-[42px]`.
- Grid de cuotas: `grid-cols-3` → `grid-cols-1 sm:grid-cols-3` (o el que aplique).

**Por qué**: garantiza que el render desktop quede idéntico (el breakpoint reinyecta el valor previo) y minimiza el riesgo de regresión. Alternativa descartada: usar solo `clamp()` para tamaños de texto — útil para montos (lo usa el dashboard) pero no resuelve grids/padding/overflow, así que se usa `clamp()` donde ya está y breakpoints para el resto, sin migrar lo que ya funciona.

### 2. Breakpoint de referencia: `sm` (640px) para colapsos de contenido; `md`/`lg` para chrome

- Colapsos de contenido (heros, grids de datos, filas que apilan) usan `sm:` como umbral, consistente con `account-row` que ya usa ese patrón.
- El chrome del shell (sidebar vs drawer) ya usa `md:` y no se cambia.
- Columnas laterales que hoy se activan en `md:` y apretujan tablets (Tarjetas) se mueven a `lg:`.

**Por qué**: alinear con la convención ya presente en el código evita un tercer set de reglas y mantiene coherencia. La capa de contenido cabe cómoda recién pasando ~640px.

### 3. Overlays: clamp al viewport en el primitivo, no en cada consumidor

- `Drawer` ya clampa con `max-w-full` (correcto, se deja).
- `dropdown-menu` y `popover`/`date-picker` reciben un `maxWidth` efectivo de `min(valorDeseado, 100vw - margen)` para no desbordar en pantallas chicas. Se arregla en el primitivo para que todo consumidor herede el fix.
- El padding interno fijo de los forms dentro de drawers (`px-7`) pasa a responsive (`px-5 sm:px-7` o equivalente), porque se suma al chrome.

**Por qué**: arreglar en el primitivo evita repetir el clamp en cada uso y previene regresiones futuras. Alternativa descartada: tocar cada consumidor — más superficie, más olvidos.

### 4. Verificación por inspección a anchos objetivo

Se valida a 320px, 360px y 390px (mobile) y se re-chequea ≥768px (desktop sin regresión). Como no hay tests visuales automatizados, la verificación es manual con devtools responsive sobre las rutas tocadas, más `typecheck`/`lint` para no romper build.

**Por qué**: el repo no tiene visual regression; el costo de montarlo excede el de este barrido. Se documenta el set de anchos como criterio de aceptación en los scenarios de la spec.

### 5. Una capability transversal + un delta de shell

El contrato vive en `web-responsive-layout` (regla global + reglas por tipo de superficie: heros, overlays, grids densos). El padding de `<main>` se modela como delta de `web-app-shell` porque ese spec ya es dueño de la región de contenido. Los ajustes finos por componente (qué `text-[NN]px` exacto) son detalle de implementación y van en tasks.md, no en specs.

**Por qué**: evita fragmentar en 6 deltas (accounts, cards, shared, …) reglas que son la misma política de responsive aplicada en distintos lugares. La spec captura la política; tasks captura los sitios.

## Risks / Trade-offs

- **Regresión visual en desktop al introducir breakpoints** → Mitigación: patrón mobile-first que reinyecta el valor desktop exacto en el breakpoint; revisión a ≥768px de cada pantalla tocada.
- **Romper contratos que consume la card nativa** (capa compartida) → Mitigación: los cambios son de clases Tailwind en componentes web (`apps/web`), no en `packages/*` de contratos; donde un componente sea compartido, se cambia solo la presentación web.
- **Tamaños de texto que escalan podrían cambiar el alto del hero y reflowear** → Mitigación: ajustar `min-h` del hero junto con el texto donde haga falta; aceptamos cambios de alto en mobile (es el objetivo).
- **Inconsistencia si alguien agrega clases fijas nuevas después** → Mitigación: la spec deja el contrato escrito (sin overflow horizontal ≥320px) como criterio para futuros cambios y reviews.
- **Cobertura incompleta** (la auditoría pudo no ver todo) → Mitigación: la spec exige el contrato global; durante implementación se barre cada ruta a 360px y se agregan a tasks los sitios que aparezcan, en vez de limitar al listado inicial.
