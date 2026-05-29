> Nota: este change documenta trabajo **ya implementado** en la rama `feature/dashboard-streaming-sections` (commit `bf3666d`). Las tareas están todas marcadas como hechas; este archivo existe para dejar la traza de qué se tocó y poder verificarlo al archivar.

## 1. Containers por sección

- [x] 1.1 Crear `apps/web/app/(app)/dashboard/_components/hero-section-container.tsx` que hace `await getDashboardHero(supabase)` en un `try` separado del JSX y degrada a `SectionFallback` con `t('hero_error')`.
- [x] 1.2 Crear `apps/web/app/(app)/dashboard/_components/upcoming-fortnight-section-container.tsx` con la misma forma (recibe `today: Date` como prop, usa `t('upcoming.error')`).
- [x] 1.3 Crear `apps/web/app/(app)/dashboard/_components/month-balance-section-container.tsx` (recibe `currentYear`, `currentMonth`, `monthsBackLimit`; `t('month.error')`).
- [x] 1.4 Crear `apps/web/app/(app)/dashboard/_components/category-teaser-container.tsx` que centraliza el `getMonthCategoryBreakdown` + `buildCategorySlices` previamente inline en el body; degrada a `SectionFallback` con `t('spending.error')` (antes no había fallback — un error tumbaba la página).
- [x] 1.5 Crear `apps/web/app/(app)/dashboard/_components/welcome-first-move-card-container.tsx` que decide entre `<WelcomeFirstMoveCard />` o `null` según `hasUserMovements`. Si la query falla, retorna `null` (no bloquear con error compacto algo que es opcional).

## 2. Min-height por sección

- [x] 2.1 Extender `SectionFallback` para aceptar `className` opcional vía `cn` y cambiar el layout interno a `flex items-center justify-center` (centra el mensaje en cajas altas).
- [x] 2.2 Pasar `className="min-h-[10rem]"` al `SectionFallback` del Hero y agregar `min-h-[10rem]` al root de `HeroSection`.
- [x] 2.3 `min-h-[20rem]` en el fallback de "Lo que viene" + root de `UpcomingFortnightSection`.
- [x] 2.4 `min-h-[26rem]` en el fallback de Balance del mes + root de `MonthBalanceSection` (coincide con el `min-h-[17.5rem]` interno del chart que ya existía).
- [x] 2.5 `min-h-[8rem]` en el fallback del teaser + root de `CategoryTeaser`.

## 3. Reescritura de `dashboard-content.tsx`

- [x] 3.1 Reemplazar `DashboardContentBody` (single Suspense + `Promise.allSettled`) por un `DashboardContent` async que renderiza un `<Suspense>` por sección, cada uno con su `SectionFallback` y su container.
- [x] 3.2 Mantener `<DashboardErrorBoundary>` como wrapper exterior (red de último recurso para errores de renderizado que escapen a los catches de los containers).
- [x] 3.3 Welcome card: `<Suspense fallback={null}>` (decisión documentada en design.md).

## 4. i18n keys nuevas

- [x] 4.1 `packages/i18n-messages/src/es.json`: agregar `dashboard.hero_loading`, `dashboard.upcoming.loading`, `dashboard.month.loading`, `dashboard.spending.loading`, `dashboard.spending.error`.
- [x] 4.2 `packages/i18n-messages/src/en.json`: mismas keys en inglés.

## 5. Verificación

- [x] 5.1 `pnpm --filter web typecheck` sin nuevos errores. (El error preexistente en `.next/types/validator.ts` se evapora limpiando `.next`.)
- [x] 5.2 `pnpm --filter web lint` sin nuevos errores. Los warnings preexistentes en `movement-form.tsx` y `credit-cards.ts` se mantienen.
- [x] 5.3 Validar manualmente que el dashboard stream-ea correctamente y que no hay layout shift entre el fallback y el contenido real de cada sección.

## 6. Documentación retroactiva

- [x] 6.1 Crear este change (`dashboard-stream-sections-independently`): `proposal.md`, `design.md`, este `tasks.md` y delta en `specs/dashboard/spec.md` (MODIFIED del requirement "El dashboard tolera datos parciales sin romperse").
- [x] 6.2 Validar y archivar con `/opsx:archive` cuando el usuario lo confirme.
