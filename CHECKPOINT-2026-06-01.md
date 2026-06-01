# 🟡 Checkpoint grana-v3 — AMARILLO

**Fecha:** 2026-06-01
**Alcance:** repo completo
**Branch al auditar:** `main` (limpio, salvo `CHECKPOINT-2026-05-26.md` sin trackear)
**Cambio activo en curso:** `redesign-movement-form-as-drawer` (web avanzado; mobile/i18n/extracción/QA/archive pendientes)

---

## ✅ Estado al cierre (actualizado 2026-06-01)

Todos los **P0 + P1** de este checkpoint se resolvieron y mergearon a `main`. El registro formal vive en las changes OpenSpec archivadas; este doc queda como bitácora del barrido.

| Item | Estado | Dónde |
|---|---|---|
| P0 — borrado de categoría/subcategoría en uso | ✅ Resuelto | DB `ON DELETE RESTRICT` (mig. `0026`) + guards web/mobile sobre `transactions`/`recurrences`/`recurrence_instances`, incluyendo subcategorías hijas al borrar la padre. Change `archive/2026-06-01-restrict-category-in-use-deletes`. Migración aplicada en Supabase. |
| P1 — `reset-onboarding.sql` (`mode`) | ✅ Resuelto | misma change |
| P1 — `id DESC` en ordering | ✅ Resuelto | `shared/queries.ts` + `transactions/queries.ts` |
| P1 — `transactions/spec.md` ASC→DESC | ✅ Resuelto | misma change |
| P1 — sync delta `redesign-movement-form-as-drawer` | ✅ Resuelto | delta sincronizado (fila → detalle → drawer) |
| Smoke manual del borrado | ⬜ Pendiente | la lógica compila y la migración está aplicada; falta probar a mano borrar con/sin uso |
| P2 (todos) | ⬜ Pendientes | ver "Plan de acción" abajo |

**Trabajo extra hecho fuera del plan original del checkpoint** (mergeado a `main`):
- Pickers de ícono y color en alta/edición de categorías — change `archive/2026-06-01-category-icon-color-pickers`.
- Subcategorías propias gestionables bajo categorías del sistema (alineado con el spec) — change `archive/2026-06-01-subcategories-under-system-categories`.

---

## Verificaciones ejecutadas

| Verificación | Resultado |
|---|---|
| Web typecheck | ✅ exit 0 |
| Mobile typecheck | ✅ exit 0 |
| Web tests | ✅ 326 tests / 31 archivos |
| Dashboard package tests | ✅ 21 tests (corren por separado — ver M3) |
| Web lint / build | ✅ |
| Mobile lint | ✅ 0 errores, 2 warnings menores |
| Higiene de specs | ✅ sin `Purpose: TBD` ni deltas a col 0 en masters |

> Nota: este checkpoint combina el barrido inicial (3 agentes Explore + verificaciones propias) con la lectura profunda de Codex, que cazó dos bugs reales que el barrido inicial no detectó. Cada hallazgo abajo fue **confirmado en el thread principal** abriendo el call-site y el tipo de columna destino.

---

## Hallazgos prioritarios

### 🔴 P0 — Alta: borrar una subcategoría usada destruye clasificación histórica

`deleteSubcategory` hace un `.delete()` duro y arrastra un TODO fósil de cuando aún no existía el módulo transactions:

- `apps/web/app/_actions/categories.ts:255-270` — `// TODO: when transactions module is added, check for associated transactions here.` (el módulo ya existe; el TODO nunca se resolvió).
- `supabase/migrations/0008_transactions.sql:18` — la FK es `subcategory_id ... on delete set null`.

**Efecto:** borrar una subcategoría usada **nullea `subcategory_id` en todos los movimientos históricos** sin aviso → se pierde la clasificación. Viola el pilar de **confianza contable** y la spec, que exige archivar:

- `openspec/specs/categories/spec.md:135-140` — "Las mismas reglas de archivar/eliminar que aplican a categorías aplican a subcategorías".

Las categorías **padre** no se borran (FK `on delete restrict`, `0008_transactions.sql:17`), pero devuelven un error genérico en vez de sugerir archivar.

**Fix:** cuando hay movimientos asociados, archivar (`is_active = false`) en vez de borrar; o bloquear con mensaje "archivá en lugar de borrar". Aplicar el mismo trato al error de RESTRICT del padre.

---

### 🔴 P1 — Alta: el helper SQL de reset de onboarding ya no funciona

- `supabase/scripts/reset-onboarding.sql:29` — hace `SET ... mode = 'novato'`.
- `supabase/migrations/0019_drop_profiles_mode.sql:13` — la columna `mode` fue dropeada.

**Efecto:** pegado en el SQL Editor de Supabase, el bloque `DO $$` falla entero. Helper de dev, pero inservible y engañoso para una IA fresca.

**Fix:** quitar la línea de `mode` (y el comentario §2 que lo menciona).

---

### 🟡 P1 — Media: orden no totalmente determinístico

Dos queries ordenan `date DESC, created_at DESC` y **omiten `id DESC`** como desempate final:

- `apps/web/lib/shared/queries.ts:282`
- `apps/web/lib/transactions/queries.ts:110` (`getTransactions()`, hoy sin consumidores activos, pero igual a corregir).

La convención exige el `id` como tiebreaker (`openspec/specs/project-conventions/spec.md`, requirement de ordering display = `date DESC, created_at DESC, id DESC`).

**Efecto:** dos movimientos con igual `created_at` pueden alternar posición entre renders.

**Fix:** agregar `.order('id', { ascending: false })` a ambas.

---

### 🟡 P1 — Media: una spec maestra contradice la convención vigente

- `openspec/specs/transactions/spec.md:985` — exige `date ASC, created_at ASC, id ASC` para **"todas las queries de listados de movimientos"**.
- `openspec/specs/project-conventions/spec.md` — la regla correcta: **cálculo ASC, display DESC**.

Los listados mostrados al usuario son display → deben ser DESC. La spec de transactions está mal redactada en ese requirement.

**Fix:** corregir el requirement para distinguir cálculo (ASC) de display (DESC), o referenciar la regla de `project-conventions`.

---

### 🟡 P1 — Media: el delta OpenSpec activo quedó atrás de la decisión implementada

- `openspec/changes/redesign-movement-form-as-drawer/specs/.../spec.md:18` — exige editar desde la fila.
- `openspec/changes/redesign-movement-form-as-drawer/tasks.md` (tarea 1.3) — registra la decisión posterior correcta: **fila → detalle → editar en drawer** (la página `/edit` queda como fallback).

**Fix:** sincronizar la spec del delta con la decisión antes del archive del cambio.

---

### 🟡 P2 — Media: `pnpm test` raíz no incluye tests de packages

- `package.json:14` — `"test": "pnpm --filter web test"`.
- `apps/web/vitest.config.ts:7` — `include: ['lib/**/__tests__/**/*.test.ts']`.

**Efecto:** los 21 tests de `@grana/dashboard` quedan fuera del comando raíz (pasan al correrlos por separado). El comando de CI/dev no es la verdad completa.

**Fix:** runner de workspace (`pnpm -r test`) o agregar packages al scope.

---

### 🟡 P2 — Media: `openspec:check` no es portable a Windows

- `package.json:23` — depende de `grep -rE` y sintaxis shell Unix.

**Efecto:** en Windows el gate de merge que AGENTS.md declara **obligatorio** no corre tal cual (falla con error de shell, no de specs).

**Fix:** migrar el check a un script Node portable.

---

## Deuda menor (P2 / informativa)

- Documentación fósil sobre `novato`/`experto` (el flag se eliminó): `SUPABASE_SETUP.md:450`, `packages/validation/README.md:20`.
- `AGENTS.md:17-24` "Repo Layout" lista 5 packages pero hay 7 — faltan `money-logic` y `ui-contracts`. (Fix de doc trivial.)
- CTAs que reescriben estilos en vez de componer `Button`, p. ej. `empty-accounts-state.tsx:14`.
- Colores Tailwind crudos `green`/`red` en tarjetas y reintegros; conviene llevarlos a tokens semánticos (ver memoria `amount-color-tokens`).
- Triplicación de `formatDateISO` (`packages/money-logic/cards.ts:195`, `packages/money-logic/recurrences.ts:15`, `apps/web/lib/date.ts:18`) + `parseISODate` (`recurrences.ts:10`).
- `getAuthenticatedUserId()` duplicado en ~5 server actions.
- `apps/web/.../movement-form.tsx` en 1908 líneas — bajo control si el **grupo 7** del cambio activo extrae la lógica pura a `packages` antes de archivar; tratarlo como criterio de cierre de ese cambio, no como deuda aparte.
- Mobile lint: 2 warnings (`Array<T>` y un import `writeFile` sin usar).
- Gap contable conocido: el breakdown mensual aún no atribuye gastos de tarjeta al pagar el resumen (`apps/web/lib/.../queries.ts:222`).

---

## Estado del cambio activo `redesign-movement-form-as-drawer`

- Web: grupos 1-6 ✅ (drawer, UI hi-fi, categoría, exchange, cuotas/reintegro/repetir, edición).
- Pendiente: grupo 7 (extracción de lógica a `packages` + hook `useMovementForm()` + drawer mobile + openers mobile) y grupo 8 (i18n, lint/build/tests, QA manual, archive). Ver `tasks.md:44`.
- Mobile muestra un FAB deshabilitado y pantalla de movimientos vacía (`apps/mobile/.../QuickAddFab.tsx:7`) — **deuda conocida del cambio activo, no una regresión oculta**.

---

## Lo que sí está bien

- Los dos P0/P1 del checkpoint del 26-05 (drift de auth docs, READMEs de packages faltantes) **están resueltos**. El repo se auto-corrigió entre checkpoints.
- Contrato Web↔Mobile respetado: primitivos por plataforma, props compartidas en `ui-contracts`, convención `onPress`.
- Lógica monetaria centralizada en `packages/money-logic`; mobile consume vía `@grana/dashboard`, sin duplicar cálculo.
- Cobertura contable sólida: saldo negativo+aviso, running balance, period summary, reintegros, settlements, cuotas, `getTodayAR` — todos con test.
- Migraciones 0022-0025 (shared) bien comentadas; email templates siguen OTP-only.
- Server actions con patrón `ActionResult<T>` uniforme.

---

## Plan de acción

### P0 — pit-stop inmediato (este barrido)
- [x] `deleteSubcategory`: bloquear borrado en uso (DB RESTRICT + guard de app que también chequea subcategorías hijas; trato equivalente al padre). ✅ mergeado

### P1 — mismo barrido
- [x] `reset-onboarding.sql`: quitar referencia a `mode`. ✅
- [x] Agregar `id DESC` a `shared/queries.ts` y `transactions/queries.ts`. ✅
- [x] Corregir `transactions/spec.md` (display = DESC, no ASC). ✅
- [x] Sincronizar el delta de `redesign-movement-form-as-drawer` (fila → detalle → drawer). ✅

### P2 — cuando moleste (TODOS PENDIENTES)
- [ ] `pnpm test` que incluya packages.
- [ ] Migrar `openspec:check` a script Node portable.
- [ ] Limpieza de doc novato/experto + `AGENTS.md` Repo Layout (faltan `money-logic` y `ui-contracts`).
- [ ] Unificar helpers de fecha; extraer `getAuthenticatedUserId()`; CTAs sin `Button`; tokens semánticos.

---

**Veredicto al auditar: 🟡 AMARILLO.** El borrado de subcategoría era pérdida silenciosa de datos contables (P0). El resto, deuda de baja urgencia.

**Veredicto al cierre: 🟢 P0 + P1 resueltos y mergeados.** Queda solo deuda P2 (baja urgencia) + el smoke manual del borrado. Nada bloquea features nuevas.
