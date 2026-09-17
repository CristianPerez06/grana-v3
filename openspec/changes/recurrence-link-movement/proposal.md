## Why

El alquiler vence el 23 y el usuario lo paga el 3. Entra a la app y **no hay ningún
botón**. La regla aparece en el hub con «Próximo: 23 de septiembre» y nada más —la
tarjeta de próximas dice literalmente «Solo informativo»—. Sus dos opciones son esperar
veinte días o cargar el gasto a mano.

Y cargarlo a mano es peor que no hacer nada: ese gasto queda suelto, sin vínculo con la
regla. El 23 la app le propone el alquiler igual. Ahí o lo confirma —y el alquiler queda
cargado dos veces— o lo omite, y pierde el rastro de que sí lo pagó.

Son los arreglos **C** y **U4** de la **Tanda 1** del relevamiento
(`docs/qa/relevamiento-recurrencias-2026-09-03.md`), donde C se describe como «el arreglo
con mejor relación valor/esfuerzo de toda la lista». Van juntos en un solo change porque
son el mismo problema visto de dos lados: sin poder vincular lo ya cargado, «registrar
ahora» empuja al usuario justo al duplicado que vincular evita.

La razón técnica de que hoy no haya botón es que **no hay nada que apretar**: el generador
sólo materializa ocurrencias cuya fecha ya llegó, así que el 3 de septiembre el
vencimiento del 23 no existe como fila, y registrar un pago exige que exista.

## What Changes

**«Ya lo pagué», antes de que venza.** En la fila de una regla cuyo próximo vencimiento
todavía no llegó, una acción nueva. Abre el mismo formulario de registro de siempre, con
la fecha en hoy y editable. Se registra el gasto, el vencimiento queda saldado y cuando
llega el 23 la app no lo vuelve a proponer. **El próximo sigue siendo el 23 de octubre**:
pagar antes no mueve el calendario.

**«Ya lo tengo cargado».** La otra salida, en la misma fila: elegir un movimiento que ya
está en el historial y decir que ése es el alquiler de septiembre. **No se crea ningún
movimiento nuevo.** El vencimiento queda resuelto y el movimiento deja de estar suelto.

La lista de candidatos cubre **desde el vencimiento anterior hasta el siguiente** —para
una regla mensual, alrededor de un mes para cada lado—, de modo que un pago hecho veinte
días antes entra. **El monto y la cuenta ordenan, no excluyen**: que el alquiler haya
subido no esconde el movimiento. Y **«Ampliar la búsqueda» está siempre disponible**,
incluso cuando la lista ya trae candidatos.

**«Desvincular».** Si el movimiento elegido era el equivocado, el vínculo se suelta: el
movimiento vuelve a estar suelto tal cual estaba —no se borra, el usuario lo cargó— y el
vencimiento vuelve a «por revisar».

**El historial distingue las dos cosas.** Un movimiento que existía antes se rotula
**«vinculado a esta recurrencia»**, no «originado en»: no lo originó la regla.

**Cuando la regla es compartida**, vincular hace algo más que unir dos cosas, y el change
lo trata explícitamente: un movimiento con un reparto compatible se vincula directo; uno
**personal** se convierte a compartido con el reparto de la regla **pidiendo confirmación
explícita**, porque eso mueve la deuda del hogar; y uno que ya es compartido **con otro
hogar u otro reparto no se ofrece como candidato**. Desvincular revierte esa conversión
cuando ocurrió.

**El límite de vencimientos cuenta cada posición una sola vez.** Una posición se consume
**cuando llega su fecha o cuando se resuelve antes, lo que pase primero**. Sin esto, pagar
septiembre el día 3 dejaría la regla mostrando «0 de 3» con un vencimiento ya resuelto, y
el avance atrasado hasta un mes entero.

### Decisión abierta: el guard de liquidaciones

**Hay un caso en que la base se niega a desvincular, y la salida que el spec promete no
funciona.** Cuando la conversión a compartido tiene que revertirse pero existe una
liquidación del hogar posterior al gasto, un trigger la rechaza (`GRN01`). El spec de
`shared` dice que la aplicación debe indicar «revertir esa liquidación primero».

Eso **no destraba nada**. Los guards de `0049` no filtran por estado de la liquidación, y
`reverse_settlement` (`0044`) conserva la original marcada `reversed` **y agrega una fila
`contra` fechada hoy**. Después de revertir hay *dos* filas que bloquean, una de ellas
posterior a cualquier gasto del pasado. El usuario queda trabado para siempre, y peor que
antes de revertir.

Es un defecto **pre-existente** del módulo Compartido: ya afecta al toggle «Compartir →
off» hoy, sin que exista nada de este change. Hay dos caminos y **la elección es del
usuario**:

- **Acotado (recomendado).** Este change no toca el guard. Desvincular nunca deja sin
  salida: si la base se niega, **el vínculo se suelta igual y el gasto queda compartido**,
  diciéndolo con todas las letras. El vencimiento vuelve a «por revisar», que es lo que el
  usuario fue a buscar. Se defiende solo: la plata efectivamente cambió de manos, y
  revertir el reparto sería lo que mentiría. Esta rama **hay que construirla igual**,
  porque la liquidación puede ocurrir *después* de haber vinculado y ninguna validación
  previa puede prevenir eso.
- **Ampliado.** Además, arreglar el guard para que una liquidación `reversed` y su `contra`
  dejen de bloquear, y corregir el spec de `shared`. Es el arreglo de fondo, toca la
  integridad de la cuenta corriente y **agrega `shared` a las capabilities modificadas**.

Verificado leyendo `0044`, `0048`, `0049` y el spec de `shared`; **no probado contra la
base online**.

### Lo que este cambio NO hace

- **No deshace un pago que la app creó** (#104). Su significado ya está decidido
  (decisiones 14 y 15 de `fix-recurrence-backlog`): deshacer devuelve la ocurrencia a
  revisión, y omitir es otra operación. Lo que falta es la implementación, que tiene su
  propio change (`recurrence-undo`). Consecuencia honesta: la acción «Ya lo pagué» crea un
  movimiento, y ese cae bajo #104. No lo empeora —registrar ya tiene ese hueco hoy—, pero
  lo vuelve alcanzable veinte días antes.
- **No arregla #157** (el vencimiento de hoy contado como consumido y anunciado como
  próximo a la vez). Sólo se dispara cuando la ocurrencia **no** está cubierta, así que
  nada de este change depende de cómo se resuelva.
- **No agrega una entrada desde la ficha del movimiento.** Se vincula desde el
  vencimiento, que es donde el duplicado está por fabricarse y donde la app tiene contexto
  para ordenar candidatos. Desde el movimiento habría que buscar entre todas las reglas.
- **No cambia el calendario de ninguna regla.** Pagar antes no adelanta el próximo
  vencimiento ni agrega o saca posiciones de un plan.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `transactions`: los requirements de recurrencias que definen cómo se resuelve una
  ocurrencia.
  - **Registrar el pago** se modifica: hoy exige que la ocurrencia exista, y pasa a
    admitir que se resuelva un vencimiento **cuya fecha todavía no llegó**, materializando
    su identidad en el acto.
  - Se **agrega** el requirement de **vincular** un movimiento existente y el de
    **desvincular**, con el rótulo que los distingue de lo que la regla originó.
  - El requirement del **límite** se modifica: una posición se consume al llegar su fecha
    **o** al resolverse antes, una sola vez.
- `shared-recurrences`: se **agrega** el requirement de vincular a una regla compartida —
  las tres ramas (reparto compatible, conversión con confirmación, exclusión) y la
  reversión al desvincular, incluida la salida cuando la base la rechaza.
- `shared`: **sólo si se elige el camino ampliado** de la decisión abierta.

## Impact

- **Migración nueva** (número elegido contra `main`, no contra el working tree). Dos
  funciones de Postgres `SECURITY INVOKER`: convertir-a-compartido + vincular, y
  revertir + desvincular. La decisión 22 de `fix-recurrence-backlog` exige que sean una
  transacción de base y no rollback compensatorio, porque la compensación también puede
  fallar y dejar la deuda del hogar movida por una operación que el usuario no aprobó.
- `packages/recurrences` — la selección de candidatos, las mutations de vincular y
  desvincular, y el modelo de vista de la fila. Una sola implementación para las dos apps.
- `packages/money-logic` — el conteo de posiciones consumidas, más la función SQL espejo
  que la migración reemplaza. La paridad entre las dos se pinta con un test, como ya se
  hace con `calculateTransactionSums`.
- `apps/web` — el hub de recurrencias y el detalle de la regla.
- `apps/mobile` — el hub nativo y el feed de Movimientos.
- `packages/i18n-messages/src/{es,en}.json` — las claves de las tres acciones, la lista de
  candidatos, el rótulo «vinculado» y los mensajes del caso compartido.
- **Las dos superficies mobile** —web a ancho de teléfono y app nativa— en el mismo commit.
