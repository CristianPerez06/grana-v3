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

El sistema SHALL permitir que un usuario sin hogar se una a un hogar existente ingresando un código de invitación válido, **únicamente a través de una operación privilegiada (`SECURITY DEFINER`) acotada al código**. El código debe existir, no estar vencido, no haber sido usado, y el hogar debe estar activo y tener cupo. La operación SHALL, de forma atómica: agregar al usuario como segundo miembro, marcar la invitación como usada, y reconfigurar el split por defecto a 50·50. Un usuario NO SHALL poder sumarse a un hogar mediante escritura directa del cliente sin una invitación válida, ni descubrir hogares ajenos enumerando invitaciones (ver el requisito de RLS).

#### Scenario: Unión exitosa con código válido

- **WHEN** un usuario sin hogar ingresa un código vigente, no usado, de un hogar activo con cupo
- **THEN** la operación privilegiada agrega al usuario como segundo miembro, marca la invitación como usada, y reconfigura el split por defecto a 50·50, todo de forma atómica

#### Scenario: Código vencido o usado es rechazado

- **WHEN** un usuario ingresa un código vencido (más de 48 h) o ya utilizado
- **THEN** el sistema rechaza la unión con un error explicativo distinguible (vencido / usado) y no modifica el hogar

#### Scenario: No se puede unir si el hogar está completo

- **WHEN** un usuario ingresa un código de un hogar que ya tiene dos miembros
- **THEN** el sistema rechaza la unión

#### Scenario: No se puede sumar a un hogar sin una invitación válida

- **WHEN** un usuario logueado intenta insertarse como miembro de un hogar ajeno por escritura directa (sin pasar por la operación privilegiada y sin un código válido)
- **THEN** la base rechaza el INSERT: el self-insert directo solo está permitido para el creador como primer miembro de su propio hogar

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

El sistema SHALL ofrecer una pantalla de hogar (home de Compartido) organizada por **mes**, con un navegador de mes (`‹ mes ›`). El navegador **gobierna solo la actividad del mes** (gasto y desglose): la **deuda y la proyección NO dependen del navegador** — son "hoy" (deuda neta a hoy; proyección siempre desde hoy hacia adelante). Para el mes seleccionado, la pantalla SHALL mostrar:

- **Hero "Gasto del hogar · neto":** el **neto protagonista** (`gastaron − reintegros`) en grande, con el bruto y los reintegros como dato secundario al costado. El gasto se cuenta en base **DEVENGADO** (por fecha de compra; cada cuota en su mes), total del hogar (ambas partes). Bimoneda siempre visible (USD subordinado). Debajo, **"En qué gastaron"**: el desglose por categoría en ARS y USD con **drill inline conservado** (tocar una categoría despliega sus movimientos sin navegar fuera).
- **Deuda fuera del hero:** la deuda neta por moneda vive en una **franja/tile propia fija en "hoy"** (no en el hero navegable), en lenguaje claro ("le debés a X" / "X te debe" / "están al día"), con accesos a **Saldar** (cuando hay deuda viva) y a **Ver el detalle** (la pantalla de cuenta corriente). El acceso se rotula por la acción, no por el objeto interno. Presentada con `text-expense`/`text-income`, nunca en rojo.
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
- **THEN** se muestra en una franja propia (no en el hero navegable) con accesos a Saldar y Ver el detalle

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

### Requirement: El receptor asigna la cuenta donde recibió la liquidación

El sistema SHALL mostrarle al miembro receptor las liquidaciones pendientes de asignar, y permitirle elegir la cuenta cash/bank donde recibió el dinero. La confirmación SHALL ejecutarse mediante una **operación privilegiada atómica** que valida que el caller es el receptor y que la liquidación está pendiente, crea un movimiento `settlement` real en esa cuenta (su saldo sube, sin contar como ingreso) con la fecha de asignación, y marca la liquidación como completada, en una sola transacción. La deuda neta se recalcula en consecuencia. No existe un paso de aceptar/rechazar.

La corrección de errores SHALL ser libre mientras la liquidación está **pendiente** (solo existe la pata del pagador, que es su propio movimiento). Una vez **completada**, la pata del receptor es un movimiento de otro usuario; revertir la liquidación SHALL realizarse mediante una operación privilegiada acotada al hogar que revierte ambas patas de forma atómica, no mediante escritura cross-user desde el cliente. La tabla `settlement` NO SHALL aceptar escritura directa del cliente (INSERT/UPDATE): todas sus transiciones de estado pasan por operaciones privilegiadas.

#### Scenario: El receptor asigna su cuenta y recibe el ingreso

- **WHEN** B ve una liquidación pendiente de `$50 ARS` de A y selecciona su cuenta cash
- **THEN** la operación privilegiada crea un movimiento `settlement` entrante de `$50 ARS` en la cuenta de B, marca la liquidación como completada, y la deuda neta se reduce en consecuencia

#### Scenario: Solo el receptor puede confirmar

- **WHEN** un miembro que no es el receptor de la liquidación intenta confirmarla
- **THEN** la operación privilegiada rechaza la confirmación

#### Scenario: Corrección libre mientras está pendiente

- **WHEN** A registró una liquidación equivocada que aún está pendiente de asignación por B
- **THEN** A puede eliminar la liquidación; eliminarla borra su propia pata `settlement` (gobernada por la RLS owner-only de `transactions`) y la fila `settlement` cascadea, restaurando su saldo

#### Scenario: Revertir una liquidación completada usa una operación privilegiada

- **WHEN** se necesita deshacer una liquidación que B ya completó
- **THEN** la reversión la realiza una operación privilegiada acotada al hogar que elimina ambas patas (la de A y la de B) de forma atómica
- **AND** el cliente no intenta borrar el movimiento del otro usuario directamente

#### Scenario: Un miembro no puede mutar campos arbitrarios de una liquidación

- **WHEN** un miembro intenta hacer UPDATE directo de una fila `settlement` (cambiar monto, receptor, estado, etc.)
- **THEN** la base rechaza la escritura: no existe policy de UPDATE directa sobre `settlement`

### Requirement: El nombre del hogar se presenta readonly y se edita en un drawer enfocado (web)

En `apps/web`, la ruta `/shared/settings` SHALL mostrar el nombre actual del hogar como **valor readonly** (sin input inline), acompañado de una acción `Editar` neutra/secundaria. La acción `Editar` SHALL abrir un `Drawer` (primitivo de `overlay-primitives`) que contiene el input de nombre existente y acciones `Guardar`/`Cancelar`. El guardado SHALL invocar la misma mutación existente `updateHouseholdConfig({ name })`, sin redirect nuevo; `Cancelar`, cerrar por scrim o `Esc` SHALL descartar la edición sin efecto. El CTA `Guardar` (acción positiva de confirmación) SHALL ser el único elemento verde del flujo; el disparador `Editar` SHALL permanecer neutro/secundario.

#### Scenario: El nombre se muestra readonly con acción de edición

- **WHEN** un usuario abre `/shared/settings`
- **THEN** ve el nombre actual del hogar como texto readonly y un botón `Editar` neutro, sin input inline

#### Scenario: Editar el nombre desde el drawer

- **WHEN** el usuario presiona `Editar` en la sección de nombre
- **THEN** se abre un drawer con el input de nombre precargado y acciones `Guardar`/`Cancelar`
- **WHEN** el usuario cambia el nombre y presiona `Guardar`
- **THEN** el sistema invoca `updateHouseholdConfig({ name })`, refresca la vista y el nuevo nombre aparece readonly en la página

#### Scenario: Cancelar la edición del nombre no tiene efecto

- **WHEN** el usuario abre el drawer de nombre y lo cierra con `Cancelar`, scrim o `Esc`
- **THEN** el drawer se cierra, no se invoca ninguna mutación y el nombre permanece sin cambios

### Requirement: El usuario puede configurar el split por defecto del hogar

El sistema SHALL permitir editar el split por defecto del hogar (ej. 50·50, 60·40), que se preselecciona al marcar un gasto como compartido. Los porcentajes SHALL sumar 100 y cada uno SHALL ser ≥ 1. El split por defecto puede sobrescribirse gasto por gasto.

En `apps/web`, cuando el hogar tiene dos miembros, la sección de split por defecto de `/shared/settings` SHALL mostrar un **resumen readonly** con **ambos integrantes y su porcentaje** (de los datos que `getHousehold()` ya provee), acompañado de una acción `Editar` neutra/secundaria. La edición SHALL ocurrir en un `Drawer` enfocado que muestra el porcentaje del **primer integrante** como input **editable** y el del segundo como **complemento derivado** (`100 - primero`), sin permitir editar el segundo directamente, con acciones `Guardar`/`Cancelar`. El guardado SHALL invocar la misma mutación existente `updateHouseholdConfig({ default_split })` con el primer porcentaje editado y su complemento. Esto es una presentación legible de datos ya disponibles; no cambia la regla de derivación ni la validación. El CTA `Guardar` SHALL ser la única acción verde; el disparador `Editar` SHALL permanecer neutro/secundario.

#### Scenario: Cambiar el split por defecto a 60·40

- **WHEN** un miembro configura el split por defecto en 60·40 y guarda
- **THEN** los nuevos gastos compartidos preseleccionan 60·40, sin alterar los splits de gastos ya registrados

#### Scenario: La pantalla muestra el resumen readonly de ambos integrantes

- **WHEN** un hogar de dos miembros abre `/shared/settings`
- **THEN** la sección de split muestra un resumen readonly con el nombre y porcentaje de cada integrante, y un botón `Editar` neutro, sin input inline

#### Scenario: Editar el reparto desde el drawer deriva el complemento

- **WHEN** el usuario presiona `Editar` en la sección de reparto y se abre el drawer
- **THEN** ve el porcentaje del primer integrante como input editable y el del segundo como `100 - primero`, no editable
- **WHEN** cambia el porcentaje del primer integrante y presiona `Guardar`
- **THEN** el sistema invoca `updateHouseholdConfig({ default_split })` con el primer porcentaje y su complemento derivado, refresca la vista y el resumen readonly refleja los nuevos porcentajes

#### Scenario: Cancelar la edición del reparto no tiene efecto

- **WHEN** el usuario abre el drawer de reparto y lo cierra con `Cancelar`, scrim o `Esc`
- **THEN** el drawer se cierra, no se invoca ninguna mutación y el reparto permanece sin cambios

### Requirement: El usuario puede salir del hogar solo si no hay deuda viva

El sistema SHALL permitir que un miembro salga del hogar, desvinculándolo, siempre que no exista deuda neta pendiente en ninguna moneda ni dirección, **ni una regla de recurrencia compartida activa**. Los gastos compartidos históricos se conservan. Si el hogar queda sin miembros, se marca inactivo.

El sistema SHALL bloquear la salida mientras exista al menos una regla de recurrencia compartida activa (con `household_id` y estado activo), pidiendo al usuario que primero pause o elimine esa regla. Este bloqueo es server-side, consistente con el bloqueo por deuda viva y por liquidaciones pendientes.

En `apps/web`, la ruta `/shared/settings` SHALL pedir **confirmación explícita** antes de ejecutar la salida: el botón "Salir del hogar" abre un `Dialog` (primitivo de confirmación definido en `overlay-primitives`) y la mutación de salida SHALL invocarse únicamente al confirmar desde el diálogo. Cancelar, cerrar por scrim o presionar `Esc` SHALL descartar la confirmación sin efecto. El bloqueo por deuda viva SHALL seguir siendo server-side; cuando la salida se bloquea, el motivo SHALL renderizarse como error inline dentro del cuerpo del diálogo, que permanece abierto. El CTA de confirmación SHALL usar `<Button variant="destructive">`.

#### Scenario: Salida bloqueada por deuda viva

- **WHEN** un miembro con deuda neta distinta de cero en alguna moneda intenta salir del hogar
- **THEN** el sistema bloquea la salida y explica que primero debe saldar la deuda

#### Scenario: Salida bloqueada por regla recurrente compartida activa

- **WHEN** un miembro sin deuda viva intenta salir del hogar pero existe una regla de recurrencia compartida activa
- **THEN** el sistema bloquea la salida y explica que primero debe pausar o eliminar esa regla recurrente compartida

#### Scenario: Salida exitosa sin deuda

- **WHEN** un miembro sin deuda viva ni reglas recurrentes compartidas activas confirma salir del hogar
- **THEN** el sistema lo desvincula, conserva los gastos compartidos históricos, y marca el hogar inactivo si queda sin miembros

#### Scenario: La salida requiere confirmación explícita (web)

- **WHEN** un usuario en `/shared/settings` presiona "Salir del hogar"
- **THEN** se abre un diálogo de confirmación y la salida todavía NO se ejecuta
- **WHEN** el usuario cancela el diálogo (botón cancelar, scrim o Esc)
- **THEN** el diálogo se cierra y el usuario permanece en el hogar, sin efecto alguno
- **WHEN** el usuario confirma desde el diálogo
- **THEN** el sistema ejecuta la salida (sujeta al bloqueo por deuda viva) y, en éxito, lo lleva de vuelta a `/shared`

### Requirement: Las monedas del hogar son ARS y USD por defecto

El sistema SHALL operar el hogar sobre las mismas monedas que el resto de la app (ARS y USD habilitadas por defecto), sin una tabla de configuración de monedas por hogar. La deuda se calcula por moneda; no hay conversión automática entre ARS y USD.

#### Scenario: No hay conversión entre monedas

- **WHEN** existe deuda en ARS y en USD
- **THEN** el sistema las reporta y se saldan por separado, sin convertir una en la otra

### Requirement: Un miembro puede leer los datos compartidos de su hogar

El sistema SHALL aplicar Row Level Security sobre las tablas del módulo (`household`, `household_member`, `household_invite`, `shared_expense_split`, `settlement`) de forma que un usuario solo acceda a los datos de su propio hogar. En particular, las **invitaciones** (`household_invite`) SHALL ser legibles **solo por miembros** del hogar al que pertenecen; un no-miembro NO SHALL poder enumerar ni leer invitaciones ajenas (la resolución de un código para unirse ocurre dentro de la operación privilegiada de unión, no por lectura directa). Adicionalmente, un miembro SHALL poder leer las cuentas del otro miembro estrictamente en la medida necesaria para seleccionar destino/origen al liquidar.

#### Scenario: Lectura acotada al propio hogar

- **WHEN** un usuario consulta `shared_expense_split` o `settlement`
- **THEN** Supabase retorna únicamente las filas cuyo `household_id` corresponde al hogar del usuario

#### Scenario: Un extraño no ve datos del hogar

- **WHEN** un usuario que no pertenece a un hogar consulta sus datos compartidos
- **THEN** Supabase no retorna ninguna fila de ese hogar

#### Scenario: Un no-miembro no puede enumerar invitaciones ajenas

- **WHEN** un usuario logueado consulta `household_invite` de un hogar del que no es miembro
- **THEN** Supabase no retorna ninguna invitación (la lectura de invitaciones está acotada a miembros)

### Requirement: No se puede borrar un gasto compartido con una liquidación viva en el hogar

El sistema SHALL impedir el borrado de un gasto compartido (`is_shared = true`) mientras exista **alguna** liquidación (`settlement`) en su hogar, porque la deuda se salda por **neto** y no se imputan pagos a gastos puntuales: borrar el gasto cambiaría en silencio una deuda que una liquidación ya contabilizó. La guarda SHALL vivir en la base (trigger `BEFORE DELETE` sobre `transactions`), y la capa de aplicación SHALL presentar un mensaje explicativo que indique revertir la liquidación antes de borrar. Las patas de los movimientos de tipo `settlement` (que son `is_shared = false`) quedan exentas de esta guarda, de modo que revertir o eliminar una liquidación sigue siendo posible.

#### Scenario: Borrado bloqueado por liquidación viva

- **WHEN** un usuario intenta borrar un gasto compartido y existe al menos una liquidación en su hogar
- **THEN** la base rechaza el borrado y la aplicación explica que primero debe revertir la liquidación

#### Scenario: Borrado permitido sin liquidaciones

- **WHEN** un usuario borra un gasto compartido y no existe ninguna liquidación en su hogar
- **THEN** el borrado procede y la deuda derivada se recalcula sin la parte de ese gasto

#### Scenario: Revertir una liquidación no queda bloqueado por la guarda

- **WHEN** una operación privilegiada revierte una liquidación borrando sus patas `settlement`
- **THEN** la guarda no se dispara (las patas son `is_shared = false`) y la reversión procede

### Requirement: Los splits de un gasto compartido suman exactamente su monto

El sistema SHALL garantizar en la base que, para cada transacción con splits, la suma de `amount_assigned` de sus `shared_expense_split` es **exactamente igual** al `amount` de la transacción. El chequeo SHALL ser un invariante diferido a fin de transacción (los splits se insertan fila por fila) y SHALL evaluarse por `transaction_id` (para cuotas, por cada cuota hija).

#### Scenario: Splits que no cubren el total son rechazados

- **WHEN** al cierre de una transacción los splits de un gasto compartido suman un monto distinto al `amount` de la transacción
- **THEN** la base aborta la transacción con error de invariante

#### Scenario: Reparto válido pasa el invariante

- **WHEN** un gasto de `$100,01` se reparte 50·50 en `$50,01` + `$50,00`
- **THEN** la suma es exactamente `$100,01` y el invariante se satisface

### Requirement: El dueño de un split de gasto compartido es miembro del hogar

El sistema SHALL garantizar en la base que el `user_id` de todo `shared_expense_split` sea miembro del `household_id` de ese split. No SHALL poder asignarse una parte a un usuario que no pertenece al hogar.

#### Scenario: Split a un no-miembro es rechazado

- **WHEN** se intenta insertar o actualizar un `shared_expense_split` cuyo `user_id` no es miembro del `household_id`
- **THEN** la base rechaza la operación con error de invariante

### Requirement: Un usuario pertenece a lo sumo a un hogar activo

El sistema SHALL garantizar en la base que un usuario sea miembro de **a lo sumo un hogar activo** (`household.is_active = true`) a la vez. El alta de membresía —tanto del creador como del segundo miembro vía la operación privilegiada de unión— SHALL respetar este invariante.

#### Scenario: No se puede pertenecer a dos hogares activos

- **WHEN** un usuario que ya es miembro de un hogar activo intenta agregarse a un segundo hogar activo
- **THEN** la base rechaza el alta de membresía con error de invariante

### Requirement: El usuario puede ver la cuenta corriente del hogar

El sistema SHALL ofrecer una pantalla (`/shared/cuenta-corriente`) que presenta la deuda entre los dos miembros como un **libro derivado** (nunca persistido), **por moneda**. De cara al usuario, la pantalla se titula en **lenguaje llano** ("Las cuentas entre ustedes") con un subtítulo que la auto-explica ("quién pagó qué y cómo queda el saldo; nada se borra"); "cuenta corriente" se conserva solo como nombre de dominio interno y de ruta. La pantalla SHALL mostrar: (a) el **saldo actual** por moneda (ARS y USD siempre visibles, nunca fusionadas), con la dirección expresada como relación entre personas ("le debés a X" / "X te debe" / "están al día"); (b) un **desglose** colapsable "Cómo llegamos a este saldo" con los agregados en castellano natural (lo que pagó uno por el otro, lo que el otro pagó por uno, reintegros y pagos, = saldo); (c) un **extracto** cronológico (más reciente arriba) donde cada asiento muestra fecha, movimiento, **"qué cambia"** en castellano natural, **monto firmado** y **saldo corriente**; (d) un divisor **"Hoy"** y un tramo **"Lo que se viene"** con la proyección por mes. El extracto se deriva de los mismos splits y liquidaciones que la deuda; el **saldo final del extracto SHALL igualar** la deuda derivada (`householdDebtAt`).

#### Scenario: El extracto deriva el saldo corriente

- **WHEN** el hogar tiene gastos compartidos, reintegros y liquidaciones en una moneda
- **THEN** la pantalla lista cada asiento con su monto firmado y un saldo corriente
- **AND** el saldo del asiento más reciente iguala la deuda neta derivada de esa moneda

#### Scenario: El desglose explica el saldo

- **WHEN** el usuario abre la pantalla
- **THEN** ve los agregados (lo que pagó uno por el otro, lo que el otro pagó por uno, reintegros y pagos) que suman el saldo actual
- **AND** puede colapsar/expandir el desglose

#### Scenario: Bimoneda siempre visible en la pantalla de detalle

- **WHEN** hay saldo en una sola moneda
- **THEN** la otra moneda sigue visible (aunque sea cero), sin fusionarse

#### Scenario: La pantalla se auto-explica con lenguaje llano

- **WHEN** un usuario sin background financiero abre la pantalla
- **THEN** el título y el subtítulo le dicen qué ve ("las cuentas entre ustedes" / "quién pagó qué y cómo queda el saldo"), sin requerir conocer el término "cuenta corriente"

### Requirement: Las superficies visibles de Compartido usan lenguaje llano, sin jerga contable

El sistema SHALL nombrar las superficies y los rótulos visibles del módulo Compartido en **castellano natural, sin jerga contable**, de modo que un usuario sin background financiero entienda qué hace cada pantalla y de dónde sale cada número. El **modelo interno** (libro derivado por moneda, contraasiento, deuda en reloj de impacto) y la **ruta** `/shared/cuenta-corriente` NO forman parte de este requisito: son internos y pueden conservar su nomenclatura de dominio.

En particular: el acceso desde el hub SHALL llamarse en términos de la acción ("ver el detalle"), no del objeto interno ("cuenta corriente"); la dirección de la deuda SHALL expresarse como una relación entre personas ("le debés a {name}" / "{name} te debe" / "están al día"), no con fórmulas ("a favor de"); los términos de asiento ("liquidación", "contraasiento", "importe", "ecuación") SHALL presentarse en su equivalente llano ("pago", "anulación", "monto", "desglose"), de forma **consistente** (un mismo concepto, una sola palabra en toda la superficie). El término **"reintegro"** SHALL conservarse (es preciso y conocido por la base de usuarios).

#### Scenario: El acceso desde el hub se nombra por la acción

- **WHEN** el usuario ve la franja de deuda en el hub de Compartido
- **THEN** el acceso a la pantalla de detalle se rotula como "Ver el detalle" (no "Cuenta corriente")

#### Scenario: La dirección de la deuda se lee como relación entre personas

- **WHEN** hay deuda viva en una moneda
- **THEN** la dirección se expresa como "le debés a {name}" o "{name} te debe", no como "a favor de"

#### Scenario: Un mismo concepto usa una sola palabra

- **WHEN** la pantalla menciona una liquidación en cualquier punto (filtro, agregado, aviso, confirmación)
- **THEN** usa siempre "pago" (nunca mezcla "liquidación" y "pago" para el mismo concepto)

### Requirement: La reversión de una liquidación es un contraasiento, no un borrado

El sistema SHALL revertir una liquidación **completada** mediante un **contraasiento**: la liquidación original se preserva marcada como `reversed` y se registra un asiento opuesto que anula su efecto, de modo que el historial conserva ambas líneas (la original tachada como "Revertida" y el "Contraasiento"). La reversión SHALL ejecutarse mediante una operación privilegiada acotada al hogar (`SECURITY DEFINER`), que restaura el `disponible` de ambas cuentas con patas `settlement` opuestas y deja la deuda neta como si la liquidación no hubiera ocurrido (la original y el contraasiento se cancelan). NO SHALL borrarse físicamente ninguna fila.

#### Scenario: Revertir preserva la historia

- **WHEN** se revierte una liquidación completada
- **THEN** la liquidación original queda marcada como revertida (no se borra) y se agrega un contraasiento que anula su efecto
- **AND** el extracto muestra ambas líneas y la deuda neta vuelve al estado previo

#### Scenario: El saldo de las cuentas se restaura

- **WHEN** se revierte una liquidación completada de `$X`
- **THEN** el `disponible` del pagador sube `$X` y el del receptor baja `$X` (patas opuestas), sin borrar los movimientos originales

