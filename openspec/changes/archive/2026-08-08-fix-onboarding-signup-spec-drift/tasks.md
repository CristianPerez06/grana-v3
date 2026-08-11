# Tareas — corregir el drift de signup y onboarding

Este change no toca código: corrige lo que dos specs afirman sobre un flujo que ya funciona así. La verificación es contra el filesystem, las migraciones y las changes archivadas.

## 1. Deltas (hecho al proponer)

- [x] 1.1 Escribir el `MODIFIED` de `onboarding` ("Bimoneda por defecto") con el requirement restatado completo.
- [x] 1.2 Escribir el `MODIFIED` de `accounts` ("Cuenta Efectivo por defecto en el signup") con el requirement restatado completo.
- [x] 1.3 Confirmar por `diff` que cada bloque difiere de su original sólo en lo declarado en el `proposal.md`.

## 2. Verificación contra el repo

- [x] 2.1 Las rutas reales del wizard son `welcome`, `initial-balance` y `done` (web bajo `(onboarding-wizard)/`, mobile bajo `(onboarding)/`). No existen `perfil` ni `saldo-actual`.
- [x] 2.2 El wizard NO crea cuentas: `initial-balance` lee la cuenta default existente y actualiza su `initial_balance`.
- [x] 2.3 Los modos de usuario no existen: change archivada `2026-05-27-remove-user-modes`, sin referencias en código.
- [x] 2.4 `settings` no tiene toggle de ocultar USD; sólo la preferencia "Mostrar centavos".
- [x] 2.5 `accounts` dice que las cuentas creadas por el usuario llevan "una o más" monedas, lo que confirma que la garantía de ambas es del trigger.
- [x] 2.6 La migración `0012_profiles_onboarding_and_default_account.sql` renombra la cuenta default a `Billetera` (reemplazo de la función del trigger + backfill), superando a la `0007`.
- [x] 2.7 Confirmar que los usos de "Efectivo" que quedan en `accounts` (tipo de cuenta, rótulo de sección en listados) NO se tocan, y que ninguna otra spec queda afirmando que la cuenta default se llama `Efectivo`.
- [x] 2.8 `npx --yes @fission-ai/openspec@1.7.0 validate fix-onboarding-signup-spec-drift --strict` pasa con exit code 0.

## 3. Archivado (en la branch, antes del merge a `main`)

- [x] 3.1 Aplicar los deltas a `onboarding` y `accounts`, sin dejar secciones `## ADDED/MODIFIED/REMOVED/RENAMED`.
- [x] 3.2 Confirmar los conteos sin cambios: `onboarding` 6, `accounts` 29.
- [x] 3.3 Confirmar que no queda ninguna mención a `/onboarding/perfil`, `/onboarding/saldo-actual` ni "según el modo" en los specs maestros.
- [x] 3.4 Mover la carpeta a `openspec/changes/archive/YYYY-MM-DD-fix-onboarding-signup-spec-drift/`.
- [x] 3.5 `pnpm openspec:check` pasa. Correrlo de verdad y ver el exit code.
- [x] 3.6 `npx --yes @fission-ai/openspec@1.7.0 validate --specs --strict` pasa sobre los specs maestros sincronizados.
- [x] 3.7 Confirmar en el PR que el job `OpenSpec validation` de CI pasa.

## 4. Seguimiento

- [x] 4.1 Marcar la deuda 1 como saldada en `openspec/changes/archive/2026-08-02-split-project-conventions/tasks.md`. Con eso queda saldada **toda** la deuda que dejó aquel change.
- [ ] 4.2 Registrar como seguimiento los **renames de títulos** que esta change no pudo hacer, todos por la misma restricción de la herramienta: `openspec archive` aborta si un bloque `MODIFIED` no repite exactamente los títulos de scenario del spec maestro, y `REMOVED` + `ADDED` del mismo título está prohibido por el validador. Los cuerpos quedaron correctos; los títulos arrastran nombres viejos:
  - `accounts` → requirement "Cuenta Efectivo por defecto en el signup" → debería ser "Cuenta Billetera…".
  - `auth` → scenario "Usuario sin sesión accede a /onboarding/perfil (web)" → debería nombrar una ruta que exista.
  - `onboarding` → scenario "Cuenta bancaria creada en onboarding tiene ambas monedas" → su cuerpo hoy afirma lo contrario (que ese alta no existe); el título quedó como pregunta que el scenario responde por la negativa.
  Hacerlos cuando otra change ya justifique reescribir esos requirements, o resolverlos juntos en una change de renames.
- [ ] 4.3 **Limitación aprendida, para la próxima**: un scenario no se puede eliminar de un requirement que se conserva. Si un scenario describe un paso inexistente, las salidas son (a) reescribir su cuerpo conservando el título, como se hizo acá, o (b) renombrar el requirement entero vía `REMOVED` + `ADDED` con títulos distintos. No existe una operación de "quitar scenario".
