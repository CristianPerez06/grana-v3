## MODIFIED Requirements

### Requirement: La card "Comprometido" muestra los resúmenes de tarjeta y los gastos fijos del mes próximo (lente COMPROMISO)

Este delta toca **únicamente** cómo se combinan las dos fuentes de "Gastos fijos". Todo lo demás del
requirement —tarjetas, arrastre de lo vencido, lentes, rótulos, barra apilada— queda como está.

**Las dos fuentes NO SHALL superponerse, y lo que las separa SHALL ser el conjunto de ocurrencias que
ya existen** en la ventana, en **cualquier** estado —pendiente, confirmada y omitida—. La proyección
de una regla SHALL restar ese conjunto: una ocurrencia que ya tiene fila no SHALL volver a anunciarse
como proyectada.

NO SHALL usarse `last_generated_date` para separarlas. Ese cursor solo avanzaba cuando el usuario
**resolvía** una ocurrencia, de modo que una sin resolver quedaba **antes** de él: la lectura de
instancias la contaba y la proyección, caminando desde el cursor, la emitía otra vez. La misma cuota,
dos veces, justo para el usuario que no se puso al día.

**Una ocurrencia SHALL ubicarse en la ventana por su VENCIMIENTO**, no por la fecha en que se pagó, y
SHALL contarse con esa misma fecha. Al resolverse, `scheduled_date` pasa a guardar la fecha de pago,
así que ubicar por esa columna saca la ocurrencia del mes al que pertenece: una cuota que venció el
10/08 y se pagó el 15/09 desaparecía de agosto —mientras su vencimiento seguía tapando la proyección
de agosto— y reaparecía en septiembre encima de la de septiembre.

**Fallback explícito:** una ocurrencia resuelta antes de que el sistema distinguiera vencimiento de
fecha de pago no tiene vencimiento recuperable. Esas SHALL ubicarse por `scheduled_date`, que es la
única fecha que tienen, y NO SHALL quedar fuera de toda ventana.

**Los ingresos recurrentes de la ventana SHALL sumar las dos fuentes**, igual que los gastos: las
ocurrencias ya materializadas que sigan **sin resolver**, más la proyección. Una ocurrencia de ingreso
materializada queda restada de la proyección, así que sumar solo la proyección la haría desaparecer de
"Ya entra". Las `confirmed` NO SHALL contarse —esa plata ya está en la cuenta— ni las `skipped`.

**Las lecturas que alimentan la card SHALL leerse completas**, paginando hasta agotarlas y ordenando
por columnas que identifiquen la fila. Una respuesta truncada no es una lectura incompleta y nada más:
las ocurrencias que quedan afuera dejan de tapar sus propias fechas, así que la proyección las vuelve a
emitir y aparece plata comprometida que nadie debe.

#### Scenario: Una ocurrencia sin resolver no se cuenta dos veces

- **WHEN** una regla mensual de $500.000 tiene su ocurrencia de la ventana materializada y **sin
  resolver**
- **THEN** la card cuenta $500.000 una sola vez
- **AND** la proyección no vuelve a emitir esa misma fecha

#### Scenario: Una cuota pagada más tarde cuenta en el mes en que venció

- **WHEN** una cuota vence el `2026-08-10` y se paga el `2026-09-15`
- **THEN** cuenta en la ventana de agosto, una sola vez
- **AND** no cuenta en la de septiembre

#### Scenario: Una ocurrencia sin vencimiento recuperable no desaparece

- **WHEN** una ocurrencia resuelta antes de la distinción tiene su vencimiento desconocido
- **THEN** se ubica en la ventana por la única fecha que conserva
- **AND** cuenta una sola vez

#### Scenario: Una ocurrencia omitida no vuelve como compromiso

- **WHEN** el usuario declaró que un período no corresponde y la ocurrencia queda omitida
- **THEN** no se cuenta como compromiso
- **AND** tampoco se proyecta

#### Scenario: Un ingreso materializado sigue apareciendo en "Ya entra"

- **WHEN** la ocurrencia de un ingreso recurrente ya está materializada y sigue sin resolver
- **THEN** "Ya entra" la cuenta una sola vez

#### Scenario: Una respuesta truncada no inventa compromiso

- **WHEN** la ventana tiene más ocurrencias de las que el servidor devuelve en una sola respuesta
- **THEN** la card las lee todas
- **AND** el monto no incluye ninguna ocurrencia que ya exista
