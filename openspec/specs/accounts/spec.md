# accounts Specification

## Purpose

El módulo `accounts` modela las cuentas donde el usuario lleva su dinero — efectivo y cuentas bancarias/débito. Una cuenta agrupa saldos por moneda (bimoneda ARS/USD) y es el contenedor sobre el cual se registran las transacciones. El saldo de cada moneda se calcula on-the-fly desde `initial_balance + Σ transactions`; nunca se persiste.

Este módulo es **prerequisito** del módulo `transactions` y de cualquier módulo financiero posterior (tarjetas de crédito, recurrencias, gastos compartidos, ahorros).
## Requirements
### Requirement: Cuenta Efectivo por defecto en el signup

El sistema SHALL crear automáticamente una cuenta `Efectivo` (type `cash`, sin institución) para todo usuario nuevo en el momento del signup. La cuenta default se inicializa con dos `account_currencies` activas — ARS y USD — ambas con `initial_balance = 0`. Este bootstrap se ejecuta vía trigger `SECURITY DEFINER` sobre `auth.users` y bypassa RLS.

#### Scenario: Usuario nuevo recibe cuenta Efectivo

- **WHEN** un usuario completa el signup
- **THEN** existe en `accounts` una fila con `name='Efectivo'`, `type='cash'`, `institution_id=NULL`, `is_active=true` cuyo `user_id` matchea el usuario recién creado

#### Scenario: La cuenta Efectivo default tiene ARS y USD activas

- **WHEN** se crea la cuenta Efectivo por trigger
- **THEN** existen dos filas en `account_currencies` para esa cuenta, una con `currency_code='ARS'` y otra con `'USD'`, ambas con `initial_balance=0` y `is_active=true`

#### Scenario: Usuarios pre-existentes reciben la cuenta default vía backfill

- **WHEN** se aplica la migración del módulo `accounts` y existen usuarios sin cuenta `cash`
- **THEN** la migración crea retroactivamente una cuenta `Efectivo` (con ARS y USD activos a saldo cero) para cada uno de esos usuarios

---

### Requirement: El usuario puede crear una cuenta de efectivo

El sistema SHALL permitir crear una cuenta de `type='cash'`. Una cuenta cash requiere: `name` (1–50 caracteres, trimmed) y al menos una moneda activa con `initial_balance ≥ 0`. Una cuenta cash NO puede tener institución asociada — la DB rechaza `institution_id IS NOT NULL` mediante la constraint `chk_cash_no_institution`. Una cuenta cash NO puede tener `credit_limit`, `network_id` ni `other_network_name` — la DB rechaza valores no nulos en esos campos para `type != 'credit'` mediante `chk_credit_columns_only_for_credit`.

#### Scenario: Cuenta cash creada correctamente

- **WHEN** el usuario completa el formulario con `name='Mi billetera'`, `type='cash'` y al menos una moneda con `initial_balance` válido y confirma
- **THEN** el sistema inserta una fila en `accounts` con `type='cash'`, `institution_id=NULL`, `credit_limit=NULL`, `network_id=NULL`, `other_network_name=NULL`, `is_active=true`, y una o más filas en `account_currencies` con `is_active=true`

#### Scenario: Cuenta cash con institución es rechazada

- **WHEN** el usuario intenta crear una cuenta `type='cash'` con un `institution_id` no nulo
- **THEN** la DB rechaza el INSERT por la constraint `chk_cash_no_institution`

#### Scenario: Cuenta cash con `credit_limit` es rechazada

- **WHEN** se intenta insertar una cuenta `type='cash'` con `credit_limit=100000`
- **THEN** la DB rechaza por `chk_credit_columns_only_for_credit`

---

### Requirement: El usuario puede crear una cuenta bancaria/débito

El sistema SHALL permitir crear una cuenta de `type='bank'`. Una cuenta bank requiere: `name`, al menos una moneda activa con `initial_balance ≥ 0`, **y** una `institution_id` que referencie una fila activa de `institutions`. La DB rechaza `institution_id IS NULL` para `type='bank'` mediante la constraint `chk_bank_has_institution`. Una cuenta bank NO puede tener `credit_limit`, `network_id` ni `other_network_name` — la DB rechaza esos campos mediante `chk_credit_columns_only_for_credit`.

#### Scenario: Cuenta bank creada correctamente

- **WHEN** el usuario completa el formulario con `name='Caja de ahorro'`, `type='bank'`, una institución del catálogo y al menos una moneda con `initial_balance` válido
- **THEN** el sistema inserta la cuenta y sus monedas
- **AND** los campos `credit_limit`, `network_id` y `other_network_name` quedan NULL

#### Scenario: Cuenta bank sin institución es rechazada en validación

- **WHEN** el usuario intenta crear una cuenta `type='bank'` sin elegir institución
- **THEN** la action retorna error de validación y no inserta nada

#### Scenario: Cuenta bank sin institución es rechazada en DB

- **WHEN** se intenta insertar (vía API directa) una fila `type='bank'` con `institution_id=NULL`
- **THEN** la DB rechaza el INSERT por la constraint `chk_bank_has_institution`

#### Scenario: Cuenta bank con `credit_limit` es rechazada

- **WHEN** se intenta insertar una cuenta `type='bank'` con `credit_limit=100000`
- **THEN** la DB rechaza por `chk_credit_columns_only_for_credit`

---

### Requirement: Crear institución custom desde el form de cuenta

El sistema SHALL permitir al usuario crear una institución propia ("custom") desde el dropdown del form de cuenta (`CreateAccountForm` y `EditAccountForm`) cuando el banco/billetera buscada no existe en el catálogo. La institución custom queda asociada al usuario (`user_id = auth.uid()`) y es indistinguible del catálogo aguas arriba: tiene los mismos campos (`name`, `brand_color`, `icon_type`) y el avatar de cuenta deriva de ella con las mismas reglas que el catálogo.

La creación SHALL ocurrir vía un sub-form inline dentro del dropdown (no modal), que pide `name` (1–50 trimmed, único por usuario) y `brand_color` (de la paleta curada de cuentas `ACCOUNT_COLOR_HEX`). El `icon_type` se setea siempre a `'bank'` (ícono `landmark`) — la distinción `bank`/`wallet` fue evaluada y descartada como ruido cognitivo sin valor de producto; si en el futuro se necesita control fino del ícono, se expone como picker dedicado. El sub-form aparece al hacer click en un ítem "+ Agregar nueva institución…" que el dropdown expone siempre al final, promocionado con CTA cuando la búsqueda actual devuelve 0 matches (pre-rellenando el `name` con la búsqueda). Confirmar persiste la institución y la deja seleccionada en el form padre; cancelar vuelve al dropdown sin persistir.

#### Scenario: El usuario crea una institución custom desde el alta de cuenta

- **WHEN** un usuario crea una cuenta bancaria, busca en el dropdown un nombre que no matchea, y hace click en "+ Agregar «<query>» como nueva"
- **THEN** aparece un sub-form inline con campos `name` y `color`
- **AND** el `name` viene pre-rellenado con el texto buscado

#### Scenario: La institución custom queda seleccionada al crearla

- **WHEN** el usuario confirma la creación con datos válidos
- **THEN** la institución se persiste con `user_id = auth.uid()` e `icon_type='bank'`
- **AND** queda seleccionada en el dropdown del form padre con su chip de color a la izquierda del nombre
- **AND** el sub-form se cierra

#### Scenario: Cancelar el sub-form no persiste nada

- **WHEN** el usuario abre el sub-form, ingresa datos, y hace click en Cancelar
- **THEN** la institución no se persiste y el dropdown vuelve a su estado anterior

#### Scenario: La cuenta bancaria con institución custom funciona como con catálogo

- **WHEN** el usuario crea una cuenta `type='bank'` apuntada a una institución custom
- **THEN** la cuenta se persiste con `institution_id` apuntando a la fila custom
- **AND** el avatar de la cuenta (en lista, detalle y dashboard) usa el `brand_color` y `icon_type` de esa institución

---

### Requirement: Una cuenta puede tener saldos en múltiples monedas

El sistema SHALL modelar el saldo de cada cuenta como una colección de filas `account_currencies` (una por moneda). Cada fila representa un sub-saldo independiente para una moneda. Las únicas monedas soportadas son `ARS` y `USD` (enforced por `chk_account_currencies_supported`). El par `(account_id, currency_code)` es único.

#### Scenario: Cuenta puede tener ARS y USD activos simultáneamente

- **WHEN** una cuenta tiene dos filas en `account_currencies`: una ARS y una USD, ambas `is_active=true`
- **THEN** ambos sub-saldos se muestran en el detalle de la cuenta y la cuenta acepta transacciones de cualquiera de las dos monedas

#### Scenario: Intento de duplicar (cuenta, moneda) es rechazado

- **WHEN** se intenta insertar una segunda fila `account_currencies` con la misma `(account_id, currency_code)` de una fila existente
- **THEN** la DB rechaza el INSERT por la constraint UNIQUE

#### Scenario: Moneda fuera de ARS/USD es rechazada

- **WHEN** se intenta insertar `account_currencies` con `currency_code='EUR'`
- **THEN** la DB rechaza por `chk_account_currencies_supported`

---

### Requirement: El usuario puede agregar una moneda a una cuenta existente

El sistema SHALL permitir agregar una nueva moneda activa a una cuenta. El `initial_balance` debe ser `≥ 0`. Si la moneda ya existe como `account_currencies` para la cuenta (incluyendo casos donde se había desactivado previamente), la operación re-activa esa fila y actualiza el `initial_balance` (upsert sobre `(account_id, currency_code)`).

#### Scenario: Agregar moneda nueva

- **WHEN** una cuenta tiene solo ARS y el usuario agrega USD con `initial_balance=100`
- **THEN** se inserta una nueva fila en `account_currencies` con `currency_code='USD'`, `initial_balance=100`, `is_active=true`

#### Scenario: Re-activar moneda previamente desactivada

- **WHEN** una cuenta tenía USD previamente con `is_active=false` y el usuario vuelve a agregarla con `initial_balance=50`
- **THEN** el sistema upsertea sobre la misma fila: `initial_balance` queda en 50, `is_active=true`

---

### Requirement: El usuario puede desactivar una moneda de una cuenta

El sistema SHALL permitir desactivar una moneda específica de una cuenta (set `is_active=false` en `account_currencies`), siempre que se cumplan **dos** condiciones:

1. El saldo derivado de esa moneda en esa cuenta es exactamente cero (es decir, `initial_balance + Σ transactions = 0`, considerando ingresos, gastos, transferencias salientes, transferencias entrantes y ajustes).
2. Después de desactivar, la cuenta sigue teniendo al menos una moneda activa.

Desactivar **no** elimina la fila — la información histórica se conserva, pero la cuenta deja de aceptar transacciones nuevas en esa moneda. Una moneda desactivada puede ser re-activada con `addCurrencyToAccount`.

#### Scenario: Desactivar moneda con saldo cero exitosa

- **WHEN** una cuenta tiene ARS y USD activos, el saldo USD = 0 y hay más de una moneda activa
- **THEN** la operación setea `is_active=false` en la fila USD y la cuenta queda solo con ARS operativa

#### Scenario: Desactivar moneda con saldo distinto de cero es rechazada

- **WHEN** la cuenta tiene una moneda con saldo derivado ≠ 0 (calculado como `initial_balance + transacciones`)
- **THEN** la action retorna error "No podés desactivar una moneda con saldo distinto de cero." y no modifica nada

#### Scenario: No se puede desactivar la última moneda activa

- **WHEN** la cuenta tiene una sola moneda activa
- **THEN** la action retorna error "Debe quedar al menos una moneda activa." aun si el saldo es cero

#### Scenario: El cálculo del saldo considera transferencias entrantes

- **WHEN** una cuenta es destino de una transferencia entrante de $100 ARS y tiene `initial_balance_ars = 0` sin otras transacciones
- **THEN** el saldo derivado para ARS es 100, por lo tanto la desactivación de ARS es rechazada

---

### Requirement: El usuario puede editar nombre e institución de una cuenta

El sistema SHALL permitir editar los campos mutables de una cuenta: `name` (1–50 caracteres, trimmed) e `institution_id` (solo aplicable a `type='bank'`). Los campos `type`, `user_id` y el conjunto de monedas/saldos iniciales son inmutables vía esta action — para modificar monedas hay actions específicas; para cambiar el tipo de cuenta el usuario debe crear una cuenta nueva.

#### Scenario: Editar nombre

- **WHEN** el usuario cambia el nombre de "Banco" a "Galicia ahorro"
- **THEN** el campo `name` se actualiza y el resto de la cuenta queda intacto

#### Scenario: Cambiar institución de una cuenta bank

- **WHEN** el usuario selecciona otra institución para una cuenta `type='bank'`
- **THEN** el campo `institution_id` se actualiza

#### Scenario: Edit no acepta cambios de tipo ni de monedas

- **WHEN** el usuario envía un payload con `type` o `currencies` distintos del original
- **THEN** el schema `updateAccountSchema` los rechaza (modo `strict`); solo `name` e `institution_id` son aceptados

---

### Requirement: El usuario puede archivar una cuenta

El sistema SHALL permitir archivar cualquier cuenta del usuario (set `is_active=false` en `accounts`). Para cuentas `cash` y `bank`, archivar **siempre está disponible**: no depende del saldo ni del historial de transacciones. Para cuentas `credit` (tarjetas), archivar SHALL respetar la regla R-tarjeta (ver capability `cards`): bloquear si hay algún `card_periods` no-paid con transacciones imputadas.

Archivar es la opción correcta para sacar de la vista activa una cuenta que tuvo movimientos pero que el usuario ya no usa; las transacciones se preservan intactas y la cuenta puede reactivarse en cualquier momento.

#### Scenario: Archivar cuenta cash con historial de transacciones

- **WHEN** el usuario archiva una cuenta cash que tiene movimientos registrados
- **THEN** la cuenta queda con `is_active=false`, deja de aparecer en la lista principal y todas sus transacciones se conservan

#### Scenario: Archivar cuenta cash sin transacciones también es válido

- **WHEN** el usuario archiva una cuenta cash sin movimientos
- **THEN** la operación es aceptada

#### Scenario: Archivar tarjeta con deuda pendiente es bloqueado

- **WHEN** el usuario intenta archivar una tarjeta con un período `closed` u `overdue` con transacciones imputadas
- **THEN** la action retorna error tipado `pending_debt`
- **AND** la UI muestra el dialog explicativo de la regla R-tarjeta

#### Scenario: Archivar tarjeta sin deuda (todos paid o sin tx)

- **WHEN** el usuario archiva una tarjeta cuyos períodos están todos en estado `paid` (o sin transacciones)
- **THEN** la operación es aceptada

---

### Requirement: El usuario puede reactivar una cuenta archivada

El sistema SHALL permitir reactivar una cuenta archivada (set `is_active=true`). No hay validaciones adicionales — toda cuenta archivada puede volver a activarse.

#### Scenario: Reactivar cuenta archivada

- **WHEN** el usuario reactiva una cuenta con `is_active=false`
- **THEN** la cuenta vuelve a aparecer en la lista activa

---

### Requirement: El usuario puede eliminar permanentemente una cuenta sin historial

El sistema SHALL permitir eliminar una cuenta **solo si nunca tuvo transacciones registradas**. Eliminar es la opción correcta para limpiar cuentas creadas por error (errata de tipeo, alta duplicada, prueba); no es la herramienta para "dar de baja" una cuenta con historial — para ese caso existe archivar. Una cuenta con transacciones (propias o entrantes como destino de transferencia) no puede eliminarse: el usuario debe archivarla.

La eliminación es permanente y cascadea a `account_currencies` (FK `ON DELETE CASCADE`). La DB además bloquea el delete si la cuenta es destino de alguna transferencia activa (`transfer_destination_account_id` tiene `ON DELETE RESTRICT`).

**Affordance en la UI.** La opción "Eliminar" SHALL exponerse en el menú kebab del card en la lista `/accounts` cuando `has_transactions=false`, y SHALL ocultarse del menú cuando `has_transactions=true` (caso en el que el item visible es "Archivar" en su lugar). La pantalla de detalle NO SHALL exponer la acción "Eliminar" en su header (ver requirement "El usuario puede ver el detalle de una cuenta").

#### Scenario: Eliminar cuenta sin movimientos

- **WHEN** el usuario elimina una cuenta que nunca tuvo transacciones
- **THEN** la cuenta y sus monedas se borran permanentemente

#### Scenario: Intentar eliminar cuenta con movimientos es rechazado

- **WHEN** el usuario intenta eliminar una cuenta con al menos una transacción donde `account_id = X` o `transfer_destination_account_id = X`
- **THEN** el sistema rechaza la operación y orienta al usuario a archivar en su lugar

#### Scenario: El menú del card ofrece Eliminar o Archivar según el historial

- **WHEN** una cuenta de la lista tiene `has_transactions=false`
- **THEN** el menú kebab del card incluye el item `Eliminar` (destructive) como opción de baja permanente
- **AND** también incluye `Archivar` como opción no destructiva

#### Scenario: Cuentas con historial ocultan Eliminar del menú

- **WHEN** una cuenta de la lista tiene `has_transactions=true`
- **THEN** el menú kebab NO muestra `Eliminar`
- **AND** la opción de baja visible es `Archivar`

### Requirement: El usuario puede ver la lista de sus cuentas agrupadas por tipo

El sistema SHALL mostrar las cuentas del usuario agrupadas por `type` — un grupo para `cash` y otro para `bank`. Las cuentas `type='credit'` (tarjetas) NO se listan en esta pantalla: viven en su propia capability `cards`. Por defecto la lista excluye las cuentas con `is_active=false`. El orden dentro de cada grupo es por `created_at` ascendente. Cada cuenta SHALL renderizarse con su avatar visual (ver requirement "Cada cuenta tiene un avatar visual").

La pantalla SHALL adoptar el lenguaje visual del shell de `(app)`:
- Header con `PageHeader` (título + acción "+ Nueva cuenta" como `actions`).
- Cada sección renderiza un label en caps con count (por ejemplo "EFECTIVO · 2") y un contenedor de filas con `bg-card` explícito sobre `bg-background`, hairline `border-border-soft` y radio `rounded-2xl`. Las filas dentro del card SHALL separarse con `divide-y divide-border-soft`.
- Cada fila SHALL renderizar, en este orden y en columnas alineadas: avatar (`AccountAvatar`), bloque nombre + institución, balances ARS/USD a la derecha (ARS en `text-text` semibold, USD en `text-text-soft`), y **un único trigger de menú kebab** (`MoreVertical`) al final de la fila que expone las mutaciones aplicables a esa cuenta.

Las cuentas archivadas se siguen omitiendo del listado por default, pero cuando se renderizan (por ejemplo en la misma pantalla bajo una sección dedicada) SHALL diferenciarse por: borde del card `border-dashed`, un pill `Archivada` en cada fila (`bg-warning-soft text-warning`) y el mismo trigger de menú kebab al final, con un conjunto distinto de items. El estado archivado SHALL NOT depender de `opacity` global sobre la fila o la sección.

**Trigger de menú por fila.** Cada `AccountRow` SHALL renderizar un único botón con ícono `MoreVertical` en su slot derecho. Al click, SHALL abrir un `DropdownMenu` (ver capability `overlay-primitives`) anclado al botón con los siguientes items según `(is_active, has_transactions)`:

| `is_active` | `has_transactions` | Items del menú (en orden) |
|---|---|---|
| `true` | `true` | `Editar`, `Archivar` (destructive) |
| `true` | `false` | `Editar`, `Archivar`, `Eliminar` (destructive) |
| `false` | `true` | `Reactivar` |
| `false` | `false` | `Reactivar`, `Eliminar` (destructive) |

`Editar` SHALL invocar el `AccountsEditDrawerProvider` ya provisto sobre la lista (el comportamiento del drawer es idéntico al actual). `Reactivar` SHALL ejecutar `reactivateAccount(id)` directo, sin confirmación. `Archivar` y `Eliminar` SHALL abrir un confirm dialog (ver capability `overlay-primitives`, requirement de `Dialog`) que muestra el nombre de la cuenta, copy localizado por acción, los errores tipados del action en caso de `!ok`, y un CTA con `variant="destructive"`. El menú SHALL cerrarse antes de abrir el dialog.

**Datos requeridos.** `getCashAndBankAccounts` SHALL devolver `has_transactions: boolean` por cuenta, calculado como `EXISTS` de al menos una transacción del usuario con `account_id = <cuenta>.id` o `transfer_destination_account_id = <cuenta>.id`, excluyendo `is_parent = true`. El cálculo SHALL ocurrir server-side en una sola query (sin round-trips por fila). El tipo `AccountWithBalances` SHALL incluir el flag.

**Mobile-web.** El trigger del kebab SHALL tener al menos 44×44 px de target tap. En viewports `< sm`, el dialog de confirmación SHALL presentarse como sheet desde abajo (a definir en el primitivo `Dialog`); en `≥ sm` SHALL presentarse centrado.

#### Scenario: Cuentas agrupadas por tipo

- **WHEN** el usuario tiene 2 cuentas cash y 3 cuentas bank activas
- **THEN** la pantalla muestra dos secciones: "Efectivo" con 2 y "Bancarias" con 3

#### Scenario: Las tarjetas no aparecen en la lista de cuentas

- **WHEN** el usuario tiene tarjetas de crédito (`type='credit'`) activas
- **THEN** no aparecen en la pantalla de cuentas (su listado vive en la capability `cards`)

#### Scenario: Las archivadas no aparecen por default

- **WHEN** el usuario tiene cuentas con `is_active=false`
- **THEN** no aparecen en las secciones activas del listado (pero siguen accesibles vía consulta con `includeArchived=true`)

#### Scenario: Estado vacío de un grupo

- **WHEN** el usuario no tiene cuentas activas de un tipo
- **THEN** esa sección se omite (por ejemplo, no se muestra "Bancarias" si no hay cuentas bank activas)

#### Scenario: Header de la pantalla usa `PageHeader`

- **WHEN** se renderiza `/accounts`
- **THEN** el header de la página es el componente `PageHeader` con el título de la ruta y la acción "+ Nueva cuenta" como `actions`
- **AND** no se renderiza un header artesanal con `<div>` y CTA propios

#### Scenario: Cada sección es una card blanca explícita sobre el shell

- **WHEN** se renderiza una sección con cuentas
- **THEN** el contenedor de filas usa `bg-card` (resuelto a `#FFFFFF`) con `border-border-soft` y `rounded-2xl`
- **AND** no se ve el `bg-background` del shell a través del card

#### Scenario: La sección Archivadas se diferencia por pill y borde dashed

- **WHEN** se renderiza la sección de archivadas
- **THEN** el contenedor de la sección usa `border-dashed`
- **AND** cada fila incluye un pill "Archivada" con `bg-warning-soft text-warning`
- **AND** el trigger de menú al final de la fila es el mismo kebab `MoreVertical`
- **AND** la sección NO aplica `opacity` global sobre las filas

#### Scenario: Las filas se renderizan con columnas alineadas

- **WHEN** una sección renderiza dos o más filas con nombres de cuenta de largos distintos
- **THEN** el avatar, el bloque de balances y el trigger de menú mantienen el mismo "riel" vertical en todas las filas (slots de ancho fijo, no derivado del contenido)

#### Scenario: Menú de cuenta activa con transacciones

- **WHEN** el usuario abre el kebab de una fila con `is_active=true` y `has_transactions=true`
- **THEN** el menú muestra exactamente dos items: `Editar` (default) y `Archivar` (destructive)
- **AND** no incluye `Eliminar`

#### Scenario: Menú de cuenta activa sin transacciones

- **WHEN** el usuario abre el kebab de una fila con `is_active=true` y `has_transactions=false`
- **THEN** el menú muestra tres items en orden: `Editar`, `Archivar`, `Eliminar`
- **AND** `Eliminar` aparece en variante destructive

#### Scenario: Menú de cuenta archivada con transacciones

- **WHEN** el usuario abre el kebab de una fila con `is_active=false` y `has_transactions=true`
- **THEN** el menú muestra solo el item `Reactivar`
- **AND** no incluye `Eliminar` ni `Editar`

#### Scenario: Menú de cuenta archivada sin transacciones

- **WHEN** el usuario abre el kebab de una fila con `is_active=false` y `has_transactions=false`
- **THEN** el menú muestra dos items: `Reactivar` y `Eliminar` (destructive)

#### Scenario: Editar abre el drawer existente

- **WHEN** el usuario clickea `Editar` en el menú
- **THEN** el menú se cierra
- **AND** se abre el drawer de edición del `AccountsEditDrawerProvider` con la cuenta de la fila ya prefilleada
- **AND** no hay navegación a `/accounts/[id]/edit`

#### Scenario: Reactivar ejecuta sin confirmación

- **WHEN** el usuario clickea `Reactivar` en el menú
- **THEN** el sistema invoca `reactivateAccount(id)` directamente
- **AND** no abre ningún dialog
- **AND** al resolver `ok=true` invalida las queries de accounts y la fila migra a la sección activa

#### Scenario: Archivar abre el confirm dialog

- **WHEN** el usuario clickea `Archivar` en el menú de una fila activa
- **THEN** el menú se cierra
- **AND** se abre un `Dialog` con el nombre de la cuenta en el título y copy de cuerpo `confirmations.archive_body`
- **AND** el CTA primario "Archivar" tiene `variant="destructive"`
- **AND** existe un CTA secundario "Cancelar" que cierra el dialog

#### Scenario: Confirmar archivar invoca la action

- **WHEN** desde el dialog el usuario confirma archivar
- **THEN** el CTA pasa a `loading` y `archiveAccount(id)` se invoca
- **AND** al resolver `ok=true` el dialog se cierra y la fila migra a la sección archivada (vía invalidación)
- **AND** al resolver `ok=false` el dialog permanece abierto con el `formError` renderizado debajo del cuerpo

#### Scenario: Eliminar abre el confirm dialog con copy específico

- **WHEN** el usuario clickea `Eliminar` en el menú
- **THEN** se abre un `Dialog` con copy `confirmations.delete_body_no_transactions`
- **AND** el CTA primario "Eliminar" tiene `variant="destructive"`
- **AND** al confirmar se invoca `deleteAccount(id)`; si resuelve `ok=true` el dialog se cierra y la fila desaparece de la lista
- **AND** si la action devolviera `ok=false` con `formError`, el dialog lo renderiza inline sin cerrarse

#### Scenario: El menú se cierra al scrollear la lista

- **WHEN** el usuario abre el kebab de una fila y luego scrollea la lista de cuentas
- **THEN** el menú se cierra (heredando el comportamiento del primitivo `Popover` sobre el que se monta)

#### Scenario: El trigger del kebab es accesible por teclado

- **WHEN** el usuario navega con `Tab` sobre la lista
- **THEN** el foco llega al botón kebab de cada fila
- **AND** `Enter` o `Space` abren el menú; `Esc` lo cierra

#### Scenario: `getCashAndBankAccounts` devuelve `has_transactions` por cuenta

- **WHEN** un Server Component o action invoca `getCashAndBankAccounts()` o `getCashAndBankAccounts({ archivedOnly: true })`
- **THEN** cada cuenta del resultado incluye `has_transactions: boolean`
- **AND** el flag es `true` si existe al menos una fila en `transactions` del usuario con `account_id = <cuenta>.id` o `transfer_destination_account_id = <cuenta>.id` y `is_parent = false`
- **AND** el flag es `false` en cualquier otro caso

### Requirement: El sistema computa el saldo de cada cuenta en cada moneda derivado de las transacciones

El sistema SHALL calcular el saldo de cada `(cuenta, moneda)` como:

```
saldo(account, currency) =
  initial_balance(account, currency)
  + Σ amount WHERE type='income'     AND account_id=account                AND currency_code=currency AND date <= hoy_AR
  − Σ amount WHERE type='expense'    AND account_id=account                AND currency_code=currency AND date <= hoy_AR
  − Σ amount WHERE type='transfer'   AND account_id=account                AND currency_code=currency AND date <= hoy_AR
  + Σ amount WHERE type='transfer'   AND transfer_destination_account_id=account AND currency_code=currency AND date <= hoy_AR
  + Σ amount WHERE type='adjustment' AND account_id=account                AND currency_code=currency AND date <= hoy_AR   (signed)
```

**Corte temporal.** `hoy_AR` es la fecha financiera del proyecto: la fecha calendario en `America/Argentina/Buenos_Aires` al momento del cálculo (el mismo "hoy" que `getTodayAR()`), nunca el reloj del browser ni el timezone del servidor de base de datos. Una transacción con `date > hoy_AR` existe, es visible en listados y detalle, pero NO SHALL aportar al saldo derivado hasta que su fecha llegue; ese día entra al cálculo automáticamente, sin acción adicional del usuario. El corte SHALL aplicarse uniformemente a todas las patas de todos los tipos on-ledger (`income`, `expense`, `transfer` ambas patas, `adjustment`, `exchange` ambas patas, `reimbursement`, `settlement`).

La sumatoria SHALL excluir transacciones donde `is_parent=true` (madres de cuotas son off-ledger). El cálculo SHALL aplicarse uniformemente a `cash` y `bank`. Para `credit`, este cálculo da siempre `0` porque las transacciones de tarjeta no afectan al saldo de la propia tarjeta (ver el invariante `I-CRED-1`: `initial_balance=0` y las `expense` con `account.type='credit'` no se restan del balance "disponible" del usuario sino que viven en su propio dominio de período).

No existe columna de saldo cacheada en `accounts` ni en `account_currencies`. El saldo se calcula al servir cada request.

#### Scenario: Saldo es initial_balance cuando no hay transacciones

- **WHEN** una cuenta tiene `initial_balance_ars = 1000` y ninguna transacción ARS
- **THEN** la pantalla de detalle muestra saldo ARS = 1000

#### Scenario: ARS y USD se calculan por separado

- **WHEN** una cuenta tiene transacciones en ambas monedas
- **THEN** se muestran dos saldos independientes; nunca se convierten ni se combinan

#### Scenario: Saldo puede ser negativo en cash/bank

- **WHEN** los gastos acumulados superan el `initial_balance` de una moneda en una cuenta cash o bank
- **THEN** el sistema muestra el saldo negativo (no lo clampea a cero)

#### Scenario: Cuenta credit reporta saldo cero en todas sus monedas

- **WHEN** un consumo en tarjeta `expense` con `status='pending'` se inserta
- **THEN** el saldo derivado de esa tarjeta sigue siendo 0 (las transacciones de tarjeta no afectan al balance de la cuenta credit)
- **AND** el saldo del resto de cuentas cash/bank no cambia

#### Scenario: Madre de cuotas no impacta saldo

- **WHEN** se inserta una transacción con `is_parent=true` y `amount=100000`
- **THEN** el cálculo de saldo de cualquier cuenta no incluye esa fila

#### Scenario: Un gasto con fecha futura no impacta el saldo de hoy

- **WHEN** hoy es `2026-07-31` y el usuario registra un gasto de `$5.000 ARS` con `date = 2026-08-10` en una cuenta con saldo ARS `$100.000`
- **THEN** el saldo derivado de la cuenta sigue mostrando `$100.000`
- **AND** el gasto es visible en el listado de movimientos de la cuenta

#### Scenario: La transacción futura entra al saldo el día que su fecha llega

- **WHEN** existe un gasto de `$5.000 ARS` con `date = 2026-08-10` y la fecha financiera AR pasa a ser `2026-08-10`
- **THEN** el saldo derivado pasa a descontar los `$5.000` automáticamente, sin acción del usuario

#### Scenario: El corte usa la fecha financiera AR, no el timezone del servidor

- **WHEN** el reloj UTC del servidor ya marca `2026-08-01` pero en `America/Argentina/Buenos_Aires` todavía es `2026-07-31`
- **THEN** una transacción con `date = 2026-08-01` todavía NO aporta al saldo
---

### Requirement: El usuario puede ver el detalle de una cuenta

El sistema SHALL mostrar la pantalla de detalle de una cuenta como una composición de **cuatro tarjetas pares** verticales sobre la `--page` surface, en este orden lógico:

1. **Hero card de identidad** (navy gradient surface): avatar, nombre, institución (si `bank`), tipo, balances ARS/USD primario/secundario, badge `Archivada` (si `is_active=false`), y el botón `Editar` (pencil icon) como única acción del slot derecho.
2. **Tarjeta de reembolsos pendientes** (solo si la cuenta tiene reembolsos pendientes asociados): renderiza el `PendingReimbursementsBlock` con su badge de conteo y la lista de items con sus formularios in-line de confirmar/cancelar.
3. **Link píldora `+ Agregar moneda`** (solo si la cuenta no tiene todas las monedas activas — ARS y USD): superficie ligera, no es una card; abre el flujo de edición de monedas.
4. **Tarjeta de movimientos** (siempre): superficie blanca con border-radius alineado al card de hero, contiene en su interior el encabezado `Movimientos` + CTA `+ Agregar transacción`, la barra de filtros (`MovementFilters` con `showAccountFilter={false}`), los chips de filtros activos y la lista (`MovementList` con running balance per-row cuando no hay filtros de contenido).

**Las mutaciones de baja (archivar / eliminar / reactivar) NO viven en el detalle**: su superficie canónica es el menú kebab del card en `/accounts` (ver requirement "El usuario puede ver la lista de sus cuentas agrupadas por tipo"). El hero card SHALL renderizar únicamente el botón `Editar` en su slot de acciones.

La pantalla de detalle en `apps/web` SHALL adoptar el patrón de **in-page chrome con shell cliente + TanStack Query** definido en el spec `route-loading-and-errors`: el `page.tsx` server-side se reserva exclusivamente para los guards terminales (auth, `notFound()` si la cuenta no existe o no pertenece al usuario, `redirect('/cards/[id]')` si la cuenta es `type='credit'`); el resto se monta como un shell cliente cuyas secciones (hero card, tarjeta de reembolsos pendientes, tarjeta de movimientos) fetchean independientemente y entregan loading/error in-place. El back-link a `/accounts` SHALL ser visible desde el primer paint; las cards SHALL exhibir cada una su propio skeleton-card mientras cargan. Los detalles del header pattern y del state de filtros están normados en los requirements correspondientes del spec `transactions`.

#### Scenario: Detalle de cuenta cash

- **WHEN** el usuario abre el detalle de una cuenta cash
- **THEN** el hero card muestra el nombre, tipo "Efectivo", sin institución, balances ARS/USD
- **AND** la tarjeta de movimientos muestra el header `Movimientos` + CTA + filtros + lista

#### Scenario: Detalle de cuenta bank muestra institución en el hero card

- **WHEN** el usuario abre el detalle de una cuenta bank
- **THEN** el hero card muestra adicionalmente el nombre de la institución asociada como subtítulo del nombre de cuenta

#### Scenario: La lista de movimientos incluye transferencias entrantes

- **WHEN** la cuenta es destino de una transferencia desde otra cuenta
- **THEN** esa transferencia aparece en la lista dentro de la tarjeta de movimientos con signo `+` y etiqueta de cuenta origen (ver spec `transactions`)

#### Scenario: Cuenta de otro usuario no es accesible

- **WHEN** el usuario intenta acceder al detalle de una cuenta que no le pertenece
- **THEN** el guard server-side del `page.tsx` retorna `notFound()` (RLS filtra la fila; la página renderiza 404)
- **AND** el shell client nunca se monta

#### Scenario: Cuenta credit redirige a /cards/[id] server-side

- **WHEN** el usuario entra a `/accounts/[id]` y la cuenta tiene `type='credit'`
- **THEN** el guard server-side ejecuta `redirect('/cards/[id]')`
- **AND** el shell client de account detail nunca se monta

#### Scenario: El back-link se renderiza desde el primer paint

- **WHEN** un usuario web navega a `/accounts/[id]` y las queries del shell aún no resolvieron
- **THEN** el back-link a `/accounts` ya está visible
- **AND** el hero card muestra su skeleton-card hasta que la query de account detail resuelva
- **AND** la tarjeta de movimientos muestra su skeleton-card hasta que las queries de movimientos resuelvan
- **AND** el botón "Editar" del hero card está disabled o cae a su link de fallback hasta que `account` e `institutions` estén disponibles

#### Scenario: El hero card solo expone Editar

- **WHEN** se renderiza el hero card del detalle de una cuenta (cash o bank)
- **THEN** el único botón en el slot derecho de acciones es `Editar`
- **AND** no se renderizan botones de `Archivar` ni `Eliminar` ni `Reactivar`
- **AND** el hero card no invoca `window.confirm()` para ninguna acción

#### Scenario: La tarjeta de reembolsos pendientes es condicional

- **WHEN** la cuenta no tiene reembolsos pendientes asociados
- **THEN** la tarjeta de reembolsos NO se renderiza
- **AND** el orden visual es: hero card → (opcional) link `+ Agregar moneda` → tarjeta de movimientos

#### Scenario: El link `+ Agregar moneda` es condicional

- **WHEN** la cuenta ya tiene ARS y USD activas
- **THEN** el link `+ Agregar moneda` NO se renderiza
- **AND** el flujo de gestión de monedas sigue disponible desde el drawer de edición

#### Scenario: Las secciones del cuerpo cargan independientemente

- **WHEN** las queries de movimientos, filtros y reembolsos del shell se ejecutan en paralelo
- **THEN** cada tarjeta muestra su propio loading state in-place mientras su query no resuelve
- **AND** una tarjeta que resuelve antes se renderiza con datos sin esperar a las demás
- **AND** una tarjeta que falla muestra error + retry localizados sin tirar el back-link ni las otras tarjetas

#### Scenario: El badge "Archivada" se renderiza sobre la superficie navy del hero card

- **WHEN** se renderiza el hero card de una cuenta con `is_active=false`
- **THEN** el badge `Archivada` aparece junto al nombre de la cuenta
- **AND** la paleta del chip está adaptada a la superficie navy del hero card (no `bg-yellow-100` sobre claro)
- **AND** la copy `accounts.badges.archived` no cambia

### Requirement: Solo el dueño de una cuenta puede leerla y modificarla

El sistema SHALL aplicar Row Level Security sobre `accounts` y `account_currencies`. Para `accounts`, la RLS exige `user_id = auth.uid()` en todas las operaciones (SELECT, INSERT, UPDATE, DELETE). Para `account_currencies`, la RLS exige que `EXISTS (SELECT 1 FROM accounts WHERE id = account_currencies.account_id AND user_id = auth.uid())` — es decir, hereda la pertenencia vía join con la cuenta padre.

#### Scenario: RLS bloquea acceso a cuentas de otro usuario

- **WHEN** un usuario autenticado consulta `accounts` sin filtro de `user_id`
- **THEN** Supabase retorna únicamente las filas donde `user_id = auth.uid()`

#### Scenario: RLS bloquea acceso a account_currencies de otro usuario

- **WHEN** un usuario autenticado consulta `account_currencies` sin filtro
- **THEN** Supabase retorna únicamente las filas cuya `account_id` matchea una cuenta propia

#### Scenario: Trigger de signup bypassa RLS

- **WHEN** se ejecuta el trigger `handle_new_user_default_account` después de un signup
- **THEN** el INSERT en `accounts` y `account_currencies` es exitoso aun cuando `auth.uid()` aún no esté seteada en ese contexto, gracias al modo `SECURITY DEFINER` de la función

### Requirement: El usuario puede crear una tarjeta de crédito

El sistema SHALL permitir crear una cuenta de `type='credit'` (tarjeta de crédito). Una tarjeta requiere: `name` (opcional 1–50 caracteres, trimmed; autogenerado si vacío), `institution_id` (referencia a fila activa de `institutions`; obligatorio), red (referencia a `card_networks.id` o nombre custom 2–50 caracteres, exactamente uno), monedas activas (ARS obligatoria), `credit_limit` opcional en ARS positivo, y las cuatro fechas del ciclo inicial (cierre y vencimiento del período actual y del próximo).

Una tarjeta tiene siempre `initial_balance=0` en todas sus `account_currencies` (enforced por constraint).

#### Scenario: Tarjeta creada con datos completos

- **WHEN** el usuario completa el formulario con banco, red (Visa), nombre opcional vacío, monedas (ARS+USD), `credit_limit=$1.500.000`, y cuatro fechas válidas
- **THEN** el sistema inserta una fila en `accounts` con `type='credit'`, `name='Visa <Banco>'` autogenerado, `credit_limit=1500000`, `network_id` apuntando a Visa
- **AND** crea dos `account_currencies` con `initial_balance=0`
- **AND** crea dos `card_periods` con `is_estimated=false`

#### Scenario: Tarjeta con red custom

- **WHEN** el usuario selecciona "otra red" e ingresa `other_network_name='Cooperativa Local'`
- **THEN** la tarjeta se crea con `network_id=NULL` y `other_network_name='Cooperativa Local'`

#### Scenario: Tarjeta sin institución es rechazada en validación

- **WHEN** el usuario intenta crear una tarjeta sin elegir institución
- **THEN** la action retorna error de validación
- **AND** no inserta nada

#### Scenario: Tarjeta con `credit_limit` cero o negativo es rechazada

- **WHEN** el usuario ingresa `credit_limit=0` o `credit_limit=-100`
- **THEN** la action retorna error de validación
- **AND** no inserta nada

---

### Requirement: Las cuentas credit no descuentan saldo disponible hasta el pago del resumen

La regla normativa completa del off-ledger de tarjetas es el invariante `I-CRED-1`, y vive en la capability `cards` (requirement "Las tarjetas no descuentan disponible hasta el pago del resumen"). Este requirement NO la redefine: fija su consecuencia sobre el saldo de cuenta y remite a la fuente para el enunciado completo.

El sistema SHALL excluir del cálculo del saldo de cualquier cuenta las transacciones de tipo `expense` con `account.type='credit'`, **en cualquier status**. Estas transacciones SHALL impactar el saldo únicamente de forma indirecta, cuando la operación "pago de resumen" se ejecute y genere un `expense` separado en una cuenta `cash` o `bank`, que sí descuenta.

La exclusión NO está condicionada a `status='pending'`. Un consumo de tarjeta ya pagado (`status='paid'`) sigue excluido: pagar el resumen no lo reincorpora al saldo, sino que agrega el `expense` de pago en la cuenta que paga.

#### Scenario: Consumo en tarjeta no descuenta saldo

- **WHEN** el usuario tiene `$500.000` en su cuenta "Galicia" y registra un consumo de `$50.000` en su tarjeta de crédito
- **THEN** el saldo de "Galicia" sigue siendo `$500.000`
- **AND** el saldo de "Mi plata" o cualquier otra cuenta `cash`/`bank` no cambia

#### Scenario: Pago de resumen sí descuenta saldo

- **WHEN** el usuario paga el resumen de la tarjeta por `$50.000` desde "Galicia"
- **THEN** el saldo de "Galicia" baja a `$450.000`

#### Scenario: Un consumo pagado no vuelve a contarse contra el saldo

- **WHEN** los consumos de un resumen pasan a `status='paid'` porque el resumen se pagó
- **THEN** el saldo de las cuentas `cash`/`bank` refleja únicamente el `expense` de pago
- **AND** los consumos individuales siguen sin descontar saldo, igual que cuando estaban `pending`

### Requirement: El usuario puede ver el detalle de una tarjeta de crédito

El sistema SHALL renderizar la pantalla de detalle para una cuenta `type='credit'` con la estructura definida en la capability `cards` (hero del período, CTA de pago, acciones, sección de períodos, detalles, movimientos).

#### Scenario: Acceso al detalle de una tarjeta propia

- **WHEN** el usuario abre `/accounts/<id>` o `/cards/<id>` para una tarjeta suya
- **THEN** se renderiza la pantalla específica de tarjetas

#### Scenario: Acceso a tarjeta de otro usuario retorna 404

- **WHEN** un usuario intenta acceder a la URL del detalle de una tarjeta que no le pertenece
- **THEN** el sistema retorna `notFound()` (RLS filtra; la página renderiza 404)

---

### Requirement: La eliminación de una tarjeta sigue las reglas generales de eliminación de cuentas

El sistema SHALL permitir eliminar una tarjeta sólo si nunca tuvo transacciones (igual que `cash` y `bank`). La eliminación SHALL cascadear a `account_currencies` y a `card_periods` (FK ON DELETE CASCADE) y a sus `period_payments`. Si la tarjeta tuvo al menos una transacción, el sistema SHALL redirigir al usuario a la opción de archivar.

#### Scenario: Eliminar tarjeta sin movimientos

- **WHEN** el usuario elimina una tarjeta que nunca tuvo transacciones
- **THEN** la cuenta, sus monedas, sus períodos y los `period_payments` se borran permanentemente

#### Scenario: Intento de eliminar tarjeta con transacciones es rechazado

- **WHEN** el usuario intenta eliminar una tarjeta con al menos una transacción
- **THEN** el sistema rechaza la operación
- **AND** la UI ofrece archivar como alternativa

### Requirement: Cada cuenta tiene un avatar visual (color + ícono)

El sistema SHALL representar cada cuenta `cash`/`bank` con un avatar visual compuesto por un **color** y un **ícono**, resueltos desde dos campos nullable `accounts.color_key` y `accounts.icon_key`. La regla de resolución SHALL ser: un valor explícito es la elección del usuario (override fijo); `NULL` significa "derivar automáticamente". El avatar SHALL renderizarse en la lista de cuentas, el header de detalle y el breakdown del hero del dashboard. (Mostrar el avatar dentro de los pickers de cuenta de los formularios de transacción/transferencia queda fuera de alcance de este requirement: el control actual es un `<select>` nativo y requiere un dropdown custom — change posterior.)

La derivación automática (`NULL`) SHALL ser:
- **bank** → color e ícono heredados **en vivo** de la institución (`institutions.brand_color`; `icon_type='bank'` → ícono `landmark`, `icon_type='wallet'` → ícono `wallet`). "En vivo" significa que si cambia la institución de la cuenta, el avalar derivado cambia con ella.
- **cash** → ícono `wallet` y color determinístico a partir del `id` de la cuenta (`hash(id) % tamaño_paleta`), de modo que distintas cuentas cash no salgan todas iguales. El color determinístico se computa al resolver; no se persiste.

`color_key` SHALL referenciar la paleta curada de cuentas (tokens `--account-*` en `@grana/ui-tokens`); `icon_key` SHALL referenciar el set curado de íconos. Ambas paletas SHALL excluir los colores semánticos (`emerald`=ingreso/positivo, `terracotta`/`error`=negativo). Cuando el ícono resuelto es ausente, el avatar SHALL mostrar el **monograma** (primera letra del `name`) sobre el color.

#### Scenario: Banco hereda el branding de su institución

- **WHEN** una cuenta `type='bank'` tiene `color_key=NULL` e `icon_key=NULL` y su institución tiene `brand_color` e `icon_type='bank'`
- **THEN** el avatar usa el color de la institución y el ícono `landmark`

#### Scenario: Banco con institución custom hereda su color e ícono

- **WHEN** una cuenta `type='bank'` con `color_key=NULL` e `icon_key=NULL` apunta a una institución custom del usuario con `brand_color='#3A7D44'` e `icon_type='wallet'`
- **THEN** el avatar usa color `#3A7D44` e ícono `wallet`

#### Scenario: Cambiar la institución actualiza el avatar heredado

- **WHEN** una cuenta `type='bank'` con `color_key=NULL` cambia su `institution_id` a otra institución con distinto `brand_color`
- **THEN** el avatar pasa a reflejar el branding de la nueva institución (herencia viva), sin tocar `color_key`

#### Scenario: Cambiar de institución del catálogo a una custom actualiza el avatar

- **WHEN** una cuenta `type='bank'` con `color_key=NULL` cambia su `institution_id` del catálogo a una custom del usuario
- **THEN** el avatar pasa a reflejar el branding de la custom, sin tocar `color_key`

#### Scenario: Override explícito queda fijo

- **WHEN** el usuario elige un `color_key` explícito para una cuenta bank y luego cambia la institución de la cuenta
- **THEN** el avatar conserva el color elegido por el usuario y no sigue al de la nueva institución

#### Scenario: Cuenta cash sin elección recibe color determinístico

- **WHEN** una cuenta `type='cash'` tiene `color_key=NULL`
- **THEN** el avatar usa el ícono `wallet` y un color de la paleta derivado de `hash(id)`, estable entre renders

#### Scenario: Fallback a monograma

- **WHEN** una cuenta resuelve un ícono ausente (sin `icon_key` y sin ícono derivable)
- **THEN** el avatar muestra la primera letra del `name` de la cuenta sobre el color

#### Scenario: La lista muestra el avatar de cada cuenta

- **WHEN** el usuario abre la lista de cuentas
- **THEN** cada fila muestra el avatar (color + ícono o monograma) de la cuenta junto a su nombre y saldos

#### Scenario: Key inválida es rechazada en validación

- **WHEN** el usuario envía un `color_key` o `icon_key` que no pertenece al registry curado
- **THEN** la action retorna error de validación y no persiste el valor

### Requirement: El header de `/accounts` se renderiza desde el primer paint y sus secciones cargan independientemente

El header de `/accounts` SHALL renderizarse desde el primer paint sin esperar al fetch del contenido del módulo. El cuerpo de la ruta — sección de cuentas activas (cash + bank) y sección de cuentas archivadas — SHALL renderizarse como **secciones aisladas**, cada una con su propio fallback de carga y de error, de modo que un fallo en una sección no tire la ruta ni esconda el header.

Esta receta SHALL seguir el patrón **Variant C** ("chrome en `<ruta>/layout.tsx` + skeletons en `<ruta>/loading.tsx`") definido en el spec `route-loading-and-errors`, alineado con cómo lo aplican `/dashboard`, `/transactions` y `/cards`.

**Web — estructura de archivos:**

- `apps/web/app/(app)/accounts/layout.tsx` (server component, sync) SHALL montar `<AccountsHeader />` y renderizar `{children}` debajo. El header persiste como chrome del segmento entre transiciones de `{children}` (loading, error, navegación a hijos como `/accounts/[id]`).
- `apps/web/app/(app)/accounts/loading.tsx` SHALL renderizar los skeletons shape-matched de las dos secciones (active accounts skeleton + archived accounts skeleton) en la misma disposición que el cuerpo de la ruta. Actúa como fallback del `{children}` del layout durante la transición de segmento.
- `apps/web/app/(app)/accounts/page.tsx` SHALL renderizar el scaffold de `<Suspense>` envuelto por el Client Component error boundary (`AccountsErrorBoundary`), SIN remontar el header (que vive en el layout). El page MAY seguir siendo async para `await getTranslations()` si las strings de los `<SectionFallback>` se resuelven server-side ahí, o MAY migrarlas a containers async dedicados para volverse sync; ambas opciones son válidas siempre que el header no se duplique.
- El page NO SHALL hacer `await supabase.auth.getUser()` ni `redirect('/login')`: el auth check ya lo cubre `(app)/layout.tsx`.

**Header — comportamiento (sin cambios respecto a la versión previa):**

El `<AccountsHeader />` SHALL ser un Client Component que ejecuta sus propias queries con el cliente browser de Supabase y SHALL exhibir un estado de carga mientras esas queries no resuelven:

- Título "Cuentas" (sin subtítulo derivado de queries — el header no espera ningún fetch para mostrar su texto principal).
- El botón "+ Crear cuenta" SHALL renderizarse en estado **disabled** mientras la query del catálogo de instituciones (`institutions`) no resuelva. SHALL aparecer con su tipografía e ícono completos pero sin abrir el drawer al click. Cuando esa query resuelve, SHALL pasar a habilitado y abrir el drawer de creación al click. Si esa query falla, el botón SHALL permanecer disabled para no abrir un drawer sin data.

**Cuerpo — scaffold de Suspense:**

El cuerpo de la ruta web SHALL renderizarse como un scaffold de **dos** `<Suspense>` boundaries (active, archived), cada uno con un fallback `<SectionFallback>` (compartido en `components/ui/`) con un mensaje de carga y un `min-h-[Xrem]` que reserva un slot vertical próximo al alto del contenido resuelto:

- **Active section** (container server async `ActiveAccountsContainer`): SHALL llamar `getCashAndBankAccounts()` (sin flag `archivedOnly`). El fallback de carga SHALL usar `min-h-[14rem]`.
- **Archived section** (container server async `ArchivedAccountsContainer`): SHALL llamar `getCashAndBankAccounts({ archivedOnly: true })` y flatten el resultado. El fallback de carga SHALL usar `min-h-[3rem]`.

Cada container web SHALL envolver su fetch en un `try/catch`. Si la query falla, el container SHALL devolver `<SectionFallback message={<mensaje de error de esa sección>} />` en vez de propagar el throw. Esto SHALL aislar errores entre secciones.

La ruta web SHALL incluir un Client Component error boundary (`AccountsErrorBoundary`) que envuelva el scaffold de Suspense como red de seguridad para cualquier throw que escape al `try/catch` de los containers. Cuando ese boundary captura, SHALL renderizar `<RouteError>` en el área del contenido **sin tapar el header** (que vive en el layout y queda fuera del boundary), con un `onRetry` que resetea el state del boundary.

**Active container — reglas de contenido.** Cuando `getCashAndBankAccounts()` resuelve:

- Si `cash.length + bank.length === 0`, el container SHALL renderizar `<EmptyAccountsState />` (mensaje "Todavía no tenés cuentas" + CTA secundario "+ Crear cuenta"). Este estado vacío NO depende del estado de la sección archivadas: SHALL mostrarse aún cuando la query de archivadas resuelva con filas. El CTA primario para crear vive siempre en el header, por lo que el CTA del empty es informativo, no la única salida.
- Si `cash.length + bank.length === 1`, el container SHALL renderizar primero el banner `<AccountsHint />` (one-shot dismissible) seguido de las secciones cash y bank.
- En todos los casos no-vacíos, el container SHALL renderizar las secciones cash y bank en ese orden, cada una con su propio título en caps + count y su contenedor de filas (per requirement existente "El usuario puede ver la lista de sus cuentas agrupadas por tipo").

**Archived container — reglas de contenido.** Cuando `getCashAndBankAccounts({ archivedOnly: true })` resuelve:

- Si el array de archivadas resuelve con cero filas, el container SHALL renderizar `null`. NO SHALL ocupar espacio visible (sin slot fantasma, sin separador, sin título de sección vacío).
- Si resuelve con uno o más, SHALL renderizar la sección de archivadas según las reglas visuales existentes (borde dashed, pill "Archivada", acción "Reactivar" en text-positive).

Un error en una sección NO SHALL afectar el render de la otra ni del header.

#### Scenario: El header se ve antes de que resuelvan las queries del módulo (web)

- **WHEN** un usuario web navega a `/accounts` y la query de `institutions` del header todavía no resolvió
- **AND** las queries de cuentas activas y archivadas todavía no resolvieron
- **THEN** el header ya está montado con el título "Cuentas"
- **AND** el botón "+ Crear cuenta" está visible pero disabled
- **AND** el cuerpo del módulo muestra los `<SectionFallback>` (durante el render del page) o los skeletons shape-matched (durante la transición de segmento, cuando `accounts/loading.tsx` cubre el área del contenido)

#### Scenario: El header persiste durante navegación entre rutas hermanas del shell (web)

- **WHEN** un usuario está en `/dashboard` y navega a `/accounts`
- **THEN** durante la transición del segmento, el `<AccountsHeader />` aparece desde el primer paint del nuevo segmento (proviene de `accounts/layout.tsx`)
- **AND** el área del contenido muestra los skeletons shape-matched de `accounts/loading.tsx` mientras el `page.tsx` resuelve
- **AND** el header NO se reemplaza por un spinner full-screen del layout group `(app)` en ningún momento

#### Scenario: Resolver la query de instituciones habilita el botón del header (web)

- **WHEN** la query de `institutions` resuelve con datos
- **THEN** el botón "+ Crear cuenta" pasa a habilitado y abre el drawer al click

#### Scenario: Fallo de la query de instituciones deja el botón disabled (web)

- **WHEN** la query de `institutions` falla
- **THEN** el botón "+ Crear cuenta" permanece disabled indefinidamente
- **AND** el resto del header (título) sigue visible
- **AND** las secciones del cuerpo siguen renderizándose normalmente con su propia data

#### Scenario: Cada sección muestra su propio fallback de carga mientras la otra ya cargó (web)

- **WHEN** la sección de cuentas activas ya resolvió pero la query de archivadas aún no
- **THEN** las cuentas activas se muestran agrupadas por tipo
- **AND** el área de archivadas sigue mostrando su `<SectionFallback>` con mensaje de carga

#### Scenario: Un error en la sección activa no tira la ruta ni esconde el header (web)

- **WHEN** la query de `getCashAndBankAccounts()` falla en web
- **THEN** el área de la sección activa muestra `<SectionFallback>` con un mensaje de error
- **AND** el header permanece visible y completamente funcional (con el botón habilitado si `institutions` resolvió)
- **AND** la sección de archivadas sigue renderizándose normalmente con su propia data
- **AND** el `error.tsx` del layout group `(app)` NO se monta

#### Scenario: Un error en la sección archivadas no tira la ruta ni esconde el header (web)

- **WHEN** la query de `getCashAndBankAccounts({ archivedOnly: true })` falla en web
- **THEN** el área de la sección archivadas muestra `<SectionFallback>` con un mensaje de error
- **AND** el header permanece visible
- **AND** la sección de cuentas activas sigue renderizándose normalmente

#### Scenario: Un throw fuera de los containers es capturado por el error boundary in-page (web)

- **WHEN** un throw ocurre durante el render del page (no del layout) fuera de los `try/catch` de los containers
- **THEN** el `AccountsErrorBoundary` captura el throw
- **AND** el área del contenido se reemplaza por `<RouteError>` con su botón "Reintentar"
- **AND** el header de la ruta (que vive en el layout) sigue visible
- **AND** presionar "Reintentar" resetea el state del boundary y vuelve a intentar el render del page

#### Scenario: La sección de archivadas no ocupa espacio cuando el usuario no tiene archivadas (web)

- **WHEN** la query de cuentas archivadas resuelve con cero filas
- **THEN** el `ArchivedAccountsContainer` renderiza `null`
- **AND** el `<SectionFallback>` de archivadas deja de mostrarse al resolver la query (no queda un slot vacío visible, no hay título de sección sin contenido)

#### Scenario: `EmptyAccountsState` se muestra cuando no hay cuentas activas, aún con archivadas presentes (web)

- **WHEN** la query de cuentas activas resuelve con `cash.length + bank.length === 0`
- **AND** la query de cuentas archivadas resuelve con una o más filas
- **THEN** el área de la sección activa muestra `<EmptyAccountsState />` (mensaje "Todavía no tenés cuentas" + CTA secundario)
- **AND** debajo se renderiza la sección de archivadas con sus filas

---

### Requirement: El estilo visual de `/accounts` (raíz) sigue el handoff `docs/design/accounts/` y respeta sus no-goals

El sistema SHALL renderizar la ruta `/accounts` (raíz, sin segmentos hijos) siguiendo el handoff visual versionado en `docs/design/accounts/`. El handoff es **referencia normativa de jerarquía y composición**, no de pixel-perfect: la implementación SHALL usar los tokens, primitivos y componentes existentes del codebase, no copiar valores literales del mock HTML.

El rediseño SHALL operar **solamente** sobre los componentes y datos que la ruta ya expone hoy. Los componentes habilitados son:

- `AccountsHeader` (en `apps/web/app/(app)/accounts/_components/`, montado desde `accounts/layout.tsx`).
- `CreateAccountButton` (acción primaria del header).
- `ActiveAccountsContainer` y `ArchivedAccountsContainer` (containers server async).
- `AccountsHint` (banner condicional de primer uso, client-only, descartable por `localStorage`).
- `AccountSection` (sección con título caps + count + lista de filas).
- `AccountRow` (fila de cuenta con avatar, identidad, balances ARS/USD, kebab).
- `AccountRowMenu` (menú kebab por fila — ver requirement existente "El usuario puede ver la lista de sus cuentas agrupadas por tipo" para items y matriz).
- `EmptyAccountsState` (estado vacío con CTA secundario).
- `ActiveAccountsSkeleton` y `ArchivedAccountsSkeleton` (skeletons shape-matched para `loading.tsx`).
- `AccountsErrorBoundary`, `RouteError`, `SectionFallback` (chrome de error — ver requirement existente "El header de /accounts se renderiza desde el primer paint…").

Los datos habilitados son **exactamente** los que ya devuelven `getCashAndBankAccounts()` y `getInstitutions()`: nombre, tipo, institución opcional, monedas activas, balances ARS y USD por cuenta, `is_active`, `has_transactions`, avatar resuelto, y el catálogo de instituciones para el drawer. El rediseño NO SHALL agregar campos a `AccountWithBalances` ni queries nuevas.

**Reglas de jerarquía visual en `AccountRow`.** Cada fila SHALL renderizar, en este orden de izquierda a derecha:

1. Avatar (`AccountAvatar`) resuelto según el requirement existente "Cada cuenta tiene un avatar visual".
2. Bloque de identidad apilado en columna: (a) nombre de la cuenta como primera línea; (b) badge `Archivada` en su propia línea inmediatamente debajo del nombre cuando `is_active === false`; (c) institución del banco como tercera línea opcional (solo si `account.type === 'bank' && account.institution`). El badge SHALL NO renderizarse inline en la línea del nombre — esto evita que el badge compita con un nombre largo y se desborde del slot.
3. Bloque de balances de las monedas activas: ARS primario (semibold, `text-text`); USD subordinado (menor jerarquía, `text-text-soft`). Una fila con `is_active=false` o sin actividad en una moneda SHALL seguir mostrando ambas monedas si están activas en la cuenta, con sus valores reales (incluyendo `$ 0,00`).
4. Trigger kebab (`AccountRowMenu`) en el extremo derecho.

ARS SHALL renderizarse siempre antes que USD cuando ambas monedas están activas. ARS y USD NO SHALL sumarse, mezclarse ni convertirse. Si la cuenta tiene una sola moneda activa, SHALL renderizarse esa única línea.

**Layout responsive bajo viewports angostos.** Bajo `< sm` (Tailwind `sm`, 640px), el contenido interno del `<Link>` de la fila — bloque de identidad + bloque de balances — SHALL apilarse en columna y SHALL ocupar el ancho horizontal disponible (los hijos del `<Link>` no forzan `items-start` en cross-axis; por default toman el ancho del contenedor vía `align-items: stretch`). Esto evita que un nombre largo o el badge `Archivada` compitan con montos largos como `$ 1.840.300,50` cuando el ancho disponible no alcanza para layout horizontal. Avatar y kebab SHALL mantenerse a los costados de la fila (avatar a la izquierda del bloque apilado, kebab a la derecha). A partir de `sm` y hacia arriba, la fila SHALL volver a su layout horizontal con balances alineados a la derecha.

**Wrapping del nombre y del subtítulo de institución.** En `< sm`, el nombre de la cuenta y el subtítulo de institución SHALL permitir wrapping a múltiples líneas (`break-words`) en vez de truncarse con elipsis. Un nombre largo se continúa en una nueva línea debajo, sin desbordarse sobre el slot del kebab. En `≥ sm`, ambas líneas SHALL volver a `truncate` (one-liner con elipsis) para preservar la compactez horizontal del layout desktop.

**Acciones del header y del empty state.** El botón "+ Crear cuenta" del header (`CreateAccountButton`) SHALL seguir usando el primitivo `Button` (`@/components/ui/button.tsx`); el CTA del `EmptyAccountsState` SHALL seguir siendo `<Button asChild><Link href="/accounts/new">…</Link></Button>`. NO SHALL re-tipearse `bg-primary` / `bg-emerald` ni paddings ad-hoc sobre `<button>` o `<Link>` desnudos.

**Web y mobile son implementaciones nativas en paralelo.** El handoff incluye `docs/design/accounts/web/accounts.html` y `docs/design/accounts/mobile/accounts.html`. El requirement aplica a **web** en este change. La paridad mobile SHALL implementarse como una vista nativa RN equivalente en un change futuro, con la misma estructura (header → hint condicional → sección cash → sección bank → sección archivada opcional → estados de carga y error), JSX **no** compartido, y los mismos no-goals.

**No-goals (vinculantes).** El rediseño NO SHALL:

- Agregar totales globales por moneda al pie de sección, al header o como tarjeta separada.
- Agregar resumen / overview / hero card por encima de las secciones.
- Agregar búsqueda, toolbar de filtros, chips de filtros activos, ni control de ordenamiento. El orden permanece el que devuelve la query (`created_at` ascendente por grupo).
- Agregar métricas derivadas (e.g. "cuántas cuentas activas en USD") más allá del contador `· N` que ya muestra `AccountSection`.
- Agregar acciones de cuenta nuevas (la matriz `(is_active, has_transactions)` y los items del menú quedan definidos en el requirement existente del listado).
- Agregar nuevos campos a `AccountWithBalances`, nuevas queries en `lib/accounts/`, ni nuevas server actions.

Cualquier propuesta que viole un no-goal SHALL abrir un change OpenSpec nuevo y modificar este requirement antes de implementarse.

#### Scenario: La ruta sigue el handoff de docs/design/accounts/

- **WHEN** un desarrollador implementa el rediseño visual de `/accounts`
- **THEN** la composición sigue la estructura del handoff: header con título + acción primaria, hint condicional, sección cash con su título caps + count, sección bank con su título caps + count, sección archivada opcional con borde dashed
- **AND** la implementación usa los componentes ya enumerados en el requirement, no JSX inline ni componentes nuevos creados ad-hoc
- **AND** los valores visuales se derivan de tokens en `@grana/ui-tokens` y primitivos en `apps/web/components/ui/`, no de hex literales copiados del mock

#### Scenario: La fila de cuenta respeta ARS primaria y USD secundaria

- **WHEN** una cuenta tiene ARS y USD activas
- **THEN** la fila muestra el balance ARS primero con jerarquía mayor (semibold `text-text`) y el balance USD debajo con jerarquía menor (`text-text-soft`)
- **AND** los valores SHALL NOT sumarse ni convertirse
- **AND** si una cuenta tiene solo ARS activa, la fila muestra solo la línea ARS; si tiene solo USD activa, muestra solo la línea USD

#### Scenario: La fila se apila bajo viewports angostos

- **WHEN** el viewport es `< sm` (640px) y una fila contiene un nombre largo (e.g. "Caja de ahorro Galicia sueldo y gastos del hogar") o un badge `Archivada` además del nombre
- **THEN** el contenido interno del `<Link>` (identidad + balances) se apila en columna ocupando el ancho horizontal disponible
- **AND** los balances ARS/USD aparecen debajo de la identidad en lugar de a la derecha
- **AND** el avatar y el kebab siguen a los costados (avatar a la izquierda del bloque apilado, kebab a la derecha) y SHALL alinearse al **inicio vertical** de la fila (la fila usa `items-start` bajo `< sm`), de modo que el avatar quede a la altura del nombre y el kebab a la altura del primer renglón, en vez de flotar al centro vertical de la fila apilada
- **AND** la regla bimoneda se respeta dentro del bloque de balances (ARS arriba, USD abajo)

#### Scenario: Un nombre largo wrappea a una segunda línea en `< sm` y no se desborda sobre el kebab

- **WHEN** el viewport es `< sm` y el nombre de la cuenta excede el ancho disponible entre avatar y kebab (e.g. "Caja de ahorro Galicia sueldo y gastos del hogar")
- **THEN** el nombre se continúa en una nueva línea debajo de la primera, sin truncarse
- **AND** el texto NO SHALL desbordarse sobre el slot del kebab ni cubrirlo visualmente
- **AND** si la cuenta es bank, el subtítulo de institución SHALL aplicar la misma regla (wrappea en lugar de truncar bajo `< sm`)

#### Scenario: Bajo `≥ sm` el nombre y el subtítulo vuelven a truncarse con elipsis

- **WHEN** el viewport es `≥ sm` y el nombre de la cuenta o el subtítulo de institución excede el ancho disponible
- **THEN** el texto se trunca con elipsis (`truncate`) y queda en una sola línea
- **AND** el layout horizontal compacto del desktop se preserva

#### Scenario: A partir de `sm` la fila vuelve al layout horizontal

- **WHEN** el viewport es `≥ sm` (640px o más)
- **THEN** identidad y balances se renderizan en la misma línea horizontal con los balances alineados a la derecha
- **AND** la fila usa `items-center` (avatar y kebab vuelven a centrarse verticalmente respecto a la fila)
- **AND** la regla bimoneda se respeta dentro del bloque de balances (ARS arriba, USD abajo)

#### Scenario: El badge "Archivada" se renderiza en su propia línea debajo del nombre

- **WHEN** se renderiza una fila de cuenta con `is_active=false` (típicamente en la sección Archivadas)
- **THEN** el badge `Archivada` aparece en una línea separada inmediatamente debajo del nombre y, si hay institución, por encima del subtítulo de institución
- **AND** el badge usa la paleta `bg-warning-soft text-warning` con la copy `accounts.badges.archived`
- **AND** el badge tiene ancho intrínseco (no se estira al ancho del bloque) y no se desborda del slot, aún con nombres largos
- **AND** la sección que la contiene tiene `border-dashed` (per requirement existente del listado)

#### Scenario: El hint de primer uso aparece solo con una cuenta activa y no descartado

- **WHEN** el usuario tiene exactamente una cuenta activa (`cash.length + bank.length === 1`) y no descartó el hint en `localStorage`
- **THEN** `AccountsHint` se renderiza por encima de las secciones, dentro del bloque de cuentas activas
- **AND** el botón de descarte deja el hint dismissed para futuras visitas a la ruta
- **AND** si el usuario tiene 0 o ≥2 cuentas activas, el hint NO se renderiza independientemente del valor de `localStorage`

#### Scenario: La sección Archivadas se omite cuando no hay archivadas

- **WHEN** la query `getCashAndBankAccounts({ archivedOnly: true })` resuelve con cero filas
- **THEN** `ArchivedAccountsContainer` retorna `null` y no se renderiza título de sección, lista, ni separador visual fantasma
- **AND** el contenido visible queda compuesto solo por header + (hint condicional) + sección cash + sección bank

#### Scenario: Abrir el kebab de una fila no reflowa el header de la ruta

- **WHEN** el usuario abre el `DropdownMenu` del kebab de una fila
- **THEN** el `PageHeader` de `/accounts` no cambia su layout (la acción "+ Crear cuenta" sigue en la misma línea que el título "Cuentas", no salta a una línea debajo)
- **AND** la ruta no introduce un horizontal scrollbar transitorio mientras el menú está abierto
- **AND** el menú se anchora al trigger sin alterar el ancho disponible del cuerpo (el primitivo `DropdownMenu` evita el `react-remove-scroll` de Radix vía `modal={false}` para este caso)

#### Scenario: Estados de carga y error usan los componentes existentes

- **WHEN** una de las secciones está cargando o falla
- **THEN** el área de la sección activa muestra `ActiveAccountsSkeleton` o `SectionFallback` según el momento
- **AND** el área de la sección archivada muestra `ArchivedAccountsSkeleton` o `SectionFallback` según el momento
- **AND** un throw fuera de los `try/catch` de los containers es capturado por `AccountsErrorBoundary` y reemplaza el área del contenido por `RouteError`, sin tapar el header
- **AND** ningún estado de carga o error introduce datos, queries ni componentes nuevos

#### Scenario: Las acciones tipo CTA usan el primitivo Button

- **WHEN** se renderizan las dos acciones tipo CTA de la ruta — "+ Crear cuenta" en el header y "+ Crear cuenta" del `EmptyAccountsState`
- **THEN** ambas componen el primitivo `Button` (directamente o vía `asChild` con `<Link>`)
- **AND** no se aplican clases `bg-primary` / `bg-emerald` / paddings ad-hoc inline sobre `<button>` o `<Link>` desnudos

#### Scenario: El rediseño NO agrega totales por moneda

- **WHEN** se revisa la ruta implementada bajo este requirement
- **THEN** no existe ningún elemento visual que sume balances ARS de varias cuentas, ni balances USD de varias cuentas
- **AND** no existe una card de "Total cash + bank" ni un strip de totales al pie de sección
- **AND** el único conteo numérico de sección es el `· N` (cantidad de filas) ya emitido por `AccountSection`

#### Scenario: El rediseño NO agrega búsqueda, filtros ni ordenamiento

- **WHEN** se revisa la ruta implementada bajo este requirement
- **THEN** no aparece un input de búsqueda en el header ni en las secciones
- **AND** no aparecen toolbars de filtros, chips de filtros activos, ni controles de ordenamiento
- **AND** el orden de las cuentas dentro de cada grupo sigue siendo el que devuelve la query (`created_at` ascendente)

#### Scenario: El rediseño NO agrega acciones de cuenta nuevas

- **WHEN** se abre el kebab de una fila
- **THEN** los items del menú son los definidos en el requirement existente "El usuario puede ver la lista de sus cuentas agrupadas por tipo" según la matriz `(is_active, has_transactions)`
- **AND** no aparecen items nuevos como "Compartir", "Duplicar", "Exportar" ni similares
- **AND** no aparecen acciones primarias por fila fuera del kebab

#### Scenario: El rediseño NO introduce datos ni queries nuevos

- **WHEN** se inspecciona la implementación de la ruta tras este change
- **THEN** las queries usadas son exclusivamente `getCashAndBankAccounts()` (sin flags) en active y `getCashAndBankAccounts({ archivedOnly: true })` en archived, más `getInstitutions()` para el drawer
- **AND** el tipo `AccountWithBalances` NO incluye campos nuevos respecto al estado pre-change
- **AND** NO se agregan server actions ni endpoints nuevos en `lib/accounts/`

#### Scenario: Web y mobile son implementaciones nativas en paralelo

- **WHEN** se implementa el rediseño web bajo este change
- **THEN** la implementación vive en `apps/web/app/(app)/accounts/_components/` con JSX HTML/Next
- **AND** NO se introduce un módulo compartido de JSX entre `apps/web` y `apps/mobile`
- **AND** el handoff `docs/design/accounts/mobile/accounts.html` queda disponible como referencia para una implementación RN equivalente en un change futuro, que SHALL respetar los mismos componentes, datos y no-goals

### Requirement: El drawer de alta de cuenta se abre automáticamente desde un query param

Para que la creación de cuenta siempre se presente en el drawer (consistente con el resto de la app) incluso cuando se llega desde fuera de la lista de cuentas —como el cierre del onboarding—, el sistema SHALL abrir el drawer de "Crear cuenta" cuando se visita `/accounts` con el query param `nuevaCuenta=1`. La apertura SHALL ocurrir una sola vez por navegación y el query param SHALL limpiarse de la URL al abrir, para no re-disparar en refresh o navegación hacia atrás.

Como el formulario de alta necesita la lista de instituciones (que carga de forma asíncrona), la apertura automática SHALL esperar a que las instituciones estén disponibles antes de abrir el drawer; mientras tanto el param SHALL conservarse.

#### Scenario: Visitar la lista de cuentas con ?nuevaCuenta=1 abre el drawer de creación

- **WHEN** un usuario autenticado navega a `/accounts?nuevaCuenta=1`
- **THEN** una vez cargadas las instituciones, el drawer de "Crear cuenta" se abre
- **AND** el query param `nuevaCuenta` se elimina de la URL (queda `/accounts`)

#### Scenario: Cerrar el drawer abierto por query param no lo reabre

- **WHEN** el drawer se abrió por `?nuevaCuenta=1` y el usuario lo cierra
- **THEN** el drawer permanece cerrado
- **AND** el drawer NO se reabre por la presencia del param (ya fue limpiado de la URL)

### Requirement: El módulo de cuentas en mobile se pushea desde Menú (mobile)

La app nativa SHALL exponer el módulo de cuentas como un stack de Expo Router (`app/(app)/accounts/`) pusheado desde Menú, NO como una tab nueva — las tabs nativas (Inicio / Movimientos / Hogar / Menú) están fijas. La navegación de entrada SHALL ser `router.push('/accounts')` (ya emitida por la card de cuentas del dashboard). El stack SHALL usar `Stack { headerShown:false }`; cada pantalla SHALL renderizar su propio `PageHeader` sobre `SafeAreaView edges={['top']}`, nunca el header nativo del stack.

El chrome de cada pantalla (back-link y slots de acción del `PageHeader`) SHALL ser visible desde el primer paint; los botones que dependen de data (p. ej. "Crear" mientras cargan instituciones) SHALL renderizarse disabled hasta que la data esté disponible, sin taparse con un skeleton de header.

#### Scenario: Cuentas se abre desde Menú, no como tab (mobile)

- **WHEN** el usuario toca Cuentas en el Menú (o la card de cuentas del dashboard)
- **THEN** la app pushea el stack `accounts/` y muestra la lista con un `PageHeader` propio y back-link
- **AND** las tabs fijas (Inicio / Movimientos / Hogar / Menú) no cambian

#### Scenario: El chrome del header se ve desde el primer paint (mobile)

- **WHEN** una pantalla de cuentas monta y sus queries aún no resolvieron
- **THEN** el `PageHeader` (título, back-link, slots de acción) ya es visible
- **AND** el botón "Crear" está disabled hasta que resuelve la query de instituciones

### Requirement: La lista de cuentas en mobile agrupa activas y archivadas con acciones por fila (mobile)

La pantalla `accounts/index` SHALL listar las cuentas cash/bank del usuario agrupadas en Efectivo y Cuentas bancarias (activas), más una sección Archivadas que SHALL renderizarse solo si existen archivadas. Cada fila SHALL mostrar el avatar resuelto, el nombre (con institución cuando exista), y los saldos ARS/USD. Los datos SHALL salir de `getCashAndBankAccounts` de `@grana/accounts` vía un hook TanStack con query key propio de mobile. Con cero cuentas activas SHALL mostrarse un empty state.

Las acciones por fila SHALL presentarse vía el patrón de action sheet nativo del repo (`Popover` bottom-sheet + `Alert.alert` para confirmaciones destructivas), NO una lib de action sheet nueva: Editar, Archivar/Eliminar (según `is_active` y `has_transactions`) y Reactivar. La elección archivar-vs-eliminar SHALL respetar el guard del paquete (una cuenta con movimientos se archiva, no se elimina).

#### Scenario: La lista agrupa y muestra saldos (mobile)

- **WHEN** el usuario abre Cuentas con cuentas de efectivo y bancarias activas
- **THEN** la lista muestra las secciones Efectivo y Cuentas bancarias, cada fila con avatar, nombre/institución y saldos ARS/USD
- **AND** la sección Archivadas aparece solo si el usuario tiene cuentas archivadas

#### Scenario: Las acciones de fila usan el action sheet nativo (mobile)

- **WHEN** el usuario toca el menú de acciones de una fila
- **THEN** se abre un `Popover` bottom-sheet con Editar / Archivar (o Reactivar) / Eliminar según el estado de la cuenta
- **AND** Eliminar y Archivar piden confirmación vía `Alert.alert` antes de ejecutar

### Requirement: El detalle de cuenta en mobile muestra saldos, movimientos y reintegros (mobile)

La pantalla `accounts/[id]/index` SHALL mostrar un hero con la identidad de la cuenta (avatar, nombre, institución/tipo, badge Archivada si aplica) y los saldos ARS/USD totales, obtenidos de `getAccountDetail` de `@grana/accounts`. SHALL mostrar la lista de movimientos de la cuenta usando `getAccountMovementsAscending` de `@grana/transactions`. La presentación SHALL replicar la del web app dentro de los breakpoints mobile: cada fila muestra fecha/descripción + monto con tono, SIN columna de saldo corriente por fila (en web esa columna es `hidden md:block`; el saldo total vive en el hero). El signo/monto por fila desde la perspectiva de la cuenta SHALL derivarse de `resolveMovementView` de `@grana/money-logic`, sin reimplementar la lógica de patas (transferencias/cambios) en mobile. SHALL mostrar la card de reintegros pendientes ("A confirmar") usando `getPendingReimbursements` de `@grana/transactions` scopeado a la cuenta. SHALL ofrecer un acceso a agregar moneda cuando haya monedas disponibles.

#### Scenario: El detalle muestra saldos y movimientos (mobile)

- **WHEN** el usuario abre el detalle de una cuenta con movimientos
- **THEN** el hero muestra los saldos ARS/USD y la pantalla lista los movimientos de la cuenta
- **AND** la card "A confirmar" lista los reintegros pendientes de esa cuenta si existen

#### Scenario: La presentación de movimientos replica el web app en mobile (mobile)

- **WHEN** la pantalla renderiza la lista de movimientos
- **THEN** cada fila muestra fecha/descripción + monto con tono, sin saldo corriente por fila (paridad con el web app en breakpoints mobile, donde esa columna está oculta)
- **AND** el signo/monto por fila desde la perspectiva de la cuenta se deriva de `resolveMovementView` de `@grana/money-logic`, sin reimplementar la lógica en mobile

### Requirement: El detalle de cuenta en mobile filtra los movimientos con un toolbar (mobile)

La lista de movimientos del detalle SHALL ofrecer un toolbar con paridad funcional al del web app: navegación por mes (anterior/siguiente con label de mes), búsqueda de texto libre, un acceso a recurrencias, y una hoja de filtros (tipo, categoría, subcategoría, moneda, monto mín/máx) con chips de filtro activos removibles. El rango del mes SHALL calcularse con `resolveMonthRange` de `@grana/dashboard`; el filtrado y el match de búsqueda SHALL ser un paso nativo puro sobre `TransactionWithDetails` (análogo de `applyAccountFilters`/`movementMatchesText` del web, que son web-only sobre otro modelo). Las opciones de categoría/subcategoría SHALL derivarse de los movimientos de la cuenta. El acceso a recurrencias SHALL navegar a una ruta nativa dedicada; mientras el módulo de recurrencias mobile no exista, esa ruta SHALL ser un placeholder vacío (sin construir la funcionalidad todavía).

#### Scenario: Navegar meses y filtrar movimientos (mobile)

- **WHEN** el usuario cambia el mes o aplica filtros (tipo/categoría/moneda/monto) o escribe en la búsqueda
- **THEN** la lista de movimientos se filtra en cliente sobre el historial de la cuenta usando el rango del mes (`resolveMonthRange`) y el resto de los filtros
- **AND** los filtros activos aparecen como chips removibles y el botón de filtros muestra el conteo activo

#### Scenario: El acceso a recurrencias navega a un placeholder (mobile)

- **WHEN** el usuario toca "Ver recurrencias" en el toolbar de movimientos
- **THEN** la app navega a una ruta nativa dedicada de recurrencias
- **AND** esa ruta es un placeholder vacío (el módulo de recurrencias mobile se construye en una change posterior)

### Requirement: Crear, editar y gestionar monedas de una cuenta en mobile (mobile)

La app nativa SHALL permitir crear una cuenta (`accounts/new`), editar nombre e institución (`accounts/[id]/edit`, con saldos iniciales en modo locked) y agregar/desactivar monedas (`accounts/[id]/currency`), cada uno como pantalla pusheada en el stack con `PageHeader` + back-link (el equivalente nativo de los drawers web). El selector de institución SHALL permitir buscar instituciones y crear una institución custom inline (nombre + color). Los montos SHALL capturarse con el primitivo `MoneyAmountInput`. Las operaciones SHALL ejecutarse vía un mutator mobile (`lib/accounts/mutations.ts`) que llama directamente a las mutations de `@grana/accounts` — sin server actions en mobile.

#### Scenario: Crear una cuenta bancaria con institución custom (mobile)

- **WHEN** el usuario crea una cuenta bancaria y la institución no está en el catálogo
- **THEN** desde el selector crea una institución custom (nombre + color) inline y la asigna a la cuenta
- **AND** ingresa los saldos iniciales con `MoneyAmountInput` y al guardar navega al detalle de la cuenta creada

#### Scenario: Editar deja los saldos iniciales locked (mobile)

- **WHEN** el usuario edita una cuenta existente
- **THEN** puede cambiar nombre e institución pero los saldos iniciales se muestran locked (no editables)

#### Scenario: Los guards de moneda se respetan con mensaje traducido (mobile)

- **WHEN** el usuario intenta desactivar la última moneda activa o una moneda con saldo distinto de cero
- **THEN** la operación se rechaza y la pantalla muestra el mensaje correspondiente resuelto por `useT`

### Requirement: El mutator de cuentas en mobile traduce el contrato de error neutro con `useT` (mobile)

Las mutations de cuentas en mobile SHALL ejecutarse por un mutator (`apps/mobile/lib/accounts/mutations.ts`) que resuelve el `userId` (`supabase.auth.getUser()`), inyecta `today` (`getTodayAR()` de `@grana/money-logic`) y el client nativo, invoca la mutation de `@grana/accounts` y mapea el `AccountMutationResult` neutro a un resultado nativo `{ ok } | { ok:false, errorKey, fieldErrors }`. El `messageKey` del paquete SHALL resolverse con `useT` en la pantalla; el `errorCode` PG SHALL mapearse a la misma key que usa web (`23505 → accounts.errors.duplicate`, fallback `accounts.errors.generic`); el `reason` estructurado SHALL preservarse para ramificar UX. En éxito, el mutator SHALL invalidar los query keys de cuentas correspondientes. El mutator NO SHALL depender de `apps/web` ni de server actions.

#### Scenario: Un error de dominio se muestra traducido por useT (mobile)

- **WHEN** una mutation de cuenta falla devolviendo `messageKey` o `errorCode`
- **THEN** el mutator lo mapea a un `errorKey` y la pantalla lo muestra resuelto por `useT` en el locale activo
- **AND** no se muestra un literal en español hardcodeado ni un `error.message` crudo

#### Scenario: Una mutación exitosa invalida la cache nativa (mobile)

- **WHEN** el usuario crea, edita, archiva, reactiva o elimina una cuenta, o agrega/desactiva una moneda
- **THEN** el mutator invalida los query keys de cuentas afectados (lista, detalle, instituciones)
- **AND** las pantallas montadas refetchean la data actualizada

