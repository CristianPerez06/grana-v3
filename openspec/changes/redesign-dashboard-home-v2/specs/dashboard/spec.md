## ADDED Requirements

### Requirement: Los montos del dashboard se muestran por moneda y la línea USD aparece solo si el valor es distinto de cero

Toda métrica monetaria del dashboard SHALL exponer su valor en ARS y su valor en USD como **cantidades independientes**, cada una derivada de los movimientos de su propia moneda. El dashboard SHALL NOT sumar ARS con USD ni convertir entre monedas, y NO SHALL depender de ningún tipo de cambio global: el FX del sistema vive por transacción (`transactions.fx_rate_to_ars`) y no existe una cotización de cuenta.

El valor ARS SHALL renderizarse siempre como titular de la métrica. El valor USD SHALL renderizarse como línea subordinada **únicamente cuando es distinto de cero**; cuando es cero, la línea USD NO SHALL ocupar espacio. Un usuario sin actividad en dólares SHALL ver la pantalla como monomoneda, sin líneas vacías ni ceros decorativos.

Los porcentajes derivados —el reparto de cuentas de "Dónde está", la barra apilada de Compromisos y el ritmo— SHALL calcularse **dentro de una misma moneda**, nunca sobre un total mezclado.

#### Scenario: Usuario sin movimientos en dólares

- **WHEN** un usuario cuyo saldo y movimientos del mes son íntegramente en ARS abre el dashboard
- **THEN** cada métrica muestra únicamente su monto en ARS
- **AND** ninguna sección renderiza una línea USD en cero

#### Scenario: Usuario con actividad en ambas monedas

- **WHEN** un usuario tiene saldo en ARS y saldo en USD
- **THEN** el saldo disponible muestra el total ARS como titular y el total USD como línea subordinada
- **AND** los dos montos son saldos reales de su moneda, no uno la conversión del otro

#### Scenario: Los porcentajes no cruzan monedas

- **WHEN** el bloque "Dónde está" calcula el porcentaje de una cuenta en USD
- **THEN** el denominador es el total en USD del usuario
- **AND** el total en ARS no participa del cálculo

---

### Requirement: La zona clara de la card de saldo muestra el "Resumen del mes" con Tenías, Entró y Se fué

La card de saldo SHALL cerrar con una zona clara titulada "Resumen del mes", separada de la zona oscura por un borde superior, con **tres bloques centrados en tres columnas iguales**: "Tenías", "Entró" y "Se fué". Cada bloque SHALL mostrar un punto de color, su monto ARS y —según la regla bimoneda— su monto USD debajo.

"Tenías" es el saldo con el que el usuario **entró al mes**. SHALL derivarse —no leerse— como `saldo del mes − (Entró − Se fué)`, de modo que los tres montos cierren contra el saldo de la zona oscura **por construcción** y no por que dos lecturas coincidan:

```
Tenías + Entró − Se fué  ===  el saldo que muestra la card arriba
```

Ese es el punto de los tres montos juntos: la card queda auditable en pantalla, sin salir a buscar nada.

Los dos **flujos** SHALL llevar su signo como prefijo (`+` en "Entró", `−` en "Se fué"), de modo que la identidad se lea literal de izquierda a derecha. "Tenías" NO SHALL llevar prefijo: muestra su propio signo solo cuando el saldo arrastrado es negativo. Ponerle `−` a los dos haría que el mismo símbolo signifique dos cosas distintas en la misma fila —un saldo en rojo y plata saliendo—, que es exactamente la confusión que los signos vienen a evitar. El prefijo NO SHALL renderizarse con los montos enmascarados: un signo suelto al lado de los puntos filtra la dirección que la máscara oculta.

La zona SHALL leerse como **liquidez**: cómo se movió el dinero dentro y fuera de las cuentas en el mes. Por lo tanto, **todo movimiento que haya tocado el saldo de una cuenta SHALL caer de exactamente uno de los dos lados**, según su signo: "Entró" suma los ingresos, los reintegros recibidos y el lado positivo de los buckets con signo (liquidaciones a favor, la pata de destino de un cambio de moneda, un ajuste positivo); "Se fué" suma los gastos pagados desde una cuenta, los pagos de resumen de tarjeta y el lado negativo de esos mismos buckets.

De ahí se sigue el invariante que gobierna la zona: dentro de cada moneda, `Entró − Se fué` SHALL ser igual al cambio del saldo disponible en el mes, al centavo. La derivación SHALL usar aritmética de dinero exacta —no punto flotante crudo— para que la igualdad se sostenga y pueda testearse sin tolerancia.

Los **consumos con tarjeta de crédito** NO SHALL restar de "Se fué". No es una exclusión que haya que aplicar: son filas off-ledger que nunca tocan el saldo de una cuenta. Lo que sí SHALL restar es el **pago del resumen**, que es plata saliendo de la cuenta.

Los dos montos SHALL responder al selector de mes. La zona NO SHALL renderizar la barra apilada de ingresos/gastos, la fila "Ajustes" ni el link "Ver detalle" de la sección que reemplaza: el resumen se agota en dos montos.

#### Scenario: Mes con ingresos y egresos

- **WHEN** el usuario mira un mes con movimientos
- **THEN** "Entró" muestra todo lo que aumentó el saldo de sus cuentas ese mes y "Se fué" todo lo que lo bajó
- **AND** los dos bloques quedan centrados en columnas de igual ancho

#### Scenario: Los tres montos cierran contra el saldo

- **WHEN** el mes tiene ajustes, liquidaciones o cambios de moneda además de ingresos y gastos
- **THEN** cada uno de esos movimientos aparece sumado en "Entró" o en "Se fué" según su signo
- **AND** `Tenías + Entró − Se fué` es igual al saldo que muestra la zona oscura de la card

#### Scenario: Un mes arrastrado de meses anteriores

- **WHEN** el usuario venía de meses con más egresos que ingresos
- **THEN** "Tenías" muestra ese saldo arrastrado, en negativo si corresponde
- **AND** el usuario puede leer en la misma card de dónde sale el saldo del mes

#### Scenario: Una compra con tarjeta de crédito no baja el mes

- **WHEN** el usuario paga una compra con tarjeta de crédito
- **THEN** ese consumo NO aparece en "Se fué"
- **AND** cuando pague el resumen de esa tarjeta, ese pago sí aparece en "Se fué" del mes en que lo pague

#### Scenario: Mes sin movimientos

- **WHEN** el usuario navega a un mes sin ningún movimiento
- **THEN** ambos bloques muestran cero en ARS
- **AND** la zona sigue renderizando, sin desmontarse

---

### Requirement: La card "Cuánto gastaste" descompone el gasto del mes en Gastaste, Pagaste y Te queda por pagar

El dashboard SHALL renderizar una card "Cuánto gastaste" con **tres tiles** de igual ancho, cada uno con ícono tintado, rótulo, monto en el color del bloque, línea USD según la regla bimoneda, un sub-bloque de contexto y un filete de color al pie:

- **Gastaste** = total de gastos devengados del mes.
- **Pagaste** = la parte de esos gastos que ya salió de las cuentas.
- **Te queda por pagar** = `Gastaste − Pagaste`, es decir los gastos del mes hechos con tarjeta de crédito.

Los tres montos SHALL reconciliar por construcción: `Pagaste + Te queda por pagar` SHALL ser igual a `Gastaste` dentro de cada moneda. El sub-bloque de "Te queda por pagar" SHALL mostrar la **cantidad de compras** con tarjeta que componen ese monto.

La card SHALL renderizarse siempre que haya gasto en el mes, **incluso cuando "Te queda por pagar" es cero**: un cero es información. La card NO SHALL desmontarse por ausencia de consumo de tarjeta.

#### Scenario: Mes con gasto de caja y de tarjeta

- **WHEN** el usuario gastó en el mes tanto desde sus cuentas como con tarjeta de crédito
- **THEN** los tres tiles muestran sus montos y `Pagaste + Te queda por pagar` es igual a `Gastaste`
- **AND** el sub-bloque de "Te queda por pagar" indica cuántas compras con tarjeta lo componen

#### Scenario: Mes sin consumo de tarjeta

- **WHEN** todo el gasto del mes salió de las cuentas
- **THEN** la card se renderiza igual, con "Te queda por pagar" en cero
- **AND** "Pagaste" coincide con "Gastaste"

#### Scenario: Mes sin ningún gasto

- **WHEN** el usuario navega a un mes sin gastos
- **THEN** la card muestra su estado vacío
- **AND** no se desmonta ni deja un hueco en la grilla

---

### Requirement: La tira de ritmo compara el gasto del mes contra los ingresos del mes

La card "Cuánto gastaste" SHALL cerrar con una tira de ritmo que muestre un anillo con el porcentaje, el copy con el porcentaje destacado, una barra de progreso y el pie con los dos montos que forman el cociente.

El ritmo SHALL calcularse como `Gastaste / ingresos acreditados` **dentro de la misma moneda y el mismo mes**. El denominador SHALL ser el ingreso del mes (`totalIncome`), NO el "Entró" de "Resumen del mes": ese último es una lectura de liquidez que incluye reintegros, liquidaciones y patas de cambio de moneda, y meterlas en el denominador infla el ritmo con plata que no es ingreso. El sistema NO SHALL requerir un ingreso mensual esperado configurado por el usuario.

Se SHALL renderizar **un solo anillo, el de ARS**. El ritmo en USD NO SHALL renderizarse como segundo anillo.

Dos estados SHALL tratarse como estados de primera clase, no como bordes excepcionales, porque con este denominador son habituales:

- **Ritmo indeterminado** (ingresos del mes en cero, típico a comienzo de mes): el sistema SHALL mostrar un mensaje explicativo **en lugar del anillo**, y NO SHALL mostrar 0% ni dividir por cero.
- **Ritmo mayor a 100%**: el anillo y la barra SHALL pasar al color de alerta (terracota) y el copy SHALL ajustarse para reflejar que el gasto superó los ingresos del mes.

#### Scenario: Mes con ingresos y gasto por debajo

- **WHEN** en el mes entraron ingresos y el gasto es menor
- **THEN** el anillo muestra el porcentaje `Gastaste / ingresos del mes` y la barra se llena en esa proporción
- **AND** el pie muestra los dos montos ARS que forman el cociente

#### Scenario: Comienzo de mes sin ingresos acreditados

- **WHEN** el usuario abre el dashboard antes de que se acredite ningún ingreso del mes
- **THEN** la tira muestra un mensaje explicativo en lugar del anillo
- **AND** no se renderiza ningún porcentaje

#### Scenario: El gasto supera los ingresos del mes

- **WHEN** `Gastaste` es mayor que los ingresos acreditados del mes
- **THEN** el anillo y la barra se pintan en el color de alerta
- **AND** el copy refleja que el gasto superó los ingresos, en vez de mostrar una barra llena sin señal

---

### Requirement: Los grupos de "Compromisos del próximo mes" son desplegables accesibles

La card de compromisos SHALL exponer sus dos detalles —Tarjetas y Gastos fijos— como grupos desplegables **independientes entre sí**. La cabecera de cada grupo SHALL ser un `<button>` con `aria-expanded` que refleje su estado y `aria-controls` apuntando al `id` del panel que despliega. El estado de expansión SHALL vivir en el estado de la vista, no en una mutación de clases sobre el DOM.

En mobile, el área táctil de cada cabecera SHALL ser de al menos 44px. El chevron SHALL rotar 180° al abrir, y esa SHALL ser la única transición de la card.

El grupo **Tarjetas** SHALL listar una fila **por tarjeta** con su total comprometido —no consumos individuales—, ordenadas por monto descendente. El grupo **Gastos fijos** SHALL listar hasta 10 filas con scroll interno propio y un link al listado completo. El scroll interno SHALL limitarse a esa lista: la card completa NO SHALL scrollear.

Con el grupo cerrado, su cabecera SHALL seguir informando el total comprometido de ese grupo y **cuántos ítems lo componen**, de modo que el estado cerrado responda la pregunta por sí solo y desplegar sirva para el desglose. Un panel oculto por defecto no puede mostrar las primeras filas, así que la información que sobrevive al colapso vive en la cabecera.

#### Scenario: Usuario despliega el grupo de tarjetas

- **WHEN** el usuario activa la cabecera del grupo Tarjetas
- **THEN** `aria-expanded` pasa a `true` y el panel asociado se muestra
- **AND** el estado del grupo Gastos fijos no cambia

#### Scenario: Usuario con varias tarjetas

- **WHEN** el usuario tiene cinco tarjetas con compromiso en el próximo mes
- **THEN** la cabecera cerrada informa el total y que son cinco tarjetas
- **AND** al desplegar aparecen las cinco, ordenadas por monto descendente

#### Scenario: Lista larga de gastos fijos

- **WHEN** el usuario tiene más gastos fijos de los que entran en el panel
- **THEN** la lista scrollea dentro de su propio contenedor
- **AND** la card de compromisos no scrollea como bloque

---

### Requirement: La tira "Compartido" muestra el neto del Hogar en web y en mobile cuando hay actividad

El dashboard SHALL renderizar al pie una tira "Compartido" —una sola línea clickeable que navega al módulo Compartido— **en ambas plataformas**. La tira SHALL mostrar el ícono, el nombre, los avatares apilados del grupo y el saldo neto en una sola dirección: "Te deben" en verde cuando el saldo favorece al usuario, "Debés" en terracota cuando va en contra.

La tira SHALL renderizarse **únicamente cuando hay actividad compartida**. Sin actividad, NO SHALL renderizarse ni dejar espacio reservado.

#### Scenario: Hogar con saldo a favor del usuario

- **WHEN** el hogar tiene actividad y el neto favorece al usuario
- **THEN** la tira muestra "Te deben" con el monto en verde
- **AND** se renderiza tanto en web como en la app nativa

#### Scenario: Usuario sin actividad compartida

- **WHEN** el usuario no tiene ningún hogar con actividad
- **THEN** la tira no se renderiza en ninguna plataforma
- **AND** el dashboard no deja un hueco al pie

## MODIFIED Requirements

### Requirement: La pantalla dashboard es la landing universal post-login y post-onboarding

El sistema SHALL renderizar la pantalla principal de la app en la ruta `/dashboard` bajo el grupo `(app)`, tanto en web como en mobile. La pantalla SHALL ser la única landing tras tres flujos: login exitoso, signup confirmado con onboarding ya completado, y completar el onboarding.

Ambas plataformas SHALL renderizar la misma composición en **cuatro bloques**, en orden fijo:

1. **"Saldo disponible total"** — una sola card de dos zonas: zona oscura con el saldo disponible, la fila USD y el bloque "Dónde está"; zona clara con "Resumen del mes".
2. **"Cuánto gastaste"** — los tres tiles (Gastaste / Pagaste / Te queda por pagar) y la tira de ritmo.
3. **"Compromisos del próximo mes"** — el total comprometido con su barra apilada y los dos grupos desplegables.
4. **"Compartido"** — la tira con el neto del Hogar, condicional a que haya actividad.

El dashboard NO SHALL renderizar la sección "En qué se fue" (dona por categoría, leyenda, créditos por categoría ni toggle ARS/USD) en ninguna plataforma: esa lectura vive en la portada del módulo Movimientos. Tampoco SHALL renderizar la sección "Lo que viene" ni la card de bienvenida `WelcomeFirstMoveCard`.

La sección Tarjetas NO forma parte del dashboard en ninguna plataforma; el resumen de tarjetas vive en `/cards` (web) y se navega desde el `AppMenu` → `/cards` (nativo).

#### Scenario: Usuario aterriza en dashboard tras completar el onboarding

- **WHEN** un usuario completa el flujo de onboarding
- **THEN** el sistema lo redirige a `/dashboard`
- **AND** la pantalla renderiza los cuatro bloques en orden fijo
- **AND** NO renderiza "En qué se fue", "Lo que viene" ni la card de bienvenida

#### Scenario: El desglose por categoría no se duplica en el dashboard

- **WHEN** el usuario quiere ver en qué categorías se fue el gasto del mes
- **THEN** el dashboard no ofrece esa lectura
- **AND** la encuentra en la portada del módulo Movimientos

---

### Requirement: El dashboard usa un layout multi-columna en desktop (web)

En desktop, el contenido del dashboard SHALL limitarse a un ancho máximo de 1080px centrado, junto a un sidebar de navegación de 248px, con una separación uniforme entre cards.

La grilla SHALL organizarse en tres franjas:

- **Fila 1**: la card "Saldo disponible total" a **ancho completo**.
- **Fila 2**: dos columnas —"Cuánto gastaste" y "Compromisos del próximo mes"— con la segunda algo más ancha que la primera. Las dos cards SHALL terminar **alineadas a la misma altura**, empujando la tira de ritmo al pie de su card cuando sobra espacio.
- **Pie**: la tira "Compartido" a ancho completo, cuando corresponde renderizarla.

Por debajo del ancho máximo de contenido, el layout SHALL colapsar a **una sola columna** y el sidebar SHALL ocultarse. El diseño mobile SHALL ser la referencia para los anchos chicos.

#### Scenario: Desktop ancho

- **WHEN** el usuario abre el dashboard en una ventana más ancha que el contenido máximo
- **THEN** la card de saldo ocupa el ancho completo y debajo quedan "Cuánto gastaste" y "Compromisos" en dos columnas
- **AND** las dos cards de la segunda fila terminan a la misma altura

#### Scenario: Ventana angosta

- **WHEN** el ancho de la ventana baja del ancho máximo de contenido
- **THEN** las cards se apilan en una sola columna
- **AND** el sidebar deja de renderizarse

---

### Requirement: El Hero muestra el disponible total bimoneda

La zona oscura de la card de saldo SHALL mostrar, centrados: el rótulo, el **saldo total en ARS** como monto grande —con el signo y los centavos tipográficamente subordinados—, y la **fila USD** con su chip y el saldo real en dólares.

El saldo SHALL seguir al selector de mes, cortado al **último día del mes seleccionado** (o a hoy cuando el mes seleccionado es el corriente). Toda la card se mueve junta: dejar el saldo de hoy encima de los flujos de otro mes hace que los montos de la zona clara no cierren contra él, que es justamente lo que la card tiene que dejar verificar.

Cuando el mes seleccionado NO es el corriente, el rótulo SHALL decirlo (por ejemplo "Saldo al cierre de mayo de 2026"): lo que el usuario tenía al cierre de un mes pasado no es lo que tiene disponible hoy, y un rótulo que dijera "disponible" estaría mintiendo.

El saldo inicial de una cuenta SHALL contar únicamente cuando su fecha de declaración (`account_currencies.initial_balance_date`) es anterior o igual a la fecha de corte. Una cuenta creada en julio NO SHALL aportar su saldo inicial al saldo del 31 de mayo: no era plata que el usuario tuviera en mayo.

La fila USD SHALL regirse por la regla bimoneda: se renderiza solo si el saldo en dólares es distinto de cero.

#### Scenario: El saldo sigue al selector de mes

- **WHEN** el usuario navega a un mes anterior
- **THEN** el saldo muestra el saldo al cierre de ese mes
- **AND** el rótulo indica que es el saldo al cierre de ese mes, no el disponible de hoy

#### Scenario: Una cuenta creada después no infla los meses anteriores

- **WHEN** el usuario mira un mes anterior a la creación de una de sus cuentas
- **THEN** el saldo inicial de esa cuenta no participa del saldo de ese mes

#### Scenario: Usuario sin saldo en dólares

- **WHEN** el usuario no tiene saldo en USD
- **THEN** la fila USD no se renderiza
- **AND** el monto en ARS queda como única lectura del saldo

---

### Requirement: La card "Dónde está" desglosa las cuentas del usuario

El desglose "Dónde está" SHALL vivir **dentro de la zona oscura** de la card de saldo, no como card separada, en dos columnas separadas por un divisor: **ARS a la izquierda y USD a la derecha**, con su encabezado propio y un link a Cuentas.

Cada columna SHALL listar las **dos cuentas con más saldo** de esa moneda, cada fila con un cuadradito del color de la cuenta, el nombre y su **porcentaje sobre el total de esa moneda**. El desglose NO SHALL renderizar barras de proporción: el porcentaje es la única expresión de la magnitud.

Una columna cuya moneda no tiene saldo NO SHALL renderizar filas vacías. Un usuario con una sola cuenta en una moneda SHALL ver una sola fila en esa columna.

#### Scenario: Usuario con varias cuentas en ambas monedas

- **WHEN** el usuario tiene tres cuentas con saldo en ARS y dos en USD
- **THEN** la columna ARS lista las dos de mayor saldo y la columna USD lista sus dos cuentas
- **AND** cada porcentaje está calculado sobre el total de su propia moneda

#### Scenario: Usuario sin saldo en dólares

- **WHEN** el usuario no tiene saldo en USD
- **THEN** la columna USD no lista cuentas
- **AND** la columna ARS conserva su lectura completa

---

### Requirement: La card "Comprometido" muestra los resúmenes de tarjeta y los gastos fijos del mes próximo (lente COMPROMISO)

La card "Compromisos del próximo mes" SHALL encabezar con el mes al que refiere y un link al listado completo, y SHALL mostrar un bloque de total con: el rótulo "Ya comprometido", el monto total en ARS, su línea USD según la regla bimoneda, una **barra apilada** de dos segmentos (Tarjetas y Gastos fijos) y una leyenda con el cuadradito y el porcentaje de cada uno.

El total SHALL ser `Tarjetas + Gastos fijos` dentro de cada moneda, y los porcentajes de la barra SHALL derivarse de ese total — NO SHALL hardcodearse. Cuando el total es cero, la barra NO SHALL renderizarse con proporciones arbitrarias.

El detalle de Tarjetas SHALL agregarse **por tarjeta** —una fila por tarjeta con su total comprometido y su próximo cierre en la bajada del grupo—, reemplazando el listado de consumos individuales.

Los estados vacíos SHALL cubrirse por separado: sin tarjetas con compromiso, el grupo Tarjetas muestra su vacío; sin gastos fijos, el grupo Gastos fijos muestra el suyo; sin ninguno de los dos, la card muestra un vacío único en lugar de dos vacíos apilados.

#### Scenario: Usuario con tarjetas y gastos fijos

- **WHEN** el próximo mes tiene compromisos de ambos tipos
- **THEN** el total es la suma de los dos y la barra apilada refleja su proporción real
- **AND** la leyenda muestra el porcentaje de cada segmento

#### Scenario: Usuario sin tarjetas

- **WHEN** el usuario no tiene ninguna tarjeta con compromiso el próximo mes
- **THEN** el grupo Tarjetas muestra su estado vacío
- **AND** el total y la barra reflejan solo los gastos fijos

#### Scenario: Usuario sin compromisos de ningún tipo

- **WHEN** no hay ni tarjetas ni gastos fijos comprometidos
- **THEN** la card muestra un único estado vacío
- **AND** no renderiza la barra apilada con proporciones inventadas

---

### Requirement: Cada sección del dashboard rotula la pregunta que ayuda a responder

Cada bloque del dashboard SHALL llevar un título que nombre la pregunta que responde, en el lenguaje del usuario y no en el del dominio: "Saldo disponible total" y "Dónde está" para cuánto tengo y dónde, "Resumen del mes" para qué pasó este mes, "Cuánto gastaste" para en qué se me fue y cuánto debo todavía, "Compromisos del próximo mes" para qué se viene, y "Compartido" para cómo estoy con el hogar.

Los rótulos de los tres tiles de "Cuánto gastaste" SHALL ser verbos en pasado dirigidos al usuario (Gastaste / Pagaste / Te queda por pagar), y cada uno SHALL ir acompañado de un sub-bloque que desambigüe qué mide, porque los tres son montos de gasto y sin esa aclaración se confunden entre sí.

#### Scenario: Los tres tiles se distinguen entre sí

- **WHEN** el usuario lee la card "Cuánto gastaste"
- **THEN** cada tile aclara en su sub-bloque qué mide su monto
- **AND** queda explícito que "Te queda por pagar" es lo financiado con tarjeta

---

### Requirement: Las secciones del dashboard renderizan su estado de carga como skeleton shape-matched

Cada bloque del dashboard SHALL renderizar, mientras carga, un skeleton que respete su forma final: mismos radios, misma altura aproximada y misma cantidad de bloques, para que la pantalla no salte al resolverse.

La card "Saldo disponible total" SHALL cargar con **un solo skeleton para la card completa**, aun cuando sus zonas se alimentan de dos lecturas distintas (el saldo, que no depende del mes; y el resumen mensual, que sí). Al compartir card, un skeleton por zona haría que la card se arme a saltos delante del usuario.

Una sección que falla SHALL degradar sin arrastrar al resto de la pantalla: el error queda contenido en su bloque.

#### Scenario: Carga inicial del dashboard

- **WHEN** el usuario abre el dashboard y los datos todavía no resolvieron
- **THEN** cada bloque muestra un skeleton con la forma de su contenido final
- **AND** la card de saldo muestra un único skeleton, no uno por zona

#### Scenario: Falla la lectura de compromisos

- **WHEN** la lectura que alimenta "Compromisos del próximo mes" falla
- **THEN** esa card muestra su estado de error
- **AND** el saldo, "Cuánto gastaste" y la tira Compartido siguen renderizando sus datos

---

### Requirement: La pantalla `(app)/dashboard` mobile renderiza las secciones del dashboard con tolerancia a fallas parciales

La pantalla nativa SHALL renderizar los **mismos cuatro bloques** que la web, en el mismo orden, en una sola columna, tomando el diseño mobile del handoff como referencia. Cada bloque SHALL tolerar la falla de su propia lectura sin tumbar la pantalla.

Los componentes nativos SHALL mantener la convención de naming espejo respecto de los de web. Los controles interactivos —las cabeceras de los grupos desplegables y la tira Compartido— SHALL tener un área táctil de al menos 44px.

#### Scenario: La app nativa muestra la misma composición

- **WHEN** el usuario abre el dashboard en la app nativa
- **THEN** ve los cuatro bloques en el mismo orden que en web, apilados
- **AND** incluye la tira Compartido cuando hay actividad

#### Scenario: Área táctil de los desplegables en mobile

- **WHEN** el usuario toca la cabecera de un grupo de compromisos en la app nativa
- **THEN** el área activa es de al menos 44px
- **AND** el grupo alterna su estado sin afectar al otro

---

### Requirement: El dashboard tolera datos parciales sin romperse

El dashboard SHALL renderizar sin errores frente a cualquier combinación de datos faltantes: usuario sin cuentas, sin movimientos en el mes, sin ingresos acreditados, sin tarjetas, sin gastos fijos y sin actividad compartida.

Cada bloque SHALL distinguir entre **cero** y **ausencia de dato**: un monto en cero se muestra como cero, mientras que una métrica que no se puede calcular —señaladamente el ritmo cuando no hubo ingresos en el mes— SHALL mostrar un mensaje explicativo y NO SHALL mostrarse como 0%.

Ninguna derivación SHALL dividir por cero ni producir `NaN`, `Infinity` o un porcentaje fuera de rango cuando su denominador es cero.

#### Scenario: Usuario recién onboardeado

- **WHEN** un usuario sin ningún movimiento abre el dashboard
- **THEN** cada bloque muestra su estado vacío correspondiente
- **AND** ninguna sección rompe ni muestra `NaN`

#### Scenario: Cero y ausencia de dato no se confunden

- **WHEN** el usuario gastó en el mes pero no acreditó ningún ingreso
- **THEN** "Cuánto gastaste" muestra sus montos reales
- **AND** el ritmo muestra su mensaje de indeterminado en lugar de 0%

## REMOVED Requirements

### Requirement: La sección "En qué se fue" muestra el desglose de gastos por categoría con dona y toggle de moneda

**Reason**: El mismo desglose por categoría es la portada del módulo Movimientos, con navegación por mes y drill-down al listado filtrado. Tenerlo también en el dashboard duplica la lectura y alarga la pantalla sin agregar una respuesta nueva.

**Migration**: Ninguna para el usuario: la lectura sigue disponible en Movimientos. El dashboard conserva el consumo de `getMonthCategoryBreakdown`, que es la fuente del devengado que alimenta el tile "Gastaste".

---

### Requirement: La sección "En qué se fue" muestra los créditos por categoría fuera de la dona

**Reason**: Detalle de la sección retirada del dashboard; sin la dona no tiene dónde vivir en esta pantalla.

**Migration**: El tratamiento de créditos por categoría se mantiene en la superficie de Movimientos, gobernado por la capability `spending-by-category`.

---

### Requirement: La leyenda de "¿En qué gasté?" muestra una barra proporcional por categoría

**Reason**: Detalle de la leyenda de la sección retirada del dashboard.

**Migration**: La leyenda con barra proporcional sigue vigente en la superficie de Movimientos.

---

### Requirement: La sección "Balance del mes" muestra el neto del mes con barras de ingresos y gastos

**Reason**: Se reemplaza por "Resumen del mes", que vive dentro de la card de saldo y se agota en dos montos centrados (Entró / Se fué). El neto y las barras apiladas de ingresos/gastos salen de la pantalla: el rediseño mueve la lectura de "cuánto gasté" a la card "Cuánto gastaste", que la responde con más precisión.

**Migration**: Los ingresos y egresos del mes siguen visibles como "Entró" y "Se fué". El detalle por tipo de movimiento se consulta en Movimientos.

---

### Requirement: La fila "Ajustes" de "Balance del mes" marca el monto como sin registrar

**Reason**: Detalle de la sección retirada. "Resumen del mes" no desglosa por tipo de movimiento, así que no tiene fila de ajustes donde aplicar la marca.

**Migration**: Los ajustes siguen afectando el saldo disponible como hasta ahora; su visibilidad como fila propia queda en Movimientos.

---

### Requirement: El dashboard muestra cuánto del gasto del mes se financió en tarjeta

**Reason**: Se reemplaza por la card "Cuánto gastaste", que expresa la misma descomposición con tres montos rotulados en vez de una barra proporcional de dos segmentos, y que deja de ser condicional a que exista consumo de tarjeta.

**Migration**: La aritmética no cambia: lo que la barra llamaba "de caja" y "financiado" son ahora "Pagaste" y "Te queda por pagar", con "Gastaste" como total explícito.

---

### Requirement: El dashboard muestra el neto del Hogar cuando hay actividad compartida (web)

**Reason**: El requirement estaba acotado a web. Se reemplaza por uno equivalente que cubre las dos plataformas, ya que el rediseño incorpora la tira a la app nativa.

**Migration**: El comportamiento en web no cambia; mobile gana la tira que hoy no tiene.
