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

El sistema SHALL permitir, mediante un toggle en el formulario de gasto, marcar un `expense` (cuenta cash/bank o tarjeta de crédito) como compartido. Un gasto compartido es una transacción **real** que impacta el saldo de quien paga, persistida con `is_shared = true` y `household_id`, más un reparto en `shared_expense_split` (una fila por miembro con su porcentaje y su monto asignado). El toggle solo está disponible si el usuario tiene un hogar activo con dos miembros. Los porcentajes SHALL sumar exactamente 100, cada uno SHALL estar entre **0 y 100**, y todos los miembros del hogar SHALL estar listados. Un porcentaje de **0** para un miembro es válido y significa que el gasto corresponde **íntegramente al otro miembro** (el pagador lo adelanta): no genera consumo propio del pagador y el otro le queda debiendo el total.

El control de reparto SHALL ofrecer los repartos frecuentes como **atajos de un gesto** —**Mitad** (50/50), **70/30**, **75/25** (los porcentajes son *tu parte*) y **Todo suyo** (el gasto es íntegramente del otro; fija `{pagador: 0, otro: 100}`)— más un disparador **"Otro"** que revela un editor de **porcentaje libre** (tu parte editable con el teclado del sistema; la del otro se calcula sola y se muestra no editable). El caso "lo pagué yo pero es 100% del otro" SHALL alcanzarse mediante el atajo **"Todo suyo"**: NO SHALL existir un toggle dedicado aparte para ese caso. NO SHALL ofrecerse un atajo "todo mío" (100% del pagador): un gasto 100% propio no se marca como compartido (se alcanza con "Otro" si hiciera falta). En **mobile**, el reparto SHALL visualizarse con una **barra proporcional Vos / [otro integrante]** —el nombre lo trae el registro de Hogar, no se escribe—, que puede mostrar porcentajes o montos. Los atajos y el editor SHALL estar disponibles tanto en el alta como en la edición. La presentación mobile de este control y su paridad entre web-mobile y nativo la fija el requirement «El despliegue de las secciones avanzadas es de superficie mínima y paritario entre las superficies mobile» de la capability `transactions`.

El split **por defecto del hogar** NO forma parte de esta relajación: su editor SHALL seguir acotado a `1..99` (el 0/100 es una decisión por-gasto, no la norma del hogar) y NO SHALL exponer el atajo "Todo suyo".

#### Scenario: Gasto compartido cash creado con split

- **WHEN** un usuario con hogar activo registra un gasto cash y activa "Compartir" con un split (ej. 50·50)
- **THEN** el sistema inserta la transacción con `type='expense'`, `is_shared=true` y `household_id`, impacta el saldo de la cuenta del pagador, e inserta una fila por miembro en `shared_expense_split`
- **AND** la suma de `amount_assigned` de los splits es igual al `amount` de la transacción

#### Scenario: Gasto que paga el usuario pero corresponde 100% al otro

- **WHEN** un usuario registra un gasto compartido y toca el atajo "Todo suyo"
- **THEN** el split queda `{pagador: 0%, otro: 100%}`, el saldo de la cuenta del pagador baja por el total, y se inserta la fila del otro con `amount_assigned` = total (y la del pagador con `0`)
- **AND** la deuda derivada refleja que el otro le debe el total al pagador
- **AND** el gasto NO aparece en el desglose "en qué se fue" del pagador (su parte es 0) y SÍ aparece completo en el del otro miembro

#### Scenario: Toggle oculto sin hogar de dos miembros

- **WHEN** un usuario sin hogar, o con un hogar de un solo miembro, abre el formulario de gasto
- **THEN** el toggle "Compartir" no se ofrece

#### Scenario: Porcentajes inválidos son rechazados

- **WHEN** el usuario confirma un gasto compartido cuyos porcentajes no suman exactamente 100, o algún porcentaje es negativo o mayor a 100
- **THEN** el sistema rechaza el input con error de validación

#### Scenario: El split por defecto del hogar no admite 0/100

- **WHEN** un usuario edita el split por defecto del hogar en `/shared/settings`
- **THEN** el editor lo mantiene acotado a `1..99` (el complemento del otro entre `99..1`)
- **AND** no se ofrece el atajo "Todo suyo" (0/100) en esa superficie

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

La derivación de deuda SHALL considerar **únicamente** splits de transacciones **compartidas** (`is_shared = true`): un split extraviado o legacy sobre una transacción no compartida NO SHALL contribuir a la deuda derivada. Esta restricción es defensiva y complementa el invariante que garantiza que una transacción no compartida no conserva splits.

#### Scenario: Deuda derivada de un único gasto compartido

- **WHEN** A paga un gasto de `$100 ARS` compartido 50·50 con B, y no hay liquidaciones
- **THEN** el sistema deriva que B le debe `$50 ARS` a A, sin persistir ese número

#### Scenario: Deuda separada por moneda

- **WHEN** hay gastos compartidos en ARS y en USD
- **THEN** el sistema reporta una deuda neta por cada moneda, nunca una suma combinada

#### Scenario: Deudas menores al centavo se descartan

- **WHEN** la deuda neta resultante en una moneda es menor a un centavo
- **THEN** el sistema la reporta como "están al día" en esa moneda

#### Scenario: Un split sobre una transacción no compartida no contamina la deuda

- **WHEN** existe una fila `shared_expense_split` cuyo `household_id` es el del hogar pero cuya transacción tiene `is_shared = false`
- **THEN** la deuda derivada la ignora (no aporta a ninguna moneda)

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
- **Últimos movimientos:** la lista de movimientos compartidos del mes, presentada como **log de gastos** (no como estado de deuda; la deuda ya vive, sin ambigüedad, en la franja de deuda). Cada fila SHALL mostrar dos cifras **fijas e invariantes a quién pagó**: el **total del movimiento como protagonista** (`amount`, en grande), presentado como gasto (`−`, `text-expense`; el reintegro con `+`/`text-income` si recibido); y la **parte propia del usuario como detalle secundario** ("Tu parte: {monto}", en chico, debajo), mostrada solo cuando hubo reparto real (`ownShare ≠ amount`). La fila NO SHALL mostrar rótulos de perspectiva de deuda que cambien de significado según el pagador ("parte de {nombre}"): el detalle secundario es siempre la parte propia. Quién pagó se conserva en el subtítulo ("Pagaste" / "Pagó {nombre}").

La pantalla SHALL ofrecer el **alta de movimiento** (CTA primary en web; FAB en mobile) y el acceso a **Configuración del hogar** como ícono. Los integrantes NO se muestran en la home.

#### Scenario: El navegador mueve solo la actividad, no la deuda ni la proyección

- **WHEN** el usuario cambia el navegador de mes
- **THEN** cambian el gasto del mes y su desglose
- **AND** la deuda (de hoy) y la proyección (desde hoy) NO cambian

#### Scenario: El neto es protagonista

- **WHEN** el mes tiene gastos y reintegros compartidos
- **THEN** el hero muestra el neto en grande y el bruto/reintegros como dato secundario

#### Scenario: El total es protagonista y la parte propia el detalle, invariantes a quién pagó

- **WHEN** un gasto compartido de `$10.000` mitad y mitad se muestra en Últimos movimientos, sin importar si lo pagó el usuario o el otro miembro
- **THEN** el monto protagonista de la fila es el total `−$10.000`, en `text-expense`
- **AND** debajo se muestra "Tu parte: $5.000" como dato secundario
- **AND** NO se muestra el rótulo "parte de {nombre}"

#### Scenario: El reintegro muestra el total como protagonista y la parte propia debajo

- **WHEN** un reintegro recibido de un gasto compartido mitad y mitad, de `$4.000` total, se muestra en Últimos movimientos
- **THEN** el monto protagonista de la fila es el total `+$4.000`, en `text-income`
- **AND** debajo se muestra "Tu parte: $2.000"

#### Scenario: Un movimiento 100% propio no repite la cifra

- **WHEN** un movimiento cuyo reparto deja la parte propia igual al total (`ownShare = amount`) se muestra en Últimos movimientos
- **THEN** la fila muestra el total como protagonista y OCULTA la línea "Tu parte" (sería redundante)

### Requirement: El usuario puede saldar deuda registrando una liquidación

El sistema SHALL permitir que el miembro deudor registre una liquidación (total o parcial) mediante un **drawer** (primitivo `Drawer` de `overlay-primitives`, mismo patrón que el alta de movimiento), disparado desde la home o la cuenta corriente. El drawer SHALL ofrecer **montos rápidos** (Total y parciales; el resto queda registrado en la cuenta corriente), la cuenta cash/bank de origen **con su saldo disponible** y su **identidad visual heredada** (color e icono resueltos server-side, igual que el resto de los selectores de cuenta — nunca una paleta propia por posición), la **fecha del movimiento** (editable, por defecto hoy y con piso en la fecha de alta del usuario, mismo control `DatePicker` que el alta de movimiento), una **anotación pedagógica** del monto por persona ("la parte de {otro} se registra como deuda a tu favor"), y un **aviso no bloqueante de saldo negativo** cuando la cuenta elegida quedaría en `disponible < 0`. El registro SHALL ejecutarse mediante una operación privilegiada atómica que crea la pata del pagador (movimiento `settlement`, `payer_id` server-side, en la fecha elegida) y la fila `settlement` (pendiente de asignación), sin pata huérfana. El movimiento `settlement` impacta el saldo pero NO cuenta como gasto. El monto SHALL ser mayor a cero. Un monto **mayor a la deuda vigente** en esa moneda SHALL estar permitido: salda la deuda e **invierte el saldo** por el excedente (el otro miembro queda debiéndolo), coherente con la deuda derivada; el drawer SHALL explicitar esa inversión tanto en el preview como en el estado de "enviado".

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

#### Scenario: Monto que excede la deuda invierte el saldo

- **WHEN** A debe `$50 ARS` y registra una liquidación de `$70 ARS`
- **THEN** se registra la liquidación de `$70 ARS`, la deuda con B queda saldada y el saldo se invierte: B le queda debiendo `$20 ARS` a A, coherente con la deuda derivada
- **AND** el drawer explicita la inversión en el preview y en el estado de "enviado", en lugar de mostrar un `$0` silencioso

#### Scenario: Elegir la fecha de la liquidación

- **WHEN** A abre el drawer de saldar y elige una fecha anterior a hoy (no previa a su alta)
- **THEN** la pata del pagador (`settlement`) se registra con esa fecha, igual que cualquier otro movimiento

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

**Quien sale no pierde el nombre de sus movimientos.** Antes de desvincularlo, el sistema SHALL crear para el miembro que sale una copia propia de cada categoría y subcategoría del hogar que sus movimientos o recurrencias **no compartidos** referencian, y SHALL apuntar esos movimientos y recurrencias a la copia. Los movimientos compartidos históricos siguen apuntando a la categoría del hogar. Las categorías del hogar no se borran ni cambian de dueño al salir un miembro.

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

#### Scenario: Quien sale conserva sus categorías del hogar como propias

- **WHEN** Julieta sale del hogar teniendo gastos propios clasificados con la categoría del hogar "Hogar - La Foresta"
- **THEN** el sistema crea la categoría propia "Hogar - La Foresta" para Julieta y apunta esos gastos a ella
- **AND** los gastos compartidos históricos del hogar siguen apuntando a la categoría del hogar
- **AND** Cristian sigue viendo y usando la categoría del hogar sin cambios

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

### Requirement: Los splits de un gasto compartido respetan un invariante simétrico con is_shared

El sistema SHALL garantizar en la base un invariante **simétrico** entre `transactions.is_shared` y las filas `shared_expense_split`, evaluado **por `transaction_id`** y **diferido a fin de transacción** (los splits se insertan/borran fila por fila):

- Una transacción **compartida** (`is_shared = true`) **que porta splits** SHALL tener la suma de `amount_assigned` de sus splits **exactamente igual** a su `amount`.
- Una transacción **no compartida** (`is_shared = false`) NO SHALL conservar **ningún** split.

El invariante SHALL implementarse con dos guardas complementarias, de modo que ninguna variante incompleta pase inadvertida:

- Un chequeo que se dispara al mutar splits (INSERT/UPDATE/DELETE de `shared_expense_split`) y valida el **estado final** de la transacción (no un early-return): si es compartida, los splits suman; si no, no debe quedar ninguno.
- Un chequeo diferido sobre la transición `transactions.is_shared → false` que captura el caso de "cambié el flag pero no borré los splits" (donde ninguna fila de split cambió y el primer chequeo no se enteraría).

La transacción **madre** de una compra en cuotas es compartida pero **no porta splits propios** (viven en las cuotas hijas); queda naturalmente exenta del chequeo de suma (ninguna fila de split la referencia). La transición `is_shared = true → false` acompañada del borrado de todos los splits en la **misma transacción** SHALL pasar el invariante (al commit ya no quedan splits).

#### Scenario: Splits que no cubren el total son rechazados

- **WHEN** al cierre de una transacción los splits de un gasto compartido suman un monto distinto al `amount` de la transacción
- **THEN** la base aborta la transacción con error de invariante

#### Scenario: Reparto válido pasa el invariante

- **WHEN** un gasto de `$100,01` se reparte 50·50 en `$50,01` + `$50,00`
- **THEN** la suma es exactamente `$100,01` y el invariante se satisface

#### Scenario: Una transacción no compartida no puede conservar splits

- **WHEN** al cierre de una transacción con `is_shared = false` aún existen filas en `shared_expense_split` para su `transaction_id`
- **THEN** la base aborta la transacción con error de invariante

#### Scenario: Insertar un split sobre una transacción no compartida es rechazado

- **WHEN** se intenta insertar (o actualizar) un `shared_expense_split` cuya transacción tiene `is_shared = false`, sin ningún UPDATE de la transacción
- **THEN** al cierre la base lo rechaza con error de invariante

#### Scenario: La madre de cuotas compartida sin splits propios no viola el invariante

- **WHEN** una compra compartida en cuotas tiene la madre `is_shared = true` sin splits propios y las cuotas hijas con sus splits que suman su monto
- **THEN** el invariante se satisface (la madre no es evaluada por suma; cada hija suma su `amount`)

### Requirement: No se puede borrar ni descompartir un gasto compartido cubierto por una liquidación posterior

El sistema SHALL impedir **tanto el borrado como la descompartición** (`is_shared = true → false`) de un movimiento compartido cuando exista una liquidación (`settlement`) **en el mismo hogar, en la misma moneda, con fecha igual o posterior** a la fecha de impacto del movimiento (`coalesce(due_date, date)`), porque en el extracto (cuenta corriente) esa liquidación quedó calculada sobre un saldo que incluía ese movimiento: borrarlo o descompartirlo reescribiría en silencio un saldo ya liquidado. La fecha de la liquidación es la de su movimiento de pagador (`payer_movement_id`). Recíprocamente, un movimiento **posterior a toda liquidación** de su moneda SHALL poder borrarse/descompartirse libremente (no afecta lo ya saldado), y una liquidación en una moneda NO SHALL bloquear un movimiento de la otra.

Ambas guardas SHALL vivir en la base: un trigger `BEFORE DELETE` y un trigger `BEFORE UPDATE` (acotado a la transición de `is_shared` a `false`) sobre `transactions`, evaluados **por fila**, de modo que solo se guarden las filas que **portan splits** (cada cuota hija por su propia fecha de impacto; la madre de cuotas y las patas `settlement`, que no portan splits, quedan exentas). Las guardas SHALL lanzar un `SQLSTATE` distinguible (`GRN01`) que la capa de aplicación mapea a un mensaje explicativo indicando revertir esa liquidación primero.

#### Scenario: Borrado bloqueado por una liquidación posterior en la misma moneda

- **WHEN** un usuario intenta borrar un gasto compartido y existe una liquidación en la misma moneda con fecha igual o posterior a la del gasto
- **THEN** la base rechaza el borrado (SQLSTATE `GRN01`) y la aplicación explica que primero debe revertir esa liquidación

#### Scenario: Descompartir bloqueado por una liquidación posterior en la misma moneda

- **WHEN** un usuario intenta descompartir un gasto compartido y existe una liquidación en la misma moneda con fecha igual o posterior a la del gasto
- **THEN** la base rechaza la transición `is_shared → false` (SQLSTATE `GRN01`) y la aplicación muestra el mensaje explicativo

#### Scenario: Movimiento posterior a toda liquidación se puede descompartir/borrar

- **WHEN** un usuario descomparte o borra un gasto compartido cuya fecha es posterior a la de toda liquidación de esa moneda en el hogar
- **THEN** la operación procede y la deuda derivada se recalcula sin ese gasto (la liquidación anterior no lo cubría)

#### Scenario: Una liquidación en otra moneda no bloquea

- **WHEN** existe una liquidación en ARS y el usuario descomparte/borra un gasto en USD (o viceversa)
- **THEN** la guarda no se dispara (la moneda no coincide)

#### Scenario: Revertir una liquidación no queda bloqueado por las guardas

- **WHEN** una operación privilegiada revierte una liquidación borrando o contra-asentando sus patas `settlement`
- **THEN** las guardas no se disparan (las patas son `is_shared = false`, no portan splits) y la reversión procede

### Requirement: Descompartir un gasto es una operación atómica sin splits huérfanos

El sistema SHALL reconciliar la descompartición de un gasto (toggle "Compartir" → off sobre un gasto ya compartido) mediante una **única operación atómica** (RPC) que, en la misma transacción de base, marca las transacciones afectadas como `is_shared = false` / `household_id = null` y borra sus `shared_expense_split`. NO SHALL usarse el patrón cliente de `DELETE` de splits seguido de `UPDATE` del flag en llamadas separadas, que deja splits huérfanos al disparar el invariante diferido.

La operación SHALL derivar **server-side** el conjunto completo de transacciones afectadas a partir de un **único id raíz**: el gasto raíz, sus **cuotas hijas** (si es una compra en cuotas), y los **reintegros vinculados** a cualquiera de ellos. NO SHALL aceptar una lista arbitraria de ids provista por el cliente.

La operación SHALL correr con privilegios del invocador (`SECURITY INVOKER`) y validar **explícitamente** que hay un usuario autenticado y que la raíz pertenece al caller (porque las transacciones compartidas tienen lectura cross-user, un intento ajeno resultaría de otro modo en un UPDATE de cero filas y un "éxito" silencioso). SHALL bloquear las filas afectadas (`FOR UPDATE`) en orden determinista y estar acotada con `REVOKE EXECUTE FROM PUBLIC` / `GRANT EXECUTE ... TO authenticated`.

Al completarse, NO SHALL quedar ningún split sobre las transacciones descompartidas (garantizado por el invariante simétrico), y la operación SHALL estar sujeta a la guarda de liquidaciones (ver el requisito de la guarda temporal).

#### Scenario: Descompartir un gasto simple limpia sus splits atómicamente

- **WHEN** un usuario descomparte un gasto compartido simple (sin cuotas)
- **THEN** en una sola transacción la base marca el gasto `is_shared = false` / `household_id = null` y borra sus splits
- **AND** no queda ninguna fila en `shared_expense_split` para ese gasto
- **AND** la deuda derivada del hogar ya no incluye ese gasto

#### Scenario: Descompartir una compra en cuotas limpia los splits de las hijas

- **WHEN** un usuario descomparte una compra compartida en cuotas desde su transacción madre
- **THEN** la base marca la madre y todas las cuotas hijas como `is_shared = false` / `household_id = null` y borra los splits de las hijas
- **AND** no queda ningún split huérfano en ninguna cuota

#### Scenario: Descompartir arrastra los reintegros vinculados

- **WHEN** un usuario descomparte un gasto compartido que tiene un reintegro compartido vinculado
- **THEN** el reintegro también queda `is_shared = false` / `household_id = null` y sus splits se borran, en la misma operación

#### Scenario: Un usuario ajeno no puede descompartir un movimiento que no es suyo

- **WHEN** un usuario invoca la operación de descompartir sobre una transacción de otro miembro del hogar (que puede leer por RLS)
- **THEN** la operación falla con un error explícito de ownership (no un "éxito" de cero filas)

#### Scenario: Descompartir es atómico ante fallo

- **WHEN** la operación de descompartir no puede completar el borrado de todos los splits afectados
- **THEN** ni el flag `is_shared` ni los splits quedan en un estado intermedio (la transacción de base se revierte entera)

### Requirement: El home de Compartido navega el mes y carga las secciones sin recargar la página

El home de Compartido (`apps/web`, hogar activo de dos miembros) SHALL entregar su
navegación de mes y sus secciones con el mismo modelo híbrido RSC + estado de cliente
del dashboard. Este requisito define la **mecánica de entrega**; el contenido y la
semántica de cada sección (y que la deuda y la proyección son "hoy") siguen definidos en
"El usuario puede ver el dashboard del hogar".

- **Mes en estado de cliente, no en la URL.** El mes seleccionado SHALL vivir en estado
  de cliente (un proveedor de contexto propio del home), NO en `searchParams`. Cambiar de
  mes NO SHALL navegar ni recargar la ruta. El estado no se persiste: al montar el home
  se abre en el mes corriente (derivado server-side de la fecha financiera). El navegador
  SHALL deshabilitar la flecha "anterior" al alcanzar el límite de meses hacia atrás y la
  flecha "siguiente" en el mes corriente.

- **Chrome siempre visible, deshabilitado hasta estar listo.** El título del hogar, el CTA
  de alta de movimiento, el ícono de Configuración y el **navegador de mes** SHALL estar
  presentes desde el primer render. Los controles interactivos (flechas del navegador, CTA
  de alta) SHALL renderizarse **deshabilitados** hasta que su dependencia resuelva
  (datos / drawer de movimiento), sin ocultar el chrome ni reemplazarlo por un skeleton de
  header.

- **Secciones independientes.** Cada sección (Gasto del hogar, Qué se deben hoy, Lo que se
  viene, Últimos movimientos) SHALL cargar y fallar de forma independiente: cada una con su
  propio límite de carga (skeleton por sección) y su propio estado de error. Una sección
  lenta o en error NO SHALL bloquear a las demás. Las secciones scopeadas por mes (que
  obtienen desde el cliente) SHALL ofrecer **reintento en tarjeta** en su estado de error.
  El mes corriente SHALL renderizarse desde el servidor (seed) para pintar al instante; los
  meses no corrientes de las secciones scopeadas por mes se obtienen desde el cliente
  mostrando el skeleton en tarjeta mientras cargan.

- **Scope por mes vs "hoy".** Solo **Gasto del hogar** y **Últimos movimientos** SHALL
  reobtener datos al cambiar el mes (su clave de lectura incluye el mes seleccionado).
  **Qué se deben hoy** y **Lo que se viene** SHALL permanecer ancladas a "hoy": su lectura
  NO SHALL incluir el mes seleccionado en su clave ni reobtener al navegar el mes.

#### Scenario: Cambiar de mes no recarga la ruta

- **WHEN** el usuario toca una flecha del navegador de mes
- **THEN** el mes seleccionado cambia en estado de cliente sin navegación ni recarga de la ruta (la URL no cambia)
- **AND** solo Gasto del hogar y Últimos movimientos reobtienen datos para el mes nuevo
- **AND** Qué se deben hoy y Lo que se viene permanecen sin cambios

#### Scenario: El chrome del header aparece desde el primer render, deshabilitado hasta estar listo

- **WHEN** el home se está cargando por primera vez
- **THEN** el título del hogar, el navegador de mes, el CTA de alta y el ícono de Configuración están visibles
- **AND** las flechas del navegador y el CTA de alta están deshabilitados hasta que sus datos/drawer resuelven
- **AND** el header nunca se reemplaza por un skeleton

#### Scenario: Una sección en error no bloquea a las demás

- **WHEN** la lectura de una sección falla
- **THEN** esa sección muestra su propio estado de error en tarjeta (con acción de reintento en las secciones scopeadas por mes)
- **AND** las demás secciones se renderizan normalmente con sus propios datos

#### Scenario: Un mes no corriente se obtiene desde el cliente con skeleton en tarjeta

- **WHEN** el usuario navega a un mes distinto del corriente
- **THEN** Gasto del hogar y Últimos movimientos muestran su skeleton en tarjeta mientras obtienen los datos del mes desde el cliente
- **AND** al resolver muestran los datos del mes seleccionado sin haber navegado la ruta

### Requirement: El tab Hogar renderiza el módulo Compartido en la app nativa (mobile)

En `apps/mobile`, el tab **Hogar** (`(app)/home.tsx`) SHALL renderizar el módulo Compartido real —no un placeholder ni un `return null`— con los mismos tres estados que la home de web, resueltos por la presencia y composición del hogar del usuario:

1. **Sin hogar:** el formulario de setup inline (crear / unirse con código).
2. **Esperando segundo miembro:** la tarjeta de invitación (generar código, copiar, compartir).
3. **Hogar activo:** el dashboard del hogar (hero de gasto neto con navegador de mes, franja de deuda fija en "hoy", proyección, últimos movimientos), con el alta de movimiento como **FAB** y el acceso a Configuración como ícono.

El comportamiento de dominio de cada estado SHALL cumplir las requirements ya definidas para la home de Compartido; esta requirement fija que el consumidor nativo existe y respeta el chrome mobile: `PageHeader` con chrome visible desde el primer paint (título/acciones presentes, deshabilitados hasta cargar; nunca ocultos tras un skeleton) y `SafeAreaView` con `edges={['top']}`.

#### Scenario: Sin hogar, el tab Hogar muestra el setup

- **WHEN** un usuario sin hogar abre el tab Hogar
- **THEN** ve el formulario de setup (crear / unirse con código)
- **AND** no ve un placeholder ni una pantalla vacía

#### Scenario: Esperando miembro, el tab Hogar muestra la invitación

- **WHEN** un usuario con hogar de un solo miembro abre el tab Hogar
- **THEN** ve la tarjeta de invitación con generar/copiar/compartir código

#### Scenario: Hogar activo, el tab Hogar muestra el dashboard con FAB

- **WHEN** un usuario con hogar de dos miembros abre el tab Hogar
- **THEN** ve el hero de gasto neto con navegador de mes, la franja de deuda a hoy, la proyección y los últimos movimientos del mes
- **AND** el alta de movimiento se ofrece como FAB
- **AND** el header muestra el acceso a Configuración

### Requirement: Las subpantallas de Compartido se pushean chromeless desde el tab Hogar (mobile)

En `apps/mobile`, las pantallas de setup, saldar (`settle`), configuración (`settings`) y cuenta corriente SHALL presentarse como rutas **pusheadas** desde el tab Hogar, en modo **chromeless** (el tab bar se oculta), consistente con el patrón ya usado por `/transactions/new` y `/cards/[id]`. Los segmentos de ruta nuevos SHALL registrarse en la detección de chromeless del `TabBar`. Cada subpantalla SHALL usar `PageHeader` con back-link visible desde el primer paint.

#### Scenario: Una subpantalla oculta el tab bar

- **WHEN** un usuario navega desde el tab Hogar a saldar, configuración o cuenta corriente
- **THEN** la pantalla se presenta full-screen con el tab bar oculto
- **AND** el `PageHeader` muestra el back-link desde el primer paint

### Requirement: El flujo de saldar deuda existe en la app nativa (mobile)

En `apps/mobile`, la pantalla de saldar deuda SHALL permitir al pagador registrar una liquidación cumpliendo el comportamiento de dominio ya definido (selección de moneda cuando debe en más de una, monto vía `MoneyAmountInput`, chips rápidos de total/mitad, selector de cuenta con saldos, preview de impacto antes/después, aviso no bloqueante de saldo negativo, submit que deja la liquidación en `pending_receipt`). El receptor SHALL poder asignar la cuenta receptora desde la home (tarjeta de liquidación pendiente), disparando la operación atómica de confirmación.

#### Scenario: El pagador registra una liquidación desde mobile

- **WHEN** un usuario con deuda viva completa el flujo de saldar en la app nativa
- **THEN** se crea la liquidación en estado `pending_receipt`
- **AND** el monto quedó acotado a la deuda de esa moneda

#### Scenario: El receptor asigna la cuenta desde la home nativa

- **WHEN** el receptor toca "asignar cuenta" en una liquidación pendiente en el tab Hogar
- **THEN** la liquidación pasa a completada de forma atómica (movimiento del receptor creado)

### Requirement: La configuración del hogar existe en la app nativa (mobile)

En `apps/mobile`, la pantalla de configuración del hogar SHALL exponer, mediante drawers/sheets nativos idiomáticos, la edición del nombre del hogar, la configuración del split por defecto (primer miembro editable 1..99%, el segundo derivado), la invitación cuando hay menos de dos miembros, y el salir del hogar (bloqueado si hay deuda viva, liquidaciones pendientes o recurrencias compartidas activas), cumpliendo el comportamiento de dominio ya definido para esas operaciones.

#### Scenario: Editar el nombre del hogar desde mobile

- **WHEN** un usuario edita el nombre del hogar en el drawer de configuración nativo
- **THEN** el nombre se actualiza y se refleja en la home

#### Scenario: Salir del hogar bloqueado por deuda

- **WHEN** un usuario intenta salir del hogar con deuda viva desde mobile
- **THEN** la operación se bloquea con el mensaje correspondiente

### Requirement: La cuenta corriente existe en la app nativa con sus caminos de escritura (mobile)

En `apps/mobile`, la pantalla de cuenta corriente SHALL mostrar el extracto derivado por moneda (toggle de moneda, ecuación expandible, filtros por tipo/persona, entradas con impacto en el saldo) y SHALL soportar sus caminos de escritura: revertir una liquidación completada (contraasiento vía `reverse_settlement`) y cancelar una pendiente (borrado), cumpliendo el comportamiento de dominio ya definido (incluida la regla de que la reversión es contraasiento, no borrado).

#### Scenario: Ver el extracto por moneda en mobile

- **WHEN** un usuario abre la cuenta corriente en la app nativa
- **THEN** ve las entradas del extracto de la moneda seleccionada con su impacto en el saldo
- **AND** puede alternar la moneda y filtrar por tipo/persona

#### Scenario: Revertir una liquidación completada desde mobile

- **WHEN** un usuario revierte una liquidación completada en la cuenta corriente nativa
- **THEN** se registra un contraasiento (no se borra la liquidación original)

### Requirement: Un movimiento compartido solo referencia categorías legibles por todo el hogar

El sistema SHALL garantizar que la categoría y la subcategoría de todo movimiento compartido (`is_shared = true`) sean del sistema o del hogar de ese movimiento, nunca propias de un miembro. La garantía SHALL vivir en la base: al crear o modificar un movimiento compartido cuya categoría o subcategoría es propia de quien lo carga, esa categoría o subcategoría SHALL pasar automáticamente al hogar del movimiento. La misma regla aplica a las reglas de recurrencia compartidas.

La regla es automática y silenciosa a propósito: pedirle al usuario que decida la propiedad de la categoría antes de compartir es una pregunta que no entiende, y compartir "después" un gasto ya categorizado es un camino tan válido como compartir al cargar.

La migración de este cambio SHALL aplicar la misma regla sobre lo ya cargado, de modo que después de aplicarla no exista ningún movimiento ni recurrencia compartida con categoría o subcategoría propia.

#### Scenario: Compartir un gasto con categoría propia la pasa al hogar

- **WHEN** Cristian carga o marca como compartido un gasto con su categoría propia "Hogar - La Foresta"
- **THEN** la categoría pasa al hogar en la misma operación
- **AND** Julieta ve el gasto con su nombre de categoría en la dona, la lista y los chips de filtro

#### Scenario: Compartir un gasto con subcategoría propia bajo categoría del sistema

- **WHEN** Julieta comparte un gasto clasificado como "Comida > Verdulería", con "Verdulería" subcategoría propia
- **THEN** "Verdulería" pasa al hogar
- **AND** Cristian ve el gasto con su subcategoría

#### Scenario: La migración deja cero compartidos con categoría privada

- **WHEN** se aplica la migración sobre una base con movimientos compartidos que usan categorías propias
- **THEN** cada una de esas categorías y subcategorías queda con el `household_id` del movimiento
- **AND** no queda ningún movimiento ni recurrencia compartida que referencie una categoría o subcategoría propia

