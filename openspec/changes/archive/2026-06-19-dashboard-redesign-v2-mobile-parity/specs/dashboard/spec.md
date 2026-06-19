## MODIFIED Requirements

### Requirement: La card "Dónde está" desglosa las cuentas del usuario

Junto al Hero "Para gastar · hoy", el dashboard SHALL renderizar una card "Dónde está" que desglosa dónde vive el disponible (a la derecha del Hero en desktop web; apilada debajo en mobile-web y en la app nativa). Los datos SHALL salir de la misma data de `getDashboardHero` que alimenta el Hero — en web vía un único container async para la fila superior; en nativo ambas cards consumen `useDashboardHero()` y TanStack dedupea por queryKey (un solo fetch). La card SHALL considerar las cuentas activas `type IN ('cash','bank')` ordenadas por saldo ARS descendente (el orden que ya devuelve `getDashboardHero`), truncadas a un máximo de 6; el resto se ve en el módulo Cuentas. El header de la card SHALL incluir un link "Ver todas" → módulo Cuentas (web: `/accounts`; nativo: `router.push('/accounts')`). Todos los importes de la card participan del eye-mask.

**Presentación (web y mobile):** la card SHALL comunicar la **concentración** del saldo de un vistazo, sin lista larga, idéntica en ambas plataformas:

- Un **callout de concentración**: el porcentaje de la cuenta de mayor saldo ARS sobre el total ARS (`pct = cuenta_dominante.ars / Σ cuentas.ars`, redondeado a entero) en tipografía grande, junto al nombre y saldo de esa cuenta. El porcentaje SHALL derivarse de los datos, NO hardcodearse. Con `Σ = 0` (sin saldo ARS), el callout NO SHALL mostrarse.
- Una **barra de concentración** horizontal compuesta por un segmento por cuenta, cuyo ancho SHALL ser proporcional al saldo ARS de la cuenta sobre el total (`cuenta.ars / Σ`), nunca hardcodeado. Cada segmento usa el color de identidad de su cuenta (sin hex inline en web; mirror de tokens en nativo). Los segmentos sub-pixel PUEDEN recibir un ancho mínimo visible sin alterar el cálculo del dato.
- Una **grilla compacta** (2 columnas) con las cuentas restantes (cada celda: cuadradito de color + nombre + saldo ARS) y, como celda final destacada en emerald, la tenencia "En dólares" con el total USD del usuario (el mismo `usd` del Hero), que representa el stock total en USD y NO un desglose por cuenta. Un saldo ARS de cero SHALL pintarse atenuado.

El cálculo de concentración (porcentaje dominante + anchos de los segmentos) SHALL reusar la función pura `computeConcentration` de `@grana/dashboard` en ambas plataformas; no se duplica.

#### Scenario: Concentración calculada de los datos (web)

- **WHEN** el usuario tiene Cta remunerada $9.575.790,25, CA $146.939,17, Billetera $108.200, Personal Pay $53.082,99 y un total USD de u$s 600 (web)
- **THEN** el callout muestra `97%` con "Cta remunerada · $9.575.790,25"
- **AND** la barra de concentración muestra un segmento por cuenta con ancho proporcional a su saldo ARS sobre el total
- **AND** la grilla compacta lista las cuentas restantes y la fila "En dólares" muestra u$s 600 en emerald

#### Scenario: Concentración calculada de los datos (mobile)

- **WHEN** el usuario abre el dashboard nativo con Cta remunerada $9.575.790,25 dominante y otras cuentas menores
- **THEN** el callout muestra el `%` de la cuenta dominante con su nombre y saldo
- **AND** la barra de concentración muestra un segmento por cuenta con ancho proporcional a su saldo ARS sobre el total
- **AND** la grilla compacta lista las cuentas restantes y la fila "En dólares" en emerald

#### Scenario: Una sola cuenta concentra el 100%

- **WHEN** el usuario tiene una única cuenta con saldo ARS y total USD cero
- **THEN** el callout muestra `100%` con esa cuenta
- **AND** la barra de concentración muestra un único segmento a ancho completo

#### Scenario: Sin saldo ARS no se muestra el callout

- **WHEN** todas las cuentas del usuario tienen saldo ARS cero
- **THEN** el callout de concentración NO se renderiza
- **AND** la card sigue mostrando las cuentas (atenuadas) y la fila "En dólares"

#### Scenario: Más de 6 cuentas se truncan

- **WHEN** el usuario tiene 9 cuentas cash/bank activas
- **THEN** la card considera las 6 de mayor saldo ARS + la fila "En dólares"
- **AND** el link "Ver todas" navega al módulo Cuentas donde está el listado completo

#### Scenario: Una sola llamada alimenta la fila superior (web)

- **WHEN** se inspecciona el container de la fila superior del dashboard web
- **THEN** un único container async llama a `getDashboardHero` y renderiza ambas cards (Hero + "Dónde está") con esa data
- **AND** NO hay una segunda llamada a `getDashboardHero` para la card de cuentas

#### Scenario: Un solo fetch alimenta ambas cards (mobile)

- **WHEN** la pantalla dashboard nativa monta Hero y "Dónde está"
- **THEN** ambos componentes consumen `useDashboardHero()` con la misma queryKey
- **AND** TanStack ejecuta un único fetch para los dos

---

### Requirement: La card "Comprometido" muestra los resúmenes de tarjeta y los gastos fijos del mes próximo (lente COMPROMISO)

El dashboard (web y mobile) SHALL renderizar una card **"Comprometido"** (lente COMPROMISO) que responde "¿qué debo / qué se viene?", con el subtítulo "Lo que ya sabemos del próximo mes". En web se ubica **a la derecha de "Balance del mes"** en una fila de dos columnas; en mobile las cards se apilan (Comprometido debajo de "Balance del mes"). A diferencia de "Balance del mes" y "¿En qué gasté este mes?", esta card SHALL ser **estática "desde hoy"**: NO SHALL responder al navegador de mes (la deuda es un stock del presente y las recurrencias se proyectan al mes próximo). En mobile los datos llegan vía el hook `useCommittedOutlook` (TanStack) sobre `getCommittedOutlook`, con su propio loading/error in-card.

La card SHALL presentar, **por moneda y sin combinar ARS con USD** (bimoneda por defecto):

- Un **total comprometido** como titular = lo que SALE = `resúmenesTarjeta + gastosRecurrentes`. El total NO SHALL incluir los ingresos recurrentes (un ingreso no es un compromiso).
- **Dos mini-tiles de egreso** (sin gráfico): una "Resúmenes tarjeta" y otra "Gastos recurrentes" (rotulada como del mes próximo), cada una con ícono + label + monto. NO SHALL usar el patrón `FlowRow` de barras para estos egresos.
  - **"Resúmenes tarjeta"** = la suma de los cargos pendientes de TODOS los resúmenes impagos de las tarjetas del usuario: consumos `pending` menos los reintegros recibidos imputados a esos resúmenes, abarcando el resumen **en curso** (open) y los **cerrados/vencidos** sin pagar. NO SHALL proyectarse una línea aparte de "cuotas futuras".
  - **"Gastos recurrentes"** = la proyección de las reglas de recurrencia activas tipo `expense` cuyas ocurrencias caen en el **mes calendario siguiente** a hoy, sumando el monto de cada ocurrencia por moneda.
- **Estado con ingreso recurrente** (cuando la proyección de reglas tipo `income` del mes próximo es > 0 en la moneda): la card SHALL agregar un sub-label "YA SALE" sobre las tiles de egreso, una **tile "Ya entra"** a ancho completo, destacada en emerald, con el label del ingreso recurrente y su monto en positivo; y una **banda de cierre neto** con `neto = ingresosRecurrentes − totalComprometido`. Si `neto ≥ 0`, la banda comunica en tono positivo que el próximo mes "arrancás con **+neto** a favor"; si `neto < 0`, la banda comunica el déficit en tono expense sin ocultarlo. El ingreso recurrente SHALL seguir mostrándose como contexto y NO SHALL sumarse al total comprometido; el cierre neto es un cálculo presentacional aparte. Las recurrencias tipo `transfer` NO SHALL contabilizarse.
- Si NO hay ingreso recurrente en la moneda (proyección `income` = 0), la card NO SHALL mostrar el sub-label "YA SALE", ni la tile "Ya entra", ni la banda de cierre neto.

Todos los importes SHALL participar del eye-mask. La proyección de recurrencias SHALL reusar `projectUpcomingOccurrences` de `@grana/money-logic`; la deuda de tarjeta SHALL reusar la lógica de pendientes por resumen ya existente, sin duplicar la matemática del neto. El cierre neto SHALL derivarse de los datos, sin hardcodear.

La card SHALL tolerar datos parciales: si la query falla, SHALL mostrar un error compacto sin romper el resto del dashboard. Su estado de carga SHALL renderizarse como skeleton shape-matched (chrome/título visibles).

#### Scenario: La card muestra el total y los egresos como dos tiles, sin ingreso recurrente

- **WHEN** el usuario tiene resúmenes de tarjeta impagos por ARS $712.182 y gastos recurrentes proyectados al mes próximo por ARS $106.966, sin ingresos recurrentes
- **THEN** la card muestra el total comprometido `$819.148` (= resúmenes + gastos recurrentes)
- **AND** muestra dos mini-tiles: "Resúmenes tarjeta" en `$712.182` y "Gastos recurrentes" en `$106.966`
- **AND** NO muestra el sub-label "YA SALE", ni la tile "Ya entra", ni la banda de cierre neto

#### Scenario: Con ingreso recurrente aparece la tile "Ya entra" y el cierre neto

- **WHEN** además de un total comprometido de ARS $819.149, el usuario tiene un ingreso recurrente (sueldo) proyectado al mes próximo por ARS $1.450.000
- **THEN** la card muestra el sub-label "YA SALE" sobre las dos tiles de egreso
- **AND** muestra una tile "Ya entra" a ancho completo en emerald con `+$1.450.000`
- **AND** muestra la banda de cierre neto en tono positivo indicando que el próximo mes arranca con `+$630.851` a favor (= 1.450.000 − 819.149)
- **AND** el total comprometido sigue siendo `$819.149` (el ingreso NO se sumó al total)

#### Scenario: La card "Comprometido" se renderiza en mobile

- **WHEN** un usuario abre el dashboard nativo con deuda de tarjeta y/o recurrencias activas
- **THEN** la pantalla nativa muestra la card "Comprometido" debajo de "Balance del mes" con el total + las dos tiles de egreso
- **AND** los datos provienen del hook `useCommittedOutlook` sobre `getCommittedOutlook`
- **AND** la card NO responde al navegador de mes

#### Scenario: La card es estática y no responde al navegador de mes

- **WHEN** el usuario navega el selector de mes a un mes anterior
- **THEN** "Balance del mes" y "¿En qué gasté este mes?" cambian al mes navegado
- **AND** la card "Comprometido" NO cambia: sigue mostrando los resúmenes de hoy, los recurrentes del mes próximo y el cierre neto si aplica

#### Scenario: Bimoneda separada

- **WHEN** el usuario tiene resúmenes y recurrencias en ARS y también consumos pendientes en USD
- **THEN** la card muestra los totales y tiles de ARS y USD por separado, sin convertir ni sumar entre monedas

#### Scenario: Sin resúmenes ni recurrencias muestra un estado vacío neutral

- **WHEN** el usuario no tiene deuda de tarjeta ni reglas de recurrencia activas
- **THEN** la card muestra un estado vacío neutral y NO desaparece del layout

#### Scenario: Los importes participan del eye-mask

- **WHEN** el usuario activa el eye toggle
- **THEN** el total comprometido, los montos de las tiles, el ingreso "Ya entra" y el neto del cierre quedan enmascarados

---

### Requirement: El dashboard muestra cuánto del gasto del mes se financió en tarjeta

Para explicar por qué "Gastos" (caja) es menor que el total gastado, el dashboard SHALL mostrar una sección **"Gastaste este mes"** full-width (no dentro de ninguna card), **solo cuando el mes tuvo consumo de tarjeta** (financiado > 0). En web se ubica debajo de la tira "Compartido"; en mobile (que no tiene tira "Compartido") se ubica debajo de "Comprometido" y encima de "¿En qué gasté?". La sección SHALL conectar los tres números: el **total gastado** del mes (devengado, el mismo total de "¿En qué gasté este mes?"), lo que **salió de caja** (la fila "Gastos" de "Balance del mes"), y lo **financiado en tarjeta**, donde `financiado = total_devengado − gasto_de_caja` (de modo que `total = caja + financiado` cierra por construcción).

La sección SHALL presentar el **total del mes** como titular y una **barra de dos segmentos** cuyo ancho SHALL ser proporcional (`caja / total` y `financiado / total`), nunca hardcodeado: un segmento "De tu caja" (tono slate) y otro "Financiado en tarjeta" (tono terracota), cada uno con su label y su monto. En viewports angostos (y en mobile) la barra SHALL colapsar a una columna (cada segmento como fila completa). La sección SHALL aclarar que lo financiado **"se paga en los próximos resúmenes"** (no que ya se pagó), con texto del catálogo i18n. La sección SHALL seguir el navegador de mes (refiere al mes seleccionado); reusa las mismas query keys que "Balance del mes" y "¿En qué gasté?" (TanStack dedupea, sin fetch nuevo). Los importes participan del eye-mask. Cuando el mes NO tuvo consumo de tarjeta, la sección NO SHALL renderizarse.

#### Scenario: La barra reparte el gasto entre caja y tarjeta

- **WHEN** el mes tiene gasto de caja $498.379,65 y el total devengado ("¿En qué gasté este mes?") es $879.684,24
- **THEN** la sección "Gastaste este mes" muestra el total `$879.684,24`
- **AND** muestra dos segmentos: "De tu caja" con `$498.379,65` (~56,65%) y "Financiado en tarjeta" con `$381.304,59` (~43,35%)
- **AND** aclara que lo financiado se paga en los próximos resúmenes
- **AND** los tres montos cierran: `879.684,24 = 498.379,65 + 381.304,59`

#### Scenario: Sin consumo de tarjeta la sección no aparece

- **WHEN** el total devengado del mes es igual al gasto de caja (no hubo consumo de tarjeta)
- **THEN** la sección "Gastaste este mes" NO se renderiza

#### Scenario: La barra colapsa a columna en mobile

- **WHEN** el usuario abre el dashboard nativo (o un viewport web de 375px) con consumo de tarjeta en el mes
- **THEN** la sección "Gastaste este mes" muestra cada segmento (caja y tarjeta) como una fila completa apilada

---

### Requirement: Los componentes del dashboard mobile siguen la convención de naming espejo del web

Los componentes del dashboard SHALL llamarse igual que sus pares web a nivel de export PascalCase: `HeroSection`, `HeroSkeleton`, `AccountsCard`, `AccountsCardSkeleton` (mobile; en web la fila superior comparte el `HeroSkeleton`), `MonthBalanceSection`, `MonthBalanceSkeleton`, `CommittedSection`, `CommittedSkeleton`, `SpentThisMonthSection`, `SpendingSection`, `SpendingDonut`, `SpendingSkeleton`, `MonthNavigator`, `MaskedAmount`, `MaskedAmountDisplay`, `EyeMaskToggle`, `EyeMaskProvider`, `useEyeMask`, `DashboardMonthProvider`, `useDashboardMonth`, `DashboardHeader`. Las props públicas SHALL coincidir cuando es técnicamente posible. Los componentes del diseño viejo (`UpcomingFortnightSection`, `WelcomeFirstMoveCard`, `CategoryTeaser`, `MonthBalanceChart` y sus skeletons) no existen en ninguna plataforma. La tira "Compartido" del dashboard web NO tiene par mobile por ahora (la capa de datos de Hogar nativa está diferida con el resto del módulo `shared`).

Cada componente mobile SHALL usar las primitivas idiomáticas de RN/Expo (`View`, `Text`, `Pressable`, `react-native-svg`, `lucide-react-native`, `useRouter` de `expo-router`, NativeWind classes) en vez de las primitivas del DOM. Los skeletons mobile SHALL componer el primitivo `SkeletonBlock` (de `apps/mobile/components/ui/`) en vez de re-implementar la animación pulse en cada caso. NO se exige que el código se comparta entre plataformas; solo el contrato semántico de naming y comportamiento.

`SectionFallback` ya NO forma parte del set de componentes espejados del **dashboard** — los containers del dashboard (web y mobile) no lo importan, ni para loading ni para error states. El archivo en sí permanece en ambas plataformas (`apps/web/components/ui/section-fallback.tsx`, `apps/mobile/components/dashboard/SectionFallback.tsx`) porque sigue siendo utility compartida por otras rutas (`accounts`, `cards`); su migración eventual a skeletons queda fuera del scope de este change.

#### Scenario: Mismo nombre de componente entre web y mobile

- **WHEN** se inspecciona la lista de componentes del dashboard web y mobile
- **THEN** los componentes exportan el mismo nombre PascalCase en ambas plataformas
- **AND** la única diferencia entre versiones es la implementación interna (primitivas, layout específico de pantalla)

#### Scenario: Los componentes nuevos del rediseño existen en mobile

- **WHEN** se inspecciona `apps/mobile/components/dashboard/`
- **THEN** existen `CommittedSection`, `CommittedSkeleton` y `SpentThisMonthSection`
- **AND** exportan el mismo nombre PascalCase que sus pares web (donde el par existe)

#### Scenario: Componente mobile usa primitivas RN

- **WHEN** se inspecciona `apps/mobile/components/dashboard/HeroSection.tsx`
- **THEN** el componente usa `View`/`Text`/`Pressable` y NO usa elementos del DOM como `div`, `span`, ni `<Link>` de Next
- **AND** la navegación usa `useRouter()` de `expo-router`

#### Scenario: Skeletons mobile componen el primitivo `SkeletonBlock`

- **WHEN** se inspecciona cualquiera de los skeletons mobile del dashboard
- **THEN** los bloques pulsantes se renderizan vía `<SkeletonBlock className="…"/>` importado de `apps/mobile/components/ui/SkeletonBlock`
- **AND** ningún skeleton mobile usa `Animated.View` ni `useSharedValue` directamente (la animación está encapsulada en el primitivo)

#### Scenario: Los componentes del diseño viejo no existen en ninguna plataforma

- **WHEN** se busca `UpcomingFortnightSection`, `WelcomeFirstMoveCard`, `CategoryTeaser` o `MonthBalanceChart` en `apps/web` y `apps/mobile`
- **THEN** ningún archivo los define ni los importa

---

### Requirement: La pantalla `(app)/dashboard` mobile renderiza las secciones del dashboard con tolerancia a fallas parciales

La pantalla `apps/mobile/app/(app)/dashboard.tsx` SHALL renderizar las secciones del rediseño en orden vertical (Hero "Para gastar · hoy" → "Dónde está" → "Balance del mes" → "Comprometido" → "Gastaste este mes" (solo si hubo consumo de tarjeta) → "¿En qué gasté?") envueltas en `EyeMaskProvider` y el provider de mes (`DashboardMonthProvider` nativo). La tira "Compartido" del dashboard web NO se renderiza en mobile (capa de datos de Hogar nativa diferida). La pantalla SHALL ser un **shell**: monta el header y coloca las secciones, pero NO SHALL orquestar las queries de las secciones ni decidir su render en función de `data`/`error` desde el padre. Cada sección SHALL poseer su propia query (vía TanStack Query) y manejar su propio loading/error in-card.

La pantalla NO SHALL renderizar una sección Tarjetas ni disparar `getCreditCards` como parte de la carga del dashboard. SHALL usar `getTodayAR()` (o su equivalente mobile) para todo cálculo de "hoy", calculado una vez en el shell.

**Shell visible desde el primer paint.** La pantalla NO SHALL bloquear el render con un spinner a pantalla completa que espere a que resuelvan las queries. El header (saludo + fecha + navegador mensual + `eye toggle`) y el frame scrolleable SHALL renderizarse desde el primer paint, antes de que cualquier query resuelva. El saludo SHALL usar el fallback `dashboard.welcome_anon` ("Hola.") hasta que la query del nombre del perfil resuelva, momento en el que SHALL actualizarse al saludo personalizado; si esa query falla, el saludo SHALL permanecer en el fallback anon sin bloquear la pantalla. La fecha del header NO SHALL depender de ninguna query: SHALL derivarse de `getTodayAR()` y mantenerse estable.

**Carga independiente por sección, sin layout shift.** Cada sección SHALL renderizar su chrome (título/label de card) de forma persistente, y SHALL delegar únicamente su región de datos a un intercambio entre tres estados: carga (**skeleton shape-matched**), error (mensaje localizado + acción de reintentar) y datos. Esa región SHALL declarar un alto mínimo estable de modo que el alto de la sección NO cambie entre los estados (sin layout shift). Una query lenta o fallida en una sección NO SHALL bloquear ni desplazar a las demás. El skeleton SHALL vivir **dentro** de la swap region, NO SHALL reemplazar el chrome de la card. La sección "Gastaste este mes" es la excepción: NO renderiza chrome propio cuando el mes no tuvo consumo de tarjeta (no se monta).

**Pull-to-refresh.** El `RefreshControl` de la pantalla SHALL ligar su estado `refreshing` al **gesto de pull**, no a objetos de query retenidos en el shell ni al conteo de queries en vuelo del prefijo `['dashboard']`. En particular, los fetches internos de una sección que comparten ese prefijo (p. ej. la query `balance-series` al navegar de mes) NO SHALL encender el `RefreshControl`. El gesto de pull SHALL invalidar las queries bajo el prefijo `['dashboard']`, y el indicador SHALL permanecer encendido mientras esos refetches del pull no terminen.

La pantalla SHALL respetar el principio "Off-ledger credit cards" idéntico al spec web (las queries ya lo encapsulan).

#### Scenario: El shell renderiza las secciones del rediseño en orden (mobile)

- **WHEN** un usuario abre el dashboard nativo
- **THEN** las secciones aparecen en orden vertical: Hero → "Dónde está" → "Balance del mes" → "Comprometido" → "Gastaste este mes" (si hubo consumo de tarjeta) → "¿En qué gasté?"
- **AND** NO se renderiza una tira "Compartido"

#### Scenario: El shell y el header se ven desde el primer paint (mobile)

- **WHEN** la pantalla `dashboard` mobile monta con un usuario logueado y onboarding completado, antes de que resuelva cualquier query
- **THEN** el header (saludo, fecha, navegador mensual y `eye toggle`) y el frame del dashboard ya están visibles
- **AND** NO se muestra un spinner a pantalla completa que oculte header y secciones
- **AND** el saludo muestra el fallback anon ("Hola.") y la fecha de hoy correcta

#### Scenario: Las secciones cargan independientemente sin layout shift (mobile)

- **WHEN** la query de `getDashboardHero` resuelve antes que la de `getMonthBalanceSeries`
- **THEN** el Hero y "Dónde está" pintan sus importes en cuanto su query resuelve, sin esperar a "Balance del mes"
- **AND** "Balance del mes" sigue mostrando su `MonthBalanceSkeleton` in-card sobre su alto mínimo estable
- **AND** cuando resuelve, su contenido aparece dentro del alto que ya ocupaba, sin empujar a las demás secciones

#### Scenario: Falla en una query no rompe la pantalla mobile

- **WHEN** la query `getMonthCategoryBreakdown` falla (timeout, error de DB) en mobile
- **THEN** `SpendingSection` muestra in-card un mensaje de error localizado con acción de reintentar, dentro de su alto estable
- **AND** el resto de las secciones renderiza normalmente
- **AND** NO se dispara `getCreditCards` para el dashboard

#### Scenario: Pull-to-refresh muestra el indicador solo durante el gesto (mobile)

- **WHEN** el usuario hace pull-to-refresh en el dashboard
- **THEN** se invalidan las queries bajo `['dashboard']` y vuelven a fetchearse
- **AND** el `RefreshControl` muestra el indicador hasta que esos refetches terminan (ligado al gesto, no a objetos de query del shell)

#### Scenario: Navegar de mes no enciende el refresh superior (mobile)

- **WHEN** el usuario toca una flecha del navegador mensual del header y se disparan las queries del nuevo mes
- **THEN** solo los skeletons in-card de "Balance del mes" y "¿En qué gasté?" se muestran mientras cargan
- **AND** el `RefreshControl` superior NO se enciende
- **AND** la posición de scroll no se desplaza

#### Scenario: Salir del tab dashboard y volver resetea eye toggle y mes (mobile)

- **WHEN** el usuario mobile activa el eye toggle, navega a un mes anterior, cambia al tab "movimientos" y luego vuelve a "dashboard"
- **THEN** los importes están visibles nuevamente y el mes seleccionado es el actual (los providers se remontan)

## REMOVED Requirements

### Requirement: La fila "Ajustes" de "Balance del mes" marca el monto como sin registrar (web)

**Reason**: el chip "SIN REGISTRAR" ahora aplica también en mobile; se reemplaza por una requirement equivalente sin tag de plataforma.
**Migration**: ver la requirement "La fila 'Ajustes' de 'Balance del mes' marca el monto como sin registrar" (sin tag), que cubre web y mobile.

### Requirement: La leyenda de "¿En qué gasté?" muestra una barra proporcional por categoría (web)

**Reason**: las barras de leyenda ahora aplican también en mobile; se reemplaza por una requirement equivalente sin tag de plataforma.
**Migration**: ver la requirement "La leyenda de '¿En qué gasté?' muestra una barra proporcional por categoría" (sin tag), que cubre web y mobile.

## ADDED Requirements

### Requirement: La fila "Ajustes" de "Balance del mes" marca el monto como sin registrar

Cuando la fila "Ajustes" de "Balance del mes" se muestra (el mes tiene ajustes), la sección (web y mobile) SHALL acompañar el monto con un **chip "SIN REGISTRAR"** (tono ámbar/warning, uppercase) que refuerza que esa plata se movió sin registrar, además del aviso educativo (voz Grana) ya presente debajo de las barras. El texto del chip SHALL salir del catálogo i18n (`dashboard.month.adjustment_unregistered`), sin string hardcodeado. El chip NO SHALL alterar el cálculo del monto ni del neto del mes; es puramente presentacional. El monto de Ajustes sigue participando del eye-mask.

#### Scenario: La fila Ajustes muestra el chip "SIN REGISTRAR"

- **WHEN** el mes seleccionado tiene ajustes y la fila "Ajustes" está visible (web o mobile)
- **THEN** junto al monto neto de Ajustes aparece un chip "SIN REGISTRAR" en tono ámbar
- **AND** debajo de las barras sigue apareciendo el aviso educativo desde `dashboard.month.adjustment_note`
- **AND** el texto del chip proviene del catálogo i18n

#### Scenario: Sin ajustes no hay chip

- **WHEN** el mes seleccionado no tiene ajustes (la fila "Ajustes" no se muestra)
- **THEN** el chip "SIN REGISTRAR" no se renderiza

### Requirement: La leyenda de "¿En qué gasté?" muestra una barra proporcional por categoría

En la sección "¿En qué gasté este mes?", cada fila de la leyenda (web y mobile) SHALL mostrar, debajo del row (dot + nombre + monto + porcentaje), una **barra proporcional** cuyo ancho SHALL ser `monto_categoría / monto_máximo` entre las categorías mostradas, con el color de la categoría (el mismo `sliceColor` de la dona). El ancho SHALL derivarse de los datos, NO hardcodearse. La barra NO SHALL aplicarse a las filas de crédito ("te devolvieron"), que viven fuera de la dona. La dona y su total central no cambian.

#### Scenario: Cada fila de la leyenda lleva su barra proporcional

- **WHEN** el mes tiene Comida $206.625 (máximo), Transporte $165.000, Entretenimiento $114.940 y Otros $188.662 en la moneda activa
- **THEN** la leyenda muestra cada categoría con su barra: Comida al 100% del track, Transporte ~79,9%, Entretenimiento ~55,6% y Otros ~91,3%
- **AND** cada barra usa el color de su categoría
- **AND** los anchos se derivan de los montos, no están hardcodeados

#### Scenario: Las filas de crédito no llevan barra

- **WHEN** una categoría queda en crédito ("te devolvieron") y se muestra fuera de la dona
- **THEN** esa fila NO renderiza barra proporcional
