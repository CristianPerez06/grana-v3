## Context

Motivación en `proposal.md`. Este change revierte la decisión 3 de `archive/2026-08-02-mobile-keyboard-avoidance/design.md`: «el contexto de teclado se ancla a la ventana, así que el overlay necesita su propio provider anidado». La premisa es cierta para la ventana nativa, pero no para el manejo del teclado. En Android, `react-native-keyboard-controller` (v1.22.x) ya maneja los `Modal` de RN desde el provider del root. Al abrirse un modal, pausa el callback de la ventana principal, engancha uno en la ventana del diálogo y registra un listener de cierre que reanuda el principal. Del lado de React, el contexto sí atraviesa el `Modal`.

El provider anidado repite esas operaciones sobre el mismo diálogo. Dos de ellas son de un solo dueño: el listener de cierre del diálogo y el callback de animación de su ventana. El anidado se registra después y gana, así que al cerrar el sheet corre solo su listener y el principal queda pausado para siempre. Comprobado en el código de la v1.22.2 instalada: `ModalAttachedWatcher.kt` pausa el callback principal (`suspend(true)`), engancha el suyo con `setWindowInsetsAnimationCallback` sobre la vista del diálogo y lo reanuda desde `setOnDismissListener`. `KeyboardAnimationCallback.kt` descarta las animaciones de teclado mientras `isSuspended` está activo.

**Evidencia de dispositivo (Android, development build, 2026-09-29).** Con `adb logcat | grep -E "KeyboardAnimationCallback|ModalAttachedWatcher|GRANA_QA"` y marcas en cada paso:

```
11:57:22.832 KeyboardAnimationCallback: DiffY: 0.0 0.0 0.0 false -1   ← último evento de teclado
11:57:32.622 GRANA_QA: 2-abri-selector
11:57:57.547 GRANA_QA: 3-cerre-selector
11:58:21.852 GRANA_QA: 4-toque-descripcion
11:58:33.866 GRANA_QA: 5-volvi-al-monto
11:58:45.643 GRANA_QA: 6-cerre-teclado
11:59:05.164 GRANA_QA: 7-barra-pegada-SI
```

Antes de abrir el selector, cada movimiento del teclado imprime líneas `DiffY`. Después, los pasos 4 a 6 abren y cierran el teclado en la pantalla principal sin una sola línea, y la barra queda pegada. Es el silencio que predice la hipótesis: el callback del root está pausado.

## Goals / Non-Goals

**Goals:**
- Un solo provider de teclado en toda la app mobile.
- Que el requirement del shell y AGENTS.md digan la regla nueva, y que ningún comentario del código siga repitiendo la vieja.

**Non-Goals:**
- Cambiar `FormSheetBody` o `FormSheetKeyboardView` más allá de sus comentarios: ya no montan provider, solo scrollean o desplazan.
- Resolver el fondo de la premisa vieja para `SafeAreaProvider`. `RecurrenceEditForm` monta uno propio dentro del `Drawer` por la ventana del `Modal`, y eso sí depende de la ventana: se queda. Solo cambia su comentario, que hoy lo justifica «igual que el `KeyboardProvider` del `Drawer`».

## Decisions

### 1. Sacar los providers anidados, no parchear la librería

Se sacan los tres `KeyboardProvider` anidados (`BottomSheet`, `Drawer`, `MovementFiltersSheet`) y queda solo el del root.

Por qué: la librería ya resuelve el caso `Modal` desde el root en Android, y en iOS cada provider escucha las notificaciones globales del sistema, así que el anidado nunca aportó nada propio. Esto es borrar código, no agregarlo. La alternativa de mantener los anidados y corregir el listener pisado exigiría un parche a una dependencia nativa (`patch-package`), recompilar el binario y cargar ese parche en cada actualización de la librería, para sostener una estructura que no hace falta.

### 2. Los `Modal` conservan `statusBarTranslucent` / `navigationBarTranslucent`

`BottomSheet` y `MovementFiltersSheet` los declaran hoy «porque el provider de adentro los fuerza bajo edge-to-edge». Sin el provider de adentro, siguen haciendo falta: la ventana del diálogo tiene que medir igual que la principal para que la altura de teclado que llega del root coincida con la geometría del sheet. Además `MovementFiltersSheet` depende de eso para su espaciador de safe-area. Cambia el comentario, no el flag. `Drawer` sigue sin declararlos, y su comentario ya documenta por qué.

### 3. El provider fuera del panel deja de ser una restricción

Los comentarios actuales explican que el provider va en la raíz del `Modal` y nunca dentro del panel, porque su vista `flex: 1` mide 0 en un sheet de altura por contenido. Sin provider anidado, esa restricción desaparece. La regla nueva para AGENTS.md es más corta: una superficie que abre un `Modal` no monta ningún provider de teclado.

## Risks / Trade-offs

- **[Un campo dentro de un sheet queda tapado por el teclado]**. Es el riesgo que motivó los anidados, y el change original los validó en las 20 superficies. → Verificación manual obligatoria en Android e iOS sobre cada familia de overlay con inputs: `MovementFiltersSheet`, `RecurrenceEditForm` en `Drawer`, los pickers con búsqueda (`FormSheetKeyboardView` en `BottomSheet`), la calculadora y el alta de propósito en Ahorro. Si alguna familia falla, se frena el apply y se decide con el usuario antes de tocar nada más.
- **[`Drawer` sin flags translúcidos mide distinto]**. Su ventana no es edge-to-edge, y la altura que manda el root puede no coincidir con su geometría. → Cubierto por la verificación de `RecurrenceEditForm`, que es el `Drawer` con inputs. Si falla, el arreglo es alinear los flags, que ya está anotado como pendiente en su comentario.
- **[La prueba es manual]**. No hay red en CI para esto. → Los pasos de verificación del issue y del escenario nuevo del spec quedan como tareas, con el mismo log marcado de la exploración para confirmar que el root sigue escuchando después de cerrar un sheet.

## Migration Plan

Cambio de JS puro, sin dependencias nativas: no hace falta recompilar el development build, alcanza con recargar. Para volver atrás se revierte el commit.
