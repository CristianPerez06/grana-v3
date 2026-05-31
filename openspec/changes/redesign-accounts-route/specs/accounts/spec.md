## MODIFIED Requirements

### Requirement: El usuario puede ver la lista de sus cuentas agrupadas por tipo

El sistema SHALL mostrar las cuentas del usuario agrupadas por `type` — un grupo para `cash` ("Efectivo") y otro para `bank` ("Bancos"). Las cuentas `type='credit'` (tarjetas) NO se listan en esta pantalla: viven en su propia capability `cards`. Por defecto la lista excluye las cuentas con `is_active=false`. El orden dentro de cada grupo es por `created_at` ascendente. Cada cuenta SHALL renderizarse con su avatar visual (ver requirement "Cada cuenta tiene un avatar visual").

La pantalla SHALL adoptar el lenguaje visual del shell de `(app)`:
- Header con `PageHeader` (título + acción "+ Nueva cuenta" como `actions`).
- Cada sección renderiza un label en caps con count (por ejemplo "EFECTIVO · 2") y un contenedor de filas con `bg-card` explícito sobre `bg-background`, hairline `border-border-soft` y radio `rounded-2xl`. Las filas dentro del card SHALL separarse con `divide-y divide-border-soft`.
- Cada fila SHALL renderizar, en este orden y en columnas alineadas: avatar (`AccountAvatar`), bloque nombre + institución, balances ARS/USD a la derecha (ARS en `text-text` semibold, USD en `text-text-soft`), y una acción inline al final (`Editar` para activas, `Reactivar` para archivadas).

Las cuentas archivadas se siguen omitiendo del listado por default, pero cuando se renderizan (por ejemplo en la misma pantalla bajo una sección dedicada) SHALL diferenciarse por: borde del card `border-dashed`, un pill `Archivada` en cada fila (`bg-warning-soft text-warning`) y la acción inline en `text-positive` con copy "Reactivar". El estado archivado SHALL NOT depender de `opacity` global sobre la fila o la sección.

#### Scenario: Cuentas agrupadas por tipo

- **WHEN** el usuario tiene 2 cuentas cash y 3 cuentas bank activas
- **THEN** la pantalla muestra dos secciones: "Efectivo" con 2 y "Bancos" con 3

#### Scenario: Las tarjetas no aparecen en la lista de cuentas

- **WHEN** el usuario tiene tarjetas de crédito (`type='credit'`) activas
- **THEN** no aparecen en la pantalla de cuentas (su listado vive en la capability `cards`)

#### Scenario: Las archivadas no aparecen por default

- **WHEN** el usuario tiene cuentas con `is_active=false`
- **THEN** no aparecen en las secciones activas del listado (pero siguen accesibles vía consulta con `includeArchived=true`)

#### Scenario: Estado vacío de un grupo

- **WHEN** el usuario no tiene cuentas activas de un tipo
- **THEN** esa sección se omite (por ejemplo, no se muestra "Bancos" si no hay cuentas bank activas)

#### Scenario: Header de la pantalla usa `PageHeader`

- **WHEN** se renderiza `/accounts`
- **THEN** el header de la página es el componente `PageHeader` con el título de la ruta y la acción "+ Nueva cuenta" como `actions`
- **AND** no se renderiza un header artesanal con `<div>` y CTA propios

#### Scenario: Cada sección es una card blanca explícita sobre el shell

- **WHEN** se renderiza una sección con cuentas
- **THEN** el contenedor de filas usa `bg-card` (resuelto a `#FFFFFF`) con `border-border-soft` y `rounded-2xl`
- **AND** no se ve el `bg-background` del shell a través del card

#### Scenario: La sección Archivadas se diferencia por pill y borde dashed

- **WHEN** se renderiza la sección de archivadas
- **THEN** el contenedor de la sección usa `border-dashed`
- **AND** cada fila incluye un pill "Archivada" con `bg-warning-soft text-warning`
- **AND** la acción inline al final de la fila es "Reactivar" en `text-positive`
- **AND** la sección NO aplica `opacity` global sobre las filas

#### Scenario: Las filas se renderizan con columnas alineadas

- **WHEN** una sección renderiza dos o más filas con nombres de cuenta de largos distintos
- **THEN** el avatar, el bloque de balances y la acción inline mantienen el mismo "riel" vertical en todas las filas (slots de ancho fijo, no derivado del contenido)
