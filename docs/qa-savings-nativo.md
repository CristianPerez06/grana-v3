# QA visual nativo — `extract-savings-module`

> **Este código nunca se ejecutó.** El módulo nativo está implementado y typecheck + lint dan verde,
> pero **ninguna de las seis verificaciones de la tarea 6.6 dibuja una pantalla**: TypeScript compara
> tipos y ESLint lee sintaxis. Todo lo de acá abajo se mira corriendo la app.
>
> Cubre las tareas **6.5 · 6.13 · 2.9** y la sección C del issue **#58**. Al terminar, lo que salga
> vuelve a `openspec/changes/extract-savings-module/tasks.md`; **7.1 dice que no se archiva hasta que
> esto pase**.

## Por dónde va (29-ago-2026)

Dieciséis hallazgos cerrados, todos pusheados; el detalle de cada uno está en la tarea **6.15** de
`tasks.md`, y los cinco últimos con el bloque de la «Definition of Done» de acá abajo. Salieron de los
casos **2, 3, 6, 7 y 8**.

**Todo lo hecho hasta acá pide `npx expo start -c` antes de mirarlo.**

| Orden | Casos | Qué mirar |
|---|---|---|
| **1º** | **6 · 7 · 8** (re-pasada) | Los tres cambiaron entero. Lo puntual: el CTA a la vista sin scrollear; **el monto SIN cortarse arriba ni abajo** —el bug de la última vuelta—; los chips en dos filas como máximo; y que nativo y web mobile se lean como la misma pantalla |
| **2º** | **3** (re-pasada) | La card «Sin destino», ahora compacta: sin aire muerto abajo del enlace |
| **3º** | **11 · 12** | Nunca corrieron y son lo que el trabajo de altura más pudo mover: 11 depende del alto del sheet, 12 de los chips |
| **4º** | **9 · 10** | Nunca corrieron, y los dos tienen antecedente en 6.14 — el monto tipeado que se perdía, y el botón/enlace invertidos |
| **5º** | **1 · 4 · 5** | Nunca corrieron. Riesgo 2 —los divisores— vive en el 4 |
| **6º** | **13 · 14** | Navegación. Lo único que no depende de nada de lo anterior |

Divergencias vigentes entre web mobile y nativo, aceptadas y con motivo (detalle en 6.15):

- el `lineHeight` del monto — web puede dejarlo en `leading-none`, RN recorta el glifo;
- el ícono del calendario, 18 en nativo y 16 en web — el componente lo comparte el alta de movimientos;
- el `tracking` de los rótulos — nativewind no resuelve `em` en `letterSpacing`.

## Definition of Done de un fix mobile

Un arreglo de Ahorro en mobile **no está terminado cuando se ve bien en una superficie**. Las
superficies son dos —web en viewport de teléfono y la app nativa— y la regla global vive en la
política Web ↔ Mobile de `AGENTS.md`. Esto de acá es su forma operativa para este change: qué hay que
poder responder antes de dar un fix por cerrado.

El registro va en la tarea **6.15** de `tasks.md`, con este bloque:

```
### <qué se arregló>
- Web mobile:   <archivo / componente>
- Nativo:       <archivo / componente>
- Cambio:       <qué se aplicó, EN LAS DOS>
- Divergencia:  <ninguna | cuál y por qué la impone la plataforma>
- Runtime:      <no requiere | requiere `expo start -c` | requiere rebuild>
- Cierra:       <caso N del QA>
```

Las seis líneas son obligatorias, y cuatro de ellas existen por un error que ya cometimos:

| Línea | Qué evita |
|---|---|
| **Web mobile** y **Nativo**, los dos nombrados | Que el fix entre en un archivo y falte el otro. Pasó con «Destinar»: el recorte de altura entró en `savings-drawer` y no en `purpose-allocate`, y el formulario siguió pidiendo scroll |
| **Cambio**, descrito una vez para las dos | Que «lo mismo» sean en realidad dos cosas parecidas. Pasó con el techo de chips: web plegaba a las seis y nativo dibujaba los diez |
| **Divergencia**, explícita | Que una diferencia por descuido se lea después como decisión. Solo valen las que impone la plataforma —`hitSlop` por `::after`, el picker del sistema, el gesto de cierre—, y van con su motivo |
| **Runtime** | Que un fix correcto se reporte como roto porque la app corría otro bundle |
| **Cierra** | Que el mismo síntoma se reporte tres veces sin que nadie sepa si ya se atacó |

## Protocolo de versión y runtime

Antes de reportar «en nativo no cambió nada», y antes de que yo conteste «será la caché». En orden,
y se corta en el primer paso que falle:

1. **Hash local**, en la máquina donde corre Expo:
   ```
   git log --oneline -1
   ```
   Si no es el commit del fix, el checkout no lo tiene. `git pull` y de nuevo.

2. **El código viejo no existe**, por `grep` y no por memoria — buscando el string que YA NO debería
   estar (la clase que se sacó, la clave de i18n vieja, el componente que se movió). Ejemplo real:
   ```
   grep -c create_inline apps/mobile/components/savings/*.tsx   # tiene que dar 0
   ```
   Si aparece, hay cambios locales sin commitear pisando el fix.

3. **El repo está bien y la app igual no cambia** → es runtime. Frenar Expo y arrancar limpio:
   ```
   npx expo start -c
   ```
   `watchFolders` hace que Metro mire `packages/`, pero el transformer cache se indexa por archivo y
   un cambio fuera de `apps/mobile` es justo el caso que se pierde. Una `r` recarga la app y **no**
   limpia esa caché: por eso se ve un estado mezclado, con la mitad de un commit aplicada.

4. **Sigue igual** → borrar la app del simulador y reinstalarla.

5. **Es un dev build de EAS o TestFlight** → el JS viene embebido en el binario y **ningún** cambio
   aparece hasta reconstruir. No hay caché que limpiar; hay que volver a buildear.

La señal que separa un caso del otro: un problema de implementación deja ver **algunos** cambios y
otros no. **Cero** cambios sobre varios commits distintos es runtime, no código.

## Antes de empezar

- [ ] Datos con **plata en ARS y en USD** — buena parte de los riesgos solo aparecen con las dos.
- [ ] **Al menos 8 propósitos** con nombres largos y cortos, para ver el overflow de chips (el corte
      es en **6**, con holgura de 1: con 7 no colapsa, con 8 sí).
- [ ] Al menos un propósito **en cero** y uno con saldo.
- [ ] Montos de **8 dígitos** en las dos monedas: es lo que rompió el layout en web.
- [ ] Teléfono **angosto (~360px)** para la primera pasada. Si algo se rompe, se rompe ahí.

## Los tres que más riesgo tienen

Están así de ordenados en la tarea 6.13, y conviene mirarlos primero: si alguno falla, el resto del QA
cambia de prioridad.

| # | Riesgo | Por qué | Dónde se ve |
|---|---|---|---|
| **1** | **El envoltorio de las dos monedas** en la card oscura | **Yoga y el navegador no rompen la línea igual.** En web se resolvió con `flex-wrap` + `min-w-max` para que el corte dependa del contenido; en RN puede no comportarse igual | Caso 2 |
| **2** | **Los bordes que hacen de divisor** | Dependen de `overflow: hidden` + margen negativo. Si Yoga los resuelve distinto, la línea aparece **alrededor** en vez de **entre** | Casos 2 y 4 |
| **3** | **El efecto que corrige el origen vacío** al volver a usar | Es lógica de `useEffect` que nunca corrió | Caso 7 |

---

## 1 · Pantalla principal de «Ahorro e inversión»

| | |
|---|---|
| **Qué mirar** | Que la pantalla **se dibuje entera**: header, card oscura, desglose y pie. Orden vertical y espaciado parejo. Que el `PageHeader` diga «Ahorro e inversión» con la flecha a **Inicio** |
| **Interacción mínima** | Entrar, scrollear hasta abajo, **pull-to-refresh** |
| **Sería bug** | Pantalla en blanco o error al montar · un bloque fuera de orden · el refresh no recarga · scroll trabado |
| **Puede variar por nativo** | El *bounce* del scroll y el spinner del refresh son del sistema. **No** es bug que se vean distinto de web |

## 2 · Header oscuro con ARS y USD ⚠️ *riesgo 1 y 2*

| | |
|---|---|
| **Qué mirar** | Los dos montos con **8 dígitos**. Que rompan la línea **cuando el contenido lo pide**, no antes. Que el divisor caiga **entre** ARS y USD, nunca alrededor del bloque. Que nada se corte ni se salga |
| **Interacción mínima** | Rotar el teléfono si se puede, y mirar con USD en cero y con USD con plata |
| **Sería bug** | **Un monto cortado o con puntos suspensivos** · el divisor arriba/abajo/alrededor en vez de entre · los dos montos pegados sin separación · desborde horizontal de la pantalla |
| **Puede variar por nativo** | El **peso tipográfico** puede verse ligeramente distinto (RN no tiene los mismos pesos disponibles). No es bug si el número entra y se lee |

## 3 · «Sin destino»

| | |
|---|---|
| **Qué mirar** | Que los **tokens cálidos pinten** —fondo y borde—; si sale gris o transparente, el token no llegó. Que el monto USD quede **abajo** del ARS y no al lado. Que el botón de acción quede a la derecha |
| **Interacción mínima** | Tocar el bloque y ver que abre el overlay con «Sin destino» preseleccionado —**no bloqueado** |
| **Sería bug** | **Bloque sin color** (los `--savings-unassigned-*` se regeneraron en `tokens.cjs`; nativo lee de ahí) · USD al lado del ARS en pantalla angosta · el destino llega **bloqueado** en vez de preseleccionado |
| **Puede variar por nativo** | Nada. Si el color falta, es bug |

## 4 · Grilla de propósitos ⚠️ *riesgo 2*

| | |
|---|---|
| **Qué mirar** | En nativo es **una sola columna**, no grilla — es deliberado. Nombres largos **truncan con ellipsis**; los montos **nunca** se cortan. Emblema y tinte por propósito. Divisores entre filas, no alrededor |
| **Interacción mínima** | Tocar una fila y ver que abre el detalle del propósito correcto |
| **Sería bug** | **Un monto cortado** (D24: el nombre cede, el monto nunca) · nombre sin truncar que empuja el monto fuera · emblema sin color o con el color de otro propósito |
| **Puede variar por nativo** | La **una sola columna** es correcta y no es una regresión respecto de web |

## 5 · Propósitos en cero / ver sin saldo

| | |
|---|---|
| **Qué mirar** | Que un propósito en **$0** se vea y no desaparezca. Que el control de mostrar/ocultar los que no tienen saldo funcione y **diga cuántos son** |
| **Interacción mínima** | Alternar el control dos veces y confirmar que la lista cambia en los dos sentidos |
| **Sería bug** | El propósito en cero **no aparece nunca** · el contador no coincide con lo que se muestra · el estado se pierde al volver de otra pantalla |
| **Puede variar por nativo** | Nada |

## 6 · Guardar

| | |
|---|---|
| **Qué mirar** | Que el overlay **abra directo al formulario** —no hay vista raíz—. Los **atajos de monto** (ARS `10.000` / `50.000`, USD `10` / `50`, más «Todo»). Los chips de propósito ordenados **por saldo** |
| **Interacción mínima** | Guardar un monto chico con un propósito elegido, y confirmar que el total de arriba sube |
| **Sería bug** | El overlay abre en una vista intermedia · un atajo carga el monto equivocado · «Todo» no toma el disponible real · guardar de más no se topea |
| **Puede variar por nativo** | El **gesto de cierre** del `BottomSheet` es del sistema. Que se cierre arrastrando es lo esperado |

## 7 · Volver a usar ⚠️ *riesgo 3*

| | |
|---|---|
| **Qué mirar** | Que el **origen se autocorrija**: si el propósito elegido no alcanza, el efecto tiene que reacomodar el origen solo. Que el mensaje de tope **ofrezca la salida** en vez de solo negar |
| **Interacción mínima** | Pedir **más de lo que hay** en «Sin destino» y ver qué ofrece. Después cambiar de propósito y confirmar que el origen se acomoda |
| **Sería bug** | **El origen queda vacío y el CTA muerto** · el tope niega sin ofrecer de dónde sacar el resto · lo tipeado **se pierde** al cambiar de origen (fue una de las tres divergencias graves de 6.14) |
| **Puede variar por nativo** | Nada. Es lógica, y es la que nunca corrió |

## 8 · Destinar

| | |
|---|---|
| **Qué mirar** | Que abra sin propósito elegido —el destino se decide adentro—. Que el tope sea **lo que hay sin destino**, y que el mensaje lo diga |
| **Interacción mínima** | Destinar una parte y ver que «Sin destino» baja y el propósito sube, por el mismo monto |
| **Sería bug** | Deja destinar **más de lo que hay sin destino** · los dos números no cierran después de la operación |
| **Puede variar por nativo** | Nada |

## 9 · Crear propósito desde el flujo

| | |
|---|---|
| **Qué mirar** | Que se pueda crear **sin salir** de lo que se estaba haciendo, y que al volver **el propósito nuevo quede elegido** |
| **Interacción mínima** | Empezar a guardar, crear un propósito nuevo desde ahí, y confirmar que el monto tipeado **sigue estando** |
| **Sería bug** | **Se pierde el monto tipeado** · vuelve sin el propósito nuevo seleccionado · el stack de vuelta atrás salta dos pantallas o cierra el overlay |
| **Puede variar por nativo** | La animación de ida y vuelta entre vistas del overlay |

## 10 · Detalle de propósito

| | |
|---|---|
| **Qué mirar** | Que el **botón y el enlace no estén invertidos** — la acción principal es el botón (fue otra de las tres divergencias graves de 6.14). Nombre, emblema y montos por moneda |
| **Interacción mínima** | Entrar, usar la acción principal, volver con la flecha |
| **Sería bug** | Botón y enlace intercambiados · la flecha de volver **cierra el overlay** en vez de volver un paso · montos ARS y USD sumados |
| **Puede variar por nativo** | Nada |

## 11 · Teclado abierto

| | |
|---|---|
| **Qué mirar** | Que el **teclado no tape el CTA**. Que el campo de monto quede visible mientras se tipea |
| **Interacción mínima** | Abrir cada formulario, tocar el campo de monto, y confirmar que se puede **llegar al botón sin cerrar el teclado** |
| **Sería bug** | **CTA tapado** · hay que cerrar el teclado para confirmar · el sheet salta o se cierra al aparecer el teclado |
| **Puede variar por nativo** | La **altura del teclado** cambia según teléfono y si tiene sugerencias. Probar con al menos una configuración real |

## 12 · Chips con overflow

| | |
|---|---|
| **Qué mirar** | Con **8 propósitos**: que muestre 6 y colapse el resto, con el control de «ver todos» **en la fila del rótulo**. Con 7 no debería colapsar (holgura de 1) |
| **Interacción mínima** | Expandir, elegir uno de los ocultos, y confirmar que **queda visible** aunque no entre en los 6 |
| **Sería bug** | El elegido **desaparece** al colapsar · el control de expandir no aparece con 8 · los chips desbordan la pantalla en vez de colapsar |
| **Puede variar por nativo** | El *wrap* de los chips puede acomodarse distinto que en web. **Mientras no desborden**, no es bug |

## 13 · Navegación desde el dashboard

| | |
|---|---|
| **Qué mirar** | La **fila de guardado** en la card de balance, **debajo de la regla**. Que tocarla lleve a `/(app)/savings` |
| **Interacción mínima** | Tocar la fila, llegar al módulo, volver con la flecha y confirmar que **vuelve a Inicio** |
| **Sería bug** | La fila **no es tocable** · lleva a otro lado · la vuelta rompe el stack o sale de la app |
| **Puede variar por nativo** | La transición entre pantallas |

## 14 · Navegación desde el menú

| | |
|---|---|
| **Qué mirar** | La entrada **«Ahorro e inversión»** en el menú (`AppMenu`), y que el módulo **no aparezca como tab** — está montado con `href: null`, a propósito |
| **Interacción mínima** | Abrir el menú, entrar, y confirmar que el menú **se cierra solo** al navegar |
| **Sería bug** | La entrada no está · aparece un tab de más en la barra · el menú queda abierto encima del módulo |
| **Puede variar por nativo** | Nada |

---

## Además, mientras se usa (tarea 2.9)

No son checks de pixel, son de sensación — y son la mitad del valor de mirar la app corriendo:

- [ ] **Guardar-para-un-propósito son 5 taps.** ¿Se siente lento?
- [ ] **¿Se entiende «¿Para qué es?»** como pregunta al crear un propósito?
- [ ] **¿La cabecera se sostiene con plata real** en las dos monedas?
- [ ] **44px de alto real** en todo lo tocable: en RN no hay `::after`, así que el área es la que se ve.

## Cómo cerrar

1. **Todo en verde** → marcar 6.5, 6.13 y 2.9 en `tasks.md`, cerrar la sección C del issue #58, y recién
   ahí queda habilitado 7.1 (archivar el change).
2. **Algo roto** → anotarlo en `tasks.md` con el caso de esta lista, arreglar **en las dos superficies**
   con el bloque de la «Definition of Done» de arriba, y **volver a correr el caso** más los dos que
   lo rodean.
3. **Algo que solo varía por nativo** → anotarlo como aceptado, con el motivo. Ya hay un precedente:
   `date_label`, aceptada porque en nativo el selector de fecha lo rotula el sistema operativo.
