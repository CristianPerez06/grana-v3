## Why

La ruta `/accounts` quedó atrás del lenguaje visual que ya usan el dashboard y las auth screens en web: la card de cada sección no tiene background explícito y muestra el gris del shell, los `AccountRow` mezclan dos tamaños de tipografía sin jerarquía clara, y la sección "Archivadas" depende solo de `opacity-70` para diferenciarse. El diseño actual de Paper (artboards `Cuentas — Desktop 1440` y `Cuentas — Web Mobile 390`) propone un patrón consistente con el resto de la app: card blanca (`bg-card`) sobre página gris (`bg-background`), header con `PageHeader`, secciones con etiqueta + count, filas con avatar tinted + nombre + institución + balances + acción inline, y badge "Archivada" pill en lugar de opacity global.

## What Changes

- `apps/web/app/(app)/accounts/page.tsx` empieza a usar `PageHeader` con `actions` (CTA "+ Nueva cuenta") en vez del header artesanal actual.
- `AccountSection` agrega `bg-card` explícito al contenedor de filas, refina el label de sección (caps + count en muted) y mantiene `divide-y` entre rows.
- `AccountRow` reordena el contenido: avatar 40px (`AccountAvatar` reutilizado), bloque nombre+institución a la izquierda, balances ARS/USD alineados a la derecha en columna, y la acción ("Editar" / "Reactivar") como link inline al final de la fila. Tipografía y tokens unificados con el resto de la app (`text-text`, `text-text-soft`, `text-positive`).
- Las cuentas archivadas dejan de depender de `opacity-70` global: la sección se renderiza con borde `dashed`, cada fila lleva un pill "Archivada" (`bg-warning-soft text-warning`) y muestra "Reactivar" como CTA inline en `text-positive`.
- `EmptyAccountsState` y `AccountsHint` se ajustan para usar los mismos tokens (`bg-card`, `border-border-soft`) y respetar el spacing del nuevo header.
- **Sin cambios** en `queries.ts`, `types.ts`, server actions, claves i18n ni en el contrato de `AccountAvatar` / `PageHeader`. Es 100% reskin de los componentes en `_components/`.
- **Fuera de alcance:** la versión mobile nativa (`apps/mobile`), las rutas `/accounts/new` y `/accounts/[id]/edit`, y el archive de las design-refs (queda para el cierre del change con `/opsx:archive`).

## Capabilities

### New Capabilities

<!-- Ninguna capability nueva: es un reskin de la UI de una capability existente. -->

### Modified Capabilities

- `accounts`: se modifica la requirement "El usuario puede ver la lista de sus cuentas agrupadas por tipo" para fijar el lenguaje visual de la pantalla (card blanca sobre fondo gris, header con `PageHeader`, secciones con label + count, badge "Archivada" como pill en vez de opacity global). No cambia ninguna otra requirement de `accounts` (creación, edición, archivado, balances, RLS, avatares, instituciones permanecen idénticos).

## Impact

- **Código (solo `apps/web`):**
  - `apps/web/app/(app)/accounts/page.tsx`: pasa a `PageHeader`.
  - `apps/web/app/(app)/accounts/_components/account-section.tsx`: agrega `bg-card`, refina label.
  - `apps/web/app/(app)/accounts/_components/account-row.tsx`: rediseño completo del row layout.
  - `apps/web/app/(app)/accounts/_components/empty-accounts-state.tsx`: tokens unificados.
  - `apps/web/app/(app)/accounts/_components/accounts-hint.tsx`: tokens unificados.
  - Posibles claves nuevas en `apps/web/messages/<locale>/accounts.json` para el badge "Archivada" y el count `{count} cuentas` si no existen ya.
- **Sin cambios** en base de datos, migraciones, server actions, queries, dependencias.
- **Design-refs:** `Cuentas — Desktop 1440` (MM-0) y `Cuentas — Web Mobile 390` (R5-0) del archivo Paper "Grana V3 — Desktop". Se versionarán bajo `design-refs/` en el cierre del change, cuando la cuota de Paper permita exportar PNG/SVG/JSX.
