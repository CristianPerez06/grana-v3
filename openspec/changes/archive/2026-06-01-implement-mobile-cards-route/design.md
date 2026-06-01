## Context

El módulo `/cards` ya está completo en web: header con count + CTA, hero del mes (`getCardsMonthSummary`), wallet (`WalletGridContainer` → `WalletGridSection` → `WalletGrid` con cards 2-col en `md+`), y archivadas colapsable. Cada sección tiene su propio fallback de carga y de error, expresado en server con `<Suspense>` + containers async + `try/catch`, y un `CardsErrorBoundary` Client Component como red de seguridad.

En mobile (`apps/mobile/app/(app)/cards.tsx`) la pantalla está como stub: monta un `PageHeader`, dispara una sola query react-query para `getCreditCards({ includeArchived: false })`, y renderiza un `CreditCardCarousel` cuando hay data o un `SectionFallback` cuando hay error / un `Spinner` cuando carga. Faltan el hero del mes, las archivadas, el subtítulo con count, y el CTA "Agregar tarjeta".

El stack mobile usa react-query (`@tanstack/react-query` ya en uso para `['cards']`), Expo Router con `_layout.tsx` que oculta el header nativo (`headerShown: false`), `PageHeader` custom (`apps/mobile/components/ui/PageHeader.tsx`), NativeWind v4, `SectionFallback` ya existente para el dashboard (`apps/mobile/components/dashboard/SectionFallback.tsx`), y un cliente Supabase per-app en `apps/mobile/lib/supabase.ts`.

La queries layer mobile (`apps/mobile/lib/cards/queries.ts`) ya tiene `getCreditCards` pero NO tiene `getCardsMonthSummary`. La web sí — en `apps/web/lib/cards/queries.ts`. Por convención del repo ("Supabase queries stay in each app's lib/"), no se mueven a un paquete shared en este change.

Constraints relevantes (auto-memory + AGENTS):
- pnpm only en comandos y docs.
- Cross-platform components: mismos nombres, distintas implementaciones (`feedback_cross_platform_components`).
- Mobile usa `PageHeader` custom, nunca el header nativo del stack (`feedback_mobile_headers`).
- Tabs nativas mobile fijas: `Inicio / Movimientos / Hogar / Menú` — `/cards` ya está oculta como tab (`href: null`) y se navega push desde Menú (`feedback_mobile_tabs_locked`).
- Commits: solo título, sin body ni trailers (`feedback_commit_title_only`).
- No hacer merge a main — el usuario lo hace (`feedback_never_merge_to_main`).
- No Paper design refs para este change — el web sirve de fuente.

## Goals / Non-Goals

**Goals:**
- Paridad visual y funcional entre `/cards` web y `/cards` mobile, ajustado a idiomas mobile (carrusel en lugar de grid, single-col hero, `<details>`-equivalent con Pressable).
- Aislamiento de errores por sección en mobile, sin un error boundary global: si una query falla, las otras siguen renderizándose y el header se mantiene visible.
- Convergencia del nombre público del componente Wallet: `Wallet` en ambas plataformas, implementación interna distinta.
- Mantener intactas las rutas y comportamientos de `/cards/[id]`, `/cards/new`, edición, pago, archivado.

**Non-Goals:**
- Implementar `/cards/new` mobile (el CTA queda disabled placeholder hasta que aterrice).
- Implementar `/cards/[id]` mobile.
- Mover queries a un paquete shared (`@grana/cards-queries` o similar). Cada app mantiene sus queries en `lib/`.
- Hacer redesign visual del hero o del wallet — es una traducción 1:1 de la información del web.
- Generar design refs en Paper para este change.

## Decisions

### Decision 1: Cada sección usa su propia query react-query, sin un wrapper "container" único

**Decisión.** En mobile, cada sección (`CardsMonthHero`, `Wallet`, `ArchivedCardsSection`) llama directamente a su propia `useQuery` dentro del componente. El parent `apps/mobile/app/(app)/cards.tsx` se limita a componer header + secciones, sin hacer queries.

**Alternativas consideradas.**
- *Un solo `useQuery` parent que cargue todo*: rompe el aislamiento de errores (un fallo en cualquier sub-query hace fallar la query parent y muestra solo un fallback global). Descartado.
- *Containers async análogos a los del web*: en React Native no hay Server Components ni `<Suspense>` con data fetching nativo del framework. Containers async no aportan; lo idiomático es `useQuery` por componente.

**Por qué.** El requirement modificado pide aislamiento "un error en una sección no tira la ruta ni esconde el header". Tener `useQuery` dentro del componente de cada sección es la forma más simple de cumplir eso, sin tirar más abstracciones (containers, providers, contexto) que en este caso no aportan.

### Decision 2: El `CardsHeader` mobile tiene su propia query del count, independiente del `Wallet`

**Decisión.** El header dispara `useQuery({ queryKey: ['cards', 'count'], queryFn: () => supabase.from('accounts').select(... { count: 'exact', head: true }).eq('type', 'credit').eq('is_active', true) })`. NO reutiliza el resultado de la query del `Wallet`.

**Alternativas consideradas.**
- *Reutilizar la query del wallet*: el header tendría que esperar a que llegue toda la lista de tarjetas (incluyendo periods + payments + transactions) para mostrar el count. Eso retrasa el render del subtítulo y rompe el principio "chrome visible desde el primer paint" porque cualquier fallo de la query pesada del wallet también deja el subtítulo en `-`. Descartado.
- *Derivar el count del cache de react-query si ya está poblado*: optimización prematura. La query del count es `head: true` (no trae filas, solo el count en el response), es barata.

**Por qué.** El web hace exactamente lo mismo (query independiente del count en `CardsHeader`). Replicarlo en mobile mantiene la consistencia cross-platform y respeta el patrón de chrome-siempre-visible.

### Decision 3: CTA "Agregar tarjeta" mobile renderiza disabled, sin onPress

**Decisión.** El CTA se renderiza con ícono + label completos pero con `disabled` prop a `true` y sin handler. Visualmente respeta la presencia del CTA esperada por el spec ("Acciones a la derecha: ... 'Agregar tarjeta'") pero no inicia ningún flujo.

**Alternativas consideradas.**
- *Ocultar el CTA*: rompe la simetría visual con el web y deja al usuario sin pista de que ese flujo va a existir. Descartado.
- *Que el CTA push a `/cards/new` aún sin existir*: cualquier tap llevaría a 404. Descartado.
- *Toast "próximamente"*: ruido para una limitación temporal; mejor un estado disabled honesto sin feedback adicional.

**Por qué.** El web tiene el mismo patrón visual cuando las queries de catálogos están cargando (botón visible pero disabled). Reusar ese estado en mobile para una razón distinta (ruta hijo aún no existe) no requiere componente nuevo y comunica honestamente "esto está acá pero todavía no funciona".

### Decision 4: `Wallet` como nombre público en ambas plataformas; rename web ahora

**Decisión.** En este mismo change se renombran los componentes web (`WalletGrid` → `Wallet`, `WalletGridSection` → `WalletSection`, `WalletGridContainer` → `WalletContainer`) y se introduce `Wallet` como nombre del componente mobile (renombrando `CreditCardCarousel`). El cambio web es solo de nombres de archivo y exports + actualización de imports en `page.tsx`; ningún cambio de comportamiento.

**Alternativas consideradas.**
- *Defer el rename web a un follow-up*: el inconsistencia ("mobile dice Wallet, web dice WalletGrid") quedaría live hasta que alguien priorice el follow-up. Como el rename es chico (5 archivos), no hay razón fuerte para deferirlo.
- *Mantener nombres distintos por plataforma*: viola la convención cross-platform components (`feedback_cross_platform_components`).

**Por qué.** La regla codificada en `feedback_cross_platform_components` y referenciada en `project-conventions` es que ambas plataformas comparten nombres y distintas implementaciones. Si el rename no se hace ahora, la regla pierde fuerza para futuros componentes.

### Decision 5: La sección "Archivadas" mobile usa `Pressable` + `useState`, no un componente Accordion compartido

**Decisión.** El header de la sección "Archivadas" es un `Pressable` que togglea un boolean local. Cuando está expandido renderiza la lista; cuando no, solo el header.

**Alternativas consideradas.**
- *Crear un `Accordion` primitive en `@grana/ui-mobile` (o `apps/mobile/components/ui/`)*: hay una sola sección colapsable en mobile ahora mismo. La regla "wrappers compuestos solo si la duplicación real aparece en ≥2 rutas" (`feedback_reusable_components`) dice no extraer.
- *Usar `LayoutAnimation` o `Animated`*: animación adicional que no agrega valor para una sección secundaria.

**Por qué.** Mínima superficie de código, sin abstracciones prematuras. Si una segunda sección colapsable aparece en mobile, ahí sí extraer.

### Decision 6: `CardsMonthHero` mobile en single column con la lista de próximos vencimientos debajo del monto

**Decisión.** El layout mobile es vertical:
1. Eyebrow "A pagar este mes".
2. Monto ARS grande.
3. Monto USD subordinado y por separado (si aplica).
4. Destacado del próximo vencimiento (warning-bg pill).
5. Separador.
6. Eyebrow "Próximos vencimientos".
7. Lista de filas (día/mes + tarjeta + monto), idénticas al web.

**Alternativas consideradas.**
- *Esconder la lista de próximos vencimientos en mobile*: pierde información que es central para "saber qué se viene". Descartado.
- *Lista de próximos vencimientos en una pantalla aparte*: requiere navegación extra para un dato que ya tenemos en mano. Descartado.

**Por qué.** Single-column es lo idiomático para mobile y mantiene la misma información que web. La lista no es larga (típicamente N tarjetas activas, ~3-5).

### Decision 7: `getCardsMonthSummary` mobile reutiliza la lógica pura del web pero con cliente Supabase mobile

**Decisión.** Se porta la función al mobile copiando estructura y output shape del web. La lógica de derivar `nextDue`, `upcoming`, totales ARS/USD se replica tal cual. La diferencia es el cliente Supabase (`apps/mobile/lib/supabase.ts` vs el server client del web).

**Alternativas consideradas.**
- *Extraer la lógica pura a `@grana/cards-logic` o `@grana/money-logic`*: el repo ya tiene `@grana/money-logic` con cálculos puros. Extraer ahora la derivación de `summary` agregaría un módulo que solo tiene un consumidor por plataforma. Si más adelante hay una tercera consumer (CLI, jobs), ahí sí.
- *Compartir la query completa (sin shim por plataforma)*: cada plataforma usa un cliente Supabase distinto (server-side cookies en web, AsyncStorage en mobile). No es trivial unificar todavía.

**Por qué.** La política actual del repo es "queries quedan en `lib/` por app". Este change la respeta. La duplicación lógica es chica y ambas implementaciones quedan testables.

## Risks / Trade-offs

**[Riesgo] Divergencia entre `getCardsMonthSummary` web y mobile.** Si una de las dos se actualiza sin la otra, los usuarios ven cifras distintas según plataforma.
- **Mitigación.** Comentario en cada archivo apuntando al otro como mirror, y un scenario en el spec que valida el shape común (`toPayARS`, `toPayUSD`, `hasUSD`, `hasToPay`, `nextDue`, `upcoming[]`). Cualquier cambio futuro al modelo SHALL actualizar ambos archivos.

**[Riesgo] El CTA disabled permanente confunde al usuario** (le aparece un botón que nunca habilita).
- **Mitigación.** El próximo change (creación de tarjetas mobile) habilita el CTA. Mientras tanto, el estado disabled es honesto: el botón está ahí, no se puede usar todavía. Sin tooltip ni copy aclaratorio para no agregar copy efímero.

**[Riesgo] Tres queries react-query independientes en mobile pueden disparar tres requests separados al mismo backend** (en el peor caso, una sola tarjeta llevaría: count + summary + getCreditCards + archived = 4 queries).
- **Mitigación.** El cliente Supabase ya hace coalescing a nivel HTTP y react-query deduplica por queryKey. La hot path es aceptable para una pantalla que se abre desde el menú. Si en métricas reales se ve lentitud, una optimización futura podría introducir una query combinada o un endpoint compuesto.

**[Riesgo] El rename web puede romper imports si hay rutas o tests que importen los nombres viejos.**
- **Mitigación.** Antes del commit, `grep -r "WalletGrid\|wallet-grid"` en `apps/web` para confirmar 0 ocurrencias post-rename. Lint + typecheck deben pasar.

**[Riesgo] El subtítulo `"N tarjetas de crédito · resúmenes de {mes}"` requiere strings i18n.** El web los tiene en `cards.wallet.subtitle` y `cards.route.subtitle_loading`. Mobile usa `useT()` con keys propias.
- **Mitigación.** Reusar el mismo path de keys donde sea posible (`nav.cards` ya existe). Crear `cards.list.subtitle` y `cards.list.subtitle_loading` en el bundle mobile si no existen. Verificar contra `apps/mobile/lib/locale-context.tsx` qué keys ya están en el JSON mobile.

**Trade-off: react-query en mobile vs Suspense en web.** Las dos plataformas expresan "chrome visible siempre" con mecanismos distintos. Un futuro lector debe entender que la diferencia es del framework, no del producto. El spec lo deja explícito.
