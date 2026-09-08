## MODIFIED Requirements

### Requirement: La card "Cuánto gastaste" descompone el gasto propio del mes en Gastaste, Ya se pagó y Por pagar

El dashboard SHALL renderizar una card "Cuánto gastaste" con **tres tiles** de igual ancho, cada uno con ícono tintado, rótulo, monto en el color del bloque, línea USD según la regla bimoneda y un filete de color al pie:

- **Gastaste** = total de gastos devengados del mes.
- **Ya se pagó** = los que ya están saldados: la plata salió de alguna cuenta.
- **Por pagar** = los que siguen montados en una tarjeta de crédito.

`Ya se pagó + Por pagar` SHALL ser igual a `Gastaste` dentro de cada moneda.

**Cómo se clasifica cada movimiento.** Los tres montos NO SHALL derivarse restando agregados entre sí, sino ubicando **cada movimiento del mes en exactamente uno de cuatro cajones**, según dos preguntas: si está montado en una tarjeta de crédito, y de quién es la cuenta o la tarjeta.

| | Cuenta/tarjeta del usuario | Cuenta/tarjeta del otro miembro |
|---|---|---|
| **No es tarjeta** | Ya se pagó · lo pusiste vos | Ya se pagó · lo puso el otro |
| **Es tarjeta** | Por pagar · en tus tarjetas | Por pagar · se lo debés al otro |

De ahí salen los tres montos y las dos aperturas a la vez, y la identidad se sostiene por construcción en vez de por que dos lecturas coincidan.

El conjunto de movimientos que entra SHALL ser el mismo que el del desglose por categoría de Movimientos —mismo corte temporal, mismas exclusiones (la fila madre de una compra en cuotas y el pago de resumen, que cancela deuda y no es gasto nuevo), misma resolución de la parte propia—, de modo que las dos superficies nunca discrepen sobre **qué** cuenta como gasto del usuario aunque lo agrupen distinto.

**Reintegros recibidos — cuándo y dónde.** Un reintegro SHALL contar en el mes en que **se percibió**, no en el del gasto que devuelve, y SHALL restar del cajón donde efectivamente cayó: acreditado a una cuenta baja "Ya se pagó", acreditado a un resumen baja "Por pagar". Restarlo en otro lado rompería la identidad.

Lo percibido es la base, y es una decisión, no una omisión. La alternativa —que el reintegro siga a su gasto vinculado y baje el mes en que ese gasto ocurrió— es más contable y hace que cada mes muestre lo que "realmente costó", pero **vuelve mutable el pasado**: alguien que miró un mes cerrado y anotó el número lo ve distinto semanas después sin haber cargado nada en ese mes, y esta card se sostiene sobre ser verificable contra las cuentas del usuario. Además separa la lente de gasto de la de caja, donde la plata entró cuando entró — y las dos conviven en la misma pantalla.

La consecuencia asumida es que un reintegro de un gasto de un mes anterior **puede dejar una categoría en crédito**: el mes que lo recibe muestra una devolución sin el gasto que la originó. Eso NO SHALL corregirse moviendo el reintegro de mes; SHALL explicarse donde aparece (ver el requirement del desglose por categoría, que cierra con el neto). Cada cajón SHALL tener **piso en cero**: un reintegro mayor que el gasto de su cajón es un crédito, no un gasto negativo, y un monto negativo bajo el rótulo "ya se pagó" no significa nada.

**Movimiento sin cuenta identificable.** Un movimiento cuya cuenta no se puede resolver SHALL omitirse en lugar de asignarse a un cajón por defecto. Adivinar movería plata entre "ya está saldado" y "todavía lo debés", que es precisamente la distinción que esta card existe para sostener.

**La card entera SHALL leerse en una sola unidad: los gastos PROPIOS del usuario.** De un movimiento compartido SHALL tomar únicamente la parte asignada al usuario, en los tres montos por igual. La lente de caja —pesos moviéndose por las cuentas, montos completos— es la de la card de saldo ("Se fué"); mezclarlas es lo que producía el defecto que este requirement reemplaza: `Te queda por pagar` restaba un monto completo (`totalExpense`) de un monto "tu parte" (el devengado), subestimando la deuda de tarjeta en la parte del otro miembro de cada gasto compartido que el usuario había adelantado.

El rótulo "Ya se pagó" SHALL ser **impersonal**. Un gasto compartido que pagó el otro miembro está saldado con el comercio pero no con el usuario: decir "Pagaste" sería falso. Los otros dos rótulos hablan del estado de esa plata; solo "Gastaste" habla del usuario, y esa asimetría gramatical es deliberada.

La card SHALL renderizarse siempre que haya gasto en el mes, **incluso cuando "Por pagar" es cero**: un cero es información. La card NO SHALL desmontarse por ausencia de consumo de tarjeta.

**Los montos NO SHALL recortarse nunca.** Los tiles SHALL sostener montos de hasta diez dígitos con centavos (`$ 1.234.567.890,00`) dentro de un tercio del ancho de la card, achicando el cuerpo del monto por pasos a medida que crece. Un monto de dinero cortado no se lee como incompleto: se lee como **otro número**, y es la peor falla que esta card puede tener. Los pasos SHALL derivarse de una regla compartida entre plataformas —del largo del texto formateado, que es lo que consume ancho— para que las dos achiquen en el mismo punto aunque sus tamaños difieran.

En desktop, de las dos cards de la fila 2 la de "Cuánto gastaste" SHALL ser la más ancha: sus tres tiles se reparten el ancho en tercios, mientras que "Compromisos" apila filas de ancho completo y tolera mejor un ancho menor.

Los tres tiles SHALL **absorber el alto sobrante de la card**: crecen para llenarlo, con un alto mínimo propio y el contenido centrado. La card comparte fila con "Compromisos" y esa fila mide lo que mide la card más alta, así que esta card recibe alto que su contenido no pide. Con los tiles rígidos y la tira de ritmo clavada al pie, ese sobrante se acumulaba **entre los tiles y la tira**, que es el peor lugar posible: un agujero en el medio de la card. Elásticos, el sobrante se convierte en aire adentro del tile. La tira de ritmo NO SHALL anclarse al pie: con los tiles absorbiendo, anclarla vuelve a abrir el hueco que se acaba de cerrar.

Los tres SHALL crecer **por igual** —son una comparación de tres montos y un tile más alto que sus vecinos la rompe— y las dos caras de un tile SHALL crecer igual entre sí.

Como el contenido va **centrado en vertical**, cualquier diferencia de alto entre los tres los desalinea. De ahí dos reglas que valen para todo el bloque, no tile por tile:

- **El paso tipográfico del monto SHALL decidirse una sola vez para los tres**, tomando el más ajustado que necesite cualquiera de ellos. Calculado por tile, el tipo saltaba de un tile a otro y —peor— invertía la jerarquía: "Gastaste $ 1.020.283,17" se renderizaba **más chico** que "Por pagar $ 79.894,67", con el titular quedando subordinado al monto que se deriva de él. Es la misma regla que ya sigue la línea USD.
- **La franja inferior SHALL tener un alto único**, sea cual sea su variante. La leyenda ocupa dos líneas y la invitación a abrir una sola; dejar que la franja se dimensione sola bajaba los tiles que se abren respecto de su vecino y la fila dejaba de leerse como fila.

**Los tiles tienen dos variantes**, con la misma caja y el mismo alto **entre sí** —dar vuelta un tile nunca lo cambia de tamaño—, y solo cambia su franja inferior:

- **Sin actividad compartida** — el tile NO se abre y muestra una **leyenda de contexto** de dos líneas.
- **Con actividad compartida** — "Ya se pagó" y "Por pagar" pasan a **abrirse**, y la apertura reemplaza a la leyenda en esa misma franja.

Esa división NO es decorativa. Las leyendas "Ya salió de tus cuentas" y "Se paga en los próximos resúmenes" son **verdaderas exactamente cuando no hay actividad compartida**, que es la variante que las muestra; con otro miembro involucrado la plata pudo salir de la cuenta de él, o la deuda ser con él, y esa es justamente la variante que se abre. Cada variante lleva el copy que es cierto en ella.

"Gastaste" NO SHALL abrirse en ninguna variante y SHALL conservar su leyenda en las dos: su copy es verdadero siempre.

Cada apertura SHALL responder la pregunta que le corresponde, que no es la misma para los dos:

- "Ya se pagó" se abre por **quién puso la plata**: lo pusiste vos / lo puso el otro miembro (saldado con el comercio, pendiente con él).
- "Por pagar" se abre por **a quién le debés**: en tus tarjetas (viene en tu resumen) / se lo debés al otro miembro (está en la tarjeta de él, no viene en ningún resumen tuyo).

SHALL haber **un solo tile abierto a la vez**: dos aperturas simultáneas compiten por la misma lectura.

**Accesibilidad de la apertura.** El control SHALL exponer su estado (`aria-expanded` en web, `accessibilityState.expanded` en nativo) y la cara oculta NO SHALL quedar en el árbol de accesibilidad. Ocultarla solo visualmente —por ejemplo con `backface-visibility`— deja que un lector de pantalla lea las dos caras a la vez; hace falta `aria-hidden` o no montarla. En mobile el área táctil SHALL ser de al menos 44px.

El texto que invita a abrir NO SHALL repetir el del link del header de la card: son dos acciones distintas y el mismo rótulo para ambas hace que una de las dos mienta.

Lo que el usuario **adelantó por el otro miembro** NO SHALL aparecer en esta card. No es un gasto propio —es un préstamo—, su unidad es la de caja y no la de esta card, ya está reflejado en "Se fué" de la card de saldo, y el neto del hogar vive en la tira "Compartido". Mostrarlo acá agregaría un monto bruto del mes que competiría con el neto histórico de esa tira sin nada que explique la diferencia.

#### Scenario: Un reintegro de un gasto de otro mes cuenta en el mes que se recibió

- **WHEN** un gasto de julio se reintegra en agosto
- **THEN** julio sigue mostrando el gasto que mostraba, sin cambiar por algo que pasó después
- **AND** agosto resta el reintegro del cajón donde cayó la plata

#### Scenario: Mes con gasto de caja y de tarjeta

- **WHEN** el usuario gastó en el mes tanto desde sus cuentas como con tarjeta de crédito
- **THEN** los tres tiles muestran sus montos y `Ya se pagó + Por pagar` es igual a `Gastaste`

#### Scenario: Mes sin consumo de tarjeta

- **WHEN** todo el gasto del mes salió de las cuentas
- **THEN** la card se renderiza igual, con "Por pagar" en cero
- **AND** "Ya se pagó" coincide con "Gastaste"

#### Scenario: Un gasto compartido que pagó el otro miembro

- **WHEN** el otro miembro paga desde su cuenta un gasto compartido
- **THEN** la parte del usuario suma en "Gastaste" y en "Ya se pagó"
- **AND** el desglose la ubica en "lo puso" el otro miembro, no en "lo pusiste vos"

#### Scenario: Un consumo en la tarjeta del otro miembro

- **WHEN** el otro miembro carga en SU tarjeta un consumo compartido
- **THEN** la parte del usuario suma en "Por pagar"
- **AND** el desglose la ubica como deuda con el otro miembro y NO como algo que venga en el resumen del usuario

#### Scenario: Usuario sin gastos compartidos en el mes

- **WHEN** el mes no tiene ningún movimiento compartido
- **THEN** la card no ofrece desglose
- **AND** los tres montos se leen sin controles adicionales

#### Scenario: Mes sin ningún gasto

- **WHEN** el usuario navega a un mes sin gastos
- **THEN** la card muestra su estado vacío
- **AND** no se desmonta ni deja un hueco en la grilla
