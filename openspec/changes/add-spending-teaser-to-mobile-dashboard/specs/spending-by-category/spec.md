# Delta — Teaser de categorías en el dashboard (paridad mobile)

## MODIFIED Requirements

### Requirement: El dashboard muestra un teaser de las categorías que más pesan

El dashboard SHALL mostrar un teaser con las **3 categorías que más pesan** del mes, que enlaza al desglose completo en Movimientos. El teaser NO SHALL ser el desglose completo (ese vive en Movimientos).

El teaser SHALL mostrarse en **ambas plataformas** (web y mobile) con el mismo contrato: por cada categoría, su `icon + label`, una **barra de proporción** y el **porcentaje** que representa. El teaser SHALL mostrar proporciones, NO montos — por lo tanto NO participa del eye-mask del dashboard. Si no hay gasto del mes (cero slices), el teaser NO SHALL renderizarse.

El peso y el orden de las categorías del teaser SHALL derivarse del mismo cálculo neto-por-moneda del desglose completo (vía `buildCategorySlices` con `topN: 3` sobre el breakdown del mes), de modo que web y mobile muestren las mismas 3 categorías y los mismos porcentajes ante los mismos datos.

#### Scenario: El teaser linkea al desglose

- **WHEN** el usuario ve el teaser de categorías en el dashboard
- **THEN** ve las 3 categorías que más pesan del mes
- **AND** al tocarlo llega al desglose completo en Movimientos

#### Scenario: El teaser muestra proporciones, no montos

- **WHEN** el usuario ve el teaser de categorías
- **THEN** cada categoría muestra una barra de proporción y su porcentaje
- **AND** NO muestra importes en pesos ni dólares
- **AND** el eye-mask del dashboard no lo afecta (no hay montos que enmascarar)

#### Scenario: El teaser se renderiza en el dashboard mobile (mobile)

- **WHEN** un usuario con gastos del mes abre el dashboard en la app nativa
- **THEN** el teaser se renderiza al final del dashboard (después de "Balance del mes")
- **AND** muestra hasta 3 categorías con barra de proporción y porcentaje
- **AND** al tocarlo navega a Movimientos mobile (`/transactions`); mientras el desglose completo no exista en Movimientos mobile, el destino es la lista de movimientos (decisión transitoria documentada en código)

#### Scenario: Sin gastos del mes el teaser no aparece (mobile)

- **WHEN** el usuario no tuvo gastos en el mes
- **THEN** el teaser no se renderiza (cero slices)
- **AND** el resto del dashboard mobile renderiza normalmente
