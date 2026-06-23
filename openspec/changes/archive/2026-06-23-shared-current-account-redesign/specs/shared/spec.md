## ADDED Requirements

### Requirement: El usuario puede ver la cuenta corriente del hogar

El sistema SHALL ofrecer una pantalla de **cuenta corriente** (`/shared/cuenta-corriente`) que presenta la deuda entre los dos miembros como un **libro derivado** (nunca persistido), **por moneda**. La pantalla SHALL mostrar: (a) el **saldo actual** por moneda (ARS y USD siempre visibles, nunca fusionadas), con la dirección en lenguaje claro ("a favor de X"); (b) una **ecuación** colapsable "Cómo llegamos a este saldo" con los agregados (partes del otro en lo que pagó uno, tus partes en lo que pagó el otro, reintegros y liquidaciones, = saldo); (c) un **extracto** cronológico (más reciente arriba) donde cada asiento muestra fecha, movimiento, **"qué cambia"** en castellano natural, **importe firmado** y **saldo corriente**; (d) un divisor **"Hoy"** y un tramo **"Lo que se viene"** con la proyección por mes. El extracto se deriva de los mismos splits y liquidaciones que la deuda; el **saldo final del extracto SHALL igualar** la deuda derivada (`householdDebtAt`).

#### Scenario: El extracto deriva el saldo corriente

- **WHEN** el hogar tiene gastos compartidos, reintegros y liquidaciones en una moneda
- **THEN** la cuenta corriente lista cada asiento con su importe firmado y un saldo corriente
- **AND** el saldo del asiento más reciente iguala la deuda neta derivada de esa moneda

#### Scenario: La ecuación explica el saldo

- **WHEN** el usuario abre la cuenta corriente
- **THEN** ve los agregados (partes del otro, tus partes, reintegros y liquidaciones) que suman el saldo actual
- **AND** puede colapsar/expandir la ecuación

#### Scenario: Bimoneda siempre visible en la cuenta corriente

- **WHEN** hay saldo en una sola moneda
- **THEN** la otra moneda sigue visible (aunque sea cero), sin fusionarse

### Requirement: La reversión de una liquidación es un contraasiento, no un borrado

El sistema SHALL revertir una liquidación **completada** mediante un **contraasiento**: la liquidación original se preserva marcada como `reversed` y se registra un asiento opuesto que anula su efecto, de modo que el historial conserva ambas líneas (la original tachada como "Revertida" y el "Contraasiento"). La reversión SHALL ejecutarse mediante una operación privilegiada acotada al hogar (`SECURITY DEFINER`), que restaura el `disponible` de ambas cuentas con patas `settlement` opuestas y deja la deuda neta como si la liquidación no hubiera ocurrido (la original y el contraasiento se cancelan). NO SHALL borrarse físicamente ninguna fila.

#### Scenario: Revertir preserva la historia

- **WHEN** se revierte una liquidación completada
- **THEN** la liquidación original queda marcada como revertida (no se borra) y se agrega un contraasiento que anula su efecto
- **AND** el extracto muestra ambas líneas y la deuda neta vuelve al estado previo

#### Scenario: El saldo de las cuentas se restaura

- **WHEN** se revierte una liquidación completada de `$X`
- **THEN** el `disponible` del pagador sube `$X` y el del receptor baja `$X` (patas opuestas), sin borrar los movimientos originales

## MODIFIED Requirements

### Requirement: El usuario puede ver el dashboard del hogar

El sistema SHALL ofrecer una pantalla de hogar (home de Compartido) organizada por **mes**, con un navegador de mes (`‹ mes ›`). El navegador **gobierna solo la actividad del mes** (gasto y desglose): la **deuda y la proyección NO dependen del navegador** — son "hoy" (deuda neta a hoy; proyección siempre desde hoy hacia adelante). Para el mes seleccionado, la pantalla SHALL mostrar:

- **Hero "Gasto del hogar · neto":** el **neto protagonista** (`gastaron − reintegros`) en grande, con el bruto y los reintegros como dato secundario al costado. El gasto se cuenta en base **DEVENGADO** (por fecha de compra; cada cuota en su mes), total del hogar (ambas partes). Bimoneda siempre visible (USD subordinado). Debajo, **"En qué gastaron"**: el desglose por categoría en ARS y USD con **drill inline conservado** (tocar una categoría despliega sus movimientos sin navegar fuera).
- **Deuda fuera del hero:** la deuda neta por moneda vive en una **franja/tile propia fija en "hoy"** (no en el hero navegable), en lenguaje claro ("le debés a X" / "X te debe" / "están al día"), con accesos a **Saldar** (cuando hay deuda viva) y a **Cuenta corriente**. Presentada con `text-expense`/`text-income`, nunca en rojo.
- **Lo que se viene:** tile de proyección (derivada con `asOf` corrido a cada mes), independiente del navegador.
- **Últimos movimientos:** la lista de movimientos compartidos del mes con el formato de `MovementRow`.

La pantalla SHALL ofrecer el **alta de movimiento** (CTA primary en web; FAB en mobile) y el acceso a **Configuración del hogar** como ícono. Los integrantes NO se muestran en la home.

#### Scenario: El navegador mueve solo la actividad, no la deuda ni la proyección

- **WHEN** el usuario cambia el navegador de mes
- **THEN** cambian el gasto del mes y su desglose
- **AND** la deuda (de hoy) y la proyección (desde hoy) NO cambian

#### Scenario: El neto es protagonista

- **WHEN** el mes tiene gastos y reintegros compartidos
- **THEN** el hero muestra el neto en grande y el bruto/reintegros como dato secundario

#### Scenario: La deuda vive fuera del hero, en "hoy"

- **WHEN** hay deuda viva
- **THEN** se muestra en una franja propia (no en el hero navegable) con accesos a Saldar y Cuenta corriente

#### Scenario: Ver en qué se gastó por categoría, en ambas monedas

- **WHEN** un usuario abre la home con gastos compartidos devengados en ARS y USD
- **THEN** ve el desglose por categoría en ambas monedas, con drill inline por categoría

#### Scenario: Los integrantes no están en la home

- **WHEN** un usuario abre la home de Compartido
- **THEN** no ve el bloque de integrantes; viven en Configuración del hogar

### Requirement: El usuario puede saldar deuda registrando una liquidación

El sistema SHALL permitir que el miembro deudor registre una liquidación (total o parcial) mediante un **drawer** (primitivo `Drawer` de `overlay-primitives`, mismo patrón que el alta de movimiento), disparado desde la home o la cuenta corriente. El drawer SHALL ofrecer **montos rápidos** (Total y parciales; el resto queda registrado en la cuenta corriente), la cuenta cash/bank de origen **con su saldo disponible**, una **anotación pedagógica** del monto por persona ("la parte de {otro} se registra como deuda a tu favor"), y un **aviso no bloqueante de saldo negativo** cuando la cuenta elegida quedaría en `disponible < 0`. El registro SHALL ejecutarse mediante una operación privilegiada atómica que crea la pata del pagador (movimiento `settlement`, `payer_id` server-side) y la fila `settlement` (pendiente de asignación), sin pata huérfana. El movimiento `settlement` impacta el saldo pero NO cuenta como gasto. El monto SHALL ser mayor a cero y no exceder la deuda vigente en esa moneda.

#### Scenario: Saldar total desde el drawer

- **WHEN** A debe `$50 ARS` y elige "Total" en el drawer desde su cuenta cash
- **THEN** se registra la liquidación de `$50 ARS` (pata del pagador + fila pendiente), su saldo baja, y la deuda con B queda saldada

#### Scenario: Saldar parcial deja el resto en la cuenta corriente

- **WHEN** A debe `$50 ARS` y registra una liquidación parcial de `$30 ARS`
- **THEN** se registra `$30 ARS` y el resto (`$20 ARS`) queda como saldo vivo en la cuenta corriente

#### Scenario: Anotación pedagógica del monto por persona

- **WHEN** A abre el drawer de saldar
- **THEN** ve el detalle pedagógico de qué representa el monto (la parte del otro como deuda a su favor)

#### Scenario: Aviso de saldo negativo al saldar

- **WHEN** A elige una cuenta cuyo `disponible` quedaría en negativo tras pagar
- **THEN** el drawer muestra el aviso no bloqueante de saldo negativo, sin impedir el pago

#### Scenario: Monto que excede la deuda es rechazado

- **WHEN** A intenta una liquidación por más que su deuda vigente en esa moneda
- **THEN** el sistema la rechaza con error de validación
