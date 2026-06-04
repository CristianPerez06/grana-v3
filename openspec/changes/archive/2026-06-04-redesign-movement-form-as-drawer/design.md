# Diseño — Form de movimientos como drawer

## Arquitectura: presentación nueva, lógica reusada

El objetivo es **no duplicar** la lógica que ya vive en `apps/web/app/(app)/transactions/new/_components/movement-form.tsx` (estado del form, llamadas a server actions, `editableFields`, gating por tipo, sugerencia de categoría, aviso de saldo negativo).

Plan de reuso en tres capas:

1. **Lógica pura → `packages/`**: lo que es agnóstico de plataforma (formato de monto AR en vivo, derivaciones por tipo — color/signo/helper/labels, validación de submit, mapeo a inputs de las actions) se extrae a `@grana/money-logic` (o un módulo nuevo `packages/movement-form-logic` si crece). Hoy `MoneyAmountInput`/`parseMoneyInput` ya existen y se reusan tal cual.
2. **Estado del form → hook compartido en lógica, JSX por plataforma**: un hook `useMovementForm()` que devuelve estado + handlers, sin JSX. Web y mobile lo consumen y montan su propio árbol (HTML vs RN), respetando la Web↔Mobile policy (no se comparte JSX).
3. **Presentación → drawer (web) / drawer (mobile)**: el contenedor cambia de página a drawer usando los primitivos de `add-overlay-primitives`. Los selectores (cuenta, categoría con drill, fecha) son popovers que envuelven el primitivo `Popover`.

Las rutas `/transactions/new` y `/transactions/[txId]/edit` se mantienen y renderizan el mismo form (montado en página, no en drawer) para deep-link, no-JS y reuso mobile. En desktop, los openers (FAB, botón header, fila) abren el drawer; la navegación a la ruta queda como fallback.

## Selector de categoría con drill

Reusa el árbol de `getAllCategories` (categoría → `subcategories[]`) y el lenguaje visual del drill de `spending-by-category` (chevron `›`, "Toda la categoría", volver con `‹`). El popover mantiene estado local `catDrill` (categoría en la que se está drilleando). Click en categoría no drillable selecciona y cierra; click en drillable entra a nivel 1 sin seleccionar; en nivel 1, "Toda la categoría" selecciona sin subcat, una subcategoría selecciona `categoría + subcategoría`.

## Quinto tab: Cambio de moneda (diseño derivado)

El prototipo no trae diseño. Se deriva del layout de Transferencia:

- Fila **Desde** (cuenta origen) + monto/moneda origen (el monto hero representa el monto de origen).
- Fila **Hacia** (cuenta destino, puede ser la misma cuenta para cambio intra-cuenta) + monto/moneda destino.
- Restricción: `currency origen ≠ currency destino` (lo valida `createExchangeSchema`).
- Helper: tasa implícita `destino/origen` mostrada de forma no editable como ayuda.
- Sin categoría, sin cuotas, sin reintegro. Repetir: se evalúa con Producto (las recurrencias de exchange no son comunes; por defecto, ocultar el toggle Repetir en exchange salvo definición contraria).

## Snapping de tokens

El prototipo difiere en algunos valores; se snapean a `@grana/ui-tokens`:

| Prototipo | v3 token |
|---|---|
| verde texto `#059669` | `--emerald-deep` (`#059669`) ✓ |
| emerald-soft `#ECFDF5`/`#E4F5EE` | `--emerald-bg` / `--emerald-soft` |
| ámbar banner `#FCF5E0`/`#D9A21B` | `--warning` (`#C49A3C`) + fondo derivado |
| dots de cuenta hex arbitrarios | `AccountAvatar` / `resolveAccountAvatar` (8 colores curados) |

Fuente: Plus Jakarta Sans (ya configurada). Números `tabular-nums`. Miles `.` / decimales `,` (es-AR) vía la lógica de `MoneyAmountInput`.

## Cuentas y crédito

Las filas de cuenta usan `AccountAvatar` (color_key/icon_key resueltos), no dots hex. Las cuentas de crédito son `type='credit'` y viven en el bucket de `cards`: elegir una en un Gasto dispara el flujo de cuotas (`registerInstallments`/`registerCardPurchase`) en vez de `createExpense`, y muestra el subtexto del próximo resumen (período via `getOrCreatePeriodForDate`). Esta bifurcación ya existe en `movement-form` y se preserva.

## Riesgos

- **Extracción de lógica**: mover estado a un hook compartido debe preservar exactamente el comportamiento actual (tests de las actions y del form como red de seguridad). Hacerlo incremental: primero envolver el form existente en el drawer reusándolo tal cual; luego extraer a `packages/` para mobile.
- **Doble entrada (drawer + ruta página)**: mantener ambas sin divergencia exige que el form sea un único componente montado en dos contenedores. Evitar lógica duplicada en el page wrapper.
- **Exchange sin diseño previo**: requiere validación de Producto/Diseño antes de cerrar el tab.

## Dependencias

- `add-custom-recurrence-frequency` (freq Personalizado en el toggle Repetir).
- `add-overlay-primitives` (Drawer, Popover, Segmented, Switch en web y mobile).

## Arquitectura (refinada): 4 capas, no 3

La división original (pura / hook / presentación) under-scopeaba la capa de
mutaciones. Al inspeccionar las 13 server actions que el form consume, no son
homogéneas: hay un grupo "thin" (validar → 1 insert → revalidar) y un grupo
"thick" con orquestación real y rollback que **no quisiéramos re-implementar en
mobile de cero**.

```
┌────────────────────────────────────────────────────────────────┐
│ 1. @grana/money-logic (pura, sin React, sin Supabase)          │
│    - splitAmountIntoInstallments, addMonthsToISO               │
│    - suggestReimbursementAmount (ya existe)                    │
│    - movement-form pure helpers: derivaciones por tipo,        │
│      cascadas (tab→cuenta→moneda), validadores, mapeo          │
│      form-state → action-payload, initial state desde edit ctx │
└────────────────────────────────────────────────────────────────┘
                              │
┌────────────────────────────────────────────────────────────────┐
│ 2. @grana/transactions-mutations (NUEVO — orquestadores)       │
│    - registerInstallments({ supabase, input })                 │
│    - registerCardPurchase({ supabase, input })                 │
│    - createRecurrenceFromMovement({ supabase, input })         │
│    Recibe el cliente Supabase como parámetro. Hace la danza    │
│    de rollback (parent → children → shared splits). NO sabe    │
│    de revalidatePath ni de auth; el caller los aporta.         │
│                                                                │
│    Server action web se vuelve un shell:                       │
│      auth → orquestador → revalidatePath → return              │
│    Mobile llama el orquestador con su propio supabase client.  │
└────────────────────────────────────────────────────────────────┘
                              │
┌────────────────────────────────────────────────────────────────┐
│ 3. Mutaciones "thin" — NO se extraen                           │
│    createIncome/Expense/Transfer/Adjustment/Exchange,          │
│    updateX, updateInstallmentParent, suggestCategoryFromHistory│
│    Son shells de ~30-50 líneas (Zod + 1-2 calls + revalidate). │
│    El costo de una interfaz compartida supera el de re-tipear  │
│    en mobile. El hook los recibe vía un objeto `mutators`      │
│    inyectado: web bindea server actions; mobile bindea calls   │
│    directos a @grana/supabase.                                 │
└────────────────────────────────────────────────────────────────┘
                              │
┌────────────────────────────────────────────────────────────────┐
│ 4. @grana/movement-form (NUEVO — React)                        │
│    - useMovementForm({ mutators, initialContext })             │
│      Estado, cascadas, "+ Otro" reset, edit mode.              │
│      Sin JSX. Devuelve { state, setters, derived, onSubmit }.  │
│    React como peerDep. Por qué nuevo y no money-logic/react:   │
│    meter React peerDep en money-logic regresiona su claridad   │
│    (hoy es 100% puro). Mejor separar.                          │
└────────────────────────────────────────────────────────────────┘
```

### Por qué dos niveles de mutaciones, no uno

`createExchange` (~50 LoC de trabajo real): valida, dos checks de currency,
1 insert con `destination_*` columns, revalida. Mobile re-implementa en
~30 LoC. Compartir interfaz cuesta más que duplicar.

`registerInstallments` (~140 LoC de trabajo real): valida, splits de monto,
N períodos via `getOrCreatePeriodForDate`, guard de backdating contra períodos
pagados, insert PARENT off-ledger, build + insert N CHILDREN, rollback en cada
fase, `applySharedSplits` con rollback adicional, 3× revalidate. Re-
implementar esto en mobile es deuda silenciosa que se va a desincronizar.

La regla: el orquestador vive en `@grana/transactions-mutations` cuando hay
**rollback de varias fases** o **fan-out de filas derivadas con invariantes
cruzadas**. Todo lo demás queda thin y duplicado en el shell de cada
plataforma.

### Sequencing recomendado

Esta refinación reordena el Grupo 7 de `tasks.md`:

1. **Orquestadores primero** (no especulativo, beneficia a web hoy mismo):
   extraer `registerInstallments`, `registerCardPurchase`,
   `createRecurrenceFromMovement` a `@grana/transactions-mutations`. Server
   actions web pasan a ser shells. Tests de las actions actuales son la red.
2. **Pure helpers** del form a `@grana/money-logic` (cascadas, mappers,
   validators). Web los consume sin cambiar comportamiento visible.
3. **Hook** `useMovementForm` en `@grana/movement-form`. Web lo adopta;
   `movement-form.tsx` queda como JSX + chrome + el cableado del `mutators`
   hacia server actions.
4. **Mobile** consume hook + orquestadores + escribe sus mutators thin.

Diferencia vs. las tareas 7.1/7.2 originales:
- Agrega el package `@grana/transactions-mutations` (no contemplado).
- Aclara que el hook va en package nuevo, NO en `@grana/money-logic`, para
  preservar su pureza.

## Riesgos (adiciones de la refinación)

- **Orquestadores con cliente inyectado**: el cliente de Supabase difiere
  entre web (server-side cookies) y mobile (auth persistente local). El
  orquestador debe aceptar el cliente como parámetro pero asumir que ya está
  autenticado; la verificación de `userId` queda en el caller. Si esto se
  filtra al orquestador, se rompe el cross-platform.
- **Verificar duplicados antes de empezar**: `splitAmountIntoInstallments` y
  `addMonthsToISO` ya pueden estar en `@grana/money-logic/cards` o en un
  utils compartido. Si están, la fase 1 de pure helpers se reduce.
- **Mutator interface drift**: cada nueva acción del form requiere que ambos
  bindings (web y mobile) la agreguen. Mantener el tipo `Mutators` como
  export top-level (no inferido) en `@grana/movement-form` hace que TS
  rompa en cualquiera de las dos plataformas si se desincroniza.
