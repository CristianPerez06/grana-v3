# Tareas — corregir la ruta de los primitivos mobile

Este change no toca código: los primitivos ya están en `apps/mobile/components/ui/`. Todas las tareas son sobre la spec y sobre verificar que el texto corregido coincide con el filesystem.

## 1. Deltas (hecho al proponer)

- [x] 1.1 Escribir el `## MODIFIED Requirements` de `repo-architecture` con el requirement "La paridad web↔mobile se sostiene por contratos de props compartidos" restatado completo.
- [x] 1.2 Confirmar por `diff` contra el spec maestro que el bloque `MODIFIED` difiere **sólo** en: la ruta de la cláusula de ubicación, la cláusula nueva de deslinde hacia `ui-foundations`, la ruta del scenario de `Button.tsx`, y el scenario nuevo de ubicación. Verificado: cero diferencias fuera de esas cuatro.

## 2. Verificación contra el repo

- [x] 2.1 Confirmar que `apps/mobile/components/ui/` contiene los primitivos (26 archivos, incluidos `Button.tsx` y `Card.tsx`).
- [x] 2.2 Confirmar que `apps/mobile/components/` NO contiene ningún `.tsx` suelto — sólo carpetas por feature más `ui/`. Es lo que hace que la corrección no tenga lectura alternativa.
- [x] 2.3 Confirmar que el archivo citado por el scenario corregido existe: `apps/mobile/components/ui/Button.tsx`.
- [x] 2.4 Grepear `apps/mobile/components/` en **todos** los specs maestros y confirmar que, después de este change, ninguna mención restante contradice a `ui-foundations`. Las menciones legítimas son las de componentes por feature (`apps/mobile/components/<feature>/`), que son correctas y no se tocan.
- [x] 2.5 `npx --yes @fission-ai/openspec@1.7.0 validate fix-mobile-primitives-path --strict` pasa con exit code 0.

## 3. Archivado (en la branch, antes del merge a `main`)

- [x] 3.1 Aplicar el delta al spec maestro de `repo-architecture`. El spec maestro NO debe quedar con secciones `## ADDED/MODIFIED/REMOVED/RENAMED`.
- [x] 3.2 Confirmar que `repo-architecture` sigue con 3 requirements (este change modifica uno, no agrega ni saca).
- [x] 3.3 Confirmar que `ui-foundations` quedó intacta — este change no la toca.
- [x] 3.4 Mover la carpeta a `openspec/changes/archive/YYYY-MM-DD-fix-mobile-primitives-path/`.
- [x] 3.5 `pnpm openspec:check` pasa. Correrlo de verdad y ver el exit code; si `pnpm` no resuelve en la shell, usar la ruta completa (`~/Library/pnpm/bin/pnpm`).
- [x] 3.6 `npx --yes @fission-ai/openspec@1.7.0 validate --specs --strict` pasa sobre los specs maestros ya sincronizados.
- [ ] 3.7 Confirmar en el PR que el job `OpenSpec validation` de CI pasa. Desde `enforce-openspec-gates-in-ci` es el gate real, no una formalidad local.

## 4. Coordinación

- [x] 4.1 Sin solapamiento: la única change activa es `cards-mobile-density`, que toca `cards`. Este change toca `repo-architecture`. No hace falta coordinar orden de merge.
- [x] 4.2 Marcar como saldada la deuda 3 registrada en `openspec/changes/archive/2026-08-02-split-project-conventions/tasks.md` (tareas 4.2 y 4.3), que difería esta corrección. La deuda restante de aquel change —los 4 solapamientos, la regla de admisión, la bimoneda desactualizada y el layout del monorepo— sigue pendiente y NO se toca acá.
