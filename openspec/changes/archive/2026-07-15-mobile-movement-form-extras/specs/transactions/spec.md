## MODIFIED Requirements

### Requirement: La app nativa expone la pantalla de alta de movimiento `/transactions/new`

La app nativa SHALL exponer una pantalla full-screen `/transactions/new` para **registrar** un movimiento, como thin consumer del hook `useMovementForm` de `@grana/movement-form`. La pantalla SHALL montar el hook pasándole: las cuentas del usuario proyectadas a `MovementFormAccount`, el árbol de categorías (`getAllCategories`), el hogar (`getHousehold`, cuando exista), `today: getTodayAR()`, una `translate` wire al i18n mobile, y un objeto `Mutators` nativo. La JSX SHALL ser RN idiomática sobre los primitivos existentes (`PageHeader`, `Segmented`, `MoneyAmountInput`, `DateField`, `SelectField`/`SelectSheet`, `Switch`, `FormError`), con la chrome (`PageHeader` + CTA) visible desde el primer paint.

La selección de **cuenta** y **categoría** SHALL renderizarse con el picker `SelectField` + `SelectSheet` (un trigger-row compacto que muestra la selección actual —avatar + nombre, o placeholder— y abre un `formSheet` modal con la lista), NO como listas de filas inline. El picker NO SHALL incluir buscador (paridad con web). La selección de categoría SHALL drillear **un nivel** dentro del mismo sheet, espejo del web: nivel de categorías (las que tienen subcategorías abren el drill; las que no, se seleccionan directo) → nivel drilleado con "volver", "Toda la categoría" y las subcategorías. El trigger de categoría SHALL mostrar `Categoría › Subcategoría` cuando hay subcategoría elegida.

El alcance de esta pantalla es **create-completo**: SHALL ofrecer las cinco tabs **Gasto**, **Ingreso**, **Transferencia**, **Ajuste** y **Cambio**. El picker de cuentas SHALL incluir **todas** las cuentas del usuario (cash, bank y credit), proyectando las credit como off-ledger (`balances: { ARS: 0, USD: 0 }`, avatar resuelto vía `resolveAccountAvatar`); el gate `eligibleFor` del hook restringe credit a la tab Gasto, y la fila credit SHALL mostrar el hint de consumo de tarjeta (`transactions.drawer.credit_hint`). La pantalla NO SHALL ofrecer (todavía) la **edición** de movimientos (change C).

Con una cuenta credit seleccionada en Gasto, la pantalla SHALL ofrecer **cuotas** cuando la moneda es ARS: chips preset `1·3·6·12` más un stepper custom acotado a 2–60, con preview del monto por cuota y CTA dinámico (`actions.register_installments`); con moneda USD SHALL mostrar el hint de cuotas-sólo-ARS en lugar de los chips, sin bloquear el consumo simple en USD. El submit SHALL rutear vía el hook a `registerCardPurchase` (consumo simple) o `registerInstallments` (cuotas), sin lógica de ruteo propia en la pantalla.

En la tab Gasto la pantalla SHALL ofrecer la **declaración de reintegro** con paridad web: toggle, monto estimado, auto-cálculo por porcentaje/tope (`applyReimbursementPercent`), destino *a cuenta / a resumen* (radio vertical, sólo con credit; cash/bank implica 'account'), picker de cuenta de acreditación cuando aplica, y el checkbox *ya lo recibí* con su hint condicional. El bloque SHALL estar disponible también sobre una compra **en cuotas**: el hook vincula el reintegro a la madre de la compra (el subtipo *a resumen* cae en el período de la primera cuota), igual que web.

La pantalla SHALL soportar el **gasto compartido**: cuando el hogar tiene exactamente dos miembros, SHALL exponer el toggle "Compartir gasto" y el control de split, permitiendo cualquier reparto incluido el **100%-al-otro-miembro**. Si no hay hogar de dos miembros (o el read falla), el toggle NO SHALL renderizarse y el alta simple SHALL seguir funcionando.

En la tab **Ajuste** la pantalla SHALL ofrecer un toggle de **dirección** Suma/Resta (`Segmented` de dos opciones cortas, sobre `adjustmentDirection`), un **banner** informativo (`drawer.adjust_banner_title`/`_body`) y un **preview de saldo** "Saldo quedará" que muestre `saldo actual → saldo resultante` computado con `Money.add`/`Money.subtract` sobre el balance de la moneda seleccionada según la dirección. La descripción SHALL re-etiquetarse a "Motivo del ajuste" (`drawer.adjust_reason`) y la categoría NO SHALL renderizarse. El submit SHALL rutear vía el hook a `createAdjustment` con el monto firmado por la dirección.

En la tab **Cambio** la pantalla SHALL ofrecer un picker de **cuenta destino** (cash/bank, reusando el `AccountSelectField`) y una card de **monto recibido** (`labels.exchange_received`) con un segundo `MoneyAmountInput`, el chip de la moneda destino derivada (`exchangeDestCurrency`, la opuesta a la de origen) y un hint de tasa implícita read-only. Cuando la cuenta destino NO habilita la otra moneda (`exchangeDestCurrency` es null) la pantalla SHALL mostrar el hint `exchange.no_other_currency_hint` en lugar de la card, y el submit SHALL bloquearse in-context (el hook valida `destination_account_no_other_currency`). El submit SHALL rutear vía el hook a `createExchange`.

En las tabs **Gasto** (sin cuotas), **Ingreso** y **Transferencia** la pantalla SHALL ofrecer un toggle **Repetir** (recurrencia): `Switch` (`isRecurrent`) más, al activarse, chips de **frecuencia** (semanal/quincenal/mensual/anual/personalizado sobre `frequency`), y —para `custom`— un `intervalCount` numérico junto a un selector de **unidad** (día/semana/mes/año, `intervalUnit`), y un `DateField` de "repetir hasta" opcional (`recurrenceEndDate`; el orquestador valida `end_date ≥ fecha del movimiento` server-side). El toggle NO SHALL renderizarse en Ajuste, Cambio ni sobre una compra **en cuotas**. Al guardar con recurrencia activa, tras crear el movimiento el submit SHALL invocar `createRecurrenceFromMovement` vía el hook; si esa llamada falla, el error SHALL mostrarse in-context.

Al guardar con éxito, `onSuccess` SHALL navegar de vuelta al feed y `onMutationSuccess` SHALL invalidar las queries de TanStack del feed / dashboard / accounts, de modo que el movimiento recién creado aparezca sin recarga manual. Los errores de validación/guardado SHALL mostrarse in-context (`FormError` con `form.formError`) sin perder el input.

#### Scenario: Registrar un gasto simple desde mobile

- **WHEN** el usuario tapea el FAB, elige la tab "Gasto", una cuenta cash/bank, un monto, una categoría y guarda
- **THEN** la pantalla invoca `form.onSubmit`, que dispara el mutator `createExpense` nativo (validate + auth + la thin mutation compartida)
- **AND** al éxito navega de vuelta al feed y el gasto aparece en el mes correspondiente sin recarga manual

#### Scenario: Elegir cuenta y categoría vía el picker de sheet

- **WHEN** el usuario tapea el trigger de "Cuenta" (o "Categoría")
- **THEN** se abre un `formSheet` modal con la lista (sin buscador) y al elegir una opción el sheet se cierra y el trigger muestra la selección (avatar + nombre; para categoría, `Categoría › Subcategoría`)
- **AND** en categoría, elegir una categoría con subcategorías drillea un nivel dentro del sheet (con "volver" y "Toda la categoría") en vez de seleccionar directo

#### Scenario: Registrar un ingreso o una transferencia desde mobile

- **WHEN** el usuario elige la tab "Ingreso" (o "Transferencia") y completa los campos requeridos
- **THEN** el submit dispara `createIncome` (o `createTransfer`) vía el mutator nativo
- **AND** las cascadas del hook (cuentas elegibles, moneda, destino) se comportan igual que en web

#### Scenario: Registrar un consumo simple en tarjeta desde mobile

- **WHEN** el usuario elige la tab "Gasto", selecciona una cuenta credit, completa monto/categoría y guarda con cuotas en 1
- **THEN** el submit rutea a `registerCardPurchase` vía el hook (el consumo queda off-ledger, asignado a su período)
- **AND** la fila credit del picker muestra el hint de consumo de tarjeta
- **AND** las tabs Ingreso y Transferencia no ofrecen la cuenta credit

#### Scenario: Registrar un consumo en cuotas desde mobile

- **WHEN** el usuario, con una credit en ARS, elige 3 cuotas (o un valor custom vía stepper, p. ej. 24) y guarda
- **THEN** el preview muestra el monto por cuota antes del submit y el CTA refleja la cantidad de cuotas
- **AND** el submit rutea a `registerInstallments`, creando la madre y sus cuotas
- **AND** con moneda USD los chips de cuotas no se ofrecen (hint cuotas-sólo-ARS) pero el consumo simple USD sigue permitido

#### Scenario: Declarar un reintegro desde mobile

- **WHEN** el usuario registra un gasto (cash/bank, o credit con o sin cuotas), activa el toggle Reintegro y completa el monto estimado (directo o por %/tope)
- **THEN** el submit envía la declaración al mutator (`createExpense`, `registerCardPurchase` o `registerInstallments`), que la inserta atómicamente con rollback
- **AND** con credit el usuario puede elegir destino *a resumen* (reduce el período) o *a cuenta*; con cash/bank el destino es *a cuenta* sin selector
- **AND** sobre una compra en cuotas el reintegro se vincula a la madre (el subtipo *a resumen* cae en el período de la primera cuota)

#### Scenario: Gasto compartido 100%-al-otro desde mobile

- **WHEN** el hogar tiene dos miembros y el usuario activa "Compartir gasto" y lleva el split a 100% para el otro miembro
- **THEN** el submit envía el spec de split al mutator, que aplica `applySharedSplits` con el reparto declarado
- **AND** el gasto queda marcado como compartido con la porción correspondiente al otro miembro

#### Scenario: Registrar un ajuste de saldo desde mobile

- **WHEN** el usuario elige la tab "Ajuste", selecciona una cuenta, un monto, la dirección Suma o Resta, escribe un motivo y guarda
- **THEN** el preview "Saldo quedará" muestra `saldo actual → saldo resultante` según la dirección antes del submit
- **AND** el submit rutea a `createAdjustment` con el monto firmado (negativo en Resta) y sin categoría

#### Scenario: Registrar un cambio de moneda desde mobile

- **WHEN** el usuario elige la tab "Cambio", una cuenta de origen, una cuenta destino que habilita la otra moneda, el monto entregado y el monto recibido, y guarda
- **THEN** la card de monto recibido muestra la moneda destino derivada y la tasa implícita, y el submit rutea a `createExchange`
- **AND** si la cuenta destino no habilita la otra moneda, la pantalla muestra el hint "sin otra moneda" y el submit queda bloqueado in-context

#### Scenario: Registrar un movimiento recurrente desde mobile

- **WHEN** el usuario registra un gasto simple / ingreso / transferencia, activa el toggle "Repetir", elige una frecuencia (y para "personalizado" un intervalo count+unidad y opcionalmente una fecha de fin) y guarda
- **THEN** el submit crea primero el movimiento y luego invoca `createRecurrenceFromMovement` con la frecuencia declarada
- **AND** el toggle "Repetir" no se ofrece en las tabs Ajuste ni Cambio, ni sobre una compra en cuotas

#### Scenario: La chrome de la pantalla de alta está visible desde el primer paint

- **WHEN** la pantalla `/transactions/new` hace cold-load y aún resuelve `accounts`/`categories`/`household`
- **THEN** el `PageHeader` (back + título) y el CTA de guardar ya están presentes (el CTA deshabilitado hasta que el form está listo)
- **AND** la carga no se cubre con un skeleton que tape la chrome
