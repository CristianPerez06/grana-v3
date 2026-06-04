## Context

`per-route-loading-shells` estableció Variant C ("chrome en `<ruta>/layout.tsx` + skeletons en `<ruta>/loading.tsx`") y la aplicó a `/dashboard` y `/transactions`. Este change la extiende al resto del shell `(app)`, con dos tratamientos según la naturaleza de la ruta:

1. **Variant C completa** para `/accounts` y `/cards`: pages "compuestos" con header + secciones aisladas que ya tienen `<Suspense>` shape-matched. El header sale del page al layout; los `SectionFallback` migran a un `loading.tsx` shape-matched de la ruta.
2. **Solo `loading.tsx`** para `/transactions/recurring`, `/transactions/[txId]`, `/settings`, `/transactions/new`: pages monolíticos que renderizan todo después de awaits server-side, sin `<Suspense>` interno. No tiene sentido partir el header al layout — son rutas que cargan "todo o nada". Pero un skeleton durante la transición es estrictamente mejor que "previous route stays".

## Goals / Non-Goals

**Goals:**

- Que al navegar a cualquier ruta autenticada del shell `(app)`, el usuario vea feedback de transición apropiado: chrome instantáneo + skeletons (rutas con Variant C), o skeleton shape-matched de la ruta destino (rutas con solo `loading.tsx`).
- Mantener el contrato de UX existente para los headers de `/accounts` y `/cards` (queries client-side, estados disabled, gates de botones) — solo cambia su ubicación.
- Establecer (o reusar) primitives de skeleton compartidos para no duplicar el placeholder de `<PageHeader />` cuatro veces.

**Non-Goals:**

- Refactor de los pages monolíticos a algo más streaming-friendly (Suspense interno). Eso es un proyecto distinto.
- Cambiar el comportamiento del header (queries, gating, count display) — solo se mueve.
- Tocar `/accounts/[id]` ni `/cards/[id]` (Variant B, ya funcionan).

## Decisions

### Decision 1: Variant C para /accounts y /cards

**Elegido:** mover `<AccountsHeader />` y `<CardsHeader />` desde sus pages a `accounts/layout.tsx` y `cards/layout.tsx` respectivamente.

**Razón:** ambos headers son Client Components self-contained (fetchean su data con supabase browser, sin TanStack, sin contextos de página). El move es trivial — no requiere reestructurar providers como en transactions. El page queda libre de awaits relacionados con auth (que se eliminan) y mantiene solo `await getTranslations()` para los `SectionFallback` (que se migran al loading.tsx, ver Decision 3).

**Alternativa considerada:** dejar headers en page y solo agregar `loading.tsx`. Rechazada: implica que el header siga suspendiendo en cada transición de segmento; el usuario sigue viendo "ruta anterior" hasta resolver. Variant C es estrictamente superior y el costo de implementación es bajo.

### Decision 2: Solo loading.tsx (no Variant C) para sub-rutas

**Elegido:** agregar únicamente un `loading.tsx` por ruta para `/transactions/recurring`, `/transactions/[txId]`, `/settings`, `/transactions/new`.

**Razón:** estos pages no tienen un header conceptualmente separable del cuerpo (el "header" es un `<PageHeader title=… />` simple sin queries propias; vive embebido en el render del page que fetchea data específica del recurso). Partirlos a layout.tsx requeriría:
- Mover el `<PageHeader />` a un layout.
- El layout pasa de no-existir a existir, agregando otro nivel de file/structure.
- Para `/transactions/[txId]`, el título depende de la data del recurso (categoria, monto) que viene del fetch del page — el layout no puede saberlo sin duplicar fetches.

El costo no se justifica frente al beneficio. Un `loading.tsx` que muestra un skeleton durante la transición ya cumple el goal de "no quedarse en la ruta anterior sin feedback".

**Alternativa considerada:** Variant C universal. Rechazada por las razones arriba.

### Decision 3: Dónde viven las translations para los SectionFallback de accounts/cards

**Contexto:** hoy `accounts/page.tsx` y `cards/page.tsx` hacen `const t = await getTranslations(...)` y pasan strings como `t('active_loading')` al `<SectionFallback message={...} />` dentro de cada `<Suspense fallback={...}>`.

Al mover el page a una estructura más sync, ¿dónde resuelven esas translations?

**Elegido:** las translations se migran al `loading.tsx` (que reemplaza el `{children}` durante la transición), no al page. Específicamente:
- El `loading.tsx` de la ruta importa skeletons concretos shape-matched (`ActiveAccountsSkeleton`, `ArchivedAccountsSkeleton` para accounts; equivalentes para cards). Cada skeleton es async server component que fetchea su propio `getTranslations` si necesita un label, igual que los skeletons del dashboard hoy.
- El `page.tsx` mantiene su `<Suspense fallback={...}>` por sección para el caso de re-fetch sin navegación (ej. invalidación de cache), usando las mismas instancias de skeleton.

**Alternativa considerada:** pasar las translations como prop desde el layout. Rechazada: agrega acoplamiento entre layout y page, y rompe la simetría con los skeletons del dashboard que se auto-resuelven.

### Decision 4: Primitives compartidos vs. skeletons inline

**Elegido:** crear un `<PageHeaderSkeleton />` reusable en `apps/web/components/ui/` (vive donde vive `<PageHeader />`). Los skeletons de body son específicos por ruta y viven en `_components/` de cada ruta.

**Razón:** los cuatro pages monolíticos (recurring, [txId], settings, new) y los layout-less de accounts/cards comparten la misma "tira" superior del PageHeader (título + acciones). Un componente reusable evita escribir el mismo bloque 6 veces. El cuerpo cambia mucho por ruta, así que ahí se justifica el shape-match dedicado.

**Forma del `<PageHeaderSkeleton />`:**

```tsx
type Props = {
  /** Si true, reserva espacio para una acción (botón) a la derecha. */
  withAction?: boolean
  /** Si true, reserva un subtítulo debajo del título. */
  withSubtitle?: boolean
}
```

Cubre: title bar (h-7 w-40 placeholder), opcional subtitle (h-3 w-64), opcional action button (h-9 w-32).

### Decision 5: Headers de accounts/cards en layout — auth y QueryClient

Ambos headers usan `createClient()` directamente del browser (no TanStack), así que no dependen del QueryClient del `(app)/layout.tsx`. Pueden montarse desde un layout sync sin issues.

`AccountsHeader` y `CardsHeader` ya son `'use client'` con `useEffect` para fetch — fuera del scope de Variant A/B/C distinctions; siguen funcionando idéntico colocados en el layout.

### Decision 6: Quitar awaits redundantes de page.tsx

Tanto `accounts/page.tsx` como `cards/page.tsx` hacen `await createClient(); await supabase.auth.getUser(); if (!user) redirect('/login');` — duplicado con `(app)/layout.tsx`. Se elimina (mismo criterio que aplicamos en transactions/page.tsx en `per-route-loading-shells`). El page queda async solo para `await getTranslations()` si todavía necesita strings server-side; ver Decision 3.

## Risks / Trade-offs

- **[Riesgo] Inconsistencia entre `accounts/loading.tsx` y los `<Suspense fallback>` del page** → **Mitigación:** ambos referencian los mismos componentes de skeleton (`<ActiveAccountsSkeleton />`, etc.). Si el shape de una sección cambia, el skeleton se actualiza una sola vez y los dos lugares lo reflejan.

- **[Riesgo] El layout async para accounts/cards no agrega nada vs. uno sync** → **Mitigación:** son sync. Los headers son Client Components que no necesitan data del layout. El layout es la versión más simple posible: `({children}) => <><Header />{children}</>`.

- **[Riesgo] El `loading.tsx` para `/transactions/[txId]` no puede saber el título real del movimiento** → **Mitigación:** el skeleton del `<PageHeader />` usa un placeholder neutro (h-7 w-40 placeholder bar). El título real aparece cuando el page resuelve. Esto es consistente con cómo dashboard/transactions ya manejan títulos durante carga.

- **[Riesgo] El `loading.tsx` de `/transactions/new` muestra skeleton del form pero la transición es muy corta (usuario clickeó "Nuevo movimiento")** → **Mitigación:** si la transición es <100ms, Next.js puede saltar el `loading.tsx` automáticamente (instant navigation). Si toma más, el skeleton aparece — mejor que ver la ruta de origen estática durante el delay. Net mejora.

- **[Riesgo] Volver a tocar las specs de `accounts` y `cards` poco después de `per-route-loading-shells`** → **Mitigación:** este change asume que `per-route-loading-shells` está archivado primero (ver Impact section del proposal). Si se rompe ese orden, las spec deltas pisan al anterior. Documentado explícitamente en el proposal.

- **[Riesgo] Skeletons de sub-rutas (recurring, [txId], settings, new) divergen del shape real con el tiempo** → **Mitigación:** son cuatro archivos chicos. Si un cambio futuro modifica drásticamente la estructura del cuerpo, el skeleton se actualiza en ese mismo change. La regla operativa la cubre el spec `route-loading-and-errors`: skeletons SHALL ser shape-matched.
