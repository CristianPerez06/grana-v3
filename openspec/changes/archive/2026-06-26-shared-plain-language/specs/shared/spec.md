## ADDED Requirements

### Requirement: Las superficies visibles de Compartido usan lenguaje llano, sin jerga contable

El sistema SHALL nombrar las superficies y los rótulos visibles del módulo Compartido en **castellano natural, sin jerga contable**, de modo que un usuario sin background financiero entienda qué hace cada pantalla y de dónde sale cada número. El **modelo interno** (libro derivado por moneda, contraasiento, deuda en reloj de impacto) y la **ruta** `/shared/cuenta-corriente` NO forman parte de este requisito: son internos y pueden conservar su nomenclatura de dominio.

En particular: el acceso desde el hub SHALL llamarse en términos de la acción ("ver el detalle"), no del objeto interno ("cuenta corriente"); la dirección de la deuda SHALL expresarse como una relación entre personas ("le debés a {name}" / "{name} te debe" / "están al día"), no con fórmulas ("a favor de"); los términos de asiento ("liquidación", "contraasiento", "importe", "ecuación") SHALL presentarse en su equivalente llano ("pago", "anulación", "monto", "desglose"), de forma **consistente** (un mismo concepto, una sola palabra en toda la superficie). El término **"reintegro"** SHALL conservarse (es preciso y conocido por la base de usuarios).

#### Scenario: El acceso desde el hub se nombra por la acción

- **WHEN** el usuario ve la franja de deuda en el hub de Compartido
- **THEN** el acceso a la pantalla de detalle se rotula como "Ver el detalle" (no "Cuenta corriente")

#### Scenario: La dirección de la deuda se lee como relación entre personas

- **WHEN** hay deuda viva en una moneda
- **THEN** la dirección se expresa como "le debés a {name}" o "{name} te debe", no como "a favor de"

#### Scenario: Un mismo concepto usa una sola palabra

- **WHEN** la pantalla menciona una liquidación en cualquier punto (filtro, agregado, aviso, confirmación)
- **THEN** usa siempre "pago" (nunca mezcla "liquidación" y "pago" para el mismo concepto)

## MODIFIED Requirements

### Requirement: El usuario puede ver el dashboard del hogar

El sistema SHALL ofrecer una pantalla de hogar (home de Compartido) organizada por **mes**, con un navegador de mes (`‹ mes ›`). El navegador **gobierna solo la actividad del mes** (gasto y desglose): la **deuda y la proyección NO dependen del navegador** — son "hoy" (deuda neta a hoy; proyección siempre desde hoy hacia adelante). Para el mes seleccionado, la pantalla SHALL mostrar:

- **Hero "Gasto del hogar · neto":** el **neto protagonista** (`gastaron − reintegros`) en grande, con el bruto y los reintegros como dato secundario al costado. El gasto se cuenta en base **DEVENGADO** (por fecha de compra; cada cuota en su mes), total del hogar (ambas partes). Bimoneda siempre visible (USD subordinado). Debajo, **"En qué gastaron"**: el desglose por categoría en ARS y USD con **drill inline conservado** (tocar una categoría despliega sus movimientos sin navegar fuera).
- **Deuda fuera del hero:** la deuda neta por moneda vive en una **franja/tile propia fija en "hoy"** (no en el hero navegable), en lenguaje claro ("le debés a X" / "X te debe" / "están al día"), con accesos a **Saldar** (cuando hay deuda viva) y a **Ver el detalle** (la pantalla de cuenta corriente). El acceso se rotula por la acción, no por el objeto interno. Presentada con `text-expense`/`text-income`, nunca en rojo.
- **Lo que se viene:** tile de proyección (derivada con `asOf` corrido a cada mes), independiente del navegador.
- **Últimos movimientos:** la lista de movimientos compartidos del mes con el formato de `MovementRow`.

La pantalla SHALL ofrecer el **alta de movimiento** (CTA primary en web; FAB en mobile) y el acceso a **Configuración del hogar** como ícono. Los integrantes NO se muestran en la home.

#### Scenario: El navegador mueve solo la actividad, no la deuda ni la proyección

- **WHEN** el usuario cambia el navegador de mes
- **THEN** cambian el gasto del mes y su desglose
- **AND** la deuda (de hoy) y la proyección (desde hoy) NO cambian

#### Scenario: El neto es protagonista

- **WHEN** el mes tiene gastos y reintegros compartidos
- **THEN** el hero muestra el neto en grande y el bruto/reintegros como dato secundario

#### Scenario: La deuda vive fuera del hero, en "hoy"

- **WHEN** hay deuda viva
- **THEN** se muestra en una franja propia (no en el hero navegable) con accesos a Saldar y Ver el detalle

#### Scenario: Ver en qué se gastó por categoría, en ambas monedas

- **WHEN** un usuario abre la home con gastos compartidos devengados en ARS y USD
- **THEN** ve el desglose por categoría en ambas monedas, con drill inline por categoría

#### Scenario: Los integrantes no están en la home

- **WHEN** un usuario abre la home de Compartido
- **THEN** no ve el bloque de integrantes; viven en Configuración del hogar

### Requirement: El usuario puede ver la cuenta corriente del hogar

El sistema SHALL ofrecer una pantalla (`/shared/cuenta-corriente`) que presenta la deuda entre los dos miembros como un **libro derivado** (nunca persistido), **por moneda**. De cara al usuario, la pantalla se titula en **lenguaje llano** ("Las cuentas entre ustedes") con un subtítulo que la auto-explica ("quién pagó qué y cómo queda el saldo; nada se borra"); "cuenta corriente" se conserva solo como nombre de dominio interno y de ruta. La pantalla SHALL mostrar: (a) el **saldo actual** por moneda (ARS y USD siempre visibles, nunca fusionadas), con la dirección expresada como relación entre personas ("le debés a X" / "X te debe" / "están al día"); (b) un **desglose** colapsable "Cómo llegamos a este saldo" con los agregados en castellano natural (lo que pagó uno por el otro, lo que el otro pagó por uno, reintegros y pagos, = saldo); (c) un **extracto** cronológico (más reciente arriba) donde cada asiento muestra fecha, movimiento, **"qué cambia"** en castellano natural, **monto firmado** y **saldo corriente**; (d) un divisor **"Hoy"** y un tramo **"Lo que se viene"** con la proyección por mes. El extracto se deriva de los mismos splits y liquidaciones que la deuda; el **saldo final del extracto SHALL igualar** la deuda derivada (`householdDebtAt`).

#### Scenario: El extracto deriva el saldo corriente

- **WHEN** el hogar tiene gastos compartidos, reintegros y liquidaciones en una moneda
- **THEN** la pantalla lista cada asiento con su monto firmado y un saldo corriente
- **AND** el saldo del asiento más reciente iguala la deuda neta derivada de esa moneda

#### Scenario: El desglose explica el saldo

- **WHEN** el usuario abre la pantalla
- **THEN** ve los agregados (lo que pagó uno por el otro, lo que el otro pagó por uno, reintegros y pagos) que suman el saldo actual
- **AND** puede colapsar/expandir el desglose

#### Scenario: Bimoneda siempre visible en la pantalla de detalle

- **WHEN** hay saldo en una sola moneda
- **THEN** la otra moneda sigue visible (aunque sea cero), sin fusionarse

#### Scenario: La pantalla se auto-explica con lenguaje llano

- **WHEN** un usuario sin background financiero abre la pantalla
- **THEN** el título y el subtítulo le dicen qué ve ("las cuentas entre ustedes" / "quién pagó qué y cómo queda el saldo"), sin requerir conocer el término "cuenta corriente"
