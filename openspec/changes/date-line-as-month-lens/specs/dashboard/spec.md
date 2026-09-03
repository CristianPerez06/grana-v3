## MODIFIED Requirements

### Requirement: El header del dashboard saluda al usuario y muestra la fecha de hoy

El header del dashboard SHALL mostrar un saludo `Hola, {name}` usando el nombre del perfil (key `dashboard.welcome`), con fallback a `dashboard.welcome_anon` ("Hola") cuando el perfil no tiene nombre. El saludo NO SHALL llevar punto final: lo que cierra la frase es el nombre de la persona, y un punto detrás lo hacía leer como un dato pegado desde el perfil en vez de como el saludo que es. El header SHALL mostrar la fecha del día calculada desde la zona horaria financiera del usuario vía `getTodayAR()`; NO SHALL usar `new Date()` directo del navegador/servidor. El botón "Nuevo movimiento" vive en este header **solo en desktop-web** (viewport `≥sm`) — en mobile-web el acceso primario para registrar es el FAB definido en la spec de `transactions` y NO se renderiza en el header. En desktop el saludo es el título grande del header; en la app nativa el saludo se pinta dentro del header navy.

El header SHALL contener **exactamente dos piezas de contenido**: el saludo y la línea de la fecha, una por fila. NO SHALL alojar el `eye toggle` ni el navegador mensual, que viven en la card de saldo y en la propia línea de la fecha respectivamente (ver sus requirements). El header es identidad de página —quién sos y qué día es—; un control de alcance metido ahí competía por ancho con el nombre de la persona y prometía gobernar cosas que no gobierna.

**La línea de la fecha ES el selector de mes**, no un rótulo pasivo al lado de uno. SHALL ser activable (tap/click, con rol y foco accesibles) y SHALL abrir la hoja de meses. SHALL llevar un indicador visual permanente de que es un control —un caret junto al texto— porque sin él nada distingue una fecha tocable de una fecha impresa. La línea SHALL estar habilitada desde el primer paint: NO SHALL depender de la query del nombre del perfil, que es la única razón por la que los controles del header se renderizaban disabled.

El texto de la línea SHALL reflejar **desde dónde está mirado el dashboard**:

- Parado en el **mes corriente**, SHALL decir la fecha de hoy completa (`Miércoles, 2 de septiembre`), porque el saldo es el de hoy.
- Parado en **cualquier otro mes**, SHALL decir ese mes y su año (`Agosto 2026`), porque el saldo se corta al último día de ese mes.
- Parado fuera del mes corriente, SHALL ofrecer junto a la línea una acción **"Volver a hoy"** que devuelve la selección al mes corriente. NO SHALL renderizarse en el mes corriente.

La línea NO SHALL decir "al cierre de". Eso ya lo dice el rótulo de la card de saldo (ver "El Hero muestra el disponible total bimoneda"), pegado al número que califica; decirlo también acá es el mismo hecho dos veces y, medido, no entra: a 320px la fila queda con 2px de margen, que no es margen.

La línea SHALL ocupar **un solo renglón en todo ancho**, y cuando no entre SHALL **degradar por pasos, no de entrada**:

1. Texto completo (`Miércoles, 2 de septiembre`).
2. Sin el día de la semana (`2 de septiembre`) — es la parte menos informativa, porque el número del día ya está.
3. Elipsis como piso.

NO SHALL acortarse el mes a tres letras de manera incondicional: eso era un parche para el ancho que le robaban los controles, y al irse los controles la línea tiene el ancho entero. La degradación SHALL vivir en una única función compartida por ambas plataformas (`formatTodayLine` en `@grana/dashboard`), no duplicada por app.

La degradación NO es hipotética: la app NO topea el escalado de fuente del sistema, y a 320px en la app nativa la fila deja de entrar alrededor de 1.40× de escala. Los pasos SHALL ejercitarse con el peor caso —el día de la semana más largo, el mes más largo y un día de dos cifras— y no con una fecha cualquiera.

En **web**, el header SHALL renderizarse desde el primer paint sin esperar al fetch del contenido del dashboard. Para lograrlo, el header y sus providers de estado (`EyeMaskProvider`, `DashboardMonthProvider`) SHALL montarse desde `apps/web/app/(app)/dashboard/layout.tsx` (Variant C del spec `route-loading-and-errors`), no desde `page.tsx`. El layout SHALL ser un Server Component async que lee las preferencias server-side necesarias para inicializar los providers (ej. `getEyeMasked()`, el mes actual vía `getTodayAR()`); el `page.tsx` SHALL ser sync para no suspender el segmento. Como el chrome vive en el layout, queda persistente entre cualquier transición de `{children}` (loading, error, navegación a hijos), garantizando el primer paint inmediato del header.

Como el nombre del perfil se resuelve client-side (vía el cliente browser de Supabase), el header SHALL exhibir un **estado de carga** mientras esa query no resuelve: el saludo SHALL usar el fallback `dashboard.welcome_anon` ("Hola") aunque exista un perfil con nombre. En desktop-web el botón "Nuevo movimiento" SHALL renderizarse disabled durante ese estado (ver su requirement). Cuando la query resuelve, el header SHALL actualizarse al saludo personalizado. Si la query falla, el header SHALL permanecer indefinidamente en el saludo anon pero el botón SHALL habilitarse igual para no bloquear al usuario.

La fecha del header NO SHALL depender de esa query: SHALL calcularse en el server o en el primer render con `getTodayAR()` y mantenerse estable entre el estado disabled y el habilitado.

#### Scenario: Saludo con nombre del perfil

- **WHEN** el usuario con nombre "Cristian" carga `/dashboard`
- **THEN** el header termina mostrando "Hola, Cristian" (sin punto final)
- **AND** muestra la fecha de hoy en la zona horaria financiera (AR)

#### Scenario: Saludo sin nombre usa fallback

- **WHEN** el usuario no tiene nombre cargado en el perfil
- **THEN** el header muestra "Hola"

#### Scenario: La fecha de hoy se calcula desde la zona financiera

- **WHEN** se renderiza la fecha del header del dashboard
- **THEN** el valor se deriva de `getTodayAR()` y NO de `new Date()` directo

#### Scenario: La línea de la fecha se ve como un control

- **WHEN** el usuario abre el dashboard parado en el mes corriente
- **THEN** la línea muestra la fecha completa de hoy junto a un caret
- **AND** activarla abre la hoja de meses
- **AND** no se renderiza ninguna acción "Volver a hoy"

#### Scenario: Parado en otro mes la línea nombra ese mes

- **WHEN** el usuario, un 2 de septiembre de 2026, elige agosto de 2026
- **THEN** la línea pasa a decir "Agosto 2026" en lugar de la fecha de hoy
- **AND** aparece junto a ella la acción "Volver a hoy"
- **AND** activar "Volver a hoy" devuelve la línea a "Miércoles, 2 de septiembre"

#### Scenario: La línea degrada por pasos antes de truncar

- **WHEN** el ancho disponible no alcanza para "Miércoles, 30 de septiembre"
- **THEN** la línea cae primero a "30 de septiembre", conservando el mes completo
- **AND** solo si tampoco entra trunca con elipsis
- **AND** en ningún caso envuelve a un segundo renglón

#### Scenario: El header no aloja el selector ni el eye toggle

- **WHEN** el usuario abre el dashboard en cualquier viewport
- **THEN** el header contiene únicamente el saludo y la línea de la fecha (más "Nuevo movimiento" en desktop-web)
- **AND** el `eye toggle` se renderiza dentro de la card de saldo
- **AND** no existe un pill `‹ Mes Año ›` en el header

#### Scenario: La lente funciona antes de que resuelva la query del perfil

- **WHEN** un usuario navega a `/dashboard` y la query del nombre del perfil todavía no resolvió
- **THEN** el header ya está montado con el saludo "Hola" (fallback `dashboard.welcome_anon`)
- **AND** muestra la fecha de hoy correctamente
- **AND** la línea de la fecha ya es activable: abre la hoja de meses sin esperar a esa query

#### Scenario: El header se ve antes de que resuelva la query del perfil (desktop-web)

- **WHEN** un usuario web en viewport `≥sm` navega a `/dashboard` y la query del nombre del perfil todavía no resolvió
- **THEN** el header ya está montado con el saludo "Hola" (fallback `dashboard.welcome_anon`)
- **AND** el botón "Nuevo movimiento" está visible pero disabled

#### Scenario: El header se ve antes de que resuelva la query del perfil (mobile-web)

- **WHEN** un usuario web en viewport `<sm` navega a `/dashboard` y la query del nombre del perfil todavía no resolvió
- **THEN** el header ya está montado con el saludo "Hola" (fallback `dashboard.welcome_anon`)
- **AND** muestra la fecha de hoy correctamente
- **AND** el botón "Nuevo movimiento" NO se renderiza en el header (su lugar lo ocupa el FAB)

#### Scenario: Resolver la query actualiza el saludo (web)

- **WHEN** la query del perfil resuelve con `full_name = "Cristian Perez"` después de mostrar el estado inicial
- **THEN** el saludo del header pasa a "Hola, Cristian"
- **AND** el botón "Nuevo movimiento", donde se renderice, se habilita

#### Scenario: Fallo de la query no deja el header bloqueado (web)

- **WHEN** la query del perfil falla
- **THEN** el saludo se mantiene en "Hola" (fallback anon)
- **AND** el botón "Nuevo movimiento", donde se renderice, se habilita igual para no bloquear al usuario

#### Scenario: El header persiste durante navegación entre rutas hermanas del shell (web)

- **WHEN** un usuario está en `/transactions` y navega a `/dashboard`
- **THEN** durante la transición del segmento, el header del dashboard aparece desde el primer paint del nuevo segmento (proviene de `dashboard/layout.tsx`)
- **AND** el área del contenido muestra los skeletons shape-matched (de `dashboard/loading.tsx`) mientras el `page.tsx` resuelve
- **AND** el header NO se reemplaza por un spinner full-screen del layout group `(app)` en ningún momento

#### Scenario: El header persiste durante el loading del contenido tras un redirect desde login (web)

- **WHEN** un usuario completa el login y el servidor redirige a `/dashboard`
- **AND** el `(app)/layout.tsx` resolvió su auth check (fuera del scope de este requirement)
- **THEN** el siguiente paint visible del usuario incluye el header del dashboard (desde `dashboard/layout.tsx`)
- **AND** el área del contenido muestra los skeletons shape-matched mientras las server queries del dashboard resuelven
- **AND** el usuario NO ve un spinner full-screen entre el login y el dashboard

### Requirement: El selector de mes del dashboard gobierna las secciones mensuales

El dashboard SHALL exponer un selector de mes cuyo estado vive en un context client-side compartido (`DashboardMonthProvider` en web; su espejo nativo en mobile), inicializado en el mes actual derivado de `getTodayAR()`. Su **superficie es la línea de la fecha del header**, idéntica en las dos plataformas: la línea nombra el mes seleccionado y, al activarse, abre la hoja de meses (ver el requirement de la hoja). El dashboard NO SHALL renderizar el pill `‹ Mes Año ›` (`MonthNavigator`) en su header; ese componente sigue existiendo y en uso en la ruta Movimientos, que no cambia.

El selector NO SHALL ocupar alto propio: ni una fila full-width —que costaba ~44px de la pantalla donde el alto es el recurso escaso, y que la app nativa ya tuvo y descartó— ni un pill al lado de la fecha, que le robaba el ancho a una línea que necesita todo el suyo.

Cambiar el mes seleccionado SHALL actualizar **en simultáneo la card de saldo completa** —el saldo, el desglose "Dónde está" y "Resumen del mes"—, la card **"Cuánto gastaste"** y la card **"Compromisos del próximo mes"**. El saldo deja de ser "de hoy": se corta al último día del mes seleccionado. Es lo que permite que los tres montos del resumen cierren contra él; dejar el saldo de hoy encima de los flujos de otro mes rompía la única verificación que la card ofrece al usuario.

La card de compromisos SHALL seguir al selector con un **desfasaje de un mes**: parado en el mes M, muestra los compromisos del mes **M+1** (ver el requirement de la card "Comprometido"). Ese desfasaje NO es una inconsistencia sino la condición para que los dos montos de la pantalla sean comparables: el saldo corta el último día de M y la ventana de compromisos abre el 1º de M+1, de modo que en **toda** posición del selector las dos lecturas son **disjuntas y contiguas** —sin solape y sin hueco—. Una ventana que cubriera el mismo mes M contaría compromisos cuyo pago ya salió del saldo que la card de arriba muestra.

La tira "Compartido" NO SHALL seguir al selector: muestra el neto vigente del hogar.

La navegación de mes NO SHALL modificar la URL/ruta ni provocar una navegación; el mes seleccionado NO se persiste (al re-montar, abre en el mes actual; en nativo, salir del tab y volver resetea al mes actual, mismo mecanismo de remount que el eye-mask). El rango alcanzable SHALL ser **hasta 12 meses hacia atrás y ninguno hacia el futuro** — en consecuencia la ventana de compromisos nunca se proyecta más allá de "mes actual + 1", que es el mismo horizonte que la card ya tenía. Cada sección mensual SHALL obtener los datos del mes no-actual client-side (web: TanStack sobre el cliente del browser; nativo: su hook TanStack existente) mostrando su propio estado de carga in-card; en web el mes actual llega server-rendered como initial data.

#### Scenario: Cambiar el mes mueve la card de saldo entera

- **WHEN** el usuario en agosto 2026 elige julio 2026 desde la hoja de meses
- **THEN** el saldo, "Dónde está", "Resumen del mes" y "Cuánto gastaste" muestran julio 2026
- **AND** el saldo es el del cierre de julio, no el de hoy
- **AND** no hay navegación de ruta ni recarga de pantalla

#### Scenario: Compromisos sigue al selector con un mes de desfasaje

- **WHEN** el usuario elige junio 2026
- **THEN** la card de compromisos muestra la ventana `2026-07-01..2026-07-31`
- **AND** su encabezado nombra julio, no el mes siguiente a hoy
- **AND** la tira "Compartido" no cambia

#### Scenario: El selector no ocupa alto propio

- **WHEN** el usuario abre el dashboard en un viewport angosto
- **THEN** no existe ninguna fila ni pill dedicada al selector de mes
- **AND** la única superficie del selector es la línea de la fecha, que el header ya gastaba

#### Scenario: El límite de navegación es el rango alcanzable

- **WHEN** el usuario abre la hoja de meses estando en el mes actual
- **THEN** puede elegir cualquiera de los 12 meses anteriores y el actual
- **AND** ningún mes futuro es elegible

#### Scenario: Mes no-actual se fetchea client-side con loading in-card

- **WHEN** el usuario navega a un mes cuyos datos no están cargados
- **THEN** cada sección mensual muestra su skeleton in-card (título y chrome visibles) mientras su fetch resuelve
- **AND** una falla en el fetch de una sección muestra error compacto en esa sección sin romper las otras

### Requirement: El eye toggle enmascara todos los importes del dashboard

El sistema SHALL exponer un botón "ojo" que, al activarse, reemplaza visualmente todos los importes numéricos del dashboard por un placeholder genérico (`••••••` o equivalente) sin alterar los datos subyacentes. El estado del eye toggle SHALL ser client-side y SHALL NOT persistir entre sesiones ni navegaciones fuera del dashboard (en nativo, salir del tab y volver lo resetea vía remount del provider).

El botón SHALL vivir **dentro de la card de saldo**, la primera card del dashboard, en las dos plataformas. Ahí es donde empiezan los montos que enmascara, y es una preferencia de privacidad —no un control de alcance—, así que no comparte naturaleza con el selector de mes ni tiene por qué compartir fila con él. NO SHALL renderizarse en el header del dashboard.

En **ambas plataformas**, el toggle SHALL aplicar al menos a: Hero "Para gastar · hoy" (importes ARS y USD), card "Dónde está" (saldos por cuenta y fila "En dólares"), "Balance del mes" (neto, ingresos, gastos, la línea "Ajustes" cuando se muestre, strip USD y la línea "vas {neto} este mes" del header de la card) y "En qué se fue" (montos de la leyenda y total del centro de la dona — los porcentajes NO se enmascaran).

Como el toggle ya no vive en el header, NO SHALL depender del estado de carga de la query del nombre del perfil: SHALL estar habilitado en cuanto la card de saldo se renderiza, incluida su versión skeleton. El `eye toggle` SHALL implementarse en web usando el UI `Button` con `variant="ghost"` y `size="icon"` (no como `<button>` artesanal) para reusar foco accesible, cursor y estilos de disabled.

#### Scenario: Activar el toggle enmascara todos los importes

- **WHEN** el usuario está en `/dashboard` con todos los importes visibles y toca el botón "ojo"
- **THEN** todos los importes numéricos visibles se reemplazan por `••••••`
- **AND** los labels, fechas, categorías y porcentajes permanecen visibles

#### Scenario: El toggle vive en la card de saldo, no en el header

- **WHEN** el usuario abre el dashboard en cualquier viewport, en web o en nativo
- **THEN** el botón "ojo" se renderiza dentro de la card de saldo
- **AND** el header no contiene ningún botón "ojo"

#### Scenario: El toggle no espera a la query del perfil

- **WHEN** la card de saldo ya se renderizó pero la query del nombre del perfil no resolvió
- **THEN** el botón "ojo" responde a la interacción normalmente

## ADDED Requirements

### Requirement: La hoja de meses ofrece cada mes alcanzable a un toque

Activar la línea de la fecha SHALL abrir una **superficie de selección de mes**, con una implementación por plataforma y props compartidas en `@grana/ui-contracts`.

Su presentación depende del ancho, porque una grilla de meses es un **picker** y un picker va al lado de lo que cambia:

- **Web desde `md`**: un popover anclado bajo la línea de la fecha. Un panel lateral de alto completo —que es como se presenta el `Drawer` en ese viewport— es el peso de un formulario para el peso de un selector de fecha.
- **Web debajo de `md`**: bottom sheet, según el spec `web-app-shell`.
- **Nativo**: overlay que SHALL cumplir las reglas de `mobile-app-shell` para superficies que montan un `Modal`.

En las tres, cerrar sin elegir NO SHALL cambiar la selección.

La hoja SHALL listar los meses del rango alcanzable —el mes corriente y los 12 anteriores— agrupados por año, y elegir cualquiera de ellos SHALL costar **un solo toque**. Reemplaza a las flechas `‹ ›`, con las que llegar al mes más lejano costaba once toques y que no escalan si el rango crece.

Los meses **no alcanzables SHALL renderizarse visibles pero deshabilitados**, no ausentes: así la regla —no se navega al futuro, y hacia atrás se llega hasta 12 meses— se ve de una, en lugar de descubrirse tropezando con un control muerto. El mes actualmente seleccionado SHALL estar marcado de forma distinguible.

La hoja SHALL nombrar en su pie el **desfasaje de la card de compromisos**: que muestra el mes siguiente al elegido. Es la única superficie de la UI donde esa regla puede explicarse en el momento en que importa; hoy no se explica en ninguna.

Elegir un mes SHALL cerrar la hoja y aplicar la selección al `DashboardMonthProvider`. Descartar la hoja sin elegir (scrim, gesto o `Escape`) NO SHALL cambiar la selección. La hoja SHALL devolver el foco a la línea de la fecha al cerrarse.

#### Scenario: Cualquier mes alcanzable a un toque

- **WHEN** el usuario, parado en septiembre de 2026, abre la hoja y toca "Sep" bajo el año 2025
- **THEN** la selección pasa a septiembre de 2025 con un solo toque
- **AND** la hoja se cierra y el dashboard se actualiza a ese mes

#### Scenario: Los meses no alcanzables se ven deshabilitados

- **WHEN** el usuario, parado en septiembre de 2026, abre la hoja
- **THEN** octubre, noviembre y diciembre de 2026 aparecen visibles y deshabilitados
- **AND** los meses anteriores a septiembre de 2025 también aparecen deshabilitados
- **AND** septiembre de 2026 aparece marcado como el mes seleccionado

#### Scenario: En desktop se ancla, no ocupa el costado

- **WHEN** el usuario activa la línea de la fecha en web en viewport `≥md`
- **THEN** la grilla se abre anclada debajo de la línea de la fecha
- **AND** NO se presenta como panel lateral de alto completo

#### Scenario: Descartar la hoja no cambia nada

- **WHEN** el usuario abre la hoja y la descarta sin elegir un mes
- **THEN** la selección de mes queda como estaba
- **AND** el foco vuelve a la línea de la fecha

#### Scenario: La hoja explica el desfasaje de compromisos

- **WHEN** el usuario abre la hoja de meses
- **THEN** el pie de la hoja dice que la card de compromisos muestra el mes siguiente al elegido
