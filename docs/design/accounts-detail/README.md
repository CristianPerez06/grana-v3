# Propuesta de UI para detalle de cuenta

## Contexto

La ruta `/accounts/[id]` ya tiene buena base funcional: header de cuenta, balance ARS/USD, reintegros pendientes, link condicional de agregar moneda, filtros compartidos y listado con running balance. El problema principal es de jerarquia visual. La pantalla actual queda en una columna angosta (`max-w-2xl`) y mezcla bloques de naturaleza distinta al mismo nivel: identidad, acciones, reintegros, filtros y movimientos.

## Observaciones

- El ancho actual funciona en mobile, pero desperdicia escritorio para una vista tipo ledger.
- El CTA de agregar transaccion vive en el titulo de la seccion, lejos del balance y de la identidad de cuenta.
- El running balance podria ganar legibilidad como columna dedicada en escritorio, manteniendo el comportamiento actual de ocultarse cuando hay filtros de contenido.

## Propuesta actual

El archivo [account-detail-proposals.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/accounts-detail/account-detail-proposals.html) consolida una sola direccion:

- **Desktop**: toma la opcion A como base (`Cuenta como centro operativo`).
- **Mobile**: toma la opcion C como base (`hero compacto y bloques apilados`).
- **Restriccion**: no agrega informacion nueva. Solo reordena datos que la ruta ya tiene hoy en pantalla: identidad, institucion/tipo, balances, editar, reintegros pendientes, agregar moneda, agregar transaccion, filtros, movimientos, running balance y empty/loading states.

## Recomendacion

Implementaria esta propuesta como una evolucion responsive del route actual: hero ancho + aside en desktop, hero compacto + bloques apilados bajo `md`.

## Archivos de trabajo

- [web/account-detail.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/accounts-detail/web/account-detail.html) — mock web con desktop y mobile responsive.
- [mobile/account-detail.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/accounts-detail/mobile/account-detail.html) — mock de app mobile nativa.
- [components/route-shell.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/accounts-detail/components/route-shell.html)
- [components/account-header.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/accounts-detail/components/account-header.html)
- [components/pending-reimbursements.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/accounts-detail/components/pending-reimbursements.html)
- [components/add-currency-link.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/accounts-detail/components/add-currency-link.html)
- [components/movement-section-header.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/accounts-detail/components/movement-section-header.html)
- [components/movement-filters.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/accounts-detail/components/movement-filters.html)
- [components/movement-row.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/accounts-detail/components/movement-row.html)
- [components/movement-list.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/accounts-detail/components/movement-list.html)
- [components/empty-state.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/accounts-detail/components/empty-state.html)
- [components/loading-state.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/accounts-detail/components/loading-state.html)
