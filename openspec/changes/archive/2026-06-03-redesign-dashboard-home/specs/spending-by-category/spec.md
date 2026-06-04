# spending-by-category — Delta (redesign-dashboard-home)

## MODIFIED Requirements

### Requirement: El dashboard muestra un teaser de las categorías que más pesan

La presencia del desglose de gastos por categoría en el dashboard difiere por plataforma. El desglose **completo** (donut + ranking + drill) SHALL seguir viviendo en Movimientos en ambas plataformas; el dashboard nunca lo reemplaza.

En **web**, el dashboard SHALL mostrar la sección "En qué se fue": una dona con los gastos del mes por categoría (`topN: 5` + bucket "Otros"), leyenda con **montos** y porcentajes, y toggle ARS/USD. Su contrato detallado vive en la spec de `dashboard` (requirement "La sección 'En qué se fue' muestra el desglose de gastos por categoría con dona y toggle de moneda (web)"). A diferencia del teaser anterior, esta sección SÍ muestra importes y por lo tanto SÍ participa del eye-mask del dashboard; sus filas linkean al desglose completo en Movimientos. El teaser web de 3 categorías deja de existir.

En **mobile**, el dashboard SHALL seguir mostrando el teaser con las **3 categorías que más pesan** del mes, que enlaza al desglose completo en Movimientos. El teaser NO SHALL ser el desglose completo. Por cada categoría: su `icon + label`, una **barra de proporción** y el **porcentaje**. El teaser mobile SHALL mostrar proporciones, NO montos — por lo tanto NO participa del eye-mask. Si no hay gasto del mes (cero slices), el teaser mobile NO SHALL renderizarse.

En ambas plataformas, el peso y el orden de las categorías SHALL derivarse del mismo cálculo neto-por-moneda del desglose completo (vía `buildCategorySlices` sobre `getMonthCategoryBreakdown`), de modo que dashboard y Movimientos muestren los mismos porcentajes ante los mismos datos.

#### Scenario: La sección web muestra montos y linkea al desglose (web)

- **WHEN** el usuario ve "En qué se fue" en el dashboard web
- **THEN** ve la dona y la leyenda con monto y porcentaje por categoría
- **AND** al tocar una fila o el link "Ver desglose" llega al desglose completo en Movimientos
- **AND** el eye-mask del dashboard enmascara los montos (no los porcentajes)

#### Scenario: Mismos porcentajes que el desglose completo

- **WHEN** el dashboard y el desglose de Movimientos se calculan sobre los mismos datos del mes
- **THEN** ambos muestran los mismos porcentajes por categoría (mismo cálculo neto por moneda)

#### Scenario: El teaser se renderiza en el dashboard mobile (mobile)

- **WHEN** un usuario con gastos del mes abre el dashboard en la app nativa
- **THEN** el teaser se renderiza al final del dashboard (después de "Balance del mes")
- **AND** muestra hasta 3 categorías con barra de proporción y porcentaje
- **AND** NO muestra importes en pesos ni dólares (el eye-mask no lo afecta)
- **AND** el link "Ver desglose" del header navega a Movimientos mobile (`/transactions`); el cuerpo del card no es pressable
- **AND** mientras el desglose completo no exista en Movimientos mobile, el destino es la lista de movimientos (decisión transitoria documentada en código)

#### Scenario: Sin gastos del mes el teaser no aparece (mobile)

- **WHEN** el usuario no tuvo gastos en el mes
- **THEN** el teaser mobile no se renderiza (cero slices)
- **AND** el resto del dashboard mobile renderiza normalmente
