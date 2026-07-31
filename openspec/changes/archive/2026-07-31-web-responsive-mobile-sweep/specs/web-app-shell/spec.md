## MODIFIED Requirements

### Requirement: El `<main>` es el contenedor scrollable; el body no scrollea

El `<body>` y los contenedores raíz del layout autenticado (`(app)/layout.tsx`) SHALL tener altura limitada al viewport (`h-screen` o equivalente). Cuando el contenido de una pantalla supera el alto disponible, el scroll vertical SHALL ocurrir dentro del elemento `<main>` (`overflow-y-auto`), NO en el body.

El elemento `<main>` SHALL ocupar el ancho completo del área disponible (todo el espacio horizontal que queda libre a la derecha del sidebar en desktop, y todo el ancho del viewport en mobile). El cap de ancho de contenido (`max-w-5xl` o el valor que defina el diseño), el centrado horizontal (`mx-auto`) y el padding horizontal SHALL aplicarse a un `<div>` hijo dentro de `<main>`, NO al `<main>` mismo. De esta forma `<main>` es el viewport scrolleable full-width y su scrollbar vertical se pinta pegado al borde derecho del área disponible (borde derecho del viewport, considerando el sidebar como el único hermano horizontal en desktop).

El padding horizontal y vertical del `<div>` hijo SHALL ser responsive: SHALL usar un valor reducido en mobile y un valor mayor a partir del breakpoint `md`, en lugar de un padding fijo igual para todos los anchos. En anchos de mobile (320–420px) el padding horizontal NO SHALL exceder ~16px por lado, de modo que el contenido no se apriete; en `md` y mayores SHALL recuperar el padding holgado de desktop.

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

#### Scenario: El scrollbar vertical se pinta al borde derecho del viewport

- **WHEN** un usuario en desktop (≥ 768px) está en una ruta autenticada con contenido que supera el alto del viewport
- **THEN** el scrollbar vertical del `<main>` se pinta pegado al borde derecho del viewport (no en el borde derecho del bloque de contenido capado por `max-w-5xl`)
- **AND** no queda una franja vertical sin scrollbar entre el bloque de contenido y el borde derecho del viewport

#### Scenario: El cap de ancho vive en un hijo de `<main>`, no en `<main>`

- **WHEN** un desarrollador inspecciona el JSX del shell autenticado
- **THEN** el elemento `<main>` NO contiene clases de ancho máximo (`max-w-*`), centrado horizontal (`mx-auto`) ni padding horizontal (`px-*`)
- **AND** un elemento hijo directo dentro de `<main>` aplica `mx-auto`, el `max-w-*` definido por el diseño y el padding horizontal/vertical
- **AND** `<main>` conserva las clases de viewport scrolleable (`flex-1`, `overflow-y-auto` o equivalentes)

#### Scenario: El padding del contenido se reduce en mobile

- **WHEN** un usuario carga una ruta autenticada en un viewport de 360px de ancho
- **THEN** el `<div>` hijo de `<main>` aplica un padding horizontal reducido (≤ ~16px por lado)
- **AND** en un viewport ≥ 768px el mismo `<div>` aplica el padding holgado de desktop
- **AND** el contenido no presenta scroll horizontal en el viewport de 360px
