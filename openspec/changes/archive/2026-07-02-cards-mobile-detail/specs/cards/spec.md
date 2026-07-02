## ADDED Requirements

### Requirement: La ruta de detalle de tarjeta nativa (mobile) muestra el overview read-only del ciclo de vida

La app mobile SHALL exponer una ruta `/cards/[id]` nativa que renderiza el detalle de una tarjeta de crédito consumiendo el read layer y el builder puro de `@grana/cards` — los reads `getCreditCardDetail` / `getCardPeriods` / `getActiveInstallments` (parametrizados por el client nativo) y `resolveCardDetailState({ cardDetail, periods, installments, todayISO })` — sin re-derivar el view-model ni re-implementar los reads en `apps/mobile/lib/`.

La ruta SHALL renderizar las cuatro ramas del discriminated union que devuelve `resolveCardDetailState`: `not-found` (tarjeta inexistente o no `credit`), `new-card` (sin historial → estado informativo, **sin** CTA de registro de primer consumo), `archived-empty` (archivada sin pendientes → estado informativo), y `active` (overview). El overview activo SHALL mostrar: el timeline del ciclo de vida seleccionable (a pagar / en curso / próximo), el monto a pagar y los días a vencimiento, el total en curso, el próximo cierre, el panel de límite, y las cuotas en curso.

En v1 la ruta SHALL ser **read-only**: NO SHALL ofrecer pago de resumen, edición de tarjeta, edición de fechas de período, edición o borrado de cuotas, ni registro de primer consumo. El componente de "a pagar" SHALL ser display-only (monto + días a vencimiento, sin acción de pago) y el header NO SHALL exponer edición.

La ruta NO SHALL mostrar el pane de movimientos por período (bloqueado hasta que exista un primitivo de lista de movimientos nativo) y, por lo tanto, SHALL omitir el control segmentado movimientos/cuotas del detalle web, mostrando las cuotas en curso inline. Las rutas anidadas web (`/cards/[id]/periods` y el detalle de un resumen) quedan fuera de v1.

El header chrome (`PageHeader` + back-link) SHALL estar visible desde el primer paint, con placeholder en el título mientras cargan los datos y sin skeleton de pantalla completa. Los componentes de presentación nativos SHALL espejar por nombre y props públicas a los del detalle web, con implementación RN idiomática y sin JSX compartido, consumiendo `CardDetailViewModel` de `@grana/cards`.

#### Scenario: Tocar una tarjeta del wallet abre su detalle nativo

- **WHEN** el usuario toca una tarjeta en el wallet mobile
- **THEN** navega a `/cards/[id]` y la pantalla nativa carga el detalle de esa tarjeta
- **AND** el detalle se deriva invocando `resolveCardDetailState` de `@grana/cards`, sin re-derivar el ciclo `apagar`/`curso`/`prox` a mano

#### Scenario: El detalle activo muestra el overview read-only

- **WHEN** una tarjeta activa con historial se abre en la ruta nativa
- **THEN** la pantalla muestra el timeline del ciclo de vida, el monto a pagar con días a vencimiento (display-only), el total en curso, el próximo cierre, el panel de límite y las cuotas en curso
- **AND** no presenta ninguna acción de escritura (ni pago, ni edición de tarjeta/fechas/cuotas, ni alta de consumo)

#### Scenario: Tarjeta sin historial muestra estado informativo sin CTA de escritura

- **WHEN** una tarjeta sin consumos (rama `new-card`) se abre en la ruta nativa
- **THEN** la pantalla muestra un estado informativo
- **AND** NO ofrece el CTA de registro de primer consumo (v1 es read-only)

#### Scenario: El detalle nativo omite el pane de movimientos y el segmented

- **WHEN** se renderiza el overview activo en la ruta nativa v1
- **THEN** NO se muestra el pane de movimientos por período ni el control segmentado movimientos/cuotas
- **AND** las cuotas en curso se muestran inline

#### Scenario: Id inexistente o cuenta no-credit resuelve a no encontrado

- **WHEN** la ruta nativa recibe un `id` que no corresponde a una tarjeta de crédito del usuario
- **THEN** `resolveCardDetailState` devuelve `kind: 'not-found'` y la pantalla muestra un estado de no encontrado
- **AND** el header chrome permanece visible
