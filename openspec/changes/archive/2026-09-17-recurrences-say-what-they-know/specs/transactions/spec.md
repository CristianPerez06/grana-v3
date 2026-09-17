## MODIFIED Requirements

### Requirement: El modulo Movimientos muestra pendientes recurrentes separados del historial

El sistema SHALL mostrar las ocurrencias recurrentes sin resolver en un bloque separado del historial
de movimientos, sin mezclarlas con las transacciones reales.

El bloque SHALL estar presente también en la pantalla de inicio de la aplicación, que es donde
empieza la sesión: hoy vive únicamente en Movimientos y en el hub, de modo que un usuario puede tener
vencimientos sin revisar y no enterarse nunca.

El bloque SHALL estar **expandido siempre que haya al menos una ocurrencia vencida**. NO SHALL
plegarse en función de la cantidad de ocurrencias sin resolver: cuantas más haya, más visible tiene
que ser, no menos.

El lenguaje del bloque SHALL expresar que hay **vencimientos por revisar** y NO SHALL afirmar deuda
ni pago: una ocurrencia sin resolver puede corresponder a un pago que el usuario ya hizo y todavía no
registró, o a uno que no hizo. El sistema NO SHALL rotular el conjunto como dinero adeudado, ni
llamarlo "pagos" —lo que afirmaría que hubo pago, que es justamente lo que no sabe—.

Cada fila SHALL indicar a qué vencimiento corresponde, y SHALL explicitar qué va a ocurrir al
resolverla —qué movimiento se crea, con qué fecha y en qué cuenta— antes de que el usuario confirme.

**El sistema SHALL avisar cuando una regla está trabada.** Una regla está trabada cuando acumula
**dos o más ocurrencias sin resolver y la más vieja ya está vencida**. En ese caso el bloque SHALL
nombrar la situación con todas sus letras, indicando **desde cuándo** —la fecha de la ocurrencia sin
resolver más antigua— y **cuántas** ocurrencias sin resolver hay.

El conteo SHALL expresarse como **lo que hay para revisar**, y NO SHALL presentarse como el total del
atraso. La materialización de vencimientos vencidos corre por lotes acotados y continúa en corridas
siguientes, de modo que un atraso largo puede tener todavía ocurrencias sin crear: afirmar un total
sería afirmar un número que el sistema no tiene.

Cuando queda reconstrucción pendiente, el bloque SHALL decirlo **una sola vez, para toda la
pantalla**, y NO SHALL atribuirla a ninguna regla. Lo que falta reconstruir es un único número de la
corrida completa y no identifica reglas; además el generador sólo consulta reglas **activas**, de
modo que colgárselo a cada línea haría que una regla pausada afirmara que se está recuperando un
atraso que nadie está recuperando. Las líneas por regla SHALL limitarse a nombrar la regla, su fecha
y su conteo.

El aviso NO SHALL bloquear ninguna acción, NO SHALL introducir una acción nueva —las que hay son
confirmar, editar y omitir— y NO SHALL afirmar deuda, por la misma razón que el resto del bloque. Una
regla con ocurrencias acumuladas SHALL contar para este aviso **cualquiera sea su `status`**: el
aviso describe vencimientos que quedaron sin resolver, y ninguna condición de la regla los resuelve
por su cuenta.

Estas reglas SHALL aplicar por igual en web y en la app nativa.

#### Scenario: El aviso está en el inicio

- **WHEN** el usuario abre la aplicación y tiene ocurrencias recurrentes sin resolver
- **THEN** las ve desde la pantalla de inicio, sin navegar a Movimientos ni al hub

#### Scenario: Con vencidos el bloque no arranca plegado

- **WHEN** el usuario tiene tres ocurrencias sin resolver, al menos una ya vencida
- **THEN** el bloque se muestra expandido

#### Scenario: El lenguaje no afirma deuda

- **WHEN** el bloque agrupa tres ocurrencias sin resolver de una misma regla
- **THEN** el rótulo las presenta como vencimientos por revisar
- **AND** no afirma que el usuario debe esa suma
- **AND** no afirma que esos pagos ya ocurrieron

#### Scenario: Pendiente recurrente visible sobre el historial

- **WHEN** existen instancias recurrentes pendientes
- **THEN** `/transactions` muestra un bloque de pendientes con acciones de confirmar, editar y omitir
- **AND** debajo muestra el historial real de movimientos

#### Scenario: Movimiento confirmado aparece en historial

- **WHEN** el usuario confirma una instancia recurrente
- **THEN** se crea una transaccion real
- **AND** el movimiento aparece en el historial global segun su fecha contable

#### Scenario: Una regla con vencimientos acumulados se nombra como trabada

- **WHEN** hoy es `2026-09-15` y una regla tiene veintisiete ocurrencias sin resolver, la más vieja del `2026-06-10`, sin reconstrucción pendiente
- **THEN** el bloque avisa que esa recurrencia está trabada desde el `2026-06-10`
- **AND** dice que hay veintisiete ocurrencias para revisar
- **AND** no afirma que el usuario deba esa suma

#### Scenario: Con reconstrucción pendiente se dice una sola vez, y de nadie en particular

- **WHEN** dos reglas están trabadas y la materialización todavía tiene ocurrencias por crear
- **THEN** el bloque dice una sola vez que la reconstrucción sigue en curso
- **AND** cada línea por regla dice desde cuándo está trabada y cuántos vencimientos hay para revisar
- **AND** ninguna línea atribuye la reconstrucción a su propia regla

#### Scenario: Una regla pausada no afirma que se está recuperando su atraso

- **WHEN** una regla pausada y una activa están trabadas, y lo que falta reconstruir corresponde a la activa
- **THEN** la línea de la regla pausada no afirma que se esté recuperando su atraso

#### Scenario: Una sola ocurrencia vencida no es una regla trabada

- **WHEN** una regla tiene exactamente una ocurrencia sin resolver, ya vencida
- **THEN** el bloque la muestra con su urgencia habitual
- **AND** no la nombra como trabada

#### Scenario: Dos ocurrencias que todavía no vencieron no son una regla trabada

- **WHEN** una regla tiene dos ocurrencias sin resolver y las dos vencen después de hoy
- **THEN** el bloque no la nombra como trabada

## REMOVED Requirements

### Requirement: El hub de recurrencias proyecta las próximas ocurrencias sin repetir lo ya materializado

**Reason**: Se reemplaza por «El hub de recurrencias proyecta lo que viene en dos ventanas, sin repetir lo ya materializado». Uno de sus escenarios —«Una instancia pendiente sigue proyectándose»— afirma lo contrario de lo que el sistema hace desde `fix-recurrence-backlog`: una ocurrencia materializada en cualquier estado, pendiente incluida, queda fuera de la proyección para no mostrarse en dos pantallas a la vez. Un `## MODIFIED Requirements` no puede retirar un escenario, así que el requirement se reemplaza entero para que la corrección quede explícita en vez de silenciosa.

**Migration**: Ninguna. El comportamiento en vigor no cambia: lo que cambia es el texto que lo describe, más la ventana de la segunda card, que pasa de fin de mes a 30 días corridos.

## ADDED Requirements

### Requirement: El hub de recurrencias proyecta lo que viene en dos ventanas, sin repetir lo ya materializado

El hub de recurrencias **web** (`/transactions/recurring`) SHALL mostrar una proyección informativa de las próximas ocurrencias de las reglas **activas**, en dos ventanas disjuntas: **"Próximos 7 días"** (`[hoy, hoy+7]`) y **"Próximos 30 días"** (`[hoy+8, hoy+30]`), ambas computadas con la fecha financiera AR (`getTodayAR()`). La proyección SHALL ser pura: NO SHALL leer ni escribir instancias, NO SHALL generar nada y NO SHALL sumar montos entre monedas (invariante bimoneda — cada ocurrencia muestra el suyo).

La segunda ventana SHALL medirse en **días corridos desde hoy**, y NO SHALL recortarse al fin del mes calendario. Una ventana que termina el último día del mes se vacía sola a medida que avanza el mes —desde el día en que `hoy+8` cae en el mes siguiente, su rango empieza después de terminar— y deja al usuario sin ningún horizonte más allá de siete días justo cuando más cerca está lo que viene.

Toda proyección de ocurrencias futuras —esta y cualquier otra superficie que anuncie "lo que viene", en web o en mobile— SHALL descartar **el conjunto de fechas que la regla ya cubre**, y NO SHALL usar un cursor de avance como `last_generated_date` para decidirlo. Ese conjunto se arma de las dos únicas formas en que una ocurrencia queda cubierta: el **movimiento semilla** de una regla creada a partir de un movimiento —que no tiene fila de instancia y aun así ocupa esa fecha— y cualquier **instancia materializada**, en el estado que sea.

Un cursor no sirve porque falla en las dos direcciones. **Cubre de más**: resolver el vencimiento de agosto lo empuja más allá del de julio, que la regla todavía debía, y julio desaparece de la proyección sin haberse resuelto. **Cubre de menos**: una ocurrencia sin resolver nunca lo mueve, así que la proyección vuelve a emitir una fecha que ya tiene fila, y el mismo compromiso se cuenta dos veces —una materializada y otra proyectada—, que es el defecto del #118.

Las ocurrencias ya cubiertas quedan fuera de "lo que viene" **cualquiera sea su estado**, pero no todas están en el mismo lugar: las **sin resolver** viven en el bloque de vencimientos por revisar, y las **confirmadas y las omitidas** viven en el historial. Salen de la proyección por la misma razón —ya existen— y se encuentran en destinos distintos.

La proyección y el generador SHALL derivar de un único caminante de calendario, de modo que no puedan divergir: toda fila proyectada corresponde a una ocurrencia que el generador todavía puede producir.

Cada tarjeta SHALL mostrar **como máximo cinco filas** y ofrecer el resto detrás de un control que diga **cuántas faltan**. El control SHALL ser un interruptor: despliega la lista completa y vuelve a plegarla. La lista NO SHALL plegarse sola mientras alguien la está leyendo. Con cinco filas o menos la tarjeta NO SHALL ofrecer nada que abrir. El tope SHALL regir en **las dos** tarjetas por igual, aunque una de ellas hoy sea corta: un tope que rige en una sola se lee como un error y no como una regla.

El tope existe porque la ventana de treinta días es lo que hizo largas a estas tarjetas, y el hub es también donde se entra a editar una regla: una tarjeta de dieciséis filas empuja la lista de reglas fuera de la pantalla, de modo que el costo del arreglo cae sobre una parte de la pantalla que no tenía el problema.

#### Scenario: Una regla creada desde un movimiento no proyecta su propia semilla

- **WHEN** hoy es `2026-08-04` y existe una regla mensual creada a partir de un movimiento registrado hoy, cuyo movimiento semilla cubre el `2026-08-04`
- **THEN** "Próximos 7 días" NO muestra una ocurrencia el `2026-08-04`
- **AND** la próxima ocurrencia proyectada de esa regla es el `2026-09-04`

#### Scenario: Una regla directa sin nada cubierto proyecta su start_date

- **WHEN** hoy es `2026-08-04` y existe una regla mensual con `start_date = 2026-08-07`, sin movimiento semilla y sin ninguna instancia materializada
- **THEN** "Próximos 7 días" muestra una ocurrencia el `2026-08-07`

#### Scenario: Una ocurrencia futura ya materializada no se proyecta

- **WHEN** hoy es `2026-08-04` y una regla mensual con `start_date = 2026-08-07` ya tiene materializada la ocurrencia del `2026-08-07`
- **THEN** ninguna de las dos cards muestra una ocurrencia el `2026-08-07`
- **AND** la próxima ocurrencia proyectada es el `2026-09-07`

#### Scenario: Las dos ventanas son disjuntas

- **WHEN** hoy es `2026-08-04` y una regla proyecta ocurrencias el `2026-08-07` y el `2026-08-21`
- **THEN** la del `2026-08-07` aparece solo en "Próximos 7 días" y la del `2026-08-21` solo en "Próximos 30 días"

#### Scenario: El fin de mes no vacía la segunda ventana

- **WHEN** hoy es `2026-09-25` y una regla mensual proyecta una ocurrencia el `2026-10-23`
- **THEN** esa ocurrencia aparece en "Próximos 30 días"
- **AND** la ventana no queda vacía por haber empezado después de terminar

#### Scenario: La ventana llega hasta 30 días y no más

- **WHEN** hoy es `2026-09-25` y una regla proyecta ocurrencias el `2026-10-25` y el `2026-10-26`
- **THEN** "Próximos 30 días" muestra la del `2026-10-25`
- **AND** no muestra la del `2026-10-26`

#### Scenario: Una instancia pendiente no se anuncia además como próxima

- **WHEN** una regla tiene una instancia pendiente sin resolver fechada dentro de la ventana proyectada
- **THEN** esa ocurrencia NO aparece en la card de próximas
- **AND** el bloque de vencimientos por revisar la muestra con sus acciones

#### Scenario: Resolver un vencimiento no esconde a los anteriores

- **WHEN** una regla debe los vencimientos de julio y de agosto, y el usuario resuelve el de agosto
- **THEN** el de julio sigue apareciendo como pendiente de resolver
- **AND** no queda cubierto por haberse resuelto uno posterior

#### Scenario: La tarjeta muestra cinco y ofrece el resto

- **WHEN** una tarjeta proyecta ocho ocurrencias
- **THEN** muestra cinco filas
- **AND** ofrece un control que dice que faltan tres

#### Scenario: El control despliega y vuelve a plegar

- **WHEN** el usuario despliega una tarjeta de ocho ocurrencias
- **THEN** ve las ocho
- **AND** con el mismo control vuelve a dejarla en cinco

#### Scenario: Con cinco o menos no hay nada que abrir

- **WHEN** una tarjeta proyecta cuatro ocurrencias
- **THEN** las muestra todas
- **AND** no ofrece ningún control para ver más

#### Scenario: La proyección no suma montos entre monedas

- **WHEN** las ocurrencias proyectadas incluyen reglas en ARS y en USD
- **THEN** cada fila muestra su propio monto en su moneda y el sistema no muestra ningún total combinado

### Requirement: Una regla recurrente se nombra con un orden único en las superficies de recurrencias

El sistema SHALL derivar el nombre visible de una regla recurrente en este orden: **descripción** →
**subcategoría** → **categoría** → **etiqueta del tipo de movimiento**. El mismo orden SHALL aplicar
al nombre de una ocurrencia, leído de los valores propios de esa ocurrencia.

El alcance SHALL ser **las superficies de recurrencias** —el hub y sus tarjetas de lo que viene, el
bloque de vencimientos por revisar, la ficha de la regla y el banner de sugerencia, en web y en la
app nativa—, y todas SHALL derivar el nombre de **una misma decisión**, de modo que no puedan
divergir entre sí.

La descripción va primero porque es lo único que el usuario escribió sobre esa regla en particular.
La subcategoría va antes que la categoría porque es la que distingue: «Internet» y «Gas» dicen qué
es cada regla, mientras que las dos se llaman «Servicios» —tres reglas de servicios bajo el mismo
nombre son tres filas que hay que abrir para saber cuál es cuál—. La etiqueta del tipo va última:
no identifica nada, y por eso mismo nunca falta.

Un valor **en blanco** SHALL contar como ausente: una descripción de espacios no es un nombre y el
sistema SHALL seguir bajando por la lista en lugar de dibujar una fila sin texto.

Toda superficie que nombre una regla SHALL leer los valores **de la regla**, nunca los de una de sus
ocurrencias: la clasificación y la descripción de una ocurrencia son su propia foto, editable de a
una fila, de modo que leerlas haría que editar una pendiente renombre una frase que habla de la
regla, y que renombrar la regla no la cambie.

La **ficha de la regla** SHALL mostrar la subcategoría cuando la tenga, junto a la categoría: sin ese
dato el nombre que aparece arriba no tiene origen visible en la pantalla que lo explica.

Estas reglas SHALL aplicar por igual en web y en la app nativa.

**Los «Compromisos del próximo mes» del inicio quedan FUERA de ese alcance, y es una divergencia
conocida.** Esa lectura arma el nombre por su cuenta: respeta el mismo orden, pero toma el nombre
**guardado** de la categoría en lugar del traducido y no tiene última instancia. En inglés el hub
dice «Services» y el inicio sigue diciendo «Servicios» sobre la misma regla, y una transferencia sin
clasificación queda sin nombre. Cerrarla exige que esa lectura entregue la **clasificación** en vez
del texto ya armado, para que cada superficie lo resuelva con su propio catálogo; es trabajo propio y
hasta que se haga el sistema NO SHALL darse por cumplido en esa pantalla.

#### Scenario: Sin descripción, la subcategoría le gana a la categoría

- **WHEN** una regla sin descripción tiene categoría «Servicios» y subcategoría «Internet»
- **THEN** las superficies que la nombran la llaman «Internet»
- **AND** no la llaman «Servicios»

#### Scenario: La descripción le gana a la clasificación

- **WHEN** una regla con descripción «Fibra hogar» tiene subcategoría «Internet»
- **THEN** se la nombra «Fibra hogar»

#### Scenario: Sin descripción ni clasificación, queda la etiqueta del tipo

- **WHEN** una regla de transferencia no tiene descripción ni categoría ni subcategoría
- **THEN** se la nombra «Transferencia»

#### Scenario: El aviso de regla trabada nombra la regla, no una ocurrencia

- **WHEN** una regla llamada «Fibra hogar» tiene ocurrencias sin resolver cuya descripción quedó en
  «Internet», y la regla está trabada
- **THEN** el aviso dice «Fibra hogar»
- **AND** las filas de esas ocurrencias siguen mostrando «Internet», que es lo que describe a cada una

#### Scenario: La ficha muestra de dónde sale el nombre

- **WHEN** el usuario abre una regla sin descripción, con categoría «Servicios» y subcategoría «Internet»
- **THEN** la ficha muestra las dos, categoría y subcategoría
