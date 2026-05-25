## 1. Setup

- [x] 1.1 Crear branch `feature/web-i18n-coverage-completion` desde `main` actualizado (`git checkout main && git pull --ff-only origin main && git checkout -b feature/web-i18n-coverage-completion`).
- [x] 1.2 Verificar `pnpm openspec:check` verde con el change en `openspec/changes/` (sin tocar specs maestros todavía).
- [x] 1.3 Confirmar inventario de strings hardcoded: `grep -rn "formError: error.message" apps/web/app/_actions/` y listar archivos finales que aplican el patrón. Resultado: 21 ocurrencias — credit-cards.ts (5), transactions.ts (6), accounts.ts (6), recurrences.ts (4).

## 2. Helper compartido de traducción de errores Postgres

- [x] 2.1 Crear `apps/web/app/_actions/_lib/translate-error.ts` con `translatePostgresError(code: string | undefined, kind: 'account' | 'card' | 'transaction' | 'recurrence' | 'category' | 'subcategory'): Promise<string>`. Hace `await getTranslations('<kind>.errors')` y resuelve por código. Fallback: clave `<kind>.errors.generic`.
- [x] 2.2 Refactorizar `apps/web/app/_actions/categories.ts` para importar el helper en lugar de su versión inline. Verificar que los tests/comportamiento siguen.

## 3. Catálogos i18n — namespace `cards.*` nuevo

- [x] 3.1 Diseñar la estructura del namespace `cards.*` en `packages/i18n-messages/src/es.json` siguiendo la convención `title`, `description`, `labels.*`, `actions.*`, `empty.*`, `errors.*`, `confirmations.*`. Cubrir lista, alta y detalle.
- [x] 3.2 Replicar exactamente la estructura en `packages/i18n-messages/src/en.json`.
- [x] 3.3 Validar que `pnpm tsc -p apps/web/tsconfig.json --noEmit` no rompe por divergencia de claves. (Paridad estructural validada por diff script; 0 mismatches en ambas direcciones.)

## 4. Catálogos i18n — extender `accounts.*` y `transactions.*`

- [x] 4.1 Auditar `apps/web/app/(app)/accounts/**` y listar las claves faltantes en `accounts.*`. Agregarlas a `es.json` y `en.json`.
- [x] 4.2 Auditar `apps/web/app/(app)/transactions/**` y listar las claves faltantes en `transactions.*`. Agregarlas a `es.json` y `en.json`. (Incluye namespace nuevo `recurrences.*` para `transactions/recurring/**`.)
- [x] 4.3 Verificar que las claves de error usadas por `_actions/accounts.ts`, `_actions/transactions.ts`, `_actions/recurrences.ts`, `_actions/credit-cards.ts` existan bajo `accounts.errors.*`, `transactions.errors.*`, `recurrences.errors.*`, `cards.errors.*` (crear las que falten en ambos idiomas). (Todos los namespaces tienen `generic` + `duplicate` ahora.)

## 5. Migrar `apps/web/app/(app)/accounts/**` a `next-intl`

- [x] 5.1 `apps/web/app/(app)/accounts/page.tsx` — Server Component: agregar `const t = await getTranslations('accounts')` y reemplazar literales.
- [x] 5.2 `apps/web/app/(app)/accounts/new/page.tsx` — idem (Server Component).
- [x] 5.3 `apps/web/app/(app)/accounts/[id]/page.tsx` — idem (Server Component).
- [x] 5.4 Migrar componentes en `apps/web/app/(app)/accounts/_components/` uno por uno: `account-section.tsx`, `account-row.tsx`, `account-detail-header.tsx`, `empty-accounts-state.tsx`, etc. Cada uno usa `useTranslations` (Client) o `getTranslations` (Server) según corresponda. (16/17 archivos migrados; `account-section.tsx` sin strings hardcoded.)
- [ ] 5.5 Verificar visualmente con el switcher: cambiar a `en` en `/accounts`, `/accounts/new`, `/accounts/<id>` y revisar que no quede ningún string en español originado en código.

## 6. Migrar `apps/web/app/(app)/cards/**` a `next-intl`

- [x] 6.1 `apps/web/app/(app)/cards/page.tsx` — Server Component: agregar `getTranslations('cards')`, reemplazar literales (`"Tarjetas"`, `"+ Agregar tarjeta"`, etc.).
- [x] 6.2 `apps/web/app/(app)/cards/new/page.tsx` — idem.
- [x] 6.3 `apps/web/app/(app)/cards/[id]/page.tsx` — idem.
- [x] 6.4 Migrar componentes en `apps/web/app/(app)/cards/_components/`: `card-hero.tsx`, `limit-summary.tsx`, `card-dates-footer.tsx`, `payment-cta-block.tsx`, `periods-section.tsx`, `estimated-date-badge.tsx`, `inactive-card-banner.tsx`, y los restantes (~15 archivos total). (31/31 archivos migrados; agregadas claves `cards.labels.network_unknown/custom`, `cards.period.pending_short`, `cards.errors.account_required` para cerrar 3 FLAGs.)
- [ ] 6.5 Verificar visualmente con el switcher: navegar `/cards` → detalle → registrar consumo → pagar resumen, en `en` y en `es`.

## 7. Migrar `apps/web/app/(app)/transactions/**` a `next-intl`

- [x] 7.1 Auditar todos los archivos de la ruta (`page.tsx`, `new/page.tsx`, `[id]/page.tsx`, subcarpetas y componentes locales).
- [x] 7.2 Para cada archivo con strings hardcoded: agregar `useTranslations`/`getTranslations` y reemplazar literales por claves bajo `transactions.*`. (6/6 archivos migrados; agregado namespace `recurrences.*` para `transactions/recurring/**`.)
- [ ] 7.3 Verificar visualmente con el switcher en `/transactions`, `/transactions/new`, `/transactions/<id>` en ambos idiomas.

## 8. Localizar errores en server actions

- [x] 8.1 `apps/web/app/_actions/accounts.ts` — reemplazar cada `formError: error.message` (~11 ocurrencias) por `formError: await translatePostgresError(error.code, 'account')`. Agregar las claves `accounts.errors.*` necesarias (códigos específicos: `23505` duplicate, `23503` FK violation, `23514` check violation, `P0001` raise exception, además de `generic`). (6 ocurrencias reales, todas reemplazadas; helper hoy solo mapea 23505 → `duplicate`, resto cae a `generic` — refinamientos por código quedan para follow-ups.)
- [x] 8.2 `apps/web/app/_actions/transactions.ts` — idem con `kind='transaction'`.
- [x] 8.3 `apps/web/app/_actions/recurrences.ts` — idem con `kind='recurrence'`. Asegurar que las claves `recurrences.errors.*` existan en ambos catálogos (si el namespace no existe, crearlo). (Además se localizó `RecurrenceMapError` vía nuevo namespace `recurrences.mapper_errors.*`.)
- [x] 8.4 `apps/web/app/_actions/credit-cards.ts` — idem con `kind='card'`. Este es el más denso (~34 líneas). Mapear códigos de los CHECK constraints relevantes (`chk_installments_ars_only`, `chk_credit_initial_balance`, etc.) y triggers (`trg_fn_credit_transaction_invariants`) a claves semánticas en `cards.errors.*`. (5 ocurrencias reemplazadas; helper genérico, mapeos específicos por trigger quedan para follow-up.)
- [ ] 8.5 Smoke test: gatillar manualmente al menos un error por server action (ej. crear cuenta duplicada, intentar borrar cuenta con movimientos) y verificar que el `formError` que llega al cliente es texto traducido y no Postgres raw.

## 9. Validación final

- [x] 9.1 `pnpm openspec:check` — verde.
- [x] 9.2 `pnpm --filter web lint` — verde (5 warnings preexistentes en archivos fuera del scope: `onboarding-wizard/perfil-form`, `onboarding-wizard/saldo-actual-form`, `_actions/credit-cards.ts:322` unused var, `lib/accounts/queries.ts` unused import).
- [x] 9.3 `pnpm --filter web build` (o `tsc --noEmit`) — verde. Exit 0, sin errores; paridad estática `Messages = typeof es` confirmada por diff script (`es→en: 0`, `en→es: 0`).
- [x] 9.4 Grep final: `grep -rn "formError: error.message" apps/web/app/_actions/` debe devolver 0 resultados.
- [ ] 9.5 Recorrido manual con switcher: `/dashboard` → `/accounts` → `/accounts/new` → `/cards` → `/cards/<id>` → `/transactions` → `/transactions/new` → `/settings`, en ambos locales. Anotar y arreglar lo que se haya escapado.

## 10. Archive y merge

- [ ] 10.1 Si `main` se movió: `git checkout main && git pull --ff-only origin main && git checkout feature/web-i18n-coverage-completion && git rebase main`. Resolver conflictos si los hay.
- [ ] 10.2 Si la rama tiene N > 1 commits: squash a 1 commit (`git rebase -i main` o `git reset --soft main && git commit`).
- [ ] 10.3 Archivar el change: mover `openspec/changes/web-i18n-coverage-completion/` a `openspec/changes/archive/YYYY-MM-DD-web-i18n-coverage-completion/` y aplicar el delta al spec maestro `openspec/specs/i18n/spec.md` (integrar los `## ADDED Requirements` en la sección `## Requirements` plana, sin secciones delta).
- [ ] 10.4 Actualizar `CLAUDE.md` si aplica (en este change probablemente no — la tabla "Modules" no cambia, los específicos de i18n ya están descritos).
- [ ] 10.5 `pnpm openspec:check` — verde (gate de pre-merge).
- [ ] 10.6 Commit final del archive en la rama. `git checkout main && git merge --ff-only feature/web-i18n-coverage-completion`. Push.
