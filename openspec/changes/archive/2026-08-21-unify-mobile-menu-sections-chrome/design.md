## Context

Tres secciones se abren desde el mismo lugar —el botón … del tab bar, que monta el `AppMenu`— y ninguna corresponde a un tab: `AppMenu.tsx` navega a `/accounts`, `/cards` y `/(app)/settings`. Pero cada una resolvió su chrome por separado:

| Sección | Tab bar oculto | Back-link `← Inicio` | Estado |
| --- | --- | --- | --- |
| Cuentas (`/accounts`) | ✅ | ✅ | Cumple — es la referencia de forma |
| Tarjetas (`/cards`) | ✅ | ❌ | **Sin salida visible** — el bug de #50 |
| Configuración (`/settings`) | ❌ | ❌ | Tiene salida (el tab bar), pero detached |

Las dos decisiones viven en lugares distintos y nada las obliga a moverse juntas: la visibilidad del tab bar la decide `CHROMELESS_SECTIONS` en `TabBar.tsx` (hoy `['accounts', 'cards']`), y el back-link lo declara cada pantalla raíz pasándole `backLink` a `PageHeader`. El primitivo ya soporta las dos mitades; lo que falta es el acuerdo.

Restricción heredada útil: `PageHeader` ya renderiza un spacer `<View className="h-5" />` cuando `backLink` está ausente (requirement de altura constante del spec `page-header`). Agregar el back-link reemplaza el spacer por la fila del link, así que **no cambia la altura del header** ni mueve el contenido de abajo. El arreglo es aditivo, no un re-layout.

## Goals / Non-Goals

**Goals:**

- Que ninguna pantalla de la app quede sin navegación visible.
- Que las tres secciones del Menú se comporten igual, y que la regla quede escrita donde la próxima sección la va a encontrar.
- Que el destino del back-link sea determinístico, sin depender del historial de navegación.
- Que sacar el tab bar no deje el contenido pegado al borde inferior del dispositivo.

**Non-Goals:**

- Tocar web. Ahí estas tres son section roots con sidebar/drawer como salida, y el spec ya dice que el back-link canónico aplica a las rutas hijas.
- Cambiar la composición del tab bar, sus slots o el `AppMenu`.
- Convertir Configuración (ni ninguna de las tres) en un tab.
- Normalizar los paddings de las pantallas: cada una conserva su ritmo, sólo se suma la compensación del inset inferior.

## Decisions

**1. La regla se escribe como contrato de dos mitades, no como dos reglas sueltas.** El bug no es "a `/cards` le falta un link": es que ocultar el tab bar y declarar la salida son la misma decisión partida en dos archivos. El requirement nuevo de `mobile-app-shell` las ata: estar en `CHROMELESS_SECTIONS` **implica** declarar `backLink` al dashboard en la raíz. Cumplir una sola mitad queda tipificado como defecto —sin la primera el tab bar aparece detached, sin la segunda la pantalla queda sin salida— y una sección nueva del Menú tiene que hacer las dos.

Alternativa descartada: derivar el back-link automáticamente en `PageHeader` a partir de los segmentos de ruta. Escondería la decisión dentro del primitivo, obligaría al header a conocer la topología de navegación, y rompería los casos donde el back-link legítimamente no apunta al dashboard (todas las rutas hijas).

**2. `href` fijo al dashboard, no `router.back()`.** `PageHeader` mobile soporta `onBackPress` para popear el stack, y varias pantallas hijas lo usan. Para las raíces de sección no sirve: a `/cards` se llega desde el Menú, desde un deep link o desde las cards del dashboard, y `router.back()` haría que el mismo affordance lleve a lugares distintos —o a ninguno, si no hay historial. `← Inicio` tiene que significar Inicio siempre.

**3. Copy existente.** `nav.dashboard` ya resuelve a "Inicio" (`es`) y "Home" (`en`) y es la misma clave que rotula el tab de Inicio, así que el back-link nombra el destino con la misma palabra que el usuario ve en la barra. No se agrega copy.

**4. `settings` entra a `CHROMELESS_SECTIONS`, no a `CHROMELESS_SCREENS`.** Son dos listas con semánticas distintas y el nombre `settings` aparece en las dos por coincidencia: la entrada `['home', 'settings']` de `CHROMELESS_SCREENS` es la configuración **del Hogar**, pusheada sobre el tab Hogar. La detección del `TabBar` compara `parts[0]` para secciones y `[parent, screen]` para pantallas, así que `/(app)/home/settings` (donde `parts[0] === 'home'`) no se cruza con `/(app)/settings/**` (donde `parts[0] === 'settings'`). Las dos reglas conviven y el spec lo deja escrito para que nadie "limpie" una creyéndola duplicada.

**5. El chromeless alcanza a toda la sección Configuración, hijas incluidas.** Es consecuencia directa de que la detección sea por sección, y es lo que ya pasa con Cuentas y Tarjetas. `/settings/categories/**` ya declara su propio back-link al parent, así que no queda sin salida; encima gana consistencia con las hijas de las otras dos.

**6. El safe-area inferior se compensa en las tres, no sólo en Configuración.** El tab bar era lo único que pintaba `insets.bottom` (`paddingBottom: Math.max(14, insets.bottom)`). En Configuración sacarlo sería una regresión nueva; en Cuentas y Tarjetas el gap ya existe desde que son chromeless. Se arregla en las tres —"las tres o ninguna"— siguiendo el patrón que ya usa `AuthShell`: el `contentContainerClassName` conserva sólo el padding que no depende del inset (`px-6 pt-6`) y el `contentContainerStyle` calcula el de abajo (`insets.bottom + 24`). Repartirlo así, en vez de dejar `py-6` y sumar el inset por `style`, evita depender del orden de merge entre NativeWind y el `style` prop —donde el inline gana, y en un Android con inset 0 el padding inferior habría quedado en cero. Las pantallas de formulario pusheadas no entran: `FormScreen` ya trae `pb-28`.

Alternativa descartada: envolver las pantallas en `SafeAreaView edges={['bottom']}`. Recortaría el área scrolleable en vez de extender el contenido, dejando el scroll cortado antes del borde y perdiendo el efecto de contenido que pasa por debajo del home indicator.

## Risks / Trade-offs

- **Tocar `CHROMELESS_SECTIONS` afecta a toda la sección Configuración de una** → sus hijas ya declaran back-link propio; la verificación cubre `/settings/categories/**` explícitamente.
- **Confundir la sección `settings` con la pantalla `['home', 'settings']`** → decisión 4 y un scenario dedicado en el spec; la entrada de `CHROMELESS_SCREENS` no se toca en ninguna tarea.
- **El padding inferior se calcula en `style` sobre un `contentContainer` que ya usa NativeWind** → el `style` prop gana sobre las clases, así que el `py-6` se parte en `pt-6` (className) + `insets.bottom + 24` (style). Ninguna de las dos fuentes declara `paddingBottom` dos veces.
- **Verificación manual**: el efecto es visual y de navegación, y el repo no tiene tests de UI nativa. La red de seguridad es el checklist del ticket sobre dispositivo, más `lint`/`typecheck` para el resto.
