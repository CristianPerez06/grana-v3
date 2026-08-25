## Why

Dos pantallas de `apps/mobile` hospedan inputs adentro de un `ScrollView` plano y quedan fuera del seam de teclado del app shell: con el teclado abierto el campo enfocado puede quedar tapado, y los taps sobre los controles vecinos se consumen cerrando el teclado en vez de disparar la acción (issue #59).

La causa no es un bug del seam: el requirement `Ninguna superficie con campos de texto queda tapada por el teclado` (`openspec/specs/mobile-app-shell/spec.md`) enumera **tres familias cerradas** de superficie — formulario pusheado, root de tab con formulario inline, overlay — y delega la responsabilidad en `FormScreen` / `FormSheetBody`. Estas dos pantallas son de feed/detalle: nacieron sin inputs (correcto en su momento) y después les crecieron adentro. No pueden migrar a ningún seam, y el spec no nombra el camino que sí les corresponde. `AGENTS.md` ya documenta ese camino ("Mobile form surfaces — never compose the chrome by hand", cuarto bullet), así que hoy la regla vive en un solo lado del repo: arreglar las pantallas sin cerrar el spec deja el agujero abierto para la próxima pantalla de feed que reciba un input.

## What Changes

- El requirement de compensación de teclado deja de enumerar tres familias fijas y pasa a cubrir **cualquier** superficie con al menos un campo de texto, incluida la que no es de formulario y hospeda inputs de forma incidental (feed, detalle).
- Se declara en el spec el escape hatch que ya existe en código: cuando ningún seam aplica (la pantalla necesita `RefreshControl`, header propio o un hermano fuera del scroller), la pantalla usa el scroller compartido de `components/layout/keyboard-aware-scroll-view` con `KEYBOARD_BOTTOM_OFFSET`, **nunca** un import directo de `react-native-keyboard-controller`.
- `apps/mobile/app/(app)/transactions/index.tsx` reemplaza su `ScrollView` plano por el scroller compartido, cubriendo el `MoneyAmountInput` + `DateField` de `PendingReimbursementsBlock`.
- `apps/mobile/app/(app)/accounts/[id]/index.tsx` hace lo mismo, conservando su `RefreshControl`, cubriendo el buscador inline `autoFocus` de `MovementsSection`.
- Ambas declaran `keyboardShouldPersistTaps="handled"` — el requirement ya lo exige hoy para toda superficie scrolleable con inputs, así que esa mitad es incumplimiento puro, sin delta.

No cambia el mecanismo: `home/index.tsx` y `(onboarding)/initial-balance.tsx` ya consumen el scroller compartido de esta forma. No se toca `PendingReimbursementsBlock` ni `MovementsSection` — el fix vive en las pantallas que los hospedan.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `mobile-app-shell`: el requirement `Ninguna superficie con campos de texto queda tapada por el teclado` amplía su alcance a las superficies que no son de formulario y declara el uso directo del scroller compartido como camino válido cuando ningún seam aplica.

## Impact

- **Spec**: `openspec/specs/mobile-app-shell/spec.md` — un requirement modificado.
- **Código**: `apps/mobile/app/(app)/transactions/index.tsx`, `apps/mobile/app/(app)/accounts/[id]/index.tsx`.
- **Sin cambios**: `components/layout/keyboard-aware-scroll-view.ts`, `FormScreen`, `FormSheetBody`, `FormSheetKeyboardView`, `PendingReimbursementsBlock`, `MovementsSection`. Sin dependencias nuevas ni migraciones.
- **Verificación**: requiere development build (el `KeyboardToolbar` y el `KeyboardProvider` de `react-native-keyboard-controller` no corren en Expo Go). Nada en CI detecta esta clase de regresión — `contentContainerClassName` typechequea igual sobre un componente no registrado en NativeWind.
- **Fuera de alcance**: los `Drawer` de `app/(app)/home/settings.tsx` pasan un `View` pelado como panel en vez de `FormSheetBody` — misma clase de deriva, sin síntoma visible hoy (campos arriba de un panel full-height, sin `ScrollView` que coma taps), y con un follow-up ya anotado en `components/ui/Drawer.tsx` que necesita un `SafeAreaView` primero.
