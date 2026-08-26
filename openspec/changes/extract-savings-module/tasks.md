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
- [ ] 4.1b Los **formularios**: hoy los botones globales abren el overlay existente **directo al
  formulario** (`initialMode`), así que su vista de detalle nunca se dibuja y no hay lectura
  duplicada. Falta cablear las filas de propósito (detalle), los enlaces del resto (destinar / volver
  a usar) y después **podar del overlay la vista de detalle**, que ya vive en la página
- [ ] 4.2 La fila de Guardado del dashboard **navega** en vez de abrir el overlay
- [ ] 4.3 La tira post-ingreso queda donde está, y su acción sigue resolviendo en el lugar (E3)
- [ ] 4.4 Verificar que ningún formulario de ahorro quedó montado en otra superficie

## 4b. El borde (E10)

- [ ] 4b.1 **Estado apagado con guardado en cero**: sin entrada de menú, sin ruta, sin fila en el
  dashboard. No hay plata que rescatar ni número que explicar
- [ ] 4b.2 **Estado apagado con guardado > 0**: la fila del dashboard **se queda y navega** —la card
  tiene que seguir cerrando— y el módulo entra en **estado degradado**: la grilla, los grupos en solo
  lectura y **una sola acción, volver a usar**. Sin crear, sin destinar, sin guardar más
- [ ] 4b.3 La lista de grupos sobrevive al apagado **porque la acción la necesita**: el invariante de
  la fase 2 no deja sacar de un propósito sin nombrarlo
- [ ] 4b.4 **Verificar que apagar el módulo no cambia ningún número.** El guardado sigue restando del
  disponible: la bandera controla la superficie, nunca la plata
- [ ] 4b.5 **No existe fallback al drawer viejo.** Mantenerlo montado en el dashboard reintroduciría
  el acoplamiento que este change saca

## 5. Lo que no se toca

- [ ] 5.1 Cero cambios en `availability_reserve`, `savings_purpose_allocation`, sus triggers y
  `write_reserve`
- [ ] 5.2 Cero filas nuevas en Cuentas y cero entradas nuevas en Movimientos
- [ ] 5.3 La identidad de la card del mes sigue cerrando, con los mismos números

## 6. QA

- [ ] 6.1 Guardar, volver a usar, destinar y quitar destino desde el módulo, con los mismos topes y
  pisos que antes
- [x] 6.2 **El default del origen al volver a usar** (E7) — **cerrado sin QA**: preseleccionar es
  aceptable mientras el chip esté visible y se pueda cambiar antes de confirmar; no es imputación
  silenciosa si está en pantalla. La regla completa: un solo grupo con saldo → directo al monto;
  varios y «Sin destino» con saldo → preseleccionado; varios y el resto en cero → **sin
  preselección**; desde un propósito → heredado. **Nunca se toca un propósito sin mostrarlo antes.**
  Falta verificar el tercer caso, que hoy no está implementado así
- [ ] 6.3 Bimoneda: nada suma ARS con USD en ninguna pantalla del módulo
- [ ] 6.7 **La grilla en 360 px con montos de ocho cifras en las dos monedas**: cuando no entra, la
  fila se parte en dos líneas —rótulo arriba, montos abajo— y **ningún monto se achica ni se corta**
  (D24). El quiebre depende del contenido, no del ancho de la pantalla, así que no puede ser un
  `@media`
- [ ] 6.8 **Los enlaces de «Sin destino» con el pulgar**: 44 px de alto cada uno y separados. Pegados
  por un punto medio, el error más probable es tocar *Volver a usar* queriendo *Destinar* — la que
  saca plata del disponible y la que no lo toca
- [ ] 6.4 Regresión del dashboard: ningún número cambió, la card cierra, la tira sigue apareciendo
- [ ] 6.5 QA nativo del módulo — **bloqueado por el mismo acceso que el issue #58**
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
