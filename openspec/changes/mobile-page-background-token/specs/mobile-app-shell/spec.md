## ADDED Requirements

### Requirement: El root layout pinta el fondo de página debajo de todo el árbol

`apps/mobile/app/_layout.tsx` SHALL renderizar un contenedor opaco con el fondo de página (`<View className="flex-1 bg-page">`) dentro de `SafeAreaProvider` y por encima del resto de los providers, de modo que **ninguna superficie de la app deje ver el window background nativo**.

El motivo es estructural, no cosmético: el `TabBar` se monta como sibling del contenedor de pantallas del navigator, así que sus esquinas superiores redondeadas (`rounded-t-xl`, ver el requirement de paleta del tab bar) recortan el `bg-card` y revelan lo que haya **detrás del tab bar**, que no pertenece a ninguna pantalla. Sin un fondo pintado en el root, ese recorte muestra el window background nativo (negro). Lo mismo aplica a cualquier otro hueco transitorio: transiciones entre pantallas, overscroll y ramas de render que no cubran el viewport completo.

Este fondo del root es una **red de seguridad, no un reemplazo** del fondo de cada pantalla: las pantallas SHALL seguir declarando su propio fondo (ver capacidad `page-header`), para que el color correcto no dependa de qué haya debajo.

#### Scenario: Las esquinas redondeadas del tab bar muestran el fondo de página

- **WHEN** un usuario observa el tab bar en cualquier pantalla que lo renderice
- **THEN** el área recortada por las esquinas superiores redondeadas se ve del gris de página (`--page`)
- **AND** no se ve negro ni ningún color ajeno a la paleta

#### Scenario: El root layout declara un fondo opaco

- **WHEN** un colaborador inspecciona `apps/mobile/app/_layout.tsx`
- **THEN** el árbol contiene un `<View className="flex-1 bg-page">` dentro de `SafeAreaProvider` que envuelve a los demás providers
- **AND** el token usado compila a un valor literal, de modo que el fondo pinta sin depender de custom properties declaradas en runtime
