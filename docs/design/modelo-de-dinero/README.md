# Mocks de producto — modelo de dinero

Simulación de pantallas del modelo de `docs/modelo-de-dinero.md`, fase por fase. Abrir los `.html`
en el navegador.

## Vocabulario vigente — la única tabla que hay que creerle

Varios mocks de abajo son **históricos** y usan nombres que ya se descartaron. Si alguno contradice esta
tabla, **gana esta tabla**.

| Hecho | Rótulo vigente | Descartado |
|---|---|---|
| Una **cuenta remunerada** acreditó intereses sola | **Interés acreditado** | «Rindió» queda solo como copy de apoyo, nunca como rótulo |
| La **sección** donde vive la plata puesta en instrumentos | **Plata colocada** | **«En rendimiento»**, por colisión semántica con las cuentas remuneradas |
| Plata que **salió** hacia un instrumento | **Colocaste** | «Pusiste a rendir», «A rendimiento» |
| Un **rescate positivo y líquido** | **Rendimiento cobrado** | «Ganaste» |
| Un **rescate negativo** | **Resultado −$X** | «Perdiste» |

**Por qué se cayó «En rendimiento»:** una cuenta remunerada **no es una posición y no vive en esa
sección**, pero genera una línea del mes. Con la línea diciendo «Rindió» arriba de una sección llamada
«En rendimiento» —donde esa plata **no se generó**— el usuario asocia dos cosas que no van juntas, y no
tiene forma de descubrir que se equivocó. Está dibujado en `conciliacion-saldo-rendimiento.html`,
sección G. Lo demás está en `docs/exploracion-instrumentos.md` §5.2d.

---

| Archivo | Fase | Estado |
|---|---|---|
| `modulo-ahorro-e-inversion.html` | Módulo | **Vigente.** La casa de Guardado y Propósitos: la puerta desde el dashboard, la jerarquía, el estado vacío y la decisión del corte de moneda. Es `extract-savings-module`, prerrequisito de la fase 3 |
| `fase-1-guardar.html` | 1 · Guardar | **Superado por la implementación.** «Liberar» hoy se llama **Volver a usar** |
| `fase-2-proposito.html` | 2 · Propósito | **Superado por la implementación**, y en un punto de modelo, no solo de nombres — ver abajo |
| `marca-cuenta-intereses.html` | **Previa a 3A** | **Vigente.** La marca opcional por cuenta —«esta cuenta puede acreditar intereses»— que decide **cuánta presencia** tiene la puerta de conciliación: dónde entra en crear/editar, el detalle con la marca apagada, prendida y apagada-con-historial, la sugerencia después del primer interés, la matriz marca × historial y el copy. **Es donde está escrita la regla que gobierna la capa: *Grana ofrece conciliación, pero no persigue conciliación*** |
| `interes-acreditado-flujo.html` | **Previa a 3A** | **Vigente. Es el flujo definitivo de la capa.** Diez pantallas, un solo camino, decisiones aplicadas: la puerta con dos pesos según historial, el sheet, las tres causas, **la confirmación con «qué va a pasar»**, Movimientos, la card del mes, los signos negativo y cero, y **el estado periódico con umbrales por historial**. Incluye el mes cargado —sueldo, gastos, guardado, interés y colocación— y **17 decisiones cerradas listas para spec** |
| `conciliacion-saldo-rendimiento.html` | **Previa a 3A** | **Superado como flujo por `interes-acreditado-flujo.html`, y se conserva por el razonamiento.** Es donde se compararon los tres copys de la puerta, se pusieron A y B de la card una al lado de la otra, y **se descubrió la colisión que cambió el naming de instrumentos** (sección G). Cuando el saldo real de una cuenta no coincide con el calculado: la puerta discreta en el detalle de cuenta, el sheet de saldo real con la diferencia en vivo, las tres causas —rindió / me faltó registrar / no sé— sugeridas por signo pero no impuestas, los casos positivo, negativo y cero, y las **dos versiones de la card del mes**. Incluye el stress test con seis líneas y las dos correcciones de copy que ya están mal en producción. Su razonamiento está en `docs/exploracion-rendimiento-cuentas.md` |
| `fase-3a-fci-v1.html` | 3A · FCI | **Vigente, y es el mock de referencia de la fase.** Diecisiete pantallas, y **usa el naming vigente**: la sección se llama **«Plata colocada»**, el verbo del mes es **«Colocaste»**, el rescate positivo dice **«Rendimiento cobrado»** y el negativo **«Resultado −$X»**. El criterio de admisión es de comportamiento y no de producto, v1 es manual y simple, y el «pusiste» nunca va solo. Incluye los dos estados sin nada, las dos altas con la pregunta de duplicación, el rescate total en los dos signos, el parcial, y las líneas del mes |
| `fase-3a-naming-final.html` | 3A · FCI | **Histórico. NO decidió el nombre**, aunque para eso se hizo. Los cinco casos que producto puso como prueba, cada uno con los tres nombres y **los mismos datos**. «En rendimiento» pasó las dos condiciones de descarte y ganó igual — y aun así se cayó después, por una capa que no estaba sobre la mesa. Se conserva por dos cosas: el hallazgo de que en el rescate negativo **las tres columnas salen idénticas**, y la lección de método —**un ganador solo vale contra lo que estaba sobre la mesa** |
| `fase-3a-fci-naming.html` | 3A · FCI | **Histórico.** La primera comparativa de naming (A «Puesto a trabajar» · B «Plata colocada» · C «Inversiones» de control). Cumplió: sacó la discusión de la prosa. De acá salió «En rendimiento» —una cuarta que ninguna de las tablas iba a encontrar—, que después se cayó; **el ganador final terminó siendo su opción B**. Su razonamiento está en `docs/exploracion-instrumentos.md` |
| `fase-3a-plazo-fijo.html` | 3B · Plazo fijo | **Cambió de número: ahora es 3B.** El orden de fases se corrigió y la primera es FCI, no plazo fijo. Su razonamiento contable —stock vs. flujo, los tres desenlaces, el interés que no es ingreso— **sigue vigente y es de donde sale medio el documento de exploración**; lo que cambia es cuándo se construye. La navegación hay que redibujarla: la cuenta pasa a ser **atajo contextual**, no la puerta principal |
| `fase-3-posiciones.html` | 3 · Posiciones | **Superado por `fase-3a`.** Se conserva por el razonamiento contable —stock vs. flujo, el bucket, los tres desenlaces—, pero su circuito de once pantallas repetía el patrón que la fase 2 desarmó |
| `fase-3-hub-mi-plata.html` | 3 · Hub | **Vigente.** Los dos cortes del hub «Mi plata / Dónde está» y las **tres formas del corte por ubicación** —custodio obligatorio, custodio opcional con fila «Sin ubicación», y ubicación como contenedor— con la misma plata en las tres y la suma verificada. Existe para cerrar **§9.2-E** de `exploracion-instrumentos.md` (¿el custodio es obligatorio?), y la respuesta es que **el hub no lo necesita**: el ejemplo del propio modelo ya dibujaba la lista de contenedores. Incluye la fila que mezcla liquidez, la regla 15 contra el residual, y lo que ninguno de los tres arregla |
| — | 4 y 5 | No se mockean todavía: dibujar el detalle de una meta o la pantalla de patrimonio sería inventar decisiones que no están tomadas, y un mock convincente de algo no decidido termina implementándose tal cual |

**Un mock deja de ser la referencia el día que la fase se construye.** Las fases 1 y 2 están hechas: lo
que hacen se mira en la app, y el modelo corregido está en `docs/modelo-de-dinero.md`. Los mocks quedan
como registro de por dónde empezó el pensamiento, con un aviso arriba de cada uno.

Lo que la fase 2 corrigió no es cosmético: el mock dice que la fila de volver a usar «lleva el mismo
`purpose_id` que las de guardar». Eso resultó ser un error de categoría —la plata guardada es fungible,
y por lo mismo que no tiene cuenta tampoco tiene fila— y la migración 0059 lo dio vuelta: el propósito
es un **reparto por monto** en su propia tabla, y «Sin destino» es el resto derivado. Quien lea el mock
para diseñar la fase 3 se llevaría el modelo viejo.

**No es diseño final.** Es referencia de producto: qué pantalla responde qué pregunta, qué se
reutiliza y qué hay que construir. Los mocks están redibujados sobre el lenguaje visual real de la
app —segmented de tipos, card de monto con chip de moneda, filas con tile + label small-caps +
chevron, botón emerald, hero navy, filas de movimiento con avatar redondo— tomado de capturas de
producción de agosto de 2026. El HTML **no es código de producción**.

## Reemplaza a `docs/design/savings-guardar/`

Aquel circuito quedó obsoleto en tres puntos, todos por la misma causa: modelaba el plazo fijo como
una **cuenta fuera del disponible**.

- Sus pantallas 6, 7 y 8 (alta de cuenta con "tipo de vehículo", transferencia al plazo fijo,
  Cuentas en dos bloques con "Fuera de disponible") desaparecen: en el modelo corregido un plazo
  fijo es una **posición**, y la fase 1 no toca Cuentas.
- Tenía la línea *"Pasaste a otras cuentas"*, que existía solo porque con cuentas fuera del
  disponible las transferencias entre cuentas propias dejaban de ser neutras.
- Su pantalla 8 agrupaba Cuentas por tipo. `/accounts` hoy **no muestra ningún total**, así que no
  hay dos números que reconciliar y la fase 1 no necesita tocarla.

## El naming quedó cerrado, y no lo decidió la comparación de naming

**La sección de instrumentos se llama «Plata colocada».** «En rendimiento» estuvo elegido y se cayó.

No lo tumbó ninguna de las condiciones que se le habían fijado —pasó el rescate negativo y pasó FCI +
plazo fijo, los dos en `fase-3a-naming-final.html`—. Lo tumbó **una capa que no estaba dibujada**: una
cuenta remunerada acredita intereses sola, **no es posición y no vive en esa sección**, pero genera una
línea del mes. Dibujada por primera vez decía «Rindió +$25.000», arriba de una sección llamada «En
rendimiento» donde esos $25.000 no se generaron. Error de categoría, y **sin forma de que el usuario
lo descubra** (`conciliacion-saldo-rendimiento.html`, sección G).

**El vocabulario quedó repartido así:**

| Hecho | Rótulo |
|---|---|
| Una cuenta remunerada acreditó intereses | **Interés acreditado** |
| Plata que salió hacia un instrumento | **Colocaste** |
| La sección donde vive esa plata | **Plata colocada** |
| Un rescate positivo y líquido | **Rendimiento cobrado** |
| Un rescate negativo | **Resultado −$X** |

Ninguna raíz compartida entre las dos capas. Y «Rendimiento cobrado» **volvió**, porque la palabra
quedó libre al caerse el nombre que se la llevaba — era el único costo visible que tenía.

> **La lección de método.** La comparación A/B/C estaba bien hecha —mismos datos, cinco casos, regla de
> descarte fijada antes de mirar— y **aun así eligió mal**: un ganador solo vale contra lo que estaba
> sobre la mesa. **No cerrar el nombre de una sección mientras haya una capa adyacente sin dibujar.**

## La card del mes se mide en zonas, no en líneas

Segunda decisión cerrada sobre el mock (`conciliacion-saldo-rendimiento.html`, pantallas 12 y 14):

```
   Inicial  →  Operativa / consumo  →  Financiera  →  Final
   Tenías      Entró · Se fué · Guardado   Interés acreditado · Colocaste   Para gastar
```

Las líneas financieras van **bajo un solo par de reglas punteadas**, compartiendo zona, y **fuera de
«Entró» y «Se fué» operativos**. Plana —una regla por línea— la card se parte en cinco zonas y parecen
dos secciones distintas; agrupada vuelve a cuatro, y una tercera línea financiera entra sin agregar
ninguna. **El techo dejó de ser el número de líneas.**

Lo que se gana no es contable —la identidad cerraba de las dos formas— sino de significado: **«Entró»
vuelve a ser el sueldo y «Se fué» el consumo.**

## Decisiones abiertas que los mocks tienen que resolver## Decisiones abiertas que los mocks tienen que resolver

### Cerradas por `fase-3-posiciones.html`

**~~La segunda línea bajo la regla.~~ Sí va, y no era una decisión de gusto.** Estaba planteada como
"¿molesta la línea o no?", prima hermana de *"Pasaste a otras cuentas"* que ya fue rechazada una vez.
Con los números al lado resultó ser aritmética: **sin un cuarto término la card deja de cerrar contra
el número que tiene arriba**, y esa identidad es lo que la hace auditable a ojo. Y no es prima de
aquella: *"Pasaste a otras cuentas"* nombraba un movimiento que **no cambiaba el disponible** —plata
entre dos bolsillos propios, los dos contando igual—, así que era ruido. Esta explica exactamente los
$700.000 que el disponible bajó. Va **debajo de Guardado** y en **color propio**: las dos sacan plata
del disponible, pero una se deshace con un tap y la otra está inmovilizada hasta que vence.

**~~Dónde entra "Invertir".~~ No hace falta que entre a ningún lado.** El segmented se queda en cinco
tabs. Poner plata a trabajar es una **transferencia cuyo destino es una posición**, no un tipo de
movimiento nuevo; una sexta pestaña sería modelar el **destino** como si fuera un **tipo**, que es el
mismo error de categoría que el `counts_as_available` que el modelo ya descartó. Lo único que cambia
es el **selector de destino**, que ya existía y gana filas.

### Cerradas por `fase-3a-fci-v1.html`

**~~El nombre.~~ Cerrado en «Plata colocada»**, por lo de arriba. Descartados:
*Invertido* mete la palabra que el propio modelo deja afuera para comprar dólares, *Inmovilizado* suena
a embargo, *Inversiones* no puede ser rótulo madre de una caja de ahorro remunerada, y *En rendimiento*
se lleva por delante la capa de cuentas. *Puesto a trabajar* queda como alternativa.

**Lo que sigue costando, y se aceptó:** «Guardado» y «Plata colocada» son los dos participios de *«dejé
la plata en algún lado»*. Esa alerta —la de siempre para este nombre— **no se resolvió**: se pagó, a
cambio de no contaminar el vocabulario de las cuentas remuneradas. Es lo que hay que mirar en la
pantalla 2 de `fase-3a-fci-v1.html`.

**~~El rescate parcial.~~ Cerrado, y por simplificación explícita.** Reduce el capital registrado y
**no inventa un resultado parcial**: el resultado se reconoce al cerrar la posición, o antes si lo
rescatado acumulado supera lo puesto. El total es exacto; lo único que se corre es *cuándo* se
reconoce. La contrapartida es que la fila muestra **capital puesto, no valor de hoy**, y por eso el
«pusiste» **nunca va solo**: lo acompañan *«Valor no actualizado automáticamente»* y la fecha de la
última actualización manual. Deja de ser de 3B: era el precio de que FCI fuera primero.

### Todavía abiertas

**~~El rescate.~~ Resuelto en los pasos 12–16, y corregido en un punto por `fase-3a-fci-v1.html`.**
Lo que se sostiene: el rescate **nunca es `income`**, y el capital vuelve por el mismo término por el
que se fue, así el bucket **netea cero** en la vida de la posición. Lo decide el caso negativo: una
pérdida metida adentro de "Entró" aterriza en "Se fué", afirmando que salió plata de una cuenta que
subió.

Lo que cambió: aquel mock daba al resultado **línea propia con signo en el mes**. El de v1 dice
**«Rescataste +$380.000» y nada más**, porque los $30.000 ya están adentro de esos $380.000 —ponerlos
aparte los contaría dos veces, o exigiría partir la línea en capital y resultado, que es más card por
el mismo dato. El resultado vive en el detalle de la posición y en el movimiento, no en la card del
mes.

Y "Rendimiento" no es la ganancia del mes: es **la ganancia que se hizo líquida**. Un interés
capitalizado no entró a ninguna cuenta, así que el mes no lo nombra — vive en la posición, que vale
más. El **rescate parcial** ya no queda abierto acá: lo cierra `fase-3a-fci-v1.html`, arriba.

**~~Fase 3 — el hub "Mi plata".~~ Dibujado en `fase-3-hub-mi-plata.html`, y resolvió una que no era suya.**
Se decía que se dibujaba último —*es lectura pura, y sale bien recién cuando sabemos qué hay para
leer*—, y eso sigue valiendo para su **contenido**. Lo que no podía esperar era su **forma**, porque de
ella dependía si el hub obligaba a pedir un custodio en el alta de una posición (§9.2-E de
`exploracion-instrumentos.md`, abierta con el motivo *«depende de si el corte por ubicación entra en
3A»*).

**No lo obliga.** Puesto el corte por entidad al lado del corte por contenedor, gana el segundo, y ni
siquiera por costo: agrupar por entidad pliega una posición adentro de la fila de su banco, y esa fila
pasa a mezclar plata gastable con plata que necesita un rescate — **la misma confusión que la capa de
instrumentos existe para disolver**. La fila «Sin ubicación» que salvaría al corte por entidad con
custodio opcional falla las tres pruebas de la regla 15.

Y el ejemplo del modelo (§5) ya lo había dibujado así: en su corte por ubicación **Galicia aparece dos
veces** —la cuenta y el plazo fijo—, que es una lista de contenedores y no un agrupamiento por
entidad. Queda abierto lo que solo contesta mirar a alguien usarlo: si los dos cortes se leen como dos
vistas de lo mismo, y cuántas filas aguanta la lista plana.
