# spending-by-category — Delta (dashboard-mobile-parity)

## MODIFIED Requirements

### Requirement: El dashboard muestra un teaser de las categorías que más pesan

El dashboard SHALL mostrar en **ambas plataformas** (web y nativo) la sección "En qué se fue": una dona con los gastos del mes por categoría (`topN: 5` + bucket "Otros"), leyenda con **montos** y porcentajes, y toggle ARS/USD. Su contrato detallado vive en la spec de `dashboard` (requirement "La sección 'En qué se fue' muestra el desglose de gastos por categoría con dona y toggle de moneda"). La sección muestra importes y por lo tanto SÍ participa del eye-mask del dashboard; sus filas y el link "Ver desglose" llevan al desglose completo en Movimientos. El desglose **completo** (donut + ranking + drill) sigue viviendo en Movimientos; el dashboard nunca lo reemplaza.

El teaser de proporciones de 3 categorías (el formato anterior del dashboard) dejó de existir en ambas plataformas (`redesign-dashboard-home` en web, `dashboard-mobile-parity` en nativo).

El peso y el orden de las categorías SHALL derivarse del mismo cálculo neto-por-moneda del desglose completo (vía `buildCategorySlices` sobre `getMonthCategoryBreakdown`), de modo que dashboard y Movimientos muestren los mismos porcentajes ante los mismos datos.

#### Scenario: La sección muestra montos y linkea al desglose

- **WHEN** el usuario ve "En qué se fue" en el dashboard (web o nativo)
- **THEN** ve la dona y la leyenda con monto y porcentaje por categoría
- **AND** al tocar una fila o el link "Ver desglose" llega al desglose completo en Movimientos
- **AND** el eye-mask del dashboard enmascara los montos (no los porcentajes)

#### Scenario: Mismos porcentajes que el desglose completo

- **WHEN** el dashboard y el desglose de Movimientos se calculan sobre los mismos datos del mes
- **THEN** ambos muestran los mismos porcentajes por categoría (mismo cálculo neto por moneda)

#### Scenario: El teaser de proporciones no existe en ninguna plataforma

- **WHEN** se busca `CategoryTeaser` en `apps/web` y `apps/mobile`
- **THEN** el componente no existe en ninguna de las dos apps
