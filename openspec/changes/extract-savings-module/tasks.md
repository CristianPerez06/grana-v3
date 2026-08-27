# Tasks: extract-savings-module

> **Sin migraciones.** Si este change termina tocando SQL, algo se entendió mal (E6).

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
- [ ] 2.3 Dibujar la **puerta sobria** desde el dashboard: la fila de Guardado lleva al módulo sin
  convertir la card en su casa

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
- [ ] 2.9 **Para mirar usándolo**: si guardar-para-un-propósito (5 taps) se siente lento, si el copy
  *«¿Para qué es?»* del sheet B se entiende, y si la grilla de la cabecera se sostiene con plata real
  en las dos monedas
- [x] 2.7 **La flecha de volver va arriba a la IZQUIERDA**, antes del título, como control de 44×44
  con borde — el `DrawerBackHeader` que la app ya usa. Los mocks de la fase 3 y del módulo la tenían a
  la derecha: se había reusado el slot del ✕ de cerrar, que sí va a la derecha. Son dos controles
  distintos y estaban confundidos

## 3. La ruta y la entrada

- [x] 3.1 Ruta web **`/savings`** con su layout y estados de carga. La ruta va en inglés como todas
  —`/accounts`, `/cards`, `/transactions`— y el rótulo del menú en castellano, **«Ahorro e
  inversión»**, como todos. Que no coincidan es lo normal: `/shared` se llama *Compartido* (E11)
- [x] 3.2 Entrada en el menú web (`app-menu.tsx`), con el rótulo `nav.savings` — que existía como
  clave huérfana ("Ahorros") y pasa a **«Ahorro e inversión»**. Falta el chrome mobile
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

- [ ] 4b.1 **Estado apagado con guardado en cero**: sin entrada de menú, sin ruta, sin fila en el
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
- [x] 4b.5 **No existe fallback al drawer viejo.** Mantenerlo montado en el dashboard reintroduciría
  el acoplamiento que este change saca. En web ya no existe: la fila de guardado es un `Link` a
  `/savings` y `balance-card.tsx` no monta `SavingsDrawer`. En mobile sigue montado y así queda hasta
  que exista el módulo nativo (4.4)

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
- [ ] 4c.12 Fuera de esta pasada, anotado para no perderlo: el set de emblemas SVG con su migración,
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
- [x] 5.2 **Verificado**: cero cambios en Cuentas y Movimientos en TODA la rama, no solo en este
  change
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
  los formularios y los mensajes de tope, con el QA nativo por correr
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
- [ ] 6.5 QA nativo — **bloqueado por acceso, issue #58**. El ticket cubre las cinco frases de copy,
  la tira siguiendo la moneda del último ingreso y el nombre con espacio de más; **falta agregarle el
  módulo nativo entero**, que se construyó después de ampliarlo: la ruta, la entrada del menú, la fila
  del dashboard navegando y el overlay sin vista de detalle
- [x] 6.14 **Comparativa web ↔ nativa, superficie por superficie** (E27): **nueve divergencias**, tres
  graves —lo tipeado se perdía en el desvío, el detalle de un propósito tenía botón y enlace
  invertidos, y el tope negaba sin ofrecer la salida—. Las nueve corregidas. La comparación mecánica
  de claves de i18n encontró cinco de ellas y hoy da **cero** diferencias: la única que queda es
  `date_label`, aceptada porque en nativo el selector de fecha lo rotula el sistema operativo
- [ ] 6.13 **El módulo nativo no se ejecutó nunca.** Typecheck y lint en verde es todo lo que hay:
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
- [ ] 6.6 `pnpm openspec:check`, lint, typecheck (web y mobile) y tests en verde
- [x] 6.9 Verificación previa al QA: **build de producción** —que agarra lo que el typecheck no ve— y
  los 18 tests de la derivación. Encontró y cerró: la entrada faltante en el sidebar, `/savings` fuera
  de `CHROMELESS_SECTIONS`, las dos consultas en un solo container, y los fallbacks sin alto reservado

## 7. Compuertas

- [ ] 7.1 **No archivar** hasta el QA nativo, como las fases 1 y 2
- [ ] 7.2 **La fase 3A (plazo fijo) se construye adentro de este módulo** y por eso va después. El
  mock `fase-3a-plazo-fijo.html` hay que redibujarlo con la cuenta como **atajo contextual** y no
  como arquitectura
