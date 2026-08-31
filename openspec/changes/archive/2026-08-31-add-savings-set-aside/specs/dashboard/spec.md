## MODIFIED Requirements

### Requirement: El Hero muestra el disponible total bimoneda

La zona oscura de la card de saldo SHALL mostrar, centrados: el rótulo, el **monto grande en ARS** —con el signo y los centavos tipográficamente subordinados—, y la **fila USD** con su chip y su monto real en dólares.

El monto SHALL seguir al selector de mes, cortado al **último día del mes seleccionado** (o a hoy cuando el mes seleccionado es el corriente). Toda la card se mueve junta: dejar el saldo de hoy encima de los flujos de otro mes hace que los montos de la zona clara no cierren contra él, que es justamente lo que la card tiene que dejar verificar.

**Cuando el mes seleccionado es el corriente, el monto SHALL ser el disponible real**: el saldo de las cuentas propias **menos lo guardado**, por moneda. Ese es el número que contesta la pregunta que el usuario trae a la pantalla —*¿cuánto puedo gastar sin meter la pata?*— y es el que el rótulo viene prometiendo desde siempre.

El rótulo NO SHALL cambiar: sigue diciendo **"Saldo disponible total"**. Al netear el guardado el rótulo pasa a ser literalmente cierto, así que renombrarlo sería alejarlo de lo que muestra.

**Cuando el mes seleccionado NO es el corriente, el guardado NO SHALL netearse** y el monto SHALL seguir siendo el saldo al cierre de ese mes, con el rótulo diciéndolo (por ejemplo "Saldo al cierre de mayo de 2026"). Un "disponible" al cierre de un mes pasado no significa nada: la plata ya se gastó o no se gastó, y la decisión de guardar es una postura sobre el futuro, no un hecho del pasado. La regla es una sola y se lee del propio rótulo: **el guardado se netea exactamente donde la card dice "disponible"**.

En un mes pasado la palabra **"disponible" NO SHALL aparecer** en la card, ni en el rótulo ni en la zona clara. No es solo que el número no se netee: la card no plantea esa pregunta. Decir "podías gastar X en mayo" sería reconstruir una decisión de hoy sobre un mes cerrado — y si el usuario guardó o liberó desde entonces, ese número cambiaría retroactivamente cada vez, sin que nada haya pasado en mayo.

El monto del mes corriente SHALL leerse de la función normativa `get_available_sums(p_today)` —que devuelve por moneda el neto de cuentas, lo reservado y el disponible ya calculado— y el dashboard NO SHALL recomponer esa resta por su cuenta. El criterio de "cuenta propia" y el corte temporal siguen siendo los de `get_owned_account_ids()` y `get_account_balance_sums`: la función compone sobre ellas, no las reemplaza.

El saldo inicial de una cuenta SHALL contar únicamente cuando su fecha de declaración (`account_currencies.initial_balance_date`) es anterior o igual a la fecha de corte. Una cuenta creada en julio NO SHALL aportar su saldo inicial al saldo del 31 de mayo: no era plata que el usuario tuviera en mayo.

El disponible SHALL mostrarse **tal cual aunque quede negativo**. Si el usuario gastó por encima de lo que había apartado, el número queda en negativo y la card lo muestra: reducir el guardado para que el número cierre sería revocarle en silencio una decisión que no revocó.

La fila USD SHALL regirse por la regla bimoneda: se renderiza solo si el monto en dólares es distinto de cero. El guardado SHALL netearse **dentro de cada moneda**: lo guardado en pesos NO SHALL restar del monto en dólares ni al revés.

#### Scenario: El Hero descuenta lo guardado

- **WHEN** el usuario tiene $1.800.000 en sus cuentas en pesos y $200.000 guardados, y mira el mes corriente
- **THEN** el Hero muestra $1.600.000
- **AND** el rótulo sigue diciendo "Saldo disponible total"

#### Scenario: Un mes pasado muestra el saldo, no el disponible

- **WHEN** el usuario navega a un mes anterior
- **THEN** el monto es el saldo al cierre de ese mes, sin descontar lo guardado
- **AND** el rótulo indica que es el saldo al cierre de ese mes, no el disponible de hoy

#### Scenario: El guardado no cruza monedas

- **WHEN** el usuario tiene $200.000 guardados en pesos y saldo en dólares
- **THEN** el monto en USD no descuenta nada
- **AND** solo el monto en ARS queda neteado

#### Scenario: El disponible negativo se muestra tal cual

- **WHEN** el usuario tiene $150.000 en cuentas y $200.000 guardados
- **THEN** el Hero muestra `-$50.000`
- **AND** el total guardado sigue siendo $200.000

#### Scenario: Una cuenta creada después no infla los meses anteriores

- **WHEN** el usuario mira un mes anterior a la creación de una de sus cuentas
- **THEN** el saldo inicial de esa cuenta no participa del saldo de ese mes

#### Scenario: Usuario sin saldo en dólares

- **WHEN** el usuario no tiene saldo en USD
- **THEN** la fila USD no se renderiza
- **AND** el monto en ARS queda como única lectura del saldo

---

### Requirement: La zona clara de la card de saldo muestra el "Resumen del mes" con Tenías, Entró y Se fué

La card de saldo SHALL cerrar con una zona clara titulada "Resumen del mes", separada de la zona oscura por un borde superior, con **tres bloques en tres columnas iguales**: "Tenías", "Entró" y "Se fué". Cada bloque SHALL mostrar un punto de color, su monto ARS y —según la regla bimoneda— su monto USD debajo.

La grilla SHALL ocupar el ancho de la card en **tres columnas iguales**, y cada bloque SHALL alinearse dentro de la suya de modo que los tres **lleguen a los dos bordes**: el primero pegado a la izquierda —en el mismo eje que el título—, el último pegado a la derecha, el del medio centrado.

Los tres estuvieron alineados a la izquierda, con el argumento de que una sola regla de alineación se lee como una pieza. Con datos reales no se lee así: el contenido es más angosto que su tercio, así que los tres quedaban amontonados a la izquierda y sobraba una franja muerta contra el borde derecho de la card, con el bloque visiblemente descentrado.

Las columnas SHALL seguir siendo **tercios iguales**: la posición de cada monto NO SHALL depender de su contenido, o los tres saltarían de lugar al navegar de un mes a otro, que es justo lo que hay que poder comparar. Es la alineación de cada columna la que empuja el contenido hacia los bordes, no el ancho de la columna.

**En pantallas angostas los tres SHALL apilarse**, una fila cada uno con el rótulo a la izquierda y el monto a la derecha. Tres tercios de una card de ancho de teléfono son ~105px, y un monto de ocho cifras necesita más del doble: en tres columnas los montos se imprimían **encima** unos de otros. Achicar la tipografía hasta que entren tampoco sirve —deja de leerse—, así que cada monto se lleva una fila entera. Es la misma composición en las dos plataformas: nativo apila siempre.

**El paso tipográfico SHALL decidirse una sola vez para los tres**, igual que en los tiles y por la misma razón: tres montos que achican en puntos distintos dejan de compararse, y el arrastrado puede terminar más chico que los flujos.

Un monto muy largo SHALL seguir quedando adentro de su tercio: la regla de densidad achica la tipografía antes de que llegue a su vecino.

Los montos SHALL achicarse por pasos con la misma regla compartida que los tiles de "Cuánto gastaste", sobre la escala propia de esta zona.

"Tenías" es aquello con lo que el usuario **entró al mes**, y SHALL derivarse —no leerse— de los otros montos de la card, de modo que los tres cierren contra el monto de la zona oscura **por construcción** y no por que dos lecturas coincidan.

En un **mes pasado** la zona SHALL seguir cerrando exactamente como hasta ahora, contra el saldo al cierre:

```
Tenías + Entró − Se fué  ===  el saldo que muestra la card arriba
```

Ese es el punto de los tres montos juntos: la card queda auditable en pantalla, sin salir a buscar nada.

**En el mes corriente**, donde la zona oscura muestra el disponible real, la zona clara SHALL agregar **una fila propia bajo una regla** y la identidad SHALL extenderse:

```
Tenías + Entró − Se fué − Guardado  ===  el disponible que muestra la card arriba
```

donde **`Guardado` es el total apartado**, meses anteriores incluidos, y **`Tenías` sigue siendo el saldo de cuentas** con el que se abrió el mes — el mismo significado que en un mes pasado, y el mismo número que tendría sin nada guardado.

Esa combinación es deliberada y es lo que hace la card verificable. La alternativa —restar solo el **flujo del mes** y que `Tenías` pase a ser "el disponible con el que entraste"— también cierra, pero **netea las reservas de meses anteriores adentro de un número que no lo dice**: alguien que suma los tres montos no puede reconstruir dónde fueron a parar esos pesos, y `Tenías` deja de ser algo que el usuario pueda verificar contra sus propias cuentas. Restar el stock los pone **en pantalla, una vez, con nombre**.

El flujo del mes no se pierde: vive en la **vista de detalle**, que es donde corresponde la pregunta *"¿qué hice este mes?"*.

Esa fila NO SHALL sumarse como cuarta columna de la tira: SHALL renderizarse **debajo de una regla**, a lo ancho, con el rótulo a la izquierda y el monto a la derecha. La tira de tres es **liquidez** —plata entrando y saliendo de las cuentas— y guardar no es ninguna de las dos cosas: es una decisión sobre plata que se quedó donde estaba. Meterla como cuarto hermano diría que es lo mismo que un ingreso o un gasto.

**En el mes corriente la fila SHALL renderizarse siempre**, en uno de dos estados, y SHALL ser tocable en los dos:

| Estado | Rótulo | Monto | Adónde lleva |
|---|---|---|---|
| Hay algo guardado | *Guardado* | el **total**, con signo menos | detalle del guardado |
| No hay nada guardado | *Guardar algo* | ninguno | drawer de Guardar |

Renderizarla solo cuando hay actividad dejaría dos agujeros, y los dos son de uso normal: quien guardó en agosto y en septiembre no tocó nada **vería el Hero restando una plata que la pantalla no nombra en ningún lado**, sin forma de llegar al detalle; y quien descartó la sugerencia y se arrepiente tres días después no tendría por dónde volver. El acto tiene que tener una puerta que no dependa de haberlo hecho antes.

El estado sin stock SHALL abrir **directamente el drawer de Guardar**, no un detalle vacío: no hay nada que mirar todavía. SHALL renderizarse como una sola fila en gris, sin monto, sin ícono y sin color — es el precio de la puerta permanente para quien nunca va a guardar, y hay que mantenerlo en una línea.

El monto SHALL llevar **signo menos** —salió de lo que el usuario puede gastar— y renderizarse en **emerald**, no en terracota: el terracota está reservado en Grana para lo que está por pagar o vencido, y esto es progreso.

El stock SHALL leerse de la función normativa `get_available_sums(p_today)`, por moneda, y el dashboard NO SHALL calcularlo por su cuenta.

En un mes que **no** es el corriente la fila NO SHALL renderizarse, ni la regla: la zona SHALL verse exactamente como antes de existir el guardado.

La zona clara SHALL seguir siendo read-only en todo lo demás: la fila navega o abre un overlay, no edita.

La zona SHALL leerse como **liquidez**: cómo se movió el dinero dentro y fuera de las cuentas en el mes. Por lo tanto, **todo movimiento que haya tocado el saldo de una cuenta SHALL caer de exactamente uno de los dos lados**, según su signo: "Entró" suma los ingresos, los reintegros recibidos y el lado positivo de los buckets con signo (liquidaciones a favor, la pata de destino de un cambio de moneda, un ajuste positivo); "Se fué" suma los gastos pagados desde una cuenta, los pagos de resumen de tarjeta y el lado negativo de esos mismos buckets.

Guardar y liberar NO SHALL participar de "Entró" ni de "Se fué": no son movimientos, no tocan el saldo de ninguna cuenta y no crean filas en `transactions`. El invariante de liquidez que gobierna la tira queda **intacto**: dentro de cada moneda, `Entró − Se fué` SHALL seguir siendo igual al cambio del **saldo de las cuentas** en el mes, al centavo, sin importar cuánto haya guardado el usuario. La derivación SHALL usar aritmética de dinero exacta —no punto flotante crudo— para que la igualdad se sostenga y pueda testearse sin tolerancia.

Los **consumos con tarjeta de crédito** NO SHALL restar de "Se fué". No es una exclusión que haya que aplicar: son filas off-ledger que nunca tocan el saldo de una cuenta. Lo que sí SHALL restar es el **pago del resumen**, que es plata saliendo de la cuenta.

Los montos SHALL responder al selector de mes. La zona NO SHALL renderizar la barra apilada de ingresos/gastos, la fila "Ajustes" ni el link "Ver detalle" de la sección que reemplaza: el resumen se agota en los tres montos y, cuando corresponde, la línea del guardado.

#### Scenario: Mes con ingresos y egresos

- **WHEN** el usuario mira un mes con movimientos
- **THEN** "Entró" muestra todo lo que aumentó el saldo de sus cuentas ese mes y "Se fué" todo lo que lo bajó
- **AND** los dos bloques quedan centrados en columnas de igual ancho

#### Scenario: Los tres montos cierran contra el saldo

- **WHEN** el usuario mira un mes pasado con ajustes, liquidaciones o cambios de moneda además de ingresos y gastos
- **THEN** cada uno de esos movimientos aparece sumado en "Entró" o en "Se fué" según su signo
- **AND** `Tenías + Entró − Se fué` es igual al saldo que muestra la zona oscura de la card

#### Scenario: El mes corriente cierra con el guardado

- **WHEN** el usuario abrió el mes con $1.000.000 en sus cuentas, le entraron $2.000.000, se le fueron $1.200.000 y tiene $490.000 guardados
- **THEN** la fila muestra `−$490.000` en emerald, debajo de una regla
- **AND** la zona oscura muestra $1.310.000
- **AND** `1.000.000 + 2.000.000 − 1.200.000 − 490.000` es igual a ese $1.310.000

#### Scenario: Guardar no altera la tira de liquidez

- **WHEN** el usuario guarda $200.000
- **THEN** "Entró" y "Se fué" quedan exactamente iguales que antes de guardar
- **AND** `Entró − Se fué` sigue siendo igual al cambio del saldo de sus cuentas en el mes

#### Scenario: El total incluye lo guardado en meses anteriores

- **WHEN** el usuario guardó $300.000 en julio y este mes guardó $190.000 netos
- **THEN** la fila muestra $490.000
- **AND** "Tenías" es el saldo de cuentas con el que abrió el mes, sin descontar nada
- **AND** `Tenías + Entró − Se fué − 490.000` es igual al disponible

#### Scenario: "Tenías" no cambia con lo guardado

- **WHEN** se compara la card de un usuario con $490.000 guardados contra la del mismo mes sin nada guardado
- **THEN** "Tenías" es el mismo número en las dos
- **AND** lo único que cambia es la fila del guardado y el disponible

#### Scenario: El usuario que nunca guardó tiene puerta al acto

- **WHEN** el usuario no tiene nada guardado
- **THEN** la fila muestra "Guardar algo", sin monto
- **AND** tocarla abre el drawer de Guardar, no un detalle vacío

#### Scenario: La fila no aparece en meses pasados

- **WHEN** el usuario navega a un mes anterior en el que sí había guardado
- **THEN** ni la fila ni la regla se renderizan, en ninguno de sus estados
- **AND** los tres montos cierran contra el saldo al cierre de ese mes

#### Scenario: Un mes arrastrado de meses anteriores

- **WHEN** el usuario venía de meses con más egresos que ingresos
- **THEN** "Tenías" muestra ese arrastrado, en negativo si corresponde
- **AND** el usuario puede leer en la misma card de dónde sale el número del mes

#### Scenario: Una compra con tarjeta de crédito no baja el mes

- **WHEN** el usuario paga una compra con tarjeta de crédito
- **THEN** ese consumo NO aparece en "Se fué"
- **AND** cuando pague el resumen de esa tarjeta, ese pago sí aparece en "Se fué" del mes en que lo pague

#### Scenario: Mes sin movimientos

- **WHEN** el usuario navega a un mes sin ningún movimiento
- **THEN** ambos bloques muestran cero en ARS
- **AND** la zona sigue renderizando, sin desmontarse
