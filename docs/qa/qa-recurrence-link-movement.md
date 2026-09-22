# QA — `recurrence-link-movement`

> **Este guion se está corriendo.** `0072` ya está aplicada en la base online y los bloques A, B, C y
> parte de D se corrieron en web; el estado por bloque, los hallazgos y lo que falta están en
> [Resultado](#resultado), al final. Antes de seguir hay que aplicar `0073` (ver 0.1b).
>
> `pnpm verify` corre en verde (tests del monorepo, lint y typecheck de web y nativo, build, checks
> de salud y el validador de OpenSpec). Nada de eso dibuja una pantalla: los tests nuevos corren SQL
> en un Postgres embebido (PGlite) y TypeScript compara tipos. Todo lo de acá abajo se mira corriendo
> la app.
>
> Lo que **ya está probado y no hace falta re-verificar a mano**: el conteo de posiciones
> (SQL↔TS, 10 casos), las guardas de liquidación (19 casos, incluidos los dos defectos que reparan y
> el caso cruzado bajo RLS), y los tres RPC con el circuito completo vincular → convertir → liquidar
> → revertir/cancelar → desvincular (28 casos). Lo que falta es que **las superficies dibujen y se
> comporten**, y que todo eso funcione contra la base online y no contra un doble.

## 0 · Prerrequisitos — sin esto no arranca nada

| | Qué | Cómo se sabe que salió bien |
|---|---|---|
| 0.1 | Aplicar `supabase/migrations/0072_recurrence_link_movement.sql` en el SQL Editor | Corre entera sin error. Tiene un self-check antes del `COMMIT`: si algo falta, aborta y dice qué. **Ya aplicada** |
| 0.1b | Aplicar `supabase/migrations/0073_settlement_guards_see_the_whole_truth.sql` | Termina en `✓ 0073 settlement guards see the whole truth`. Sin ella, las guardas de liquidación no ven las liquidaciones registradas por el otro miembro y **D6 pasa de largo** (es el defecto que encontró este QA) |
| 0.2 | ~~Regenerar los tipos~~ — **no aplica**: la CLI de Supabase no se usa en este proyecto (ver `AGENTS.md`). Las firmas de `packages/supabase/src/types.ts` están escritas a mano y se compararon una por una contra el SQL de 0072 y 0073 —los tres RPC del change más `settlements_blocking_movement`—: nombres y orden de los parámetros, cuáles tienen default, y la forma del retorno | Esa comparación, ya hecha, más `pnpm typecheck` y `pnpm typecheck:mobile` en verde. **Cubre las firmas de este change, no el esquema entero**: el typecheck no compara este archivo contra la base |
| 0.3 | Tener a mano una regla **mensual activa** cuyo próximo vencimiento **todavía no llegó** | El hub la muestra con «Próximo: …» |

**Si 0.1 no corrió, todo lo demás falla al primer toque** y no significa nada: los tres RPC no
existen. **Si no corrió 0.1b**, el resto anda pero el bloque D miente: las guardas siguen ciegas a
lo que registró el otro miembro y D6 pasa cuando debería fallar.

---

## A · «Ya lo pagué», antes de que venza

Es el síntoma original: el alquiler vence el 23 y lo pagás el 3.

| | Qué hacer | Qué tiene que pasar |
|---|---|---|
| A1 | Abrir el hub de recurrencias | La fila del vencimiento futuro ahora ofrece **«Ya lo pagué»** y **«Ya lo tengo cargado»**, los dos en una sola fila. Antes no ofrecía nada. Los botones se explican solos: no hay nota encima que los describa |
| A2 | Tocar «Ya lo pagué» | **Se abre un formulario**, no se crea nada todavía: fecha de pago en **hoy** y editable, importe y cuenta de la regla, editables. El botón de confirmar queda **deshabilitado hasta que carguen las cuentas** |
| A2b | Cambiar el importe y confirmar | El movimiento se crea con el importe que pusiste y **el importe de la regla no cambia** |
| A2c | Elegir una cuenta cuyo saldo no alcanza | Aparece la advertencia de saldo negativo **antes** de confirmar. No bloquea |
| A2d | Confirmar | Se crea el movimiento con la fecha de pago elegida, y el saldo de esa cuenta baja |
| A2e | Lo mismo desde **el detalle de la regla** | Las dos acciones también están ahí, con el mismo formulario |
| A3 | Volver al hub | **El próximo vencimiento NO se movió.** Si la regla vencía el 23 de octubre, sigue siendo el 23 de octubre — no «un mes desde hoy» |
| A4 | Mirar «Vencimientos por revisar» | **No aparece nada nuevo de esa regla.** Este es el caso trampa: una ocurrencia pendiente con fecha futura le pediría al usuario algo que acaba de pagar |
| A5 | Correr el check SQL de abajo | La ocurrencia existe con `status='confirmed'`, `resolution_kind='created'` y el `due_date` **original** (el 23), no la fecha de pago |

**Falla si**: el próximo vencimiento se corre, o si aparece un pendiente futuro aunque sea un instante.

---

## B · «Ya lo tengo cargado»

| | Qué hacer | Qué tiene que pasar |
|---|---|---|
| B0 | Correr `qa-recurrence-link-movement-bloque-b.sql` (misma carpeta) | Dice con qué regla conviene probar y **con qué fecha, cuenta, moneda e importe** cargar el movimiento. La ventana sale del calendario real de la regla, así que «20 días antes» sólo entra en una mensual |
| B1 | Cargar ese gasto DESDE LA APP, con los datos que dio B0 | — |
| B2 | Tocar «Ya lo tengo cargado» | El gasto aparece en la lista. **Veinte días antes tiene que entrar**: es el caso que motiva todo el change |
| B3 | Cargar otro gasto con un importe **muy distinto** (el alquiler aumentó) | **También aparece.** El monto ordena, no filtra. Debajo dice en qué difiere, como información — no como advertencia |
| B4 | Mirar el pie de la lista | **«Ampliar la búsqueda» está visible aunque la lista ya tenga candidatos**, no sólo cuando queda vacía |
| B5 | Elegir uno y vincular | **No se crea ningún movimiento nuevo.** El saldo no se mueve ni un peso: ese gasto ya estaba contado |
| B6 | Abrir la ficha de ese movimiento | Dice **«Vinculado a esta recurrencia»**, no «Generado por una regla recurrente» |
| B7 | Abrir los candidatos de **otro** vencimiento de la misma regla | Ese movimiento **ya no aparece**: uno resuelve un solo vencimiento |

---

## C · Desvincular

| | Qué hacer | Qué tiene que pasar |
|---|---|---|
| C1 | En el detalle de la regla, sobre la ocurrencia vinculada en B, tocar **«Desvincular»** | El **movimiento sigue existiendo** y vuelve a estar suelto. No se borra: la recurrencia no lo creó |
| C2 | Mirar la ocurrencia | Volvió a **«por revisar»**, conservando su vencimiento. **No quedó omitida** |
| C3 | Buscar «Desvincular» sobre la ocurrencia de **A2d** (la que la app creó) | **No se ofrece.** Deshacer eso significaría borrar un gasto real, que es otra operación (#104) |
| C4 | Volver a vincular otro movimiento al mismo vencimiento | Se resuelve, y **la regla no gana un vencimiento extra** |

---

## D · Compartido — la parte cara

Necesita un hogar de dos miembros y una regla de gasto compartida.

| | Qué hacer | Qué tiene que pasar |
|---|---|---|
| D1 | Vincular un movimiento **personal** a la regla compartida | **Pide confirmación explícita** y explica que el gasto va a pasar a ser compartido |
| D2 | Cancelar esa confirmación | **Nada cambió**: el movimiento sigue personal y el vencimiento sin resolver |
| D3 | Repetir y confirmar | El gasto queda compartido con el reparto de la regla, y **la deuda del hogar se mueve** |
| D4 | Desvincular | Vuelve a **personal**, sin reparto, y **la deuda vuelve a donde estaba** |
| D5 | Tener un movimiento compartido con **otro reparto** dentro de la ventana | **No aparece** entre los candidatos |
| D6 | Volver a hacer D3. Después registrar una **liquidación completada** posterior al gasto. Intentar desvincular | **Falla y NO cambia nada**: el gasto sigue compartido **y el vínculo sigue puesto**. El mensaje dice que hay que **revertir** esa liquidación. Vale **también si la liquidación la registró la otra persona** — es donde falló la primera vuelta (ver Resultado) |
| D7 | Revertir esa liquidación e intentar de nuevo | **Ahora sí desvincula.** Este es el arreglo de fondo: antes revertir no destrababa nada |
| D8 | Repetir D6 con una liquidación **pendiente de asignación registrada por vos** | El mensaje dice **cancelar**, no revertir |
| D9 | Lo mismo, pero registrada por **la otra persona** | El mensaje dice que **la tiene que cancelar quien la registró**, y no te pide a vos que hagas nada |

**Falla si** en D6 el vínculo se suelta y el gasto queda compartido: eso es el deshacer parcial que el
change prohíbe. **Falla si** en D8 el mensaje dice «revertir»: sobre una pendiente esa operación no
existe.

---

## E · El límite

Con una regla de `max_occurrences = 3` cuyo primer vencimiento no llegó.

| | Qué hacer | Qué muestra el detalle |
|---|---|---|
| E1 | Abrir el detalle | **0 de 3** |
| E2a | Resolver el primero con **«Ya lo pagué»** | **1 de 3**, quedan los otros dos |
| E2b | Resolver uno con **«Ya lo tengo cargado»** | **2 de 3** |
| E3 | Desvincular el de E2b, **antes** de que llegue esa fecha | Vuelve a **1 de 3** |
| E4 | Desvincular **después** de que la fecha pasó | Sigue contando — la fecha ya transcurrió |

En todos los casos el plan conserva **tres** posiciones. **Falla si** aparece una cuarta.

**E2 se parte en dos a propósito.** El guion decía «registrar por anticipado» y después «desvincular»,
y esas dos cosas no se encadenan: desvincular se ofrece SÓLO sobre lo que el usuario vinculó
(C3), porque deshacer un pago que la recurrencia creó sería borrar un movimiento real. Así que la
posición se gasta por los dos caminos (E2a y E2b) y se devuelve sólo por el que se puede deshacer.

**E4 no se puede correr en una sesión** sin esperar a que la fecha llegue: resolver por anticipado
exige que el vencimiento sea futuro, y el caso pide desvincularlo cuando ya es pasado. Lo cubren
los diez casos SQL del conteo de posiciones, que fijan exactamente esa regla: una posición se gasta
al llegar su fecha O al resolverse antes, **una sola vez**.

---

## F · Las dos superficies mobile

`AGENTS.md` cuenta dos: **web a ancho de teléfono** y **la app nativa**. Repetir **A, B y C** en las dos.

| | Qué mirar |
|---|---|
| F1 | Los dos botones entran en la fila sin romper el monto ni el nombre de la regla — en el hub web, en el **hub nativo** (debajo de cada regla activa) y en los dos detalles |
| F1b | En nativo, «Ya lo pagué» abre una **hoja con importe, cuenta y fecha** — los mismos campos que web. La divergencia que el spec fijaba (registrar directo, sin formulario) **se eliminó**: la encontró esta misma corrida, ver bloque G |
| F2 | En nativo, la hoja de candidatos **scrollea** — si la lista es larga y no se mueve, el tope de altura no está haciendo efecto |
| F3 | El rótulo «Vinculado» aparece en la ficha del movimiento **también en nativo** (antes no mostraba ningún vínculo) |
| F4 | Los mensajes de error son los mismos textos en las dos plataformas |

---

## G · Nativo, segunda vuelta

Lo de F se corrió en el teléfono **antes** de los tres últimos commits nativos, así que ese código
tiene tests pero no pasó por el aparato. Esto es el repaso de **lo que cambió después**, nada más.

| | Qué hacer | Qué tiene que pasar |
|---|---|---|
| G1 | En el hub nativo, sobre una regla con vencimiento futuro, tocar **«Ya lo pagué»** | Se abre una **hoja**, no registra de una. Viene con el **importe de la regla**, **su cuenta** y la fecha de **hoy** |
| G2 | Cambiar los tres: otro importe, otra cuenta, otra fecha. Confirmar | El movimiento creado queda con **lo que escribiste**. La **regla no cambia** (sigue con su importe y su cuenta) y **la próxima fecha no se mueve** |
| G3 | Volver a abrir la hoja y elegir una cuenta cuyo saldo no alcance | Aparece el **aviso de saldo negativo** debajo de la cuenta, y **deja confirmar igual** — avisa, no impide |
| G4 | Abrir la hoja, escribir cualquier cosa y tocar **Cancelar**. Volver a abrirla | Cierra sin registrar nada, y **vuelve limpia** (con los valores de la regla otra vez) |
| G5 | Después de confirmar G2 | Aparece el **acuse** debajo de la regla y el vencimiento **sale de «por revisar»** |
| G6 | Entrar al detalle de una regla con un vencimiento **vinculado** | **«Desvincular» es un chip chico** pegado a la derecha, **sin ocupar una fila propia**. En cada fila del historial, **estado e importe van en un solo renglón** y el **importe al final**, alineado con los de arriba y abajo |
| G7 | En el detalle de una regla con tope de vencimientos, mirar el recuadro del límite | Dice **«Restantes: 1»**, no «Restantes: 1 restantes» |
| G8 | Detalle de una regla **compartida** | La línea de abajo del título dice **«Gasto · Mensual · Compartido»** |
| G9 | Crear una regla nueva en nativo: confirmar **sin categoría** para que salte el error, y después **elegir la categoría** | El aviso **se va al elegirla**, sin tener que volver a confirmar. Lo mismo al corregir el importe o el destino de una transferencia |

---

## Check SQL

`qa-recurrence-link-movement-check.sql`, en esta misma carpeta. Contesta lo que la pantalla no
muestra: con qué identidad quedó cada ocurrencia, si alguna quedó pendiente con fecha futura, y si
algún movimiento resuelve más de un vencimiento.

## Resultado

Al 22-09. Lo que no figura acá **no se corrió todavía**.

| Bloque | Estado |
|---|---|
| 0 | `0072` aplicada. Falló en el primer intento por una comparación de enum contra texto; se corrigió en la migración y volvió a correr entera. **`0073` aplicada** (21-09), sin errores. **`0074` PENDIENTE DE APLICAR** (22-09): repara la rama de vincular que dejaba la foto de la regla sobre una ocurrencia que el generador ya había creado — el historial mostraba el importe de la regla sobre un vencimiento resuelto con un movimiento de otro importe. La encontró una revisión externa; el test la reproduce sin la migración |
| A | A1–A4 corridos en web |
| B | B0–B7 corridos en web, con el script de lectura de la misma carpeta |
| C | C1–C3 corridos en web |
| D | **Completo: D1–D9 en verde.** **D6 encontró un defecto** (abajo), reparado por `0073` y re-corrido contra la base con la migración aplicada: la guarda bloqueó, el mensaje pidió revertir, y revertida la liquidación la desvinculación procedió. **D9** mostró el mensaje de «tiene que cancelarla ella» sobre una liquidación pendiente del otro miembro —el caso que más depende de `0073`, porque esa liquidación el usuario no la ve—. **D8** se corrió desde la otra cuenta —la app sólo deja registrar un pago a quien debe— con una regla compartida propia: dijo «cancelala», no «revertila», y al cancelar la liquidación la desvinculación procedió. Los tres mensajes quedaron verificados contra la base: revertir, cancelala vos, tiene que cancelarla ella |
| E | E1, E2a, E2b y E3 corridos y en verde. **E2a encontró un defecto** (abajo). E4 no se corre en una sesión: pide desvincular un vencimiento cuya fecha ya pasó, y resolver por anticipado exige que sea futuro |
| F | **Web a ancho de teléfono (360px): completo.** F1, F1b y F3 en verde a la primera. **F2 encontró un defecto** —la hoja de candidatos no scrolleaba— reparado. **F4 aceptado por inspección**, ver abajo. **Nativo corrido (22-09): N1–N6 en verde**, con tres defectos encontrados y reparados —«Ya lo pagué» registraba sin preguntar nada (F1b, divergencia eliminada), los chips de frecuencia no entraban, y las hojas de reglas sin historial no scrolleaban—. **Lo reparado ahí no volvió al teléfono: ver bloque G** |
| G | **Completo: G1–G9 en verde**, en el iPhone 16 Pro. «Ya lo pagué» abre la hoja con los valores de la regla, lo que el usuario edita queda en el movimiento y la regla no se mueve, el aviso de saldo negativo aparece y deja confirmar igual, cancelar no deja resto, el chip «Desvincular» no ocupa fila propia, «Restantes: 1» no repite la palabra, el detalle de una regla compartida lo dice, y el aviso de categoría se va al elegirla. **Encontró un defecto** (abajo) |
| Check SQL | **Corrido (22-09), sin hallazgos nuevos.** Cada ocurrencia quedó con la identidad que le corresponde (`created` las que crearon el movimiento, `linked` las señaladas), ningún movimiento resuelve más de un vencimiento, y las guardas contestan que no hay liquidación viva bloqueando. Las tres pendientes con fecha futura que aparecieron son las que este change hace posibles —una regla resuelta por anticipado deja el resto del calendario materializado— salvo una fila de «Prueba fecha futura», residuo de una revisión temprana del change: se borra borrando esa regla |

**El defecto de D6.** Con una liquidación completada posterior al gasto, desvincular **funcionó** en
vez de ser rechazado. Las guardas se evaluaban con los permisos de quien dispara la operación, y la
**fecha** de una liquidación vive en el movimiento del pagador, que es personal: cuando la registró
el otro miembro, la guarda no la encontraba y dejaba pasar todo. Sólo protegía contra uno mismo. Lo
repara `0073`, que además hace que el **mensaje** consulte con los mismos permisos —si no, aconseja
«revertir» sobre una pendiente ajena, que ni corresponde al estado ni puede hacerlo quien lo lee—.
Los tests de guardas ahora modelan RLS y el caso cruzado falla sin la migración.

**TRES DEFECTOS DE LA MISMA RAÍZ, encontrados los tres a mano.** Este change hizo que existan
ocurrencias **futuras** —resolver por anticipado las materializa hoy— y varios cálculos daban por
sentado que «existe ⇒ ya pasó». Ninguno se habría escrito como test de antemano, porque el supuesto
era invisible hasta romperlo:

1. **El plan se acortaba** al resolver por anticipado: la posición gastada se contaba dos veces, una
   en el conteo y otra en el caminante que proyecta el final.
2. **El final se adelantaba** al resolver fuera de orden: la proyección contestaba «lo último que
   queda por venir» en vez de «dónde termina el plan».
3. **La regla se declaraba «Finalizada»** teniendo un vencimiento por venir sin resolver: el estado
   pregunta si el calendario va a PRODUCIR algo nuevo, y con todas las posiciones ya materializadas
   la respuesta era no.

Los tres reparados, cada uno con un test sobre la regla y otro sobre la lectura que se despacha
contra un Postgres real, y los tres escritos en el spec con su escenario. **Lección para el próximo
change que mueva CUÁNDO existe un dato: hay que barrer quién lo estaba leyendo.**

**El defecto de F2: la hoja de candidatos no scrolleaba a ancho de teléfono.** El mismo `Drawer` es
panel lateral en escritorio —alto fijo— y hoja inferior abajo de `md`, donde el alto lo fija el
contenido con un tope. El cuerpo de la hoja pedía `h-full`, que contra un padre de altura automática
no vale nada: crecía con la lista, el panel la recortaba y la región de scroll nunca recibía altura.
En escritorio funcionaba, y por eso nadie lo había visto. El primitivo advierte en su comentario que
espera un cuerpo `min-h-0 flex-1`; de los veinte consumidores, éste era el único que no lo cumplía.
Reparado, con un test de código que falla si vuelve el patrón —red gruesa a propósito: el defecto
sólo aparece con un alto de pantalla real y contenido que lo desborda, que es lo que un render sin
navegador no tiene—.

**F4 aceptado por inspección, sin correrlo.** Verlo pedía volver a armar una liquidación que
bloqueara la desvinculación, y el mensaje de rechazo ya se vio funcionando en pantalla ancha: es un
cartel de ancho completo en su propia línea (`basis-full`), y lo único que cambia a 360px es cuántos
renglones usa el texto. Queda dicho acá para que nadie lo lea como corrido.

**El defecto de E2a.** Una regla de tres vencimientos decía «Último vencimiento previsto: 20 de
diciembre» y, al resolver el primero por anticipado, pasó a decir **20 de noviembre** —contradiciendo
a la fila de al lado, que seguía diciendo «restan 2»—. Resolver antes de la fecha es el único caso
donde una posición está gastada Y todavía por delante en el calendario, y la proyección la contaba
dos veces. Reparado: la proyección saltea las resueltas futuras, distinguiéndolas de las pendientes
futuras, que sí siguen contando. Dos tests, uno sobre la regla y otro sobre la lectura que se
despacha contra un Postgres real —el dato no llegaba hasta la regla—, y la regla quedó en el spec.

**Lo que salió al correr D6–D9, además del defecto de fondo:** el detalle de la regla no daba
acuse al vincular —el proveedor del aviso envolvía sólo el historial y las acciones viven arriba—,
y el botón de desvincular ocupaba una fila entera. Los dos corregidos, el primero con un test que
lee el código y falla si algo que avisa queda fuera del proveedor.

**El defecto de G: dos hojas hermanas con la misma `key`.** Al abrir «Ya lo pagué» el teléfono
mostró un cartel rojo de React —«Encountered two children with the same key»—. Cada hoja se remonta
con su propio contador para no arrastrar estado entre aperturas, y los dos arrancan en 0: mientras
la de candidatos fue la única con `key`, no había con quién chocar; la hoja de pago nueva la
duplicó. Además del cartel, React se reserva el derecho de reusar el estado de una en la otra, que
es justo lo que esos contadores existen para impedir. Reparado poniéndole a cada `key` un prefijo
que dice de qué hoja habla, con un test que falla si vuelve a ser un número pelado. **El primer
test escrito no servía** —comparaba cómo se escribe la expresión, y `payKey` y `sheetKey` se
escriben distinto aunque valgan lo mismo—; se rehizo exigiendo el prefijo fijo y se verificó
rompiéndolo a mano.

**Lo que se corrigió mientras se corría** (todo ya en la rama): los dos botones en una sola fila y
con aspecto de botón; el importe recortado y la fecha repetida en la hoja de candidatos nativa; el
fallback «Movimiento sin descripción»; la confirmación de conversión apilada y sin estado residual al
cerrar y reabrir la hoja; el acuse de haber registrado, vinculado y desvinculado —el cambio de
pantalla era mudo—; el vínculo a la regla dentro de su tarjeta y el camino de vuelta al movimiento;
el historial a dos pisos en ancho angosto.
