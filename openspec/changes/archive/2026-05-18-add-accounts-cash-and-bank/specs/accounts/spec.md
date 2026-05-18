## ADDED Requirements

### Requirement: Tipos de cuenta soportados

El sistema SHALL soportar dos tipos de cuenta en este alcance: `cash` (efectivo) y `bank` (bancaria/débito). El enum `account_type` en DB SHALL contener exactamente estos dos valores. Otros tipos del dominio (`credit`, `investment`) NO se aceptan en este módulo y se agregarán en changes posteriores mediante `ALTER TYPE`.

Una cuenta de tipo `cash` SHALL tener `institution_id IS NULL`. Una cuenta de tipo `bank` SHALL tener `institution_id NOT NULL` referenciando una fila activa del catálogo `institutions`.

#### Scenario: Crear cuenta cash sin institución

- **WHEN** un usuario autenticado envía la creación de una cuenta con `type='cash'` sin `institution_id`
- **THEN** la cuenta se crea con `institution_id = NULL`
- **AND** la operación retorna éxito

#### Scenario: Crear cuenta cash con institución es rechazado

- **WHEN** un usuario envía la creación de una cuenta con `type='cash'` e `institution_id` no nulo
- **THEN** la operación es rechazada con un error de validación que indica que efectivo no acepta institución

#### Scenario: Crear cuenta bank sin institución es rechazado

- **WHEN** un usuario envía la creación de una cuenta con `type='bank'` sin `institution_id`
- **THEN** la operación es rechazada con un error de validación que indica que la institución es obligatoria para bancarias

#### Scenario: Crear cuenta bank con institución inactiva es rechazado

- **WHEN** un usuario envía la creación de una cuenta con `type='bank'` apuntando a una `institutions.id` cuya `is_active = false`
- **THEN** la operación es rechazada con un error que indica que la institución no está disponible

#### Scenario: Tipo de cuenta no soportado es rechazado por DB

- **WHEN** un cliente intenta insertar una cuenta con `type='credit'` u otro valor no listado en el enum
- **THEN** la operación es rechazada por el enum constraint de Postgres

---

### Requirement: Multi-divisa por cuenta vía `account_currencies`

Cada cuenta SHALL poder operar en una o más monedas. La relación entre cuenta y monedas habilitadas SHALL modelarse en la tabla `account_currencies(id, account_id, currency_code, initial_balance, initial_balance_date, is_active, created_at)`, con UNIQUE constraint sobre `(account_id, currency_code)`.

En este módulo, los valores admitidos de `account_currencies.currency_code` SHALL estar restringidos a `'ARS'` y `'USD'`. Cualquier otro código de moneda, aún si está presente y activo en el catálogo `currencies`, es rechazado por un check constraint dedicado.

Una cuenta SHALL tener al menos una fila activa en `account_currencies` en todo momento.

#### Scenario: Cuenta con ARS solamente

- **WHEN** un usuario crea una cuenta con `type='bank'` y elige solo ARS
- **THEN** la cuenta se crea con una sola fila en `account_currencies` con `currency_code='ARS'` e `is_active = true`

#### Scenario: Cuenta con ARS y USD

- **WHEN** un usuario crea una cuenta y elige ARS y USD
- **THEN** la cuenta se crea con dos filas en `account_currencies`, una por cada moneda, ambas con `is_active = true`

#### Scenario: Cuenta sin monedas es rechazada

- **WHEN** un usuario envía la creación de una cuenta sin ninguna moneda seleccionada
- **THEN** la operación es rechazada con un error que indica que se requiere al menos una moneda

#### Scenario: Cuenta con moneda no soportada en v1 es rechazada

- **WHEN** un cliente intenta insertar una fila en `account_currencies` con `currency_code='EUR'`
- **THEN** la operación es rechazada por el check constraint de monedas soportadas
- **AND** el mensaje indica que solo ARS y USD están habilitadas en este alcance

#### Scenario: Misma moneda duplicada en la misma cuenta es rechazada

- **WHEN** un cliente intenta insertar una segunda fila `account_currencies` con `currency_code='ARS'` para una cuenta que ya tiene ARS habilitado
- **THEN** la operación es rechazada por el UNIQUE constraint `(account_id, currency_code)`

---

### Requirement: Saldo inicial por moneda inmutable

Cada fila de `account_currencies` SHALL tener `initial_balance NUMERIC(18,2) NOT NULL DEFAULT 0` y `initial_balance_date DATE`. Ambos campos SHALL ser inmutables post-creación. El cliente SHALL setear `initial_balance_date = getTodayAR()` al crear cada fila.

El sistema NO SHALL exponer ninguna acción de "editar saldo inicial". Correcciones posteriores deben hacerse como transacciones `adjustment` cuando el módulo `transactions` exista.

El `initial_balance` SHALL ser ≥ 0.

#### Scenario: Saldo inicial positivo se persiste tal cual

- **WHEN** un usuario crea una cuenta con ARS y carga saldo inicial 12345.67
- **THEN** la fila correspondiente en `account_currencies` queda con `initial_balance = 12345.67` y `initial_balance_date = getTodayAR()`

#### Scenario: Saldo inicial cero por defecto

- **WHEN** un usuario crea una cuenta con USD habilitado pero sin cargar saldo inicial
- **THEN** la fila se crea con `initial_balance = 0` y `initial_balance_date = getTodayAR()`

#### Scenario: Saldo inicial negativo es rechazado

- **WHEN** un usuario envía un `initial_balance` < 0
- **THEN** la operación es rechazada con un error de validación

#### Scenario: Intento de editar saldo inicial es rechazado

- **WHEN** un cliente intenta hacer UPDATE de `initial_balance` en una fila existente
- **THEN** la operación es rechazada por la action (no hay endpoint expuesto)
- **AND** la regla aplica también si el cliente arma la query directamente: la action de update no acepta el campo

---

### Requirement: Cuenta Efectivo default creada al registrar usuario

El sistema SHALL crear automáticamente una cuenta `Efectivo` para cada usuario nuevo en el momento exacto del INSERT en `auth.users`. La creación SHALL ocurrir vía trigger DB en `SECURITY DEFINER` para garantizar atomicidad con la fila de `profiles`.

La cuenta default SHALL tener: `name = 'Efectivo'`, `type = 'cash'`, `institution_id = NULL`, `is_active = true`. SHALL crearse junto con dos filas en `account_currencies`, una para `'ARS'` y otra para `'USD'`, ambas con `initial_balance = 0`, `initial_balance_date = current_date` y `is_active = true`.

El nombre `'Efectivo'` SHALL guardarse así en DB; la presentación al usuario SHALL traducirse vía i18n (`accounts.defaultCashName`).

#### Scenario: Usuario nuevo recibe Efectivo automáticamente

- **WHEN** se inserta una nueva fila en `auth.users`
- **THEN** el trigger crea una fila en `accounts` con `name='Efectivo'`, `type='cash'`, `user_id` igual al nuevo usuario
- **AND** crea dos filas en `account_currencies` (ARS y USD) con `initial_balance = 0`

#### Scenario: Idempotencia del backfill

- **WHEN** se aplica la migración de este módulo a una DB que ya tiene usuarios sin Efectivo (usuarios creados antes de este módulo)
- **THEN** el bloque de backfill itera sobre `auth.users` y crea Efectivo solo para aquellos que no tienen ninguna cuenta `cash` activa
- **AND** los usuarios que ya tienen una `cash` activa no reciben una segunda

#### Scenario: Trigger falla si el módulo no creó las tablas

- **WHEN** la migración se aplica
- **THEN** las tablas `accounts` y `account_currencies` se crean ANTES del trigger en el mismo archivo SQL
- **AND** el self-check al final verifica que trigger y función existen

---

### Requirement: Crear cuenta vía server action

El sistema SHALL exponer una server action `createAccount` que acepta los campos: `name` (string, 1–50 chars), `type` (`'cash' | 'bank'`), `institution_id` (UUID nullable según `type`), y un array `currencies` con al menos un elemento `{ currency_code, initial_balance }`.

La action SHALL ejecutar todas las validaciones en orden: autenticación, nombre, tipo, institución según tipo, lista de monedas no vacía, cada moneda en `('ARS', 'USD')`, cada `initial_balance ≥ 0`. SHALL escribir `accounts` y `account_currencies` en una transacción atómica (rollback completo si falla cualquier parte).

#### Scenario: Creación exitosa de cuenta bank con ARS y USD

- **WHEN** un usuario autenticado envía `{ name: 'Caja Santander', type: 'bank', institution_id: <santander_uuid>, currencies: [{currency_code:'ARS', initial_balance:'100000'}, {currency_code:'USD', initial_balance:'500'}] }`
- **THEN** la action retorna `{ success: true, accountId: <new_uuid> }`
- **AND** existen una fila en `accounts` y dos en `account_currencies`
- **AND** los saldos iniciales reflejan los montos enviados

#### Scenario: Nombre con más de 50 caracteres es rechazado

- **WHEN** un usuario envía un `name` de 51+ caracteres
- **THEN** la action retorna `{ success: false, error: <mensaje> }` y nada se inserta en DB

#### Scenario: Nombre vacío es rechazado

- **WHEN** un usuario envía un `name` vacío o solo whitespace
- **THEN** la action retorna error y no inserta nada

#### Scenario: Rollback si falla la inserción de currencies

- **WHEN** la inserción de `accounts` succede pero la inserción de `account_currencies` falla (ej. por un check constraint)
- **THEN** la action borra la fila de `accounts` antes de retornar el error
- **AND** la DB queda sin cuenta huérfana

---

### Requirement: Editar cuenta vía server action

El sistema SHALL exponer una server action `updateAccount` que acepta `id` y un subset de campos editables: `name` y, para cuentas `bank`, `institution_id`. El campo `type` SHALL NOT ser editable. `initial_balance` y `initial_balance_date` SHALL NOT ser editables vía esta action.

La action SHALL validar que el usuario sea el dueño de la cuenta (RLS lo enforce; la action retorna 404 si no encuentra).

#### Scenario: Edición de nombre

- **WHEN** un usuario actualiza el `name` de una cuenta propia
- **THEN** el `name` se persiste y la action retorna éxito

#### Scenario: Edición de institución en cuenta bank

- **WHEN** un usuario actualiza `institution_id` de una cuenta `bank` apuntando a otra institución activa del catálogo
- **THEN** el `institution_id` se persiste

#### Scenario: Intento de cambiar type es rechazado

- **WHEN** un cliente intenta enviar `type` en el payload de update
- **THEN** la action ignora el campo o retorna error de validación
- **AND** la DB no refleja ningún cambio de `type`

#### Scenario: Intento de setear institución en cuenta cash es rechazado

- **WHEN** un usuario intenta agregar `institution_id` a una cuenta existente de `type='cash'`
- **THEN** la action retorna error indicando que efectivo no acepta institución

#### Scenario: Edición sobre cuenta ajena es rechazada por RLS

- **WHEN** un usuario intenta actualizar una cuenta cuyo `user_id` no es el suyo
- **THEN** la operación es rechazada por RLS y la action retorna error de "no encontrada"

---

### Requirement: Archivar cuenta

El sistema SHALL exponer una server action `archiveAccount(id)` que setea `is_active = false` sobre la cuenta. La action SHALL bloquear el archivado cuando el **saldo derivado** de la cuenta sea distinto de cero en cualquier moneda activa.

La fórmula del saldo derivado SHALL ser `account_currencies.initial_balance + COALESCE(SUM(transactions.amount), 0)` por (account_id, currency_code). En este módulo la suma sobre `transactions` es siempre 0 porque la tabla no existe, así que la regla se reduce a `initial_balance != 0`. Cuando el módulo `transactions` exista, la fórmula se completa sin necesidad de actualizar esta action.

Una cuenta archivada SHALL NO aparecer en selectores de creación de transacciones, pero SHALL seguir visible en consultas históricas.

#### Scenario: Archivar cuenta con saldo cero

- **WHEN** un usuario archiva una cuenta cuyos `initial_balance` son todos 0
- **THEN** `is_active` pasa a `false` y la action retorna éxito

#### Scenario: Archivar cuenta con saldo positivo es bloqueado

- **WHEN** un usuario intenta archivar una cuenta con `initial_balance > 0` en al menos una moneda activa
- **THEN** la operación es rechazada con un mensaje indicando que primero hay que transferir o ajustar el saldo

#### Scenario: Cuenta archivada no aparece en selectores

- **WHEN** una cuenta archivada está disponible en DB
- **THEN** la query `getAccounts({ includeArchived: false })` NO la incluye
- **AND** la query `getAccounts({ includeArchived: true })` SÍ la incluye

---

### Requirement: Reactivar cuenta archivada

El sistema SHALL exponer una server action `reactivateAccount(id)` que setea `is_active = true`. SHALL funcionar sobre cualquier cuenta archivada del usuario sin más validaciones.

#### Scenario: Reactivación simple

- **WHEN** un usuario invoca `reactivateAccount` sobre una cuenta propia archivada
- **THEN** `is_active` vuelve a `true` y la cuenta reaparece en la lista activa

---

### Requirement: Eliminar cuenta vía server action

El sistema SHALL exponer una server action `deleteAccount(id)` que ejecuta hard delete de la fila en `accounts` (con CASCADE a `account_currencies`). La action SHALL bloquear el borrado cuando la cuenta tenga **cualquier referencia** desde la tabla `transactions`.

En este módulo, `transactions` no existe, por lo que la verificación es un placeholder que siempre pasa. La action SHALL implementar la verificación con un EXISTS contra `transactions` envuelto en un try/catch (o un check de schema) para que su signature no cambie cuando el módulo siguiente cree la tabla.

#### Scenario: Borrar cuenta sin referencias

- **WHEN** un usuario invoca `deleteAccount` sobre una cuenta propia sin transacciones (siempre cierto en v1)
- **THEN** la cuenta y sus filas en `account_currencies` se borran
- **AND** la action retorna éxito

#### Scenario: Borrar cuenta default Efectivo

- **WHEN** un usuario en modo `experto` invoca `deleteAccount` sobre su cuenta Efectivo default
- **THEN** la operación procede igual que sobre cualquier otra cuenta (no hay tratamiento especial en v1)
- **AND** el sistema NO recrea automáticamente Efectivo en ese momento; la recreación ocurre solo si el usuario vuelve a modo `novato`

---

### Requirement: Agregar y desactivar moneda en cuenta existente

El sistema SHALL exponer una server action `addCurrencyToAccount(accountId, currencyCode, initialBalance)` para habilitar una moneda nueva en una cuenta existente. La action SHALL crear una fila nueva en `account_currencies` con los datos provistos, `is_active = true`, e `initial_balance_date = getTodayAR()`. La moneda DEBE ser ARS o USD; cualquier otra es rechazada.

El sistema SHALL exponer `deactivateCurrencyFromAccount(accountCurrencyId)` que setea `is_active = false` sobre la fila. SHALL bloquear la desactivación cuando el saldo derivado de esa (account_id, currency_code) sea ≠ 0, con la misma fórmula que `archiveAccount`. NO borra la fila — solo la marca como inactiva, para preservar historial cuando exista `transactions`.

La acción NO SHALL permitir desactivar la única moneda activa de una cuenta — al menos una moneda activa debe permanecer.

#### Scenario: Agregar USD a una cuenta que solo tenía ARS

- **WHEN** un usuario invoca `addCurrencyToAccount(<id>, 'USD', '0')` sobre una cuenta que solo tenía ARS activo
- **THEN** se crea una fila nueva en `account_currencies` para esa cuenta con `currency_code='USD'`
- **AND** la cuenta queda con dos monedas activas

#### Scenario: Intento de agregar moneda duplicada es rechazado

- **WHEN** un usuario invoca `addCurrencyToAccount(<id>, 'ARS', ...)` sobre una cuenta que ya tiene ARS activo
- **THEN** la action retorna error
- **AND** no se crea una segunda fila

#### Scenario: Re-activar moneda previamente desactivada

- **WHEN** un usuario invoca `addCurrencyToAccount(<id>, 'USD', ...)` sobre una cuenta que tenía USD con `is_active = false`
- **THEN** la action retorna error porque la fila ya existe (UNIQUE constraint)
- **AND** indica que la moneda existe pero está desactivada — debe usar otra action para reactivarla

#### Scenario: Desactivar moneda con saldo cero

- **WHEN** un usuario invoca `deactivateCurrencyFromAccount` sobre una fila con `initial_balance = 0`
- **THEN** la fila pasa a `is_active = false`

#### Scenario: Desactivar moneda con saldo positivo es bloqueado

- **WHEN** un usuario intenta desactivar una fila con `initial_balance > 0`
- **THEN** la operación es rechazada

#### Scenario: Desactivar la última moneda activa es bloqueado

- **WHEN** un usuario intenta desactivar la única `account_currencies` activa de una cuenta
- **THEN** la operación es rechazada con un mensaje indicando que toda cuenta debe tener al menos una moneda activa

---

### Requirement: Lista de cuentas agrupada por tipo (web)

La pantalla `/accounts` (apps/web) SHALL mostrar las cuentas activas del usuario agrupadas por tipo, en este orden: **Efectivo** (`cash`) y **Cuentas bancarias** (`bank`). Cada sección tiene un título y un contador de cuentas. Una sección sin cuentas NO se muestra.

Dentro de cada sección, las cuentas SHALL ordenarse por `created_at ASC`.

La fila de cada cuenta SHALL mostrar `name`, el saldo por moneda activa, y para `bank` el nombre/color de la institución. El saldo mostrado SHALL ser el resultado de la fórmula derivada (en v1: `initial_balance` por moneda).

Cuando el usuario no tiene ninguna cuenta activa (ej. archivó la Efectivo default), la pantalla SHALL mostrar un estado vacío con un CTA para crear la primera cuenta.

#### Scenario: Lista vacía con CTA

- **WHEN** un usuario en modo experto sin cuentas activas abre `/accounts`
- **THEN** la pantalla muestra el estado vacío con un botón "Crear primera cuenta"

#### Scenario: Lista con efectivo y bancarias

- **WHEN** un usuario tiene Efectivo + dos cuentas bank activas
- **THEN** la pantalla muestra dos secciones: Efectivo (con 1 cuenta) y Cuentas bancarias (con 2 cuentas)
- **AND** dentro de la sección bancaria, las cuentas aparecen por `created_at ASC`

#### Scenario: Sección vacía no aparece

- **WHEN** un usuario tiene solo cuentas `cash` (sin bancarias)
- **THEN** la sección "Cuentas bancarias" NO se renderiza

---

### Requirement: Detalle de cuenta (web)

La pantalla `/accounts/[id]` SHALL mostrar el nombre de la cuenta, su tipo, la institución (si es `bank`), y el saldo derivado por cada moneda activa. SHALL exponer acciones de editar, archivar/reactivar, eliminar (sujetas a las reglas de cada action).

La pantalla SHALL incluir una zona placeholder para "Movimientos" con el mensaje "Todavía no hay movimientos en esta cuenta" hasta que el módulo `transactions` aterrice. Esa zona NO requiere rediseño cuando exista — los movimientos se alimentan sin cambiar el layout.

#### Scenario: Detalle de cuenta cash con ARS y USD

- **WHEN** un usuario abre el detalle de su Efectivo con ARS=10000 y USD=50
- **THEN** la pantalla muestra dos líneas de saldo: ARS 10.000,00 y USD 50,00 (formateados via i18n)
- **AND** el saldo grande/primario es ARS (mayor jerarquía visual)

#### Scenario: Detalle de cuenta bank con institución

- **WHEN** un usuario abre el detalle de una cuenta `bank` con institución Galicia
- **THEN** la pantalla muestra el nombre de la cuenta, el chip/header con "Galicia" y su `brand_color`
- **AND** la zona de movimientos muestra el placeholder

---

### Requirement: RLS estricta por usuario

Las tablas `accounts` y `account_currencies` SHALL tener Row Level Security habilitada. Las policies SHALL garantizar que un usuario autenticado:

- Lee solo cuentas con `user_id = auth.uid()`.
- Inserta solo cuentas con `user_id = auth.uid()`.
- Actualiza/borra solo cuentas con `user_id = auth.uid()`.
- En `account_currencies`, accede solo a filas cuyo `account_id` pertenece a una cuenta suya.

Ningún acceso cross-user SHALL ser posible vía las policies. El catálogo `institutions` y `currencies` (referenciados desde estas tablas) sigue con sus propias policies de catálogo público autenticado, ya provistas por `schema-base`.

#### Scenario: Lectura de cuenta ajena retorna vacío

- **WHEN** el usuario A consulta `accounts` con filtros que matchearían una cuenta del usuario B
- **THEN** la query retorna 0 filas
- **AND** no hay error — RLS filtra silenciosamente

#### Scenario: Insert con user_id ajeno es rechazado

- **WHEN** el usuario A intenta insertar una fila en `accounts` con `user_id = <usuario_B>`
- **THEN** la operación es rechazada por la policy WITH CHECK

#### Scenario: Acceso a account_currencies de cuenta ajena es rechazado

- **WHEN** el usuario A intenta leer filas de `account_currencies` cuyo `account_id` pertenece al usuario B
- **THEN** la query retorna 0 filas

---

### Requirement: Modo novato oculta el módulo y usa Efectivo implícita

Cuando un usuario está en modo `novato`, la app web SHALL NO renderizar las rutas `/accounts`, `/accounts/new`, ni `/accounts/[id]`. La navegación principal NO SHALL exponer enlaces al módulo. Si el usuario navega manualmente a esas rutas, SHALL ser redirigido al dashboard.

Las transacciones registradas por un usuario en modo `novato` (cuando exista el módulo `transactions`) SHALL imputarse automáticamente a su cuenta Efectivo default. Esa cuenta SHALL existir siempre en DB para el usuario, garantizada por el trigger DB de creación y por la regla de re-activación descrita abajo.

#### Scenario: Usuario novato navega a /accounts

- **WHEN** un usuario con `mode='novato'` abre la URL `/accounts` manualmente
- **THEN** es redirigido al dashboard (`/`)

#### Scenario: Usuario novato no ve link de cuentas en el menú

- **WHEN** un usuario en modo `novato` abre la navegación principal
- **THEN** no hay un item "Cuentas" visible

#### Scenario: Switch a experto expone el módulo

- **WHEN** un usuario cambia de `novato` a `experto`
- **THEN** el menú expone "Cuentas" y las rutas `/accounts*` son accesibles
- **AND** la cuenta Efectivo default (creada al signup) aparece como una cuenta normal

---

### Requirement: Re-activación automática de Efectivo al volver a novato

Cuando un usuario cambia de modo `experto` a `novato`, el sistema SHALL garantizar que tenga al menos una cuenta `cash` activa, dado que las transacciones de novato se imputan a esa cuenta.

La regla SHALL ser:

1. Si el usuario tiene al menos una cuenta `cash` con `is_active = true`, no se hace nada.
2. Si todas las cuentas `cash` del usuario están archivadas, el sistema SHALL re-activar la primera (por `created_at ASC`, es decir, la Efectivo default original).
3. Si el usuario eliminó físicamente todas sus cuentas `cash` (cosa que solo es posible cuando no tienen transactions), el sistema SHALL crear una nueva Efectivo con la misma forma que el trigger de signup.

Esta lógica vive en el módulo de modo de usuario (no en este módulo), pero el contrato es responsabilidad de `accounts` porque toca su esquema.

#### Scenario: Switch a novato con Efectivo activa

- **WHEN** un usuario con Efectivo activa cambia a `novato`
- **THEN** el sistema no toca ninguna cuenta

#### Scenario: Switch a novato con Efectivo archivada

- **WHEN** un usuario con Efectivo archivada (y ninguna otra `cash` activa) cambia a `novato`
- **THEN** el sistema reactiva la Efectivo (`is_active = true`)
- **AND** sus filas en `account_currencies` quedan accesibles tal como estaban

#### Scenario: Switch a novato con Efectivo eliminada

- **WHEN** un usuario sin ninguna cuenta `cash` (todas eliminadas físicamente) cambia a `novato`
- **THEN** el sistema crea una cuenta `cash` nueva con `name='Efectivo'` y filas de `account_currencies` para ARS y USD con `initial_balance = 0`
