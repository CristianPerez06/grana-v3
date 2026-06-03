## Context

La spec `route-loading-and-errors` ya prevé un patrón "in-page chrome" para rutas que necesitan mostrar su header desde el primer paint mientras el contenido aún hace fetch. Hoy el spec describe dos variantes:

- **Variant A** (server components + Suspense en `page.tsx`): el page es sync, monta el chrome y envuelve al async content en `<Suspense fallback={<RouteLoading />}>` más un client error boundary. Caso aprobado: `/dashboard`, `/accounts`.
- **Variant B** (shell cliente + TanStack Query): el page es un wrapper server mínimo (auth/redirects) que monta un shell client; cada sección hace su propio `useQuery` con loading/error inline. Casos aprobados: `/transactions`, `/accounts/[id]`.

Sin embargo, la implementación actual:

1. **No sigue ni A ni B** para `/dashboard`: el `page.tsx` es `async` y awaitea `getEyeMasked()` antes de devolver JSX. Eso suspende el segmento entero antes de que el chrome pueda pintar.
2. **No sigue B limpiamente** para `/transactions`: el `page.tsx` repite el `await supabase.auth.getUser()` "defensivo", que también suspende el segmento.
3. **Define un `(app)/loading.tsx`** con `<RouteLoading />` (spinner full-screen) que actúa como fallback de TODOS los segmentos suspendidos del shell. Aunque las variantes A/B se respetaran, este fallback se renderiza primero — durante el suspense del segmento — y tapa el chrome igual.

El refactor introduce una tercera variante (C) que es la más idiomática del App Router cuando lo único que queremos es "header estático persistente + skeletons abajo": **chrome en `<ruta>/layout.tsx` + skeletons en `<ruta>/loading.tsx`**. Next.js trata `loading.tsx` como Suspense boundary AROUND el `{children}` del layout del mismo nivel — el layout (y por tanto el chrome) queda persistente; el loading.tsx solo reemplaza el cuerpo de page.

## Goals / Non-Goals

**Goals:**

- Que al navegar a `/dashboard` o `/transactions` (incluido el redirect desde `/login`), el chrome de la ruta (header + estructura) aparezca en el primer paint del segmento; el contenido se cubre con skeletons hasta resolver.
- Mantener el comportamiento de UX ya specceado para el header del dashboard (saludo con estado de carga del nombre client-side, controles disabled durante loading) — solo cambia DÓNDE se monta, no CÓMO se comporta.
- Codificar la Variant C en la spec `route-loading-and-errors` para que futuras rutas puedan adoptarla sin reinventarla.

**Non-Goals:**

- Optimizar el tiempo de `await supabase.auth.getUser()` en `(app)/layout.tsx`. Ese cost es el cuello real del redirect login→dashboard y se ataca en otro change.
- Migrar `/accounts`, `/accounts/[id]`, `/cards`, `/settings` a Variant C en este change.
- Tocar mobile.
- Implementar suspense-streaming en el `(app)/layout.tsx` (sigue siendo async con awaits, ese es el contrato del shell).

## Decisions

### Decision 1: Variant C en vez de mover dashboard a Variant A

**Elegido:** Variant C (`layout.tsx` + `loading.tsx` por ruta).

**Alternativa considerada:** Variant A (page sync con `<Suspense fallback={<RouteLoading />}>` envolviendo un wrapper async + client error boundary in-page). Es lo que la spec actual lista como mecanismo para `/dashboard`.

**Razones para elegir C:**

- **Menos piezas:** Variant A requiere un wrapper Container async + un Client Component error boundary co-locado (mini `class extends Component` con `getDerivedStateFromError`). Variant C usa convenciones nativas de Next, sin clases ni boundaries custom.
- **Persistencia visual real:** En Variant A, el chrome vive dentro del page y se vuelve a renderizar en cada navegación a la ruta. En Variant C, el chrome vive en el layout y Next lo preserva entre transiciones de `{children}` (incluido el switch a `loading.tsx`).
- **Error boundary:** los errores de fetch siguen cayendo en el `(app)/error.tsx` existente, que reemplaza solo `{children}` del layout group más cercano. Para errores que queremos atajar al nivel de la ruta sin perder el chrome, se puede agregar un `<ruta>/error.tsx` más adelante — no es necesario para el goal de este change.
- **Coincide con lo que el usuario pidió textualmente:** "el header es estático y el resto hace fetch async".

**Tradeoff aceptado:** el header pierde acceso directo a props server-fetched que estaban en el page (ej. `todayISO`, `eyeMasked`). Solución: el layout es async y fetcha eso ANTES de renderizar. Cost: el layout sí se "rehidrata" su data al cambiar de `loading` → `page` resuelto, pero el componente DOM persiste (React Server Components reconcilia, no remonta).

### Decision 2: Dónde vive `EyeMaskProvider`

**Elegido:** dentro de `dashboard/layout.tsx`. El layout es async, lee `getEyeMasked()` y monta `<EyeMaskProvider initialMasked={…}>` envolviendo `<DashboardHeader />` y `{children}`.

**Alternativa considerada:** dejar `EyeMaskProvider` en `page.tsx` con la lectura como Promise + `use()`. Funcionaría sin bloquear el segmento, pero agrega complejidad client-side innecesaria. El layout async es más directo y respeta que el toggle vive en el header (que ya está en el layout).

**Alternativa rechazada:** subir el provider a `(app)/layout.tsx`. El estado del eye mask es scoped al dashboard (spec lo dice explícitamente: "no SHALL persistir … fuera del dashboard"). Vivir en el shell global rompería ese scope.

### Decision 3: Dónde vive el header de `/transactions`

**Elegido:** extraer el header del actual `TransactionsShell` (client) a un componente que se monte desde `transactions/layout.tsx`. El layout queda async solo si el header necesita data server (revisar en implementación; si solo necesita auth, ese ya lo hizo `(app)/layout.tsx` y el layout de transactions puede ser sync).

**Alternativa considerada:** dejar el header en el client shell. Pero entonces el chrome NO se monta hasta que el page resuelva y el shell hidrate, perdiendo el goal del change. El layout es el único punto donde Next garantiza renderizado persistente del chrome.

**Detalle:** las acciones del header de transactions hoy dependen del estado del shell (filtros, drawer). Si el header se separa al layout, hay dos opciones para conectarlo:
- (a) El header se queda **estático** (solo título + botón "Nuevo movimiento"), y los controles que dependen del estado del shell viven dentro del page. Más simple, alineado con la intención del change.
- (b) Se introduce un `TransactionsHeaderProvider` (Context) en el layout que el shell del page consume. Más laburo, no necesario para el goal.

**Decisión:** (a) por ahora. Si en revisión de implementación el header resulta no-portable (depende de filtros visibles, etc.), se reevalúa en una task adicional documentada.

### Decision 4: Borrar `(app)/loading.tsx` vs. neutralizar (export null)

**Elegido:** borrar el archivo.

**Razón:** existen para forzar el comportamiento de Suspense fallback de Next. Si lo dejamos exportando `null`, el efecto es el mismo (no se muestra UI) pero contamina el árbol de archivos y queda como trampa para futuros agentes ("¿por qué esto está acá vacío?"). Borrarlo deja explícito que la decisión es "no hay fallback global; cada ruta provee el suyo".

**Consecuencia:** las rutas del shell que aún NO definan un `loading.tsx` propio (`/accounts`, `/cards`, `/settings`) caerán al comportamiento default de Next durante navegación, que es **mantener la ruta anterior renderizada** hasta que la nueva resuelva. Eso es aceptable: la URL ya cambió, no hay pantalla en blanco, y la ruta vieja sigue interactiva por ese período. Las rutas que sí necesiten skeleton específico (`/dashboard`, `/transactions`) lo tienen ahora.

**Alternativa considerada:** dejar `(app)/loading.tsx` como skeleton "genérico de shell" (header placeholder + lista placeholder). Rechazada: cada ruta del shell tiene un chrome distinto (dashboard tiene saludo, transactions tiene filtros, accounts tiene lista). Un placeholder genérico engaña en vez de ayudar.

### Decision 5: Mantener el comportamiento de `error.tsx`

**Sin cambios:** `(app)/error.tsx` sigue siendo el único error boundary del shell. Captura errores que ocurran en cualquier ruta (layout, loading, page). Las rutas pueden agregar su propio `<ruta>/error.tsx` cuando quieran preservar chrome ante errores, pero no es parte de este change.

## Risks / Trade-offs

- **[Riesgo] El header de transactions depende del estado del shell client** (ej. botón "Nuevo movimiento" deshabilitado hasta que las queries de drawer-ready resuelvan) → **Mitigación:** en implementación, identificar exactamente qué controles del header dependen de estado del shell. Si todos los controles son estáticos (link a `/transactions/new`, título), el header se mueve limpio al layout. Si alguno requiere el shell, se queda en el page y el layout aloja solo el título — registrar la decisión en `tasks.md`.

- **[Riesgo] El layout async re-fetchea data en cada navegación a la ruta** → **Mitigación:** las funciones que se mueven al layout (`getEyeMasked()`, eventualmente otras) ya son lecturas baratas (cookie reads). Si en el futuro se moviera algo costoso, se puede memoizar con `React.cache()` o moverlo a una server action cacheada. No es un problema hoy.

- **[Riesgo] Rutas sin loading.tsx propio van a "congelar" la URL anterior durante navegación** → **Mitigación:** es un cambio sutil de UX vs. el spinner full-screen actual. Para rutas placeholder (cards, settings) es estrictamente mejor que el spinner. Para rutas reales, agregar `loading.tsx` propio es trivial (una task por ruta cuando llegue su turno).

- **[Riesgo] Test/QA regression** → **Mitigación:** verificar manualmente: (1) cold load `/dashboard`, (2) cold load `/transactions`, (3) navegación dashboard ↔ transactions, (4) redirect login → dashboard. En los 4 casos: el header de la ruta destino debe aparecer antes que el contenido; el contenido se cubre con skeletons (dashboard) o con su loading propio (transactions).

- **[Riesgo] El `(app)/error.tsx` deja de cubrir errores de loading.tsx** → **Mitigación:** loading.tsx no puede throw-ear async; son client components puros que renderizan skeletons. No hay riesgo real, pero si alguno se vuelve no-trivial en el futuro, agregar `<ruta>/error.tsx` correspondiente.
