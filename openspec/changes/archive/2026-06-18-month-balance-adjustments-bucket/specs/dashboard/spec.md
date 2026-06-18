## MODIFIED Requirements

### Requirement: La sección "Balance del mes" muestra el neto del mes con barras de ingresos y gastos

La sección "Balance del mes" SHALL mostrar, para el mes seleccionado en el navegador compartido: un eyebrow "BALANCE" y debajo el neto ARS del mes en tipografía grande con signo y color (positivo → emerald, negativo → terracota/expense); debajo, dos filas Ingresos y Gastos, cada una con dot de color + label + monto y una barra horizontal proporcional.

Los movimientos `type='adjustment'` (ajustes de saldo) SHALL contabilizarse en un **balde propio** separado de Ingresos y Gastos. Un ajuste de saldo es una corrección del stock, no un flujo: NO SHALL sumarse a "Ingresos" (cuando es positivo) ni a "Gastos" (cuando es negativo). En consecuencia, la fila "Gastos" SHALL reflejar únicamente gasto real (`type='expense'`) y SHALL coincidir con el total de "En qué se fue" para el mismo mes y moneda (salvo el neteo de reintegros propio de esa card). El neto del mes (`finalBalance`) y el saldo acumulado SHALL seguir incluyendo el efecto de los ajustes, de modo que el neto reconcilie con el cambio del Disponible: `finalBalance = totalIncome − totalExpense + totalAdjustment`.

Cuando el mes seleccionado tenga al menos un ajuste de saldo (neto distinto de cero), la sección SHALL mostrar una fila adicional "Ajustes" con el mismo tratamiento visual que Ingresos/Gastos (dot + label + monto + barra horizontal proporcional), en un color propio (`warning`/ámbar) para distinguirla. El monto SHALL mostrarse con su signo (el neto puede ser negativo). Cuando el mes NO tenga ajustes (neto cero), la fila "Ajustes" NO SHALL renderizarse, para no ensuciar la card del usuario que nunca ajusta.

La barra de "Ajustes" SHALL compartir la escala con las barras de Ingresos/Gastos: el ancho de las tres se calcula contra el mismo `maxFlow = max(totalIncome, totalExpense, |totalAdjustment|)`, usando el valor absoluto del neto de ajustes para el ancho. Los anchos NO SHALL hardcodearse.

Debajo de la fila "Ajustes", y solo cuando esa fila se muestra, la sección SHALL renderizar un **aviso educativo** (voz Grana, texto atenuado) que comunique que los ajustes son grana que se movió sin registrar y que la meta es hacerlos desaparecer registrando esos movimientos. El texto SHALL salir del catálogo i18n (`dashboard.month.adjustment_note`), sin string hardcodeado.

El header de la card SHALL mostrar a la derecha del título la línea "vas {neto} este mes" referida **siempre al mes en curso** (no sigue al selector: ancla el contexto de hoy mientras se navegan meses pasados), con el monto coloreado por signo y enmascarable por el eye-mask. El dato SHALL salir del mes actual ya disponible (web: server-rendered; nativo: el cache de TanStack del primer load) sin fetch adicional.

Los anchos de las barras SHALL calcularse de los datos: la magnitud mayor entre Ingresos, Gastos y `|Ajustes|` ocupa el 100% del track y las otras escalan proporcionalmente (`magnitud / maxFlow`); con todas en cero, las barras quedan vacías. Los anchos NO SHALL hardcodearse. Ingresos usa el color emerald; Gastos el terracota; Ajustes el `warning`/ámbar.

Al pie, un strip USD SHALL mostrar el chip "USD", el neto USD del mes con signo y color, y el detalle "Ingresos US$X · Gastos US$Y". El strip SHALL mostrarse siempre (bimoneda por defecto: sin actividad USD muestra ceros). ARS y USD nunca se combinan ni convierten.

Los datos SHALL salir de `getMonthBalanceSeries` (totales por moneda, incluyendo `totalAdjustment`). La sección NO SHALL renderizar el gráfico de línea acumulada en ninguna plataforma: `MonthBalanceChart` no existe ni en `apps/web` ni en `apps/mobile` (la serie diaria sigue disponible en el package para vistas futuras). Todos los importes participan del eye-mask. El cálculo considera solo transacciones confirmadas (los consumos `pending` de tarjeta no entran), igual que siempre.

#### Scenario: Neto positivo con barras proporcionales

- **WHEN** el mes seleccionado tiene ingresos ARS $800.000 y gastos ARS $295.500,25 y sin ajustes de saldo
- **THEN** el neto muestra `+$504.499,75` en emerald
- **AND** la barra de Ingresos ocupa el 100% del track y la de Gastos ~36,9%
- **AND** la fila "Ajustes" NO se renderiza
- **AND** el strip USD muestra el neto USD del mes con su detalle de ingresos y gastos

#### Scenario: Gastos mayores que ingresos invierten la proporción

- **WHEN** el mes tiene ingresos ARS $100.000 y gastos ARS $250.000
- **THEN** el neto muestra `−$150.000` en tono expense
- **AND** la barra de Gastos ocupa el 100% y la de Ingresos el 40%

#### Scenario: Los ajustes no inflan Ingresos ni Gastos y se muestran en su balde

- **WHEN** el mes seleccionado tiene gasto real ARS $254.461,25, ingreso real ARS $7.349.361,79, ajustes que restan saldo por ARS $3.152.222,01 y ajustes que suman saldo por ARS $615.610,22
- **THEN** la fila "Gastos" muestra `$254.461,25` (solo gasto real, sin los ajustes)
- **AND** la fila "Ingresos" muestra `$7.349.361,79` (solo ingreso real)
- **AND** la fila "Ajustes" se muestra con el neto `−$2.536.611,79` y una barra ámbar proporcional (su ancho contra `maxFlow = $7.349.361,79`)
- **AND** debajo de las barras aparece el aviso educativo (voz Grana) desde `dashboard.month.adjustment_note`
- **AND** el neto del mes es `$4.558.288,75` (= ingresos − gastos + ajustes), idéntico al cambio del Disponible

#### Scenario: El total de Gastos coincide con "En qué se fue"

- **WHEN** el mes tiene gasto real categorizado y además ajustes de saldo
- **THEN** el "Gastos" de "Balance del mes" refleja solo el gasto real
- **AND** coincide con el total de "En qué se fue" del mismo mes y moneda (modulo el neteo de reintegros de esa card)

#### Scenario: Mes sin movimientos muestra ceros

- **WHEN** el mes seleccionado no tiene movimientos confirmados
- **THEN** el neto muestra `$0` y ambas barras quedan vacías
- **AND** la fila "Ajustes" NO se renderiza
- **AND** el strip USD muestra `US$0` con ingresos y gastos en cero

#### Scenario: El header de la card ancla el neto del mes en curso

- **WHEN** el usuario va `+$504.499,75` en el mes en curso y navega el selector a un mes anterior
- **THEN** el header de la card sigue mostrando "vas +$504.499,75 este mes" (mes en curso) mientras el cuerpo muestra el mes navegado
- **AND** activar el eye-mask enmascara ese monto

#### Scenario: Consumo en tarjeta no impacta el balance

- **WHEN** el usuario registra un consumo de $30.000 en su tarjeta en el mes
- **THEN** los totales del mes NO reflejan ese consumo
- **AND** cuando el usuario pague el resumen correspondiente, ese pago (sobre cash/bank) sí entra como gasto en la fecha del pago

#### Scenario: El chart de línea no existe en ninguna app

- **WHEN** se busca `MonthBalanceChart` en `apps/web` y `apps/mobile`
- **THEN** el componente no existe en ninguna de las dos apps

### Requirement: El eye toggle enmascara todos los importes del dashboard

El sistema SHALL exponer en el header del dashboard un botón "ojo" que, al activarse, reemplaza visualmente todos los importes numéricos del dashboard por un placeholder genérico (`••••••` o equivalente) sin alterar los datos subyacentes. El estado del eye toggle SHALL ser client-side y SHALL NOT persistir entre sesiones ni navegaciones fuera del dashboard (en nativo, salir del tab y volver lo resetea vía remount del provider).

En **ambas plataformas**, el toggle SHALL aplicar al menos a: Hero "Para gastar · hoy" (importes ARS y USD), card "Dónde está" (saldos por cuenta y fila "En dólares"), "Balance del mes" (neto, ingresos, gastos, la línea "Ajustes" cuando se muestre, strip USD y la línea "vas {neto} este mes" del header de la card) y "En qué se fue" (montos de la leyenda y total del centro de la dona — los porcentajes NO se enmascaran).

En **web**, el `eye toggle` SHALL permanecer montado y visible mientras el header esté en su estado de carga (query del nombre sin resolver), pero SHALL renderizarse **disabled** durante ese estado: no SHALL responder a clicks ni modificar el estado del `EyeMaskProvider`. Cuando el header sale del estado de carga, el toggle SHALL pasar a su comportamiento normal. El `eye toggle` SHALL implementarse en web usando el UI `Button` con `variant="ghost"` y `size="icon"` (no como `<button>` artesanal) para reusar foco accesible, cursor y estilos de disabled.

#### Scenario: Activar el toggle enmascara todos los importes

- **WHEN** el usuario está en `/dashboard` con todos los importes visibles y toca el botón "ojo"
- **THEN** todos los importes numéricos visibles se reemplazan por `••••••`
- **AND** los labels, fechas, categorías y porcentajes permanecen visibles

#### Scenario: El eye-mask cubre la línea de Ajustes cuando se muestra

- **WHEN** el mes seleccionado tiene ajustes (la fila "Ajustes" está visible) y el usuario activa el eye toggle
- **THEN** el monto neto de "Ajustes" también se enmascara junto al resto de los importes

#### Scenario: Salir del dashboard y volver resetea el toggle

- **WHEN** el usuario activa el toggle, navega a `/accounts` (web) o cambia de tab y vuelve (nativo)
- **THEN** los importes están visibles nuevamente (estado no persistido)

#### Scenario: El toggle está montado pero disabled mientras el header carga (web)

- **WHEN** el header del dashboard está en su estado de carga
- **THEN** el `eye toggle` aparece en su posición habitual con el ícono visible
- **AND** está deshabilitado: clickearlo NO cambia el estado del `EyeMaskProvider`

#### Scenario: El eye toggle web está implementado sobre el UI Button

- **WHEN** un desarrollador inspecciona el componente `EyeMaskToggle` en `apps/web`
- **THEN** delega el render en el UI `Button` con `variant="ghost"` y `size="icon"`
- **AND** NO es un `<button>` artesanal con clases tailwind ad-hoc
