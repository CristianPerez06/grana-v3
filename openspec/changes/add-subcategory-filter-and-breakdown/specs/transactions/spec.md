# Delta — Filtro y breakdown por subcategoría

## ADDED Requirements

### Requirement: El usuario puede filtrar movimientos por subcategoría dentro de una categoría

El sistema SHALL aceptar un filtro opcional de subcategoría (`subcategoryId`) en `/transactions`, que se activa exclusivamente cuando hay una `categoryId` seleccionada. El filtro SHALL serializarse al URL como `?subcategory=<uuid>` o, para tx sin subcategoría asignada, como `?subcategory=__none__`.

`parseMovementFilters` SHALL descartar silenciosamente cualquier `subcategory` que llegue sin `category` (el filtro no tiene sentido sin la categoría madre como prerrequisito). `hasContentFilters` SHALL retornar `true` cuando `subcategoryId` está seteado, para que el running balance per-row se oculte. `buildMovementLimitHref` SHALL preservar `subcategory` al cambiar el limit de paginación.

#### Scenario: Filtrar por subcategoría dentro de una categoría

- **WHEN** el usuario está en `/transactions?month=2026-05&category=cat-comida` y elige la subcategoría "Almuerzo"
- **THEN** el URL pasa a `/transactions?month=2026-05&category=cat-comida&subcategory=subcat-almuerzo`
- **AND** la lista muestra solo movimientos con `category_id = cat-comida` y `subcategory_id = subcat-almuerzo`
- **AND** aparece un chip activo "Subcategoría: Almuerzo" con un botón de clear

#### Scenario: Filtrar por "Sin subcategoría"

- **WHEN** el usuario filtra por categoría "Comida" y luego selecciona "Sin subcategoría" del filtro
- **THEN** el URL agrega `&subcategory=__none__`
- **AND** la lista muestra solo movimientos de Comida con `subcategory_id IS NULL`

#### Scenario: Cambio de categoría limpia la subcategoría

- **WHEN** el usuario tiene filtros `category=cat-comida&subcategory=subcat-almuerzo` y cambia la categoría a `cat-transporte`
- **THEN** el sistema actualiza el URL a `category=cat-transporte` sin `subcategory`
- **AND** el filtro de subcategoría queda vacío y muestra las subcategorías de Transporte

#### Scenario: URL con `subcategory` sin `category` se ignora

- **WHEN** el usuario llega a `/transactions?subcategory=subcat-x` (sin `category`)
- **THEN** `parseMovementFilters` descarta el param y la URL se trata como si no tuviera filtro de subcategoría
- **AND** no se aplica ningún filtro `.eq('subcategory_id', ...)` en la query

### Requirement: El filtro de subcategoría se renderea solo cuando hay categoría seleccionada

El componente `movement-filters.tsx` SHALL renderear un select de subcategoría debajo del select de categoría, condicional a que `filters.categoryId` esté seteado. Las opciones SHALL ser solo las subcategorías de la categoría activa. La opción "Sin subcategoría" SHALL estar disponible como una opción explícita (mapea al marker `__none__`).

#### Scenario: Sin categoría seleccionada, el filtro de subcategoría no aparece

- **WHEN** el usuario abre el sheet de filtros sin tener categoría seleccionada
- **THEN** el select de subcategoría no se muestra

#### Scenario: Con categoría seleccionada, el filtro lista solo subcategorías de esa categoría

- **WHEN** el usuario seleccionó la categoría "Comida"
- **THEN** el select de subcategoría aparece y lista las subcategorías de Comida (p. ej. "Desayuno", "Almuerzo", "Cena") + una opción "Sin subcategoría"

### Requirement: `buildSubcategorySlices` está disponible en `@grana/money-logic`

El paquete `@grana/money-logic` SHALL exportar una función `buildSubcategorySlices(input: SubcategorySliceInput[])` que retorne `{ total: number, slices: Array<SubcategorySliceInput & { percentage: number }> }`. La función SHALL ordenar por `value` descendente, calcular percentages que sumen 100, y aceptar un slice con `subcategoryId: null` que representa el bucket "Sin subcategoría".

#### Scenario: Construcción de slices con bucket "Sin subcategoría"

- **WHEN** se llama `buildSubcategorySlices([{ subcategoryId: 'a', value: 60, ...}, { subcategoryId: null, value: 40, ... }])`
- **THEN** retorna `{ total: 100, slices: [{ id: 'a', percentage: 60, ... }, { id: null, percentage: 40, ... }] }`
- **AND** los slices están ordenados por value descendente

### Requirement: El componente "En qué se fue" muestra desglose por subcategoría cuando hay exactamente una categoría filtrada

`CategorySpendingOverview` SHALL aceptar un prop `mode: 'category' | 'subcategory'`. Cuando `mode='subcategory'`, el componente SHALL:

- Mostrar el título dinámico "En qué se fue dentro de **<categoría>**" usando la i18n key `transactions.breakdown.title_with_category` con interpolación del nombre de la categoría activa.
- Usar `buildSubcategorySlices` en lugar de `buildCategorySlices` para construir los slices del donut y del ranking.
- Renderear el slice "Sin subcategoría" (cuando existe value > 0) con label de `transactions.breakdown.no_subcategory_slice` y color neutral gris (distinto de los colores de subcategorías reales).
- Mantener el footer "Sin contar consumos en tarjeta sin pagar" idéntico al `mode='category'`.

`/transactions/page.tsx` SHALL resolver `mode='subcategory'` cuando hay exactamente UN `categoryId` activo Y NO hay `subcategoryId` activo. En cualquier otro caso, `mode='category'`.

#### Scenario: Filtro por una sola categoría activa el breakdown por subcategoría

- **WHEN** el usuario está en `/transactions?month=2026-05&category=cat-comida`
- **THEN** el componente "En qué se fue" muestra el título "En qué se fue dentro de **Comida**"
- **AND** los slices del donut y el ranking listan subcategorías de Comida con sus percentages

#### Scenario: Filtro por categoría + subcategoría vuelve al breakdown por categoría

- **WHEN** el usuario está en `/transactions?category=cat-comida&subcategory=subcat-almuerzo`
- **THEN** el componente "En qué se fue" usa `mode='category'` y muestra el título genérico
- **AND** los slices se calculan con `buildCategorySlices` (que va a tener una sola slice — Comida — porque el filtro ya restringe a esa categoría)

#### Scenario: Sin filtro de categoría, breakdown por categoría como hoy

- **WHEN** el usuario no tiene filtro de categoría activo
- **THEN** el componente usa `mode='category'`, título genérico, slices por categoría — comportamiento idéntico al previo a este change

### Requirement: El click en un slice de subcategoría aplica el filtro de subcategoría

Cuando el componente está en `mode='subcategory'`, el `<Link>` de cada slice del donut y de cada fila del ranking SHALL armar un href que preserve los filtros activos (`month`, `currency`, `category`) y agregue `subcategory=<id>` — usando el marker `__none__` para el slice "Sin subcategoría".

#### Scenario: Drill-down desde slice de subcategoría real

- **WHEN** el usuario está en `/transactions?month=2026-05&category=cat-comida` y hace click en el slice "Almuerzo" del donut
- **THEN** el browser navega a `/transactions?month=2026-05&category=cat-comida&subcategory=subcat-almuerzo&currency=ARS`
- **AND** la lista se filtra a las tx de esa subcategoría

#### Scenario: Drill-down desde "Sin subcategoría"

- **WHEN** el usuario hace click en el slice "Sin subcategoría"
- **THEN** el href agrega `&subcategory=__none__`
- **AND** la lista filtra a tx de la categoría activa con `subcategory_id IS NULL`
