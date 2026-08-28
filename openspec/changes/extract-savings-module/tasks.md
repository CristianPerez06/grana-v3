# Tasks: extract-savings-module

> **Sin migraciones.** Si este change termina tocando SQL, algo se entendió mal (E6).
>
> **Excepción, y no es scope creep: la 0060** (§8). No agrega nada al módulo — arregla un bug de
> producción en `get_available_sums` que este change destapó al ponerle un segundo consumidor a esa
> función. Aterrizó en esta rama porque es donde se encontró, no porque el módulo lo necesitara.

## Estado

**El módulo está implementado y verificado por código en las DOS apps** —web y nativa—: ruta, entrada
de navegación, la fila del dashboard que navega en vez de operar, el overlay sin vista de detalle y
montado solo por el módulo. `openspec:check`, typecheck web, typecheck mobile, lint web, lint mobile,
711 tests y build de producción, en verde (6.6).

Lo que queda abierto es de **cuatro** clases, y ninguna es implementación pendiente:

| clase | tareas | por qué sigue abierta |
|---|---|---|
| **QA visual nativo** | 2.9 · 6.5 · 6.13 · 6.15 | **Corriendo.** Once hallazgos hasta acá, todos corregidos (6.15) |
| **Diferido a monetización** | 4b.1–4b.4 | Apagar el módulo solo tiene sentido con sistema de planes, que no existe (E10) |
| **Backlog no bloqueante** | 4c.12 · 6.7b | Anotado para no perderlo; no frena nada |
| **Compuertas** | 7.1 · 7.2 | No archivar hasta el QA visual nativo; la fase 3A viene después |
| **Deuda destapada** | 8.2 | Cuatro hallazgos del barrido que siguió al bug crítico. Ninguno bloquea, ninguno es de este change |

**Nada de esto se toca hasta mirar la app nativa corriendo**: lo que el QA visual encuentre puede
cambiar lo que haya que hacer, y arreglar a ciegas sobre código que nunca se ejecutó es escribir dos
veces.

## 1. La corrección documental, primero

- [x] 1.1 `docs/modelo-de-dinero.md`: separar *"ahorro e inversión no son dos modelos de datos"* —que
  sigue valiendo— de *"no son un lugar en la app"*, que era una conclusión que la frase no sostenía.
  Va primero porque es la frase que bloqueó esta discusión durante tres fases
- [x] 1.2 Anotar ahí mismo que la objeción a **«Invertir»** era contra esa palabra, no contra un
  módulo, y que *«Ahorro e inversión»* no la hereda
- [x] 1.3 `AGENTS.md`: el módulo `16 savings` gana superficie propia; dejar dicho que `18 investments`
  se construye **adentro** de él y no como módulo aparte

## 2. Dibujar antes de construir

- [x] 2.1 Mock del módulo, con los números reales de agosto: `docs/design/modelo-de-dinero/modulo-ahorro-e-inversion.html`.
  **El corte de moneda quedó decidido y va contra la intuición inicial: sin tabs.** Las tres formas se
  compararon con el mismo dato, y dos ya habían sido descartadas en la fase 2 por el mismo usuario:
  apilar dos bloques (*"no sé si me convence que lo de USD esté abajo"*) y partir por moneda
  (*"no hay ninguna manera donde yo pueda ver cuánto tengo para Viaje en ARS y USD junto"*). Con tabs,
  un propósito bimoneda **no existe entero en ninguna pantalla**. La salida es la de D16: una lista con
  los dos montos por fila, sin sumarlos. El chip de moneda vive en los formularios, que es donde la
  moneda es un dato de la operación y no una estructura
- [x] 2.2 La jerarquía: **Guardado es el protagonista** en las dos monedas, y **«Para gastar» va de
  contexto en chico** — es el titular del dashboard, y dos pantallas con el mismo protagonista no dejan
  protagonista a ninguna (D16). Después el desglose, «Sin destino» al pie y las dos acciones
- [x] 2.3 Dibujar la **puerta sobria** desde el dashboard: la fila de Guardado lleva al módulo sin
  convertir la card en su casa. **Implementado en las dos apps**: en web es un `Link` a `/savings`,
  en nativa un `router.push('/(app)/savings')`, y ninguna de las dos monta ya el overlay (4.2, 4.4)

- [x] 2.4 Segunda pasada del mock con la arquitectura de interacción propuesta: cabecera sobria (Para
  gastar + Guardado, con el USD **subordinado y no oculto**), filas con acción contextual, los cuatro
  sheets de un paso y el vacío educativo. **Ajuste sobre lo propuesto: la acción de la fila es
  «Destinar», no «+ Guardar»** — guardar cambia el *total* y su tope es el disponible, que la fila no
  muestra (D18). *Destinar* es una acción del grupo, su origen está a la vista dos filas más abajo, y
  ahorra el mismo tap. Las dos versiones están dibujadas para mirarlas
- [x] 2.5 **La fila no lleva acción contextual.** Se evaluaron tres versiones y quedan dibujadas:
  filas limpias (elegida), *+ Guardar* por fila y *Destinar* por fila. *+ Guardar* cae por nivel —seis
  botones del mismo verbo y el único con su tope a la vista es el global (D18)—; *Destinar* por fila
  está en el nivel correcto pero **no ahorra ningún tap**: destinar desde el enlace de «Sin destino»
  ya son cuatro. Cinco controles que no compran nada
- [x] 2.6 **La cabecera es una grilla de dos conceptos por dos monedas, no una línea subordinada.**
  Se dibujó con los datos de hoy (US$ 10) y con dólares de verdad (US$ 3.200 + US$ 850 disponibles), y
  la línea única se rompe en el segundo caso: alcanza para **un** número en dólares, y cuando los
  dólares importan hacen falta **dos** — con lo que la cabecera vuelve a ser dos bloques apilados. Una
  estructura que se reacomoda sola el día que alguien compra dólares en serio es peor que cualquiera
  de las dos. La grilla aguanta las dos magnitudes, mantiene los pesos primarios (tipografía más
  grande, primera columna) y **nunca suma ni cruza las columnas**. Con la celda vacía va `—`: dice
  *"no tenés"* en vez de dejar la pregunta sin contestar
- [x] 2.8 Dibujada la **vista de un propósito** dentro del módulo, con las tres acciones del grupo
  —destinar más, volver a usar, quitar destino— y sin *Guardar*, que vive un nivel arriba (D18)
- [ ] 2.9 **Para mirar usándolo** — no es implementación, es criterio para el QA visual: si
  guardar-para-un-propósito (5 taps) se siente lento, si el copy *«¿Para qué es?»* se entiende, y si
  la cabecera se sostiene con plata real en las dos monedas. En web ya se miró; **en nativa queda
  para el QA visual**
- [x] 2.7 **La flecha de volver va arriba a la IZQUIERDA**, antes del título, como control de 44×44
  con borde — el `DrawerBackHeader` que la app ya usa. Los mocks de la fase 3 y del módulo la tenían a
  la derecha: se había reusado el slot del ✕ de cerrar, que sí va a la derecha. Son dos controles
  distintos y estaban confundidos

## 3. La ruta y la entrada

- [x] 3.1 Ruta **`/savings`** en las dos apps, con su layout y estados de carga. La ruta va en inglés como todas
  —`/accounts`, `/cards`, `/transactions`— y el rótulo del menú en castellano, **«Ahorro e
  inversión»**, como todos. Que no coincidan es lo normal: `/shared` se llama *Compartido* (E11)
- [x] 3.2 Entrada de navegación en las **dos** apps, con el rótulo `nav.savings` — que existía como
  clave huérfana ("Ahorros") y pasa a **«Ahorro e inversión»**. En web, el sidebar (`app-shell.tsx`);
  en nativa, el sheet del menú (`AppMenu.tsx`), junto a Cuentas y Tarjetas, que es el mismo grupo que
  ocupa en el sidebar. **No** va al tab bar: son los cuatro destinos del día a día y un quinto les
  saca ancho a los cuatro
- [x] 3.3 Skeleton shell shape-matched: la grilla arriba y cuatro filas de lista abajo
- [x] 3.4 Estado vacío: el número en cero, **una sola acción**, y la frase que evita el
  malentendido —*"guardar no mueve tu plata"*—. Sin propósitos, sin «Sin destino» en cero, y **sin
  ningún rastro de inversiones**, aunque el módulo se llame así (E8)

## 4. Mover la operatoria

- [x] 4.1a La **lectura** vive en el módulo: la grilla bimoneda, la lista de propósitos y «Sin
  destino» al pie, desde `get_available_sums` y `get_purpose_sums` — las mismas dos lecturas
  normativas que consume el dashboard, sin recomponer nada
- [x] 4.1b Los **formularios**: todo lo que se toca en el módulo abre el overlay **directo a la
  vista que se pidió** (`initialView`), así que su detalle nunca se dibuja y no hay lectura
  duplicada. Cableados: los dos botones globales (formulario), las filas de propósito (su grupo) y
  los dos enlaces del resto (destinar / volver a usar). La moneda de entrada sale del dato
  (`moduleGroupCurrency`) y no de un default, que abriría un propósito de solo dólares con tope cero
- [x] 4.1c **Podada del overlay la vista de detalle.** Con ella se fueron el `Headline`, el puente
  bancario, el historial y `groupsUnified` — y **dos de las cinco consultas por apertura**, que eran
  lectura y ahora la hace la página. El overlay dejó de tener vista raíz: `initialView` pasa a ser
  obligatorio, la pila arranca donde se pidió, y **la flecha del fondo CIERRA** en vez de revelar la
  lista duplicada
- [x] 4.1d **El puente bancario y el historial se mudaron a `/savings`**, plegados y al pie, con su
  propia sección y su propia consulta. No se borraron con el detalle: el puente es lo que evita que
  alguien mire su home banking, vea otra cifra y le crea al banco
- [x] 4.2 La fila de Guardado del dashboard **navega** en vez de abrir el overlay, y es un `Link` de
  verdad —se abre en otra pestaña, se precarga—. El dashboard **ya no monta el overlay**: el estado
  vacío paga un tap de más y a cambio la operatoria queda en un solo lugar (E3, 4b.5)
- [x] 4.3 Verificado: la tira post-ingreso **no monta el overlay** —llama directo a
  `reserveAvailability`—, así que resuelve en el lugar y no la tocó la poda (E3)
- [x] 4.4 **El módulo existe en las DOS apps.** En web y en nativa el único que monta
  `SavingsDrawer` es el módulo, la fila del dashboard navega, y el overlay abre directo a la vista
  que se pidió.
  Esta tarea decía antes que en mobile el overlay seguía en la card «hasta que exista el módulo
  nativo — ahí no hay a dónde navegar todavía», y era **circular**: este change es el que crea el
  módulo. El `proposal.md` nunca sacó a mobile del alcance —lo que declara fuera es plazo fijo, FCI,
  bróker y los placeholders, todo funcional— y la paridad web/mobile es política del producto. Era un
  supuesto disfrazado de decisión (E26)

## 4b. El borde (E10) — DIFERIDO

**Apagar el módulo es una decisión de monetización, y no hay con qué monetizar todavía**: el repo no
tiene ni banderas ni tabla de planes ni suscripciones. Cablearlo hoy sería escribir —y mantener— una
superficie que ningún usuario puede alcanzar, con el riesgo que tiene todo camino que no se recorre:
se rompe en silencio. Se retoma cuando exista el sistema de planes, junto con la publicación en Play
Store.

Lo que SÍ queda hecho y empujado, porque es lo que se olvida y no cuesta nada guardar: la **decisión**
como lógica pura (`packages/savings/src/module-access.ts`, 13 tests). `moduleAccess` resuelve los tres
estados, `moduleShowsNav` / `moduleRouteIsOpen` / `moduleShowsDashboardRow` / `moduleCan` responden qué
se ve y qué se puede en cada uno. Nada de la UI lo consume: el módulo está siempre encendido.
`apps/web/lib/savings/module-enabled.ts` lee `NEXT_PUBLIC_SAVINGS_MODULE` y tampoco lo usa nadie —es
el enchufe, esperando el cable.

El comportamiento ya está normado en E10 y en el spec, así que lo diferido es el cableado, no la
definición.

- [ ] 4b.1 **Estado apagado con guardado en cero** — describe lo que tendría que pasar CUANDO se
  apague, no lo de hoy: se esconde la entrada de menú, se cierra la ruta y no va la fila en el
  dashboard. No hay plata que rescatar ni número que explicar — *decidido en `moduleAccess`/
  `moduleShowsNav`; falta cablear*
- [ ] 4b.2 **Estado apagado con guardado > 0**: la fila del dashboard **se queda y navega** —la card
  tiene que seguir cerrando— y el módulo entra en **estado degradado**: la grilla, los grupos en solo
  lectura y **una sola acción, volver a usar**. Sin crear, sin destinar, sin guardar más — *decidido
  en `moduleCan` (`degraded` solo habilita `read` y `release`); falta cablear*
- [ ] 4b.3 La lista de grupos sobrevive al apagado **porque la acción la necesita**: el invariante de
  la fase 2 no deja sacar de un propósito sin nombrarlo
- [ ] 4b.4 **Verificar que apagar el módulo no cambia ningún número.** El guardado sigue restando del
  disponible: la bandera controla la superficie, nunca la plata. Por construcción se cumple —la
  bandera no toca ninguna consulta— pero se verifica cuando se cablee, no antes
- [x] 4b.5 **No existe fallback al drawer viejo, en ninguna de las dos apps.** Mantenerlo montado en
  el dashboard reintroduciría el acoplamiento que este change saca. En web la fila de guardado es un
  `Link` a `/savings` y `balance-card.tsx` no monta `SavingsDrawer`; en nativa la fila hace
  `router.push('/(app)/savings')` y `BalanceCard.tsx` tampoco lo monta. El único que lo monta, en las
  dos, es el módulo

## 4c. El rediseño (handoff de Claude Design, E12–E15)

`design_handoff_ahorro/` reemplaza la pantalla que las secciones 3 y 4 construyeron. Lo de abajo
—las dos lecturas normativas, los pisos, `module-view.ts`, el cableado al overlay— **no se toca**.

- [x] 4c.1 **La regla del origen único, terminada.** Ya está construida (un origen por operación,
  «Sin destino» preseleccionado, tope a la vista, sin reparto automático). Falta el final del
  mensaje: `savings.errors.exceeds_unassigned_reserved` pasa a *«Sin destino tiene {limit}. Para
  volver a usar más, elegí un propósito.»* — **y una segunda variante sin esa salida** para cuando no
  hay otro grupo con saldo, que es cuando el chip está bloqueado (E12)
- [x] 4c.2 **Traducir la paleta del handoff a los tokens de Grana** (E13). Cálido → frío, `#1B2A33` →
  `--navy`, y **cero tokens nuevos** en esta pasada
- [x] 4c.3 `SavingsCard`: card oscura a todo el ancho, par de monedas con divisor, frase de apoyo, y
  la `ActionBar` de tres acciones como zócalo **de la misma card**. Reemplaza la grilla de 2×2
- [x] 4c.4 `PurposeCard` + grilla `repeat(auto-fill, minmax(330px, 1fr))`. Reemplaza la lista de
  filas. **El emoji se conserva**; lo que se adopta es el contenedor con tinte ciclado (E14)
- [x] 4c.5 `UnassignedBlock`: bloque propio **entre** el total y los propósitos, visible solo con
  monto > 0. Con monto en cero su explicación baja al pie de la lista
- [x] 4c.5b **Corregido en QA: el bloque necesitaba color** (E17). Solo con forma —punteado sobre
  gris— se leía como *deshabilitado*, que es lo contrario de lo que es. Entran
  `--savings-unassigned-{bg,border,text,deep,on-deep}`, con variante dark, derivados del ámbar del
  sistema y NO de `--warning`, que es semántica de alerta. El botón «Destinar» pasa a cálido oscuro:
  en navy competía con el total, que es la superficie de la acción global
- [x] 4c.6 Los formularios adoptan del handoff lo que les faltaba: **segmentado de moneda** de 44 px
  en lugar del chip de 22 —la decisión que más cambia el significado de lo escrito estaba en el
  control más chico—, **atajos de monto** por moneda (+$10.000/+$50.000, +US$10/+US$50, «Todo») que
  se ocultan cuando pasarían el tope, y **CTA con el monto escrito**. **Sin teclado 3×4**:
  `MoneyAmountInput` con `inputMode="decimal"`, que es el teclado del sistema (E14). **No se adoptó
  el rótulo + pregunta**: el título del formulario ya es el verbo, y la eyebrow se había sacado en
  fase 2 justo por decir dos veces la misma palabra
- [x] 4c.7 Detalle de propósito: **emblema junto al nombre** con el mismo tinte que en la grilla —es
  lo que confirma que se entró a donde se quería—, el negativo del historial en **terracotta** (en
  gris se leía igual que la fecha, y las dos direcciones parecían la misma) y el **pie que explica la
  diferencia** entre quitar destino y volver a usar. **Sin fecha y sin subtítulo** (E12). Sin barras
  de progreso ni porcentajes
- [x] 4c.7b **Decidido: «Volver a usar» baja a enlace, no se va.** El handoff la sacaba del detalle;
  dejarla como botón hacía que la pantalla se contradijera (excluía «Guardar» por cambiar el total e
  incluía, con el mismo peso, otra que también lo cambia). Los dos botones quedan para lo que es del
  propósito —sumarle, sacarle—, y las dos salidas que se confundían pasan a tener pesos distintos en
  vez de explicarse al pie. No se pierde el atajo: parado en Viaje, usar esos pesos sigue a un tap
- [x] 4c.8 **Decidido: el campo de monto inicial NO entra** (E21). Compone dos escrituras en dos
  tablas sin transacción, y su peor caso deja al usuario con un propósito que no sabe que creó. El
  camino ya existe y es mejor: entrando por **Destinar**, el «+» del selector crea el nombre y
  vuelve al formulario con el monto ya escrito y el tope a la vista — una sola escritura
- [x] 4c.8b **Crear desde la página sigue a destinarle**, con el propósito ya elegido, en vez de
  cerrar y dejar una fila en cero. Salvo con «Sin destino» en cero, donde destinar tendría tope cero:
  ahí el propósito queda creado y vacío, que es lo único que se puede hacer
- [x] 4c.9 El par de monedas de la card del total pasa a ser **fijo**: `$ 0 / US$ 0` cuando no hay
  saldo. Revierte `moduleShowsUsd`, que hoy esconde la columna, **y sus tests**. En los propósitos la
  regla NO cambia: nunca «US$ 0»
- [x] 4c.10 **El chrome no vuelve** (E15): `/savings` sigue en `CHROMELESS_SECTIONS`, contra lo que
  dibuja el desktop del handoff
- [x] 4c.11 Al confirmar **no hay toast**: cerrar el overlay es el acuse, como en el resto de la app.
  El handoff pedía «confirmación breve»
- [ ] 4c.12 **Backlog, no bloquea nada.** Fuera de esta pasada, anotado para no perderlo: el set de emblemas SVG con su migración,
  «Ver todos» a partir de 8 propósitos, y el panel lateral de 420 px que empuja el stage — el drawer
  de 480 px ya cubre esa lectura en desktop

- [x] 4c.13 **Pasada de coherencia antes del QA** (E19): ancho de las tres secciones, radios a los
  tokens del sistema, escala tipográfica unificada, el ícono de «Sin destino» que chocaba con el de
  crear, el desglose vacío, los tokens sobre oscuro, el divisor frágil de la botonera y `shortDate`
  duplicado

- [x] 4c.14 **Crear un propósito acusa la creación** (E22). Encontrado en QA: se creaba, la pantalla
  pasaba a destinar dando por sabido que existía, y quien cerraba ahí volvía a crearlo para chocar
  con «ya tenés un propósito llamado…». La cabecera pasa a «Listo, creaste …» con lo que todavía le
  falta, y gana una salida explícita: destinar es opcional

- [x] 4c.15 **Spec y design al día con lo que el QA cambió** (E23): el spec gana los requisitos que
  no existían al planificar —jerarquía no responsive, el overlay sin lectura, el propósito sin plata,
  el acuse de creación, el origen único con su mensaje, el nombre con espacios y el borrador que
  sobrevive a los desvíos— y el design registra los cinco bugs, el patrón de apartarse del sistema y
  las tres lecciones de poner un techo

## 5. Lo que no se toca

- [x] 5.1 **Verificado con `git diff` desde el commit que abre el change**: cero cambios en
  `supabase/` y en `packages/savings/src/mutations.ts`. Cero cambios en
  `write_reserve`
- [x] 5.2 **Verificado**: cero cambios en Cuentas y Movimientos **desde que abrió este change**
  (`e7cf96f..HEAD`). Antes decía «en TODA la rama», y eso era sobreafirmar: la rama sí los tocó, en el
  rediseño del dashboard que vino antes. Lo que este change promete es no tocarlos, y eso se cumple
- [x] 5.3 **Verificado**: cero cambios en `packages/dashboard/src` desde que abrió el change, así
  que la identidad de la card no puede haberse movido — no hay dónde

## 6. QA

- [x] 6.1 **QA web hecho.** Guardar (con propósito nuevo creado en el medio), destinar, volver a
  usar, quitar destino y borrar un propósito —con su plata volviendo al resto—, con los mismos topes y
  pisos que antes
- [x] 6.2 **El default del origen al volver a usar** (E7) — **cerrado sin QA**: preseleccionar es
  aceptable mientras el chip esté visible y se pueda cambiar antes de confirmar; no es imputación
  silenciosa si está en pantalla. La regla completa: un solo grupo con saldo → directo al monto;
  varios y «Sin destino» con saldo → preseleccionado; varios y el resto en cero → **sin
  preselección**; desde un propósito → heredado. **Nunca se toca un propósito sin mostrarlo antes.**
  Falta verificar el tercer caso, que hoy no está implementado así
- [x] 6.3 **Auditado**: los únicos `+` del módulo son glifos de signo, no sumas, y cada `money()`
  lleva su moneda explícita. `moduleHasSavings` usa `some` y no una suma
- [x] 6.7 **La grilla en 360 px con montos de ocho cifras en las dos monedas** — corrido sobre la
  pantalla real, midiendo cajas de 320 a 1280 (E24). **La card del total cortaba el monto de
  dólares** contra el borde —«US$ 12.», y también «US$ 900,0» con los montos reales del QA— y a
  320px el monto de «Sin destino» se metía por debajo del botón «Destinar». Los dos se arreglan con
  la misma regla: cada pieza pide como mínimo lo que mide su propio número y la fila se parte cuando
  esos mínimos no entran — **por contenido, sin un solo `@media`**.
  **Las cards de propósito NO se tocan**: se probó partirlas en dos líneas y se descartó en QA
  —crecían de 79 a 96px y la grilla quedaba con altos distintos—. Ahí el nombre trunca sin piso y las
  tres miden 72px. Verificado: ningún desborde y ningún scroll horizontal de 320 a 1280
- [ ] 6.7b **Los centavos del módulo, contra la preferencia de la app** (E24, destapado por 6.7).
  El módulo formatea con centavos fijos —en tres definiciones locales de `money`— mientras la app
  tiene `showCents` y el dashboard lo respeta: la fila «Guardado» y el total del módulo son el mismo
  número con dos formatos. Además es lo que deja la card apilada en el teléfono para casi cualquier
  monto real. **No se toca en este change**: cambia todos los números del módulo, incluidos los de
  los formularios y los mensajes de tope, con el QA visual nativo por correr. **No bloquea nada**
- [x] 6.8 **Los enlaces de «Sin destino» con el pulgar**: 44 px de área táctil por pseudo-elemento,
  sin inflar la fila. Verificado en QA — no cuesta acertarles. Pegados
  por un punto medio, el error más probable es tocar *Volver a usar* queriendo *Destinar* — la que
  saca plata del disponible y la que no lo toca
- [x] 6.4 **Regresión del dashboard verificada CON DATOS del QA**: guardar $15.000 movió el guardado
  de 180.000 a 195.000 y el disponible de 4.905.748,17 a 4.890.748,17 —exactamente $15.000 en cada
  lado—, y la identidad del mes cierra al centavo en las dos monedas. La fila navega, la tira sigue
- [x] 6.10 **La tira post-ingreso ignoraba los ingresos en dólares** (E25). Salió del QA de 6.7:
  cargar un ingreso en USD no la despertaba, el mismo importe en ARS sí. `save-suggestion-strip.tsx`
  tenía `'ARS'` escrito en seis lugares mientras la consulta de abajo siempre recibió la moneda por
  parámetro. Ahora la tira sigue **la moneda del ingreso más reciente**, es **una sola** y deriva todo
  —disponible, historial, porcentaje— de esa misma moneda. `pickLatestIncome` en el paquete, con
  tests. No se notó antes porque es la única superficie del módulo que no vive en el módulo: aparece
  en el dashboard, y quedó afuera de todas las pasadas sobre la pantalla de ahorro
- [x] 6.11 **El dólar de «Sin destino» va debajo del peso**, no a su lado: en una línea los dos
  montos se leían como un solo importe partido, y la única señal de que son dos cosas que nunca se
  suman era el cambio de cuerpo. Como columna, el dólar cae siempre alineado bajo el peso —no cuando
  el ancho lo obliga—, igual que en las cards de propósito
- [x] 6.12 **La tira, en teléfono** (E25): «Suficiente por este mes» se salía de la pantalla. **El
  monto va en un solo lugar** —estaba en el cuerpo y en el botón, a dos renglones de distancia—: queda
  en el TEXTO, que es donde vive la propuesta, y el botón vuelve a ser «Guardar». Eso solo no
  alcanzaba: lo que se salía era el tercer control, así que **«Suficiente por este mes» → «No más
  este mes»**, que además empareja las dos salidas —«Ahora no» / «No más este mes»—, y el botón pasa a
  `px-3`, porque el aire se calibra contra lo que dice y ya no dice un monto. Sin filas de más. Medido
  de 320 a 430 con ocho cifras en el texto
- [ ] 6.5 **QA visual nativo** — lo único que le falta al módulo en mobile, que por lo demás está
  **implementado**. Bloqueado por acceso, issue #58, que ya cubre todo: las cinco frases de copy, la
  tira siguiendo la moneda del último ingreso, el nombre con espacio de más, y una **sección C** de
  30 checks para el módulo nativo —la ruta, la entrada del menú, la card oscura, el desglose, el pie
  y la regresión— con el aviso de que es código que corre por primera vez
- [ ] 6.16 **Definition of Done de un fix mobile, y el protocolo de runtime.** Viven en
  `docs/qa-savings-nativo.md`. Un arreglo de Ahorro no está cerrado hasta que quedan registradas seis
  líneas: el componente web-mobile, el nativo, qué cambio se aplicó **en las dos**, la divergencia de
  plataforma si la hay y por qué, si hace falta limpiar caché o rebuildear, y qué caso del QA cierra.
  El bloque va acá abajo, en 6.15. Cuatro de esas líneas existen por errores que ya cometimos: el
  recorte de «Destinar» que entró en un archivo y no en el otro, el techo de chips que era distinto
  en cada superficie, y dos vueltas enteras reportando como roto un fix que estaba bien pero corría
  contra un bundle viejo. Y el protocolo que separa un caso del otro —hash, `grep` del código viejo,
  `expo start -c`, reinstalar, rebuild— con su señal: un problema de implementación deja ver algunos
  cambios y otros no; cero cambios sobre varios commits es runtime
- [ ] 6.15 **Hallazgos del QA visual nativo, corregidos sobre la marcha.** El QA está corriendo (6.5)
  y lo que fue apareciendo se arregló y se volvió a mirar. Nueve hasta acá, en tres tandas:

  **Primera** — el `+` de crear propósito había quedado al final de los chips en nativo, donde caía
  huérfano en su propio renglón, en vez de al lado del rótulo como en web; y el monto tipeado se
  comía el primer dígito y metía una coma sola al borrar, porque nativo tenía su propio
  `remapDecimalDot` en vez del criterio compartido. El criterio pasó a
  `@grana/validation/money-input-format` como `resolveTypedMoneyText`, con **11 tests** — puestos en
  `apps/web/lib/__tests__` y no en el paquete, porque `pnpm test` no corre lo que vive en `packages/`.

  **Segunda** — «Volver a usar» partía la barra de acciones del total: en 360px la celda de un grid de
  tres mide 109px, y el rótulo a 12px con `gap-2 px-2` necesita 126. En web envolvía en dos filas; en
  nativo, con `numberOfLines={1}`, se truncaba con puntos suspensivos, que es la misma falla contada
  de otra manera. A 11.5px con `gap-1 px-0` necesita 104 y entra con margen; `sm:` recupera el aire
  donde sobra ancho. Y el explicativo de «Sin destino» perdió el «Sigue guardado:» que lo partía en
  dos renglones: lo que decía ya lo dice el bloque que lo contiene.

  **Tercera** — el CTA de «Guardar» / «Volver a usar» / «Destinar» quedaba abajo del pliegue.
  `FormSheetBody` recibía un tope fijo de 560px contra un panel topeado al 90% de la pantalla: en un
  teléfono alto sobraban ~100px que nadie usaba, y en un SE de 568 el contenido pasaba el 90% y el
  `overflow-hidden` del panel se lo comía — el botón no quedaba «hay que scrollear» sino
  **inalcanzable**. El tope ahora lo reparte `useSheetBodyMaxHeight()`, que vive en `BottomSheet` al
  lado de las constantes que lo componen. Con él salieron tres divergencias más que el QA ya venía
  señalando: la fecha nunca había recibido el cambio que web sí tenía —iba con recuadro propio y con
  el disparador en pastilla adentro de una card que ya tiene borde—, «Destinar» pedía el monto con
  otras medidas que «Guardar» siendo dos vistas del MISMO sheet, y el resumen, los chips y los
  rótulos del formulario estaban cada uno un punto arriba de lo que usa web.

  **Cuarta** — el pie del formulario y los mensajes de tope entraban en dos renglones. Los dos se
  acortaron **midiendo contra la métrica real de Plus Jakarta Sans**, no a ojo: el pie pasa a «Sigue
  en tus cuentas: ya no está para gastar» / «…vuelve a estar para gastar», que además usa la palabra
  de la card de saldo —«para gastar»— y no «disponible»; y los topes pasan a **verbo + monto** («No
  podés destinar más de $ 41.635»), porque cuál es el bolsillo lo dicen el chip elegido y la fila del
  resumen justo arriba. Entran en una fila de 320 a 390px, con montos de ocho cifras en las dos
  monedas. La única excepción, a propósito: `exceeds_unassigned_reserved_pick`, que además del tope
  **nombra la salida** («elegí un propósito») — es lo único que dice dos cosas, y por eso ocupa dos
  renglones.

  De paso cerró un bug: `exceeds_purpose_reserved` interpolaba `{purpose}`, pero por el camino del
  servidor `t()` recibe solo `limit` — el mensaje mostraba **«{purpose}» literal en pantalla**. Sin
  ese parámetro, no puede volver a pasar.

  **Cuarta bis — «Destinar», con el bloque de 6.16 ya aplicado.** Es el primer fix registrado con la
  checklist, y el que la motivó:

  ```
  ### El CTA de «Destinar» quedaba abajo del pliegue
  - Web mobile:   apps/web/lib/savings/components/purpose-allocate.tsx
  - Nativo:       apps/mobile/components/savings/PurposeAllocate.tsx
  - Cambio:       card de monto a 27px con padding 12; bloques a mt-2.5; rótulo
                  pegado a sus chips; resumen py-2.5 con filas py-0.5; techo de
                  DOS FILAS de chips vía `fitChipCount`; zócalo sin el `-mb-6`
                  que encogía el contenido por debajo de su bloque contenedor.
  - Divergencia:  los 44px táctiles. Web los saca de un `::after` que no ocupa
                  lugar; nativo no tiene pseudo-elementos y los sacaba de
                  `min-h-[44px]`, o sea alto real. Pasan a `hitSlop`, que es el
                  equivalente nativo. El de los chips es solo vertical: uno
                  horizontal los solaparía entre sí.
  - Runtime:      requiere `expo start -c` — el cambio toca `packages/savings`.
  - Cierra:       caso 8.
  ```

  El fix salió PARTIDO: el recorte había entrado en `savings-drawer` —«Guardar» y «Volver a usar»— y
  no en `purpose-allocate`, así que «Destinar» siguió pidiendo scroll en las dos superficies mientras
  los otros dos ya entraban. Es exactamente lo que el corolario de la política Web ↔ Mobile nombra
  como señal, y la razón de que la checklist pida los dos archivos nombrados y no uno.

  **Quinta — la card de «Sin destino», demasiado alta en nativo.**

  ```
  ### La card de «Sin destino» tenía aire muerto abajo
  - Web mobile:   apps/web/app/(app)/savings/_components/savings-breakdown.tsx
  - Nativo:       apps/mobile/components/savings/SavingsBreakdown.tsx
  - Cambio:       card a py-2.5; el separador a mt-2/pt-2 (`sm:` devuelve el aire
                  en escritorio); en nativo, el botón «Destinar» y el enlace
                  «Volver a usar de acá» pasan de `min-h-[44px]` —alto REAL— a
                  padding propio más `hitSlop`. Estructura, copy y lógica intactos.
  - Divergencia:  los 44px táctiles, otra vez: web los saca de un `after:h-11`
                  que no ocupa lugar y nativo no tiene pseudo-elementos.
                  `hitSlop` es el equivalente; queda como divergencia aceptada.
  - Runtime:      requiere `expo start -c`.
  - Cierra:       caso 3.
  ```

  El aire muerto era UNO solo y medible: el enlace tenía `min-h-[44px]` con el texto
  arriba, así que medía 44px reales para una línea de 17 y los 27 sobrantes colgaban
  al pie. Web ya lo había resuelto con el pseudo-elemento —el comentario del archivo
  lo dice con todas las letras— y nativo nunca lo recibió. La card pasa de 133px a
  90px; web, de 98 a 90. Las dos quedan en la misma altura.

  **Sexta — el ritmo vertical de los tres formularios.** El recorte se había pasado de rosca: entraban
  sin scroll pero se leían amontonados.

  ```
  ### Devolver aire vertical a los tres sheets, sin volver al layout alto
  - Web mobile:   apps/web/lib/savings/components/savings-drawer.tsx
                  apps/web/lib/savings/components/purpose-allocate.tsx
  - Nativo:       apps/mobile/components/savings/SavingsDrawer.tsx
                  apps/mobile/components/savings/PurposeAllocate.tsx
  - Cambio:       ritmo de DOS pasos entre bloques — 16px donde el ojo separa
                  temas (atajos→fecha, fecha→«Para qué», chips→resumen,
                  helper→CTA), 10-12px donde dos cosas son una sola (rótulo→chips,
                  monto→atajos). El resumen respira adentro (py-3), y el aire sale
                  de micro-altura y no de pegar bloques: la caja del número baja
                  de 54 a 46, que para una cifra de 27px sigue holgada.
  - Divergencia:  ninguna. Los mismos valores en las dos superficies; en web se
                  cayeron los `sm:` que ya no aportaban nada.
  - Runtime:      requiere `expo start -c`.
  - Cierra:       casos 6, 7 y 8 (la parte de ritmo; el scroll ya estaba cerrado).
  ```

  Medido: el formulario pasa de 544px a 578. Contra el cuerpo útil de cada teléfono —el 90% de la
  pantalla menos el agarradero, el colchón y los insets— quedan **+105px en un iPhone 16 Pro** y
  **+14px en un Android de 360×740**. En un SE de 320×568 no entra ni entraba: ahí scrollea 117px.

- [x] 6.14 **Comparativa web ↔ nativa, superficie por superficie** (E27): **nueve divergencias**, tres
  graves —lo tipeado se perdía en el desvío, el detalle de un propósito tenía botón y enlace
  invertidos, y el tope negaba sin ofrecer la salida—. Las nueve corregidas. La comparación mecánica
  de claves de i18n encontró cinco de ellas y hoy da **cero** diferencias: la única que queda es
  `date_label`, aceptada porque en nativo el selector de fecha lo rotula el sistema operativo
- [ ] 6.13 **El módulo nativo está implementado y SIN QA visual nativo: nunca se ejecutó.**
  Lo que las seis verificaciones de 6.6 **no** pueden afirmar: que la pantalla se dibuje, que el
  envoltorio de las dos monedas rompa la línea donde corresponde, que los bordes que hacen de divisor
  caigan entre las monedas y no alrededor, que los tokens cálidos pinten, que el teclado no tape el
  CTA, que el `BottomSheet` abra y cierre con gesto, que el picker de fecha nativo devuelva la fecha,
  y que la navegación desde el menú y desde la fila llegue. TypeScript compara tipos y ESLint lee
  sintaxis; ninguno de los dos ejecuta un layout. Typecheck y lint en verde es todo lo que hay:
  no hay forma de correr Expo desde acá. Lo que más riesgo tiene, en orden: el envoltorio de las dos
  monedas de la card oscura (Yoga y el navegador no rompen la línea igual), los bordes que hacen de
  divisor —que dependen de `overflow: hidden` con margen negativo—, y el efecto que corrige el origen
  vacío al volver a usar
- [x] 5.5 **Con tests lo nuevo que es lógica pura**: `moneyParts` —que parte lo que devuelve `Intl`
  en vez de armar el número a mano, y si el corte se moviera pondría un «$» en el medio de la cifra—
  y `purposeTint`, cuya única promesa es que el mismo propósito se vea igual siempre: si se rompe no
  falla ningún test de plata, pero alguien deja de reconocer «Viaje» de un vistazo
- [x] 5.4 La derivación de qué muestra el módulo —si hay guardado, si va la columna de dólares, el
  orden de los propósitos y cuántos montos muestra una fila— vive en `@grana/savings/module-view.ts`,
  **no adentro de los componentes**. Mismo precedente que `balance-card-view.ts`: escrita en el
  componente, mobile la reescribiría y divergirían, que es la forma exacta en que la 0051 tuvo que
  deshacer una cuenta duplicada. 18 tests con los números reales de agosto
- [x] 6.6 **Verificación completa en verde**, corrida sobre el módulo nativo ya implementado:
  `openspec:check`, typecheck web, typecheck mobile, lint web, lint mobile, 711 tests en 62 archivos
  y build de producción de web. **Ninguna de estas seis ejecuta una sola pantalla nativa** — ver 6.13
- [x] 6.9 Verificación previa al QA: **build de producción** —que agarra lo que el typecheck no ve— y
  los 18 tests de la derivación. Encontró y cerró: la entrada faltante en el sidebar, `/savings` fuera
  de `CHROMELESS_SECTIONS`, las dos consultas en un solo container, y los fallbacks sin alto reservado

## 7. Compuertas

- [ ] 7.1 **No archivar** hasta el **QA visual nativo**, como las fases 1 y 2. La compuerta no es
  «que mobile esté implementado» —ya lo está— sino que alguien lo haya visto correr
- [ ] 7.2 **La fase 3A (plazo fijo) se construye adentro de este módulo** y por eso va después. El
  mock `fase-3a-plazo-fijo.html` hay que redibujarlo con la cuenta como **atajo contextual** y no
  como arquitectura

## 8. Un bug crítico que este change destapó

- [x] 8.1 **`get_available_sums` omitía el saldo inicial de las cuentas. Cerrado.**

  **Síntoma.** «Para gastar» mostraba el número correcto un instante y después bajaba, en web y en
  nativa. El Hero llega server-rendered y pinta el total de cuentas; cuando resolvía la consulta del
  disponible, lo pisaba con un número más chico. Y como «Tenías» **se deriva** de ese número, se
  corrían todos los términos de la card a la vez — sin dejar de cerrar, que es lo que lo hacía
  silencioso.

  **Causa.** La 0057 componía `accounts_net` con `get_account_balance_sums`, que devuelve **solo el
  neto de movimientos** por cuenta y moneda. El saldo de una cuenta es `initial_balance + neto de
  movimientos`, y el primer sumando nunca entró: la palabra `initial_balance` no aparecía en toda la
  migración. La diferencia era exactamente la suma de los saldos iniciales declarados.

  **Fix.** Migración **0060**: `accounts_net` pasa a ser *saldo inicial vigente + neto de
  movimientos*, con la misma regla de `initial_balance_date` que aplica el Hero. Va ahí y no en
  `get_account_balance_sums`, que tiene un significado propio y correcto — cambiárselo arreglaría
  este call site y rompería los otros dos.

  **Verificación.** Treinta y tres tests sobre la SQL que se envía (PGlite), agregados al archivo que
  ya cubría la 0057 **sin tocar sus quince**: el inicial sin movimientos, el corte por fecha en sus
  tres bordes, cuenta archivada y tarjeta fuera del universo, bimoneda, filas vacías, y **paridad
  contra el Hero** —contra `accounts_net` y nunca contra `available`, que ya restó lo guardado—.
  Comprobado que **15 de los 33 se ponen en rojo al quitar el fix**. Más verificación manual en la
  app real: los cuatro consumidores de la función, dos usuarios, dos monedas, todo al centavo.

  **Estado: cerrado.** El QA visual nativo estaba corriendo sobre un número base equivocado; recién
  con esto tiene sentido mirarlo.

- [ ] 8.2 **Backlog destapado por el barrido posterior.** Ninguno bloquea el QA ni el archivado, y
  **ninguno es de este change** — se anotan acá porque acá se encontraron.

  - **`initial_balance_date` no se aplica en Cuentas.** El Hero y `get_available_sums` respetan la
    fecha del saldo inicial; las tres composiciones de `packages/accounts` no. Con un inicial fechado
    a futuro, el detalle de la cuenta muestra un número distinto del que esa cuenta aporta al
    disponible. Divergencia real, incidencia muy baja.
  - **`computeBalance` está sin uso y su lógica duplicada tres veces.** Vive en
    `packages/accounts/src/balance.ts`, se re-exporta desde web, y nadie la llama: los tres lugares
    que calculan saldo inlinean la misma aritmética. Es el patrón que la 0051 dejó documentado como
    causa de divergencia, y es **por qué el punto anterior pudo pasar**. Conviene arreglarlos juntos.
  - **La 0057 conserva la definición vieja de `get_available_sums`.** Aplicar todo en orden queda
    bien porque la 0060 va después; re-ejecutar solo la 0057 devuelve el bug. Falta una nota en su
    encabezado.
  - **El copy «Tu banco muestra»** del puente rotula `accountsNet`, que es el cálculo de Grana y no
    un dato del banco. Inocuo mientras los dos números coincidan; falso en una cuenta con drift. Ya
    estaba anotado en `docs/exploracion-rendimiento-cuentas.md` §2.3, con
    *«En tus cuentas, según Grana»* como reemplazo propuesto.
