## ADDED Requirements

### Requirement: El tab bar diferencia visualmente la acción de menú de las pestañas de navegación

`apps/mobile` SHALL renderizar el cuarto slot del tab bar (la acción de abrir el menú) con un treatment visual distinto a las pestañas de navegación primaria (Dashboard / Movimientos / Tarjetas):

- Las pestañas de navegación primaria SHALL renderizarse como hoy: ícono + label vertical, ocupando ancho equitativo dentro del tab bar.
- El slot de menú SHALL renderizarse como un botón circular sin label, claramente identificable como una acción (no como un destino navegable). El botón SHALL usar el color `--positive` (emerald) como fondo y un ícono blanco en su interior.
- El slot de menú SHALL mantenerse en la misma fila del tab bar (no ser un FAB flotante encima ni un botón en un header).
- El comportamiento funcional NO cambia: presionar el botón abre el `AppMenu` (bottom sheet modal), igual que hoy.

#### Scenario: El cuarto slot se ve como botón, no como pestaña

- **WHEN** un usuario abre la app y observa el tab bar inferior
- **THEN** los primeros tres slots (Dashboard, Movimientos, Tarjetas) muestran ícono + label vertical
- **AND** el cuarto slot muestra un botón circular con fondo emerald y un ícono blanco, sin label

#### Scenario: El botón de menú abre el AppMenu

- **WHEN** un usuario presiona el botón circular del cuarto slot
- **THEN** el `AppMenu` bottom sheet aparece desde la parte inferior de la pantalla

#### Scenario: Las pestañas de navegación mantienen su layout actual

- **WHEN** un usuario presiona "Movimientos" en el tab bar
- **THEN** la app navega a la pantalla de movimientos
- **AND** el ícono y label de "Movimientos" se muestran con el estado activo

### Requirement: El tab bar usa la paleta de marca leyendo desde tokens

El tab bar SHALL aplicar la paleta de tokens definida en `@grana/ui-tokens`. En particular:

- **Pestaña activa (ícono + label):** color `--positive` (emerald).
- **Pestaña inactiva (ícono + label):** color `text-soft`.
- **Surface del tab bar:** `bg-card`.
- **Borde superior del tab bar:** `border-border-soft`.
- **Esquinas superiores del tab bar:** levemente redondeadas (`rounded-t-xl`, ~12px) para que el tab bar se lea como una sheet flotante sobre el contenido.

Ningún color del tab bar SHALL estar hardcodeado como hex literal. Los colores SHALL venir de un módulo compartido (`apps/mobile/lib/colors.ts` o equivalente) que sirve como mirror JS de los tokens CSS hasta que exista un codegen automático.

Una pestaña activa SHALL mostrar un indicador visual adicional (pill o barra superior corta) en color `--positive` sobre o debajo del ícono, para reforzar la identificación del estado activo.

#### Scenario: La pestaña activa se identifica con emerald

- **WHEN** un usuario está en la pantalla de Dashboard
- **THEN** el ícono y label de "Dashboard" en el tab bar se muestran en color `--positive`
- **AND** un indicador (pill o barra corta) en color `--positive` aparece sobre o debajo del ícono activo
- **AND** las otras pestañas se muestran en color `text-soft`

#### Scenario: El tab bar no contiene literales de color hex

- **WHEN** un desarrollador inspecciona `apps/mobile/components/layout/TabBar.tsx`
- **THEN** no encuentra ningún valor `#RRGGBB` literal para colores de la paleta
- **AND** los colores se importan desde un módulo central (`apps/mobile/lib/colors.ts` o equivalente)

#### Scenario: El tab bar tiene esquinas superiores redondeadas

- **WHEN** un usuario observa el tab bar
- **THEN** las esquinas superiores del tab bar están redondeadas (~12px)
- **AND** las esquinas inferiores se mantienen rectas (el tab bar respeta el safe area inferior del dispositivo)

### Requirement: El AppMenu sheet aplica la paleta de marca

El componente `AppMenu` (bottom sheet modal abierto por el botón de menú) SHALL leer sus colores desde tokens (no literales hex). Al presionar un item del menú, el item SHALL mostrar un feedback visual breve con un tinte `--positive` translúcido como fondo activo, salvo el item destructivo "Salir" que SHALL mostrar un tinte `--error` translúcido.

#### Scenario: Press de un item muestra feedback emerald

- **WHEN** un usuario presiona el item "Mis tarjetas" en el `AppMenu`
- **THEN** el item muestra un fondo emerald translúcido durante el press

#### Scenario: Press del item Salir muestra feedback error

- **WHEN** un usuario presiona el item "Salir" en el `AppMenu`
- **THEN** el item muestra un fondo terracotta/error translúcido durante el press
