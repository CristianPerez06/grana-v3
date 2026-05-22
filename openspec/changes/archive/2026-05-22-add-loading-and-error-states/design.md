## Context

Hoy `apps/web` no tiene **ningún** `loading.tsx` ni `error.tsx`; todas las páginas son Server Components async que hacen `await` antes de mandar HTML, lo que produce el efecto "freeze" entre rutas (la URL anterior persiste hasta que el RSC payload resuelve). `apps/mobile` usa `useState` + `useEffect`/`useFocusEffect` para fetching cliente — patrón funcional pero que reinventa boilerplate por pantalla, sin cache compartida, sin retry, sin invalidación, sin refetch on focus consistente.

El stack relevante:

- Web: Next.js 16.2.6, React 19.1.0, App Router, Tailwind v4, Storybook.
- Mobile: Expo SDK 54, React Native 0.81.5, Expo Router 6, React 19.1.0, NativeWind 4.
- Tokens: `@grana/ui-tokens` exporta CSS variables (Tailwind v4 es CSS-first; no hay TS mirror todavía — ver memoria del workspace).
- Contratos: `@grana/ui-contracts` ya alberga `ButtonProps`, `CardProps`, etc., y es el lugar canónico para nuevos prop types cross-platform.

Constraints:

- "Server Components by default" (`CLAUDE.md`) → react-query NO entra en web.
- React 19.1.0 está pineado estricto en el workspace (memoria registrada). La versión de TanStack Query elegida debe ser compatible.
- Web y mobile NO comparten JSX; sí comparten prop types vía `@grana/ui-contracts`.

## Goals / Non-Goals

**Goals:**

- Eliminar el "freeze percibido" entre rutas en web introduciendo `loading.tsx` por segmento.
- Cubrir errores server-side con `error.tsx` por segmento usando un componente reusable.
- Establecer TanStack Query como **el** seam de fetching cliente en mobile (no como una opción más entre varias).
- Demostrar el patrón end-to-end migrando `dashboard.tsx` mobile.
- Mantener API de componentes (`Spinner`, `RouteError`) idéntica entre plataformas vía `@grana/ui-contracts`.

**Non-Goals:**

- NO introducir react-query en web (sería downgrade arquitectónico).
- NO implementar Suspense granular por sección dentro de páginas en este change (decisión: opción A — un loader por ruta). Se identifica como follow-up.
- NO implementar mapeo de errores a copy específica por tipo. Mensaje genérico + retry; el mapeo queda como follow-up.
- NO migrar otras pantallas mobile más allá de `dashboard.tsx`. El resto son placeholders o están fuera de scope.
- NO crear Storybook para mobile (no existe hoy; no se introduce en este change).
- NO crear un TS mirror de los design tokens en `@grana/ui-tokens` para mobile (ya documentado como codegen futuro en memoria).

## Decisions

### Decisión 1: Estrategia de loading en web = un `loading.tsx` por segmento (opción A)

Next App Router soporta tres granularidades:

| Granularidad | Cuándo | Tradeoff |
|--------------|--------|----------|
| **A. `loading.tsx` por segmento** | Default propuesto | Simple; el spinner reemplaza al `page.tsx` entero mientras resuelve. Una página pesada queda blanca-con-spinner aunque secciones individuales hayan resuelto. |
| **B. `<Suspense>` por sección dentro de `page.tsx`** | Mejora futura | Mejor UX percibida (hero aparece antes que el balance); requiere reestructurar cada página. |
| **C. Híbrida (loading.tsx + algunas Suspense)** | Mejora futura | Lo mejor de ambos. |

Optamos por **A** porque es la base que habilita B/C después sin reescribir nada. Si una página específica (probablemente `dashboard`) sufre demasiado por A, se introduce `<Suspense>` granular como cambio aislado en un follow-up.

### Decisión 2: `RouteLoading` wrapper en web vive en `_components/` por layout group

Cada `loading.tsx` debe centrar un `<Spinner size="lg" />`. Para no duplicar markup en ~25 archivos, hay tres opciones:

| Opción | Pros | Contras |
|--------|------|---------|
| Inline en cada `loading.tsx` | Sin abstracción nueva | Duplicación pura, 25 archivos copy-paste |
| **Wrapper `RouteLoading` en `apps/web/components/ui/`** | Un solo punto de cambio; `loading.tsx` queda 3 líneas | Sutil acoplamiento entre layout y UI lib |
| Wrapper por layout group | Aislamiento por área | Reabre el problema en cada área nueva |

Elegimos **wrapper en `components/ui/`**: `RouteLoading` recibe opcionalmente una prop `size` (default `lg`) y se compone con `Spinner`. Cada `loading.tsx` queda:

```tsx
import { RouteLoading } from '@/components/ui/route-loading'
export default function Loading() { return <RouteLoading /> }
```

### Decisión 3: Implementación interna del Spinner web vs mobile

| Aspecto | Web | Mobile |
|---------|-----|--------|
| Base | SVG inline + animación CSS (`@keyframes rotate`) o `lucide-react` `Loader2` con `animate-spin` | Custom SVG con `react-native-svg` + `react-native-reanimated` |
| ¿Por qué no `ActivityIndicator` nativo? | N/A | iOS y Android renderizan estilos visuales distintos; tamaños fijos (`small`/`large`); tinte vía `color` prop pero sin variantes intermedias. Para tener exactamente `sm`/`md`/`lg` con paridad visual y color de token, custom SVG es más predecible. |

Web ya tiene `lucide-react` (`Loader2`) y `tailwindcss` con `animate-spin` — la implementación más simple es exactamente esa. Mobile usa SVG + Reanimated (ya está en deps por `react-native-reanimated`).

Diámetros propuestos (ajustables en implementación):

- `sm`: 16px
- `md`: 24px
- `lg`: 40px

### Decisión 4: `SpinnerProps.className` se acepta en mobile aunque no haga nada útil

`@grana/ui-contracts` define `className?: string` en `SpinnerProps`. En web es relevante (tailwind classes para posicionamiento ad-hoc). En mobile, NativeWind acepta `className` y lo traduce a styles. Mantenerlo en la API compartida simplifica el contrato; mobile lo respeta como modificador de estilo (background, margin, etc.).

### Decisión 5: TanStack Query v5 + `@tanstack/react-query-persist-client` NO se introduce ahora

TanStack Query v5 es compatible con React 19 (verificado por el equipo de TanStack en releases ≥ v5.59). Versión específica a fijar en el `package.json` durante implementación, no antes (riesgo bajo de drift en el ínterin).

El plugin de persistencia (que guardaría el cache en `expo-secure-store` o `AsyncStorage`) **no** se introduce ahora: agrega complejidad de invalidación y APIs y solo aporta valor real una vez que haya múltiples pantallas con queries. Cuando llegue ese momento, será un change independiente.

### Decisión 6: Configuración por defecto del QueryClient

```ts
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,            // 30s — equilibrio entre frescura y refetches innecesarios
      retry: (failureCount, err) => {
        // No reintentar errores 401/403 (auth) ni 404 (no existe)
        if (isAuthOrNotFoundError(err)) return false
        return failureCount < 1     // 1 reintento en errores transitorios
      },
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,  // no aplica en RN; se usa focusManager + AppState (ver decisión 7)
    },
  },
})
```

Valores específicos son baseline razonable, no dogma. Pantallas pueden override por query.

### Decisión 7: Integración de refetch on focus en mobile = `AppState` + `focusManager`

TanStack Query no detecta focus de pantalla en RN por defecto. La integración recomendada en la doc oficial de TanStack:

```ts
import { focusManager } from '@tanstack/react-query'
import { AppState, type AppStateStatus } from 'react-native'

focusManager.setEventListener((handleFocus) => {
  const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
    handleFocus(state === 'active')
  })
  return () => sub.remove()
})
```

Esto se setea **una sola vez** en `apps/mobile/app/_layout.tsx` raíz, fuera del componente (módulo top-level). El listener se registra al importar el módulo y dispara refetches cuando la app vuelve de background a foreground.

Para focus a nivel de pantalla (navegar entre tabs), TanStack recomienda complementar con `useRefreshOnFocus(refetch)` por pantalla — **opcional, no parte del seam**. Las pantallas que lo necesiten lo agregarán a mano. La especificación de mobile-app-shell requiere la integración global (`AppState`); el por-pantalla queda como patrón documentado pero no obligatorio.

### Decisión 8: Inventario de rutas web a cubrir

30 archivos `page.tsx` actuales (output de `find`). Agrupando por layout group:

- `(app)/`: dashboard, settings, cards (+ new, [id]), transactions (+ [txId], recurring + [id]), accounts (+ new, [id] + edit + transactions/[txId]), settings/categories (+ new, [id]/edit, [id]/subcategories) → **~17 segmentos**
- `(auth)/`: login, signup (+ verify), forgot-password (+ verify), reset-password → **~6 segmentos**
- `(onboarding-wizard)/`: welcome, perfil, saldo-actual, done → **~5 segmentos** (+ el wrapper `/onboarding` root)
- Root: `app/page.tsx` → 1 segmento

**Estrategia operativa:**

1. Empezar agregando `loading.tsx` + `error.tsx` **a nivel de cada layout group** (`(app)/loading.tsx`, `(auth)/loading.tsx`, `(onboarding-wizard)/loading.tsx`). Eso cubre todas las rutas hijas con un fallback razonable.
2. Identificar rutas pesadas (ej. `dashboard`, `transactions`) y agregar overrides específicos solo si el fallback genérico es notoriamente peor.

NO agregamos un par por ruta a priori — el archivo proliferation es real y la regla "agregar al nivel más alto donde aplique" está codificada en el spec.

### Decisión 9: Migración de `dashboard.tsx` mobile — una query por sección

`dashboard.tsx` actualmente hace `Promise.all` de 4 fetchers (`getDashboardHero`, `getMonthBalanceSeries`, `getUpcomingFortnight`, `getCreditCards`) más `hasUserMovements`. Migrar a **una `useQuery` por sección** (4 queries paralelas + 1 para `hasUserMovements`), no a una sola megaquery. Razones:

- Invalidación granular: cuando se confirme una recurrencia, invalidar solo `dashboard.upcoming-fortnight` y `dashboard.hero`, no todo.
- Estados independientes: si la query de cards falla pero el hero está OK, la pantalla muestra `<RouteError>` solo en la sección de cards (no rompe el dashboard entero).
- Conveniencia futura: cada feature mobile (movimientos, tarjetas, etc.) seguirá este mismo patrón.

Query keys propuestas (jerárquicas, para invalidación eficiente):

- `['dashboard', 'hero', { year, month }]`
- `['dashboard', 'balance-series', { year, month, monthsBack }]`
- `['dashboard', 'upcoming-fortnight', { today }]`
- `['dashboard', 'cards']`
- `['dashboard', 'has-movements']`

### Decisión 10: i18n del mensaje de RouteError

El mensaje "Algo salió mal" + label "Reintentar" SHALL leerse desde `@grana/i18n-messages`. Keys propuestas:

- `error.generic_title` → "Algo salió mal" / "Something went wrong"
- `error.generic_subtitle` (opcional, futuro) → "Intentá de nuevo en unos segundos" / "Try again in a few seconds"
- `error.retry_action` → "Reintentar" / "Retry"

Web usa `next-intl` (`useTranslations('error')` en Client Component). Mobile usa el helper `t()` de `apps/mobile/lib/i18n.ts`. Ambos consumen el mismo catálogo.

## Risks / Trade-offs

- **[Riesgo] react-query 5 + React 19 + Reanimated 4 podrían tener fricción en peer deps** → Mitigación: durante implementación correr `pnpm install --frozen-lockfile=false` y validar que no aparecen peer warnings críticos. Si los hay, fijar la versión exacta documentada en la doc oficial de TanStack para React 19.
- **[Tradeoff] Opción A produce páginas blancas-con-spinner aunque el sidebar siga visible** → Aceptado. Mejor que el freeze actual. Si en uso real una página específica sufre, se migra a `<Suspense>` granular en un follow-up.
- **[Riesgo] El `loading.tsx` a nivel de layout group cubre el inicial pero NO entre navegaciones intra-group si Next no detecta segmento padre cambiando** → Mitigación: validar en implementación con `dashboard → cards` y `cards → cards/[id]`; agregar pares específicos si el fallback no se dispara.
- **[Riesgo] El error.tsx de Next siempre es Client Component y NO captura errores ocurridos durante el render del layout padre** → Aceptado. Errores en root layout no se atrapan; si un día se vuelve un problema real, se agrega `global-error.tsx`. Por ahora fuera de scope.
- **[Riesgo] Migrar `dashboard.tsx` mobile a 5 useQuery requiere refactor moderado del componente** → Mitigación: hacerlo en commit aislado dentro del change para que sea fácil de revertir si rompe algo en mobile (que recordamos, hoy solo tiene dashboard real funcionando).
- **[Riesgo] Las stories de Storybook de `RouteError` no pueden simular el `reset()` de Next (que solo existe dentro de un error boundary real)** → Mitigación: la story pasa un `onRetry` mock (ej. `() => alert('retry clicked')`). La story documenta el componente, no el wiring con Next.

## Open Questions

- ¿Hay alguna ruta web cuyo data fetching server-side sea **tan rápido** (sin queries reales) que el `loading.tsx` produzca flicker indeseable? Pre-evaluación: las rutas de `(auth)/` son las candidatas. Si flickea, agregar `delay` mínimo no es trivial en Next; alternativa es no incluir `loading.tsx` en esa área y dejar el `error.tsx` solo. **A confirmar en implementación.**
- ¿Mover algún query del dashboard a `@grana/dashboard` como hook reusable (`useDashboardHero`)? Hoy `@grana/dashboard` exporta solo funciones puras + fetchers, no hooks. Decisión preliminar: **no** en este change — mantener `useQuery` en `apps/mobile/lib/dashboard/queries.ts` o inline en la pantalla. Promover a paquete shared si el patrón se repite. Validar al implementar.
