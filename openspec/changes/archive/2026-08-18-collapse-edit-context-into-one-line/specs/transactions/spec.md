## MODIFIED Requirements

### Requirement: El sistema usa un formulario único para crear y editar movimientos

El sistema SHALL usar **un único formulario** para crear y editar todo tipo de movimiento (ingreso, gasto, transferencia, ajuste, cambio de moneda, consumo de tarjeta y compra en cuotas). En **modo creación** el usuario elige el tipo y la cuenta dentro del formulario; en **modo edición** el tipo, la moneda y la(s) cuenta(s) se muestran como contexto inmutable y sólo se ofrecen los campos editables.

Un campo bloqueado NO SHALL desaparecer de la pantalla: cuando `getEditableFields` bloquea el **monto** o la **fecha** —un consumo de tarjeta ya pagado, una compra en cuotas madre con alguna cuota paga—, el formulario SHALL mostrar ese valor como contexto read-only. Bloquear un campo significa impedir su edición, nunca ocultar el dato: sin el monto y la fecha a la vista, el usuario estaría editando un movimiento cuyos dos hechos identificatorios no aparecen en ninguna parte.

**El contexto inmutable es una sola línea.** Todo lo que en edición no se puede cambiar —tipo, moneda, cuenta(s), cantidad de cuotas, y el monto y la fecha cuando están bloqueados— SHALL presentarse como **una única línea de texto atenuado debajo del monto**, con los valores separados por `·` y un solo caption de "no editable" al final. NO SHALL presentarse como filas etiquetadas apiladas: son datos sobre los que el usuario no puede actuar y no deben empujar hacia abajo los campos que vino a editar. Cuando el **monto** está bloqueado SHALL encabezar esa línea con peso visual pleno —es el número identificatorio del movimiento— y el resto SHALL quedar atenuado. La regla vale para las tres superficies (web escritorio, web en viewport angosto y app nativa).

Qué campos son editables y cuáles visibles según el tipo y el estado del movimiento SHALL derivarse de una **función pura** (`getEditableFields`) en `@grana/money-logic`, única fuente de verdad de esas reglas, reutilizable por web y mobile. Esta función NO cambia las reglas de editabilidad ya especificadas (ingreso/gasto, transferencia, ajuste, consumo `pending`/`paid`, madre de cuotas con o sin cuota pagada, pago de resumen sin categoría); las centraliza.

En **modo creación**, el selector de cuenta SHALL mostrar el **saldo disponible actual de cada cuenta por moneda** (bimoneda). Las tarjetas de crédito NO muestran saldo (son off-ledger).

**Cambios sin guardar.** El formulario SHALL exponer si algún campo que el usuario puede cambiar difiere de lo que el formulario abrió (estado *dirty*), derivado en el hook compartido y no en cada plataforma. Sobre eso:

- En **modo edición**, el CTA de guardar SHALL estar deshabilitado mientras no haya ningún cambio. Guardar sin cambios dispararía igual la mutation, invalidaría el cache y cerraría como si hubiera pasado algo.
- Cuando el formulario vive en un **overlay** (el drawer de alta y el de edición en web), cerrarlo con cambios sin guardar SHALL pedir confirmación antes de descartarlos, y SHALL hacerlo por **todos** los caminos de cierre —la ✕ del propio formulario, `Esc` y el click en el scrim—, no sólo por el botón. La confirmación ofrece descartar o seguir editando; descartar cierra y pierde los cambios, seguir editando deja el formulario intacto.
- Un submit exitoso NO SHALL pedir confirmación: ya no hay nada que perder.

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
- **AND** muestra el monto y la fecha en la línea de contexto read-only, con caption de "no editable"
- **AND** el monto encabeza la línea con peso pleno y conserva su signo y su símbolo de moneda, de modo que se lee igual que en el detalle

#### Scenario: El contexto inmutable ocupa una línea, no una card

- **WHEN** el usuario abre cualquier movimiento en modo edición
- **THEN** el tipo, la moneda y la(s) cuenta(s) se leen en una sola línea atenuada debajo del monto, separados por `·`, cerrada por un único "no editable"
- **AND** NO se dibuja una card de filas etiquetadas para esos datos
- **AND** los campos editables quedan inmediatamente debajo, sin bloque intermedio que los empuje

#### Scenario: Guardar está deshabilitado mientras no haya cambios

- **WHEN** el usuario abre un movimiento en modo edición y no toca ningún campo
- **THEN** el CTA de guardar está deshabilitado
- **AND** en cuanto cambia un campo, se habilita
- **AND** si deshace el cambio y vuelve al valor original, se deshabilita de nuevo

#### Scenario: Cerrar el overlay con cambios pide confirmación

- **WHEN** el usuario editó algún campo en el drawer y lo cierra —con la ✕, con `Esc` o clickeando el scrim—
- **THEN** el sistema pide confirmación antes de descartar
- **AND** "seguir editando" deja el formulario como estaba, con los cambios intactos
- **AND** "descartar" cierra el drawer y pierde los cambios

#### Scenario: Cerrar sin cambios no molesta

- **WHEN** el usuario abre el drawer, no cambia nada y lo cierra
- **THEN** el drawer se cierra directamente, sin confirmación

#### Scenario: El selector de cuenta muestra el saldo por moneda

- **WHEN** el usuario abre el formulario de alta y despliega el selector de cuenta
- **THEN** cada cuenta de efectivo/banco muestra su saldo disponible actual por moneda
- **AND** las tarjetas de crédito no muestran saldo
