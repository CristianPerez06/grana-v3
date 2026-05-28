## Context

Hasta este change, `apps/web/app/(app)/dashboard/page.tsx` era un async server component que awaiteaba `Promise.allSettled([heroResult, upcomingResult, monthResult, hasMovementsResult, profileResult])` antes de devolver JSX. Mientras esa promesa no resolvía, Next.js mostraba `app/(app)/loading.tsx` (`RouteLoading` con spinner centrado) ocupando todo el área de contenido. El header — saludo, fecha, eye toggle, "Nuevo movimiento" — no existía hasta que llegaba toda la data, aunque sólo dependía del nombre del perfil (lookup por PK, muy barato).

Constraints relevantes:
- Stack: Next.js 16 App Router + React 19, sin SWR/TanStack Query en web (`apps/web/package.json`).
- El cliente browser de Supabase ya existe (`apps/web/lib/supabase/client.ts`).
- El UI `Button` (`apps/web/components/ui/button.tsx`) está tipado contra `@grana/ui-contracts`, que también lo consume `apps/mobile/components/ui/Button.tsx`. Cualquier cambio en `ButtonSize` necesita reflejo en ambas implementaciones.
- El Dashboard tiene su propio sistema de fallbacks por sección (`SectionFallback`) y un `EyeMaskProvider` cliente que envuelve todo.

## Goals / Non-Goals

**Goals:**
- Que el header del Dashboard aparezca en el primer paint, con sus controles visibles aunque deshabilitados, sin esperar al fetch del contenido.
- Que el loading y el error del contenido vivan **dentro** del Dashboard (Suspense + ErrorBoundary in-page) en vez de tapar el header con `(app)/loading.tsx`/`error.tsx`.
- Sentar el patrón de `size="icon"` en el UI Button para botones cuadrados de ícono (eye toggle como primer caso).
- Dejar el camino abierto para que cada sección del Dashboard pase a fetchear su propia data como cliente (próximo change).

**Non-Goals:**
- Migrar las demás rutas (`/accounts`, `/cards`, `/transactions`, `/settings`) a este mismo patrón. Cada una decidirá cuando le toque.
- Migrar el resto de los botones-de-ícono artesanales del repo (`month-navigator`, controles del `app-shell`) a `size="icon"`. Tienen tamaño/radius distintos y se evaluarán por separado.
- Hoistear el `full_name` a un `UserProvider` global en `(app)/layout.tsx` (opción válida pero fuera de alcance; el header se hace cargo solo por ahora).
- Cambiar la lógica de eye mask, los queries de las secciones, o la i18n del header.

## Decisions

### 1. El header self-fetchea el nombre en lugar de recibirlo por prop
**Decisión:** `DashboardHeader` pasa a `'use client'` y resuelve el `full_name` del perfil con el browser client de Supabase desde un `useEffect`. Mientras tanto, `firstName === null` e `isLoading === true`; renderiza saludo anon + controles disabled.

**Por qué:** la página puede dejar de ser async (shell sync, primer paint inmediato), y el header queda independiente del fetch del contenido. Alternativa considerada: dejar el header como server component y awaitear sólo el nombre en `page.tsx`. Más simple pero acopla el primer paint a un round-trip Supabase y arrastra al header al mismo Suspense boundary que el contenido si lo movemos adentro.

**Trade-off aceptado:** el primer paint del header se ve disabled y con "Hola." en lugar de "Hola, Cristian." durante el round-trip de Supabase desde el browser. Es visible como un pequeño flicker. Mitigación futura: opción de hoistear el nombre a un `UserProvider` en `(app)/layout.tsx`; lo dejamos para cuando un segundo header lo necesite.

### 2. Loading y error in-page, no segment-level, para el contenido del Dashboard
**Decisión:** `DashboardContent` envuelve el body en `<DashboardErrorBoundary><Suspense fallback={<RouteLoading />}><DashboardContentBody /></Suspense></DashboardErrorBoundary>`. `DashboardContentBody` queda como async server component con el `Promise.allSettled` de hero/upcoming/month/hasMovements.

**Por qué:** el segment-level `(app)/error.tsx` y `(app)/loading.tsx` reemplazan TODO el segmento (header incluido). Para mantener el header visible durante loading/error del contenido tenemos que poner los boundaries más adentro. `Suspense` cubre loading; un client `ErrorBoundary` (mini class component) cubre errores throw-eados desde el server component dentro de la Suspense.

**Alternativa considerada:** confiar en `(app)/loading.tsx`/`error.tsx` y aceptar que el header no aparezca durante esos estados. Más simple, pero contradice el objetivo del change.

### 3. `DashboardErrorBoundary` es una class component co-localizada
**Decisión:** Implementación inline con `Component` + `getDerivedStateFromError`, renderiza `RouteError` cuando hay error y permite reintentar reseteando el state. Vive en `apps/web/app/(app)/dashboard/_components/dashboard-error-boundary.tsx`.

**Por qué:** no hay otra librería de error boundaries en el proyecto y agregar `react-error-boundary` por un único uso no se justifica. Class component pequeña, fácil de entender, reutilizable si surge otro caso.

**Trade-off:** si más rutas adoptan el mismo patrón, conviene moverla a `components/ui/in-page-error-boundary.tsx` (o equivalente) y parametrizar el fallback. No lo hacemos preventivamente; lo hacemos cuando aparezca el segundo cliente.

### 4. `Button` gana una size `'icon'` en el contrato compartido
**Decisión:** `ButtonSize` en `@grana/ui-contracts` pasa a `'sm' | 'md' | 'lg' | 'icon'`. En web la size aplica `h-9 w-9 p-0 rounded-full`; al concatenarse después del base (`w-full rounded-[var(--radius-lg)]`) y pasar por `cn` → `tailwind-merge`, los conflictos se resuelven a `w-9` y `rounded-full`. En mobile el mapeo es paralelo (mismas clases) para mantener el contrato.

**Por qué:** el contrato está pensado para que web y mobile compartan API pública del Button. Agregar la size sólo en web rompería el supuesto cross-platform.

**Alternativa considerada:** extender el tipo localmente en web (`ButtonSize | 'icon'`) sin tocar el contrato. Menos invasivo pero diverge. Dado que la size es conceptualmente válida en cualquier plataforma (un botón cuadrado de ícono), va al contrato.

**Trade-off:** mobile no tiene call-sites de `size="icon"` aún. El mapping de mobile es "defensivo": si alguien lo usa antes de tener un caso real, va a heredar el `w-full` del base de mobile y el resultado visual no va a ser correcto. Lo aceptamos: el momento de pulirlo es cuando aparezca el primer uso mobile.

### 5. La página se queda como server component sync
**Decisión:** `dashboard/page.tsx` queda como función sync, sin `async`, sólo computando `todayISO` y rindiendo el shell.

**Por qué:** Next.js puede stremear el shell sin esperar nada en el server. El segment-level `(app)/loading.tsx` deja de aplicarse en la práctica para `/dashboard` porque la página resuelve instantáneo y el Suspense interno asume la responsabilidad del loading.

## Risks / Trade-offs

- **Flicker del saludo "Hola." → "Hola, Cristian." en el primer paint** → Mitigación: aceptable porque el round-trip browser↔Supabase de un PK lookup es muy corto; futuro `UserProvider` lo elimina si se vuelve molesto.
- **Hidratación: el server renderiza el header con `isLoading=true`, el cliente arranca igual y luego `useEffect` corre y actualiza state** → No hay mismatch de hidratación; el estado inicial coincide.
- **Errores del header (no de DashboardContent) no están envueltos por el `DashboardErrorBoundary`** → Si `useEffect` o el render del header throw-ea, bubblea a `(app)/error.tsx`. Aceptable: el header es código simple y la salida fallback ya existe.
- **`tailwind-merge` y el `rounded-[var(--radius-lg)]` arbitrario** → Si tailwind-merge no resuelve el conflicto contra `rounded-full` en una versión futura, el botón "icon" podría quedar con dos radius. Mitigación: verificable visualmente; si pasa, mover `w-full`/`rounded-lg` del base a las sizes `sm`/`md`/`lg`.
- **Mobile recibe `'icon'` en el contrato sin implementación visual válida** → Trade-off explícito: el contrato es honesto, el costo lo paga el primer call-site mobile cuando aparezca.

## Migration Plan

El change ya se aplicó en `main` (commits previos al draft de este openspec). No hay paso de deploy adicional; este change es la documentación retroactiva. Si en el futuro se revierte:
1. Volver `dashboard/page.tsx` a su versión `async` con `Promise.allSettled`.
2. Devolver `DashboardHeader` a server component que recibe `name` y `todayISO` como props.
3. Borrar `dashboard-content.tsx` y `dashboard-error-boundary.tsx`.
4. Devolver `EyeMaskToggle` a su versión con `<button>` artesanal.
5. Quitar `'icon'` de `ButtonSize` en el contrato y de ambas implementaciones.

## Open Questions

- ¿Cuándo hoisteamos el `full_name` (y/o `user`) a un `UserProvider` en `(app)/layout.tsx`? Disparador propuesto: cuando una segunda ruta necesite el nombre en su header.
- ¿Vale la pena un `<IconButton />` dedicado en `components/ui/` que combine `variant="ghost" size="icon"` por defecto? Disparador: tres o más call-sites repitiendo el mismo par variant/size.
- ¿Convertimos `month-navigator` y los icon-buttons del `app-shell` a `Button size="icon"`? Hoy usan `h-8`/`h-9` con `rounded-md`/`rounded-full` y distinto color de hover; requeriría una decisión sobre `shape` o más sizes antes de migrar.
