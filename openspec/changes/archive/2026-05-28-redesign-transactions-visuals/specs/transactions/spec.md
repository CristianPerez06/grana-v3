# Delta — Rediseño visual del módulo Movimientos

## MODIFIED Requirements

### Requirement: La fila de movimiento muestra ícono de categoría, jerarquía y color semántico

El sistema SHALL renderizar cada fila de movimiento con la siguiente anatomía visual:

- **Ícono** según dos familias: los movimientos categorizables (ingreso, gasto, compra en cuotas) SHALL mostrar el emoji y color de su categoría; los movimientos de estructura (transferencia, cambio de moneda, ajuste, pago de resumen) SHALL mostrar un ícono neutro propio de su tipo.
- **Jerarquía** de texto invertida: el título primario SHALL ser la descripción que escribió el usuario; el subtítulo secundario SHALL ser la categoría y, cuando el usuario tiene dos o más cuentas, la cuenta (`categoría · cuenta`). Si el movimiento no tiene descripción, el título primario SHALL caer a la categoría o al nombre funcional del tipo.
- **Color del monto** semántico, expresado mediante tokens editoriales y no colores Tailwind crudos:
  - **Income** (ingreso, reintegro recibido, ajuste positivo) → `text-income` (alias de la paleta emerald del repo).
  - **Expense** (gasto en cash/bank, consumo de tarjeta, cuota de tarjeta, pago de resumen, ajuste negativo) → `text-expense` (terracota editorial, token nuevo `#B56A5A`). NO usar `text-red-*` crudo.
  - **Neutro** (transferencia, cambio de moneda) → `text-neutral-amount` (alias del color de texto primario navy).
  - **Pendiente** (reintegro esperado, no recibido) → `text-pending` (alias del muted), distinguible visualmente del income real para no transmitir confianza que el ingreso aún no ocurrió.
- **Etiqueta de moneda** fiel al principio bimoneda: ARS no SHALL llevar etiqueta de moneda (es la primaria); USD SHALL mostrarse etiquetada.

La cuenta en el subtítulo SHALL mostrarse únicamente cuando el usuario tiene dos o más cuentas; con una sola cuenta se omite.

#### Scenario: Un gasto muestra el color de expense terracota

- **WHEN** el sistema renderiza un gasto categorizado como "Comida"
- **THEN** la fila muestra el emoji y color de esa categoría como ícono
- **AND** el monto se muestra con el token `text-expense` (terracota, no rojo Tailwind crudo)

#### Scenario: Un reintegro pendiente se distingue del income real

- **WHEN** el sistema renderiza un reintegro con `received_at IS NULL` (esperado, no recibido)
- **THEN** el monto se muestra con `text-pending` (gris muted)
- **AND** la fila incluye la etiqueta "esperado" debajo del monto

#### Scenario: Una transferencia muestra ícono neutro y monto en color neutro

- **WHEN** el sistema renderiza una transferencia
- **THEN** la fila muestra un ícono de estructura neutro (no un emoji de categoría)
- **AND** el monto se muestra con `text-neutral-amount` (no income ni expense)

#### Scenario: La descripción es el título primario

- **WHEN** el usuario registró un gasto "Coto" categorizado como "Comida"
- **THEN** la fila muestra "Coto" como título primario y "Comida" como subtítulo

#### Scenario: Sin descripción el título cae a la categoría

- **WHEN** el sistema renderiza un gasto sin descripción categorizado como "Transporte"
- **THEN** la fila muestra "Transporte" como título primario

#### Scenario: La cuenta en el subtítulo depende de la cantidad de cuentas

- **WHEN** un usuario con dos o más cuentas ve un gasto en el listado global
- **THEN** el subtítulo incluye la cuenta (`categoría · cuenta`)
- **AND** el mismo gasto para un usuario con una sola cuenta muestra solo la categoría

#### Scenario: La etiqueta de moneda respeta bimoneda

- **WHEN** el sistema renderiza un movimiento en ARS y otro en USD
- **THEN** el de ARS no muestra etiqueta de moneda y el de USD se muestra etiquetado como USD

---

### Requirement: La fila de movimiento muestra marcadores de estado

El sistema SHALL mostrar en la fila los marcadores de estado aplicables al movimiento, sin alterar su impacto contable:

- **Recurrencia**: chip con label "Recurrente" e ícono `Repeat` integrado, en color slate (token `--slate`, fondo soft `rgba(58,107,138,0.12)`). El chip se ubica al lado del título primario. Reemplaza el indicador anterior (ícono `Repeat 12px` muted suelto), que se leía demasiado discreto y no se reconocía como patrón. Aplica tanto a movimientos generados por una regla recurrente como a movimientos cuya descripción coincide con un patrón recurrente detectado y confirmado.
- **Revisión**: chip con label corto ("Revisar") e ícono triangular de alerta, en color warning (amber soft).
- **Cuota**: para una cuota de tarjeta, la posición de la cuota (`3/6`) en un chip neutro.
- **Pendiente**: para un consumo de tarjeta cuyo período aún no fue pagado, etiqueta "pendiente" en un chip neutro.

Los marcadores de recurrencia y revisión SHALL aparecer tanto en el listado global como en el de cuenta. Los grupos de fecha del listado SHALL usar etiquetas relativas ("Hoy", "Ayer") y fecha para días anteriores.

#### Scenario: El marcador de recurrencia es un chip con label

- **WHEN** el sistema renderiza un movimiento generado por una regla recurrente
- **THEN** la fila muestra un chip slate con ícono `Repeat` y el texto "Recurrente" al lado del título
- **AND** el chip es claramente reconocible sin tener que pasar el cursor

#### Scenario: Movimiento recurrente y a revisar conservan sus marcadores en ambas vistas

- **WHEN** un gasto generado por una recurrencia y sin categoría se muestra en `/transactions` y en el detalle de su cuenta
- **THEN** en ambas vistas la fila muestra el chip de recurrencia y el chip de revisión

#### Scenario: Una cuota muestra su posición

- **WHEN** el sistema renderiza la tercera cuota de una compra en 6 cuotas
- **THEN** la fila muestra el marcador "3/6"

#### Scenario: Un consumo de tarjeta no pagado se marca pendiente

- **WHEN** el sistema renderiza un consumo de tarjeta cuyo período no fue pagado
- **THEN** la fila muestra el marcador "pendiente"

#### Scenario: Los grupos de fecha usan etiquetas relativas

- **WHEN** el listado agrupa movimientos del día actual, del día anterior y de días previos
- **THEN** los encabezados muestran "Hoy", "Ayer" y la fecha respectivamente

---

### Requirement: El listado global distingue el motivo de un resultado vacío

Cuando el listado global de Movimientos no tiene resultados, el sistema SHALL mostrar un estado vacío acorde al **motivo**, no un único mensaje genérico. SHALL distinguir tres variantes:

- **Sin movimientos** (no hay búsqueda ni filtros de contenido activos): el contenido del estado SHALL ser **contextual al estado del usuario**:
  - Si el usuario nunca registró movimientos en ningún mes (primera vez) → mensaje de bienvenida ("Acá va a aparecer cada peso que se mueva") y acción para registrar el primer movimiento.
  - Si el usuario tiene movimientos en otros meses pero solo navegó a un mes vacío → mensaje contextual al mes ("No registraste nada en {mes} todavía") y la misma acción de registrar, sin el tono de bienvenida.
- **Sin resultados de búsqueda** (hay un término de búsqueda activo): un mensaje que indica que no se encontraron coincidencias y una acción para **limpiar la búsqueda**.
- **Sin resultados de filtro** (hay filtros de contenido activos — tipo, categoría, cuenta, moneda o rango de monto): un mensaje que indica que ningún movimiento cumple los filtros y una acción para **limpiar los filtros**.

La **navegación por mes** NO cuenta como filtro de contenido para esta clasificación (es una ventana temporal, no un filtro): un mes sin movimientos y sin otros filtros SHALL mostrar la variante "sin movimientos" en la sub-variante contextual del mes. El resto —tipo, categoría, cuenta, moneda y rango de monto— SÍ cuenta como filtro. Cuando coexisten búsqueda y filtros, prevalece la variante de **filtro**. Las acciones de limpiar SHALL operar sobre el estado de filtros en la URL (sin recargar la pantalla completa), coherente con la barra de filtros.

#### Scenario: Primera vez del usuario muestra bienvenida

- **WHEN** el usuario abre `/transactions` por primera vez (sin ningún movimiento registrado en ningún mes) sin búsqueda ni filtros activos
- **THEN** el sistema muestra un estado de bienvenida con copy "Acá va a aparecer cada peso que se mueva"
- **AND** la acción abre `/transactions/new`

#### Scenario: Mes vacío con historial previo muestra copy contextual

- **WHEN** el usuario tiene movimientos registrados en otros meses pero navegó a un mes vacío y no tiene filtros activos
- **THEN** el sistema muestra copy contextual "No registraste nada en {mes} todavía"
- **AND** la acción abre `/transactions/new`
- **AND** la copy NO tiene tono de bienvenida (no es la primera vez)

#### Scenario: Búsqueda sin resultados ofrece limpiar la búsqueda

- **WHEN** el usuario tiene un término de búsqueda activo y ninguno de sus movimientos coincide
- **THEN** el sistema indica que no se encontraron resultados para ese término
- **AND** ofrece una acción para limpiar la búsqueda

#### Scenario: Filtros sin resultados ofrecen limpiar los filtros

- **WHEN** el usuario tiene filtros de contenido activos (tipo, categoría, cuenta, moneda o rango de monto) y ningún movimiento los cumple
- **THEN** el sistema indica que ningún movimiento cumple los filtros
- **AND** ofrece una acción para limpiar los filtros

#### Scenario: Un mes vacío no se confunde con un filtro sin resultados

- **WHEN** el usuario navega a un mes sin movimientos y no tiene filtros de contenido activos
- **THEN** el sistema muestra la variante "sin movimientos" en su sub-variante contextual del mes (no la de filtros)

---

## ADDED Requirements

### Requirement: El encabezado de Movimientos es minimalista y pelado

El sistema SHALL renderizar el encabezado de `/transactions` como un `PageHeader` clásico **completamente pelado**: SOLO un título corto "Movimientos" (h1, 24px font-semibold). Sin subtítulo, sin actions slot, sin display de mes, sin links contextuales.

El encabezado **NO SHALL** llevar:
- Display tipográfico grande del mes activo.
- Botones de navegación `‹ ›` para el mes.
- Subtítulo informativo con conteo y monedas.
- Botones primary CTA "Recurrencias" o "Registrar movimiento" a la derecha.
- Link contextual a Recurrencias en el slot de actions o el subtítulo.

Razón: las acciones del listado (buscar, ver recurrencias, filtrar) viven en una **micro-toolbar pegada al listado** especificada en el próximo requirement, donde tienen contexto inmediato con la lista sobre la que operan. El único selector de mes vive dentro del card del `CategorySpendingOverview`. El acceso para registrar pasa por el FAB.

#### Scenario: El encabezado muestra solo el título

- **WHEN** el usuario abre `/transactions`
- **THEN** el encabezado muestra "Movimientos" como h1 (~24px font-semibold)
- **AND** NO aparece debajo ningún subtítulo, link, ni botón

#### Scenario: El encabezado no duplica la navegación por mes

- **WHEN** el sistema renderiza el encabezado de `/transactions`
- **THEN** no aparece ningún display grande del mes ni botones `‹ ›` para navegar mes
- **AND** la navegación por mes única vive dentro del card del breakdown

---

### Requirement: Las acciones del listado viven en una micro-toolbar de íconos circulares

El sistema SHALL renderizar las acciones de operación del listado (buscar, ver recurrencias, abrir filtros) como una **micro-toolbar de íconos circulares** alineada a la derecha, ubicada arriba del listado y debajo del card del breakdown. Inspirada en el patrón v2 (`MovimientosTopBar`), pero desacoplada del bloque del header.

Cada botón SHALL ser un cuadrado redondeado de 36×36px con border sutil (`border-border`, `bg-card`), texto/ícono `text-text-muted` con hover `text-text`. Sin label visible — solo el ícono Lucide y un `aria-label` para accesibilidad. Los tres botones, en orden de izquierda a derecha:

1. **Search** (ícono `Search`): click activa el modo de búsqueda — el botón se transforma en un **input expansible** que ocupa todo el ancho, con un botón "Cancelar" al lado. El input dispara la búsqueda con debounce de 300ms, idéntico al patrón v2. Pulsar Cancelar (o limpiar el texto) vuelve al estado de tres íconos.
2. **Recurrencias** (ícono `Repeat`): link directo a `/transactions/recurring`.
3. **Filtros** (ícono `SlidersHorizontal`): abre el panel de filtros como **sheet desde la derecha** (overlay + panel ~440px). Cuando hay filtros de contenido activos, SHALL mostrar un badge navy circular con el conteo, posicionado absoluto en la esquina superior derecha del ícono.

#### Scenario: La toolbar muestra tres íconos circulares cuando no hay búsqueda activa

- **WHEN** el usuario abre `/transactions` sin término de búsqueda en la URL
- **THEN** la toolbar muestra tres íconos: Search, Repeat (Recurrencias), SlidersHorizontal (Filtros)
- **AND** cada uno es un cuadrado redondeado de 36px con border sutil y solo ícono

#### Scenario: El ícono Search expande a un input full-width

- **WHEN** el usuario hace click en el ícono Search
- **THEN** la toolbar se transforma: el input de búsqueda toma el ancho completo y un botón "Cancelar" aparece al lado
- **AND** el input recibe el foco automáticamente
- **AND** la búsqueda se aplica con debounce de 300ms a la URL

#### Scenario: Cancelar la búsqueda vuelve al estado de tres íconos

- **WHEN** el usuario presiona "Cancelar" en el modo búsqueda
- **THEN** la toolbar vuelve a mostrar los tres íconos
- **AND** el término de búsqueda se borra de la URL si había alguno

#### Scenario: El ícono Recurrencias linkea a la página de gestión

- **WHEN** el usuario hace click en el ícono Repeat
- **THEN** navega a `/transactions/recurring`

#### Scenario: El ícono Filtros abre el sheet desde la derecha

- **WHEN** el usuario hace click en el ícono SlidersHorizontal
- **THEN** se abre un overlay con un panel sheet pegado al borde derecho de la pantalla
- **AND** el panel contiene selectores para tipo, categoría, cuenta (si aplica), moneda y rango de monto
- **AND** un footer con botones "Limpiar todo" y "Aplicar"

#### Scenario: El badge en el ícono Filtros refleja el conteo de filtros activos

- **WHEN** el usuario tiene filtros de contenido activos (tipo, categoría, cuenta, moneda, monto)
- **THEN** sobre el ícono SlidersHorizontal aparece un badge circular navy con el número de filtros activos
- **AND** el badge desaparece cuando no hay filtros activos

---

### Requirement: El listado global muestra un esqueleto de filas durante la carga inicial

Mientras los movimientos del mes activo se cargan desde el servidor, el sistema SHALL mostrar un **skeleton del listado** que respete la grilla del componente final (íconos cuadrados a la izquierda, dos líneas de texto en el centro, monto a la derecha), no un `Spinner` centrado en la pantalla. El skeleton SHALL:

- Mostrar al menos dos grupos de día simulados (por ejemplo, "Hoy" con tres filas y "Ayer" con cuatro filas).
- Usar un color de fondo muted (`bg-muted`) con animación `animate-pulse` para los rectángulos placeholder.
- Mantener el encabezado narrativo, los banners activos, la barra de filtros y el componente "En qué se fue" renderizados con sus datos reales (es decir, el skeleton aplica solo al listado, no a toda la pantalla).

#### Scenario: La carga inicial del listado muestra skeleton, no Spinner

- **WHEN** el usuario abre `/transactions` y el listado aún no terminó de hidratarse
- **THEN** la zona del listado muestra dos day groups skeleton con filas placeholder animadas
- **AND** el encabezado narrativo y el componente "En qué se fue" se renderizan con sus datos reales

#### Scenario: El skeleton respeta la anatomía de la fila

- **WHEN** el skeleton se renderiza
- **THEN** cada fila placeholder tiene la misma estructura visual que una fila real (cuadrado de ícono 40x40 + dos líneas de texto + monto a la derecha)

---

### Requirement: El componente de gastos por categoría usa la variante híbrida donut + ranking compacto y respeta off-ledger

El componente `CategorySpendingOverview` que actúa como carta de presentación del módulo en `/transactions` SHALL renderizar la variante **híbrida donut grande + ranking compacto**:

- Un donut estático de aproximadamente 200px de diámetro con stroke ancho (~32px), renderizado en SVG puro sin librería de charts y sin animación de entrada. Los segmentos del donut representan las categorías del ranking en sus colores definidos en los tokens (`--cat-1` a `--cat-5`, con `--cat-5` o un color secundario para "otros").
- En el centro del donut, un bloque tipográfico con un eyebrow ("GASTADO"), el monto total del mes en la moneda activa con tipografía display tabular, y una caption con el conteo de categorías ("en 8 categorías").
- A la derecha del donut, un **ranking compacto** de hasta cinco filas, **una línea por categoría** (sin meta line apilada). Cada fila SHALL llevar:
  - Un dot del color de la categoría correspondiente al segmento del donut.
  - El emoji y nombre de la categoría.
  - El porcentaje sobre el total, alineado a la derecha del nombre.
  - El monto de la categoría con tipografía tabular, alineado a la derecha del porcentaje.
- Una sexta fila colapsada agrega las categorías restantes ("+ N categorías más · {monto}"), si las hay, con el mismo layout de una sola línea.
- Un footer con la nota explícita del principio off-ledger ("Sin contar consumos en tarjeta sin pagar"). NO SHALL renderizar un link "Ver el detalle →" salvo que exista un destino real al cual drill-downear (hoy: ninguno; la prop queda opcional para reintroducirlo cuando se construya la vista expandida).

El componente SHALL mantener el switcher ARS/USD y SHALL renderizar la navegación por mes como **flechitas `‹ ›` a los lados del label del mes** ("‹ Mayo 2026 ›"), siguiendo el patrón que el módulo `spending-by-category` ya tenía. Las flechitas SHALL preservar la moneda activa en la URL al navegar de un mes a otro. **El header de la pantalla `/transactions` NO SHALL duplicar esta navegación**: el único selector de mes de la pantalla vive dentro de este card.

#### Alcance del "Gastado" — off-ledger respetado

El cálculo del breakdown SHALL excluir cualquier expense que viva en una cuenta `type='credit'` (consumos directos y cuotas hijas, todos con `card_period_id IS NOT NULL`). Esos consumos son **off-ledger**: no afectan el `disponible` del usuario hasta que se paga el resumen, y el donut titulado "Gastado" SHALL reflejar fielmente lo que efectivamente salió del disponible.

Como **trabajo diferido** (no scope de este change): cuando se paga un resumen, el monto pagado SHOULD distribuirse entre las categorías de los consumos que ese pago cubrió, atribuyéndolas al mes del pago. La query actual también excluye los pagos de resumen del breakdown (vía `period_payments?.length > 0`), por lo cual el card spending hoy **no aparece** ni cuando devenga ni cuando se paga; el TODO en `getMonthCategoryBreakdown` documenta el walk pendiente.

#### Scenario: El componente muestra donut + ranking compacto

- **WHEN** el usuario tiene movimientos del mes con cinco o más categorías
- **THEN** el componente renderiza un donut de aproximadamente 200px con cinco segmentos coloreados
- **AND** el centro del donut muestra el total del mes
- **AND** a la derecha del donut hay un ranking de cinco filas, una sola línea por fila, con dot + emoji + nombre + porcentaje + monto

#### Scenario: El footer informa la regla off-ledger sin prometer drill-down inexistente

- **WHEN** el componente se renderiza
- **THEN** el footer incluye explícitamente "Sin contar consumos en tarjeta sin pagar"
- **AND** NO renderiza un link "Ver el detalle →" mientras no exista una vista expandida real a la que llevar al usuario

#### Scenario: El donut es estático

- **WHEN** el componente se renderiza inicialmente
- **THEN** los segmentos del donut aparecen en su estado final sin animación de entrada
- **AND** el componente no aplica animaciones decorativas en hover ni en cambio de moneda

#### Scenario: La sexta fila colapsa las categorías restantes

- **WHEN** el ranking tiene seis o más categorías
- **THEN** las primeras cinco se listan individualmente
- **AND** la sexta fila agrega las restantes en "+ N categorías más" con su porcentaje y monto en la misma fila

#### Scenario: El breakdown excluye gastos en cuentas de tarjeta

- **WHEN** el usuario tiene consumos directos o cuotas hijas con `card_period_id NOT NULL` en el mes activo
- **THEN** esos rows NO contribuyen al total ni a ningún slice del donut
- **AND** un mes que solo tiene actividad de tarjeta SHALL mostrar el empty state del componente
