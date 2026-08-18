## MODIFIED Requirements

### Requirement: El sistema usa un formulario único para crear y editar movimientos

El sistema SHALL usar **un único formulario** para crear y editar todo tipo de movimiento (ingreso, gasto, transferencia, ajuste, cambio de moneda, consumo de tarjeta y compra en cuotas). En **modo creación** el usuario elige el tipo y la cuenta dentro del formulario; en **modo edición** el tipo, la moneda y la(s) cuenta(s) se muestran como contexto inmutable y sólo se ofrecen los campos editables.

Un campo bloqueado NO SHALL desaparecer de la pantalla: cuando `getEditableFields` bloquea el **monto** o la **fecha** —un consumo de tarjeta ya pagado, una compra en cuotas madre con alguna cuota paga—, el formulario SHALL mostrar ese valor como **fila de contexto read-only**, junto al tipo, la moneda y la(s) cuenta(s), con el mismo caption de "no editable". Bloquear un campo significa impedir su edición, nunca ocultar el dato: sin el monto y la fecha a la vista, el usuario estaría editando un movimiento cuyos dos hechos identificatorios no aparecen en ninguna parte. La regla vale para las tres superficies (web escritorio, web en viewport angosto y app nativa).

Qué campos son editables y cuáles visibles según el tipo y el estado del movimiento SHALL derivarse de una **función pura** (`getEditableFields`) en `@grana/money-logic`, única fuente de verdad de esas reglas, reutilizable por web y mobile. Esta función NO cambia las reglas de editabilidad ya especificadas (ingreso/gasto, transferencia, ajuste, consumo `pending`/`paid`, madre de cuotas con o sin cuota pagada, pago de resumen sin categoría); las centraliza.

En **modo creación**, el selector de cuenta SHALL mostrar el **saldo disponible actual de cada cuenta por moneda** (bimoneda). Las tarjetas de crédito NO muestran saldo (son off-ledger).

#### Scenario: El mismo formulario crea y edita

- **WHEN** el usuario crea un movimiento nuevo y, en otro momento, edita uno existente
- **THEN** ambas pantallas usan el mismo formulario
- **AND** en edición el tipo, la moneda y la cuenta se muestran como contexto no editable

#### Scenario: La editabilidad la decide una función pura

- **WHEN** el formulario renderiza un movimiento en modo edición
- **THEN** los campos editables y visibles se determinan por `getEditableFields` según el tipo y estado del movimiento
- **AND** un consumo de tarjeta `paid` o una compra en cuotas con alguna cuota `paid` sólo permite editar categoría/descripción (monto y fecha bloqueados)

#### Scenario: Un monto bloqueado se muestra igual, como contexto

- **WHEN** el usuario abre en edición un consumo de tarjeta ya pagado, o la madre de una compra en cuotas con alguna cuota paga
- **THEN** el formulario NO ofrece el campo de monto ni el de fecha para editarlos
- **AND** muestra el monto y la fecha como filas de contexto read-only, con caption de "no editable", junto al tipo, la moneda y la cuenta
- **AND** el monto conserva su signo y su símbolo de moneda, de modo que se lee igual que en el detalle

#### Scenario: El selector de cuenta muestra el saldo por moneda

- **WHEN** el usuario abre el formulario de alta y despliega el selector de cuenta
- **THEN** cada cuenta de efectivo/banco muestra su saldo disponible actual por moneda
- **AND** las tarjetas de crédito no muestran saldo
