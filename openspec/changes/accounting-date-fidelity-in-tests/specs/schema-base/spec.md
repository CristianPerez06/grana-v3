## ADDED Requirements

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
