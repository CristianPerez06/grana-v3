## ADDED Requirements

### Requirement: El sidebar de desktop es colapsable y la preferencia persiste

El sidebar de desktop SHALL soportar dos estados: **expandido** (ancho ~240px, labels visibles junto a los íconos) y **colapsado** (ancho ~64px, solo íconos visibles, logo compacto). El estado por default SHALL ser expandido.

El sidebar SHALL incluir un botón toggle que pertenece al shell de navegación (su DOM y su comportamiento son parte del sidebar, no del `<main>`) y que mantiene su posición relativa al sidebar en ambos estados — el botón NO SHALL cambiar de ubicación dentro del sidebar cuando el usuario alterna entre expandido y colapsado. Visualmente el botón PUEDE renderizarse como un handle en el borde derecho del sidebar (overhanging sobre el límite entre sidebar y `<main>`) o íntegramente dentro del chrome interior; la implementación elige una de las dos opciones y la mantiene. La transición SHALL animar el cambio de ancho (`transition-[width]`, ~200ms).

La preferencia SHALL persistir entre sesiones mediante una cookie `sidebar_collapsed` con valor `'true'` o `'false'`, `maxAge` 1 año, `path /`, `sameSite: lax`. La cookie SHALL leerse en Server Components antes de hidratar el sidebar para evitar flash visual al recargar.

El estado de colapso aplica ÚNICAMENTE al sidebar de desktop (≥ `md`). El drawer mobile NO tiene estado colapsado.

#### Scenario: El usuario colapsa el sidebar

- **WHEN** el usuario presiona el botón toggle del sidebar
- **THEN** el sidebar transiciona a ~64px de ancho
- **AND** los labels se ocultan, solo quedan visibles los íconos
- **AND** la cookie `sidebar_collapsed` se escribe con valor `'true'`

#### Scenario: La preferencia persiste tras recargar

- **WHEN** un usuario con `sidebar_collapsed=true` recarga la página
- **THEN** el sidebar se renderiza ya colapsado desde el primer paint
- **AND** no se produce un flash de sidebar expandido seguido de colapso

#### Scenario: Mobile no usa la preferencia de colapso

- **WHEN** un usuario con `sidebar_collapsed=true` carga la app en un viewport < 768px
- **THEN** el sidebar de desktop NO se renderiza (igual que cuando la cookie está `false`)
- **AND** la topbar + drawer mobile aparecen sin alteraciones

### Requirement: El `<main>` es el contenedor scrollable; el body no scrollea

El `<body>` y los contenedores raíz del layout autenticado (`(app)/layout.tsx`) SHALL tener altura limitada al viewport (`h-screen` o equivalente). Cuando el contenido de una pantalla supera el alto disponible, el scroll vertical SHALL ocurrir dentro del elemento `<main>` (`overflow-y-auto`), NO en el body.

El sidebar SHALL permanecer visible y fijo en pantalla mientras el `<main>` scrollea internamente. El logo y los items de pie del sidebar SHALL ser siempre alcanzables sin scrollear el contenido.

#### Scenario: Scroll de contenido largo no mueve el sidebar

- **WHEN** un usuario está en una pantalla con contenido que supera el alto del viewport
- **AND** scrollea dentro del `<main>`
- **THEN** el sidebar permanece estacionario
- **AND** el logo del sidebar sigue siendo visible en su posición original
- **AND** los items de pie (Configuración, Logout) siguen siendo visibles en su posición original

#### Scenario: El body no scrollea

- **WHEN** un usuario está en una pantalla con contenido largo
- **THEN** la barra de scroll del navegador NO aparece sobre el body
- **AND** la barra de scroll aparece, si acaso, dentro del `<main>`

## MODIFIED Requirements

### Requirement: El sidebar usa la paleta de marca para estados

El sidebar SHALL aplicar la paleta de tokens de `@grana/ui-tokens` para todos sus estados visuales. En particular:

- **Item activo (nav primaria):** color de acento `--positive` (emerald) en texto e ícono. El fondo del item activo SHALL ser una variante translúcida del mismo emerald (`bg-positive/8`). El item activo NO SHALL usar barra lateral izquierda ni ningún otro indicador de borde; el realce es exclusivamente por color de texto + fondo translúcido.
- **Item inactivo:** texto `text-text`, ícono `text-text`, hover `bg-page`. Sin borde lateral.
- **Logo:** color `text-navy`.
- **Logout:** texto `text-error`, hover `bg-error/8` (o variante translúcida equivalente). Sin borde lateral.
- **Surface del sidebar:** `bg-card`, borde `border-border-soft`.

Ningún color SHALL estar hardcodeado como hex literal en el sidebar; todos los colores SHALL venir de tokens.

#### Scenario: El item activo se identifica con acento emerald

- **WHEN** un usuario navega a una ruta cubierta por un item del sidebar
- **THEN** ese item se renderiza con texto e ícono en color `--positive`
- **AND** el fondo del item es una variante translúcida del mismo emerald (`bg-positive/8`)
- **AND** el item NO muestra una barra lateral izquierda ni ningún otro borde de acento
- **AND** el resto de los items se renderizan en color `text-text`

#### Scenario: El sidebar no contiene literales de color hex

- **WHEN** un desarrollador inspecciona el código fuente del sidebar
- **THEN** no encuentra ningún valor `#RRGGBB` ni `rgb(...)` hardcodeado para colores de la paleta
- **AND** todos los colores se referencian vía clases utilitarias de Tailwind o variables CSS de `@grana/ui-tokens`

### Requirement: El sidebar tiene presentación visual de island flotante

El sidebar SHALL renderizarse como un panel flotante separado del viewport y del contenido principal:

- Margen exterior respecto al viewport (~12px en los lados visibles: izquierdo, superior, inferior).
- Esquinas redondeadas en los cuatro lados.
- Sombra sutil (`shadow-sm` o equivalente).
- Padding interior superior e inferior que separe el logo del borde superior y los items de pie del borde inferior.
- Fondo `bg-card` y borde `border-border-soft`.
- El sidebar SHALL ocupar el alto completo del viewport (menos los márgenes externos).

El contenido principal (`<main>`) SHALL renderizarse en un contenedor adyacente al sidebar, separado por un gap visual (no por borde compartido). En anchos `md` y mayores, sidebar y main coexisten en el mismo viewport.

#### Scenario: El sidebar se ve como un panel flotante en desktop

- **WHEN** un usuario carga la app en un viewport ≥ 768px
- **THEN** el sidebar tiene margen externo respecto al borde izquierdo, superior e inferior del viewport
- **AND** las cuatro esquinas del sidebar están redondeadas
- **AND** el sidebar muestra una sombra sutil
- **AND** el sidebar ocupa el alto completo del viewport (menos el margen externo)
