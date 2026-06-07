# Propuesta de UI para cuentas

## Contexto

La ruta `/accounts` es una ruta de lista RSC con dos secciones cargadas por `Suspense`: cuentas activas y cuentas archivadas. El header vive en el layout de `/accounts` y solo se renderiza en la raíz; su acción abre el drawer de crear cuenta cuando las instituciones ya fueron cargadas.

La propuesta no agrega resúmenes, totales globales, métricas ni acciones nuevas. Solo reorganiza y afina la jerarquía de los elementos que la ruta ya muestra hoy.

## Inventario real

Datos disponibles:

- Título de ruta: `Cuentas`.
- Acción primaria: `Crear cuenta`, deshabilitada mientras cargan instituciones para el drawer.
- Cuentas activas de tipo `cash` y `bank`, agrupadas en `Efectivo` y `Cuentas bancarias`.
- Cuentas archivadas, agrupadas en `Archivadas` y renderizadas solo si existen.
- Cantidad de cuentas por sección, derivada de `accounts.length` dentro de cada `AccountSection`.
- Por cuenta: nombre, tipo, institución opcional, monedas activas, balance ARS, balance USD, avatar resuelto, estado activo/archivado y `has_transactions`.
- Hint de primer uso, condicional: se muestra solo cuando hay exactamente una cuenta activa y el usuario no lo descartó en `localStorage`.
- Empty state cuando no hay cuentas activas.
- Loading por sección: skeleton de activas y skeleton de archivadas.
- Error por sección con `SectionFallback`, y error de ruta con `AccountsErrorBoundary` + `RouteError`.

Componentes reales:

- `AccountsLayout`
- `AccountsHeader`
- `AccountsErrorBoundary`
- `ActiveAccountsContainer`
- `ArchivedAccountsContainer`
- `AccountsEditDrawerProvider`
- `AccountsHint`
- `AccountSection`
- `AccountRow`
- `AccountRowMenu`
- `CreateAccountButton`
- `EmptyAccountsState`
- `ActiveAccountsSkeleton`
- `ArchivedAccountsSkeleton`
- `SectionFallback`
- `RouteError`

## Dirección

Desktop: una ruta de lista tranquila, con header compacto y secciones escaneables. Las cuentas activas son la superficie principal; archivadas queda visualmente subordinada con borde punteado, tal como ocurre hoy.

Mobile: una columna nativa, con el CTA cerca del título y filas de cuenta que priorizan legibilidad. En filas angostas, identidad, badge, metadato y balances se apilan para que un nombre largo o el badge `Archivada` no compitan con montos como `$ 100.000,00`. No se agregan columnas ni resúmenes; la acción de cada fila sigue siendo el menú de acciones.

## Notas de implementación futura

- Mantener ARS como balance primario y USD como secundario.
- No sumar ni convertir monedas.
- Mantener `Button` para `Crear cuenta` y para el CTA del empty state.
- No convertir el hint en onboarding obligatorio; hoy es dismissible y client-only.
- Si se propone un total global por moneda, filtros, búsqueda, ordenamiento o resumen por tipo, eso requiere cambio de producto/query y OpenSpec antes de implementarse.

## Archivos de trabajo

- [web/accounts.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/accounts/web/accounts.html) - mock web desktop.
- [mobile/accounts.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/accounts/mobile/accounts.html) - mock mobile nativo.
- [components/route-shell.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/accounts/components/route-shell.html)
- [components/accounts-header.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/accounts/components/accounts-header.html)
- [components/create-account-button.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/accounts/components/create-account-button.html)
- [components/accounts-hint.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/accounts/components/accounts-hint.html)
- [components/active-accounts-section.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/accounts/components/active-accounts-section.html)
- [components/archived-accounts-section.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/accounts/components/archived-accounts-section.html)
- [components/account-row.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/accounts/components/account-row.html)
- [components/row-menu-actions.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/accounts/components/row-menu-actions.html)
- [components/empty-accounts-state.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/accounts/components/empty-accounts-state.html)
- [components/loading-state.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/accounts/components/loading-state.html)
- [components/error-state.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/accounts/components/error-state.html)
