# Decir cómo termina una regla, y mostrarlo después

## Why

Una regla llamada «Plan de pago - 11 cuotas» quedó con un límite de **1 vencimiento**. Ya lo gastó, así que no va a recordar las diez cuotas que faltan —unos $1.155.000— y no hay ningún aviso. Su ficha la muestra **mensual y sin fecha de fin**, o sea afirma que se repite para siempre, y el listado la muestra como **Activa**. La única forma de descubrirlo fue consultar la base a mano.

El límite existe, decide cuándo la regla deja de recordar, y hoy es invisible en las tres pantallas que la muestran. Peor: se carga escondido detrás de una pregunta que habla de otra cosa.

## What Changes

**Una sola pregunta al crear: «¿Cómo termina?»**, con tres respuestas — *sin límite*, *en una fecha*, *después de N vencimientos*. Hoy el límite vive adentro del bloque de «Tiene fecha de fin», así que para ponerlo hay que prender un interruptor que dice otra cosa; y si después se apaga, el número queda guardado igual, invisible. Una pregunta con tres respuestas elimina esa trampa en vez de taparla.

**La pregunta aparece en todos los caminos**, en web y en nativo: al crear una recurrencia, al marcar «Hacer recurrente» sobre un movimiento, y al editar una regla que ya existe. Hoy el camino desde un movimiento **no ofrece el límite en ninguna plataforma**, aunque el spec ya lo promete desde siempre; y una regla creada con límite no se puede editar ni quitárselo.

**La ficha dice en qué punto está la regla**: «1 de 11 vencimientos», «10 restantes» y «Último vencimiento previsto: 10 de julio de 2027». Esa fecha se calcula en el momento, no se guarda: si la regla se pausa o se le corrige el día, cambia sola.

**Una regla que agotó su límite se muestra como «Finalizada»**, con «Finalizada · 1 por revisar» cuando todavía queda un vencimiento sin resolver. Vale para todas las reglas, **incluidas las que ya existen** — si sólo valiera para las nuevas, dos reglas idénticas mostrarían estados distintos según cuándo se crearon, y el problema de hoy seguiría escondido. Ampliar el límite devuelve la regla a «Activa»; quitarlo la vuelve indefinida.

**El campo deja de cambiar solo.** En web es un campo numérico que la rueda del mouse modifica en silencio —el mismo mecanismo que este repo ya prohibió para los importes—. El formulario nativo ya lo resolvió bien; web se alinea con él.

### Lo que este cambio NO hace

- **No corrige la regla real del usuario.** Eso lo hace él desde la app, una vez que el límite sea editable. No se borra y recrea: partiría el plan de pago en dos historiales.
- **No toca `recurrences.status`.** «Finalizada» es un estado que se muestra, no uno que se guarda. La columna sigue diciendo activa/pausada/eliminada.
- **No cambia el corte por límite en la generación.** Ese corte ya funcionaba; lo que faltaba era decirlo en pantalla.
  - **Corregido durante la QA:** sí cambió qué días excluye una pausa. Una pausa abierta el mismo día en que caía un vencimiento se tragaba esa posición, y con una cuota menos contada la regla seguía generando — cuatro cuotas en un plan de tres. Desde `0071`, la pausa afecta los días **posteriores** a su apertura. Es un cambio real en cuánto genera una regla, y por eso se nombra acá y no sólo en las tareas.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `transactions`: cuatro requirements de reglas recurrentes cambian.
  - **El usuario puede crear una regla recurrente directamente, sin movimiento de origen** — la condición de fin pasa a ser una sola pregunta visible, nunca un campo escondido detrás de otra.
  - **El usuario puede crear una regla recurrente al registrar un movimiento** — el requirement ya dice que la condición de fin puede expresarse como `end_date` **y/o** `max_occurrences`; la implementación nunca ofreció el segundo. Se agregan los escenarios que lo hacen verificable.
  - **El detalle de una regla recurrente usa vista read-only + edición en drawer** — la ficha muestra el límite y lo que se deriva de él; el cajón permite cambiarlo y quitarlo.
  - **El usuario puede gestionar, pausar y eliminar reglas recurrentes** — se define el estado derivado «Finalizada» y cuándo se muestra.

## Impact

**Lo que ve el usuario**: el alta de recurrencias cambia de forma en las dos plataformas; la ficha de una regla gana información que hoy no existe; algunas reglas que hoy figuran como activas van a pasar a mostrarse como finalizadas —que es lo que siempre fueron.

**Código**: los tres formularios de alta y edición en web y nativo, la ficha de detalle, el listado de recurrencias, y el cálculo compartido que responde «¿le queda algo a esta regla?».

**Base de datos**: **dos migraciones, sin migración de datos**. Ninguna fila se reescribe: el límite ya se guarda en `max_occurrences` y las piezas para contarlo bien existen desde la migración `0068`. `0070` agrega una función para pedir ese conteo de muchas reglas a la vez, porque el listado lo necesita y hoy sólo se puede pedir de a una. `0071` apareció después, en la QA: corrige cómo se lee una pausa para que el día en que se pausa siga perteneciendo al calendario.

**Un dato que falta antes de empezar**: el modelo permite que una regla lleve fecha de fin **y** límite al mismo tiempo. Hay que mirar la base para saber si alguna las tiene, para redactar bien lo que se le dice a quien edite una de ellas. El camino se construye igual: mientras la base lo permita, el formulario tiene que saber recibir las dos — prohibirlo sería otro cambio, porque obliga a decidir qué pasa con las filas que ya las tienen.

**Riesgo conocido**: contar «1 de 11» con las filas de la tabla de instancias da un número equivocado —una regla sembrada por un movimiento no tiene fila para su primera ocurrencia—. Ese error ya costó dos rondas de revisión en #121 y la solución correcta está escrita: `recurrence_positions_spent`.
