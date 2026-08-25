# Mocks de producto — modelo de dinero

Simulación de pantallas del modelo de `docs/modelo-de-dinero.md`, fase por fase. Abrir los `.html`
en el navegador.

| Archivo | Fase | Estado |
|---|---|---|
| `fase-1-guardar.html` | 1 · Guardar | **Superado por la implementación.** «Liberar» hoy se llama **Volver a usar** |
| `fase-2-proposito.html` | 2 · Propósito | **Superado por la implementación**, y en un punto de modelo, no solo de nombres — ver abajo |
| `fase-3-posiciones.html` | 3 · Posiciones | **Parcial, y vigente.** Dos pantallas y la cuenta del mes: cerró las dos decisiones abiertas. Faltan detalle de posición, rescate y el hub |
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

## Decisiones abiertas que los mocks tienen que resolver

### Cerradas por `fase-3-posiciones.html`

**~~La segunda línea bajo la regla.~~ Sí va, y no era una decisión de gusto.** Estaba planteada como
"¿molesta la línea o no?", prima hermana de *"Pasaste a otras cuentas"* que ya fue rechazada una vez.
Con los números al lado resultó ser aritmética: **sin un cuarto término la card deja de cerrar contra
el número que tiene arriba**, y esa identidad es lo que la hace auditable a ojo. Y no es prima de
aquella: *"Pasaste a otras cuentas"* nombraba un movimiento que **no cambiaba el disponible** —plata
entre dos bolsillos propios, los dos contando igual—, así que era ruido. Esta explica exactamente los
$700.000 que el disponible bajó. Va **debajo de Guardado** y en **color propio**: las dos sacan plata
del disponible, pero una se deshace con un tap y la otra está inmovilizada hasta que vence.

Lo que **sigue abierto** es solo el nombre: *Puesto a trabajar* (largo), *Invertido* (mete la palabra
que el propio modelo dice que deja afuera comprar dólares) o *Inmovilizado* (es lo que describe, y
suena a embargo).

**~~Dónde entra "Invertir".~~ No hace falta que entre a ningún lado.** El segmented se queda en cinco
tabs. Poner plata a trabajar es una **transferencia cuyo destino es una posición**, no un tipo de
movimiento nuevo; una sexta pestaña sería modelar el **destino** como si fuera un **tipo**, que es el
mismo error de categoría que el `counts_as_available` que el modelo ya descartó. Lo único que cambia
es el **selector de destino**, que ya existía y gana filas.

### Todavía abiertas

**Fase 3 — el rescate.** Cuando vence, vuelven $724.164,38 sobre $700.000. El capital es la
contrapartida del que salió; los $24.164,38 son la realización de una valuación y **no un ingreso**.
Cómo se registra eso sin meterlo en "Entró" no está mockeado.

**Fase 3 — el hub "Mi plata".** Se dibuja último: es lectura pura, y sale bien recién cuando sabemos
qué hay para leer.
