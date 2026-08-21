# Proposal: add-savings-set-aside

## Why

Hoy Grana no tiene forma de expresar la decisión más básica del ahorro: **"esto que tengo, decidí que no lo voy a gastar"**.

El usuario que aparta plata mentalmente sigue viendo ese dinero contado como disponible. El que lo movió a un plazo fijo, a un FCI o a dólares en la caja de seguridad tiene dos salidas, y las dos están mal: **no cargarlo** (y entonces su patrimonio en Grana miente) o **cargarlo como una cuenta común** (y entonces su "para gastar hoy" se infla con plata que no puede gastar).

No falta un módulo de ahorro. Falta **un verbo**. El resto del modelo —propósito, metas, valuación, rendimiento, patrimonio— se construye después, encima de este dato, y no hace falta para que Grana empiece a enseñar el comportamiento que importa: **separar plata antes de gastarla**.

El fundamento conceptual completo vive en `docs/modelo-de-dinero.md`. Este change implementa su **fase 1**.

## What Changes

**Un comportamiento nuevo: Guardar.**

- El usuario puede **guardar** un monto en una moneda, y **liberarlo**. Guardar **no mueve dinero ni genera un movimiento en el ledger**: cambia la función de plata que ya tiene.
- El **disponible** pasa a ser `saldo de cuentas participantes − guardado`. Es la única definición de "para gastar hoy".
- **Guardar tiene tope en el disponible.** Es la diferencia con el ledger: un saldo negativo es un hecho válido, pero guardar más de lo que tenés no es un estado incómodo — es un input inválido.
- **Gastar por encima de lo guardado deja el disponible negativo y NO reduce el guardado en silencio.** Grana avisa sin bloquear; borrarle la decisión al usuario para que el número cierre sería mentirle.

**Un atributo nuevo en cuentas: participación en el disponible.**

- Una cuenta cash/bank puede declararse **fuera del disponible** (plazo fijo, FCI, caja de seguridad, cuenta de inversión). Sigue siendo una cuenta normal con su saldo y su historial; simplemente no cuenta como plata para gastar hoy.
- La lista de Cuentas agrupa en dos bloques, y con eso ya responde *"¿cuánto tengo entre FCI, plazo fijo y dólares guardados?"* sin construir ninguna pantalla nueva.

**Dashboard: un solo número y dos renglones.**

- El Hero muestra el **disponible real**. Un único monto de plata: el usuario nunca se pregunta cuál es el suyo.
- Bajo la tira de "Resumen del mes", separadas por una regla, dos líneas que explican la diferencia entre el saldo y el disponible: **Guardaste este mes** y **Pasaste a otra cuenta**. La identidad sigue cerrando en pantalla, que es lo mejor que tiene la card.

**Fuera de alcance, explícitamente:**

- **No hay entrada nueva en la navegación.** "Guardado" no es un módulo: es un dato con vista de detalle, a la que se llega desde el dashboard. Qué hub agrupa ahorro/metas/posiciones se decide en fase 2, con uso real; hoy sería adivinar.
- **No se pide propósito.** Un campo "¿para qué?" sin metas que elegir es un campo muerto. El propósito llega en fase 2 y el schema queda preparado para recibirlo sin migración destructiva.
- **No hay valuación, rendimiento, patrimonio, horizonte ni datos externos de mercado.** Fases 3 y 4.

## Non-goals

- Sobres / zero-based budgeting. Apartar pesos que se licúan no es ahorrar; en Argentina el ahorro se expresa en el vehículo. El sistema de sobres queda descartado como modelo (a lo sumo, un modo opcional futuro).
- Que "fuera del disponible" signifique "guardado". Son dos fuentes independientes de no-disponibilidad: una es un **atributo de la posición**, la otra es una **decisión** del usuario. Ninguna implica la otra.
- Modificar el ledger, las reglas de signo, la analítica del mes o el corte temporal.

## Capabilities

### New Capabilities

- `savings`: guardar y liberar como decisión del usuario fuera del ledger, el disponible real derivado, el tope, la convivencia con el gasto y la vista de detalle.

### Modified Capabilities

- `accounts`:
  1. "Una cuenta puede declararse fuera del disponible" (nueva) — el atributo, sus restricciones y el agrupado de la lista.
- `dashboard`:
  1. "El Hero muestra el disponible total bimoneda" — el monto pasa a ser el disponible real.
  2. "La zona clara de la card de saldo muestra el Resumen del mes" — suma las dos líneas bajo la regla y extiende la identidad auditable.

## Impact

**Aditivo por construcción.** No se toca `get_owned_account_ids()`, ni `get_account_balance_sums`, ni `calculateTransactionSums`, ni las reglas de signo, ni la paridad SQL↔TS, ni la analítica del mes.

- **Migración** (`supabase/migrations/`): columna `accounts.counts_as_available`; tabla `savings_entry` con RLS; funciones `get_available_account_ids()` (derivada de `get_owned_account_ids()`) y `get_saved_sums()`.
- `packages/dashboard/`: composición del disponible real y de los dos términos nuevos del mes. `Moviste` se deriva como la **variación del saldo de las cuentas no participantes** entre los dos extremos del mes, reusando `get_account_balance_sums` con su corte por fecha — no como un caso especial de transferencia.
- `packages/accounts/`: el atributo en el view-model y el agrupado de la lista.
- `packages/validation/`: schema de guardar/liberar (monto > 0, moneda, fecha, tope).
- `apps/web` + `apps/mobile`: drawer de Guardar/Liberar (sobre `overlay-primitives`), las dos líneas del dashboard, la vista de detalle, el switch en el form de cuenta.
- `packages/i18n-messages`: copy nuevo.

## Aritmética

La identidad que la card deja verificar en pantalla:

```
Tenías + Entró − Se fué − Pasaste a otra cuenta − Guardaste  =  Disponible
```

Donde `Tenías` se **deriva** (no se lee) como `Disponible − (Entró − Se fué − Pasaste − Guardaste)`, igual que hoy, de modo que cierre por construcción y no porque dos lecturas coincidan.

Los dos términos nuevos son **flujos del mes**, nunca el stock acumulado. Poner el acumulado rompe la identidad.
