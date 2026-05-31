# Design: Crear recurrencias directamente (desde cero)

## Context

El módulo de recurrencias tiene hoy tres caminos de creación, todos con una transacción o patrón previo:

- `createRecurrenceFromMovement` (`apps/web/app/_actions/recurrences.ts:37`): copia un movimiento real existente. El movimiento ES la primera ocurrencia, por eso setea `last_generated_date = tx.date`.
- `acceptRecurrenceSuggestion` (`recurrences.ts:640`): materializa una sugerencia detectada de movimientos pasados. `start_date = última fecha vista`, `last_generated_date = start_date` (las ocurrencias ya existen como transacciones).
- Ambos insertan en la tabla `recurrences`, que ya permite reglas sin origen: `created_from_transaction_id` es `NULL`-able (`supabase/migrations/0011_recurring_movements.sql:25`).

Falta el cuarto camino: declarar una regla **antes** de que exista cualquier movimiento. No hay transacción semilla, así que la regla debe **generar** su primera instancia, no copiarla.

Estado verificado del código (no asumir desde memoria):

- El schema `createRecurrenceSchema` (+ variantes income/expense/transfer) YA existe en `packages/validation/src/recurrences.ts:120`, agregado en `26881bf`. Cubre la forma de entrada de la creación directa.
- NO existe el server action `createRecurrence`. Solo `createRecurrenceFromMovement` y `acceptRecurrenceSuggestion`.
- NO existe un requisito de spec para creación directa (los requisitos de recurrencia en `specs/transactions/spec.md` solo cubren desde-movimiento, generación, confirmar/omitir, sugerencias y exclusiones).
- El decisor puro `decideRecurrenceInstance` (`packages/money-logic/src/recurrences.ts`) computa hoy: `baseDate = last_generated_date ?? start_date; nextDate = baseDate + intervalo`. Con `last_generated_date = null` produce `start_date + intervalo`. **Ningún flujo actual crea reglas con `last_generated_date = null`**, así que la rama null es comportamiento muerto hoy.
- El generador (`generateDueRecurrenceInstances`, `lib/recurrences/queries.ts:83`) avanza `last_generated_date` al **resolver** la instancia (confirmar/omitir), no al generarla; la idempotencia se apoya en el índice único `recurrence_instances_one_pending_per_rule` + el short-circuit `hasPending`.

## Goals / Non-Goals

**Goals:**
- Server action `createRecurrence` que crea una regla sin movimiento de origen respetando todos los invariantes contables.
- Definir e implementar la semántica de la primera instancia para reglas directas: **la primera instancia cae EN `start_date`**.
- UI de creación directa accesible desde `/transactions/recurring`.

**Non-Goals:**
- No se modifica el schema de base de datos (`created_from_transaction_id` ya es nullable).
- No se tocan `createRecurrenceFromMovement`, `acceptRecurrenceSuggestion` ni el flujo de confirmación/omisión de instancias (la única rama del decisor que cambia es la de `last_generated_date = null`, hoy inerte).
- No se agrega columna `fx_rate` a `recurrences` (ver Decision 4).
- No se aborda la creación directa en la app mobile (solo web por ahora).

## Decisions

### Decision 1: Reutilizar `createRecurrenceSchema` existente

**What:** Validar la entrada del nuevo action con `createRecurrenceSchema` (variantes income/expense/transfer) ya existente.

**Why:** Ya cubre la forma exacta: `movement_type` discrimina la variante, `category_id` requerido para income/expense, `transfer_destination_account_id` requerido y distinto del origen para transfer, `frequency` con presets + `custom` (`interval_count`/`interval_unit`), `start_date` requerido, `end_date` opcional ≥ start, `max_occurrences` opcional. Fue escrito anticipando este action.

**Alternatives considered:** Crear un schema nuevo — redundante, arriesga divergencia con el update.

**Nota de implementación:** el campo `created_from_transaction_id` del schema se ignora en este flujo; el action fuerza `null` independientemente del input.

### Decision 2 (RESUELTA): la primera instancia de una regla directa cae EN `start_date`

**Decisión del usuario:** para una regla creada desde cero, la primera instancia generada debe caer **exactamente en `start_date`** (intuición "primer pago: 1-jun"), no en `start_date + intervalo`.

**What:**
1. El action inserta `last_generated_date = null`.
2. Se ajusta `decideRecurrenceInstance` para que, **cuando `last_generated_date` es null**, la primera instancia se programe en `start_date` mismo (no `start_date + intervalo`). Cuando `last_generated_date` NO es null, el comportamiento queda **idéntico al actual** (`last_generated_date + intervalo`).

Esbozo:
```ts
const baseDate = rule.last_generated_date ?? rule.start_date
const nextDate =
  rule.last_generated_date == null
    ? rule.start_date                                   // 1ª instancia de regla directa
    : addInterval(baseDate, unit, count, { anchorDate: rule.start_date })
```

**Why es seguro:** ningún flujo existente crea reglas con `last_generated_date = null`, así que esta rama hoy no se ejecuta nunca. Desde-movimiento (`tx.date`) y sugerencia (`start_date`) pasan valores no-null → rama sin cambios. Tras generar la primera instancia y resolverla (confirmar/omitir), el action de resolución setea `last_generated_date = scheduled_date = start_date`; de ahí en adelante la serie avanza normalmente: `start_date`, `start_date + intervalo`, `+2·intervalo`, …

**Backfill:** un `start_date` pasado NO genera una instancia por período vencido. El decisor corta con `nextDate > today → not_due` y el índice único garantiza una sola pendiente por regla; resultado: una única instancia pendiente fechada en `start_date`. `start_date` futuro ⇒ `not_due` hasta que llegue.

**Relación con el spec existente:** el requisito 1026 ("La generación … usa intervalo+unidad …") y su escenario "Primera instancia desde start_date" (15-ene ⇒ 15-feb) describen el caso **con semilla** (`last_generated_date` no-null). Se MODIFICA ese requisito para distinguir explícitamente la rama null (directa ⇒ `start_date`) de la rama no-null (semilla ⇒ `+ intervalo`), conservando el escenario existente y agregando uno para el caso directo.

**Alternatives considered:**
- `start_date + intervalo` (comportamiento actual con null): descartado por decisión del usuario; era menos intuitivo para reglas sin semilla.
- Crear la primera instancia dentro del propio action: duplicaría la lógica del generador y arriesgaría violar el índice de "una pendiente". El generador sigue siendo la única fuente de instancias.

### Decision 3: Invariantes contables validados en el server action

**What:** Además del schema, el action replica las guardas contables de los actions vecinos:
- `movement_type ∈ {income, expense, transfer}` (el schema ya excluye `adjustment`/cuotas).
- Income/expense requieren `category_id`; transfer requiere `transfer_destination_account_id ≠ account_id` y `category_id = null`.
- `amount > 0` (schema + CHECK `chk_recurrences_amount_positive`).
- `currency_code ∈ {ARS, USD}` y debe ser una moneda **activa** de la cuenta (bimoneda: nunca mezclar).
- `end_date ≥ start_date` (schema + CHECK).
- `account_id` (y destino) pertenecen al usuario y están activas.

**Why:** Defensa en profundidad. El schema valida forma y la DB tiene CHECKs, pero pertenencia/estado/moneda-activa de la cuenta solo se verifican en el server con datos del usuario. Mismo patrón que los actions vecinos.

### Decision 4: `fx_rate` NO se captura al crear la regla

**What:** Las reglas en tarjeta de crédito USD no almacenan `fx_rate`. El tipo de cambio se pide al **confirmar** cada instancia (`confirmRecurrenceInstanceSchema.fx_rate_to_ars` ya existe).

**Why:** `recurrences` no tiene columna `fx_rate` y el TC cambia mes a mes; fijarlo en la regla daría conversiones incorrectas. El flujo de confirmación ya lo resuelve.

**Consecuencia UI:** la creación directa **permite** cuentas de crédito (igual que desde-movimiento), sin pedir fx_rate; el copy aclara "el tipo de cambio se pide al confirmar cada vez".

### Decision 5: Entry point = modal/drawer; reutilización de UI

**What:** Botón "+" en `/transactions/recurring` que abre un **drawer/modal** de creación, consistente con el movement-drawer introducido en `99989cb` y con la referencia de diseño (`docs/design/recurrencias/Grana  Recurrencias Desktop.html`, modal "Crear").

**Reutilización (corrección a un supuesto inicial):** NO existen componentes standalone `account-picker-field` / `category-picker-field` / `transfer-account-picker-field`. Los selectores viven **inline** en `movement-form.tsx`: `renderAccountPicker` (l.942), `categoryPickerContent` (l.979), y el bloque de frecuencia (estados `frequency`/`intervalCount`/`intervalUnit`/`recurrenceEndDate`, l.298-306). Plan:
- **Extraer** el bloque de **frecuencia** (presets + custom + end date + max_occurrences + preview en lenguaje natural) a un componente compartido reutilizable por `movement-form` y el nuevo modal — es idéntico y contiene lógica.
- **Recrear** los pickers de cuenta/categoría en el modal nuevo siguiendo el design system (más barato que refactorizar los popovers del archivo de 1826 líneas; se puede extraer luego si conviene).

**Alternatives considered:** Ruta `/transactions/recurring/new` — deep-linkable y más fácil de testear, pero rompe la coherencia con el patrón drawer actual. Queda como fallback si el manejo de estado en modal se complica.

### Decision 6: Preview en lenguaje natural

**What:** Resumen tipo "Gasto de $X cada mes desde el 1-jun" derivado del estado del form, reutilizando `presetToInterval`/`addInterval` de `@grana/money-logic`. Con la Decision 2 resuelta, el preview puede afirmar con certeza "primera: {start_date}".

## Risks / Trade-offs

- **Cambio en `decideRecurrenceInstance`** → aunque la rama null es inerte hoy, un error rompería la generación. Mitigación: tests unitarios de la rama null (start hoy / pasado / futuro) y de regresión de la rama no-null.
- **Extraer el bloque de frecuencia de `movement-form.tsx` (1826 líneas)** → riesgo de regresión en el alta de movimientos. Mitigación: extracción mecánica + verificación manual del drawer de movimientos (presets, custom, end date, max occurrences).
- **Cuentas de crédito sin fx en la regla** → correcto contablemente pero puede sorprender. Mitigación: copy claro en la UI.

## Migration Plan

No aplica: sin cambios de base de datos. `created_from_transaction_id` ya es nullable.

## Open Questions

Ninguna bloqueante. Decisiones tomadas con defaults razonables (modal/drawer, crédito habilitado, extraer frecuencia + recrear pickers); revisables durante la implementación sin cambiar el spec.
