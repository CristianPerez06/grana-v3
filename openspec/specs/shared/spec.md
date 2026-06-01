# shared Specification

## Purpose

El módulo **Compartido** permite que dos personas convivientes repartan gastos comunes. Un gasto compartido **es** una transacción real en el ledger de quien paga (impacta su `disponible`) más un reparto por porcentaje (`shared_expense_split`); la deuda entre los miembros se **deriva** de esos splits menos las liquidaciones, **por moneda** y nunca persistida. Saldar la deuda mueve plata real entre cuentas mediante movimientos de tipo `settlement` (handshake liviano: el deudor registra el pago, el receptor asigna la cuenta donde lo recibió). Es el primer caso de **lectura cruzada entre usuarios** de v3: un miembro lee las transacciones compartidas de su hogar, mientras la escritura sigue siendo del dueño. Fase 1: hogares de dos miembros, con gastos compartidos en cualquier medio (efectivo, débito, tarjeta y cuotas) y reintegros compartidos que heredan el split. Se apoya en la capability `transactions` y en la bimoneda por defecto de v3.

## Requirements
### Requirement: El usuario puede crear un hogar compartido

El sistema SHALL permitir que un usuario cree un "hogar compartido" para repartir gastos con otra persona. El hogar se modela con una tabla `household` y una tabla junction `household_member` (un miembro por fila), de modo que el modelo no presupone exactamente dos columnas de usuario. En la Fase 1 un hogar admite como máximo dos miembros. Al crear el hogar, el creador queda registrado como su primer miembro y se inicializa un split por defecto de 50·50.

#### Scenario: Creación de hogar exitosa

- **WHEN** un usuario sin hogar activo confirma la creación de un hogar con un nombre no vacío (≤ 50 caracteres)
- **THEN** el sistema inserta una fila en `household`, una fila en `household_member` con el creador, e inicializa el split por defecto en 50·50
- **AND** el usuario queda vinculado a ese hogar como miembro

#### Scenario: Un usuario no puede pertenecer a dos hogares a la vez

- **WHEN** un usuario que ya es miembro de un hogar activo intenta crear otro hogar
- **THEN** el sistema rechaza la operación con un error y no crea el segundo hogar

#### Scenario: Nombre inválido es rechazado

- **WHEN** el usuario intenta crear un hogar con nombre vacío o de más de 50 caracteres
- **THEN** el sistema rechaza el input con error de validación

### Requirement: El usuario puede invitar a otra persona con un código

El sistema SHALL permitir que un miembro de un hogar con cupo libre genere un código de invitación único, con formato legible (ej. `GRANA-XXXX`, sin caracteres ambiguos) y vencimiento a las 48 horas de su creación. El código se persiste en `household_invite`.

#### Scenario: Generación de código de invitación

- **WHEN** un miembro de un hogar con menos de dos miembros solicita invitar a alguien
- **THEN** el sistema genera un código único, lo persiste con `expires_at` 48 horas en el futuro, y lo muestra para compartir

#### Scenario: No se puede invitar si el hogar está completo

- **WHEN** un miembro de un hogar que ya tiene dos miembros intenta generar una invitación
- **THEN** el sistema rechaza la operación

### Requirement: El usuario puede unirse a un hogar con un código

El sistema SHALL permitir que un usuario sin hogar se una a un hogar existente ingresando un código de invitación válido. El código debe existir, no estar vencido, no haber sido usado, y el hogar debe tener cupo. Al unirse, el split por defecto se reconfigura a 50·50 entre ambos miembros y la invitación se marca como usada.

#### Scenario: Unión exitosa con código válido

- **WHEN** un usuario sin hogar ingresa un código vigente, no usado, de un hogar con cupo
- **THEN** el sistema agrega al usuario como segundo miembro, marca la invitación como usada, y reconfigura el split por defecto a 50·50

#### Scenario: Código vencido o usado es rechazado

- **WHEN** un usuario ingresa un código vencido (más de 48 h) o ya utilizado
- **THEN** el sistema rechaza la unión con un error explicativo y no modifica el hogar

#### Scenario: No se puede unir si el hogar está completo

- **WHEN** un usuario ingresa un código de un hogar que ya tiene dos miembros
- **THEN** el sistema rechaza la unión

### Requirement: El usuario puede marcar un gasto como compartido con un split por porcentaje

El sistema SHALL permitir, mediante un toggle en el formulario de gasto, marcar un `expense` (cuenta cash/bank o tarjeta de crédito) como compartido. Un gasto compartido es una transacción **real** que impacta el saldo de quien paga, persistida con `is_shared = true` y `household_id`, más un reparto en `shared_expense_split` (una fila por miembro con su porcentaje y su monto asignado). El toggle solo está disponible si el usuario tiene un hogar activo con dos miembros. Los porcentajes SHALL sumar exactamente 100 y cada uno SHALL ser ≥ 1.

#### Scenario: Gasto compartido cash creado con split

- **WHEN** un usuario con hogar activo registra un gasto cash y activa "Compartir" con un split (ej. 50·50)
- **THEN** el sistema inserta la transacción con `type='expense'`, `is_shared=true` y `household_id`, impacta el saldo de la cuenta del pagador, e inserta una fila por miembro en `shared_expense_split`
- **AND** la suma de `amount_assigned` de los splits es igual al `amount` de la transacción

#### Scenario: Toggle oculto sin hogar de dos miembros

- **WHEN** un usuario sin hogar, o con un hogar de un solo miembro, abre el formulario de gasto
- **THEN** el toggle "Compartir" no se ofrece

#### Scenario: Porcentajes que no suman 100 son rechazados

- **WHEN** el usuario confirma un gasto compartido cuyos porcentajes no suman exactamente 100, o algún porcentaje es menor a 1
- **THEN** el sistema rechaza el input con error de validación

### Requirement: El reparto de un split no pierde ni inventa centavos

El sistema SHALL calcular los montos asignados de un split a partir de los porcentajes usando reparto de residuo (`Money.split`), de modo que la suma de los montos asignados sea exactamente igual al monto del gasto, sin centavos perdidos ni duplicados.

#### Scenario: Monto impar repartido 50·50

- **WHEN** se reparte un gasto de `$100,01` en un split 50·50
- **THEN** los montos asignados son `$50,01` y `$50,00` (o equivalente), y su suma es exactamente `$100,01`

### Requirement: Un gasto compartido de tarjeta en cuotas reparte el split en las cuotas hijas

El sistema SHALL soportar gastos compartidos pagados con tarjeta en cuotas. En ese caso los `shared_expense_split` se asocian a cada **cuota hija** (no a la transacción madre), de modo que cada cuota genera su propia porción de deuda en el mes de su vencimiento.

#### Scenario: Compra compartida en N cuotas

- **WHEN** un usuario registra un consumo compartido en tarjeta en 3 cuotas con split 50·50
- **THEN** el sistema crea la transacción madre y las 3 cuotas hijas, e inserta splits asociados a cada cuota hija
- **AND** la madre no tiene splits propios

### Requirement: La deuda neta del hogar se deriva por moneda y nunca se persiste

El sistema SHALL calcular la deuda neta entre los dos miembros como función pura de los splits y las liquidaciones registradas, separada por moneda (ARS y USD nunca se agregan). No existe columna de saldo de deuda cacheada; la deuda se recalcula en cada lectura. La convención de signo indica quién le debe a quién por moneda.

#### Scenario: Deuda derivada de un único gasto compartido

- **WHEN** A paga un gasto de `$100 ARS` compartido 50·50 con B, y no hay liquidaciones
- **THEN** el sistema deriva que B le debe `$50 ARS` a A, sin persistir ese número

#### Scenario: Deuda separada por moneda

- **WHEN** hay gastos compartidos en ARS y en USD
- **THEN** el sistema reporta una deuda neta por cada moneda, nunca una suma combinada

#### Scenario: Deudas menores al centavo se descartan

- **WHEN** la deuda neta resultante en una moneda es menor a un centavo
- **THEN** el sistema la reporta como "están al día" en esa moneda

### Requirement: Las cuotas futuras no impactan la deuda hasta su vencimiento

El sistema SHALL excluir del cálculo de deuda las cuotas de tarjeta cuyo `due_date` es posterior al cierre del mes corriente; cada cuota recién impacta la deuda en el mes de su vencimiento.

#### Scenario: Cuota que vence el mes próximo no cuenta hoy

- **WHEN** existe una cuota compartida con `due_date` en el mes siguiente al actual
- **THEN** esa cuota no aporta a la deuda neta del periodo corriente
- **AND** sí aportará cuando llegue su mes de vencimiento

### Requirement: El reintegro de un gasto compartido se reparte y reduce la deuda

El sistema SHALL tratar un `reimbursement` asociado a un gasto compartido como un movimiento **también compartido**: hereda los porcentajes del split del gasto origen (para cuotas, los de la cuota hija correspondiente), se persiste con `is_shared = true`, `household_id` y filas en `shared_expense_split`. La función de deuda SHALL sumar los splits de gasto en positivo y los de reintegro en negativo, de modo que un reintegro recibido **reduce la deuda por la parte del miembro que no lo recibió**. Solo el reintegro **recibido** (`received_at` seteado) SHALL afectar la deuda; el pendiente no. Ambos subtipos ("a cuenta" y "en resumen") reducen la deuda por igual; el subtipo solo determina el efecto en el ledger personal de quien lo recibió (ya definido en `transactions`).

#### Scenario: Reintegro "a cuenta" recibido baja la deuda por la parte del otro

- **WHEN** A pagó un gasto compartido de `$100.000 ARS` 50·50 (B le debe `$50.000`) y luego recibe un reintegro "a cuenta" de `$20.000` sobre ese gasto
- **THEN** el reintegro hereda el split 50·50, el saldo de A sube `$20.000`, y la deuda de B pasa a `$40.000` (se descontó su parte, `$10.000`, del reintegro)

#### Scenario: Reintegro pendiente no afecta la deuda

- **WHEN** A declara un reintegro **esperado** (pendiente) sobre un gasto compartido, aún no recibido
- **THEN** la deuda de B no cambia hasta que el reintegro pase a recibido

#### Scenario: Reintegro reconciliado por un monto menor

- **WHEN** A esperaba un reintegro de `$20.000` sobre un gasto compartido 50·50 pero recibe `$18.000`
- **THEN** la deuda de B se reduce por su parte del monto **recibido** (`$9.000`), no del esperado

#### Scenario: Reintegro "en resumen" compartido alinea su efecto con el período

- **WHEN** A tiene un consumo compartido en tarjeta y recibe un reintegro "en resumen" sobre él
- **THEN** el reintegro hereda el split del consumo (o de la cuota que reduce) y baja la deuda de B por su parte, en el período de tarjeta correspondiente
- **AND** mientras el reintegro esté pendiente no afecta la deuda

### Requirement: El usuario puede ver el dashboard del hogar

El sistema SHALL ofrecer una pantalla de hogar que muestre el balance de deuda por moneda en lenguaje claro ("le debés a X", "X te debe" o "están al día"), un acceso a saldar deuda cuando hay deuda viva, y la lista de gastos compartidos recientes con la porción propia de cada uno.

#### Scenario: Dashboard con deuda a favor

- **WHEN** B le debe dinero a A y A abre el dashboard del hogar
- **THEN** A ve "X te debe $…" por la moneda correspondiente y la lista de gastos compartidos recientes

#### Scenario: Dashboard al día

- **WHEN** no hay deuda neta en ninguna moneda
- **THEN** el dashboard muestra "están al día" y no ofrece el acceso a saldar deuda

### Requirement: El usuario puede saldar deuda registrando una liquidación

El sistema SHALL permitir que el miembro deudor registre una liquidación (total o parcial) seleccionando moneda, monto (≤ deuda actual en esa moneda) y la cuenta cash/bank de la que sale el dinero. La liquidación crea de inmediato un movimiento de tipo `settlement` real en la cuenta del pagador (su `disponible` baja) y persiste una fila en `settlement` con estado "pendiente de asignación de cuenta del receptor". El movimiento `settlement` impacta el saldo pero NO se cuenta como gasto categorizable ni aparece en los desgloses de "en qué se fue". El monto SHALL ser mayor a cero y no exceder la deuda vigente en esa moneda.

#### Scenario: Registrar una liquidación total

- **WHEN** A debe `$50 ARS` y registra una liquidación de `$50 ARS` desde su cuenta cash
- **THEN** el sistema crea un movimiento `settlement` de `$50 ARS` en la cuenta de A (su saldo baja, sin contar como gasto) y una fila `settlement` pendiente de asignación por B

#### Scenario: Monto que excede la deuda es rechazado

- **WHEN** A intenta registrar una liquidación por un monto mayor a su deuda vigente en esa moneda
- **THEN** el sistema rechaza la operación con error de validación

### Requirement: El receptor asigna la cuenta donde recibió la liquidación

El sistema SHALL mostrarle al miembro receptor las liquidaciones pendientes de asignar, y permitirle elegir la cuenta cash/bank donde recibió el dinero. Al asignar la cuenta, el sistema crea un movimiento `settlement` real en esa cuenta (su saldo sube, sin contar como ingreso) con la fecha de asignación, y marca la liquidación como completada. La deuda neta se recalcula en consecuencia. No existe un paso de aceptar/rechazar.

La corrección de errores SHALL ser libre mientras la liquidación está **pendiente** (solo existe la pata del pagador, que es su propio movimiento). Una vez **completada**, la pata del receptor es un movimiento de otro usuario; revertir la liquidación SHALL realizarse mediante una operación privilegiada acotada al hogar que revierte ambas patas de forma atómica, no mediante escritura cross-user desde el cliente.

#### Scenario: El receptor asigna su cuenta y recibe el ingreso

- **WHEN** B ve una liquidación pendiente de `$50 ARS` de A y selecciona su cuenta cash
- **THEN** el sistema crea un movimiento `settlement` entrante de `$50 ARS` en la cuenta de B, marca la liquidación como completada, y la deuda neta se reduce en consecuencia

#### Scenario: Corrección libre mientras está pendiente

- **WHEN** A registró una liquidación equivocada que aún está pendiente de asignación por B
- **THEN** A puede editar o eliminar la liquidación; eliminarla revierte su propio movimiento `settlement` y restaura su saldo

#### Scenario: Revertir una liquidación completada usa una operación privilegiada

- **WHEN** se necesita deshacer una liquidación que B ya completó
- **THEN** la reversión la realiza una operación privilegiada acotada al hogar que elimina ambas patas (la de A y la de B) de forma atómica
- **AND** el cliente no intenta borrar el movimiento del otro usuario directamente

### Requirement: El usuario puede configurar el split por defecto del hogar

El sistema SHALL permitir editar el split por defecto del hogar (ej. 50·50, 60·40), que se preselecciona al marcar un gasto como compartido. Los porcentajes SHALL sumar 100 y cada uno SHALL ser ≥ 1. El split por defecto puede sobrescribirse gasto por gasto.

#### Scenario: Cambiar el split por defecto a 60·40

- **WHEN** un miembro configura el split por defecto en 60·40 y guarda
- **THEN** los nuevos gastos compartidos preseleccionan 60·40, sin alterar los splits de gastos ya registrados

### Requirement: El usuario puede salir del hogar solo si no hay deuda viva

El sistema SHALL permitir que un miembro salga del hogar, desvinculándolo, siempre que no exista deuda neta pendiente en ninguna moneda ni dirección. Los gastos compartidos históricos se conservan. Si el hogar queda sin miembros, se marca inactivo.

#### Scenario: Salida bloqueada por deuda viva

- **WHEN** un miembro con deuda neta distinta de cero en alguna moneda intenta salir del hogar
- **THEN** el sistema bloquea la salida y explica que primero debe saldar la deuda

#### Scenario: Salida exitosa sin deuda

- **WHEN** un miembro sin deuda viva confirma salir del hogar
- **THEN** el sistema lo desvincula, conserva los gastos compartidos históricos, y marca el hogar inactivo si queda sin miembros

### Requirement: Las monedas del hogar son ARS y USD por defecto

El sistema SHALL operar el hogar sobre las mismas monedas que el resto de la app (ARS y USD habilitadas por defecto), sin una tabla de configuración de monedas por hogar. La deuda se calcula por moneda; no hay conversión automática entre ARS y USD.

#### Scenario: No hay conversión entre monedas

- **WHEN** existe deuda en ARS y en USD
- **THEN** el sistema las reporta y se saldan por separado, sin convertir una en la otra

### Requirement: Un miembro puede leer los datos compartidos de su hogar

El sistema SHALL aplicar Row Level Security sobre las tablas del módulo (`household`, `household_member`, `household_invite`, `shared_expense_split`, `settlement`) de forma que un usuario solo acceda a los datos de su propio hogar. Adicionalmente, un miembro SHALL poder leer las cuentas del otro miembro estrictamente en la medida necesaria para seleccionar destino/origen al liquidar.

#### Scenario: Lectura acotada al propio hogar

- **WHEN** un usuario consulta `shared_expense_split` o `settlement`
- **THEN** Supabase retorna únicamente las filas cuyo `household_id` corresponde al hogar del usuario

#### Scenario: Un extraño no ve datos del hogar

- **WHEN** un usuario que no pertenece a un hogar consulta sus datos compartidos
- **THEN** Supabase no retorna ninguna fila de ese hogar

