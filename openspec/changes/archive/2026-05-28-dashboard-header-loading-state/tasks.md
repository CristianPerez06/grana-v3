> Nota: este change documenta trabajo **ya implementado** en `main`. Las tareas están todas marcadas como hechas; este archivo existe para dejar la traza de qué se tocó y poder verificarlo al archivar.

## 1. Contrato compartido del Button

- [x] 1.1 Agregar `'icon'` a `ButtonSize` en `packages/ui-contracts/src/index.ts` (`'sm' | 'md' | 'lg' | 'icon'`).

## 2. Implementación del Button — web

- [x] 2.1 Agregar la size `icon: 'h-9 w-9 p-0 rounded-full'` al `cva` de `apps/web/components/ui/button.tsx`. Verificar que `cn`/`tailwind-merge` resuelve los conflictos contra el `w-full` y el `rounded-[var(--radius-lg)]` del base.
- [x] 2.2 Actualizar `apps/web/components/ui/button.stories.tsx`: agregar `'icon'` al `argTypes.size.options` e incorporar una story `Icon` que muestre `variant="ghost" size="icon"` con un ícono lucide.

## 3. Implementación del Button — mobile

- [x] 3.1 Agregar `icon: 'h-9 w-9 p-0 rounded-full'` a `containerSize` y `icon: 'text-sm'` a `textSize` en `apps/mobile/components/ui/Button.tsx`. (Documentado: sin call-sites mobile todavía; el visual definitivo se ajusta cuando aparezca el primer uso.)

## 4. EyeMaskToggle migrado al UI Button

- [x] 4.1 Reescribir `apps/web/app/(app)/dashboard/_components/eye-mask-toggle.tsx` para renderizar `<Button variant="ghost" size="icon" onPress={toggle} disabled={disabled} aria-label={label} title={label}><Icon size={18} /></Button>`.
- [x] 4.2 Aceptar `disabled?: boolean` como prop pública y pasarlo al `Button` (default `false`).

## 5. DashboardHeader self-fetching

- [x] 5.1 Convertir `apps/web/app/(app)/dashboard/_components/dashboard-header.tsx` en `'use client'`.
- [x] 5.2 Quitar la prop `name`; dejar sólo `todayISO: string` como prop pública.
- [x] 5.3 Resolver el `full_name` desde un `useEffect`: `createClient()` → `auth.getUser()` → `from('profiles').select('full_name').eq('id', user.id).single()`. Manejar cleanup con un flag `cancelled` y guardar el primer nombre (`split(' ')[0] ?? ''`).
- [x] 5.4 Mientras `isLoading === true`: usar el fallback `dashboard.welcome_anon`, renderizar el `EyeMaskToggle` con `disabled` y el botón "Nuevo movimiento" como `<Button disabled>` sin `<Link>`. Cuando termina, switch a `<Button asChild><Link href="/transactions/new">…</Link></Button>`.
- [x] 5.5 En caso de fallo del fetch, salir del estado disabled igual (no bloquear al usuario aunque no haya nombre).

## 6. DashboardContent — Suspense + ErrorBoundary in-page

- [x] 6.1 Crear `apps/web/app/(app)/dashboard/_components/dashboard-error-boundary.tsx` como class Client Component con `getDerivedStateFromError` y un `reset` que limpia el error; renderiza `<RouteError error={…} onRetry={this.reset} />` cuando hay error.
- [x] 6.2 Crear `apps/web/app/(app)/dashboard/_components/dashboard-content.tsx`: exporta `DashboardContentBody` (async server component con el `Promise.allSettled` de hero/upcoming/month/hasMovements + el cálculo del category teaser) y `DashboardContent` (server wrapper que envuelve el body en `<DashboardErrorBoundary><Suspense fallback={<RouteLoading />}>…</Suspense></DashboardErrorBoundary>`).
- [x] 6.3 Quitar del body la query del perfil (ahora la hace el header).

## 7. Adelgazar la página

- [x] 7.1 Reescribir `apps/web/app/(app)/dashboard/page.tsx` como server component **sync** que retorna `<EyeMaskProvider><DashboardHeader todayISO={…} /><DashboardContent /><QuickAddFab /></EyeMaskProvider>`. Calcular `todayISO` con `formatDateISO(getTodayAR())`.

## 8. Verificación

- [x] 8.1 `pnpm lint` sin nuevos errores ni warnings introducidos por este change (los dos warnings preexistentes en `movement-form.tsx` y `credit-cards.ts` se mantienen).
- [x] 8.2 `pnpm typecheck` sin nuevos errores introducidos (el error preexistente en `.next/types/validator.ts` referente a `(onboarding-wizard)/onboarding/profile/page.js` ya estaba antes y es ortogonal).
- [x] 8.3 Validar manualmente en el browser que al navegar a `/dashboard` el header aparece desde el primer paint con saludo "Hola." y controles disabled, y que después se actualiza al saludo con nombre + controles habilitados.

## 9. Documentación retroactiva

- [x] 9.1 Crear este openspec change (`dashboard-header-loading-state`): proposal, design, spec deltas (`dashboard` modify x3, `route-loading-and-errors` add x1) y este tasks.md.
- [ ] 9.2 Validar y archivar el change con `/opsx:archive` cuando el usuario lo confirme.
