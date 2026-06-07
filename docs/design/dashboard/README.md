# Propuesta de UI para dashboard

## Contexto

La ruta `/dashboard` ya tiene una composición sólida y especificada: header persistente desde `layout.tsx`, contenido por secciones con `Suspense`, skeletons shape-matched y paridad web/mobile. Esta propuesta no reemplaza ese comportamiento. Su objetivo es normalizar el handoff visual bajo `docs/design/route-ui-system.md` y ajustar los puntos donde el dashboard puede quedar visualmente desalineado con `/accounts` y `/accounts/[id]`.

## Inventario real

Datos disponibles:

- Header: saludo con nombre o fallback, fecha contable de hoy, selector de mes, eye toggle y acción desktop `Nuevo movimiento`.
- Hero "Para gastar · hoy": saldo disponible total ARS, saldo disponible total USD y caption.
- Card "Dónde está": hasta 6 cuentas activas `cash`/`bank`, avatar, nombre, saldo ARS, fila agregada "En dólares" con saldo USD total y link `Ver todas`.
- Card "Balance del mes": neto ARS del mes seleccionado, ingresos ARS, gastos ARS, balance USD, ingresos USD, gastos USD, y texto "vas {neto} este mes" anclado al mes actual.
- Card "En qué se fue": dona por categoría, total, ranking de categorías, monto, porcentaje, link `Ver desglose` y toggle ARS/USD.
- Estados: skeletons por sección, error por sección, error de ruta y empty del desglose de gastos.
- Mobile/web: misma composición; web usa fila superior de dos columnas en desktop, mobile apila las secciones.

Componentes reales:

- `DashboardLayout`
- `DashboardHeader`
- `DashboardContent`
- `DashboardErrorBoundary`
- `HeroSectionContainer`
- `HeroSection`
- `AccountsCard`
- `MonthBalanceSectionContainer`
- `MonthBalanceSection`
- `SpendingSectionContainer`
- `SpendingSection`
- `MonthNavigator`
- `EyeMaskToggle`
- `QuickAddFab`
- `HeroSkeleton`
- `MonthBalanceSkeleton`
- `SpendingSkeleton`
- `RouteError`

## Recomendación

Mantendría la arquitectura actual del dashboard. La mejora principal es visual/responsive:

- Mantener el hero navy como ancla del dashboard. Ya expresa bien ARS primario + USD secundario y conecta con el lenguaje del detalle de cuenta.
- Normalizar headers de cards: título sobrio, acciones a la derecha en desktop, acciones apiladas debajo del título en mobile cuando compitan por espacio.
- Rehacer las filas de "Dónde está" en mobile con el mismo criterio que `/accounts`: identidad arriba y saldo debajo. Un nombre largo no debe competir con un importe grande.
- Mantener "Balance del mes" y "En qué se fue" como cards de resumen, porque el dashboard sí tiene permiso de sintetizar datos.
- Crear este bundle como handoff vigente; el handoff anterior `docs/design/design_handoff_dashboard_inicio/` queda como referencia histórica del rediseño original.

No propongo agregar totales nuevos, filtros nuevos, acciones nuevas ni queries nuevas.

## Dirección visual

Desktop: conservar la fila superior `Para gastar` + `Dónde está`, pero hacer que la card de cuentas use filas más cercanas a `/accounts`: avatar cuadrado, nombre truncado, ARS tabular y USD como fila subordinada existente.

Mobile: usar una sola columna. El header puede seguir compacto, pero las cards con acciones deben poder partirse en dos líneas. "Dónde está" usa filas apiladas para evitar el problema de nombre largo + importe grande en la misma línea.

## Archivos de trabajo

- [web/dashboard.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/dashboard/web/dashboard.html) - mock web desktop.
- [mobile/dashboard.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/dashboard/mobile/dashboard.html) - mock mobile nativo.
- [components/route-shell.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/dashboard/components/route-shell.html)
- [components/dashboard-header.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/dashboard/components/dashboard-header.html)
- [components/hero-section.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/dashboard/components/hero-section.html)
- [components/accounts-card.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/dashboard/components/accounts-card.html)
- [components/month-balance-section.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/dashboard/components/month-balance-section.html)
- [components/spending-section.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/dashboard/components/spending-section.html)
- [components/loading-state.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/dashboard/components/loading-state.html)
- [components/error-state.html](/Users/cristian.perez.aero/src/personal/grana-v3/docs/design/dashboard/components/error-state.html)
