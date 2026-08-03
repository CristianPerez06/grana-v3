## 1. Base y prueba de fuego

- [x] 1.1 Agregar `react-native-keyboard-controller` a `apps/mobile/package.json` e instalar con `pnpm install` desde la raíz del monorepo
- [x] 1.2 Montar `<KeyboardProvider>` en `apps/mobile/app/_layout.tsx`, dentro de `SafeAreaProvider` y por fuera de `LocaleProvider` / `QueryClientProvider`, documentando el orden en el comentario de providers que ya existe en el archivo
- [x] 1.3 Rebuildear el dev client (`pnpm --filter mobile ios` y `pnpm --filter mobile android`) — **obligatorio antes de cualquier validación en dispositivo**: la librería es nativa y validar contra un binario viejo da un falso negativo
- [x] 1.4 Crear `apps/mobile/components/layout/FormScreen.tsx`: root `<View className="flex-1 bg-page">` + `<PageHeader {...headerProps} />` + `KeyboardAwareScrollView` con `keyboardShouldPersistTaps="handled"` y `bottomOffset`. Props = `PageHeaderProps & { onBackPress?, contentClassName?, children }`, default de `contentClassName` = `px-6 py-6 pb-28`
- [x] 1.5 Migrar `app/(app)/settings/categories/new.tsx` a `FormScreen` (pantalla más chica, valida el shell aislado)
- [x] 1.6 Crear `apps/mobile/components/layout/FormSheetBody.tsx`: `KeyboardProvider` anidado + scroller keyboard-aware, para el contenido de overlays con inputs
- [x] 1.7 Migrar el `Drawer` de alta de categoría en `app/(app)/settings/categories/index.tsx` a `FormSheetBody` (valida el provider anidado dentro de un `Modal` de RN) — **superseded por 5b.1**: el drawer se eliminó; la validación del provider anidado se hace ahora sobre las superficies que sí lo conservan (4.3, 4.4)
- [x] 1.8 **Punto de decisión**: validar el provider anidado dentro de un `Modal` de RN en iOS **y** Android. Como el drawer de categorías se eliminó (5b), la superficie de prueba pasa a ser el sheet de filtros de movimientos (4.4) o el drawer de edición de recurrencia (4.3). Si el provider anidado no funciona en alguna plataforma, esas 2 superficies vuelven a `KeyboardAvoidingView` y el resto del plan sigue igual

## 2. Pantallas pusheadas — categorías y cuentas

- [x] 2.1 Migrar `app/(app)/settings/categories/[id]/edit.tsx` a `FormScreen`
- [x] 2.2 Migrar `app/(app)/settings/categories/[id]/subcategories/new.tsx` a `FormScreen`
- [x] 2.3 Migrar `app/(app)/accounts/new.tsx` a `FormScreen`
- [x] 2.4 Migrar `app/(app)/accounts/[id]/edit.tsx` a `FormScreen`
- [x] 2.5 Migrar `app/(app)/accounts/[id]/currency.tsx` a `FormScreen`, preservando el `gap-6` de su content container vía `contentClassName`
- [x] 2.6 Validar las 5 pantallas en iOS y Android: campo enfocado visible, error visible, submit alcanzable con teclado abierto, sin cambios de padding respecto de la versión previa

## 3. Pantallas pusheadas — tarjetas, movimientos y hogar

- [x] 3.1 Migrar `app/(app)/cards/new.tsx` a `FormScreen`
- [x] 3.2 Migrar `app/(app)/cards/[id]/edit.tsx` a `FormScreen`, preservando el `onBackPress` que confirma el descarte cuando el form está dirty
- [x] 3.3 Migrar `app/(app)/cards/[id]/periods/[periodId]/pay.tsx` a `FormScreen`
- [x] 3.4 Migrar `app/(app)/transactions/new.tsx` a `FormScreen`, preservando el remount por `formKey` en re-focus
- [x] 3.5 Migrar `app/(app)/transactions/[txId]/edit.tsx` a `FormScreen`
- [x] 3.6 Migrar `app/(app)/transactions/recurring/new.tsx` a `FormScreen`
- [x] 3.7 Migrar `app/(app)/home/settle.tsx` a `FormScreen` — **ambas ramas de render** (la de éxito con su propio `ScrollView` y la del formulario), preservando su `px-6 pt-6 pb-16` vía `contentClassName`. Agrega la compensación y el `keyboardShouldPersistTaps` que hoy le faltan
- [x] 3.8 Corregir `app/(app)/home/index.tsx` (`SetupForm` inline): agregar compensación de teclado y `keyboardShouldPersistTaps="handled"`. Es pantalla root de tab, no pusheada — no usa `FormScreen`; se le aplica el scroller keyboard-aware directamente
- [x] 3.9 Validar en iOS y Android el alta de movimiento con el campo de monto a media altura y el submit al final (el caso que motivó el change), más el resto de las pantallas del grupo

## 4. Overlays y chrome

- [~] 4.1 Migrar el `Drawer` de alta de subcategoría en `app/(app)/settings/categories/[id]/subcategories/index.tsx` a `FormSheetBody` — **superseded por 5b.2** (drawer eliminado)
- [~] 4.2 Migrar el `Drawer` de edición de categoría en `components/categories/CategoryRow.tsx` a `FormSheetBody` — **superseded por 5b.3** (drawer eliminado)
- [x] 4.3 Migrar `components/recurrences/RecurrenceEditForm.tsx` (dentro del `Drawer` de `app/(app)/transactions/recurring/[id].tsx`) a `FormSheetBody`
- [x] 4.4 Migrar `components/accounts/MovementFiltersSheet.tsx` a `FormSheetBody` (bottom sheet con dos `MoneyAmountInput`)
- [x] 4.5 Ocultar el `TabBar` mientras el teclado está visible: segunda condición de early return en `components/layout/TabBar.tsx`, leyendo el estado de teclado del provider, sin alterar la regla de rutas chromeless existente
- [x] 4.6 Montar `<KeyboardToolbar>` una única vez en `app/_layout.tsx` junto al provider, para dar acción de cierre al teclado decimal de `MoneyAmountInput`
- [x] 4.7 Validar en iOS y Android: los 4 overlays con teclado, el tab bar ocultándose y volviendo sin salto de layout, y el cierre del teclado decimal desde la barra accesoria

## 5. Unificación

- [x] 5.1 Migrar `components/layout/AuthShell.tsx` al scroller keyboard-aware, preservando su layout centrado (`flex-grow justify-center` + paddings por insets)
- [x] 5.2 Migrar `app/(onboarding)/initial-balance.tsx` (hoy iOS-only)
- [x] 5.3 Migrar `components/ui/InstitutionPickerModal.tsx` a `FormSheetKeyboardView` (hoy iOS-only; tiene campo de búsqueda). **Desvío**: no usa `FormSheetBody` porque su contenido es un `FlatList` con `maxHeight` propio — ver decisión 3b en `design.md`
- [x] 5.4 Migrar `components/accounts/BankSelector.tsx` a `FormSheetKeyboardView` (mismo desvío que 5.3)
- [x] 5.5 Verificar que no queda ningún `import { KeyboardAvoidingView } from 'react-native'` en `apps/mobile`
- [x] 5.6 Validar en **Android** las 4 superficies del grupo (son las que hoy no tienen ninguna compensación en esa plataforma): login, signup, recuperación, alta de saldo inicial, y los dos pickers con búsqueda

## 5b. Categorías: de drawer a pantalla pusheada

Surgió de la validación en dispositivo: el drawer de categorías no se podía cerrar y su header blanco ad-hoc no se parecía a ningún otro formulario. Supersede las tareas 1.7, 4.1 y 4.2 — esos tres drawers dejan de existir, así que ya no hay nada que migrar a `FormSheetBody` en ellos.

- [x] 5b.1 `settings/categories/index.tsx`: la acción "Agregar" navega a `/(app)/settings/categories/new`; se elimina el `Drawer` + header ad-hoc + estado `createOpen`/`createKey`
- [x] 5b.2 `settings/categories/[id]/subcategories/index.tsx`: idem contra `/subcategories/new`
- [x] 5b.3 `components/categories/CategoryRow.tsx`: la acción "Editar" navega a `/(app)/settings/categories/[id]/edit`; se elimina el `Drawer` de edición
- [x] 5b.4 Verificar que las tres pantallas destino ya usan `FormScreen` y que sus forms caen a `router.back()` + `invalidateAfterCategoryMutation` cuando no reciben `onSuccess`
- [x] 5b.5 Escribir el delta de la capability `categories` con los 3 requirements MODIFIED y la divergencia con web documentada
- [x] 5b.6 Validar en dispositivo: alta, edición y alta de subcategoría abren pantalla con header navy + back-link; el back físico de Android y el gesto de back de iOS vuelven al listado; el listado refleja el cambio al volver

## 6. Cierre

- [x] 6.1 Correr `pnpm --filter mobile typecheck` y `pnpm --filter mobile lint` — ambos SHALL pasar sin errores
- [x] 6.2 Repasar el inventario completo de superficies y confirmar que ninguna quedó sin migrar ni sin validar en ambas plataformas. **Migración confirmada**: 13 `FormScreen` + 2 `FormSheetBody` + 2 `FormSheetKeyboardView` + `home/index` + `AuthShell` + `initial-balance` = 20 superficies vivas (las 3 restantes de las 23 originales eran los drawers de categorías, eliminados en 5b). **Validación confirmada en iOS y Android** sobre las 20
- [x] 6.3 Actualizar `AGENTS.md`: agregar a la sección de layering la regla de que toda pantalla de formulario mobile usa `FormScreen` y todo overlay con inputs usa `FormSheetBody`, en vez de componer el chrome a mano
- [x] 6.4 Archivar el change: mover a `openspec/changes/archive/YYYY-MM-DD-mobile-keyboard-avoidance/`, aplicar los deltas de `mobile-app-shell` y `page-header` sobre sus specs maestras, y correr `pnpm openspec:check`
