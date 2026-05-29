## Context

Después de [`2026-05-28-dashboard-header-loading-state`](../archive/2026-05-28-dashboard-header-loading-state/) el dashboard quedó con esta forma:

```
EyeMaskProvider
  DashboardHeader (client, self-fetching, paint inmediato)
  DashboardContent
    DashboardErrorBoundary (client class)
      Suspense fallback=<RouteLoading />
        DashboardContentBody  ← async server component
          await Promise.allSettled([hero, upcoming, month, hasMovements])
          await getMonthCategoryBreakdown()  ← secuencial
          render(Hero, Upcoming, MonthBalance, CategoryTeaser, WelcomeCard?)
  QuickAddFab
```

El header se ve desde el primer paint, pero todo el contenido espera a que el batch más lento termine. El spec dice que las secciones deben renderizar independientes; la implementación lo hacía sólo en el eje de errores, no en el de streaming.

## Goals / Non-Goals

- **Goal**: cada sección stream-ea apenas resuelve su query, sin bloquear ni ser bloqueada por las demás.
- **Goal**: el fallback de cada sección ocupa el mismo alto que el contenido eventual, para evitar layout shift cuando el contenido aterriza.
- **Goal**: un error en una query degrada esa sola sección, sin tumbar la página.
- **Non-goal**: replatear el modelo de datos del dashboard; las queries de `@grana/dashboard` se mantienen tal cual.
- **Non-goal**: cambiar el comportamiento del header o del `QuickAddFab`.
- **Non-goal**: tocar el dashboard mobile.

## Decisions

### Per-section Suspense vs single Suspense

**Decisión**: un `<Suspense>` por sección, cada uno envolviendo un container async dedicado.

**Por qué**: con un único `<Suspense>` arriba, React espera a que **toda** la subárbol async termine antes de hacer commit. Eso anula el streaming a nivel sección. Con un `<Suspense>` por sección, cada subárbol se compromete en cuanto su propia promesa resuelve.

**Trade-off considerado**: agrupar de a dos (ej. Hero + WelcomeCard, MonthBalance + Upcoming). Rechazado: no hay agrupaciones naturales y la complejidad no compensa el ahorro de boundaries.

### Container vs fetch-en-place

**Decisión**: cada sección tiene un container async (`HeroSectionContainer`, etc.) separado del componente real (`HeroSection`). El container hace el fetch + maneja el error; el componente real recibe `data` como prop.

**Por qué**:
- Mantiene los componentes "presentational" testeables sin mockear Supabase.
- Permite que el error fallback viva en el container, no atado al componente real.
- Hace explícito el límite Suspense (un container == una unidad de streaming).

### Manejo de errores en server components async

**Decisión**: el `try/catch` envuelve **solo** el `await`, no la construcción del JSX final.

```tsx
let data: T
try {
  data = await query()
} catch {
  return <SectionFallback message={t('error')} />
}
return <RealSection data={data} />
```

**Por qué**: `react-hooks/error-boundaries` advierte (correctamente) que JSX dentro de un `try/catch` no captura errores de renderizado — porque React no renderiza inmediatamente: el componente devuelve el elemento y React lo evalúa después. El `catch` sólo alcanza al `await`. Errores de rendering posteriores burbujean al `DashboardErrorBoundary` exterior, que es el catch-all correcto.

### Min-height por sección

**Decisión**: cada sección tiene un `min-h-[…]` sobre su root **y** sobre su `SectionFallback`. Valores actuales:
- Hero: `10rem` (label + amount text-4xl + amount secundario + p-6)
- Upcoming: `20rem` (header + 2 listas + period balance)
- Month balance: `26rem` (header + 17.5rem chart + footer + p-6) — coincide con el `min-h-[17.5rem]` interno del chart que ya existía
- Category teaser: `8rem` (header + 3 filas compactas)

**Por qué**: el fallback ocupa el mismo alto que el card real, por lo que la transición fallback → contenido no empuja al resto de la página. Ponerlo también en el root del card real es un piso defensivo: si la sección queda corta (ej. estado vacío), no encoge respecto al fallback.

**Trade-off considerado**: extraer las constantes a un solo lugar (ej. `dashboard-section-heights.ts`). Rechazado: cada altura se setea dos veces (root real + fallback), no doce. Una constante separada agregaría indirección sin ahorrar duplicación real.

### Welcome card y layout shift

**Decisión**: la card de bienvenida usa `<Suspense fallback={null}>` y, cuando aparece, empuja al resto del contenido hacia abajo.

**Alternativas evaluadas**:

| Opción | Pros | Contras |
|---|---|---|
| **A. `fallback={null}`** (elegida) | Cero espacio reservado para usuarios que no la van a ver (la mayoría) | Empuja contenido si aparece |
| B. Skeleton con alto fijo | Sin shift | Hueco vacío para todos los usuarios que ya tienen movimientos |
| C. `hasUserMovements` bloqueante | Sin shift | Hero queda gateado por una query no relacionada |

La query `hasUserMovements` es un `count='exact' head=true` (sin rows): casi siempre la primera en resolver. El shift ocurre sólo en usuarios nuevos sin movimientos, en una ventana de ms. Vale la pena vs. mostrar un hueco vacío al 95% del tráfico.

### Mensajes de loading vs reusar mensajes de error

**Decisión**: nuevas keys i18n por sección (`hero_loading`, `upcoming.loading`, `month.loading`, `spending.loading`), no un genérico `dashboard.loading`.

**Por qué**: el `SectionFallback` se ve durante segundos (visible para el usuario), no es un microestado. "Cargando el balance del mes…" comunica más que "Cargando…". El costo (4 keys × 2 idiomas) es trivial.

### Cobertura del teaser de categorías

El `CategoryTeaser` está speced en `spending-by-category` ("El dashboard muestra un teaser de las categorías que más pesan"). Antes de este change, su query (`getMonthCategoryBreakdown`) corría secuencialmente después del batch y **sin** error fallback: cualquier error rompía toda la página. Ahora paraleliza con el resto y degrada a `SectionFallback`. No se modifica el spec de `spending-by-category` porque el cambio es operacional (cómo se carga), no contractual (qué se muestra y a dónde linkea).
