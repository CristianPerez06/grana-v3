## Context

La tarjeta "Balance del mes" hoy obtiene los datos del mes server-side (web, en `page.tsx` vía `getMonthBalanceSeries`) o vía TanStack Query atado a un query param (mobile). En ambos casos el mes vive en la URL (`?month=YYYY-MM`) y las flechas son links de navegación:

- **Web**: `MonthBalanceSection` y `MonthNavigator` son Server Components; las flechas son `<Link>`. Cambiar de mes navega la ruta → re-render completo de `/dashboard` + parpadeo del `loading.tsx` full-screen de `(app)`.
- **Mobile**: el mes sale de `useLocalSearchParams`; las flechas son `Link` de Expo Router. El screen condiciona el render de la tarjeta a `monthSeries.data`, así que al cambiar a un mes no cacheado la tarjeta renderiza `null` (se desmonta/monta).

Ninguna plataforma tiene estado de carga/error **propio de la tarjeta** (web hereda el spinner de ruta; mobile usa un `SectionFallback` que reemplaza toda la tarjeta). Y en web, entre ~1024–1088px de viewport la columna izquierda del grid (`lg:grid-cols-[minmax(0,1fr)_22rem]`, junto al sidebar) queda muy angosta (~330px) y el navegador (≈260px) + título desbordan el header: la flecha derecha se sale de la tarjeta.

Constraint del repo: web usa RSC + server actions como seam de fetching; **TanStack Query es exclusivo de mobile** (módulo `route-loading-and-errors`). Las queries y agregaciones puras viven en `@grana/dashboard` y no cambian.

## Goals / Non-Goals

**Goals:**

- La tarjeta "Balance del mes" es un componente cliente self-contained que posee el mes seleccionado en estado local y obtiene los datos del lado del cliente al navegar de mes — sin re-renderizar la página (web) ni desmontar la tarjeta (mobile).
- Estado de carga in-card: el spinner reemplaza **solo** el gráfico + footer; título y navegador permanecen visibles e interactivos.
- Estado de error in-card: reemplaza **solo** el gráfico + footer, con reintento; título y navegador permanecen visibles.
- En ambos estados el alto y ancho de la tarjeta no cambian (sin layout shift).
- Web: la flecha derecha del navegador nunca desborda la tarjeta entre ~1024–1088px.
- Paridad cross-platform: misma estructura, mismos nombres, mismo contrato de props del navegador; cada plataforma usa su seam idiomático (server action / TanStack Query).

**Non-Goals:**

- No se cambia `@grana/dashboard` (`getMonthBalanceSeries`, `buildMonthBalanceSeries`, tipos) ni el esquema de DB.
- No se introduce TanStack Query en web.
- No se preserva el mes en la URL (deep-link / refresh). Decisión explícita del usuario.
- No se rediseña el gráfico, los colores ni los cálculos del balance.
- No se tocan las otras secciones del dashboard (Hero, "Lo que viene").

## Decisions

### D1 — El mes vive en estado local de la tarjeta, inicializado al mes actual AR

La tarjeta posee `{ year, month }` en `useState`, inicializado al mes actual derivado de `getTodayAR()`. Las flechas mutan ese estado; no hay navegación de ruta ni lectura de query params.

- **Web**: `page.tsx` deja de parsear `?month=` para esta sección y pasa a la tarjeta el **dato inicial server-rendered del mes actual** (`initialData: MonthBalanceSeries`) + `initialYear/initialMonth`. Primera pintura sin spinner.
- **Mobile**: el screen deja de derivar el mes de `useLocalSearchParams` y deja de condicionar el render a `monthSeries.data`. La tarjeta llama internamente al hook con su estado local.
- *Alternativa descartada*: mantener el mes en URL y actualizarla con `history.pushState` (web) leyéndola client-side. Más frágil, más piezas, mismo resultado visual. Descartada por el usuario.

### D2 — Seam de fetching por plataforma

- **Web — server action**. Nuevo action en `apps/web/app/_actions/dashboard.ts` (convención existente `app/_actions/*`), p.ej. `fetchMonthBalanceSeries(year, month): Promise<MonthBalanceSeries>`, que crea el server client y delega en `getMonthBalanceSeries(supabase, year, month)`. La tarjeta lo invoca al navegar y maneja `loading`/`error` con estado local (ver D3).
- **Mobile — TanStack Query**. Se reutiliza `useMonthBalanceSeries(year, month)` tal cual; el query key `['dashboard','balance-series',{year,month}]` ya invalida/refetchea al cambiar el estado. La tarjeta deriva loading/error del resultado del hook.
- *Por qué no unificar*: el repo reserva TanStack Query para mobile y RSC/server actions para web (módulo `route-loading-and-errors`). Unificar rompería esa convención.

### D3 — Máquina de estados de la tarjeta

Estados del área "gráfico + footer": `loading | error | ready`. Título + navegador siempre `ready`.

- **Web** (sin caché): estado local `status: 'idle' | 'loading' | 'error'` + `data`. Arranca `idle` con `initialData`. En prev/next: computa el nuevo mes, `status='loading'`, llama al action; al resolver `status='idle'` + `data`, al fallar `status='error'`. El reintento re-ejecuta el action para el mes actual seleccionado. Durante `loading` se muestra spinner (no se mantiene data vieja) para cumplir "el spinner reemplaza el gráfico y el footer".
- **Mobile**: `query.isPending && !query.data` → loading; `query.error && !query.data` → error (con `onRetry = query.refetch`); si hay `data` → ready (un refetch con data cacheada mantiene la data visible, no parpadea).
- **Concurrencia (web)**: clicks rápidos pueden resolver fuera de orden. Mitigación: token monotónico por request (un `useRef` contador); al resolver, si el token no es el último, se descarta. En mobile lo resuelve TanStack Query por query key.

### D4 — Tamaño fijo del área intercambiable (sin layout shift)

El gráfico tiene alto fijo (web `height=200`, mobile default `200`) y el footer un alto propio. El bloque "gráfico + footer" se envuelve en un contenedor cuyo alto se mantiene constante entre los tres estados:

- **Web**: la `<section>` sigue siendo `flex h-full flex-col`; el contenedor intercambiable conserva `flex-1` (en columna de desktop estira a `h-full`) y centra el spinner/error. Así el alto no colapsa al pasar a loading/error.
- **Mobile**: el contenedor intercambiable usa un `min-height` igual a (alto del gráfico + alto del footer) y centra spinner/error.

### D5 — Contrato del navegador y fix de overflow (web)

`MonthNavigator` deja de recibir `prevHref/nextHref` y pasa a recibir callbacks + flags, alineado a la convención `onPress` del repo:

- Props (ambas plataformas, mismos nombres): `label: string`, `onPrev?: () => void`, `onNext?: () => void` (undefined ⇒ flecha deshabilitada, preservando la semántica actual de href ausente).
- **Overflow (web)**: el header del navegador deja de desbordar aplicando:
  - título de la sección `min-w-0` + `truncate` (cede espacio cuando la columna es angosta);
  - navegador `shrink-0` (se mantiene íntegro);
  - reducir el `min-w` del label del mes (de `10rem` a un valor menor) para achicar el footprint del navegador;
  - `overflow-hidden` en la `<section>` como red de seguridad.
  - *Alternativa considerada*: permitir wrap del header (navegador baja a una segunda línea) en viewports angostos. Se prefiere truncar el título + navegador compacto para no alterar el alto del header; queda como fallback si truncar no alcanza visualmente.

## Risks / Trade-offs

- **Pérdida del deep-link del mes** → Aceptada por el usuario; el dashboard siempre abre en el mes actual. Si en el futuro se necesita compartir un mes, se puede reintroducir vía estado en URL sin re-navegación (history API).
- **Respuestas fuera de orden en web (clicks rápidos)** → Token monotónico por request (D3) descarta resultados obsoletos.
- **Mobile: el screen pierde visibilidad del estado de la query del mes** (hoy alimenta `initialLoading` y el `RefreshControl`) → `initialLoading` deja de depender de `monthSeries` (cada sección autogestiona su carga, más consistente con el nuevo diseño); `onRefresh` sigue invalidando la raíz `['dashboard']`, lo que refetchea la query activa de la tarjeta. El `refreshing` del RefreshControl puede dejar de reflejar la tarjeta del mes (cosmético menor).
- **Web: doble fuente para el mes actual** (server-rendered inicial vs. client tras navegar) → El render inicial usa `initialData`; recién al navegar se fetchea client-side. Coherente porque el cálculo es el mismo (`getMonthBalanceSeries`) en ambos caminos.
- **Truncado del título en columnas muy angostas (~330px)** → En el peor caso el título "Balance del mes" se trunca bastante; es preferible a un desborde. Si molesta visualmente, se activa el fallback de wrap del header (D5).
