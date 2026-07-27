## ADDED Requirements

### Requirement: El usuario puede deshacer el pago de un resumen

El sistema SHALL permitir deshacer el pago de un resumen ya pagado, revirtiendo de forma **atómica** todo lo que el pago escribió del lado del dinero:

- SHALL borrar la fila de `period_payments` del período;
- SHALL devolver a `pending` todos los movimientos del período que el pago barrió a `paid`;
- SHALL borrar el movimiento de impuesto de sellos registrado por ese pago, si existe;
- SHALL borrar el gasto-débito registrado en la cuenta de pago.

Tras la reversión, el período SHALL volver a derivar su estado como impago (`closed` u `overdue` según la fecha), su deuda SHALL reaparecer en los cálculos de pendiente, y el saldo de la cuenta de pago SHALL recuperar el monto del gasto-débito.

La operación SHALL ser todo-o-nada: si cualquier paso falla, el sistema SHALL dejar el período exactamente como estaba y comunicar el error, sin estados intermedios observables.

La reversión NO SHALL deshacer los efectos del pago sobre el **calendario** de la tarjeta: las fechas confirmadas del ciclo en curso, el período estimado creado y las reasignaciones de consumos entre períodos SHALL permanecer. Esas fechas son hechos del resumen real y no dependen de que el pago se haya cargado correctamente.

La reversión tampoco SHALL modificar la alícuota de impuesto de sellos aprendida por la tarjeta (`accounts.stamp_tax_rate`).

Solo el dueño de la tarjeta SHALL poder deshacer el pago.

#### Scenario: Deshacer un pago devuelve el resumen a impago

- **WHEN** el usuario deshace el pago de un resumen que tenía tres consumos y una cuota, pagado con un gasto-débito de $120.000 desde "Banco Galicia"
- **THEN** los cuatro movimientos del período vuelven a `pending`
- **AND** el gasto-débito de $120.000 desaparece y el saldo de "Banco Galicia" aumenta $120.000
- **AND** el resumen vuelve a figurar como impago, con su deuda incluida en el pendiente de la tarjeta

#### Scenario: Deshacer un pago con impuesto de sellos borra el sello

- **WHEN** el usuario deshace un pago que había registrado un impuesto de sellos de $1.800 dentro del período
- **THEN** el movimiento de impuesto de sellos se elimina
- **AND** no queda ningún movimiento de sello dentro del resumen ahora impago

#### Scenario: La alícuota aprendida sobrevive a la reversión

- **WHEN** el usuario deshace el pago que le hizo aprender a la tarjeta su alícuota de sellos
- **THEN** la `stamp_tax_rate` de la tarjeta se mantiene
- **AND** al volver a pagar el resumen el monto de sello viene pre-cargado, sin volver a preguntar como si fuera la primera vez

#### Scenario: Las fechas confirmadas del ciclo en curso se mantienen

- **WHEN** el usuario deshace un pago que había confirmado las fechas del ciclo en curso y creado el período estimado siguiente
- **THEN** el ciclo en curso conserva sus fechas confirmadas y sigue sin ser estimado
- **AND** el período estimado siguiente sigue existiendo con los consumos que tuviera imputados

#### Scenario: La reversión es atómica

- **WHEN** la reversión falla al borrar el gasto-débito
- **THEN** los movimientos del período siguen en `paid`, la fila de `period_payments` sigue existiendo y el resumen sigue figurando como pagado
- **AND** el sistema informa el error

---

### Requirement: Deshacer un pago exige orden cronológico inverso

El sistema NO SHALL permitir deshacer el pago de un resumen si existe un resumen **posterior** de la misma tarjeta que ya esté pagado. El usuario SHALL deshacer los pagos del más nuevo al más viejo.

Cuando la operación se bloquea por esta regla, el sistema SHALL comunicarlo con un mensaje que identifique cuál es el pago que hay que deshacer primero, sin exponer detalles técnicos.

#### Scenario: Bloqueo por resumen posterior pagado

- **WHEN** el usuario intenta deshacer el pago del resumen de marzo, y el resumen de abril de la misma tarjeta ya está pagado
- **THEN** el sistema rechaza la operación
- **AND** informa que primero debe deshacerse el pago del resumen de abril

#### Scenario: El resumen más reciente pagado se puede deshacer

- **WHEN** el usuario deshace el pago del resumen de abril, siendo el pago más reciente de esa tarjeta
- **THEN** la operación se ejecuta normalmente
- **AND** a continuación el pago de marzo también puede deshacerse

---

### Requirement: El pago de un resumen registra el vínculo con su movimiento de impuesto de sellos

Cuando un pago registra un movimiento de impuesto de sellos, el sistema SHALL persistir el vínculo entre el pago y ese movimiento, de modo que la identificación del sello no dependa de heurísticas sobre categoría y período.

Si el movimiento de sello se elimina por separado, el vínculo SHALL quedar vacío sin bloquear ese borrado ni afectar al resto del pago.

Para pagos registrados **antes** de que existiera este vínculo, la reversión SHALL identificar el sello por su período y subcategoría, y SHALL borrarlo únicamente si encuentra **exactamente un** candidato. Si encuentra más de uno, NO SHALL borrar ninguno y SHALL completar la reversión informando que el movimiento de sello quedó en el resumen para revisión manual.

#### Scenario: Un pago nuevo con sello queda vinculado

- **WHEN** el usuario paga un resumen confirmando un monto de sello mayor a cero
- **THEN** el pago queda vinculado al movimiento de sello registrado
- **AND** al deshacer ese pago el sello se identifica por el vínculo, sin heurística

#### Scenario: Pago viejo con un único sello candidato

- **WHEN** el usuario deshace un pago anterior al vínculo, cuyo período contiene un solo movimiento con subcategoría de impuesto de sellos
- **THEN** ese movimiento se elimina como parte de la reversión

#### Scenario: Pago viejo con sello ambiguo

- **WHEN** el usuario deshace un pago anterior al vínculo, y el período contiene dos movimientos con subcategoría de impuesto de sellos (uno cargado a mano)
- **THEN** la reversión se completa sin borrar ninguno de los dos
- **AND** el sistema informa que quedó un movimiento de sello en el resumen para revisar

---

### Requirement: El detalle de período expone la acción "Deshacer pago"

En un período pagado, la pantalla `/cards/[id]/periods/[periodId]` SHALL ofrecer la acción **"Deshacer pago"**, junto a la información del pago ya existente. La acción SHALL requerir confirmación explícita.

El diálogo de confirmación SHALL enumerar los efectos con los números reales de ese pago: el monto que vuelve a la cuenta de pago y su nombre, la cantidad de movimientos que vuelven a pendiente, y el movimiento de impuesto de sellos que se elimina cuando existe. SHALL además aclarar que las fechas confirmadas del ciclo en curso se mantienen.

En un período impago la acción NO SHALL renderizarse.

#### Scenario: Confirmación enumera los efectos reales

- **WHEN** el usuario toca "Deshacer pago" en un período pagado con $120.000 desde "Banco Galicia", con cuatro movimientos y un sello
- **THEN** el diálogo indica que $120.000 vuelven a "Banco Galicia", que cuatro movimientos vuelven a pendiente y que se elimina el impuesto de sellos
- **AND** aclara que las fechas ya confirmadas del ciclo en curso no se modifican

#### Scenario: Período impago no ofrece la acción

- **WHEN** el usuario abre un período `closed` sin pago
- **THEN** la pantalla no muestra la acción "Deshacer pago"

#### Scenario: Tras deshacer, la pantalla refleja el nuevo estado

- **WHEN** el usuario confirma "Deshacer pago"
- **THEN** la pantalla deja de mostrar la información del pago
- **AND** los movimientos del período aparecen como pendientes, sin recarga manual
