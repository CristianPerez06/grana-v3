## MODIFIED Requirements

### Requirement: Las secciones del dashboard renderizan su estado de carga como skeleton shape-matched

Cada bloque del dashboard que tiene estado de carga propio SHALL renderizar durante ese estado un **skeleton shell shape-matched**: una composición de bloques rectangulares con animación pulse que respeta la forma final del contenido —mismos radios, misma altura aproximada, misma cantidad de bloques— para que la pantalla no salte al resolverse.

Un bloque que falla SHALL degradar sin arrastrar al resto de la pantalla: el error queda contenido en su bloque.

NO SHALL usarse como visual de carga: un spinner centrado, un mensaje textual ("Cargando…"), el **estado vacío** de la sección, ni sus **montos en cero**. Los dos últimos son la falla más grave de las cuatro, porque no son placeholders neutros sino afirmaciones: mientras la lectura no resolvió, "Sin gastos este mes" y "$ 0" le dicen al usuario algo que la app todavía no sabe, y que muchas veces es falso.

**Composición.** Los cuatro bloques resuelven su carga de tres maneras distintas, y la diferencia no es estilística:

1. **"Saldo disponible total"** SHALL cargar con **un solo skeleton para la card completa** —zona oscura, "Dónde está" y "Resumen del mes"—, aun cuando sus zonas se alimentan de dos lecturas distintas (el saldo y el resumen mensual). Al compartir card, un skeleton por zona la haría armarse a saltos delante del usuario. Es también la excepción a la regla de encabezado del punto 2: en esta card el rótulo y el importe SON el contenido, no chrome alrededor de él.
2. **"Cuánto gastaste"** y **"Compromisos del próximo mes"** SHALL conservar su **encabezado real desde el primer paint** —título, subtítulo de mes donde exista, y el link de la card— y skeletonear únicamente el cuerpo. El encabezado no depende de la lectura: es texto estático más un link de navegación, y esconderlo hace que la card aparezca de la nada en vez de llenarse. Es la misma regla que el spec `route-loading-and-errors` fija para el chrome de ruta, un nivel más abajo.
3. **"Compartido"** NO SHALL renderizar skeleton. Es un bloque condicional: existe solo si el usuario está en un Hogar de dos miembros con neto sin saldar, que es la minoría de los casos. Su estado de carga SHALL ser no ocupar espacio (`fallback={null}` en web, retorno `null` en nativo). Un skeleton ahí prometería un bloque que en general nunca aparece, y al resolverse en "no hay nada que mostrar" haría saltar el layout hacia arriba.

**Naming y archivos.** Cada bloque con loading state SHALL tener un componente con el sufijo `Skeleton`:

- web: `BalanceCardSkeleton`, `SpentCardSkeleton`, `CommittedSkeleton` en `apps/web/app/(app)/dashboard/_components/`
- mobile: `BalanceCardSkeleton`, `SpentCardSkeleton`, `CommittedSkeleton` en `apps/mobile/components/dashboard/`

Los skeletons de la composición anterior (`MonthBalanceSkeleton`, `SpendingSkeleton`, `AccountsCardSkeleton`, y el `HeroSkeleton` nativo que cubría solo el importe del hero) SHALL darse de baja junto con las secciones que anticipaban. NO SHALL reusarse el skeleton de un bloque como stand-in de otro: una forma equivocada es peor que ninguna, porque compromete un layout que después no se cumple.

**Tecnología por plataforma.**

- **Web** SHALL implementar los bloques con `<div className="bg-muted animate-pulse rounded-…">` inline, siguiendo el patrón ya establecido. NO SHALL introducirse un componente `<Skeleton/>` wrapper.
- **Mobile** SHALL componer el primitivo `SkeletonBlock` de `apps/mobile/components/ui/` (encapsula la animación pulse sobre `react-native-reanimated` y respeta `useReducedMotion()`: con `prefers-reduced-motion` el bloque mantiene una opacidad estática ~0.7 sin animación).

**Shape source.** Los tamaños y disposición de los bloques SHALL derivarse del render real de cada bloque en su estado con datos (no de design refs externos). Cada elemento visible del contenido real SHALL tener un bloque skeleton correspondiente.

**Navegación de mes.** Cuando el selector cambia de mes, los bloques mensuales SHALL volver a su skeleton de cuerpo manteniendo el encabezado (ver el requirement del selector de mes) y NO SHALL renderizar ceros ni el estado vacío mientras el nuevo fetch resuelve. Aplica también a la card de saldo, cuyas dos zonas siguen al mes seleccionado.

**Accesibilidad.** El nodo raíz de cada skeleton SHALL declarar:

- web: `aria-busy="true"` y `aria-label` derivado de la key de la sección.
- mobile: `accessibilityState={{ busy: true }}` y `accessibilityLabel` derivado de la misma key.

Los bloques internos NO SHALL declarar atributos de accesibilidad (heredan al wrapper, son decorativos).

**Reuso de i18n.** Las keys SHALL ser `dashboard.hero_loading` (saldo), `dashboard.spent.loading` ("Cuánto gastaste") y `dashboard.committed.loading` (Compromisos), reusadas en ambas plataformas. NO SHALL introducirse keys nuevas para esto ni reusarse un mensaje genérico para todos los bloques. `dashboard.spending.loading` SHALL darse de baja junto con el skeleton de la dona si ningún otro módulo la consume.

**Color del bloque.** Web SHALL usar el token `bg-muted`; sobre la zona navy, bloques blancos translúcidos. Mobile SHALL usar el token semánticamente equivalente del theme mobile. NO SHALL introducirse un token de skeleton nuevo.

#### Scenario: Carga inicial del dashboard

- **WHEN** el usuario abre el dashboard y los datos todavía no resolvieron
- **THEN** cada bloque muestra un skeleton con la forma de su contenido final
- **AND** la card de saldo muestra un único skeleton para toda la card, no uno por zona
- **AND** la tira Compartido no ocupa espacio ni dibuja skeleton

#### Scenario: El encabezado de la card permanece visible mientras carga

- **WHEN** "Cuánto gastaste" o "Compromisos del próximo mes" están cargando, en web o en nativo
- **THEN** el título de la card, su subtítulo de mes cuando lo tiene y su link ("Ver detalle" / "Ver todos") se ven desde el primer paint
- **AND** el skeleton ocupa únicamente el cuerpo de la card, dentro del borde y el padding definitivos

#### Scenario: Ningún bloque usa su estado vacío como placeholder de carga

- **WHEN** la lectura que alimenta un bloque todavía no resolvió
- **THEN** el bloque muestra su skeleton
- **AND** NO muestra su copy de vacío ("Sin gastos este mes.", "No tenés nada por pagar por ahora.") ni importes en cero
- **AND** el estado vacío aparece únicamente cuando la lectura resolvió y devolvió efectivamente cero

#### Scenario: Cambiar de mes no muestra ceros

- **WHEN** el usuario navega a un mes cuyos datos no están cargados
- **THEN** los bloques mensuales vuelven a su skeleton de cuerpo con el encabezado visible
- **AND** ningún importe se muestra en cero mientras el fetch resuelve

#### Scenario: Falla la lectura de compromisos

- **WHEN** la lectura que alimenta "Compromisos del próximo mes" falla
- **THEN** esa card muestra su estado de error
- **AND** el saldo, "Cuánto gastaste" y la tira Compartido siguen renderizando sus datos

#### Scenario: Web usa el skeleton como Suspense fallback

- **WHEN** se inspecciona `apps/web/app/(app)/dashboard/_components/dashboard-content.tsx`
- **THEN** cada bloque con loading state está envuelto en su propio `<Suspense>` con su skeleton respectivo como `fallback`
- **AND** `dashboard/loading.tsx` usa esos mismos skeletons, uno por bloque, sin reusar el de un bloque para otro
- **AND** NO se usa `<SectionFallback message=…/>` como fallback de esos `<Suspense>`

#### Scenario: El skeleton respeta `prefers-reduced-motion` (mobile)

- **WHEN** un usuario tiene activado "Reduce Motion" en el SO y carga el dashboard mobile
- **THEN** los bloques `SkeletonBlock` se renderizan con una opacidad estática (~0.7) sin animación de pulse
- **AND** el `accessibilityState.busy` sigue declarado

#### Scenario: Cada skeleton es accesible para lectores de pantalla

- **WHEN** un usuario con lector de pantalla aterriza en el dashboard mientras un bloque está en loading
- **THEN** el lector anuncia el label localizado de ese bloque
- **AND** los bloques individuales del skeleton no son leídos uno por uno

---

### Requirement: El dashboard tolera datos parciales sin romperse

El dashboard SHALL renderizar sin errores frente a cualquier combinación de datos faltantes: usuario sin cuentas, sin movimientos en el mes, sin ingresos acreditados, sin tarjetas, sin gastos fijos y sin actividad compartida. Cada bloque SHALL manejar su propio estado vacío con un mensaje neutral y nunca dejar la pantalla en blanco.

Cada bloque SHALL distinguir entre **cero** y **ausencia de dato**: un monto en cero se muestra como cero, mientras que una métrica que no se puede calcular —señaladamente el ritmo cuando no hubo ingresos en el mes— SHALL mostrar un mensaje explicativo y NO SHALL mostrarse como 0%. La misma distinción rige el estado de carga: una lectura pendiente es ausencia de dato, no cero (ver el requirement de skeletons).

Ninguna derivación SHALL dividir por cero ni producir `NaN`, `Infinity` o un porcentaje fuera de rango cuando su denominador es cero.

Cada bloque SHALL renderizarse de forma **independiente tanto en loading como en errores**: una query lenta o fallida en un bloque NO SHALL bloquear ni romper el renderizado de los demás. En web, esta independencia SHALL implementarse envolviendo cada bloque en su propio `<Suspense>` con su skeleton shape-matched como `fallback`, y haciendo que cada uno fetchee su data en un container dedicado que degrade a un estado de error compacto si su query falla. NO SHALL existir un único `<Suspense>` que englobe a varios bloques bloqueando el streaming entre ellos. En nativo, cada bloque posee su query TanStack y su swap region de alto estable (ver requirement del shell mobile).

Cada bloque SHALL declarar un `min-height` sobre el root del componente real y sobre su **skeleton** correspondiente, de forma que el alto del hueco no cambie entre el estado de carga, el estado con datos y el estado de error compacto. NO SHALL haber layout shift visible cuando un bloque pasa de su skeleton al contenido real. La tira Compartido queda exceptuada: no tiene skeleton (es condicional) y por lo tanto no reserva alto.

#### Scenario: Usuario recién onboardeado

- **WHEN** un usuario sin ningún movimiento abre el dashboard
- **THEN** cada bloque muestra su estado vacío correspondiente
- **AND** ninguna sección rompe ni muestra `NaN`

#### Scenario: Cero y ausencia de dato no se confunden

- **WHEN** el usuario gastó en el mes pero no acreditó ningún ingreso
- **THEN** "Cuánto gastaste" muestra sus montos reales
- **AND** el ritmo muestra su mensaje de indeterminado en lugar de 0%

#### Scenario: Un bloque lento no bloquea a los demás

- **WHEN** la lectura del saldo resuelve antes que la de "Cuánto gastaste"
- **THEN** la card de saldo muestra sus datos
- **AND** "Cuánto gastaste" sigue mostrando su skeleton hasta que su propia lectura resuelva

#### Scenario: El skeleton ocupa el mismo alto que el contenido

- **WHEN** un bloque del dashboard está mostrando su skeleton y luego su query resuelve
- **THEN** el hueco que ocupaba el skeleton es el mismo que ocupa el contenido real (min-height matcheado)

---

### Requirement: Los componentes del dashboard mobile siguen la convención de naming espejo del web

Los componentes del dashboard SHALL llamarse igual que sus pares web a nivel de export PascalCase, sobre la composición de cuatro bloques vigente: `BalanceCard` + `BalanceCardSkeleton`, `SpentCard` + `SpentCardSkeleton` + `SpentTile`, `CommittedSection` + `CommittedSkeleton` + `CommittedBody` + `CommittedRow`, `SharedStrip`, más el chrome compartido `DashboardHeader`, `MonthNavigator`, `MaskedAmount`, `MaskedAmountDisplay`, `EyeMaskToggle`, `EyeMaskProvider`, `useEyeMask`, `DashboardMonthProvider`, `useDashboardMonth`. Las props públicas SHALL coincidir cuando es técnicamente posible.

Los componentes de composiciones anteriores NO existen en ninguna plataforma: `UpcomingFortnightSection`, `WelcomeFirstMoveCard`, `CategoryTeaser`, `MonthBalanceChart`, y —dados de baja por `redesign-dashboard-home-v2`— `HeroSection`, `AccountsCard`, `MonthBalanceSection`, `SpentThisMonthSection`, `SpendingSection`, `SpendingDonut` con sus skeletons `HeroSkeleton`, `AccountsCardSkeleton`, `MonthBalanceSkeleton` y `SpendingSkeleton`. La tira "Compartido" SÍ tiene par mobile (`SharedStrip`): el módulo `shared` nativo ya existe y el rediseño la llevó a las dos plataformas.

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
