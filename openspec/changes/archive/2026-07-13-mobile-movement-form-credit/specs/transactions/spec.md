## MODIFIED Requirements

### Requirement: La app nativa expone la pantalla de alta de movimiento `/transactions/new`

La app nativa SHALL exponer una pantalla full-screen `/transactions/new` para **registrar** un movimiento, como thin consumer del hook `useMovementForm` de `@grana/movement-form`. La pantalla SHALL montar el hook pasándole: las cuentas del usuario proyectadas a `MovementFormAccount`, el árbol de categorías (`getAllCategories`), el hogar (`getHousehold`, cuando exista), `today: getTodayAR()`, una `translate` wire al i18n mobile, y un objeto `Mutators` nativo. La JSX SHALL ser RN idiomática sobre los primitivos existentes (`PageHeader`, `Segmented`, `MoneyAmountInput`, `DateField`, `SelectableCard`, `Switch`, `FormError`), con la chrome (`PageHeader` + CTA) visible desde el primer paint.

El alcance de esta pantalla es **create-only**: SHALL ofrecer las tabs **Gasto**, **Ingreso** y **Transferencia**. El picker de cuentas SHALL incluir **todas** las cuentas del usuario (cash, bank y credit), proyectando las credit como off-ledger (`balances: { ARS: 0, USD: 0 }`, avatar resuelto vía `resolveAccountAvatar`); el gate `eligibleFor` del hook restringe credit a la tab Gasto, y la fila credit SHALL mostrar el hint de consumo de tarjeta (`transactions.drawer.credit_hint`). La pantalla NO SHALL ofrecer (todavía) el cambio de moneda, el ajuste ni la recurrencia — slices aditivos posteriores (B.2b) — ni la edición de movimientos (change C).

Con una cuenta credit seleccionada en Gasto, la pantalla SHALL ofrecer **cuotas** cuando la moneda es ARS: chips preset `1·3·6·12` más un stepper custom acotado a 2–60, con preview del monto por cuota y CTA dinámico (`actions.register_installments`); con moneda USD SHALL mostrar el hint de cuotas-sólo-ARS en lugar de los chips, sin bloquear el consumo simple en USD. El submit SHALL rutear vía el hook a `registerCardPurchase` (consumo simple) o `registerInstallments` (cuotas), sin lógica de ruteo propia en la pantalla.

En la tab Gasto la pantalla SHALL ofrecer la **declaración de reintegro** con paridad web: toggle, monto estimado, auto-cálculo por porcentaje/tope (`applyReimbursementPercent`), destino *a cuenta / a resumen* (el radio sólo con credit; cash/bank implica 'account'), picker de cuenta de acreditación cuando aplica, y el checkbox *ya lo recibí* con su hint condicional. El bloque SHALL estar disponible también sobre una compra **en cuotas**: el hook vincula el reintegro a la madre de la compra (el subtipo *a resumen* cae en el período de la primera cuota), igual que web.

La pantalla SHALL soportar el **gasto compartido**: cuando el hogar tiene exactamente dos miembros, SHALL exponer el toggle "Compartir gasto" y el control de split, permitiendo cualquier reparto incluido el **100%-al-otro-miembro**. Si no hay hogar de dos miembros (o el read falla), el toggle NO SHALL renderizarse y el alta simple SHALL seguir funcionando.

Al guardar con éxito, `onSuccess` SHALL navegar de vuelta al feed y `onMutationSuccess` SHALL invalidar las queries de TanStack del feed / dashboard / accounts, de modo que el movimiento recién creado aparezca sin recarga manual. Los errores de validación/guardado SHALL mostrarse in-context (`FormError` con `form.formError`) sin perder el input.

#### Scenario: Registrar un gasto simple desde mobile

- **WHEN** el usuario tapea el FAB, elige la tab "Gasto", una cuenta cash/bank, un monto, una categoría y guarda
- **THEN** la pantalla invoca `form.onSubmit`, que dispara el mutator `createExpense` nativo (validate + auth + la thin mutation compartida)
- **AND** al éxito navega de vuelta al feed y el gasto aparece en el mes correspondiente sin recarga manual

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
- **AND** con credit el usuario puede elegir destino *a resumen* (reduce el período) o *a cuenta*; con cash/bank el destino es *a cuenta* sin radio
- **AND** sobre una compra en cuotas el reintegro se vincula a la madre (el subtipo *a resumen* cae en el período de la primera cuota)

#### Scenario: Gasto compartido 100%-al-otro desde mobile

- **WHEN** el hogar tiene dos miembros y el usuario activa "Compartir gasto" y lleva el split a 100% para el otro miembro
- **THEN** el submit envía el spec de split al mutator, que aplica `applySharedSplits` con el reparto declarado
- **AND** el gasto queda marcado como compartido con la porción correspondiente al otro miembro

#### Scenario: La chrome de la pantalla de alta está visible desde el primer paint

- **WHEN** la pantalla `/transactions/new` hace cold-load y aún resuelve `accounts`/`categories`/`household`
- **THEN** el `PageHeader` (back + título) y el CTA de guardar ya están presentes (el CTA deshabilitado hasta que el form está listo)
- **AND** la carga no se cubre con un skeleton que tape la chrome
