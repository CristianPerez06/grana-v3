## MODIFIED Requirements

### Requirement: La lógica del formulario vive en `@grana/movement-form` y los orquestadores en `@grana/transactions-mutations`

El sistema SHALL alojar el estado, las cascadas (tab → cuentas elegibles / moneda / toggles válidos), los validadores y el submit dispatcher del formulario de movimientos en un hook React compartido `useMovementForm` en el package `@grana/movement-form`. El hook SHALL recibir un objeto `Mutators` (tipo top-level exportado por el package) que cada plataforma binde a sus actions de movimiento — web a las server actions de Next, mobile a wrappers que componen las thin mutations compartidas + los orquestadores compartidos. La JSX SHALL quedar en cada app (web/mobile) y consumir el hook.

Las mutaciones que orquestan varias filas o tablas con rollback (`registerInstallments`, `registerCardPurchase`, `createRecurrenceFromMovement`) SHALL vivir en `@grana/transactions-mutations` como funciones puras que reciben un cliente Supabase ya autenticado y un input ya validado, devolviendo `{ ok, formError?, fieldErrors?, id?/parentId? }`.

Las **thin mutations** (creates/updates simples: `createIncome`, `createExpense`, `createTransfer`, `createAdjustment`, `createExchange`, `updateTransaction`, `updateTransfer`, `updateAdjustment`, `updateExchange`, `updateInstallmentParent`) SHALL vivir también en `@grana/transactions-mutations` como funciones isomórficas con la **misma frontera** que los orquestadores: reciben un cliente Supabase **ya autenticado** (más el `userId` resuelto) y un input **ya validado**, devuelven `{ ok, id?, formError?, fieldErrors? }`, y NO SHALL redeclararse inline en cada plataforma. El pre-check de moneda activa (`verifyActiveCurrency`) SHALL acompañarlas en el package (lógica de dominio reusable). Auth (`getAuthenticatedUserId` / `supabase.auth.getUser`) y cache invalidation (`revalidatePath` en web / TanStack en mobile) SHALL quedar en el shell de cada plataforma — ni el orquestador ni la thin mutation conocen ninguno de los dos. Web SHALL consumir las thin mutations vía wrappers thin (validate + auth + delegate + `revalidateAfterMovementMutation`), preservando la firma pública de las server actions y los query keys previos; el comportamiento de `/transactions` y de los call-sites de alta/edición SHALL ser idéntico.

#### Scenario: Web binde el hook a sus server actions

- **WHEN** el componente web del formulario monta el drawer
- **THEN** instancia `useMovementForm` pasando un objeto `Mutators` que mapea cada slot a la server action correspondiente (`createIncome`, `createExpense`, …, `registerInstallments`, `registerCardPurchase`, `createRecurrenceFromMovement`, `suggestCategoryFromHistory`)
- **AND** wirea `onMutationSuccess` para invalidar TanStack queries + `router.refresh()`, y `onSuccess` para cerrar el drawer o navegar

#### Scenario: Mobile binde el hook a wrappers sobre las mutations compartidas

- **WHEN** la pantalla nativa de alta monta `useMovementForm`
- **THEN** pasa un objeto `Mutators` cuyos slots componen `validate(schema) → supabase.auth.getUser() → la thin mutation / el orquestador de @grana/transactions-mutations → { ok, ... }`
- **AND** wirea `onMutationSuccess` a la invalidación de TanStack Query nativa y `onSuccess` a la navegación de vuelta al feed
- **AND** no redeclara el cuerpo `.insert({...})` de ninguna mutation — lo importa del package

#### Scenario: Los orquestadores son la única fuente de verdad de la danza de rollback

- **WHEN** un nuevo consumer (mobile, una server action distinta, un script) necesita registrar cuotas o un consumo simple en tarjeta
- **THEN** importa la función desde `@grana/transactions-mutations` y le pasa su propio cliente Supabase
- **AND** el orquestador ejecuta la misma secuencia atómica con rollback de parent/children/shared splits y devuelve `{ ok, parentId | id, formError?, fieldErrors? }`

#### Scenario: Las thin mutations no se duplican entre plataformas

- **WHEN** web y mobile registran o editan un movimiento simple (ingreso, gasto, transferencia, ajuste, cambio de moneda)
- **THEN** ambas plataformas invocan la misma función de `@grana/transactions-mutations` pasando su propio cliente autenticado y el input ya validado
- **AND** la server action web es un wrapper thin (validate + auth + delegate + revalidate) sin lógica de insert propia
- **AND** el comportamiento de `/transactions` y de los call-sites de alta/edición web no cambia

#### Scenario: El contrato `Mutators` es un drift detector

- **WHEN** una nueva action entra al submit dispatcher del hook
- **THEN** la propiedad correspondiente se agrega al tipo `Mutators` exportado
- **AND** cualquier consumer (web, mobile) cuyo objeto `Mutators` no tenga esa propiedad falla en tiempo de compilación, no en runtime

### Requirement: La app nativa expone un FAB para registrar un movimiento

En la app nativa, las pantallas `dashboard` y `transactions` SHALL renderizar un FAB equivalente al de mobile-web para iniciar el alta de un movimiento. El FAB nativo SHALL ser un cuadrado de 80×80 px con esquinas ligeramente redondeadas (`rounded-2xl`), fondo `bg-emerald` (token emerald del mirror de tokens, no hex hardcodeado), ícono `Plus` blanco, anclado en `bottom-10 right-10` por encima del tab bar (no debajo). El label accesible SHALL leerse del catálogo i18n (`transactions.actions.register_movement`).

Con la pantalla `/transactions/new` mobile ya existente, el FAB nativo SHALL estar **habilitado**: SHALL renderizarse sin `opacity-50` y sin `accessibilityState.disabled`, y un tap SHALL ejecutar `router.push('/transactions/new')` navegando a la pantalla de alta. El destino `/transactions/new` SHALL seguir declarado en el componente.

La pantalla `dashboard` SHALL reservar padding inferior en su `ScrollView` (`pb-28` o equivalente) para que el FAB nativo no tape la última sección al scrollear. La pantalla `transactions` SHALL aplicar la misma reserva en su contenido scrolleable.

#### Scenario: FAB visible en dashboard y transactions (mobile native)

- **WHEN** el usuario autenticado abre la pestaña `Dashboard` o `Movimientos` en la app nativa
- **THEN** ve un FAB cuadrado verde de 80 px anclado en la esquina inferior derecha, por encima del tab bar
- **AND** el FAB respeta el safe-area del dispositivo (el tab bar es quien maneja el inset bottom)

#### Scenario: El FAB nativo navega a `/transactions/new`

- **WHEN** el usuario tapea el FAB en la app nativa
- **THEN** el FAB se renderiza habilitado (sin `opacity-50` ni `accessibilityState.disabled`)
- **AND** el tap ejecuta `router.push('/transactions/new')` y abre la pantalla de alta

#### Scenario: El label del FAB nativo es traducible

- **WHEN** un desarrollador inspecciona el FAB en la app nativa
- **THEN** el `accessibilityLabel` se obtiene del catálogo i18n (`transactions.actions.register_movement`), sin string hardcodeado

## ADDED Requirements

### Requirement: La app nativa expone la pantalla de alta de movimiento `/transactions/new`

La app nativa SHALL exponer una pantalla full-screen `/transactions/new` para **registrar** un movimiento, como thin consumer del hook `useMovementForm` de `@grana/movement-form`. La pantalla SHALL montar el hook pasándole: las cuentas del usuario proyectadas a `MovementFormAccount`, el árbol de categorías (`getAllCategories`), el hogar (`getHousehold`, cuando exista), `today: getTodayAR()`, una `translate` wire al i18n mobile, y un objeto `Mutators` nativo. La JSX SHALL ser RN idiomática sobre los primitivos existentes (`PageHeader`, `Segmented`, `MoneyAmountInput`, `DateField`, `SelectableCard`, `Switch`, `FormError`), con la chrome (`PageHeader` + CTA) visible desde el primer paint.

El alcance de esta pantalla es **create-only y B-minimal**: SHALL ofrecer las tabs **Gasto**, **Ingreso** y **Transferencia**, sobre cuentas **cash/bank** únicamente. La pantalla NO SHALL ofrecer (en este slice) el consumo de tarjeta de crédito, las cuotas, el reintegro, el cambio de moneda, el ajuste, ni la recurrencia — cada uno es un slice aditivo posterior. Al restringir el picker a cash/bank, las ramas `isCredit`/`isInstallments` del hook quedan inalcanzables desde mobile sin modificar el hook.

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

#### Scenario: Gasto compartido 100%-al-otro desde mobile

- **WHEN** el hogar tiene dos miembros y el usuario activa "Compartir gasto" y lleva el split a 100% para el otro miembro
- **THEN** el submit envía el spec de split al mutator, que aplica `applySharedSplits` con el reparto declarado
- **AND** el gasto queda marcado como compartido con la porción correspondiente al otro miembro

#### Scenario: El picker de cuentas ofrece sólo cash/bank en el slice B-minimal

- **WHEN** el usuario abre el selector de cuentas en cualquiera de las tres tabs
- **THEN** sólo ve cuentas de tipo cash/bank (ninguna cuenta de crédito)
- **AND** las ramas de consumo de tarjeta / cuotas del hook no son alcanzables desde la pantalla

#### Scenario: La chrome de la pantalla de alta está visible desde el primer paint

- **WHEN** la pantalla `/transactions/new` hace cold-load y aún resuelve `accounts`/`categories`/`household`
- **THEN** el `PageHeader` (back + título) y el CTA de guardar ya están presentes (el CTA deshabilitado hasta que el form está listo)
- **AND** la carga no se cubre con un skeleton que tape la chrome
