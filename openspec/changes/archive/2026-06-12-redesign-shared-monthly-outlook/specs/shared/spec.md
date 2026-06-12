## MODIFIED Requirements

### Requirement: El usuario puede ver el dashboard del hogar

El sistema SHALL ofrecer una pantalla de hogar (home de Compartido) organizada por **mes**, con un navegador de mes (`‹ mes ›`) que comparte el patrón del dashboard. Para el mes seleccionado, la pantalla SHALL mostrar:

- **Balance / decisión:** el gasto compartido total del mes ("Gastaron juntos") y la deuda neta por moneda en lenguaje claro ("le debés a X", "X te debe" o "están al día"), con un acceso a saldar deuda cuando hay deuda viva. La deuda se presenta con `text-expense` (debés) / `text-income` (te deben), nunca en rojo. La **bimoneda** (ARS + USD) se muestra siempre, sin fusionar monedas, integrada en las secciones de balance (USD inline, no en una fila aparte).
- **Próximos compromisos:** una proyección de lo que entra cuando venza cada resumen/cuota futura, derivada por mes (la misma deuda derivada evaluada con `asOf` corrido a cada mes), en cards mensuales; los planes de cuotas largos se agrupan.
- **En qué gastaron:** el desglose del gasto compartido del mes por categoría (con su color de categoría), con cada categoría navegable a sus gastos, separado por moneda. Es una lectura del gasto compartido; reutiliza el sistema de desglose existente.
- **Últimos movimientos:** la lista de movimientos compartidos del mes, presentados con el **mismo formato del módulo Movimientos** (`MovementRow`): ícono de categoría, título, taxonomía **categoría › subcategoría**, chips de estado (incl. reintegro), y monto con tono `income`/`expense`.

La pantalla SHALL ofrecer el **alta de movimiento** mediante el `Button` de la librería (CTA primary en el header en web; FAB `size="fab"` en mobile), y el acceso a **Configuración del hogar** como **ícono** (no como texto). El bloque de **integrantes del hogar** NO se muestra en la home; vive en `/shared/settings`.

#### Scenario: El balance de hoy refleja lo impactado y la proyección explica el futuro

- **WHEN** en el mes corriente hay un consumo compartido de tarjeta que vence el mes próximo y un reintegro "a cuenta" recibido sobre él
- **THEN** el balance de hoy refleja el reintegro impactado (p. ej. "X te debe $7.713"), sin esconderlo
- **AND** "Próximos compromisos" muestra el saldo neto acumulado al mes del resumen (p. ej. "Julio · le debés $43.284")

#### Scenario: Navegar a un mes futuro muestra su proyección

- **WHEN** el usuario mueve el navegador de mes a julio
- **THEN** ve los compromisos que entran en julio (resúmenes de tarjeta y cuotas) con su monto

#### Scenario: Ver en qué se gastó por categoría

- **WHEN** un usuario abre la home con gastos compartidos en el mes
- **THEN** ve el desglose por categoría del gasto compartido del mes
- **AND** al tocar una categoría navega a los gastos que la componen

#### Scenario: Los integrantes no están en la home

- **WHEN** un usuario abre la home de Compartido
- **THEN** no ve el bloque de integrantes en la home
- **AND** los integrantes se listan en Configuración del hogar
