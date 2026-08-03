# Actualizar el requirement de layout del monorepo y sacarle el inventario

## Why

El requirement "El repo está organizado como monorepo pnpm con apps/ y packages/" describe un repo que ya no existe:

- Dice **"La app actual es `apps/web/`"** y trata a `apps/mobile/` como hipotética: *"apps futuras (p. ej. `apps/mobile/` cuando se haga el scaffold de la app móvil)"*. `apps/mobile/` existe hace meses, tiene su propio Expo config, sus 26 primitivos de UI y sus rutas.
- Enumera **cuatro** paquetes (`validation`, `i18n-messages`, `supabase`, `ui-tokens`) y los presenta como "los paquetes actuales". Hoy hay **catorce**.
- Deja `tsconfig.base.json` como condicional (*"si se usa una base compartida"*). Existe y se usa.

Es la **deuda 2** anotada por `split-project-conventions`, que se prohibió editar contenido y la difirió.

La causa importa más que los números. El requirement se desactualizó porque **inventaría** paquetes en prosa: una lista literal de nombres dentro de un texto normativo queda vieja en cuanto alguien agrega el paquete quince, y nada la obliga a actualizarse. Refrescar la lista de 4 a 14 arregla el síntoma y garantiza que dentro de unos meses estemos escribiendo esta misma change otra vez. Por eso la corrección también cambia la **forma** del requirement, no sólo sus datos.

## What Changes

- **`apps/` se describe con las dos apps que existen**: `apps/web/` (Next.js) y `apps/mobile/` (Expo). Desaparece el lenguaje de app futura y el "la app actual es".
- **Se elimina el inventario de paquetes.** En su lugar el requirement describe las tres familias que hoy existen —dominio/feature, cross-cutting, y design system— con ejemplos marcados **como ejemplos**, y declara que la lista autoritativa es el filesystem bajo `packages/` más los globs de `pnpm-workspace.yaml`. Un requirement no puede ser un índice de paquetes y mantenerse verdadero.
- **`tsconfig.base.json` pasa de condicional a parte de la raíz**, porque existe y se usa. Se agregan a la enumeración de la raíz los archivos meta que faltaban (`CLAUDE.md`, `pnpm-lock.yaml`).
- **Se agrega un scenario que ejerce la regla de no-inventario**: agregar un paquete nuevo no obliga a editar este requirement, siempre que respete el patrón. Es lo que convierte la decisión de forma en algo verificable.

Ninguna regla de comportamiento cambia. La frontera `apps/` vs `packages/`, la prohibición de código de producto en la raíz y el criterio de promoción a paquete quedan intactos: lo que se corrige es la descripción del estado del repo y la forma en que se enuncia.

No es **BREAKING**. Ningún código cambia; el repo ya tiene esta forma.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `repo-architecture`: cambia el requirement "El repo está organizado como monorepo pnpm con apps/ y packages/" — el estado de `apps/`, la descripción de `packages/` (de inventario a familias + fuente de verdad), la raíz, y un scenario nuevo.

## Impact

- **Código**: ninguno. No se toca `apps/`, `packages/`, `supabase/migrations/` ni tests.
- **Datos**: ninguno.
- **Specs**: 1 capability tocada (`repo-architecture`), 1 `MODIFIED`. Sigue con 3 requirements.
- **Riesgo**: bajo. Todo lo que se afirma es verificable contra el filesystem, y la parte de diseño (dejar de inventariar) reduce el riesgo futuro en vez de agregarlo.
- **Solapamiento con changes activas**: `dedupe-relocated-invariants` (PR abierto) toca `schema-base`, `transactions`, `cards` y `accounts`; `fix-mobile-primitives-path` ya está mergeada. Ninguna toca `repo-architecture` salvo esta. Sin conflicto.
