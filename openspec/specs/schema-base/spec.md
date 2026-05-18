### Requirement: Monedas del sistema disponibles

El sistema SHALL proveer un catálogo de monedas (`currencies`) pre-cargado. Las monedas del sistema son inmutables — ningún usuario puede crearlas, editarlas ni eliminarlas. El catálogo mínimo incluye ARS (peso argentino) y USD (dólar estadounidense).

#### Scenario: Monedas disponibles para todos los usuarios autenticados

- **WHEN** un usuario autenticado consulta el catálogo de monedas
- **THEN** el sistema retorna todas las monedas con `is_active = true`
- **AND** el resultado incluye al menos ARS y USD

#### Scenario: Monedas no modificables por usuarios

- **WHEN** cualquier usuario intenta insertar, actualizar o eliminar una fila en `currencies`
- **THEN** la operación es rechazada por RLS

---

### Requirement: Instituciones financieras argentinas pre-cargadas

El sistema SHALL proveer un catálogo de instituciones financieras argentinas (`institutions`) pre-cargado con al menos 23 entidades del mercado local. Cada institución tiene nombre, slug único, color de marca, y tipo de ícono (`bank` o `wallet`). Las instituciones son inmutables para los usuarios.

#### Scenario: Instituciones disponibles al crear una cuenta bancaria

- **WHEN** un usuario autenticado consulta el catálogo de instituciones
- **THEN** el sistema retorna todas las instituciones con `is_active = true`

#### Scenario: Instituciones no modificables por usuarios

- **WHEN** cualquier usuario intenta insertar, actualizar o eliminar una fila en `institutions`
- **THEN** la operación es rechazada por RLS

---

### Requirement: Redes de tarjeta de crédito pre-cargadas

El sistema SHALL proveer un catálogo de redes de tarjeta de crédito (`card_networks`) pre-cargado con las 7 redes operativas en Argentina (Visa, Mastercard, Amex, Cabal, Naranja, Naranja X, Mercado Pago). Las redes son inmutables para los usuarios.

#### Scenario: Redes disponibles al crear una tarjeta de crédito

- **WHEN** un usuario autenticado consulta el catálogo de redes
- **THEN** el sistema retorna todas las redes con `is_active = true`

#### Scenario: Redes no modificables por usuarios

- **WHEN** cualquier usuario intenta insertar, actualizar o eliminar una fila en `card_networks`
- **THEN** la operación es rechazada por RLS

---

### Requirement: Aritmética monetaria con tipo Money

Todo el código de la aplicación que opere sobre valores monetarios SHALL usar el tipo `Money` (branded type sobre `decimal.js`). Está prohibido usar operadores aritméticos nativos de JavaScript (`+`, `-`, `*`, `/`) directamente sobre valores monetarios.

El tipo `Money` provee métodos seguros: `add`, `subtract`, `multiply`, `divide`, `toNumber`, `toFixed`, `isZero`, `isNegative`, `compare`. Todos los resultados son instancias de `Money`.

Los valores monetarios en DB se almacenan como `NUMERIC(18,2)`. Al leer de DB, el valor se deserializa a `Money`. Al escribir a DB, se serializa con exactamente 2 decimales.

#### Scenario: Suma de dos montos sin error de punto flotante

- **WHEN** se suman `Money(0.1)` y `Money(0.2)` usando `Money.add`
- **THEN** el resultado es `Money(0.3)`, no `Money(0.30000000000000004)`

#### Scenario: División de monto en cuotas

- **WHEN** se divide `Money(100)` en 3 cuotas usando `Money.divide(3)`
- **THEN** las cuotas suman exactamente `Money(100)` (el residuo se asigna a la primera cuota)

---

### Requirement: Fecha actual en timezone argentino

El sistema SHALL proveer el helper `getTodayAR()` como única fuente de la fecha actual para operaciones financieras. Este helper retorna un objeto `Date` con la fecha correcta en el timezone `America/Argentina/Buenos_Aires` (UTC−3, sin DST).

Ningún módulo de la aplicación MUST usar `new Date()` directamente cuando necesite "la fecha de hoy" en contexto financiero.

#### Scenario: Fecha correcta en horario nocturno argentino

- **WHEN** se llama a `getTodayAR()` a las 23:30 hora argentina (02:30 UTC del día siguiente)
- **THEN** el resultado es la fecha argentina (no la fecha UTC del día siguiente)

#### Scenario: Consistencia con registro de transacciones

- **WHEN** un usuario registra una transacción "hoy"
- **THEN** la fecha asignada a la transacción usa `getTodayAR()` como base, no `new Date()`
