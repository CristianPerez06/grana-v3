## Context

El proyecto mobile (`apps/mobile`) sigue una convención documentada en `CLAUDE.md` y en la capacidad `page-header`: ninguna pantalla usa el header nativo del Stack de Expo Router; todas usan el componente custom `PageHeader` (o un header compuesto, como `DashboardHeader`) renderizado dentro de una `SafeAreaView edges={['top']}` a nivel pantalla.

Esta convención funciona, pero tiene dos limitaciones que esta propuesta resuelve:

1. **Responsabilidad del top safe-area inset dispersa**: cada pantalla declara su propia `SafeAreaView edges={['top']}` para asegurar que el contenido no quede tapado por el notch / barra de status. Es boilerplate repetido en 9 archivos.
2. **Identidad visual neutra**: la zona del status bar y la banda del header se renderizan sobre `bg-background` (blanco / `--page`), igual que el cuerpo. No hay separación visual entre el chrome del header y el contenido scrolleable.

Adicionalmente, la altura total del bloque superior (status bar + barra de header) varía según el `PageHeader` tenga `backLink` o no. Cuando una pantalla con back link comparte stack visual con otra sin back link, hay un salto vertical perceptible al navegar.

`apps/web` ya tiene su propia presentación de header (en cards, no cubre status bar porque no aplica al concepto en browser); no se toca en este cambio.

## Goals / Non-Goals

**Goals:**

- Pintar status bar + barra de header con `--navy` en todas las pantallas de `(app)`.
- Hacer que `PageHeader` y `DashboardHeader` sean autosuficientes respecto del top safe-area inset (que ellos mismos pinten esa zona).
- Garantizar altura constante del bloque superior independientemente de la presencia de `backLink`.
- Preservar la API pública `PageHeaderProps` en `@grana/ui-contracts` (sin cambios cross-platform).

**Non-Goals:**

- Cambiar la presentación web de `PageHeader` o los headers del onboarding / auth.
- Cambiar el contract `PageHeaderProps`. Si en el futuro hace falta un `tone`/`variant`, será una propuesta separada.
- Pintar el bottom safe-area / la zona del tab bar. Este cambio se limita al chrome superior.
- Reemplazar `DashboardHeader` por `PageHeader`. Sigue siendo un header compuesto explícitamente permitido por la regla de anti-regresión de `page-header`.

## Decisions

### Decision 1: El componente del header es self-wrapping en el top inset (en vez de que cada pantalla envuelva en `SafeAreaView`)

`PageHeader` y `DashboardHeader` renderizan internamente `<SafeAreaView edges={['top']} className="bg-navy">…</SafeAreaView>`. Las pantallas pasan a usar un `<View className="flex-1 bg-background">` plano como root.

**Alternativa considerada**: dejar la `SafeAreaView` en cada pantalla y solo cambiar el `bg-` a navy. Rechazada porque mantiene el boilerplate y obliga a coordinar dos lugares (header + pantalla) cada vez que se ajuste el color o el padding superior. Tener el header como dueño de su zona simplifica el modelo mental.

### Decision 2: El header se monta FUERA del `ScrollView`, no como primer hijo del scroll

En la implementación previa, el header era el primer elemento dentro del `ScrollView`. Para que la banda navy llegue de borde a borde y para que el top safe-area inset no se scrollee, el header pasa a ser un sibling del `ScrollView`, no un hijo:

```tsx
<View className="flex-1 bg-background">
  <PageHeader … />              {/* fixed top: navy band + safe-area top */}
  <ScrollView contentContainerClassName="px-6 py-6">
    {/* contenido */}
  </ScrollView>
</View>
```

**Alternativa considerada**: dejar el header dentro del scroll y usar `-mx-6 -mt-6` para que la banda escape al padding del `contentContainer`. Rechazada porque (a) el truco con margen negativo se rompe si el `ScrollView` agrega `horizontal` (no aplica hoy, pero es frágil), y (b) tener el header en posición fija arriba —no scrollable— es lo que el usuario espera visualmente.

### Decision 3: Altura constante por slot reservado del back link, no por `minHeight` del contenedor

Tanto `PageHeader` como `DashboardHeader` siempre renderizan la fila del back link. Cuando `backLink` está ausente:

- `PageHeader` renderiza `<View className="h-5" />` en lugar de la fila.
- `DashboardHeader` —que no tiene concepto de back link— renderiza un `<View className="h-5" />` arriba del título como padding superior reservado.

La altura `h-5` (20px en NativeWind) coincide con `text-sm leading-5`, que es la altura natural de la fila del back link real (un `Text className="text-sm text-navy-muted">← Volver</Text>`).

**Alternativa considerada**: aplicar `minHeight` al contenedor del header y centrar verticalmente el título cuando no hay back link. Rechazada porque la posición Y del título variaría entre pantallas con y sin back link (en el caso con back link el título queda abajo del back link; en el caso con `minHeight` + centrado quedaría a media altura). El salto visual sería peor que el que existe hoy.

### Decision 4: `StatusBar style="light"` se setea en `(app)/_layout.tsx`, no en cada pantalla

Las pantallas de `(app)` comparten el chrome navy. En vez de declarar `<StatusBar style="light" />` en cada una, se setea una vez en el layout. Las otras rutas (`(auth)`, `(onboarding)`) mantienen su propio comportamiento de StatusBar (que actualmente queda en el default del system / el container curvo de `(auth)` ya provee fondo navy implícitamente).

**Alternativa considerada**: setearlo en el `_layout.tsx` root (`apps/mobile/app/_layout.tsx`). Rechazada porque rompería el styling de status bar en pantallas que no son navy (por ejemplo, eventuales pantallas con fondo claro fuera de `(app)`).

### Decision 5: Colores no se duplican en JS — se usan clases NativeWind y, cuando hace falta literal, se referencia `colors` del bridge

`PageHeader` y `DashboardHeader` usan exclusivamente clases NativeWind (`bg-navy`, `text-white`, `text-navy-muted`). El único color en JS que tocamos es el del icono de `EyeMaskToggle`, que pasa de `#6B7683` (literal) a `#FFFFFF` (literal). Esto NO introduce regresión vs. el código previo (que ya tenía un literal en ese lugar), pero deja una deuda menor: ese literal debería resolverse vía `colors.white` cuando aterrice el codegen de `@grana/ui-tokens` (ver memoria `project_ui_tokens_tailwind_v4`). Ya está cubierto por `apps/mobile/lib/colors.ts` (`colors.white = '#FFFFFF'`), así que el reemplazo es trivial; lo dejamos como follow-up para no expandir scope.

## Risks / Trade-offs

- **Riesgo: pantallas en `(app)` que se agreguen en el futuro y se olviden de pasar a `<View>` (en vez de `SafeAreaView edges={['top']}`)** → como `PageHeader` ya rinde su propio top inset, una `SafeAreaView` extra solo agregaría padding doble (no rompe nada, solo se ve mal). Mitigación: la regla queda documentada en el spec de `page-header` (sección mobile) y la convención de "el header dueño del inset superior" queda explícita.
- **Riesgo: la altura `h-5` reservada deja un pequeño hueco arriba del título en pantallas sin back link** → es intencional. La alternativa (altura variable) es peor.
- **Riesgo: si en el futuro queremos volver a fondo claro en algún screen de `(app)`** → el StatusBar quedaría `style="light"` por el layout y los iconos no se verían. Mitigación: cuando ocurra, mover el setteo del StatusBar a las pantallas que lo necesiten, o introducir un override per-screen. No hay caso de uso hoy.
- **Trade-off: `EyeMaskToggle` queda acoplado al header navy** → al cambiar el color del icono a blanco hardcoded, el componente deja de ser portable a otros fondos. Aceptable por ahora: el componente sólo se usa en `DashboardHeader`. Si se reutiliza en otro contexto, se parametriza con prop `color`.
