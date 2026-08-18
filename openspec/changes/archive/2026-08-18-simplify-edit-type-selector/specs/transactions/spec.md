## MODIFIED Requirements

### Requirement: El selector de tipo ofrece dos primarias y "Otros"

El formulario SHALL presentar `gasto` e `ingreso` como las únicas opciones primarias fijas, tanto en alta como en edición. Los demás tipos —`transferencia`, `ajuste` y `cambio de moneda`— SHALL quedar tras una affordance explícita ("Otros") que los ofrece gateados por su elegibilidad (`transferencia` requiere dos o más cuentas propias; `cambio de moneda` requiere capacidad bimoneda; `ajuste` está siempre disponible). La affordance "Otros" SHALL mostrarse siempre que exista al menos un tipo secundario elegible. La partición es fija y no altera ninguna regla contable ni la disponibilidad de los tipos.

En **modo edición** el selector SHALL renderizarse con esa misma forma pero **read-only**: el tipo del movimiento aparece como la opción activa —en su slot primario, o en el slot "Otros" si es un tipo secundario— y ninguna opción SHALL ser accionable. El slot "Otros" SHALL mostrarse en edición siempre que exista al menos un tipo secundario elegible **o** el propio movimiento sea de un tipo secundario, para que el tipo nunca quede sin representación. Como el selector ya nombra el tipo, las filas de contexto read-only NO SHALL repetirlo, salvo en la madre de una compra en cuotas, donde la fila dice "Compra en cuotas" y aporta información que el selector no da.

#### Scenario: Solo gasto e ingreso son primarios

- **WHEN** el usuario abre el formulario de alta en modo create
- **THEN** el selector de tipo muestra `gasto` e `ingreso` como opciones primarias
- **AND** ni `transferencia`, ni `ajuste`, ni `cambio de moneda` ocupan un lugar primario

#### Scenario: Los tipos secundarios están en "Otros"

- **WHEN** el usuario activa la affordance "Otros"
- **THEN** puede elegir `transferencia` (si tiene dos o más cuentas), `ajuste` o `cambio de moneda` (si tiene capacidad bimoneda)
- **AND** el flujo de ese tipo funciona igual que antes de este cambio

#### Scenario: En edición el selector se muestra igual pero read-only

- **WHEN** el formulario se abre en modo edición de un movimiento existente en una superficie mobile (app nativa o web en viewport angosto)
- **THEN** el selector de tipo se dibuja con la misma partición del alta —dos primarias más "Otros"— y el tipo del movimiento como opción activa
- **AND** ninguna opción es accionable: no hay cambio de tipo, la affordance "Otros" no despliega su lista y el tipo permanece inmutable

#### Scenario: Un tipo secundario ocupa el slot "Otros" en edición

- **WHEN** el formulario se abre en modo edición de una transferencia, un ajuste o un cambio de moneda
- **THEN** el slot "Otros" muestra el nombre de ese tipo como opción activa, en lugar de la etiqueta genérica
- **AND** lo hace aunque ese tipo ya no sea elegible para un alta nueva (por ejemplo una transferencia cuya segunda cuenta se cerró)

#### Scenario: El tipo no se dice dos veces

- **WHEN** el formulario en modo edición mobile dibuja el selector de tipo read-only
- **THEN** las filas de contexto read-only NO repiten el tipo como una fila más
- **AND** la excepción es la madre de una compra en cuotas, cuya fila aporta información que el selector no da ("Compra en cuotas", no "Gasto")

### Requirement: El drawer en modo edición ajusta chrome y CTA

El sistema SHALL precargar el movimiento real al abrir el drawer en modo edición y SHALL deshabilitar el cambio de tipo. El conjunto de campos editables SHALL derivarse de `getEditableFields` (regla ya especificada para el formulario único). En modo edición el CTA SHALL decir "Guardar cambios". El borrado SHALL respetar las reglas existentes (no borrar hijas de cuotas aisladas, no borrar consumos pagados).

#### Scenario: Tipo no editable en edición

- **WHEN** el usuario abre un movimiento existente en el drawer de edición
- **THEN** el selector de tipo no permite cambiar el tipo
- **AND** en viewport ancho se muestra como el selector completo deshabilitado, y en viewport angosto como el selector simplificado read-only (dos primarias + "Otros")

#### Scenario: CTA en edición

- **WHEN** el drawer está en modo edición
- **THEN** el CTA dice "Guardar cambios"

#### Scenario: Borrado respeta reglas de cuotas

- **WHEN** el usuario intenta eliminar una cuota hija desde la edición
- **THEN** el sistema aplica las reglas de borrado existentes y no permite borrarla aislada

### Requirement: La app nativa expone la edición y el borrado de un movimiento

La app nativa SHALL permitir **editar** y **borrar** un movimiento desde el detalle, reusando la capa compartida: la edición SHALL usar `useMovementForm` en modo edición (`edit: MovementEditContext`) con el mismo `submitEdit()` y los mismos `update*` mutators ya bindeados en mobile; el borrado SHALL usar un thin `deleteTransaction(supabase, userId, id)` compartido en `@grana/transactions-mutations`, consumido por **web y mobile** (una sola implementación de los guards). **Cero i18n nuevo**: las acciones y los warnings de borrado ya viven en `@grana/i18n-messages`.

**Edición.** La app SHALL exponer una pantalla `/transactions/[txId]/edit` que arma el `MovementEditContext` vía un mirror mobile de `buildMovementEditContext` (mismos reads del detalle + `getEditableFields` puro/compartido) y renderiza el `MovementForm` en modo edición. En modo edición el form SHALL: mostrar el selector de tipo **read-only** con la misma forma que en el alta (dos primarias + "Otros", el tipo del movimiento activo, nada accionable — ver el requirement del selector de tipo); mostrar **filas de contexto read-only** (moneda · cuenta(s), y el tipo sólo cuando aporta información que el selector no da, como "Compra en cuotas") con caption de "no editable"; y **gatear cada campo** por `editableFields` — monto/fecha editables sólo cuando lo permite el estado (un consumo `paid` bloquea monto y fecha; una compra en cuotas madre bloquea el monto si alguna cuota está pagada; una cuota hija es totalmente inmutable), categoría/descripción según el tipo, la cuenta de débito editable **sólo** en un pago de resumen (`editable.account`), y el reintegro editable sólo si está **pendiente** (uno recibido/cancelado se muestra read-only). El submit SHALL rutear al `updateX` correspondiente (o `updateInstallmentParent` para la madre) y, si aplica, a `saveExpenseReimbursement`.

**Permisos.** El edit-context SHALL devolver `null` cuando el movimiento no es editable por este form — ajeno (`transaction.user_id !== user.id`), reintegro/liquidación, o padre sin cuenta resoluble — y la pantalla de edición SHALL responder con su estado de "no encontrado". El detalle SHALL ocultar la acción Editar en esos casos (ver `canEdit` en el requirement del detalle).

**Borrado.** La acción Borrar del detalle SHALL confirmar de forma **destructiva** con un `Alert.alert` nativo (el patrón de confirmación destructiva ya usado en la app), mostrando el warning **por tipo** (`delete_warning_default` / `delete_warning_parent` / `delete_warning_card_payment`) y el CTA `delete_confirm`. Al confirmar SHALL invocar el thin `deleteTransaction`; los **guards** (cuota hija → borrar desde la madre; consumo `paid`; leg de `settlement`; guard temporal `GRN01` de gasto ya liquidado) SHALL vivir en el mutator compartido y devolverse como `errorCode` para que la plataforma localice el mensaje. Al éxito SHALL invalidar el cache de movimientos y volver al feed.

El borrado y la edición SHALL usar el mismo anon-key/RLS path que web (las mutations filtran por `user_id`); sin cambios de datos, API ni RLS más allá de mover los guards del borrado a la capa compartida.

#### Scenario: Editar un gasto simple

- **WHEN** el dueño abre el detalle de un gasto propio cash/bank no pagado y toca Editar
- **THEN** llega a `/transactions/[txId]/edit` con el form en modo edición, el tipo como selector read-only, la moneda y la cuenta como contexto read-only, y los campos monto/categoría/fecha/descripción editables
- **AND** al guardar, el `updateTransaction` persiste los cambios, se invalida el cache y vuelve al detalle

#### Scenario: Los campos bloqueados no se editan

- **WHEN** el usuario edita un consumo de tarjeta ya pagado, o una cuota hija de una compra en cuotas
- **THEN** el consumo pagado muestra monto y fecha como contexto read-only (sólo categoría/descripción editables)
- **AND** la cuota hija no ofrece edición (la afordancia vive en la madre)

#### Scenario: Editar el reintegro de un gasto

- **WHEN** el dueño edita un gasto con un reintegro **pendiente**
- **THEN** la sección de reintegro es editable (puede cambiar el monto, agregarlo o quitarlo) y el submit llama a `saveExpenseReimbursement`
- **AND** si el reintegro ya está recibido/cancelado, se muestra read-only y no se toca

#### Scenario: Un movimiento ajeno no se edita ni se borra

- **WHEN** un miembro del hogar abre el detalle de un gasto compartido que pagó el **otro** miembro
- **THEN** ve el detalle completo pero sin las acciones Editar/Borrar
- **AND** si fuerza `/transactions/[txId]/edit`, la pantalla responde con "no encontrado" (el edit-context es `null`)

#### Scenario: Borrar un movimiento confirma y respeta los guards

- **WHEN** el dueño toca Borrar en un gasto propio no pagado
- **THEN** un `Alert.alert` destructivo muestra el warning por tipo y pide confirmación
- **AND** al confirmar, el thin `deleteTransaction` borra el movimiento, se invalida el cache y vuelve al feed
- **AND** si el movimiento es una cuota hija, un consumo pagado o un leg de liquidación, el mutator devuelve el `errorCode` y la pantalla muestra el mensaje correspondiente sin borrar

#### Scenario: Web y mobile comparten los guards del borrado

- **WHEN** se borra un movimiento desde web o desde mobile
- **THEN** ambos pasan por el thin `deleteTransaction` de `@grana/transactions-mutations` (mismos guards)
- **AND** la action web conserva su `revalidateAfterMovementMutation()` y no cambia de comportamiento (tests web verdes)
