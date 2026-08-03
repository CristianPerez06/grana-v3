# Tareas — enforzar los gates de OpenSpec en CI

Este change toca un solo archivo de código (`.github/workflows/ci.yml`) y un solo requirement (`project-conventions`). El grueso de la verificación es comprobar que el job realmente falla cuando debe — un gate que nunca se vio fallar no es un gate.

## 1. Deltas (hecho al proponer)

- [x] 1.1 Escribir el `## MODIFIED Requirements` de `project-conventions` con el requirement "El archive de una change ocurre en la branch antes del merge a main" restatado completo.
- [x] 1.2 Confirmar que el bloque `MODIFIED` difiere del original **sólo** en: la cláusula de gates, la línea del scenario "Branch lista para merge" que decía "corre localmente", y el scenario nuevo de rechazo por CI. Verificado por `diff`: cero diferencias fuera de esas tres.

## 2. Implementación

- [x] 2.1 Agregar el job `specs` a `.github/workflows/ci.yml`, con la misma forma que los cuatro existentes: `actions/checkout@v4`, `pnpm/action-setup@v4`, `actions/setup-node@v4` (node `'24'`, `cache: pnpm`), `pnpm install --frozen-lockfile`.
- [x] 2.2 Dentro del job, dos steps en este orden: `npx openspec validate --specs --strict` y `pnpm openspec:check`. El segundo NO se saltea si el primero falla — usar `if: always()` en el segundo para que un PR roto muestre ambos problemas en una sola corrida.
- [x] 2.3 Actualizar el comentario de cabecera de `ci.yml`, que enumera los jobs ("quality / web-build / web-test / monorepo-health"), para incluir `specs`. Si queda desactualizado, el archivo miente sobre sí mismo.

## 3. Verificación

- [x] 3.1 **Probar que el job falla cuando debe.** Localmente: introducir un `Purpose: TBD` temporal en un spec maestro y confirmar que `pnpm openspec:check` sale con exit code distinto de 0; después revertir. Un gate que sólo se vio pasar no está verificado.
- [x] 3.2 **Probar que el job falla ante un delta residual.** Localmente: pegar una sección `## ADDED Requirements` temporal en un spec maestro y confirmar que `npx openspec validate --specs --strict` falla; después revertir.
- [x] 3.3 Confirmar que ambos comandos pasan sobre el estado real del repo (`validate --specs --strict` da 29/29 hoy).
- [ ] 3.4 Confirmar en el PR de este mismo change que el job `specs` aparece como check, corre y pasa. Es la prueba de que la regla nueva es satisfacible por su propio archive.
- [x] 3.5 `npx openspec validate enforce-openspec-gates-in-ci --strict` pasa con exit code 0.

## 4. Archivado (en la branch, antes del merge a `main`)

- [x] 4.1 Aplicar el delta al spec maestro de `project-conventions`. El spec maestro NO debe quedar con secciones `## ADDED/MODIFIED/REMOVED/RENAMED`.
- [x] 4.2 Confirmar que `project-conventions` sigue con 10 requirements (este change modifica uno, no agrega ni saca).
- [x] 4.3 Mover la carpeta a `openspec/changes/archive/YYYY-MM-DD-enforce-openspec-gates-in-ci/`.
- [x] 4.4 `pnpm openspec:check` pasa. Si `pnpm` no resuelve en la shell, usar `npx pnpm@10 openspec:check` o la ruta completa — pero **correrlo de verdad** y no tildar esta casilla sin haber visto el exit code. Este change existe precisamente porque esa casilla se tildó una vez sin correrse.
- [x] 4.5 `npx openspec validate --specs --strict` pasa sobre los specs maestros ya sincronizados.

## 5. Seguimiento

- [ ] 5.1 **Agregar el check `specs` a las required status checks de la branch protection de `main`** en la configuración del repo en GitHub. Hasta que eso pase, el check se pone en rojo pero no bloquea el botón de merge. Es config de repo, no de código, y la hace el dueño del repo — queda registrada acá para que no se pierda como supuesto implícito.
- [x] 5.2 Pinear la versión de OpenSpec en CI. Resuelto durante el PR: el job usa `npx --yes @fission-ai/openspec@1.7.0`. El nombre corto `npx openspec` no sirve — resuelve a un stub v0.0.0 de npm y sólo parecía andar local por un install global. Ver `design.md` → Decisión 3.
