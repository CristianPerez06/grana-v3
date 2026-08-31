## MODIFIED Requirements

### Requirement: La app nativa muestra los reintegros pendientes accionables en el feed

La pestaña **Movimientos** de la app mobile SHALL renderizar un bloque
**"Reintegros a confirmar"** arriba del listado, hermano nativo del bloque de
pendientes recurrentes, como thin consumer del read compartido
`getPendingReimbursements(supabase)` de `@grana/transactions` (sin scope de
cuenta = global).

El bloque SHALL renderizar **nada** cuando no hay reintegros pendientes **y el
usuario no actuó sobre ninguno en esta sesión**. Entrar sin pendientes no ocupa
espacio ni muestra un empty-state en el feed (mismo comportamiento que
`PendingRecurrencesBlock`, que la card read-only de la cuenta y que el bloque
web). **Quedar** sin pendientes por haber confirmado o cancelado es un caso
distinto y SHALL resolverse como dice "Feedback después de actuar", más abajo.

**Presentación.** El bloque SHALL componer el `Card` del design system nativo y
SHALL exponer un header accionable con badge slate + ícono `Undo2`, título
(`…pending.title`), subtítulo (`…pending.subtitle`), pill con el conteo de
pendientes (`…pending.count`, oculta cuando la lista está vacía) y un chevron
que indica el estado. El acento SHALL ser **slate** (informacional), distinto
del dorado del bloque de recurrencias, y SHALL expresarse con los tokens de
`@grana/ui-tokens` (`slate`, `slate-soft`) — NO SHALL copiarse el hex literal
que la implementación web escribe inline. El halo de 4px de web SHALL traducirse
a un anillo de layout alrededor de la card, porque las sombras de RN no tienen
`spread`; ese anillo SHALL ser lo que carga el acento, sin pisar desde
`className` el borde ni el radio propios del primitivo `Card`.

El header SHALL colapsar y expandir el cuerpo del bloque. El estado inicial
SHALL derivarse de la cantidad de pendientes —**abierto** con uno o ninguno,
**colapsado** con dos o más, paridad con web— y, una vez que el usuario toca el
header, su elección SHALL mandar. Como en nativo la lista llega por `useQuery` y
no por prop, ese default SHALL derivarse del estado de los datos en cada render
mientras no haya elección del usuario; NO SHALL sincronizarse con un efecto, que
pisaría la elección del usuario en cada refetch.

Cada fila del bloque SHALL permitir **confirmar** o **cancelar** el reintegro,
delegando en los mutators nativos `confirmReimbursement` / `cancelReimbursement`
(`apps/mobile/lib/transactions/mutators.ts`), que son thin shells sobre las
impls isomórficas de `@grana/transactions-mutations` (auth + delegación +
localización del `formError`). La invalidación de cache SHALL correr en el
handler de éxito del bloque vía `invalidateAfterReimbursementMutation`, nunca
dentro del mutator.

Cada fila SHALL mostrar el **chip de ícono + tinte de la categoría** derivada
(`categoryIcon` / `categoryColor` de `PendingReimbursementVM`), con el fondo
teñido con el color de la categoría. Sin ícono derivado la fila NO SHALL dibujar
un chip vacío.

**Confirmar** SHALL ser una reconciliación de **monto + fecha únicamente**. La
fila SHALL exponer los dos controles —un `MoneyAmountInput` con default = monto
estimado y un `DateField` con default = fecha del gasto (o hoy)— **visibles
desde el primer paint**, sin sheet y sin paso de expand, paridad con web. El
botón primario SHALL commitear `{ id, amount, date }` en su **primer** press:
NO SHALL gastar un press en revelar los controles.

Los controles NO SHALL esconderse detrás del botón de confirmar. Un reintegro
pendiente es una expectativa, y confirmarlo es el momento de declarar cuánto
llegó realmente; dejar la corrección un press detrás del botón que aparenta
aceptar el estimado esconde justamente el dato que la fila existe para capturar.

El commit NO SHALL ofrecer selector de cuenta ni de período: para el subtipo
`account` la cuenta declarada queda intacta, y para `statement` el período se
deriva del lado del servidor a partir de la fecha (rechazando un período ya
pagado).

**Cancelar** SHALL pedir una confirmación destructiva (`Alert.alert`) antes de
setear `cancelled_at`. La fila SHALL mostrar estado de carga por fila y error
inline localizado.

**Feedback después de actuar.** Confirmar o cancelar con éxito SHALL dejar un
**aviso de éxito persistente y descartable** dentro del bloque
(`…pending.confirmed_success` / `…pending.cancelled_success`, con acción de
cierre etiquetada `…pending.close_notice`). El aviso NO SHALL autodescartarse
por temporizador: es lo único que explica por qué la lista se vació, así que no
puede irse antes de que el usuario lo mire.

Mientras ese aviso esté vivo el bloque SHALL seguir montado aunque la lista
quede vacía, y en ese caso el cuerpo SHALL mostrar la fila "todo al día"
(`…pending.all_clear`). Vaciar la lista actuando NO SHALL desmontar el bloque en
silencio. El aviso SHALL ser la condición de montaje del caso vacío —un único
estado, no dos que puedan desincronizarse—, de modo que cerrarlo con la lista ya
vacía SHALL desmontar el bloque.

Los copies SHALL leerse del catálogo compartido `@grana/i18n-messages`
(`transactions.reimbursement.pending.*`, `reimbursement.confirm` / `.cancel`).

#### Scenario: El feed muestra el bloque de reintegros pendientes

- **WHEN** el usuario abre la pestaña Movimientos y tiene al menos un reintegro
  pendiente (`type='reimbursement'`, `received_at IS NULL`, `cancelled_at IS NULL`)
- **THEN** ve el bloque "Reintegros a confirmar" arriba del listado, resuelto vía
  `getPendingReimbursements(supabase)` de `@grana/transactions`
- **AND** cada fila muestra la descripción/categoría derivada y el monto esperado
- **AND** cada fila con categoría derivada muestra el chip con su ícono y su tinte

#### Scenario: El bloque se presenta como card con header colapsable

- **WHEN** el usuario ve el bloque en el feed
- **THEN** el bloque es una card del design system con header de badge slate +
  `Undo2`, título, subtítulo, pill de count y chevron
- **AND** tocar el header colapsa o expande el cuerpo
- **AND** con un solo pendiente el bloque abre expandido, y con dos o más abre
  colapsado, hasta que el usuario elige lo contrario

#### Scenario: La fila expone monto y fecha desde el primer paint

- **WHEN** el usuario abre el bloque y mira una fila pendiente
- **THEN** ve el input de monto (default = estimado) y el selector de fecha
  (default = fecha del gasto o hoy) ya visibles, sin haber tocado nada
- **AND** puede corregir el monto antes de tocar "Confirmar"

#### Scenario: Confirmar commitea en un solo press

- **WHEN** el usuario toca "Confirmar" en una fila
- **THEN** el press commitea: envía `{ id, amount, date }` al mutator, que setea
  `received_at`, sobrescribe `amount` y `date`, y NO altera `estimated_amount`
- **AND** el bloque invalida cache vía `invalidateAfterReimbursementMutation`
- **AND** NO hace falta un segundo press: el primero no se gasta en revelar los
  controles

#### Scenario: Confirmar un reintegro en resumen deriva el período del lado del servidor

- **WHEN** el usuario confirma un reintegro con subtipo `statement` eligiendo una
  fecha
- **THEN** el mutator resuelve el período de la tarjeta que cubre esa fecha vía
  `getOrCreatePeriodForDate` y lo imputa, sin ofrecer un selector de período
- **AND** si ese período ya fue pagado, la confirmación falla con un error
  localizado y no modifica el reintegro

#### Scenario: Cancelar un reintegro pendiente pide confirmación destructiva

- **WHEN** el usuario toca "Cancelar" en una fila y confirma el diálogo destructivo
- **THEN** el mutator setea `cancelled_at`, el reintegro desaparece del bloque y
  el bloque invalida cache
- **AND** el bloque muestra el aviso de cancelación
- **AND** si el reintegro ya estaba recibido, la operación falla con un error
  localizado

#### Scenario: Actuar deja un aviso de éxito descartable

- **WHEN** el usuario confirma o cancela un reintegro con éxito y todavía quedan
  otros pendientes
- **THEN** el bloque muestra un aviso con la copy de la acción y un control de
  cierre
- **AND** el aviso sigue visible hasta que el usuario lo cierra o vuelve a actuar

#### Scenario: Vaciar la lista actuando muestra "todo al día"

- **WHEN** el usuario confirma (o cancela) el último reintegro pendiente
- **THEN** el bloque NO se desmonta: sigue en pantalla con su header y su aviso
  de éxito
- **AND** el cuerpo muestra la fila "todo al día" en vez de la lista
- **AND** cerrar el aviso desmonta el bloque

#### Scenario: Sin reintegros pendientes el bloque no se renderiza

- **WHEN** el usuario abre la pestaña Movimientos sin reintegros pendientes y sin
  haber actuado sobre ninguno en esta sesión
- **THEN** el bloque "Reintegros a confirmar" no se renderiza (no ocupa espacio ni
  muestra un empty-state en el feed)
