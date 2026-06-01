## Why

Hoy `apps/web/app/(app)/cards/page.tsx` hace un `Promise.all` de 4 queries en el server component antes de devolver cualquier HTML. La consecuencia: el header (título, subtítulo con count, botón "Agregar tarjeta") no se ve hasta que **toda** la data está lista, y si cualquier query falla, la ruta entera cae en el `error.tsx` del segment-level y reemplaza la página completa.

El dashboard ya resolvió este problema: header siempre visible desde el primer paint (client-side, controles disabled hasta hidratar), contenido en un scaffold de `<Suspense>` por sección con fallback consistente, y cada container maneja su propio error sin tirar abajo la ruta. Esa receta ya está reconocida en `route-loading-and-errors` como una variante válida y deliberadamente in-page. Queremos aplicarla a `/cards` por las mismas razones: percepción de carga más rápida, robustez ante errores parciales, y consistencia visual entre rutas principales.

Alcance acotado: solo el listado en `/cards` (index). `/cards/[id]` y `/cards/new` quedan fuera y se tratarán en otro change si valen la pena.

## What Changes

- **Reescribir `apps/web/app/(app)/cards/page.tsx`** para que no tenga `await` bloqueantes: solo monta el chrome (header + scaffold de Suspense). El auth check sigue server-side.
- **Crear `CardsHeader`** (`'use client'`) que se renderiza desde el primer paint y hace fetch propio con el cliente browser de Supabase para:
  - count de tarjetas activas → muestra `"-"` mientras carga, luego el número real
  - `institutions` + `card_networks` → necesarios para que el botón "Agregar tarjeta" abra el drawer funcional
  - El botón "Agregar tarjeta" SHALL renderizarse disabled mientras cualquiera de esas queries no resuelva; cuando resuelven todas (o fallan), SHALL pasar a habilitado.
- **Crear tres containers server-async**, cada uno con su query aislada, su try/catch interno y su Suspense fallback:
  - `CardsMonthHeroContainer` → `getCardsMonthSummary()`
  - `WalletGridContainer` → `getCreditCards({ includeArchived: false })` (tarjetas activas; incluye el título de sección "Mis tarjetas")
  - `ArchivedCardsContainer` → `getCreditCards({ archivedOnly: true })` (solo archivadas; renderiza nada si vacío)
- **Crear `CardsErrorBoundary`** (`'use client'`) como red de seguridad in-page para errores que escapen al try/catch de los containers, paralelo a `DashboardErrorBoundary`.
- **Reusar `SectionFallback`** del dashboard para los estados loading y error de cada sección (mismo estilo dashed-border + min-height). En esta iteración lo importamos desde `../dashboard/_components/section-fallback`; promoverlo a un componente compartido queda explícitamente fuera del scope.
- Las queries server `getCreditCards`, `getCardsMonthSummary`, `getInstitutions`, `getCardNetworks` NO cambian de firma. Si `getCreditCards` no admite ya las flags `{ includeArchived?: boolean; archivedOnly?: boolean }`, se extiende sin romper callers actuales.

## Capabilities

### New Capabilities
<!-- ninguna -->

### Modified Capabilities

- `cards`: el requirement "El listado de tarjetas se muestra como wallet en grilla con hero de pago mensual" agrega comportamiento de carga progresiva: header visible desde el primer paint con estado "loading" (count en `"-"`, botón "Agregar tarjeta" disabled), y secciones (hero del mes, wallet, archivadas) cargan independientemente con loading y error aislados sin tapar el header.

## Impact

**Código (`apps/web`):**
- Reescritura de `apps/web/app/(app)/cards/page.tsx` (server component se vuelve casi vacío).
- Nuevo `apps/web/app/(app)/cards/_components/cards-header.tsx` (`'use client'`).
- Nuevos containers en `apps/web/app/(app)/cards/_components/`: `cards-month-hero-container.tsx`, `wallet-grid-container.tsx`, `archived-cards-container.tsx`.
- Nuevo `apps/web/app/(app)/cards/_components/cards-error-boundary.tsx` (`'use client'`).
- `apps/web/app/(app)/cards/_components/add-card-button.tsx` se ajusta para aceptar `disabled` y para vivir dentro del header (deja de recibir `institutions`/`networks` desde `page.tsx`).
- Posible ajuste en `apps/web/lib/cards/queries.ts` solo si `getCreditCards` aún no soporta `{ archivedOnly: true }`.

**Queries / data:**
- Sin cambios en el modelo de datos. Las queries existentes se invocan desde más lugares (cada container ahora la dispara por su cuenta) pero son las mismas funciones.

**Capabilities relacionadas (sin tocar sus specs):**
- `route-loading-and-errors`: esta change consume la variante in-page ya prevista para el dashboard; no requiere modificar ese spec porque la regla ya es general (solo menciona dashboard como "primer caso de uso", no como caso único).
- `dashboard`: nada cambia en `/dashboard`. El `SectionFallback` se referencia cross-route en esta iteración (decisión deliberada para no inflar el scope con un movimiento a `components/ui/`).

**Sin breaking changes.** Lo único observable por el usuario es que la ruta se siente más rápida y resiste errores parciales.
