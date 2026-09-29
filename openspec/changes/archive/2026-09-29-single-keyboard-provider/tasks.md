## 1. Un solo provider de teclado

- [x] 1.1 Sacar el `KeyboardProvider` anidado de `apps/mobile/components/ui/BottomSheet.tsx`, conservar `statusBarTranslucent` / `navigationBarTranslucent` en el `Modal` y reescribir el JSDoc y el comentario de los flags con el motivo nuevo (design §2 y §3). Verificar que el archivo ya no importa `KeyboardProvider`.
- [x] 1.2 Sacar el `KeyboardProvider` anidado de `apps/mobile/components/ui/Drawer.tsx` y reescribir su JSDoc y el comentario de los flags, que hoy habla del «provider inside». Verificar que el archivo ya no importa `KeyboardProvider`.
- [x] 1.3 Sacar el `KeyboardProvider` anidado de `apps/mobile/components/movements/MovementFiltersSheet.tsx`, conservando los flags translúcidos, el scrim hermano y el espaciador de safe-area. Reescribir los dos comentarios que lo justifican. Verificar que el archivo ya no importa `KeyboardProvider`.
- [x] 1.4 Confirmar con `grep -rn "KeyboardProvider" apps/mobile --include=*.tsx` que el único montaje que queda es el de `apps/mobile/app/_layout.tsx` (escenario «Ningún `Modal` monta su propio contexto de teclado»).

## 2. Comentarios y regla escrita

- [x] 2.1 Reescribir los comentarios que repiten la premisa vieja («el provider del root no llega dentro de un `Modal`»): `app/_layout.tsx`, `components/layout/FormSheetBody.tsx`, `components/layout/FormSheetKeyboardView.tsx`, `components/dashboard/MonthSheet.tsx` y `components/recurrences/RecurrenceEditForm.tsx`. En este último, el `SafeAreaProvider` se queda y solo cambia la justificación (design, Non-Goals). Verificar con `grep -rn -i "nested provider\|own nested\|does not reach\|mounts its own\|KeyboardProvider" apps/mobile --include=*.tsx` que no queda ninguna mención de la regla vieja.
- [x] 2.2 Reescribir en AGENTS.md § Mobile form surfaces el bullet «Overlay with form content». La regla nueva: una superficie que abre un `Modal` NO monta un `KeyboardProvider` (el del root la alcanza, y uno anidado deja al root sin escuchar el teclado, issue #166). Los flags translúcidos se siguen declarando en los `Modal` edge-to-edge. Verificar releyendo la sección completa, que ninguna otra línea contradiga la regla.
- [x] 2.3 Correr `pnpm typecheck:mobile` y `pnpm lint:mobile`, y verificar que pasan sin errores.

## 3. Verificación en dispositivo (la corre el usuario, development build)

- [x] 3.1 Android, secuencia del bug con el log marcado de `design.md` (`adb logcat | grep -E "KeyboardAnimationCallback|ModalAttachedWatcher|GRANA_QA"`): alta de movimiento, abrir el selector de cuenta o categoría con el teclado abierto, elegir, pasar de la descripción al monto y cerrar el teclado. Verificar que la barra desaparece con el teclado y que después de `3-cerre-selector` siguen apareciendo líneas `DiffY`. Repetir con la calculadora, con el selector de fecha y en la edición de un movimiento.
- [x] 3.2 Android, mismo recorrido abriendo el selector con el teclado cerrado. Verificar que al tocar un campo la barra aparece y el campo queda por encima del teclado y de la barra (escenario «Después de cerrar un sheet, el teclado sigue acomodando los campos»).
- [x] 3.3 Android, regresión de overlays con inputs: filtros de movimientos, edición de recurrencia (`Drawer`), «Ya lo pagué» de una recurrencia (`PayAheadSheet`), alta de propósito en Ahorro, y los pickers con búsqueda de banco e institución. Verificar en cada uno que el campo enfocado queda visible sobre el teclado y que el sheet no pierde su header. Si alguno falla, frenar y decidir con el usuario (design, Risks).
- [x] 3.4 iOS: repetir 3.1 a 3.3 sin el log, observando la barra y los campos. Verificar el mismo resultado que en Android.
