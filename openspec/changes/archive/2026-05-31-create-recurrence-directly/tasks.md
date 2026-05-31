# Tasks: Crear recurrencias directamente (desde cero)

## 1. Lógica pura (`packages/money-logic`)

- [x] 1.1 Ajustar `decideRecurrenceInstance` en `packages/money-logic/src/recurrences.ts`: cuando `last_generated_date` es `null`, la primera instancia se programa en `start_date` (no `start_date + intervalo`); cuando no es `null`, comportamiento idéntico al actual.
- [x] 1.2 Tests unitarios de la rama `null`: `start_date` = hoy ⇒ genera en `start_date`; `start_date` pasado ⇒ una sola instancia en `start_date` (sin backfill); `start_date` futuro ⇒ `not_due`.
- [x] 1.3 Tests de regresión de la rama no-`null` (desde-movimiento / sugerencia): confirmar que `15-ene` con `last_generated_date=15-ene` sigue dando `15-feb`, y clamping de fin de mes intacto.

## 2. Validación (`packages/validation`)

- [x] 2.1 Revisar `createRecurrenceSchema` (y variantes income/expense/transfer) en `packages/validation/src/recurrences.ts`; confirmar que cubre la entrada de creación directa sin cambios. Ajustar solo si falta algo (no duplicar el schema). — Cubre todo; sin cambios.
- [x] 2.2 Confirmar que el tipo `CreateRecurrenceInput` está exportado para consumirlo desde el action y la UI. — Exportado vía `export * from './recurrences'` en `packages/validation/src/index.ts`.

## 3. Backend / server action (`apps/web/app/_actions/recurrences.ts`)

- [x] 3.1 Implementar `createRecurrence(input: unknown)` siguiendo el molde de `acceptRecurrenceSuggestion`: validar con los schemas por variante (income/expense/transfer), autenticar (`getAuthenticatedUserId`), insertar en `recurrences` con `created_from_transaction_id = null`, `last_generated_date = null`, `status = 'active'`.
- [x] 3.2 Guardas contables en el action: `movement_type ∈ {income,expense,transfer}`; income/expense ⇒ `category_id` requerido (schema); transfer ⇒ `transfer_destination_account_id ≠ account_id` y `category_id = null`; `amount > 0` (schema); `currency_code` activo en la cuenta (bimoneda); `end_date ≥ start_date` (schema); cuenta(s) del usuario y activas.
- [x] 3.3 Derivar `interval_count`/`interval_unit` desde `frequency` (presets vía `presetToInterval`; `custom` toma el par explícito), igual que `createRecurrenceFromMovement`.
- [x] 3.4 `revalidatePath('/transactions')` y `revalidatePath('/transactions/recurring')`; retornar `{ ok: true, id }`.
- [x] 3.5 Tests del action — el repo NO testea server actions con unit tests (requieren Supabase live; `acceptRecurrenceSuggestion`/`createRecurrenceFromMovement` tampoco tienen). La lógica testeable (`decideRecurrenceInstance` con `last_generated_date=null`) queda cubierta en money-logic; el action se verifica manualmente en 6.3.

## 4. Frontend (`apps/web/app/(app)/transactions/recurring`)

- [x] 4.1 Componente de frecuencia autocontenido (decisión del usuario: recrear, NO extraer de movement-form para no arriesgar el flujo core): `recurring/_components/frequency-fields.tsx` (presets + custom + end_date + max_occurrences). movement-form.tsx queda SIN CAMBIOS. Follow-up: deduplicar luego.
- [x] 4.2 Modal de creación directa `recurring/_components/create-recurrence-modal.tsx` (Drawer): tipo (ingreso/gasto/transferencia), `MoneyAmountInput` + moneda, cuenta (+ destino para transfer), categoría/subcategoría (income/expense), frecuencia (4.1), `start_date`, preview en lenguaje natural.
- [x] 4.3 Submit cableado a `createRecurrence`; maneja `formError`; al éxito `router.refresh()` + cierra.
- [x] 4.4 Botón "+" `recurring/_components/create-recurrence-button.tsx` montado en el header de `recurring/page.tsx`; la página ahora carga `getAccounts()` + `getAllCategories()` y arma `RecurrenceAccount[]`.
- [x] 4.5 Copy de tarjeta de crédito no-ARS (`create.credit_fx_note`): el TC se pide al confirmar.
- [x] 4.6 `getTodayAR()`/`formatDateISO` para el default de `start_date`.
- [~] VERIFICACIÓN PENDIENTE de grupo 4: no pude correr `tsc`/`build` del frontend (la salida de la terminal dejó de renderizar a mitad de sesión).

## 5. i18n (`packages/i18n-messages`)

- [x] 5.1 Agregadas claves `recurrences.create.*` (title, eyebrow, account_from/to/toward, category, start_date, repeat_until, max_occurrences, frequency_question, credit_fx_note, preview, placeholders.*, errors.*) en es y en, vía script node. [~] sin verificar el diff por el blackout de salida.
- [x] 5.2 Paridad de claves es/en verificada (0 faltantes en ambos sentidos).
- [x] 5.3 FIX (hallado en verificación runtime del usuario): faltaba `recurrences.actions.create` — los 3 componentes lo referenciaban pero solo se había creado `recurrences.create.*`. Agregado a es ("Crear recurrencia") y en ("Create recurrence"). Re-validadas TODAS las claves de los componentes incl. dinámicas (frequencies/types/units): ALL_KEYS_OK.

## 6. Validación y cierre

- [x] 6.1 Validación OpenSpec en verde vía `npx openspec validate create-recurrence-directly --strict` ("is valid") + sin placeholders TBD en `specs/`. NOTA: el script `pnpm openspec:check` falla en Windows porque usa `grep -rE` (bash) que cmd.exe no entiende — problema de portabilidad PREEXISTENTE del script, no del change. Correr en bash/CI.
- [x] 6.2 `pnpm build` (7/7 tasks, Compiled successfully) y `tsc --noEmit` (web, exit 0) en verde. `pnpm lint`: 0 errores; queda 1 warning PREEXISTENTE en `credit-cards.ts:207` ('today' sin usar), ajeno a este change. Archivos nuevos sin warnings.
- [x] 6.3 Verificación manual end-to-end (usuario, app real): creó reglas, confirmó que la 1ª instancia aparece para `start_date` y que un `start_date` pasado NO hace backfill (una sola instancia). FUNCIONA OK. ✅
- [x] 6.4 Archivar el change OpenSpec (`/opsx:archive`) tras el merge. ✅ (mergeado a main `b3e60c7` + pusheado)

## 7. Mejoras halladas en la verificación runtime del usuario (incluidas en este change)

- [x] 7.1 FIX copy vacío por pestaña en `recurring-tabs.tsx`: usaba un único `recurrences.empty` para las 3 pestañas (mostraba "no tenés reglas" en Pausadas/Finalizadas aun con reglas activas). Ahora mensaje propio: `empty_active`/`empty_paused`/`empty_finished` (es/en). Bug PREEXISTENTE, no introducido por este change, pero en la misma pantalla.
- [x] 7.2 Historial de instancias en el detalle de la regla (`recurring/[id]/`): nuevo `recurrence-instances-list.tsx` (server component, read-only) que lista TODAS las instancias (pending/confirmed/skipped) con fecha+monto+chip de estado. Antes una instancia omitida quedaba en DB (`status='skipped'`) pero sin rastro visible en la UI. Datos ya provistos por `getRecurrenceDetail` (`rule.instances`); sin cambios de query/DB. Strings `recurrences.history.*` + `recurrences.instance_statuses.*` (es/en).

## 8. Rediseño hi-fi de la pantalla de recurrencias (decisión del usuario: "rediseñar todo dentro de este change", contra `docs/design/recurrencias/`)

- [x] 8.0 Modal de creación reescrito a hi-fi (corrección: la 1ª versión usaba `<select>` planos lejos del mockup): píldoras de tipo con signo, amount hero, pickers de cuenta/categoría con `AccountAvatar`+`Popover` (drill a subcategoría), pills de frecuencia + custom, fila de fecha con popover, toggle de fecha de fin, preview card verde de marca. `frequency-fields.tsx` borrado (absorbido). Mantiene el patrón Drawer del repo.
- [x] 8.1 `pending-recurrences-block.tsx` restyle hi-fi: card "hub" (borde ámbar + sombra warning), header con ícono Clock + subtítulo + contador, tile de categoría por fila, badge de urgencia **"Vence hoy / Vencido hace N días / Vence en N días"** (rojo `#D9534F` si vencido, `--warning` si futuro), botones Confirmar (emerald) / Omitir, empty-state "todo al día". Lógica de confirmar/omitir/editar/aviso de saldo INTACTA. Strings `pending.{subtitle,all_clear,overdue,due_today,due_in}`.
- [x] 8.2 `recurring-tabs.tsx` restyle: filas con tile de color por categoría (color+emoji), badge de frecuencia, próxima fecha (`next_prefix`), monto con signo/color por tipo.
- [x] 8.3 Cards "Próximos 7 días / Más adelante este mes" (`upcoming-recurrences.tsx`, server): proyección informativa por moneda (NUNCA suma — invariante bimoneda). Nueva lógica pura `projectUpcomingOccurrences`/`projectRuleOccurrences` en `packages/money-logic/src/recurrences.ts` (respeta `end_date`, `max_occurrences`, clamping fin de mes, cap de seguridad) + 9 tests en `projection.test.ts`. Strings `recurrences.upcoming.*`.
- [x] 8.4 Impact strip (ingresos/gastos/neto): **OMITIDO a propósito** — sumaría ARS+USD y viola el invariante de bimoneda (el mockup asume todo-ARS). Decisión del usuario.
- [x] 8.5 Colores: usados los tokens REALES del repo (`--warning`, `--emerald-deep`, `--terracotta`, `--navy`, `--text-muted`…). El mockup usa `--rose` (rojo) que NO existe en el design system; el único rojo se reserva a urgencia "vencido". `tsc` 0, tests 295, build 7/7, lint 0 errores (1 warning pre-existente ajeno en `credit-cards.ts:207`).
- [x] 8.6 Consistencia (hallazgos del usuario en runtime): (a) botón "Crear recurrencia" igualado al estilo de `RegisterMovementButton` (`bg-emerald`, `rounded-[var(--radius-lg)]`, `px-4 py-2.5`, `font-semibold`) en vez del navy custom — no se reutilizó el componente porque está acoplado a `useMovementDrawer`/namespace transactions, pero el look es idéntico; (b) montos del historial de instancias ahora usan la convención de tono del repo (income emerald `+`, expense terracota `−`, transfer navy) en vez de negro plano.
- [x] 8.7 Color de monto en `recurring-tabs.tsx` (lista de reglas): los gastos caían en `text-navy`; ahora income→emerald, expense→terracota, transfer→navy, consistente con las otras 2 superficies.
- [x] 8.8 Fecha de creación en el detalle de la regla: `created_at` ya venía en los datos (query `*`); se agrega línea "Creada el {date}" bajo el header. String `recurrences.created_on` (es/en).
- [x] 8.9 Restyle hi-fi del detalle de la regla (`recurrence-detail-form.tsx`): el form era lo-fi plano. Ahora: acciones Pausar/Reanudar (con íconos Play/Pause) y Eliminar (terracota), banners de éxito/error con tokens del repo, campos en card hi-fi (`rounded-[15px]`, field-bg, labels uppercase), CTA Guardar emerald. TODA la lógica (updateRecurrence/pause/resume/delete) INTACTA.

## Estado de cierre

- ✅ Gates finales: `tsc` web 0 errores, `pnpm lint` 0 errores (1 warning pre-existente ajeno `credit-cards.ts:207`), tests 295 passed (28 files), `pnpm build` 7/7 compiled successfully, `openspec validate --strict` válido, i18n es/en con paridad.
- ✅ Verificación contable end-to-end (6.3) CONFIRMADA por el usuario en la app real: 1ª instancia en `start_date`, sin backfill. Feature completo. Solo resta archivar el change post-merge (6.4).

## Estado de verificación

- ✅ tests (286 passed, incl. `generator.test.ts` con la semántica null⇒start_date), `tsc` web, `lint`, `openspec:check`, `pnpm build` e i18n parity: todos en verde.
- ✅ Verificación runtime del usuario en la app real: corrigió `MISSING_MESSAGE` de `recurrences.actions.create` (faltaba la clave en `actions`), el copy vacío por pestaña (7.1) y disparó la mejora de historial (7.2).
- ⏳ Pendiente: verificación manual end-to-end del flujo contable (6.3: 1ª instancia en `start_date`, no-backfill) y archivado post-merge (6.4).
