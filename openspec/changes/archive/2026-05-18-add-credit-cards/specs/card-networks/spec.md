## ADDED Requirements

### Requirement: El sistema mantiene un catálogo de redes de tarjeta como tabla seed

El sistema SHALL exponer una tabla `card_networks` con los campos: `id` (UUID), `slug` (TEXT UNIQUE), `name` (TEXT), `brand_color` (TEXT, hex), `icon_key` (TEXT, slug del ícono), `display_order` (INTEGER) y `is_active` (BOOLEAN, default `true`). La tabla SHALL inicializarse via migración con al menos las siete redes operativas en Argentina: Visa, Mastercard, American Express, Cabal, Naranja, Naranja X y Mercado Pago.

#### Scenario: El catálogo trae las siete redes operativas

- **WHEN** un colaborador consulta `SELECT slug FROM card_networks WHERE is_active=true ORDER BY display_order`
- **THEN** recibe al menos las filas con slugs: `visa`, `mastercard`, `amex`, `cabal`, `naranja`, `naranja_x`, `mercado_pago`

#### Scenario: Slug es único

- **WHEN** se intenta insertar una segunda fila con `slug='visa'`
- **THEN** la DB rechaza por UNIQUE

---

### Requirement: La tarjeta referencia una red del catálogo o un nombre custom

El sistema SHALL permitir que una cuenta `accounts.type='credit'` referencie a una red del catálogo vía `accounts.network_id` (FK a `card_networks`) **o**, si la red no está en el catálogo, vía `accounts.other_network_name` (TEXT libre 2–50 caracteres). El constraint `chk_network_xor` SHALL exigir que exactamente uno de los dos campos esté presente para toda tarjeta. Esta XOR aplica únicamente cuando `accounts.type='credit'`; para `cash` y `bank`, ambos campos SHALL ser `NULL`.

#### Scenario: Tarjeta con red del catálogo

- **WHEN** se inserta una cuenta `credit` con `network_id=<id de Visa>` y `other_network_name=NULL`
- **THEN** el INSERT es aceptado

#### Scenario: Tarjeta con red custom

- **WHEN** se inserta una cuenta `credit` con `network_id=NULL` y `other_network_name='Marca local'`
- **THEN** el INSERT es aceptado

#### Scenario: Tarjeta con ambos campos llenos es rechazada

- **WHEN** se intenta insertar una cuenta `credit` con `network_id=<id de Visa>` y `other_network_name='Marca local'`
- **THEN** la DB rechaza por `chk_network_xor`

#### Scenario: Tarjeta sin red especificada es rechazada

- **WHEN** se intenta insertar una cuenta `credit` con `network_id=NULL` y `other_network_name=NULL`
- **THEN** la DB rechaza por `chk_network_xor`

#### Scenario: Cuenta cash no puede tener red

- **WHEN** se intenta insertar una cuenta `cash` con `network_id=<id de Visa>`
- **THEN** la DB rechaza por el constraint que limita las columnas a `type='credit'`

---

### Requirement: La red de una tarjeta es inmutable post-creación

El sistema SHALL rechazar cualquier UPDATE de `accounts.network_id` o `accounts.other_network_name` para cuentas `credit` ya existentes. Si el usuario necesita cambiar la red, debe eliminar la tarjeta (solo posible si no tiene transacciones jamás) y crearla de nuevo.

#### Scenario: Intento de cambiar `network_id` es rechazado

- **WHEN** el usuario envía un payload de edición con `network_id` distinto al original
- **THEN** el schema `updateAccountSchema` rechaza el campo
- **AND** la tarjeta queda intacta

#### Scenario: Intento de cambiar `other_network_name` es rechazado

- **WHEN** el usuario envía un payload de edición con `other_network_name` distinto al original
- **THEN** el schema rechaza el campo
- **AND** la tarjeta queda intacta

---

### Requirement: La metadata visual de la red se usa en el render del listado y detalle

El sistema SHALL renderizar la marca visual de cada tarjeta usando `card_networks.brand_color` (para el chip de red en la card) y `card_networks.icon_key` (para el logo cuando exista). Si la tarjeta usa `other_network_name`, el sistema SHALL renderizar el nombre custom como texto sin color de marca específico.

#### Scenario: Card del listado muestra el chip de red

- **WHEN** una tarjeta tiene `network_id=<id de Mastercard>` y Mastercard tiene `brand_color='#FF5F00'`
- **THEN** la card del listado muestra el chip "Mastercard" con fondo de ese color

#### Scenario: Tarjeta con red custom muestra el nombre sin color de marca

- **WHEN** una tarjeta tiene `other_network_name='Cooperativa Local'`
- **THEN** la card muestra el chip con ese texto y un color neutro del sistema (no de marca específica)

---

### Requirement: Solo el sistema (admin) puede modificar el catálogo de redes

El sistema SHALL aplicar Row Level Security sobre `card_networks` permitiendo SELECT a todos los usuarios autenticados y rechazando INSERT/UPDATE/DELETE para usuarios regulares. La gestión del catálogo SHALL hacerse via migraciones SQL.

#### Scenario: Cualquier usuario lee el catálogo

- **WHEN** un usuario autenticado consulta `card_networks`
- **THEN** recibe todas las filas activas

#### Scenario: Usuario regular no puede modificar el catálogo

- **WHEN** un usuario autenticado intenta INSERT o UPDATE en `card_networks`
- **THEN** RLS rechaza la operación
