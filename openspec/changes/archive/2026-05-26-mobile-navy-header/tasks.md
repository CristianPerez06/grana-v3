## 1. Componentes de header

- [x] 1.1 Modificar `apps/mobile/components/ui/PageHeader.tsx` para que sea self-wrapping: envolver el contenido en `<SafeAreaView edges={['top']} className="bg-navy">`, cambiar título a `text-white`, descripción y back link a `text-navy-muted`.
- [x] 1.2 Agregar slot reservado de back link en `PageHeader`: cuando `backLink` está ausente, renderizar `<View className="h-5" />` en su lugar.
- [x] 1.3 Modificar `apps/mobile/components/dashboard/DashboardHeader.tsx`: envolver en `<SafeAreaView edges={['top']} className="bg-navy">`, agregar spacer `<View className="h-5" />` arriba del título (para igualar altura con `PageHeader`), pasar el título a `text-white`.
- [x] 1.4 Modificar `apps/mobile/components/dashboard/EyeMaskToggle.tsx`: cambiar color del icono a `#FFFFFF` para que sea legible sobre fondo navy.

## 2. Status bar

- [x] 2.1 Importar `StatusBar` de `expo-status-bar` en `apps/mobile/app/(app)/_layout.tsx` y renderizar `<StatusBar style="light" />` dentro del `PreferencesProvider`.

## 3. Restructuración de pantallas (app)

- [x] 3.1 `apps/mobile/app/(app)/dashboard.tsx`: reemplazar `<SafeAreaView edges={['top']} bg-background>` por `<View className="flex-1 bg-background">`. Mover `<DashboardHeader />` fuera del `ScrollView` (sibling). Preservar la rama de loading inicial con su propia `SafeAreaView` (no usa header).
- [x] 3.2 `apps/mobile/app/(app)/transactions.tsx`: reemplazar `SafeAreaView` raíz por `View`, mover `<PageHeader>` fuera del scroll (en este caso no había scroll content; el header queda directamente arriba del cuerpo placeholder).
- [x] 3.3 `apps/mobile/app/(app)/accounts.tsx`: idem `transactions.tsx`.
- [x] 3.4 `apps/mobile/app/(app)/cards.tsx`: idem `transactions.tsx`.
- [x] 3.5 `apps/mobile/app/(app)/settings/index.tsx`: reemplazar `SafeAreaView` raíz por `View`, mover `<PageHeader>` antes del `ScrollView` (sibling).
- [x] 3.6 `apps/mobile/app/(app)/settings/categories/index.tsx`: idem `settings/index.tsx`.
- [x] 3.7 `apps/mobile/app/(app)/settings/categories/new.tsx`: idem `settings/index.tsx`.
- [x] 3.8 `apps/mobile/app/(app)/settings/categories/[id]/edit.tsx`: idem `settings/index.tsx`.
- [x] 3.9 `apps/mobile/app/(app)/settings/categories/[id]/subcategories/index.tsx`: idem `settings/index.tsx`.
- [x] 3.10 `apps/mobile/app/(app)/settings/categories/[id]/subcategories/new.tsx`: idem `settings/index.tsx`.

## 4. Verificación

- [x] 4.1 Correr `pnpm --filter mobile typecheck` (o `npx tsc --noEmit` desde `apps/mobile/`) y verificar 0 errores.
- [x] 4.2 Correr `pnpm --filter mobile lint` y verificar que no hay errores nuevos (warnings preexistentes permitidos).
- [ ] 4.3 Verificación visual en simulador iOS y dispositivo Android: confirmar que (a) el status bar se ve navy con iconos claros, (b) el título del header se renderiza en blanco, (c) la altura del bloque superior es idéntica entre pantallas con y sin back link, (d) la banda navy llega de borde a borde, (e) navegar entre pantallas no produce salto vertical visible.

## 5. Cierre

- [ ] 5.1 Crear branch de feature `feature/mobile-navy-header` desde `main` con los cambios actuales (los archivos ya están modificados pero sin commitear).
- [ ] 5.2 Ejecutar el post-archive checklist (CLAUDE.md): mover este change a `openspec/changes/archive/YYYY-MM-DD-mobile-navy-header/`, aplicar las deltas a `openspec/specs/page-header/spec.md` y `openspec/specs/mobile-app-shell/spec.md` (integrando MODIFIED y ADDED en la sección flat `## Requirements` del master spec), correr `pnpm openspec:check` y commitear el archive como último commit del branch antes del merge `--ff-only` a `main`.
