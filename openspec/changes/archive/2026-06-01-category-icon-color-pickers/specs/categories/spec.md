## ADDED Requirements

### Requirement: La selección de ícono y color de una categoría es por picker (web)

En los formularios web de alta (`/settings/categories/new`) y edición (`/settings/categories/[id]/edit`) de categorías propias, el `icon` y el `color` SHALL elegirse mediante controles de selección, no por entrada de texto libre:

- El `icon` SHALL elegirse desde una grilla curada de emojis (en un `Popover`), con una opción para dejarlo vacío ("Sin ícono"). El valor almacenado sigue siendo un string emoji.
- El `color` SHALL elegirse desde una paleta preset de swatches (cada uno con forma `#RRGGBB`, válida contra el schema) más un selector de color nativo para un color personalizado, con una opción para dejarlo vacío ("Sin color").

La selección NO SHALL cambiar el contrato de datos: `icon` se persiste como string y `color` como hex `#RRGGBB`; categorías existentes con cualquier valor previo siguen renderizando sin cambios.

#### Scenario: Elegir ícono desde la grilla

- **WHEN** el usuario abre el picker de ícono y toca un emoji de la grilla
- **THEN** el formulario adopta ese emoji como `icon` y cierra el popover

#### Scenario: Elegir color desde la paleta

- **WHEN** el usuario toca un swatch de la paleta
- **THEN** el formulario adopta ese hex como `color`

#### Scenario: Limpiar ícono o color

- **WHEN** el usuario usa "Sin ícono" o "Sin color"
- **THEN** el campo correspondiente queda vacío y la categoría se guarda con `icon`/`color` en `null`
