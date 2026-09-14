# schema-base Specification

## Purpose

El módulo `schema-base` reúne los cimientos transversales sobre los que se apoya el resto del dominio: los catálogos de sistema pre-cargados e inmutables (monedas, instituciones financieras argentinas, redes de tarjeta), el tipo `Money` que estandariza la aritmética monetaria sobre `decimal.js`, y la convención de fecha contable + zona horaria financiera (`America/Argentina/Buenos_Aires`).

Ningún módulo financiero (`accounts`, `transactions`, `cards`, …) puede comportarse de forma correcta sin estas piezas: definen las monedas válidas, cómo se calcula con dinero sin perder precisión y qué significa "hoy" en términos contables.
## Requirements
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

El sistema SHALL proveer un catálogo de instituciones financieras (`institutions`) pre-cargado con al menos 29 entidades usadas desde Argentina. El catálogo NO se limita a bancos y billeteras: SHALL incluir también brokers (ALyC) y exchanges donde el usuario tiene saldo, porque esa plata es tan real como la de una caja de ahorro y el producto la muestra en el mismo lugar. Cada institución tiene nombre, slug único, color de marca, y tipo de ícono (`bank` o `wallet`).

El `icon_type` SHALL distinguir por licencia, no por origen ni por tamaño: `bank` (ícono `landmark`) queda reservado para entidades con licencia bancaria; toda otra entidad — billetera, broker, exchange — es `wallet`. El `brand_color` es display-only: alimenta el fondo del avatar y NO participa de ninguna decisión de negocio, de modo que corregirlo es un `UPDATE` y nunca una migración de datos.

Las instituciones del catálogo SHALL ser inmutables para los usuarios (no se pueden insertar, modificar ni eliminar filas del catálogo). Adicionalmente, el sistema SHALL permitir que cada usuario cree, lea, modifique y elimine sus propias instituciones "custom" (filas con `user_id = auth.uid()`), distinguidas del catálogo (filas con `user_id IS NULL`) por esa misma columna. El producto trata catálogo y custom de forma uniforme aguas arriba: el shape de la fila es el mismo y el avatar resolver no diferencia origen.

Como el catálogo es inmutable vía RLS, una fila faltante SHALL restaurarse por migración: no hay camino de vuelta desde la app.

#### Scenario: Instituciones disponibles al crear una cuenta bancaria

- **WHEN** un usuario autenticado consulta el catálogo de instituciones
- **THEN** el sistema retorna todas las instituciones con `is_active = true` cuyo `user_id IS NULL` (catálogo) o `user_id = auth.uid()` (custom del propio usuario)

#### Scenario: Un broker o exchange entra al catálogo como `wallet`

- **WHEN** se agrega al catálogo una entidad sin licencia bancaria (p. ej. un broker ALyC o un exchange)
- **THEN** la fila lleva `icon_type = 'wallet'`
- **AND** el avatar la renderiza con el ícono `wallet`, no con `landmark`

#### Scenario: Catálogo permanece inmutable

- **WHEN** cualquier usuario intenta insertar, actualizar o eliminar una fila de `institutions` con `user_id IS NULL`
- **THEN** la operación es rechazada por RLS

#### Scenario: Usuario crea su propia institución custom

- **WHEN** un usuario autenticado inserta una fila en `institutions` con `user_id = auth.uid()` y los campos válidos (name 1–50 trimmed, brand_color `#RRGGBB`, icon_type `bank` o `wallet`)
- **THEN** la inserción se acepta y la institución queda disponible para ese usuario

#### Scenario: Usuario no puede ver custom de otro usuario

- **WHEN** un usuario A consulta `institutions`
- **THEN** no aparecen filas con `user_id` distinto de NULL y distinto de `A.id`

#### Scenario: Usuario no puede modificar custom de otro usuario

- **WHEN** un usuario A intenta UPDATE/DELETE sobre una fila con `user_id = B.id`
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

Todo cálculo o comparación monetaria de la aplicación SHALL usar el tipo `Money` (branded type sobre `decimal.js`) o un helper compartido que lo use internamente. Está prohibido usar operadores aritméticos nativos de JavaScript (`+`, `-`, `*`, `/`) directamente para combinar valores monetarios dentro del motor contable. Esto aplica a saldos derivados, sumatorias de transacciones, pagos, límites, cuotas, ajustes y cualquier operación que combine montos.

El tipo `Money` provee métodos seguros: `add`, `subtract`, `multiply`, `divide`, `toNumber`, `toFixed`, `isZero`, `isNegative`, `compare`. Los helpers compartidos MAY convertir el resultado a `number` cuando están construyendo un modelo de lectura para UI o normalizando un valor justo antes de persistir.

Los campos monetarios MAY cruzar bordes de UI/API como `number` o `string` cuando sea necesario por formularios, Supabase o formateo visual, pero la conversión a `number` SHALL ocurrir **únicamente en el borde de presentación o persistencia**. Entre lectura, cálculo y comparación de montos, el código SHALL usar `Money`.

Los valores monetarios en DB se almacenan como `NUMERIC(18,2)` y `fx_rate_to_ars` se almacena como `NUMERIC(18,6)`. Los tipos generados de Supabase pueden transportar esos valores como `number`; esa representación se considera un borde de IO, no una autorización para hacer aritmética binaria. Al escribir a DB, las server actions SHALL normalizar los montos con la escala correspondiente.

#### Scenario: Suma de dos montos sin error de punto flotante

- **WHEN** se suman `Money(0.1)` y `Money(0.2)` usando `Money.add`
- **THEN** el resultado es `Money(0.3)`, no `Money(0.30000000000000004)`
- **AND** la comparación contra cero se hace con `Money.isZero` o equivalente decimal

#### Scenario: División de monto en cuotas

- **WHEN** se divide `Money(100)` en 3 cuotas usando `Money.divide(3)`
- **THEN** las cuotas suman exactamente `Money(100)` (el residuo se asigna a la primera cuota)

#### Scenario: Supabase transporta numeric como number en el borde

- **WHEN** una query de Supabase retorna un campo `NUMERIC(18,2)` tipado como `number`
- **THEN** el código puede pasarlo a la UI para display sin cálculo intermedio
- **AND** si necesita sumarlo, restarlo, compararlo contra cero o persistirlo de nuevo, lo convierte mediante `Money` o un helper monetario compartido

#### Scenario: Una query convierte a number solo al devolver datos para display

- **WHEN** una query de saldos lee `numeric(18,2)` desde Supabase
- **THEN** acumula los montos con `Money`
- **AND** convierte a `number` recién al construir el modelo de lectura que consume la UI

#### Scenario: Un cálculo contable nuevo no usa `Number(row.amount)` para sumar

- **WHEN** un colaborador agrega una sumatoria de montos de transacciones
- **THEN** convierte cada monto con `Money.from(row.amount)`
- **AND** usa `Money.add`/`Money.subtract` para acumular

#### Scenario: Un formulario monetario no usa parseFloat directo

- **WHEN** un formulario convierte un string ingresado por el usuario en un monto
- **THEN** usa un parser monetario compartido que rechaza parseos parciales como `123abc`
- **AND** recién después pasa el monto normalizado a la action o schema correspondiente

#### Scenario: Una server action normaliza antes de persistir

- **WHEN** una server action persiste `amount`, `initial_balance`, `credit_limit` o un campo monetario equivalente
- **THEN** normaliza el valor con el helper monetario compartido antes del INSERT/UPDATE
- **AND** usa la escala de DB correspondiente (`2` decimales para montos, `6` para `fx_rate_to_ars`)

#### Scenario: El baseline monetario actual queda auditado

- **WHEN** un colaborador revisa el baseline monetario de la V3
- **THEN** encuentra cubiertos con helpers decimales: cálculo de balances de cuentas, totales de tarjetas/períodos, inputs monetarios de formularios, normalización previa a persistencia, cuotas y comparación contra saldo cero
- **AND** considera aceptables los usos residuales de `number` en bordes de IO/display, formateo de una fila individual, cálculo de porcentajes visuales, y tipos generados de Supabase
- **AND** mantiene como pendiente consciente cualquier migración futura para representar `NUMERIC` como `string` o `Money` en tipos generados/curados de Supabase

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

### Requirement: Una fecha contable no cambia de día al cruzar de la base a JavaScript

Una fecha contable SHALL representar el mismo día calendario a los dos lados del
borde entre Postgres y JavaScript, sin importar la zona horaria del proceso que
haga la conversión. Un valor `DATE` que en la base es el 23 SHALL seguir siendo el
23 después de leerlo, tanto en una máquina en UTC−3 como en una en hora universal.

La causa concreta que este requirement prohíbe: Postgres no transporta zona horaria
en un `DATE`, pero un driver MAY decodificarlo como un instante a medianoche en hora
universal. Formatear ese instante con los getters **locales** de `Date`
(`getFullYear`/`getMonth`/`getDate`) resta el offset del huso y devuelve el día
anterior en cualquier zona al oeste de Greenwich — Argentina incluida. La conversión
SHALL NOT mezclar las dos convenciones: si el instante está en hora universal se lee
con getters universales, y si se construyó en hora local se lee con getters locales.

Los helpers compartidos de fecha del repo ya cumplen esto porque son internamente
consistentes: construyen medianoche **local** y la leen con getters **locales**, de
modo que el viaje de ida y vuelta preserva el día en cualquier huso. Ese apareo
SHALL mantenerse como la convención del repo, y todo código nuevo que convierta
fechas SHALL declarar cuál de las dos convenciones usa.

La regla aplica también —y sobre todo— al **código de test**. Un doble que se haga
pasar por el cliente de Supabase SHALL entregar una columna `date` con la misma
representación que entrega PostgREST: el texto `YYYY-MM-DD`. SHALL NOT entregar un
objeto `Date`, ni un texto derivado de reformatear uno, porque eso le da al andamio
una opinión propia sobre qué día es que el cliente real no tiene. Un doble infiel en
las fechas no puede sostener ninguna aserción sobre vencimientos, saldos ni períodos.

La exigencia sobre el doble SHALL cubrir **toda columna temporal**, no sólo `date`:
el valor que entrega SHALL ser de tipo texto, SHALL representar el mismo instante o
día que la base guardó, y SHALL ser idéntico en cualquier huso. Para un
`timestamptz` la salida SHALL ser una cadena ISO-8601 en UTC. Lo que un doble SHALL
NOT hacer es pasar el texto crudo de Postgres para ese tipo: Postgres lo renderiza
en el huso de la **sesión**, así que el mismo instante sale `2026-06-23 00:00:00+00`
bajo UTC y `2026-06-22 21:00:00-03` en Buenos Aires — dependencia del entorno otra
vez, un tipo más allá. MAY diferir de PostgREST en la notación del offset y en la
precisión sub-segundo; lo que NO MAY diferir es el tipo, el instante ni la
independencia del huso.

#### Scenario: La base devuelve una fecha y el lector está en Buenos Aires

- **WHEN** un read pide una columna `DATE` cuyo valor es `2026-06-23`
- **AND** el proceso corre en `America/Argentina/Buenos_Aires` (UTC−3)
- **THEN** el valor leído SHALL ser el día `2026-06-23`
- **AND** SHALL NOT ser `2026-06-22`

#### Scenario: La misma lectura en hora universal da el mismo día

- **WHEN** el mismo read corre en un proceso en hora universal
- **THEN** el valor leído SHALL ser `2026-06-23`, idéntico al de Buenos Aires

#### Scenario: Un doble de test del cliente de Supabase entrega una fecha

- **WHEN** un test lee una columna `date` a través de un doble que simula al cliente
  de Supabase
- **THEN** el doble SHALL entregar el texto `YYYY-MM-DD`, la misma representación que
  entrega PostgREST
- **AND** SHALL NOT entregar un objeto `Date` ni un texto reformateado a partir de uno

#### Scenario: Un doble de test entrega una columna `timestamptz`

- **WHEN** un test lee una columna `timestamptz` a través del doble
- **THEN** el valor SHALL ser una cadena ISO-8601 en UTC, no un objeto `Date`
- **AND** SHALL ser el mismo valor corriendo el proceso en UTC−11, en UTC y en UTC+14
- **AND** SHALL NOT ser el texto crudo de Postgres, que se renderiza en el huso de
  la sesión y por lo tanto cambia con el entorno

#### Scenario: Una ocurrencia futura se lee en su propia fecha

- **WHEN** una ocurrencia de recurrencia está fechada 30 días después de hoy
- **AND** un test la lee desde una máquina argentina
- **THEN** SHALL leerse en `hoy + 30`
- **AND** SHALL NOT leerse en `hoy + 29`, que es el día anterior y además coincide con
  el piso que libera la reparación de la regla — una coincidencia que disfraza un
  corrimiento de huso de error de comportamiento

### Requirement: Los tests corren en la zona horaria financiera de la app

La suite de tests SHALL correr con la zona horaria del proceso fijada en la zona
horaria financiera de la app (`America/Argentina/Buenos_Aires`), en **todo** entorno:
la máquina de cada colaborador y CI. La zona horaria SHALL estar fijada
explícitamente por configuración del repo y SHALL NOT quedar heredada del entorno.

La razón es que el gate tiene que validar la app en el huso en el que el producto
corre. Grana es una app argentina cuya fecha contable es argentina; una suite que
corre en hora universal es estructuralmente ciega a los errores de fecha que sólo se
manifiestan con offset distinto de cero, y los deja pasar a `main`. Los runners de CI
corren en hora universal por default, así que sin esta regla el gate está en verde por
accidente del entorno y no por corrección del código.

La zona horaria SHALL NOT fijarse en hora universal. Fijarla ahí también haría que
local y CI coincidan, pero coincidiendo en el huso equivocado: volvería a esconder
esta familia de errores en vez de exponerla, que es lo contrario de lo que un gate
existe para hacer.

Corolario: un corrimiento de fecha por zona horaria SHALL ser reproducible en CI. Si
un test falla por esa causa en la máquina de un colaborador, SHALL fallar también en
CI sobre el mismo commit.

#### Scenario: La suite corre en una máquina configurada en otro huso

- **WHEN** un colaborador corre la suite en una máquina cuya zona horaria del sistema
  no es la argentina
- **THEN** los tests SHALL correr igualmente en `America/Argentina/Buenos_Aires`
- **AND** el resultado SHALL ser el mismo que en cualquier otra máquina

#### Scenario: CI y la máquina local dan el mismo resultado

- **WHEN** la suite corre en CI y en la máquina de un colaborador sobre el mismo commit
- **THEN** el conjunto de tests que pasan y el de los que fallan SHALL ser idéntico

#### Scenario: Un corrimiento de fecha por huso sale rojo en CI

- **WHEN** se introduce código que convierte una fecha mezclando la convención local
  con la universal
- **THEN** el test que lo cubre SHALL fallar en CI
- **AND** SHALL NOT pasar en CI para fallar solamente en una máquina argentina

