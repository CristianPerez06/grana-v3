## 1. Preparación

- [x] 1.1 Confirmar que `getCreditCards` en `apps/web/lib/cards/queries.ts` puede filtrar por activo y por archivado (revisar firma actual; si solo expone `includeArchived?: boolean`, agregar `archivedOnly?: boolean` o equivalente sin romper callers).
- [x] 1.2 Confirmar los nombres exactos de tablas y columnas que va a consumir el header desde el browser client (`accounts` con `type = 'credit'` + `is_active`, `institutions`, `card_networks`), y los tipos correspondientes en `@grana/supabase`.
- [x] 1.3 Reservar (o validar que existen) las i18n keys necesarias: mensajes de loading y error para `hero`, `wallet`, `archived` en `apps/web/messages/{es,en}.json` bajo el namespace `cards`. Crearlas si faltan.

## 2. Componentes nuevos

- [x] 2.1 Crear `apps/web/app/(app)/cards/_components/cards-error-boundary.tsx` (`'use client'`) clonando la forma de `DashboardErrorBoundary`: `Component<{ children }, { error }>` con `getDerivedStateFromError`, render → `<RouteError error={error} onRetry={reset} />`.
- [x] 2.2 Crear `apps/web/app/(app)/cards/_components/cards-month-hero-container.tsx` (server async): `try { const summary = await getCardsMonthSummary(); return <CardsMonthHero summary={summary} showCents={showCents} /> } catch { return <SectionFallback message={t('hero.error')} /> }`. Resolver `showCents` y `t` dentro del container (no propagados desde page).
- [x] 2.3 Crear `apps/web/app/(app)/cards/_components/wallet-grid-container.tsx` (server async) que llama `getCreditCards` filtrando activos, calcula `networkNames` y `monthShort` localmente, y devuelve la sección "Mis tarjetas" completa (título + hint + `<WalletGrid />`). Try/catch con `<SectionFallback message={t('wallet.error')} />`.
- [x] 2.4 Crear `apps/web/app/(app)/cards/_components/archived-cards-container.tsx` (server async) que llama `getCreditCards` filtrando archivadas y devuelve `<ArchivedCardsSection cards={archived} />` (o `null` si vacío). Try/catch con `<SectionFallback message={t('archived.error')} />`.
- [x] 2.5 Crear `apps/web/app/(app)/cards/_components/cards-header.tsx` (`'use client'`). Estructura:
  - Tres queries en paralelo via `useEffect` con `Promise.all`: count de credit cards activos (head: true), institutions, card_networks. Usa los tipos generados.
  - State: `{ count: number | null, institutions: Institution[] | null, networks: CardNetwork[] | null, error: { count: boolean; catalogs: boolean } }`.
  - Render del subtítulo: si `count == null` muestra `"-"`; si resuelto muestra el número.
  - Mes derivado de `getTodayAR()` + `useLocale()` (calculado en cliente, paridad con dashboard).
  - Botón "Agregar tarjeta": disabled si `institutions == null || networks == null` (sin importar el estado del count). Si `error.catalogs` es true, permanece disabled.
  - Cuando habilitado, renderiza `<AddCardButton institutions={institutions} networks={networks} />` (sin cambios al componente existente más allá del prop pass).

## 3. Cableado en `page.tsx`

- [x] 3.1 Reescribir `apps/web/app/(app)/cards/page.tsx`: dejar solo el auth check (`supabase.auth.getUser()` + `redirect('/login')` si no hay user) y devolver el árbol nuevo. Eliminar el `Promise.all` actual.
- [x] 3.2 Estructura del JSX devuelto por `page.tsx`:
  ```tsx
  <div className="flex flex-col gap-6">
    <CardsHeader />
    <CardsErrorBoundary>
      <div className="flex flex-col gap-6">
        <Suspense fallback={<SectionFallback message={t('hero.loading')} className="min-h-[…]" />}>
          <CardsMonthHeroContainer />
        </Suspense>
        <Suspense fallback={<SectionFallback message={t('wallet.loading')} className="min-h-[…]" />}>
          <WalletGridContainer />
        </Suspense>
        <Suspense fallback={<SectionFallback message={t('archived.loading')} className="min-h-[…]" />}>
          <ArchivedCardsContainer />
        </Suspense>
      </div>
    </CardsErrorBoundary>
  </div>
  ```
- [x] 3.3 Ajustar `min-h-[…]` de cada `SectionFallback` para que el fallback ocupe aproximadamente el mismo alto que el contenido cargado (valores iniciales: hero `14rem`, wallet `18rem`, archivadas `3rem`; ajuste fino pendiente de verificación visual del usuario).
- [x] 3.4 Importar `SectionFallback` desde `../dashboard/_components/section-fallback` (decisión explícita del design).

## 4. Ajustes a componentes existentes

- [x] 4.1 Quitar de `page.tsx` el uso directo de `AddCardButton`; ahora vive dentro de `CardsHeader`.
- [x] 4.2 Si `AddCardButton` necesita un prop `disabled` (no lo tenía porque siempre venía con data lista), agregárselo y respetarlo en el render del trigger (`<Button disabled>` cuando aplique). Mantener el drawer interno como está.
- [x] 4.3 Eliminar del antiguo `page.tsx` el cálculo de `monthLabel`, `monthShort`, `networkNames`, `activeCards`/`archivedCards` (ahora se hace en cada container o en el header).

## 5. Verificación manual

- [x] 5.1 Ejecutar `pnpm --filter web dev`, abrir `/cards` con red normal: confirmar que el header aparece antes que el contenido y que el count se actualiza al resolver.
- [x] 5.2 Throttlear la red ("Slow 3G" en devtools) y confirmar que el botón "Agregar tarjeta" arranca disabled y se habilita cuando `institutions`/`networks` resuelven; verificar que el cuerpo muestra los fallbacks con altura apropiada (sin reflujo grande al hidratar).
- [x] 5.3 Provocar manualmente un error en `getCardsMonthSummary()` (ej. throw temporal) y confirmar que solo el hero muestra el `<SectionFallback>` de error y que el header + wallet + archivadas siguen renderizando.
- [x] 5.4 Provocar un throw fuera de los containers (ej. en el render de `CardsMonthHero`) y confirmar que `CardsErrorBoundary` captura: el área del contenido pasa a `<RouteError>`, el header sigue visible, "Reintentar" recarga el contenido.
- [x] 5.5 Confirmar que cuando el usuario no tiene tarjetas archivadas la sección no deja un slot vacío.

## 6. Limpieza y checks

- [x] 6.1 `pnpm --filter web lint` clean.
- [x] 6.2 `pnpm --filter web typecheck` clean.
- [x] 6.3 Si existen tests E2E o de integración que tocan `/cards`, correrlos y ajustar selectores si rompió alguna asunción de markup (no existen tests E2E/integración tocando `/cards`; nada que correr).
- [x] 6.4 Squashear los commits del feature branch en uno solo con título estilo `feat(cards): header + sections aisladas en /cards`. No mergear a main (lo hace el usuario).
