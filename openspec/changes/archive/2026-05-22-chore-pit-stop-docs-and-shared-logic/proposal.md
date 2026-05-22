## Why

Grana V3 se autoimpone que "el repo es la memoria del producto" y que una IA fresca, sin contexto de chat, pueda continuar el trabajo. Una auditoría rápida muestra que el código avanza bien (auth, schema-base, categories, accounts, transactions, cards, recurring-movements, dashboard, onboarding, mobile-app-shell ya implementados) pero la memoria del repo se quedó atrás:

- 10 de 14 specs en `openspec/specs/` tienen `Purpose: TBD - created by archiving change ...`, una tarea post-archivado que nunca se completó: `auth`, `card-networks`, `cards`, `dashboard`, `i18n`, `mobile-app-shell`, `profiles`, `project-conventions`, `transactions`. Además `settings` tiene Purpose real pero contenido pobre (49 líneas, 2 requirements vs el código real que existe).
- La tabla "Modules" de `CLAUDE.md` está congelada en un snapshot anterior: marca `cards` como `🚧 In progress` cuando está completo, no menciona `dashboard`, `settings`, `mobile-app-shell`, `profiles`, `i18n`, `card-networks`, `recurring-movements` ni `onboarding`.
- `apps/mobile/` ya está scaffolded y con varias features (auth, onboarding, dashboard), pero `CLAUDE.md` declara "apps/mobile is reserved ... do not create it here". `README.md` y `SUPABASE_SETUP.md` tampoco lo mencionan.
- Ningún package en `packages/` tiene README ni descripción funcional en `index.ts`. (Esta queda fuera de scope de este pit-stop y va a P1, pero se nombra para que el inventario quede explícito.)
- Dos changes implementadas al 100% (`add-onboarding-post-signup`, `add-onboarding-mobile`) viven en `openspec/changes/` sin archivar.
- Hay un bug financiero real: `new Date().toISOString()` se usa como fecha contable en `apps/web/app/_actions/recurrences.ts:276,344` y `apps/web/app/_actions/onboarding.ts:151`, violando la regla de "Accounting dates + financial timezone" de `CLAUDE.md`. Entre las 21:00 y la medianoche AR el sistema escribe la fecha del día siguiente.

Encima, el próximo paso del proyecto es llevar todas las features al app mobile. Hoy mobile reimplementa primitivos UI por separado (sin contrato compartido) y la lógica pura de balance/períodos/recurrencias vive en `apps/web/lib/`, no en `packages/`. Si mobile empieza a registrar gastos, pagar resúmenes y mostrar balances sin haber consolidado eso antes, la duplicación se vuelve cara y aparecen diferencias de cálculo entre plataformas.

Este pit-stop nivela la memoria del repo con la realidad del código, ataca de raíz el hábito roto (definiendo el workflow de archivado y un check automático), arregla el bug financiero y prepara el terreno arquitectónico para el trabajo mobile.

## What Changes

- Agregar a `CLAUDE.md` una sección "OpenSpec — workflow obligatorio" que define:
  - Que el archive de una change se hace **dentro de la misma branch, como último commit, antes del merge `--ff-only` a `main`**. No después.
  - El checklist post-archivado: actualizar `Purpose` del spec maestro (reemplazar el placeholder `TBD - created by archiving ...`), aplicar los deltas al spec plano, actualizar `CLAUDE.md` "Modules" y "Repo Layout" si corresponde, correr `pnpm openspec:check`.
  - El check pre-change-nueva: verificar que no haya otra change activa tocando la misma capability.
- Agregar al `package.json` raíz el script `openspec:check` que falla si encuentra `TBD - created by archiving` o `Purpose: TBD` en `openspec/specs/`. Documentar en CLAUDE.md que debe correr antes de cualquier merge a `main`.
- Archivar las dos changes terminadas siguiendo el nuevo checklist:
  - `add-onboarding-post-signup`
  - `add-onboarding-mobile` (en este orden, por su dependencia documentada)
- Completar el `Purpose` real (2-4 líneas) en los 10 specs con `TBD` listados arriba, y completar el contenido pobre de `openspec/specs/settings/spec.md` a partir del código existente en `apps/web/app/(app)/settings/`.
- Actualizar `CLAUDE.md`:
  - Sección "Repo Layout": incluir `apps/mobile/` y `packages/dashboard/`. Eliminar la frase "apps/mobile is reserved ... do not create it here".
  - Sección "Modules": cambiar `cards` de `🚧` a completo. Agregar filas para `dashboard`, `settings`, `mobile-app-shell`, `profiles`, `i18n`, `card-networks`, `recurring-movements`, `onboarding`. Reordenar por dependencia.
  - Sección nueva o adyacente: documentar la política web↔mobile ("dos implementaciones paralelas con API idéntica garantizada por contratos de props").
- Actualizar `README.md` y `SUPABASE_SETUP.md` para reflejar la existencia de `apps/mobile`.
- Reemplazar `new Date().toISOString()` por `formatDateISO(getTodayAR())` en `apps/web/app/_actions/recurrences.ts:276,344` y `apps/web/app/_actions/onboarding.ts:151`. Agregar un test con `vi.setSystemTime` en la ventana 21:00–02:59 UTC del día siguiente que verifique que la fecha contable se escribe correctamente.
- Crear el package `@grana/ui-contracts` con tipos de props compartidos para los 8 primitivos UI actuales (`Button`, `Card`, `Input`, `Label`, `Alert`, `Spinner`, `FormField`, `PasswordField`). `apps/web/components/ui/` y `apps/mobile/components/` consumen esos tipos. Las implementaciones quedan como están.
- Crear el package `@grana/money-logic` (nombre tentativo) con la lógica **pura** de cálculo hoy en `apps/web/lib/transactions/balance.ts`, `apps/web/lib/cards/queries.ts` (cálculos puros, no queries de Supabase) y utilidades de `apps/web/lib/recurrences/`. Web sigue funcionando importándolas desde el package; mobile queda listo para reutilizarlas.

Quedan **fuera de scope** de este pit-stop (van a P1 o posterior):

- README de cada package y descripción funcional en cada `index.ts`.
- Tests de invariantes contables generales (`disponible ≥ 0`, off-ledger credit, ordering ASC vs DESC).
- Story de `MoneyAmountInput`.
- Deduplicación de `normalizeActionMoney` (a `@grana/validation`).
- Split de `apps/web/app/_actions/credit-cards.ts` (1026 líneas).
- Lint/test que verifique paridad de props entre web y mobile en runtime.
- Renombrar `getTodayAR()` a un helper multi-timezone parametrizado. La columna `profiles.financial_timezone` ya existe (migración 0012); la transición se hace en una change dedicada cuando se introduzca el soporte multi-tz.

## Capabilities

### Modified Capabilities

- `project-conventions`: Se agregan dos requirements nuevos: (1) el workflow obligatorio de openspec (archive en la branch antes del merge a `main`, checklist post-archivado, check automático con `pnpm openspec:check`) y (2) la política de implementaciones paralelas web↔mobile con API idéntica vía `@grana/ui-contracts`. No se modifican ni se eliminan requirements existentes.

## Impact

- **Specs afectados:** `project-conventions` recibe dos requirements nuevos. El resto de los specs maestros solo recibe un `Purpose` real en reemplazo del placeholder; no se modifica su contenido funcional.
- **Código afectado:** `CLAUDE.md`, `README.md`, `SUPABASE_SETUP.md`, `package.json` raíz, `apps/web/app/_actions/recurrences.ts`, `apps/web/app/_actions/onboarding.ts`, todos los componentes de `apps/web/components/ui/` y `apps/mobile/components/` (solo la firma de props, no la implementación), nuevos packages `@grana/ui-contracts` y `@grana/money-logic`, configs `transpilePackages` y `paths`.
- **Workflow afectado:** el comando `pnpm openspec:check` se vuelve obligatorio antes de cualquier merge a `main`. El archive se mueve del "después del merge" al "último commit de la branch antes del merge".
- **Sin impacto de DB:** no hay migraciones ni cambios de schema.
- **Sin impacto de UX:** las implementaciones de los componentes UI no cambian, solo se atan a tipos compartidos.
