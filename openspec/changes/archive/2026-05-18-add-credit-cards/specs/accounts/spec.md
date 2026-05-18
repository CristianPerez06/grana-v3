## ADDED Requirements

### Requirement: El usuario puede crear una tarjeta de crédito

El sistema SHALL permitir crear una cuenta de `type='credit'` (tarjeta de crédito). Una tarjeta requiere: `name` (opcional 1–50 caracteres, trimmed; autogenerado si vacío), `institution_id` (referencia a fila activa de `institutions`; obligatorio en modo experto, opcional en alta automática de modo novato), red (referencia a `card_networks.id` o nombre custom 2–50 caracteres, exactamente uno), monedas activas (ARS obligatoria), `credit_limit` opcional en ARS positivo, y las fechas del ciclo inicial (cuatro fechas en modo experto, una sola fecha en modo novato — ver capability `auth`).

Una tarjeta tiene siempre `initial_balance=0` en todas sus `account_currencies` (enforced por constraint).

#### Scenario: Tarjeta creada con datos completos (experto)

- **WHEN** el usuario completa el formulario con banco, red (Visa), nombre opcional vacío, monedas (ARS+USD), `credit_limit=$1.500.000`, y cuatro fechas válidas
- **THEN** el sistema inserta una fila en `accounts` con `type='credit'`, `name='Visa <Banco>'` autogenerado, `credit_limit=1500000`, `network_id` apuntando a Visa
- **AND** crea dos `account_currencies` con `initial_balance=0`
- **AND** crea dos `card_periods` con `is_estimated=false`

#### Scenario: Tarjeta con red custom

- **WHEN** el usuario selecciona "otra red" e ingresa `other_network_name='Cooperativa Local'`
- **THEN** la tarjeta se crea con `network_id=NULL` y `other_network_name='Cooperativa Local'`

#### Scenario: Tarjeta sin institución en modo experto es rechazada en validación

- **WHEN** el usuario en modo experto intenta crear una tarjeta sin elegir institución
- **THEN** la action retorna error de validación
- **AND** no inserta nada

#### Scenario: Tarjeta con `credit_limit` cero o negativo es rechazada

- **WHEN** el usuario ingresa `credit_limit=0` o `credit_limit=-100`
- **THEN** la action retorna error de validación
- **AND** no inserta nada

---

### Requirement: Las cuentas credit no descuentan saldo disponible hasta el pago del resumen

El sistema SHALL excluir las transacciones de tipo `expense` con `account.type='credit'` y `status='pending'` del cálculo del saldo de cualquier cuenta. Estas transacciones SHALL impactar saldo únicamente cuando la operación "pago de resumen" se ejecute (la cual genera un `expense` separado en una cuenta `cash` o `bank` que sí descuenta).

#### Scenario: Consumo en tarjeta no descuenta saldo

- **WHEN** el usuario tiene `$500.000` en su cuenta "Galicia" y registra un consumo de `$50.000` en su tarjeta de crédito
- **THEN** el saldo de "Galicia" sigue siendo `$500.000`
- **AND** el saldo de "Mi plata" o cualquier otra cuenta `cash`/`bank` no cambia

#### Scenario: Pago de resumen sí descuenta saldo

- **WHEN** el usuario paga el resumen de la tarjeta por `$50.000` desde "Galicia"
- **THEN** el saldo de "Galicia" baja a `$450.000`

---

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

## MODIFIED Requirements

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

### Requirement: El sistema computa el saldo de cada cuenta en cada moneda derivado de las transacciones

El sistema SHALL calcular el saldo de cada `(cuenta, moneda)` como:

```
saldo(account, currency) =
  initial_balance(account, currency)
  + Σ amount WHERE type='income'     AND account_id=account                AND currency_code=currency
  − Σ amount WHERE type='expense'    AND account_id=account                AND currency_code=currency
  − Σ amount WHERE type='transfer'   AND account_id=account                AND currency_code=currency
  + Σ amount WHERE type='transfer'   AND transfer_destination_account_id=account AND currency_code=currency
  + Σ amount WHERE type='adjustment' AND account_id=account                AND currency_code=currency   (signed)
```

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

### Requirement: El usuario puede ver la lista de sus cuentas agrupadas por tipo

El sistema SHALL mostrar las cuentas del usuario agrupadas por `type` — un grupo para `cash`, otro para `bank`, y otro para `credit` (tarjetas, renderizadas como carrusel horizontal según la capability `cards`). Por defecto la lista excluye las cuentas con `is_active=false`. El orden dentro del grupo `cash`/`bank` es por `created_at` ascendente; el orden dentro de `credit` SHALL seguir las reglas de la capability `cards` (por fecha de cierre del período activo).

#### Scenario: Cuentas agrupadas por tipo

- **WHEN** el usuario tiene 2 cuentas cash, 3 cuentas bank y 2 tarjetas activas
- **THEN** la pantalla muestra tres secciones: "Efectivo" con 2, "Bancarias" con 3 y "Tarjetas" con el carrusel de 2

#### Scenario: Las archivadas no aparecen por default

- **WHEN** el usuario tiene cuentas con `is_active=false` de cualquier tipo
- **THEN** no aparecen en el listado principal (pero siguen accesibles vía consulta con `includeArchived=true`)

#### Scenario: Estado vacío de un grupo

- **WHEN** el usuario no tiene cuentas activas de un tipo
- **THEN** esa sección se omite (no se muestra "Tarjetas" si no hay tarjetas activas)
