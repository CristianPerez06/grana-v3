## REMOVED Requirements

### Requirement: El dashboard muestra un teaser de las categorías que más pesan

**Reason**: El rediseño del dashboard retira la sección "En qué se fue" de la pantalla de inicio en ambas plataformas. El desglose por categoría queda con **una sola superficie**: la portada del módulo Movimientos, que ya lo ofrece completo (donut + ranking + navegación por mes + drill-down al listado filtrado). Mantener un teaser en el dashboard duplicaba la lectura y competía por espacio con las cuatro respuestas que la pantalla de inicio sí da (cuánto tengo, cuánto gasté, qué se viene, cómo estoy con el hogar).

La capability **no se elimina** ni se reduce: pierde una superficie espejada, no funcionalidad. Los requirements que gobiernan el desglose en Movimientos —el peso neto por moneda, el donut más ranking, el drill, la navegación por mes y el tratamiento de los movimientos compartidos— quedan intactos.

**Migration**: Ninguna para el usuario: la lectura completa sigue en Movimientos, que ya era el destino del link "Ver desglose" del teaser. En código, se dan de baja los componentes de la dona del dashboard en las dos plataformas y las claves i18n que solo ellos usaban. `getMonthCategoryBreakdown` **sigue siendo consumido por el dashboard**: es la fuente del gasto devengado del mes que alimenta el tile "Gastaste" de la card "Cuánto gastaste", de modo que el cálculo neto-por-moneda de esta capability sigue siendo el que determina ese número. La invariante de que dashboard y Movimientos derivan del mismo cálculo se conserva por esa vía.
