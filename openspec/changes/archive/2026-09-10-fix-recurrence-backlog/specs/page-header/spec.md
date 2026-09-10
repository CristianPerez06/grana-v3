## MODIFIED Requirements

### Requirement: PageHeader mobile renderiza el estilo canónico para React Native

`apps/mobile` SHALL exponer `PageHeader` en `apps/mobile/components/ui/PageHeader.tsx`. El componente SHALL usar primitivas de React Native (`View`, `Text`) con clases NativeWind, y SHALL renderizar:

1. Una `SafeAreaView` con fondo `bg-navy` como wrapper externo, que cubre la zona del top safe-area inset (status bar / notch / Dynamic Island) pintándola con `--navy`. **El componente es self-wrapping en el top inset**: las pantallas que lo usan NO deben envolver su contenido en una `SafeAreaView edges={['top']}` adicional — el header lo hace por ellas.

   El top edge SHALL ser condicional: `edges={['top']}` cuando el header es lo más alto de la pantalla, y **sin top edge** cuando un aviso global montado por el layout de `(app)` ya pintó y consumió el inset. Un aviso así —hoy el de materialización de recurrencias— se renderiza por encima del navegador, de modo que es él, y no el header, lo primero que toca el borde del dispositivo. Despejar el inset dos veces deja una **banda navy vacía** del alto del notch entre el aviso y el título, que es exactamente el defecto que esta condición elimina.

   Quien pinta el inset SHALL declararlo, y el header SHALL leer esa declaración por contexto: `SafeAreaView` es una vista **nativa** y NO lee `SafeAreaInsetsContext`, así que achicar los insets desde JS no la mueve — lo único que la gobierna es su prop `edges`. La misma condición SHALL aplicar a `DashboardHeader`, que pinta la misma banda.

   El aviso global SHALL pintar el inset con `--navy`, no dejarlo transparente: la status bar se dibuja en estilo `light` (reloj, wifi y batería en blanco) porque el contrato dice que vive sobre la banda navy. Un inset del color de la página deja texto blanco sobre fondo casi blanco.
2. Si `backLink` está presente, una fila previa al título con un `Link` de `expo-router` apuntando a `backLink.href`, mostrando `← {backLink.label}` con clases `text-sm text-navy-muted`.
3. Si `backLink` NO está presente, en su lugar SHALL renderizar un spacer `<View className="h-5" />` para preservar la altura de la fila (ver requirement de altura constante).
4. Un `Text` con `accessibilityRole="header"`, peso semibold y tamaño `text-2xl`, color `text-white`, conteniendo el `title`.
5. Si `description` está presente, un `Text` de tamaño `text-sm` con color `text-navy-muted` inmediatamente debajo del título, agrupado en el mismo bloque que el título (no separado por el gap del wrapper de la pantalla).
6. Si `actions` está presente, el slot SHALL renderizarse a la derecha del bloque {título + descripción} en la misma fila, alineado al top.

Los colores SHALL leerse de tokens de `@grana/ui-tokens` vía clases NativeWind (`bg-navy`, `text-white`, `text-navy-muted`). NO SHALL haber literales de color hex hardcodeados en el componente.

El `Text` del título SHALL usar `accessibilityRole="header"` para anuncio correcto por screen readers nativos.

#### Scenario: PageHeader mobile pinta el top safe-area inset en navy

- **WHEN** una pantalla mobile bajo `(app)` renderiza `<PageHeader title="Movimientos" />`
- **THEN** la zona superior de la pantalla, incluyendo el notch / Dynamic Island y la barra de status (reloj, wifi, batería), aparece pintada con `--navy`
- **AND** la barra de header (donde vive el título) continúa la misma banda navy sin discontinuidad de color
- **AND** la pantalla NO necesita declarar `<SafeAreaView edges={['top']}>` propia para evitar overlap con el notch

#### Scenario: PageHeader mobile sólo con título

- **WHEN** una pantalla mobile renderiza `<PageHeader title="Movimientos" />`
- **THEN** la jerarquía visual muestra el texto "Movimientos" en blanco arriba del contenido de la pantalla, sobre fondo navy
- **AND** el `Text` correspondiente expone `accessibilityRole="header"`
- **AND** no hay back link visible (pero el slot reservado de altura sí está presente — ver requirement de altura constante)

#### Scenario: PageHeader mobile con back link

- **WHEN** una pantalla mobile renderiza `<PageHeader title="Detalle" backLink={{ href: "/movimientos", label: "Movimientos" }} />`
- **THEN** se renderiza un `Link` de `expo-router` con label `← Movimientos` y `href` `/movimientos` arriba del título, con clases `text-sm text-navy-muted`
- **AND** presionar el back link navega a `/movimientos`
- **AND** el título "Detalle" aparece debajo del back link en blanco (`text-white`)

#### Scenario: PageHeader mobile con actions

- **WHEN** una pantalla mobile renderiza `<PageHeader title="Período" actions={<Pressable>...</Pressable>} />`
- **THEN** el título y el `Pressable` quedan en la misma fila, alineados horizontalmente con el título a la izquierda y la acción a la derecha
- **AND** ambos se renderizan sobre fondo navy

#### Scenario: Con un aviso global arriba, el header no vuelve a despejar el inset

- **WHEN** el layout de `(app)` monta el aviso global de materialización y la pantalla debajo renderiza `<PageHeader title="Movimientos" />`
- **THEN** el inset superior queda pintado en navy una sola vez, por el aviso
- **AND** entre el aviso y el título NO aparece una banda navy vacía del alto del notch
- **AND** el reloj y los íconos de la status bar siguen siendo legibles en blanco
- **AND** al desaparecer el aviso el header vuelve a despejar el inset por sí mismo, sin salto de color
