## 1. Split en `app-shell.tsx`

- [x] 1.1 En `apps/web/app/(app)/_components/app-shell.tsx`, separar el `<main>` actual en `<main className="flex-1 md:overflow-y-auto">` + `<div className="mx-auto w-full max-w-5xl px-8 py-8">{children}</div>`.
- [x] 1.2 Verificar que `<main>` queda sin clases `max-w-*`, `mx-auto`, `px-*` ni `py-*`.

## 2. Verificación visual

- [x] 2.1 Levantar `pnpm dev` y abrir `/dashboard` en un viewport ≥ 1440px con contenido largo. Confirmar que el scrollbar vertical aparece pegado al borde derecho del viewport, no al borde derecho del bloque centrado.
- [x] 2.2 Repetir la verificación en `/movimientos` (lista larga), `/cuentas` y `/tarjetas`. Confirmar que el contenido sigue capado a `max-w-5xl` y centrado igual que antes.
- [x] 2.3 Verificar en mobile (< 768px) que el comportamiento no se rompe: el `<main>` no tiene `overflow-y-auto` (solo aplica en `md:`), el body sigue siendo el que scrollea.
- [x] 2.4 Inspeccionar descendientes con `position: sticky` en dashboard (section headers) y en `/movimientos` (filtros, headers de tabla si los hay). Confirmar que siguen pegándose como antes.

## 3. Lint + typecheck

- [x] 3.1 `pnpm --filter web lint` sin errores nuevos.
- [x] 3.2 `pnpm --filter web typecheck` sin errores nuevos.

## 4. Commit + cierre

- [x] 4.1 Squash de la rama feature con un commit `fix(web): scrollbar pegado al viewport en (app) shell` (sin body, sin trailers).
- [x] 4.2 Dejar la rama lista para que el usuario haga el merge a `main` (no mergear ni pushear sin pedido explícito).
