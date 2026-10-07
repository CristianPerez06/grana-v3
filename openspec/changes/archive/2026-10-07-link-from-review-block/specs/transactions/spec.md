## ADDED Requirements

### Requirement: El módulo Movimientos muestra los vencimientos por revisar separados del historial

El sistema SHALL mostrar las ocurrencias recurrentes sin resolver en un bloque separado del historial
de movimientos, sin mezclarlas con las transacciones reales.

El bloque SHALL estar presente también en la pantalla de inicio de la aplicación, que es donde
empieza la sesión: hoy vive únicamente en Movimientos y en el hub, de modo que un usuario puede tener
vencimientos sin revisar y no enterarse nunca.

El bloque SHALL **arrancar siempre plegado**, cualquiera sea la cantidad de ocurrencias sin resolver
y aunque haya vencidas. Una vez que el usuario lo despliega o lo pliega, **su elección SHALL mandar**
mientras siga en la pantalla, también frente a una recarga de los datos. Desplegado por defecto, el
bloque empujaba el resto de la pantalla fuera de la vista y molestaba en el uso diario.

Plegar NO SHALL esconder lo atrasado. Plegado, el bloque SHALL seguir mostrando su encabezado con
el conteo de lo que hay por revisar, las **líneas de reglas trabadas** y, si corresponde, el aviso
de que la reconstrucción sigue en curso. Lo único que se pliega es la lista de filas.

El conteo del encabezado («N por revisar») SHALL incluir **toda** ocurrencia sin resolver que el
bloque lista, también las de fecha futura —por ejemplo, la que deja desvincular—: están en la lista
y se pueden resolver.

Cada fila SHALL ofrecer las acciones que el requirement «Qué se puede hacer sobre un vencimiento
depende de su estado, no de la pantalla» fija para un vencimiento existente y sin resolver:
**Confirmar** —que es registrarlo: abre el formulario con importe, cuenta y fecha—, **«Ya lo tengo
cargado»** —vincularlo a un movimiento ya cargado, con la misma lista de candidatos y la misma
pregunta de conversión a compartido que el resto de la aplicación— y **Omitir**. El bloque NO SHALL
ofrecer además «Ya lo pagué»: sería la misma acción que Confirmar con otro nombre. Vincular desde el
bloque NO SHALL crear ningún movimiento ni mover ningún saldo, y SHALL sacar la fila del bloque.

El lenguaje del bloque SHALL expresar que hay **vencimientos por revisar** y NO SHALL afirmar deuda
ni pago: una ocurrencia sin resolver puede corresponder a un pago que el usuario ya hizo y todavía no
registró, o a uno que no hizo. El sistema NO SHALL rotular el conjunto como dinero adeudado, ni
llamarlo "pagos" —lo que afirmaría que hubo pago, que es justamente lo que no sabe—.

Cada fila SHALL indicar a qué vencimiento corresponde, y SHALL explicitar qué va a ocurrir al
resolverla —qué movimiento se crea, con qué fecha y en qué cuenta— antes de que el usuario confirme.

**El sistema SHALL avisar cuando una regla está trabada.** Una regla está trabada cuando acumula
**dos o más ocurrencias sin resolver cuya fecha ya llegó** —vencidas o de hoy—. Una ocurrencia sin
resolver con fecha futura NO SHALL contar para esta condición ni para su conteo: «trabada» describe
una regla que dejó de avanzar, y un vencimiento que todavía no llegó —por ejemplo, uno desvinculado—
no es atraso. En ese caso el bloque SHALL nombrar la situación con todas sus letras, indicando
**desde cuándo** —la fecha de la ocurrencia sin resolver más antigua— y **cuántas** ocurrencias sin
resolver con fecha ya llegada hay.

El conteo SHALL expresarse como **lo que hay para revisar**, y NO SHALL presentarse como el total del
atraso. La materialización de vencimientos vencidos corre por lotes acotados y continúa en corridas
siguientes, de modo que un atraso largo puede tener todavía ocurrencias sin crear: afirmar un total
sería afirmar un número que el sistema no tiene.

Cuando queda reconstrucción pendiente, el bloque SHALL decirlo **una sola vez, para toda la
pantalla**, y NO SHALL atribuirla a ninguna regla. Lo que falta reconstruir es un único número de la
corrida completa y no identifica reglas; además el generador sólo consulta reglas **activas**, de
modo que colgárselo a cada línea haría que una regla pausada afirmara que se está recuperando un
atraso que nadie está recuperando. Las líneas por regla SHALL limitarse a nombrar la regla, su fecha
y su conteo.

El aviso NO SHALL bloquear ninguna acción, NO SHALL introducir por sí mismo ninguna acción —qué
acciones lleva cada fila del bloque lo decide el requirement «Qué se puede hacer sobre un
vencimiento depende de su estado, no de la pantalla», no este aviso— y NO SHALL afirmar deuda, por
la misma razón que el resto del bloque. Una
regla con ocurrencias acumuladas SHALL contar para este aviso **cualquiera sea su `status`**: el
aviso describe vencimientos que quedaron sin resolver, y ninguna condición de la regla los resuelve
por su cuenta.

Estas reglas SHALL aplicar por igual en web y en la app nativa.

#### Scenario: El aviso está en el inicio

- **WHEN** el usuario abre la aplicación y tiene ocurrencias recurrentes sin resolver
- **THEN** las ve desde la pantalla de inicio, sin navegar a Movimientos ni al hub

#### Scenario: El bloque arranca plegado aunque haya vencidos

- **WHEN** el usuario tiene tres ocurrencias sin resolver, al menos una ya vencida, y abre Movimientos o el inicio
- **THEN** el bloque se muestra plegado, con el conteo «3 por revisar» en el encabezado
- **AND** tocar el encabezado lo despliega y muestra las tres filas

#### Scenario: Plegado, el bloque sigue nombrando las reglas trabadas

- **WHEN** una regla está trabada y el bloque está plegado
- **THEN** la línea de esa regla trabada se ve sin desplegar el bloque

#### Scenario: La elección de plegar o desplegar sobrevive una recarga

- **WHEN** el usuario despliega el bloque y los datos se vuelven a leer sin que salga de la pantalla
- **THEN** el bloque sigue desplegado

#### Scenario: Vincular un vencimiento vencido desde el bloque

- **WHEN** una regla de sueldo tiene el vencimiento del `2026-09-25` sin resolver y el usuario ya cargó ese ingreso
- **AND** toca «Ya lo tengo cargado» en esa fila y elige el ingreso
- **THEN** el vencimiento queda resuelto vinculado a ese ingreso y sale del bloque
- **AND** no se crea ningún movimiento y el saldo no cambia

#### Scenario: Un vencimiento desvinculado se vuelve a vincular desde el bloque

- **WHEN** el usuario desvincula el movimiento del vencimiento del `2026-11-23` y hoy es el `2026-10-07`
- **THEN** ese vencimiento aparece en el bloque de por revisar, con fecha futura, y cuenta en el «N por revisar»
- **AND** «Ya lo tengo cargado» en esa fila permite vincularle otro movimiento

#### Scenario: El bloque no ofrece «Ya lo pagué»

- **WHEN** el usuario mira una fila del bloque de vencimientos por revisar
- **THEN** ve Confirmar, «Ya lo tengo cargado» y Omitir
- **AND** no ve «Ya lo pagué», porque Confirmar es esa misma acción

#### Scenario: El lenguaje no afirma deuda

- **WHEN** el bloque agrupa tres ocurrencias sin resolver de una misma regla
- **THEN** el rótulo las presenta como vencimientos por revisar
- **AND** no afirma que el usuario debe esa suma
- **AND** no afirma que esos pagos ya ocurrieron

#### Scenario: Pendiente recurrente visible sobre el historial

- **WHEN** existen instancias recurrentes pendientes
- **THEN** `/transactions` muestra un bloque de pendientes con acciones de confirmar, editar, vincular a un movimiento ya cargado y omitir
- **AND** debajo muestra el historial real de movimientos

#### Scenario: Movimiento confirmado aparece en historial

- **WHEN** el usuario confirma una instancia recurrente
- **THEN** se crea una transaccion real
- **AND** el movimiento aparece en el historial global segun su fecha contable

#### Scenario: Una regla con vencimientos acumulados se nombra como trabada

- **WHEN** hoy es `2026-09-15` y una regla tiene veintisiete ocurrencias sin resolver, la más vieja del `2026-06-10`, sin reconstrucción pendiente
- **THEN** el bloque avisa que esa recurrencia está trabada desde el `2026-06-10`
- **AND** dice que hay veintisiete ocurrencias para revisar
- **AND** no afirma que el usuario deba esa suma

#### Scenario: Con reconstrucción pendiente se dice una sola vez, y de nadie en particular

- **WHEN** dos reglas están trabadas y la materialización todavía tiene ocurrencias por crear
- **THEN** el bloque dice una sola vez que la reconstrucción sigue en curso
- **AND** cada línea por regla dice desde cuándo está trabada y cuántos vencimientos hay para revisar
- **AND** ninguna línea atribuye la reconstrucción a su propia regla

#### Scenario: Una regla pausada no afirma que se está recuperando su atraso

- **WHEN** una regla pausada y una activa están trabadas, y lo que falta reconstruir corresponde a la activa
- **THEN** la línea de la regla pausada no afirma que se esté recuperando su atraso

#### Scenario: Una sola ocurrencia vencida no es una regla trabada

- **WHEN** una regla tiene exactamente una ocurrencia sin resolver, ya vencida
- **THEN** el bloque la muestra con su urgencia habitual
- **AND** no la nombra como trabada

#### Scenario: Dos ocurrencias que todavía no vencieron no son una regla trabada

- **WHEN** una regla tiene dos ocurrencias sin resolver y las dos vencen después de hoy
- **THEN** el bloque no la nombra como trabada

#### Scenario: Una vencida y una futura no son una regla trabada

- **WHEN** hoy es `2026-10-07` y una regla tiene sin resolver el vencimiento del `2026-09-25` y uno desvinculado del `2026-11-23`
- **THEN** el bloque no la nombra como trabada
- **AND** las dos filas siguen en el bloque y las dos cuentan en el «N por revisar»

## MODIFIED Requirements

### Requirement: La app nativa muestra los pendientes recurrentes y la sugerencia en el feed

El feed de Movimientos nativo SHALL mostrar un **bloque de instancias recurrentes pendientes**, separado del historial, como thin consumer de `@grana/recurrences`. Por cada instancia pendiente el bloque SHALL ofrecer **Confirmar**, **«Ya lo tengo cargado»** y **Omitir**, paridad con web. «Ya lo tengo cargado» SHALL abrir la misma hoja de candidatos que usan el hub y el detalle de la regla, con la misma pregunta de conversión a compartido, y al vincular SHALL invalidar lo mismo que vincular desde esas pantallas. Confirmar SHALL invocar `confirmRecurrenceInstance` (materializa el movimiento real vía los thin creates compartidos), invalidando el feed y el hub; Omitir SHALL invocar `skipRecurrenceInstance`. En esta slice, confirmar SHALL usar el **snapshot** de la instancia (sin edición inline de monto/fecha/descripción). Las instancias **compartidas** SHALL mostrarse con su badge y, al confirmarse, crear el gasto compartido con su split (paridad con `shared-recurrences`). El **warning de saldo negativo** al confirmar queda **diferido** (nicety read-only que requiere el read de saldos por cuenta); su ausencia no bloquea el confirmar.

**Presentación.** El bloque SHALL componer el `Card` del design system nativo y SHALL exponer un header accionable con badge dorado + ícono `Clock`, título (`recurrences.pending.title`), subtítulo (`…pending.subtitle`), pill con el conteo de pendientes (`…pending.count`, oculta cuando la lista está vacía) y un chevron que indica el estado. El acento SHALL ser **dorado** (algo que vence), distinto del slate informacional del bloque de reintegros, y SHALL expresarse con los tokens de `@grana/ui-tokens` (`warning`, `warning-bg`) — NO SHALL copiarse el hex literal que la implementación web escribe inline. El halo de 4px de web SHALL traducirse a un anillo de layout alrededor de la card, porque las sombras de RN no tienen `spread`; ese anillo SHALL ser lo que carga el acento, sin pisar desde `className` el borde ni el radio propios del primitivo `Card`.

El header SHALL colapsar y expandir el cuerpo del bloque. El bloque SHALL **arrancar siempre colapsado**, cualquiera sea la cantidad de pendientes y aunque haya vencidas, paridad con web, y una vez que el usuario toca el header, su elección SHALL mandar. La elección NO SHALL sincronizarse con un efecto a partir de los datos, que la pisaría en cada refetch. Colapsado, el bloque SHALL seguir mostrando el header con su pill de conteo, las líneas de reglas trabadas y el aviso de reconstrucción en curso, igual que web: lo que se pliega es la lista de filas.

**Feedback después de actuar.** Confirmar u omitir con éxito SHALL dejar un **aviso de éxito persistente y descartable** dentro del bloque (`…pending.confirmed_success` / `…pending.skipped_success`, con acción de cierre etiquetada `…pending.close_notice`). El aviso NO SHALL autodescartarse por temporizador: es lo único que explica por qué la lista se vació, así que no puede irse antes de que el usuario lo mire. El aviso SHALL vivir en el **bloque** y no en la fila, porque un aviso montado en la fila se desmontaría con ella justo cuando la lista se vacía.

El bloque SHALL renderizar **nada** cuando no hay instancias pendientes **y el usuario no actuó sobre ninguna en esta sesión**: entrar sin pendientes no ocupa espacio ni muestra un empty-state en el feed (mismo comportamiento que el bloque web). Mientras el aviso de éxito esté vivo el bloque SHALL seguir montado aunque la lista quede vacía, y en ese caso el cuerpo SHALL mostrar la fila "todo al día" (`…pending.all_clear`). Vaciar la lista actuando NO SHALL desmontar el bloque en silencio. El aviso SHALL ser la condición de montaje del caso vacío —un único estado, no dos que puedan desincronizarse—, de modo que cerrarlo con la lista ya vacía SHALL desmontar el bloque.

Los copies SHALL leerse del catálogo compartido `@grana/i18n-messages` (`recurrences.pending.*`).

El feed SHALL mostrar además un **banner de sugerencia de recurrencia** cuando `getTopRecurrenceSuggestion` detecta un patrón repetido, con **Aceptar** (crea la regla vía `acceptRecurrenceSuggestion`) y **Descartar** (`dismissRecurrenceSuggestion`, idempotente por fingerprint). El banner SHALL ofrecer un deep-link a la regla.

La afordancia de navegación al **hub de recurrencias** SHALL vivir en el `PageHeader` de la pantalla de Movimientos, y NO SHALL duplicarse dentro del bloque de pendientes ni del banner — paridad con web, cuyo bloque tampoco linkea al hub.

#### Scenario: Confirmar una instancia pendiente desde el feed

- **WHEN** el usuario toca Confirmar en una instancia recurrente pendiente
- **THEN** se crea el movimiento real (vía `confirmRecurrenceInstance`), la instancia queda confirmada, y el feed + el hub se invalidan
- **AND** confirmar usa el snapshot de la instancia (sin edición inline en esta slice)

#### Scenario: Omitir una instancia pendiente

- **WHEN** el usuario toca Omitir en una instancia pendiente
- **THEN** la instancia queda `skipped` (sin crear movimiento) y la regla avanza su cursor para no re-proponer esa fecha

#### Scenario: El bloque se presenta como card con header colapsable

- **WHEN** el usuario ve el bloque de pendientes recurrentes en el feed
- **THEN** el bloque es una card del design system con header de badge dorado + `Clock`, título, subtítulo, pill de count y chevron
- **AND** el acento dorado sale de los tokens (`warning`, `warning-bg`) y se dibuja como anillo alrededor de la card, sin pisar el borde ni el radio del `Card`
- **AND** tocar el header colapsa o expande el cuerpo
- **AND** el bloque abre colapsado con cualquier cantidad de pendientes, hasta que el usuario lo expande
- **AND** colapsado, las líneas de reglas trabadas siguen a la vista

#### Scenario: La elección de colapso sobrevive un refetch

- **WHEN** el usuario expande el bloque, sale de la pestaña Movimientos y vuelve (disparando un refetch on-focus)
- **THEN** el bloque sigue expandido: la elección del usuario manda sobre el default derivado

#### Scenario: Actuar deja un aviso de éxito descartable

- **WHEN** el usuario confirma u omite una instancia con éxito y todavía quedan otras pendientes
- **THEN** el bloque muestra un aviso con la copy de la acción (`confirmed_success` u `skipped_success`) y un control de cierre
- **AND** el aviso sigue visible hasta que el usuario lo cierra o vuelve a actuar, sin autodescartarse por temporizador

#### Scenario: Vaciar la lista actuando muestra "todo al día"

- **WHEN** el usuario confirma (u omite) la última instancia pendiente
- **THEN** el bloque NO se desmonta: sigue en pantalla con su header y su aviso de éxito
- **AND** el cuerpo muestra la fila "todo al día" en vez de la lista, y la pill de count desaparece
- **AND** cerrar el aviso desmonta el bloque

#### Scenario: Sin instancias pendientes el bloque no se renderiza

- **WHEN** el usuario abre la pestaña Movimientos sin instancias recurrentes pendientes y sin haber actuado sobre ninguna en esta sesión
- **THEN** el bloque de pendientes recurrentes no se renderiza (no ocupa espacio ni muestra un empty-state en el feed)

#### Scenario: Aceptar o descartar una sugerencia

- **WHEN** el feed muestra un banner de sugerencia de recurrencia
- **THEN** Aceptar crea la regla (`acceptRecurrenceSuggestion`) y ofrece ir a ella; Descartar la oculta de forma idempotente (`dismissRecurrenceSuggestion`)

#### Scenario: El acceso al hub vive en el header de la pantalla

- **WHEN** el usuario está en la pestaña Movimientos
- **THEN** la afordancia para ir al hub de recurrencias está en el `PageHeader` de la pantalla
- **AND** ni el bloque de pendientes ni el banner de sugerencia la duplican

#### Scenario: Una instancia compartida se confirma como gasto compartido

- **WHEN** el usuario confirma una instancia recurrente **compartida** (con hogar + split)
- **THEN** se crea un gasto compartido con el split heredado de la regla
- **AND** la instancia se muestra con su badge de compartida en el bloque de pendientes

### Requirement: Qué se puede hacer sobre un vencimiento depende de su estado, no de la pantalla

El sistema SHALL distinguir dos preguntas que hoy se contestan con el mismo dato: **qué vencimiento se
anuncia como próximo** y **sobre qué vencimiento se puede operar**. La primera existe para no nombrar
dos veces la misma fecha, y por eso descarta lo que ya existe. La segunda NO SHALL excluir un
vencimiento por el hecho de que ya exista como fila: lo que el usuario necesita resolver es,
justamente, lo que ya existe y sigue sin resolver. Usar la definición de «próximo» para decidir sobre
qué se puede operar es lo que dejó sin salida a un vencimiento materializado (#162).

Lo que se ofrece SHALL depender únicamente del **estado del vencimiento**, igual en toda pantalla que
lo muestre:

- **Proyectado** —el calendario lo produce y todavía no existe como fila—: el hub y la ficha de la
  regla SHALL ofrecer **registrarlo** («Ya lo pagué» / «Ya lo cobré» / «Ya la hice», según el tipo de
  la regla) y **vincularlo** a un movimiento ya cargado («Ya lo tengo cargado»).
- **Existente y sin resolver**, cualquiera sea su fecha —vencido, de hoy o futuro—: toda superficie
  que lo muestre SHALL ofrecer **registrarlo**, **vincularlo** y **omitirlo**. Registrarlo y
  confirmarlo son la misma acción: confirmar ya abre el formulario con importe, cuenta y fecha.
- **Resuelto registrando** (`resolution_kind = 'created'`): NO SHALL ofrecerse ninguna acción de
  deshacer mientras no exista una operación propia para borrar el movimiento que la recurrencia creó
  (#104).
- **Resuelto vinculando** (`resolution_kind = 'linked'`): el historial de la regla SHALL ofrecer
  **desvincular**, y ninguna otra superficie SHALL hacerlo.

La **ficha de la regla** SHALL seguir anunciando como «próxima fecha» la primera fecha que el
calendario todavía no produjo. Los vencimientos existentes sin resolver se operan desde **su propia
fila del historial**, no desde la próxima fecha: apuntar los botones de la próxima fecha «al más
viejo sin resolver» resuelve uno y deja a los demás igual de huérfanos.

Una regla **pausada** NO SHALL ofrecer registrar ni vincular por anticipado: una pausa es la regla
diciendo que no está corriendo. Sus vencimientos **ya existentes** sin resolver SHALL seguir
ofreciendo lo mismo que los de una regla activa, porque pausar no los resuelve.

El hub SHALL ofrecer las acciones sobre el **mismo conjunto** de vencimientos proyectados en web y en
nativo. Hoy web las ofrece sobre cada ocurrencia proyectada dentro de treinta días, y ninguna si la
próxima cae más lejos; nativo las ofrece sobre la próxima de cada regla, sin tope de días. No es una
divergencia forzada por la plataforma. El conjunto SHALL ser el de nativo: **la próxima ocurrencia
de cada regla activa**, además de cada fila que la proyección muestre.

**DIVERGENCIA CONOCIDA (#162).** El bloque de vencimientos por revisar ya cumple este requirement:
cada fila ofrece confirmar —que es registrar—, vincular y omitir, también sobre una ocurrencia
desvinculada con fecha futura. Lo que todavía no lo cumple: el **historial de la ficha de la regla**
no ofrece ninguna acción sobre sus filas sin resolver, y el **hub web** no ofrece las acciones sobre
el mismo conjunto que el nativo. Hasta que ese change se haga, el sistema NO SHALL darse por cumplido
en el historial de la ficha ni en el hub web; este requirement fija lo que esas pantallas tienen que
ofrecer, no afirma que ya lo ofrezcan.

#### Scenario: Un vencimiento proyectado ofrece registrar y vincular

- **WHEN** una regla activa tiene su próximo vencimiento el `2026-10-23`, todavía sin fila, y hoy es el `2026-10-07`
- **THEN** el hub y la ficha de la regla ofrecen registrarlo y vincularlo sobre esa fecha
- **AND** no ofrecen omitirlo, porque no existe nada que omitir

#### Scenario: Un vencimiento existente sin resolver ofrece registrar, vincular y omitir

- **WHEN** el generador materializó el vencimiento del `2026-09-25` y sigue sin resolver
- **THEN** el bloque de vencimientos por revisar y la fila de ese vencimiento en el historial de la regla ofrecen registrarlo, vincularlo y omitirlo
- **AND** la ficha anuncia como próxima fecha la siguiente que el calendario todavía no produjo, no el `2026-09-25`

#### Scenario: Un vencimiento desvinculado se puede volver a vincular

- **WHEN** el usuario desvincula el movimiento del vencimiento del `2026-11-23`, cuya fecha todavía no llegó
- **THEN** ese vencimiento queda existente y sin resolver, con fecha futura
- **AND** sigue ofreciendo registrarlo, vincularlo y omitirlo, aunque ya exista como fila

#### Scenario: Lo resuelto registrando no ofrece deshacer

- **WHEN** el usuario abre en el historial una ocurrencia resuelta con un movimiento que la recurrencia creó
- **THEN** la fila no ofrece desvincular ni ninguna otra acción de deshacer

#### Scenario: Una regla pausada no ofrece resolver por anticipado

- **WHEN** una regla está pausada y su calendario produciría un vencimiento el `2026-10-23`
- **THEN** ni el hub ni la ficha ofrecen registrarlo ni vincularlo
- **AND** un vencimiento que ya existía sin resolver antes de la pausa sigue ofreciendo registrar, vincular y omitir

#### Scenario: Web y nativo ofrecen las acciones sobre los mismos vencimientos

- **WHEN** una regla mensual activa tiene su próximo vencimiento a treinta y cinco días de hoy
- **THEN** el hub web y el hub nativo ofrecen registrarlo y vincularlo sobre esa misma fecha


## REMOVED Requirements

### Requirement: El modulo Movimientos muestra pendientes recurrentes separados del historial

**Reason**: reemplazado por «El módulo Movimientos muestra los vencimientos por revisar separados del historial». La regla de que el bloque arranca desplegado si hay algo vencido —y su escenario «Con vencidos el bloque no arranca plegado»— deja de valer: el bloque arranca siempre plegado. Un requirement modificado no puede perder un escenario, así que se reemplaza entero, con el nombre además corregido.

**Migration**: todo lo demás del requirement pasa sin cambios al que lo reemplaza; se le agregan «Ya lo tengo cargado» en cada fila y la regla de que una pendiente futura no cuenta para «regla trabada».
