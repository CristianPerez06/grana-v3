## MODIFIED Requirements

### Requirement: El usuario puede ver el dashboard del hogar

El sistema SHALL ofrecer una pantalla de hogar (home de Compartido) organizada por **mes**, con un navegador de mes (`‹ mes ›`) que comparte el patrón del dashboard. Para el mes seleccionado, la pantalla SHALL mostrar:

- **Balance / decisión:** el gasto compartido total del mes ("Gastaron juntos") y la deuda neta por moneda en lenguaje claro ("le debés a X", "X te debe" o "están al día"), con un acceso a saldar deuda cuando hay deuda viva. La deuda se presenta con `text-expense` (debés) / `text-income` (te deben), nunca en rojo. La **bimoneda** (ARS + USD) se muestra **siempre** (aunque sea cero), sin fusionar monedas, integrada en las secciones de balance (USD inline, no en una fila aparte). "Gastaron juntos" cuenta los gastos en base **DEVENGADO**, por **fecha de compra**: efectivo/débito por su fecha, consumo de tarjeta por su **fecha de compra** (no por el resumen), y cada **cuota** en **su** mes. Es el **total del hogar** (ambas partes), no la parte propia; "tu parte" se deriva del total. El **reloj del gasto es devengado**, distinto del reloj de la **deuda** (impacto), igual que CONSUMO vs CAJA en Movimientos.
- **Próximos compromisos:** una proyección de lo que entra cuando venza cada resumen/cuota futura, derivada por mes (la misma deuda derivada evaluada con `asOf` corrido a cada mes). Una sola card con los próximos meses; el headline de cada mes es el **neto acumulado** a ese mes y el detalle desplegable lista los movimientos que entran; un mes sin movimientos se muestra sin importe. La proyección y la deuda siguen en reloj de **impacto** (no cambian con el devengado del gasto).
- **En qué gastaron:** el desglose del gasto compartido del mes (**devengado**, como "Gastaron juntos", total del hogar) por categoría con su color, **separado por moneda (ARS y USD)** — ambas monedas se muestran siempre, USD subordinado pero nunca oculto. Al tocar una categoría se **despliega inline** el detalle de los movimientos que la componen (no navega fuera). Reutiliza el sistema de color de desglose existente.
- **Últimos movimientos:** la lista de movimientos compartidos del mes, presentados con el **mismo formato del módulo Movimientos** (`MovementRow`): ícono de categoría, título, taxonomía **categoría › subcategoría**, chips de estado (incl. reintegro), y monto con tono `income`/`expense`.

La pantalla SHALL ofrecer el **alta de movimiento** mediante el `Button` de la librería (CTA primary en el header en web; FAB `size="fab"` en mobile), y el acceso a **Configuración del hogar** como **ícono** (no como texto). El bloque de **integrantes del hogar** NO se muestra en la home; vive en `/shared/settings`.

#### Scenario: El balance de hoy refleja lo impactado y la proyección explica el futuro

- **WHEN** en el mes corriente hay un consumo compartido de tarjeta que vence el mes próximo y un reintegro "a cuenta" recibido sobre él
- **THEN** el balance de deuda de hoy refleja el reintegro impactado (p. ej. "X te debe $7.713"), sin esconderlo
- **AND** "Próximos compromisos" muestra el saldo neto acumulado al mes del resumen (p. ej. "Julio · le debés $43.284")

#### Scenario: Navegar a un mes futuro muestra su proyección

- **WHEN** el usuario mueve el navegador de mes a julio
- **THEN** ve los compromisos que entran en julio (resúmenes de tarjeta y cuotas) con su monto

#### Scenario: Ver en qué se gastó por categoría, en ambas monedas

- **WHEN** un usuario abre la home con gastos compartidos devengados en el mes, en ARS y en USD
- **THEN** ve el desglose por categoría del gasto compartido del mes **en ARS y en USD** (USD subordinado, siempre visible aunque sea cero)
- **AND** al tocar una categoría se despliega inline el detalle de los movimientos que la componen

#### Scenario: Un consumo de tarjeta comprado este mes cuenta en el gasto del mes (devengado)

- **WHEN** existe un consumo compartido de tarjeta comprado este mes cuyo resumen vence el mes próximo
- **THEN** SÍ cuenta en "Gastaron juntos" y en el desglose por categoría del mes corriente (devengado, por fecha de compra)
- **AND** NO aporta a la deuda del mes corriente hasta el mes de su resumen (la deuda sigue en reloj de impacto)

#### Scenario: Cada cuota compartida cuenta en su propio mes

- **WHEN** una compra compartida en 3 cuotas se devenga a lo largo de tres meses
- **THEN** "Gastaron juntos" y el desglose cuentan cada cuota en **su** mes (no el total en el mes de la compra)

#### Scenario: Los integrantes no están en la home

- **WHEN** un usuario abre la home de Compartido
- **THEN** no ve el bloque de integrantes en la home
- **AND** los integrantes se listan en Configuración del hogar

### Requirement: El usuario puede saldar deuda registrando una liquidación

El sistema SHALL permitir que el miembro deudor registre una liquidación (total o parcial) seleccionando moneda, monto (≤ deuda actual en esa moneda) y la cuenta cash/bank de la que sale el dinero. El registro SHALL ejecutarse mediante una **operación privilegiada atómica** que crea la pata del pagador (un movimiento de tipo `settlement` real en su cuenta, con `user_id` y `payer_id` fijados server-side desde la identidad del caller) **y** la fila `settlement` (estado "pendiente de asignación de cuenta del receptor") en una sola transacción, sin posibilidad de dejar una pata huérfana. El movimiento `settlement` impacta el saldo pero NO se cuenta como gasto categorizable ni aparece en los desgloses de "en qué se fue". El monto SHALL ser mayor a cero y no exceder la deuda vigente en esa moneda (validación server-side previa a la operación).

Cuando la cuenta cash/bank elegida quedaría con `disponible < 0` luego del pago, el formulario SHALL mostrar un **aviso no bloqueante de saldo negativo** (regla transversal de Grana: informa, no impide), reutilizando el mismo util y componente que el alta de movimiento. El aviso NO bloquea la confirmación.

#### Scenario: Registrar una liquidación total

- **WHEN** A debe `$50 ARS` y registra una liquidación de `$50 ARS` desde su cuenta cash
- **THEN** la operación privilegiada crea, en una sola transacción, un movimiento `settlement` de `$50 ARS` en la cuenta de A (su saldo baja, sin contar como gasto) y una fila `settlement` pendiente de asignación por B

#### Scenario: Monto que excede la deuda es rechazado

- **WHEN** A intenta registrar una liquidación por un monto mayor a su deuda vigente en esa moneda
- **THEN** el sistema rechaza la operación con error de validación

#### Scenario: El alta no puede dejar una pata huérfana

- **WHEN** falla la inserción de la fila `settlement` durante el registro
- **THEN** la pata del pagador tampoco persiste (la operación es atómica), y el saldo de A queda intacto

#### Scenario: Aviso de saldo negativo al saldar

- **WHEN** A elige una cuenta cuyo `disponible` quedaría en negativo tras pagar el monto de la liquidación
- **THEN** el formulario muestra el aviso no bloqueante de saldo negativo, con el monto proyectado
- **AND** A puede confirmar el pago igualmente (el aviso informa, no impide)
