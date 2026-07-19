## MODIFIED Requirements

### Requirement: La app nativa expone el detalle de movimiento `/transactions/[txId]`

La app nativa SHALL exponer una pantalla de detalle `/transactions/[txId]` para cada movimiento. La pantalla SHALL ser thin consumer de los reads del grafo de la transacción extraídos a `@grana/transactions` (`getTransactionDetail`, `getInstallmentFamily`, `getReimbursementsForExpense`) más el mirror thin de `getMovementSharedInfo` en mobile, y SHALL reusar los VMs/tono compartidos (`toFinancialMovement`, `resolveMovementView`, `Tone`) y las keys `transactions.detail.*` de `@grana/i18n-messages` (cero i18n nuevo).

Los reads del grafo de la transacción SHALL vivir en `@grana/transactions` como isomórficos (`GranaSupabaseClient`), reusando `TRANSACTION_SELECT` / `attachLinkedExpenses` ya compartidos; **web SHALL consumirlos desde el package** (una sola implementación, sin cambio de comportamiento — los tests web siguen verdes). El read mobile SHALL usar el mismo anon-key/RLS path que web; el detalle es **legible cross-user** (un movimiento compartido lo ven ambos miembros del hogar).

La **presentación** SHALL reflejar la anatomía web con primitivos nativos (no el HTML): un **topbar** (`PageHeader` nativo) con back que resuelve el origen (`?from=account:<id>` / `?from=card:<id>` / feed), un **hero tonal** y una **grilla de tiles** en una columna. El chrome (topbar) SHALL estar visible desde el primer paint (el skeleton de carga NO SHALL taparlo).

El **hero** SHALL mostrar: banda tintada por el **tono del tipo** (gasto → terracotta signo `−`; ingreso → emerald-deep signo `+`; transferencia → slate, sin signo), el **ícono de categoría** en un cuadro tintado, el **monto grande** tonal con el símbolo de moneda opaco y los decimales según `showCents`, una **línea de contexto**, y una fila de **chips** (fecha · medio de pago · categoría · subcategoría). Las transferencias SHALL llevar el eyebrow "Transferencia interna".

Los **tiles core por tipo** SHALL incluir: **medio de pago** (nombre + tipo de cuenta, NUNCA número de tarjeta), **progreso de cuotas** (barra pagadas/restantes + próxima/fin) para compras en cuotas, **flujo de transferencia/cambio** (origen → destino) con el callout "no cuenta como gasto ni ingreso", **reintegro-neto** (pagaste + reintegro = costo neto, con el gasto vinculado **tappable** a su detalle), **reparto compartido** ("Te toca pagar" + "Dividido entre", sin badge de liquidación) y **descripción**. El detalle SHALL mostrar un estado sólo cuando informa algo real (*Reintegrado* / *Completada* / *Acreditado*).

El detalle SHALL exponer las afordancias de **editar** y **borrar** el movimiento, gateadas por permiso: SHALL calcular `canManage` (= el usuario actual es el dueño/pagador), `canEdit` (`canManage` && cuenta resoluble && `status !== 'paid'` && no es cuota hija) y `canDelete` (`canManage` && cuenta resoluble && sin `parent_id` && `status !== 'paid'`), con las mismas reglas que el detalle web. Un movimiento compartido pagado por el **otro** miembro SHALL ser legible pero NO editable ni borrable (las acciones se ocultan). La acción **Editar** SHALL navegar a `/transactions/[txId]/edit`; la acción **Borrar** SHALL confirmar de forma destructiva antes de ejecutar (ver el requirement de edición/borrado).

Los tiles de **contexto** que requieren reads adicionales — **"Peso en el mes"** (breakdown del mes), **recurrencia** (tile + historial + banner) y **composición de pago de resumen** — quedan **fuera de este alcance**; la pantalla SHALL omitirlos sin romper para esos kinds.

#### Scenario: Tocar una fila abre el detalle

- **WHEN** el usuario toca una fila del feed de un gasto categorizado en una cuenta cash
- **THEN** navega a `/transactions/[txId]` y ve el hero con tono gasto (terracotta), monto con signo `−`, ícono de categoría tintado, título, línea de contexto y los chips fecha · medio · categoría · subcategoría
- **AND** la grilla muestra los tiles "Medio de pago" y "Descripción" (si la tiene)
- **AND** el back resuelve al destino que indica `?from=` o, por defecto, al feed

#### Scenario: El detalle de una compra en cuotas muestra el progreso

- **WHEN** el usuario abre el detalle de una compra en cuotas (madre o hija)
- **THEN** ve el tile de progreso de cuotas (barra pagadas/restantes + próxima/fin) y el detalle por cuota
- **AND** los datos salen de `getInstallmentFamily` (extraído a `@grana/transactions`)

#### Scenario: El detalle de un gasto con reintegro muestra el neto y el gasto vinculado

- **WHEN** el usuario abre el detalle de un gasto con un reintegro vinculado
- **THEN** ve el tile reintegro-neto (pagaste + reintegro = costo neto) y el movimiento vinculado
- **AND** tocar el gasto/reintegro vinculado navega a su propio detalle

#### Scenario: El detalle de un gasto compartido muestra el reparto

- **WHEN** el usuario abre el detalle de un gasto compartido de un hogar de dos miembros
- **THEN** ve el tile de reparto ("Te toca pagar" + "Dividido entre" con la parte de cada uno)
- **AND** el detalle es legible aunque el movimiento lo haya pagado el otro miembro

#### Scenario: Los tiles de contexto diferidos no rompen la pantalla

- **WHEN** el usuario abre el detalle de un movimiento generado por una recurrencia (o de un pago de resumen)
- **THEN** la pantalla renderiza el hero y los tiles core sin el tile de recurrencia / composición / peso-en-el-mes
- **AND** no muestra un estado de error por los tiles diferidos

#### Scenario: El topbar del detalle está visible desde el primer paint

- **WHEN** la pantalla `/transactions/[txId]` hace cold-load y aún resuelve el read del detalle
- **THEN** el `PageHeader` (back + título) ya está presente
- **AND** la carga no se cubre con un skeleton que tape el topbar

#### Scenario: El detalle ofrece editar y borrar sólo al dueño

- **WHEN** el usuario abre el detalle de un movimiento propio, cash/bank y no pagado
- **THEN** ve las acciones **Editar** y **Borrar** en el topbar
- **AND** un movimiento compartido pagado por el otro miembro (o un consumo pagado, o una cuota hija) NO ofrece esas acciones

## ADDED Requirements

### Requirement: La app nativa expone la edición y el borrado de un movimiento

La app nativa SHALL permitir **editar** y **borrar** un movimiento desde el detalle, reusando la capa compartida: la edición SHALL usar `useMovementForm` en modo edición (`edit: MovementEditContext`) con el mismo `submitEdit()` y los mismos `update*` mutators ya bindeados en mobile; el borrado SHALL usar un thin `deleteTransaction(supabase, userId, id)` compartido en `@grana/transactions-mutations`, consumido por **web y mobile** (una sola implementación de los guards). **Cero i18n nuevo**: las acciones y los warnings de borrado ya viven en `@grana/i18n-messages`.

**Edición.** La app SHALL exponer una pantalla `/transactions/[txId]/edit` que arma el `MovementEditContext` vía un mirror mobile de `buildMovementEditContext` (mismos reads del detalle + `getEditableFields` puro/compartido) y renderiza el `MovementForm` en modo edición. En modo edición el form SHALL: ocultar el selector de tipo (el tipo es inmutable); mostrar **filas de contexto read-only** (tipo · moneda · cuenta(s)) con caption de "no editable"; y **gatear cada campo** por `editableFields` — monto/fecha editables sólo cuando lo permite el estado (un consumo `paid` bloquea monto y fecha; una compra en cuotas madre bloquea el monto si alguna cuota está pagada; una cuota hija es totalmente inmutable), categoría/descripción según el tipo, la cuenta de débito editable **sólo** en un pago de resumen (`editable.account`), y el reintegro editable sólo si está **pendiente** (uno recibido/cancelado se muestra read-only). El submit SHALL rutear al `updateX` correspondiente (o `updateInstallmentParent` para la madre) y, si aplica, a `saveExpenseReimbursement`.

**Permisos.** El edit-context SHALL devolver `null` cuando el movimiento no es editable por este form — ajeno (`transaction.user_id !== user.id`), reintegro/liquidación, o padre sin cuenta resoluble — y la pantalla de edición SHALL responder con su estado de "no encontrado". El detalle SHALL ocultar la acción Editar en esos casos (ver `canEdit` en el requirement del detalle).

**Borrado.** La acción Borrar del detalle SHALL confirmar de forma **destructiva** con un `Alert.alert` nativo (el patrón de confirmación destructiva ya usado en la app), mostrando el warning **por tipo** (`delete_warning_default` / `delete_warning_parent` / `delete_warning_card_payment`) y el CTA `delete_confirm`. Al confirmar SHALL invocar el thin `deleteTransaction`; los **guards** (cuota hija → borrar desde la madre; consumo `paid`; leg de `settlement`; guard temporal `GRN01` de gasto ya liquidado) SHALL vivir en el mutator compartido y devolverse como `errorCode` para que la plataforma localice el mensaje. Al éxito SHALL invalidar el cache de movimientos y volver al feed.

El borrado y la edición SHALL usar el mismo anon-key/RLS path que web (las mutations filtran por `user_id`); sin cambios de datos, API ni RLS más allá de mover los guards del borrado a la capa compartida.

#### Scenario: Editar un gasto simple

- **WHEN** el dueño abre el detalle de un gasto propio cash/bank no pagado y toca Editar
- **THEN** llega a `/transactions/[txId]/edit` con el form en modo edición, el tipo/moneda/cuenta como contexto read-only y los campos monto/categoría/fecha/descripción editables
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
