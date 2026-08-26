# Design: extract-savings-module

Las decisiones de este change son de **arquitectura de información**, no de modelo de plata. El
modelo no se toca: se le da una casa a lo que ya existe, y un borde.

## E1 — La frase que bloqueaba esto era sobre el schema, no sobre la app

`docs/modelo-de-dinero.md` dice *"ahorro e inversión no son dimensiones… por eso nunca fueron dos
módulos"*, y esa frase se venía usando para rechazar una entrada de navegación.

Lee bien lo que dice: **no construyas dos universos de tablas que dupliquen el modelo de plata**.
Mover plata de una caja de ahorro a un FCI no es "pasar de ahorro a inversión": es la misma plata
cambiando de posición, y hay **un** modelo. Eso sigue valiendo entero.

Un lugar en la app donde conviven las dos cosas es **compatible** con esa frase — un solo modelo, un
solo lugar, dos verbos. Lo que la frase prohíbe es lo contrario: dos lugares con dos modelos.

La confusión tiene una consecuencia que conviene dejar escrita: **un documento de modelado no decide
navegación.** Argumenta desde la corrección conceptual, que es otra pregunta.

## E2 — El borde es el entregable, no la pantalla

Una pantalla nueva se puede hacer sin este change: alcanzaría con una ruta. Lo que no se puede hacer
sin él es **tener un límite**.

Hoy el ahorro está cosido al dashboard (una fila en la card), al alta de movimientos (la tira
post-ingreso) y —si la fase 3 seguía como iba— al detalle de cuenta. Cosido así:

- no se puede **ocultar** para quien solo quiere anotar gastos;
- no se puede **poner detrás de un plan**;
- no se puede **apagar** para depurar ni para un rollout parcial.

Deja de ser funcionalidad y pasa a ser estructura. Y no se decide de una: se decide **una fila por
vez**, sin que nadie lo note, hasta que sacarlo es una refactorización.

El criterio operativo que deja este change: **una superficie ajena puede LEER del módulo; no puede
ser su casa.** Una fila que muestra un número está bien. Un formulario que opera, no.

## E3 — El dashboard conserva la lectura y pierde la operatoria

La fila *Guardado* de la card de saldo **se queda**, y no por costumbre: la card tiene una identidad
que cierra —`Tenías + Entró − Se fué − Guardado = Para gastar`— y sacarla rompería la aritmética que
la hace auditable a ojo. La fila **explica el disponible**; ese es su trabajo ahí.

Lo que cambia es a dónde lleva: hoy abre el overlay con el detalle y los formularios; pasa a llevar
**al módulo**. La card explica; el módulo opera.

La **tira post-ingreso** (*"¿guardás una parte?"*) también se queda donde está: vive sobre
`guidance`, aparece después de cargar un ingreso, y su valor es justamente estar **fuera** del
módulo, en el momento en que hay plata nueva. Es una lectura que invita, no una casa.

## E4 — Cuentas no gana nada, y ese es el punto

El detalle de cuenta es una pantalla de **ubicación**. El propio modelo lo dice: *"el detalle de
cuenta es una pantalla de ubicación y la disponibilidad es otro lente"*.

El mock de la fase 3 aplicó esa regla para negarle lugar a «Guardado» —correcto, una reserva no vive
en ninguna cuenta— y la violó dos párrafos después poniendo ahí la acción de hacer un plazo fijo. La
misma pantalla, la misma regla, dos criterios.

Y el argumento de que *"escala sin pestañas: mañana la misma cuenta ofrece comprar dólares o
suscribir un FCI"* estaba escrito como ventaja. Es el defecto: **una lista de productos financieros
colgando de cada cuenta es un home banking**, que es exactamente lo que Grana no es.

Cuando exista el plazo fijo, la cuenta lo va a **mostrar** —tiene banco, es ubicación— y podrá tener
un atajo contextual. No va a ser su casa.

## E5 — Por moneda, siempre, y sin sumarlas

El módulo opera por moneda. ARS y USD nunca se suman ni se convierten, acá tampoco.

Lo que este change **no** decide es si el corte es un selector, dos tabs o dos bloques apilados. La
fase 2 ya aprendió algo pertinente (D16): **la moneda es el eje de la OPERACIÓN, no el de la
LECTURA** — partir el detalle en dos pantallas obliga a recordar un número mientras se mira el otro.
Eso se resuelve al dibujar, con las dos versiones al lado.

## E6 — No se reescribe nada: se recompone

Se reutiliza tal cual todo lo que ya está bien:

- `availability_reserve` y `savings_purpose_allocation`, con sus invariantes y su trigger;
- `write_reserve` y las validaciones de tope y piso;
- los formularios de guardar, volver a usar, destinar y quitar destino;
- `Drawer` / `BottomSheet`, `FormSheetBody`, `MoneyAmountInput`.

Lo que cambia es **dónde se montan**. Si este change termina tocando SQL, algo se entendió mal.

## E7 — El origen preseleccionado al volver a usar: lo que hay, y lo que falta decidir

La regla pedida es: *sin prioridad silenciosa* — con un solo grupo con saldo va directo al monto, con
varios se pregunta de dónde sale, y desde un propósito se hereda.

**Lo construido cumple la forma y hay que mirar el default.** Con varios grupos con saldo, el
formulario muestra los chips *De dónde sale* con todos los orígenes que tienen plata en esa moneda, y
**preselecciona «Sin destino»** si tiene saldo. Con uno solo no hay chips. Desde un propósito, el
origen viene heredado y no se pregunta.

Así que el origen **se pregunta, en el mismo formulario** (no en una pantalla aparte, que fue lo que
la fase 2 borró). Lo que queda por decidir es más chico: **si preseleccionar cuenta como elegir.**

- A favor de dejarlo: el chip está a la vista, rotulado, y cambiarlo es un tap. Sin preselección el
  CTA arranca deshabilitado y el caso más común paga un tap de más.
- En contra: quien tipea rápido y confirma toma de «Sin destino» sin haber elegido nada.

No se resuelve discutiendo. Se mira en el QA del módulo, con las dos versiones.

## E8 — Un módulo no se estrena mostrando lo que no hace

Nada de CTAs deshabilitados, placeholders de inversiones ni un bloque «A resguardo» apagado
esperando la fase 3.

Un usuario que entra y ve tres cosas grises que no funcionan **aprende a ignorar la pantalla**, y esa
lección no se revierte cuando la funcionalidad llega. El módulo se estrena con lo que hace hoy —
guardar y decir para qué— y crece cuando hay algo que mostrar.

Es la misma razón por la que la fase 2 sacó la sección «Para qué» heredada que no decidía nada: **una
sección que no hace nada es una sección de más**, y una que además promete es peor.

## E9 — El nombre

**«Ahorro e inversión»**, aunque hoy solo haga ahorro.

*«Invertir»* solo deja afuera comprar dólares, que es el acto de protección más común del país — el
modelo ya lo tenía anotado. *«Mi plata»* nombra lo que mirás, no lo que hacés, y este módulo existe
para hacer. *«Ahorro»* solo se queda corto el día que entre el plazo fijo, y renombrar un destino de
navegación cuesta más que nombrarlo bien la primera vez.

Que el nombre prometa un poco más de lo que hay hoy es aceptable **mientras la pantalla no lo
prometa** (E8).
