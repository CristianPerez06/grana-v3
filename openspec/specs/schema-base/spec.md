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

Todo cálculo o comparación monetaria de la aplicación SHALL usar el tipo `Money` (branded type sobre `decimal.js`) o un helper compartido que lo use internamente. Está prohibido usar operadores aritméticos nativos de JavaScript (`+`, `-`, `*`, `/`) directamente para combinar valores monetarios dentro del motor contable.

El tipo `Money` provee métodos seguros: `add`, `subtract`, `multiply`, `divide`, `toNumber`, `toFixed`, `isZero`, `isNegative`, `compare`. Los helpers compartidos MAY convertir el resultado a `number` cuando están construyendo un modelo de lectura para UI o normalizando un valor justo antes de persistir.

Los valores monetarios en DB se almacenan como `NUMERIC(18,2)` y `fx_rate_to_ars` se almacena como `NUMERIC(18,6)`. Los tipos generados de Supabase pueden transportar esos valores como `number`; esa representación se considera un borde de IO, no una autorización para hacer aritmética binaria. Al escribir a DB, las server actions SHALL normalizar los montos con la escala correspondiente.

#### Scenario: Suma de dos montos sin error de punto flotante

- **WHEN** se suman `Money(0.1)` y `Money(0.2)` usando `Money.add`
- **THEN** el resultado es `Money(0.3)`, no `Money(0.30000000000000004)`

#### Scenario: División de monto en cuotas

- **WHEN** se divide `Money(100)` en 3 cuotas usando `Money.divide(3)`
- **THEN** las cuotas suman exactamente `Money(100)` (el residuo se asigna a la primera cuota)

#### Scenario: Supabase transporta numeric como number en el borde

- **WHEN** una query de Supabase retorna un campo `NUMERIC(18,2)` tipado como `number`
- **THEN** el código puede pasarlo a la UI para display sin cálculo intermedio
- **AND** si necesita sumarlo, restarlo, compararlo contra cero o persistirlo de nuevo, lo convierte mediante `Money` o un helper monetario compartido

---

### Requirement: Fecha contable y zona horaria financiera

El sistema SHALL tratar las fechas financieras como **fechas contables**: el campo `date` de movimientos, saldos iniciales, períodos y cualquier hecho económico se guarda como `DATE` sin timezone. Esa fecha representa el día contable elegido para la operación, no el instante técnico en que se creó la fila.

El sistema SHALL guardar el instante técnico de auditoría en campos `created_at` con tipo `TIMESTAMPTZ`. `date` y `created_at` tienen significados distintos y MUST NOT usarse como sustitutos entre sí:

- `date`: día contable del hecho económico, usado para saldos, reportes, períodos y agrupación funcional.
- `created_at`: instante real de inserción o auditoría técnica, usado como desempate determinístico y trazabilidad.

El sistema SHALL calcular los defaults de "hoy" usando la **zona horaria financiera del usuario**, no la zona horaria del servidor ni del navegador. En la V3 inicial, la zona horaria financiera por defecto es `America/Argentina/Buenos_Aires` porque el mercado objetivo inicial es Argentina. El helper actual `getTodayAR()` representa ese default inicial.

El sistema SHOULD evolucionar hacia un helper general `getTodayForTimezone(timezone)` o `getTodayForUser(userId)` cuando el perfil del usuario incluya una preferencia como `financial_timezone`. Hasta entonces, todo código financiero que necesite "hoy" MUST usar el helper centralizado vigente (`getTodayAR()`), nunca `new Date()` directo.

#### Scenario: Fecha contable se guarda sin timezone

- **WHEN** un usuario registra un gasto con fecha contable `2026-05-18`
- **THEN** `transactions.date` se guarda como `DATE '2026-05-18'`
- **AND** no se guarda un timestamp ni una conversión UTC en ese campo

#### Scenario: Auditoría técnica se guarda separada

- **WHEN** el sistema inserta una transacción
- **THEN** `transactions.created_at` registra el instante real de creación como `TIMESTAMPTZ`
- **AND** ese valor no reemplaza a `transactions.date` para reportes financieros

#### Scenario: Default de hoy usa la zona horaria financiera

- **WHEN** la app necesita prellenar una fecha "hoy" para una operación financiera
- **THEN** calcula el día usando la zona horaria financiera del usuario
- **AND** en la V3 inicial usa `America/Argentina/Buenos_Aires` mediante `getTodayAR()`
- **AND** no usa la fecha local del servidor ni `new Date()` directo

#### Scenario: Usuario viajando conserva su criterio contable

- **WHEN** un usuario con zona horaria financiera `America/Argentina/Buenos_Aires` usa la app desde otro país
- **THEN** los defaults de "hoy" siguen el calendario financiero configurado para ese usuario
- **AND** la ubicación física temporal no cambia automáticamente el día contable
