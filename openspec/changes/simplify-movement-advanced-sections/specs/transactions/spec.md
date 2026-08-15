## ADDED Requirements

### Requirement: El despliegue de las secciones avanzadas es de superficie mínima y paritario entre las superficies mobile

Al activarse, cada sección avanzada del alta —Reintegro, Compartido (split) y Repetir (recurrencia)— SHALL revelar sus parámetros con **superficie mínima** y con la **misma estructura y controles equivalentes** en la superficie **mobile-web** (gateada por breakpoint) y en la **app nativa**, de modo que ambas se lean como el mismo producto. Esta paridad es de **presentación**: no altera ningún campo, tipo de movimiento, regla contable ni el contrato del hook compartido (`splitFirstPct`, `reimbursementReceivedNow`, `reimbursementPercent`/`Cap`, `intervalUnit` ya existen). La paridad se evalúa por **rol y estructura** de los controles, no por igualdad de píxeles ni por el widget exacto de cada plataforma. La superficie **desktop** de web NO SHALL verse afectada.

**Reintegro.** El bloque revelado SHALL presentarse como **dos filas compactas** (diseño cerrado con el PO, ref. visual en `docs/design/movement-form/reintegro/`), logrando la superficie mínima por **densidad** —sin labels sobre los campos— en vez de esconder controles:

- **Fila 1 — monto y regla de cálculo.** El **monto del reintegro** (editable a mano) junto a la **regla `% + tope` visible inline** (no detrás de un disparador). El porcentaje deriva el monto vía `applyReimbursementPercent` de forma **bidireccional** (cargar un % calcula el monto; escribir un monto a mano descarta el %); el **tope** acota el monto calculado y su texto se resalta cuando efectivamente aplicó.
- **Fila 2 — destino y estado.** El **destino**, *solo con tarjeta de crédito*, SHALL presentarse como un control **`Resumen | Cuenta`**. El valor por defecto lo fija el hook **sin cambio de comportamiento** (hoy `'account'` → "Cuenta"); este rediseño es de presentación y NO SHALL alterar ese default. Tocar **Cuenta** SHALL seleccionar la cuenta de la **misma entidad bancaria del medio de pago** sin abrir ningún selector (prerellenada por institución; comportamiento ya existente que este rediseño preserva); tocar el **nombre** de la cuenta SHALL abrir el selector, con la cuenta de la misma entidad primero (rotulada "mismo banco") y el resto después. Con cash/bank el destino es *a cuenta* sin control de resumen, y el selector de cuenta NO SHALL renderizarse cuando hay una sola cuenta cash/bank elegible. El **estado** SHALL ofrecerse como un control **"Acreditado"** (checkbox compacto, no un input crudo): apagado deja el reintegro **pendiente de confirmación** —sin chip ni texto "Pendiente"—, encendido lo registra como recibido.

Los controles crudos de web-mobile (`<input type=checkbox>`, `<input type=radio>`, `<select>`) SHALL reemplazarse por los equivalentes diseñados, con la **misma estructura** que la app nativa. La paridad se evalúa por rol/estructura, no por el widget exacto.

**Compartido (split).** El control de split SHALL ofrecer **tres presets de un gesto** —**Vos** (`splitFirstPct = 100`), **Mitad** (`50`) y **El otro** (`0`)— más un disparador **"Otro %"** que revela el editor de **porcentaje libre**. El preset **"El otro" SHALL fijar el reparto 0/100** (`{pagador: 0, otro: 100}`), absorbiendo el caso "lo pagué yo pero es 100% del otro": NO SHALL existir un toggle dedicado aparte para ese caso. El editor de porcentaje libre, cuando está revelado, SHALL permitir cualquier reparto válido (porcentajes entre 0 y 100 que suman 100). Ambas superficies mobile SHALL usar la **misma familia de claves i18n** para este control.

**Repetir (recurrencia).** En el intervalo personalizado, la **unidad** (día/semana/mes/año) SHALL elegirse con **chips** en ambas superficies mobile (no con un `select` en una y chips en la otra). El resto de la sección (chips de frecuencia, cantidad del intervalo, fecha de fin opcional, hint) ya es paritario y SHALL permanecer así.

Ninguna de estas reglas cambia el comportamiento del gasto simple: las secciones SHALL seguir arrancando desactivadas y sin parámetros (según el requirement «El gasto simple no atraviesa ninguna sección avanzada»).

#### Scenario: El reintegro se despliega como dos filas compactas con el %/tope visible

- **WHEN** el usuario activa "reintegro" en un gasto, en la web-mobile o en la app nativa
- **THEN** el bloque muestra dos filas compactas: la primera con el monto y la regla `% + tope` visible inline, la segunda con el destino y el control "Acreditado"
- **AND** el cálculo por porcentaje/tope está a la vista, no detrás de un disparador

#### Scenario: El porcentaje deriva el monto de forma bidireccional y el tope lo acota

- **WHEN** el usuario, con el reintegro activo, ingresa un porcentaje (y opcionalmente un tope)
- **THEN** el monto del reintegro se deriva de ese porcentaje sobre el gasto, acotado por el tope, y el texto del tope se resalta cuando efectivamente aplicó
- **AND** si el usuario luego escribe un monto a mano, el porcentaje se descarta

#### Scenario: El destino ofrece Resumen y Cuenta, y tocar Cuenta usa la misma entidad del medio de pago

- **WHEN** el usuario activa un reintegro sobre un gasto pagado con tarjeta de crédito
- **THEN** el destino se ofrece como el control "Resumen | Cuenta" (el default lo fija el hook, sin cambio de comportamiento)
- **AND** tocar "Cuenta" selecciona la cuenta de la misma entidad bancaria del medio de pago sin abrir ningún selector, y tocar el nombre de esa cuenta abre el selector con la cuenta de la misma entidad primero

#### Scenario: La cuenta de acreditación se oculta cuando hay una sola cuenta elegible

- **WHEN** el usuario activa un reintegro "a cuenta" (cash/bank, o crédito con destino Cuenta) y tiene una sola cuenta cash/bank elegible
- **THEN** el selector de cuenta de acreditación no se renderiza y el sistema usa esa cuenta (prerellenada por institución)
- **AND** cuando hay más de una cuenta cash/bank elegible, tocar el nombre de la cuenta abre el selector

#### Scenario: El split se resuelve de un tap en el caso común

- **WHEN** el usuario activa "compartir" en un gasto, en la web-mobile o en la app nativa
- **THEN** se ofrecen los presets Vos / Mitad / El otro como opciones de un gesto
- **AND** tocar "Mitad" fija el reparto 50/50 sin abrir el editor de porcentaje libre

#### Scenario: "El otro" es el caso 0/100 sin toggle aparte

- **WHEN** el usuario toca el preset "El otro"
- **THEN** el reparto queda en `{pagador: 0, otro: 100}` (el gasto corresponde íntegramente al otro miembro)
- **AND** no se ofrece un toggle dedicado adicional para el caso "es 100% del otro"

#### Scenario: "Otro %" revela el reparto arbitrario en ambas superficies

- **WHEN** el usuario toca "Otro %" e ingresa `70`
- **THEN** el reparto queda 70/30 entre el pagador y el otro miembro
- **AND** este reparto arbitrario está disponible tanto en la web-mobile como en la app nativa

#### Scenario: La unidad del intervalo personalizado se elige con chips en ambas superficies

- **WHEN** el usuario activa "repetir", elige frecuencia "personalizado" y va a elegir la unidad del intervalo
- **THEN** la unidad (día/semana/mes/año) se elige con chips tanto en la web-mobile como en la app nativa

## MODIFIED Requirements

### Requirement: El formulario ofrece las funcionalidades avanzadas según el contexto y las activa en el lugar

Las funcionalidades avanzadas del alta —reintegro, gasto compartido y repetir (recurrencia)— SHALL ofrecerse como opciones de activación directa gateadas por el contexto: un solo gesto SHALL activar la funcionalidad y revelar sus parámetros en el lugar, y otro gesto SHALL desactivarla. El conjunto ofrecido depende del contexto y de los datos (gasto compartido solo con un hogar de dos miembros; repetir no disponible en compras en cuotas; ninguna en `ajuste` ni `cambio de moneda`), de modo que puede ir de una a tres opciones o ninguna. Las cuotas SHALL ofrecerse junto a la cuenta cuando esta es una tarjeta de crédito, por ser parte de la forma de pago, y no dentro de las funcionalidades avanzadas. Ninguna de estas funcionalidades SHALL estar activa por defecto ni ser obligatoria para un gasto simple.

Al revelar sus parámetros, cada funcionalidad SHALL mostrar la **superficie mínima**, sea por **densidad** (bloque compacto sin labels redundantes, como el reintegro) o por **disclosure** (los controles de conveniencia poco frecuentes a un gesto de distancia detrás de un disparador, como el editor de porcentaje libre de un split tras "Otro %"), en lugar de volcar todos los controles de una. El detalle de qué queda visible y cómo se alcanza lo secundario en cada sección, y la paridad de estos parámetros entre las superficies mobile, lo fija el requirement «El despliegue de las secciones avanzadas es de superficie mínima y paritario entre las superficies mobile».

#### Scenario: Activar una funcionalidad revela sus parámetros en el lugar

- **WHEN** el usuario activa "compartir" en un gasto
- **THEN** aparecen los parámetros del split (con un default 50/50) sin abrir otra pantalla
- **AND** desactivarla los oculta de nuevo

#### Scenario: Al activar una funcionalidad se revela su superficie mínima

- **WHEN** el usuario activa "reintegro" en un gasto
- **THEN** el bloque muestra el monto y la regla `% + tope` en una fila compacta, y el destino más el control "Acreditado" en otra
- **AND** no se vuelcan labels ni controles redundantes; la densidad hace las veces de la superficie mínima

#### Scenario: El conjunto de funcionalidades es contextual

- **WHEN** el usuario abre el alta en `ingreso`
- **THEN** se ofrece "repetir" pero no "reintegro" ni "gasto compartido"

#### Scenario: El gasto compartido requiere un hogar de dos

- **WHEN** el usuario no tiene un hogar de dos miembros
- **THEN** no se ofrece la opción de gasto compartido

#### Scenario: Las cuotas se ofrecen junto a la cuenta de crédito

- **WHEN** el usuario selecciona una tarjeta de crédito para un gasto
- **THEN** la elección de cuotas aparece junto a la cuenta, como parte de la forma de pago
- **AND** no aparece entre las funcionalidades avanzadas

### Requirement: La app nativa expone la pantalla de alta de movimiento `/transactions/new`

La app nativa SHALL exponer una pantalla full-screen `/transactions/new` para **registrar** un movimiento, como thin consumer del hook `useMovementForm` de `@grana/movement-form`. La pantalla SHALL montar el hook pasándole: las cuentas del usuario proyectadas a `MovementFormAccount`, el árbol de categorías (`getAllCategories`), el hogar (`getHousehold`, cuando exista), `today: getTodayAR()`, una `translate` wire al i18n mobile, y un objeto `Mutators` nativo. La JSX SHALL ser RN idiomática sobre los primitivos existentes (`PageHeader`, `Segmented`, `MoneyAmountInput`, `DateField`, `SelectField`/`SelectSheet`, `Switch`, `FormError`), con la chrome (`PageHeader` + CTA) visible desde el primer paint.

La selección de **cuenta** y **categoría** SHALL renderizarse con el picker `SelectField` + `SelectSheet` (un trigger-row compacto que muestra la selección actual —avatar + nombre, o placeholder— y abre un `formSheet` modal con la lista), NO como listas de filas inline. El picker NO SHALL incluir buscador (paridad con web). La selección de categoría SHALL drillear **un nivel** dentro del mismo sheet, espejo del web: nivel de categorías (las que tienen subcategorías abren el drill; las que no, se seleccionan directo) → nivel drilleado con "volver", "Toda la categoría" y las subcategorías. El trigger de categoría SHALL mostrar `Categoría › Subcategoría` cuando hay subcategoría elegida.

El alcance de esta pantalla es **create-completo**: SHALL ofrecer las cinco tabs **Gasto**, **Ingreso**, **Transferencia**, **Ajuste** y **Cambio**. El picker de cuentas SHALL incluir **todas** las cuentas del usuario (cash, bank y credit), proyectando las credit como off-ledger (`balances: { ARS: 0, USD: 0 }`, avatar resuelto vía `resolveAccountAvatar`); el gate `eligibleFor` del hook restringe credit a la tab Gasto, y la fila credit SHALL mostrar el hint de consumo de tarjeta (`transactions.drawer.credit_hint`). La pantalla NO SHALL ofrecer (todavía) la **edición** de movimientos (change C).

Con una cuenta credit seleccionada en Gasto, la pantalla SHALL ofrecer **cuotas** cuando la moneda es ARS: chips preset `1·3·6·12` más un stepper custom acotado a 2–60, con preview del monto por cuota y CTA dinámico (`actions.register_installments`); con moneda USD SHALL mostrar el hint de cuotas-sólo-ARS en lugar de los chips, sin bloquear el consumo simple en USD. El submit SHALL rutear vía el hook a `registerCardPurchase` (consumo simple) o `registerInstallments` (cuotas), sin lógica de ruteo propia en la pantalla.

En la tab Gasto la pantalla SHALL ofrecer la **declaración de reintegro** con paridad web y **superficie mínima**, como el **bloque compacto de dos filas** del diseño cerrado (`docs/design/movement-form/reintegro/`): fila 1 con el **monto del reintegro** y la regla **`% + tope` visible inline** (`applyReimbursementPercent`, bidireccional, con el tope resaltado cuando aplica); fila 2 con el **destino** *Resumen | Cuenta* (sólo con credit; cash/bank implica 'account', sin control de resumen) y el estado **"Acreditado"** (checkbox compacto, con su comportamiento pendiente/recibido, no un input crudo). El destino default es Resumen; tocar "Cuenta" elige la cuenta de la **misma entidad del medio de pago** sin abrir el picker, y tocar el **nombre** abre el picker de cuenta de acreditación (misma entidad primero; oculto cuando hay una sola cuenta cash/bank elegible). El bloque SHALL estar disponible también sobre una compra **en cuotas**: el hook vincula el reintegro a la madre de la compra (el subtipo *a resumen* cae en el período de la primera cuota), igual que web. La superficie mínima y la paridad de estos controles con la web-mobile la fija el requirement «El despliegue de las secciones avanzadas es de superficie mínima y paritario entre las superficies mobile».

La pantalla SHALL soportar el **gasto compartido**: cuando el hogar tiene exactamente dos miembros, SHALL exponer el toggle "Compartir gasto" y el control de split como **presets de un gesto** (Vos / Mitad / El otro) más un escape a **porcentaje libre** ("Otro %"), permitiendo **cualquier reparto** incluido el **100%-al-otro-miembro** (preset "El otro", que fija 0/100). Si no hay hogar de dos miembros (o el read falla), el toggle NO SHALL renderizarse y el alta simple SHALL seguir funcionando.

En la tab **Ajuste** la pantalla SHALL ofrecer un toggle de **dirección** Suma/Resta (`Segmented` de dos opciones cortas, sobre `adjustmentDirection`), un **banner** informativo (`drawer.adjust_banner_title`/`_body`) y un **preview de saldo** "Saldo quedará" que muestre `saldo actual → saldo resultante` computado con `Money.add`/`Money.subtract` sobre el balance de la moneda seleccionada según la dirección. La descripción SHALL re-etiquetarse a "Motivo del ajuste" (`drawer.adjust_reason`) y la categoría NO SHALL renderizarse. El submit SHALL rutear vía el hook a `createAdjustment` con el monto firmado por la dirección.

En la tab **Cambio** la pantalla SHALL ofrecer un picker de **cuenta destino** (cash/bank, reusando el `AccountSelectField`) y una card de **monto recibido** (`labels.exchange_received`) con un segundo `MoneyAmountInput`, el chip de la moneda destino derivada (`exchangeDestCurrency`, la opuesta a la de origen) y un hint de tasa implícita read-only. Cuando la cuenta destino NO habilita la otra moneda (`exchangeDestCurrency` es null) la pantalla SHALL mostrar el hint `exchange.no_other_currency_hint` en lugar de la card, y el submit SHALL bloquearse in-context (el hook valida `destination_account_no_other_currency`). El submit SHALL rutear vía el hook a `createExchange`.

En las tabs **Gasto** (sin cuotas), **Ingreso** y **Transferencia** la pantalla SHALL ofrecer un toggle **Repetir** (recurrencia): `Switch` (`isRecurrent`) más, al activarse, chips de **frecuencia** (semanal/quincenal/mensual/anual/personalizado sobre `frequency`), y —para `custom`— un `intervalCount` numérico junto a un selector de **unidad** por **chips** (día/semana/mes/año, `intervalUnit`), y un `DateField` de "repetir hasta" opcional (`recurrenceEndDate`; el orquestador valida `end_date ≥ fecha del movimiento` server-side). El toggle NO SHALL renderizarse en Ajuste, Cambio ni sobre una compra **en cuotas**. Al guardar con recurrencia activa, tras crear el movimiento el submit SHALL invocar `createRecurrenceFromMovement` vía el hook; si esa llamada falla, el error SHALL mostrarse in-context.

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

- **WHEN** el usuario registra un gasto (cash/bank, o credit con o sin cuotas), activa el toggle Reintegro y completa el monto (directo o por %/tope, ambos visibles inline)
- **THEN** el submit envía la declaración al mutator (`createExpense`, `registerCardPurchase` o `registerInstallments`), que la inserta atómicamente con rollback
- **AND** con credit el usuario puede elegir destino *Resumen* (reduce el período) o *Cuenta* (misma entidad del medio de pago por defecto); con cash/bank el destino es *a cuenta* sin control de resumen
- **AND** sobre una compra en cuotas el reintegro se vincula a la madre (el subtipo *a resumen* cae en el período de la primera cuota)

#### Scenario: Gasto compartido 100%-al-otro desde mobile

- **WHEN** el hogar tiene dos miembros y el usuario activa "Compartir gasto" y toca el preset "El otro"
- **THEN** el submit envía el spec de split al mutator, que aplica `applySharedSplits` con el reparto 0/100
- **AND** el gasto queda marcado como compartido con la porción íntegra correspondiente al otro miembro

#### Scenario: Gasto compartido con reparto arbitrario desde mobile

- **WHEN** el hogar tiene dos miembros y el usuario activa "Compartir gasto", toca "Otro %" e ingresa `70`
- **THEN** el reparto queda 70/30 y el submit envía ese spec de split al mutator
- **AND** el reparto arbitrario está disponible en mobile igual que en web

#### Scenario: Registrar un ajuste de saldo desde mobile

- **WHEN** el usuario elige la tab "Ajuste", selecciona una cuenta, un monto, la dirección Suma o Resta, escribe un motivo y guarda
- **THEN** el preview "Saldo quedará" muestra `saldo actual → saldo resultante` según la dirección antes del submit
- **AND** el submit rutea a `createAdjustment` con el monto firmado (negativo en Resta) y sin categoría

#### Scenario: Registrar un cambio de moneda desde mobile

- **WHEN** el usuario elige la tab "Cambio", una cuenta de origen, una cuenta destino que habilita la otra moneda, el monto entregado y el monto recibido, y guarda
- **THEN** la card de monto recibido muestra la moneda destino derivada y la tasa implícita, y el submit rutea a `createExchange`
- **AND** si la cuenta destino no habilita la otra moneda, la pantalla muestra el hint "sin otra moneda" y el submit queda bloqueado in-context

#### Scenario: Registrar un movimiento recurrente desde mobile

- **WHEN** el usuario registra un gasto simple / ingreso / transferencia, activa el toggle "Repetir", elige una frecuencia (y para "personalizado" un intervalo count+unidad por chips y opcionalmente una fecha de fin) y guarda
- **THEN** el submit crea primero el movimiento y luego invoca `createRecurrenceFromMovement` con la frecuencia declarada
- **AND** el toggle "Repetir" no se ofrece en las tabs Ajuste ni Cambio, ni sobre una compra en cuotas

#### Scenario: La chrome de la pantalla de alta está visible desde el primer paint

- **WHEN** la pantalla `/transactions/new` hace cold-load y aún resuelve `accounts`/`categories`/`household`
- **THEN** el `PageHeader` (back + título) y el CTA de guardar ya están presentes (el CTA deshabilitado hasta que el form está listo)
- **AND** la carga no se cubre con un skeleton que tape la chrome
