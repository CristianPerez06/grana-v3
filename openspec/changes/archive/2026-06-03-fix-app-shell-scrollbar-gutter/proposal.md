## Why

En todas las rutas de `apps/web/(app)/` la barra de scroll vertical aparece pegada al borde derecho del contenido (`max-w-5xl`) en vez de al borde derecho del viewport. Esto pasa porque el mismo elemento `<main>` cumple dos roles: es el contenedor scrolleable (`overflow-y-auto`) **y** es el bloque que limita el ancho del contenido (`mx-auto w-full max-w-5xl px-8`). El scrollbar se pinta en el borde derecho del elemento que scrollea, así que queda dentro del ancho capado y deja una franja muerta entre el scrollbar y el borde derecho del viewport. Visualmente el resultado se percibe como un layout roto en monitores anchos.

## What Changes

- Separar el **viewport de scroll** del **contenedor de ancho** en el shell autenticado: `<main>` queda full-width y dueño del `overflow-y-auto`; un `<div>` hijo se encarga de `mx-auto w-full max-w-5xl px-8 py-8`.
- El scrollbar vertical SHALL aparecer pegado al borde derecho del viewport en todas las rutas `(app)/*` cuando el contenido supera el alto disponible.
- Actualizar la spec `web-app-shell` para explicitar la separación: el viewport scrolleable es full-width; el cap de ancho del contenido vive en un hijo dentro de `<main>`.

No hay cambios visuales en el ancho ni el centrado del contenido. No hay cambios en sidebar, drawer mobile, topbar mobile, ni en el comportamiento del overflow del body.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `web-app-shell`: el requirement "El `<main>` es el contenedor scrollable; el body no scrollea" se extiende para precisar que `<main>` SHALL ser full-width y que el cap de ancho (`max-w-5xl`) + padding horizontal viven en un hijo dentro de `<main>`, no en `<main>` mismo. Se agrega un scenario nuevo que cubre la posición del scrollbar respecto al viewport.

## Impact

- **Código afectado**: `apps/web/app/(app)/_components/app-shell.tsx` (un solo elemento `<main>` se parte en `<main>` + `<div>` interior).
- **APIs / contratos**: ninguno.
- **Dependencias**: ninguna.
- **Riesgos**:
  - Descendientes con `position: sticky` dentro de rutas `(app)/*` siguen quedando dentro del subárbol del `<main>` scrolleable, así que el sticking se preserva. A verificar a ojo en dashboard y en listas de movimientos.
  - El gutter horizontal antes ocupado por el scrollbar (entre `max-w-5xl` y viewport) ahora puede recibir el scrollbar pintado por encima en navegadores con scrollbar clásica (Windows). En macOS / overlay scrollbars no cambia nada perceptible.
