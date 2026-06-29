## ADDED Requirements

### Requirement: Las rutas autenticadas renderizan sin desbordamiento horizontal en mobile

Toda ruta bajo `(app)/` de `apps/web` SHALL renderizar su contenido sin scroll horizontal y de forma legible en viewports desde 320px de ancho hacia arriba. Ningún elemento de contenido SHALL forzar al `<main>` o al viewport a desplazarse horizontalmente en anchos de mobile (320–420px).

El piso de soporte es 320px; anchos menores quedan fuera de alcance. El contrato aplica a presentación: el ajuste se logra con clases responsive (mobile-first), preservando el render de desktop existente.

#### Scenario: Ninguna ruta autenticada scrollea horizontal a 360px

- **WHEN** un usuario carga cualquier ruta autenticada (dashboard, accounts, accounts/[id], cards, cards/[id], transactions, transactions/[txId], shared, shared/cuenta-corriente, shared/settle, settings y sus subrutas) en un viewport de 360px de ancho
- **THEN** el contenido se ajusta al ancho disponible sin generar scroll horizontal
- **AND** ningún texto, monto, chip o control queda cortado fuera del viewport

#### Scenario: El render de desktop no cambia

- **WHEN** un usuario carga las mismas rutas en un viewport ≥ 768px
- **THEN** el layout y los tamaños coinciden con el diseño de desktop previo a este cambio (los breakpoints reinyectan los valores de desktop)

### Requirement: Los montos destacados (heros) escalan en mobile

Los montos grandes de las tarjetas hero (saldo de detalle de cuenta, neto del home de Compartido, monto de settle, monto del hero de detalle de movimiento) SHALL usar un tamaño de fuente reducido en mobile y recuperar el tamaño grande a partir del breakpoint correspondiente, en lugar de un tamaño fijo único. El escalado PUEDE implementarse con un breakpoint (`text-[Npx] sm:text-[Mpx]`) o con `clamp()`. El monto SHALL caber completo (sin recortarse ni desbordar el hero) en un viewport de 360px de ancho para valores realistas (ej. saldos de hasta 9 dígitos más separadores y símbolo).

#### Scenario: El saldo del detalle de cuenta cabe en mobile

- **WHEN** un usuario abre el detalle de una cuenta con un saldo de varios millones en un viewport de 360px
- **THEN** el monto del hero se renderiza completo dentro del hero, sin recortarse ni desbordar
- **AND** en un viewport ≥ 640px el monto recupera su tamaño grande de desktop

#### Scenario: Los montos hero de Compartido y settle escalan

- **WHEN** un usuario abre el home de Compartido o la pantalla de settle en un viewport de 360px
- **THEN** los montos destacados se renderizan completos sin desbordar su contenedor

### Requirement: Los overlays clampan su ancho al viewport

Los primitivos de overlay (`dropdown-menu`, `popover` y el `date-picker` que lo usa) SHALL limitar su ancho efectivo al ancho del viewport menos un margen, de modo que nunca desborden horizontalmente en mobile. Un overlay con ancho deseado o mínimo mayor al viewport disponible SHALL reducirse a `min(anchoDeseado, 100vw - margen)`. Los drawers laterales SHALL clampar su ancho a, como máximo, el ancho del viewport (`max-w-full` o equivalente).

El padding interno de los formularios montados dentro de drawers/modales SHALL ser responsive, de modo que en mobile no se sume al padding del shell hasta apretar los inputs.

#### Scenario: Un menú o popover no desborda en mobile

- **WHEN** un usuario abre un dropdown-menu, un popover o el date-picker en un viewport de 320px
- **THEN** el panel del overlay se mantiene dentro del viewport (no genera scroll horizontal)
- **AND** conserva un margen respecto a los bordes del viewport

#### Scenario: El form de un drawer no se aprieta en mobile

- **WHEN** un usuario abre el drawer de alta/edición de cuenta o el modal de recurrencias en un viewport de 360px
- **THEN** el padding interno del form es reducido respecto a desktop
- **AND** los inputs y botones del form se renderizan a ancho usable sin recortarse

### Requirement: Las superficies densas colapsan a una columna en mobile

Las superficies de datos densas —grids tipo tabla y grids multi-columna— SHALL reducir su número de columnas en mobile para evitar el aplastamiento. En particular: la cuenta corriente de Compartido (grid tipo tabla) SHALL presentar sus filas de forma legible en mobile sin recortar columnas clave; los grids de columnas fijas (`grid-cols-3` de cuotas en curso, `grid-cols-2` del form de tarjeta, `grid-cols-6` del icon-picker) SHALL colapsar a una (o menos) columnas en mobile mediante breakpoint; los headers de tarjeta con `flex-row` forzado SHALL apilar en mobile cuando su contenido no quepa en una fila.

Las columnas laterales del módulo Tarjetas que hoy se activan en `md` SHALL activarse recién en `lg`, para no apretujar el contenido en tablets (420–768px).

Ningún ancho fijo de columna o etiqueta (`w-[Npx]`, `min-w-[...]`) ni `whitespace-nowrap` SHALL provocar recorte o desbordamiento en mobile; donde lo provoque, SHALL volverse fluido o permitir wrap.

#### Scenario: La cuenta corriente de Compartido es legible en mobile

- **WHEN** un usuario abre la cuenta corriente de Compartido en un viewport de 360px
- **THEN** las filas se presentan de forma legible (apiladas o con columnas reducidas) sin recortar la información clave
- **AND** no hay scroll horizontal ni etiquetas que se salgan del viewport

#### Scenario: Los grids de columnas fijas colapsan en mobile

- **WHEN** un usuario abre la vista de cuotas en curso (Tarjetas), el form de alta de tarjeta o el icon-picker (Ajustes) en un viewport de 360px
- **THEN** el grid se muestra con menos columnas que en desktop (colapsado para mobile)
- **AND** los textos y montos de cada celda se leen completos sin recortarse

#### Scenario: Los CardHeader forzados a fila apilan en mobile

- **WHEN** un usuario carga el dashboard (incluidos sus estados de carga/skeleton) en un viewport de 360px
- **THEN** los headers de tarjeta cuyo título y monto no caben en una fila se apilan verticalmente
- **AND** el navegador de mes muestra el mes completo sin recortarlo
