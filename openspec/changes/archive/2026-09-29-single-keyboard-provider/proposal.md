## Why

En Android, la barra que acompaña al teclado (flechas y «Done») puede quedar pegada en pantalla para siempre después de usar un selector en el alta o la edición de un movimiento. Solo se va cerrando la app. La causa es una regla del propio shell mobile: cada sheet monta su propio contexto de teclado y, al cerrarse, deja al contexto principal de la app sin escuchar el teclado. Issue #166.

## What Changes

- La app mobile pasa a tener **un único contexto de teclado**, el del root layout. `BottomSheet`, `Drawer` y `MovementFiltersSheet` dejan de montar uno propio dentro de su `Modal`.
- Se invierte la regla escrita: el spec `mobile-app-shell` y AGENTS.md (§ Mobile form surfaces) dicen hoy que toda superficie dueña de un `Modal` **debe** montar su propio contexto. Pasan a prohibirlo.
- Los `Modal` que ya declaran `statusBarTranslucent` / `navigationBarTranslucent` los conservan. Lo que cambia es el motivo escrito en el comentario.
- Se corrigen los comentarios que repiten la premisa vieja («el contexto principal no llega dentro de un `Modal`»): `_layout.tsx`, `FormSheetBody`, `FormSheetKeyboardView`, `BottomSheet`, `Drawer`, `MovementFiltersSheet`, `MonthSheet` y `RecurrenceEditForm`.

Qué nota la persona que usa la app: la barra aparece y desaparece junto con el teclado siempre, aunque antes haya abierto y cerrado un selector. Los campos dentro de los sheets siguen quedando por encima del teclado, igual que hoy.

**Fuera de alcance:**
- No se toca qué hace la barra dentro de un sheet (hoy no se ve sobre los sheets y así sigue).
- No se alinean los flags de `Drawer` con edge-to-edge: su comentario ya lo deja como pendiente aparte.
- No se agregan tests automatizados de teclado: la app no tiene cómo renderizar pantallas nativas en su suite.

## Capabilities

### New Capabilities

_(ninguna)_

### Modified Capabilities

- `mobile-app-shell`: el requirement «El root layout provee el contexto de teclado a toda la app» deja de exigir un contexto propio por `Modal` y pasa a exigir uno solo, con un escenario nuevo para la secuencia del bug.

## Impact

- Código: `apps/mobile/components/ui/BottomSheet.tsx`, `apps/mobile/components/ui/Drawer.tsx`, `apps/mobile/components/movements/MovementFiltersSheet.tsx`, más los comentarios de `apps/mobile/app/_layout.tsx`, `components/layout/FormSheetBody.tsx`, `components/layout/FormSheetKeyboardView.tsx`, `components/dashboard/MonthSheet.tsx` y `components/recurrences/RecurrenceEditForm.tsx`.
- Documentación: AGENTS.md § Mobile form surfaces.
- Sin dependencias nuevas ni cambios nativos: no hace falta recompilar el development build.
- Verificación manual en development build, Android e iOS. Es la única red: `typecheck` y `lint` solo cubren la parte mecánica.
