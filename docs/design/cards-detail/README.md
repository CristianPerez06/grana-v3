# Propuesta de UI para detalle de tarjeta

## Contexto

La ruta `/cards/[id]` ya tiene un modelo de producto fuerte: no muestra una tarjeta como objeto estático, sino como ciclo de vida de resúmenes (`A pagar`, `En curso`, `Próximo`). Esta propuesta no cambia esa lógica. El objetivo es alinear la presentación con el sistema visual que ya quedó más pulido en `/accounts`, `/accounts/[id]`, `/dashboard` y `/cards`.

El cambio principal recomendado es de layout: el detalle hoy vive en una columna `max-w-3xl`; para escritorio conviene darle más aire y separar mejor la zona de ciclo/resúmenes de los panes operativos. En mobile, las cards deben apilar nombre, montos, fechas y acciones para evitar líneas comprimidas.

## Inventario real

Datos disponibles:

- Back link a `/cards`.
- Identidad de la tarjeta: nombre, banco/emisor, acento visual, monograma y pill de estado.
- Acciones de header: `Registrar consumo` y editar con ícono, solo cuando la tarjeta está activa.
- Estado nueva tarjeta sin historial: copy de "Tu tarjeta está lista" y CTA `Registrar primer consumo`.
- Estado archivada sin pendientes: banner/acción de reactivar, texto de archivada sin pendientes y metadatos.
- Timeline de ciclo: `Pagado`, `A pagar`, `En curso`, `Próximo`, con fechas de cierre/vencimiento y selección.
- Hero `Resumen a pagar`: monto ARS, monto USD subordinado, cierre, vencimiento, countdown y CTA `Registrar pago`.
- Card `En curso`: monto ARS/USD, badge live, movimientos, cuotas del ciclo, fecha de cierre, días restantes y progreso del ciclo.
- Mini row `Próximo`: fecha, nota de cuotas comprometidas, monto ARS y selección.
- Panel de límite: usado/total/%/disponible o CTA `Cargar límite`.
- Tabs: `Movimientos del período` y `Cuotas en curso · N`.
- Pane movimientos: lista compartida de movimientos con chips de cuotas y empty state.
- Pane cuotas: intro con total restante, cards por compra en cuotas, progreso y footer de stats; empty state.
- Link único `Ver todos los resúmenes →`.
- Footer admin: fecha de alta y fecha de archivado si aplica.
- Loading state de header + period cards.

Componentes reales:

- `CardDetailLayout`
- `CardDetailPage`
- `EditCardDrawerProvider`
- `CardDetailHeader`
- `CardHeaderActions`
- `CardActions`
- `RegisterFirstPurchaseButton`
- `CardDetailView`
- `LifecycleTimeline`
- `PayHeroCard`
- `EnCursoCard`
- `ProximoMiniRow`
- `CardLimitPanel`
- `Segmented`
- `PeriodMovementsPane`
- `CuotasEnCursoPane`
- `CardDetailsSection`
- `CardDetailLoading`

## Recomendación

Mantendría el modelo actual. Los ajustes propuestos:

- Ampliar desktop a un ancho cercano a `1080px`, como dashboard y account detail, en vez de una única columna angosta.
- Mantener el header compuesto como excepción válida a `PageHeader`, pero en mobile separar avatar + pill de título/banco/acciones para que un nombre largo no comprima el pill ni los botones.
- En desktop, usar dos zonas: contenido principal (`timeline`, cards de resumen, tabs/panes) y una columna secundaria para límite, próximo período y metadatos cuando aporte escaneo. No agregar datos nuevos.
- Mantener `Resumen a pagar` como hero terracota cuando exista. Es correcto que no use navy: la prioridad semántica es deuda/vencimiento, no identidad.
- Cuando no hay `A pagar`, `En curso` puede ser el hero de acento, igual que hoy, pero con el mismo ritmo de padding/radios que las nuevas cards.
- En mobile, apilar en cada card: eyebrow/estado, monto, metadata, acción. No poner CTA, countdown y monto en una misma línea.
- En mobile, reemplazar el timeline horizontal por una rail vertical dentro de una card `Ciclo del resumen`. El usuario debe ver `A pagar`, `En curso` y `Próximo` sin deslizar horizontalmente; cada fila sigue siendo seleccionable y muestra su fecha.
- El panel de movimientos debería conservar el ancho suficiente para que las filas del ledger respiren en desktop.

No propongo nuevos datos, nuevas acciones, nuevas métricas ni nuevas queries.

## Nota de alcance mobile

Actualmente no existe una pantalla nativa `/cards/[id]` en `apps/mobile`. Este bundle incluye un mock mobile-web responsive para el detalle web. Si más adelante se implementa detalle nativo, debe ser una implementación React Native paralela, no JSX compartido.

## Archivos de trabajo

- [web/card-detail.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/cards-detail/web/card-detail.html) - mock web desktop.
- [mobile/card-detail.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/cards-detail/mobile/card-detail.html) - mock mobile-web.
- [components/route-shell.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/cards-detail/components/route-shell.html)
- [components/card-header.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/cards-detail/components/card-header.html)
- [components/lifecycle-timeline.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/cards-detail/components/lifecycle-timeline.html)
- [components/pay-hero-card.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/cards-detail/components/pay-hero-card.html)
- [components/en-curso-card.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/cards-detail/components/en-curso-card.html)
- [components/limit-panel.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/cards-detail/components/limit-panel.html)
- [components/movements-pane.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/cards-detail/components/movements-pane.html)
- [components/installments-pane.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/cards-detail/components/installments-pane.html)
- [components/empty-state.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/cards-detail/components/empty-state.html)
- [components/loading-state.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/cards-detail/components/loading-state.html)
