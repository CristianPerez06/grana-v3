## Context

`apps/web/app/(app)/accounts/page.tsx` y sus `_components/` se construyeron antes de que el resto del producto consolidara el lenguaje "card blanca sobre fondo gris" del shell de `(app)`. Como resultado, la pantalla queda visualmente "vacía": las secciones tienen `border border-border rounded-lg` pero sin background, así que se ve el `bg-background` (gris `#F6F7F9`) del shell a través del card; el header se arma a mano con un `<div>` + CTA en vez de usar `PageHeader`; y la sección de archivadas depende solo de `opacity-70` para diferenciarse, lo cual reduce contraste de todo el texto, no solo del estado.

En Paper ya existen los artboards `Cuentas — Desktop 1440` (MM-0) y `Cuentas — Web Mobile 390` (R5-0), con la dirección visual aprobada por el usuario el 2026-05-31: card blanca sobre `bg-background`, label de sección en caps + count en muted, filas con avatar + nombre/institución a la izquierda y balances + acción a la derecha, badge "Archivada" como pill en vez de opacity global.

Stakeholders: el usuario (decisión visual ya tomada). Tokens disponibles: `bg-card`, `bg-background`, `border-border-soft`, `text-text`, `text-text-soft`, `text-positive`, `text-warning`, `bg-warning-soft`, `bg-positive` — todos en `@grana/ui-tokens/theme.css`.

## Goals / Non-Goals

**Goals:**
- Que la página `/accounts` use el mismo lenguaje visual que el dashboard y el resto del shell de `(app)`: card blanca explícita (`bg-card`) sobre `bg-background`, sin "fondos fantasma".
- Reusar `PageHeader` y `AccountAvatar` sin cambiar sus contratos.
- Separar el estado archivado del estado activo a nivel visual sin sacrificar legibilidad (pill + borde dashed en vez de `opacity-70` global).
- Mantener la paridad funcional 1:1 con el código actual (mismas acciones, mismas queries, mismos i18n keys donde sea posible).

**Non-Goals:**
- No se cambia `AccountAvatar` ni `resolveAccountAvatar`. Se acepta su visual canónico (background del color resuelto + glyph blanco) aunque difiera de los avatares "tinted bg + icono dark" que usé en el mock de Paper. La consistencia con el resto del producto pesa más que el mock.
- No se tocan las rutas `/accounts/new` ni `/accounts/[id]/edit` (formularios).
- No se rediseña la app mobile nativa.
- No se cambian queries, server actions ni tipos.
- No se renombra ni reorganiza el árbol de archivos (`_components/` queda igual).

## Decisions

### 1. `PageHeader` para el header en vez de div manual

**Decisión:** reemplazar el header artesanal de `page.tsx` por el componente `PageHeader` (ya usado en otras rutas) con `title={t('title')}` y `actions={<Link href="/accounts/new" ...>+ Nueva cuenta</Link>}`.

**Por qué:** unifica el header con dashboard, settings, transactions, etc. Reduce duplicación de tipografía y spacing. El componente ya soporta `actions`.

**Alternativa considerada:** mantener el header manual con la nueva tipografía. Descartada — la consistencia entre rutas es exactamente la motivación de este change.

### 2. `bg-card` explícito en `AccountSection`

**Decisión:** agregar `bg-card` al contenedor de filas. El borde queda `border-border-soft` (más sutil que el actual `border-border`) y `rounded-2xl` (en vez de `rounded-lg`) para alinear con el patrón de cards del dashboard.

**Por qué:** sin background explícito el card se confunde con `bg-background`. Esto fue exactamente lo que motivó el feedback del usuario.

**Alternativa considerada:** cambiar el `bg-background` del shell para que sea más claro y deje resaltar al card transparente. Descartada — modificar el shell global por una sola pantalla rompería el resto.

### 3. Badge "Archivada" + borde dashed en lugar de `opacity-70`

**Decisión:** la sección Archivadas pierde `opacity-70`. En su lugar: el card usa `border-dashed` y cada fila lleva un pill `bg-warning-soft text-warning` con el texto "Archivada". La acción inline cambia de "Editar" a "Reactivar" en `text-positive`.

**Por qué:** `opacity-70` afecta también al texto crítico (nombre, fecha de archivo) reduciendo legibilidad. Un pill + borde dashed señalan el estado sin degradar contraste.

**Alternativa considerada:** mantener `opacity-70` solo en el avatar/balances. Descartada por inconsistencia interna del card.

### 4. Layout de fila: avatar + meta + balances + action en columnas alineadas

**Decisión:** cada `AccountRow` usa flex con columnas explícitas y `flex-shrink: 0` en los slots fijos (avatar 40px, action 64px) para mantener "rieles" verticales consistentes a lo largo de todas las filas, sin importar el largo del nombre o de la institución. Balances en columna alineados a la derecha: ARS en `text-text` semibold, USD en `text-text-soft` regular.

**Por qué:** la guía de Paper enfatiza vertical lane alignment en filas repetidas; sin slots fijos las acciones se desalinean entre filas con nombres largos vs cortos. Replica el patrón ya consolidado en filas de transactions y upcoming.

### 5. `AccountAvatar` size `sm` se mantiene, pero la fila crece a 56px de alto efectivo

**Decisión:** no cambiar `size` de `AccountAvatar` (sigue `sm`, 32px en el código actual — pero el mock de Paper usa 40px). Si el size `sm` (h-8) queda visualmente chico en el nuevo layout, evaluamos pasar a `md` (h-11) en la implementación. Esta micro-decisión se cierra al ver el resultado en runtime, no a priori.

**Por qué:** el avatar es el componente más cargado de identidad por cuenta (color + ícono); su size impacta toda la jerarquía. Preferimos tunearlo viendo el render real.

## Risks / Trade-offs

- **[Riesgo: divergencia visual entre mock de Paper y código real]** El avatar en Paper tiene bg tinted + icono dark; el `AccountAvatar` real tiene bg sólido + glyph blanco. → **Mitigación:** seguir el `AccountAvatar` real (decisión §2 Non-Goals). Actualizar el mock de Paper al volver la cuota para mantener honestidad documental.
- **[Riesgo: el badge "Archivada" requiere copy i18n nuevo si no existe]** → **Mitigación:** revisar `apps/web/messages/<locale>/accounts.json`; si la key `badges.archived` ya está usada en el código actual (`account-row.tsx` línea 45), reusar.
- **[Riesgo: el visual nuevo se ve "vacío" si el usuario no tiene cuentas bank ni archivadas]** → **Mitigación:** `EmptyAccountsState` ya cubre el caso 0 cuentas; las secciones de tipo vacío se siguen omitiendo (requirement existente). No hace falta caso adicional.
- **[Trade-off: tipografía/spacing nuevo puede romper expectativa de tests E2E de altura/posición]** No hay tests E2E para `/accounts` por ahora; si se agregan post-merge, deben tomar la nueva geometría como baseline.
