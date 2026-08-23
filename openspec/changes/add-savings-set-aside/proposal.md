# Proposal: add-savings-set-aside

## Why

Hoy Grana no tiene forma de expresar la decisión más básica del ahorro: **"esto que tengo, decidí que no lo voy a gastar"**. El usuario que aparta plata mentalmente sigue viendo ese dinero contado como disponible, y no hay ningún rodeo posible — a diferencia de casi todo lo demás, esto no se puede simular con las piezas que ya existen.

Pero el valor de la fase no es "agregar ahorro". Es que **Grana pasa a contestar entera una de las preguntas más prácticas que tiene un usuario**: *¿cuánto puedo gastar sin meter la pata?*

El cálculo que resuelve es el que el argentino ya hace de cabeza y hoy le sale mal:

```
saldo de mis cuentas  −  lo que ya tiene destino  =  lo que realmente puedo gastar
```

No estamos agregando un concepto nuevo: **estamos automatizando una resta que el usuario ya hace**.

El fundamento conceptual completo vive en `docs/modelo-de-dinero.md`; el recorrido de pantallas, en `docs/design/savings-guardar/`. Este change implementa su **fase 1**.

## What Changes

**Un comportamiento nuevo: Guardar.**

- El usuario puede **guardar** un monto en una moneda, y **liberarlo**. Guardar **no mueve dinero ni genera un movimiento en el ledger**: cambia la función de plata que ya tiene.
- El **disponible** pasa a ser `saldo de cuentas propias − guardado`, por moneda.
- **Guardar tiene tope en el disponible.** Es la diferencia con el ledger: un saldo negativo es un hecho válido, pero guardar más de lo que tenés no es un estado incómodo — es un input inválido.
- **Gastar por encima de lo guardado deja el disponible negativo y NO reduce el guardado en silencio.** Grana avisa sin bloquear; borrarle la decisión al usuario para que el número cierre sería mentirle.

**Dónde se ve.**

- El Hero del dashboard muestra el **disponible real**. Un único monto de plata.
- Bajo la tira de "Resumen del mes", separada por una regla, **una sola línea**: *Guardaste este mes*. La identidad de la card sigue cerrando en pantalla.
- Una **vista de detalle** —total, este mes, historial— a la que se llega tocando el número.

**Cómo se llega al acto.**

- Un **drawer contextual**: viniendo de un ingreso hereda moneda y monto sugerido, y no pregunta fecha. Abierto suelto sí ofrece moneda, y solo si hay saldo en las dos.
- Una **tira de sugerencia** después de registrar un ingreso, servida por `guidance`, como máximo una vez por mes.
- La sugerencia **recuerda el porcentaje, no el importe**: 10% de $2.000.000 en agosto propone $250.000 sobre $2.500.000 en septiembre. Sin pantalla de ajustes.

## Non-goals

Esta fase es deliberadamente angosta. **Nada de lo siguiente entra**, y cada exclusión tiene su motivo:

- **Propósito y metas** (fase 2 y 4). Un campo "¿para qué?" sin propósitos que elegir es un campo muerto. La fase 1 **no anticipa nada**: en la fase 2, `savings_purpose` se crea y `availability_reserve` gana `purpose_id` nullable en la misma migración. Aditivo, sin backfill.
- **Vehículos: plazo fijo, FCI, dólares como tenencia** (fase 3, como `positions`). Es la exclusión que más simplifica: mientras no exista plata parqueada fuera de las cuentas, las transferencias entre cuentas propias siguen siendo **neutras** como hoy y la card del mes necesita **una sola línea nueva** en vez de dos. Un plazo fijo se sigue cargando como hasta ahora.
- **Instrumentos, vencimientos, valuación, rendimiento, patrimonio, horizonte, inflación** (fases 3 a 5).
- **Una entrada nueva en la navegación.** "Guardado" no es un módulo: es un dato con vista de detalle. Qué hub agrupa ahorro, propósitos y posiciones se decide en fase 2, con uso real.
- **Sobres / zero-based budgeting.** Descartado como modelo: apartar pesos que se licúan no es ahorrar; en Argentina el ahorro se expresa en el vehículo.

## Capabilities

### New Capabilities

- `savings`: guardar y liberar como decisión del usuario fuera del ledger, el disponible real derivado, el tope, la convivencia con el gasto, la sugerencia al ingreso y la vista de detalle.

### Modified Capabilities

- `dashboard`:
  1. "El Hero muestra el disponible total bimoneda" — el monto pasa a ser el disponible real.
  2. "La zona clara de la card de saldo muestra el Resumen del mes" — suma la línea *Guardaste este mes* bajo una regla y extiende la identidad auditable.

## Impact

**Aditivo por construcción.** No se toca `get_owned_account_ids()`, ni `get_account_balance_sums`, ni `calculateTransactionSums`, ni las reglas de signo, ni la paridad SQL↔TS, ni la analítica del mes, ni el módulo de cuentas.

- **Migración**: tabla `availability_reserve` con RLS + funciones normativas `get_available_sums(p_today)` y `get_reserve_flow_sums(p_from, p_to)`.
- **`packages/savings/`** (nuevo, con la forma de `packages/accounts/`: `queries.ts`, `mutations.ts`, `types.ts`, `index.ts`). El paquete se llama `savings` porque es el lenguaje del producto y porque las fases 2 y 4 —propósitos y metas— aterrizan adentro; la **tabla** se llama `availability_reserve` porque es lo que registra. Ninguna de las dos palabras llega a la UI, que dice **Guardar** y **Guardado**.
- `packages/dashboard/`: consume las funciones; **no recompone la resta ni el neto**.
- `packages/validation/`: schema de guardar/liberar (monto > 0, moneda activa, fecha, tope).
- `apps/web` + `apps/mobile`: drawer sobre `overlay-primitives`, la línea del dashboard, la vista de detalle, la tira de sugerencia sobre `guidance`.
- `packages/i18n-messages`: copy nuevo.

## El disponible real nace como lectura única

**El disponible real NO se compone en TypeScript.** Nace como una función de Postgres que devuelve,
por moneda, el saldo de cuentas, lo reservado y la resta ya hecha:

```sql
-- stock: cuánto hay y cuánto se puede gastar, a una fecha
get_available_sums(p_today date default null)
  → (currency_code, accounts_net, reserved, available)

-- flujo: cuánto se reservó neto en un rango (para "Guardaste este mes")
get_reserve_flow_sums(p_from date, p_to date)
  → (currency_code, reserved_net)
```

**Las dos**, no solo la primera: la línea *Guardaste este mes* es un **flujo**, y calcularlo a mano en
TS reintroduce exactamente el mismo riesgo que evita la lectura del stock. Nadie recompone ni el stock
ni el flujo.

`get_available_sums` tiene además **tres consumidores** —el Hero, el tope del drawer y la validación
del write path—, lo que hace todavía más caro que cada uno derive la resta por su cuenta.

Es la lección que el repo ya aprendió con `get_owned_account_ids()` (migración `0051`): el criterio de
"cuenta propia" estaba replicado a mano en cada call site **y ya había divergido** — una lectura
omitía `is_active` mientras el Hero lo aplicaba. Si la resta del guardado vive en tres composiciones
de TS (web, mobile, dashboard), el próximo read que se olvide de restarla produce un segundo
"disponible" en la misma pantalla. **Un concepto, una definición, en SQL.**

## Aritmética

La identidad que la card deja verificar en pantalla:

```
Tenías + Entró − Se fué − Guardaste  =  Disponible
```

`Tenías` se **deriva** (no se lee) como `Disponible − (Entró − Se fué − Guardaste)`, igual que hoy, de modo que cierre por construcción y no porque dos lecturas coincidan.

`Guardaste` es el **flujo neto del mes** (guardado menos liberado), nunca el stock acumulado. Poner el acumulado rompe la identidad.
