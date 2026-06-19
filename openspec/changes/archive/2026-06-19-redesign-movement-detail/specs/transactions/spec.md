## MODIFIED Requirements

### Requirement: El usuario puede ver el detalle de una transacción

El sistema SHALL exponer una pantalla de detalle `/transactions/[txId]` para cada movimiento, que muestre toda la información asociada al movimiento (campos según su `kind`), las cuotas hermanas cuando es una compra en cuotas (madre o hija), los reintegros vinculados cuando corresponde, y la regla recurrente que lo generó cuando aplica. La pantalla SHALL respetar el origen de navegación (`?from=account:<id>` o `?from=card:<id>`) para resolver el destino del "Volver".

La **presentación visual** SHALL seguir una **anatomía fija** que se adapta al tipo, con tres bloques:

- **TOPBAR**: a la izquierda un botón "Volver" (ícono `←` + label "Movimientos") que resuelve al destino del back; a la derecha las acciones disponibles. En este alcance las acciones son **Editar** (botón sólido navy) y **Eliminar** (icon button, hover en tono peligro), reusando los handlers existentes (`TxActionsMenu`: Editar abre el drawer de edición en contexto cuando está disponible, o navega a `[txId]/edit`; Eliminar abre el `AlertDialog` con copy contextual). En **mobile** la topbar es sticky, las acciones secundarias colapsan en un menú "···" y **Editar** pasa a una **barra fija inferior** full-width (thumb-reach).
- **HERO**: una tarjeta con banda superior tintada por el tono del tipo (`radial-gradient` con `--tone-soft`). Contiene el **ícono de categoría** en un cuadro redondeado tintado (88px desktop / 72px mobile), un **título** (descripción o categoría del movimiento), el **monto grande** tonal (60px desktop / 46px mobile) con el currency symbol más chico y opaco y los decimales según `showCents`, una **línea de contexto** (ej. "Gasto · pago único en efectivo"), y una fila de **chips**: `fecha` · `medio de pago` · `categoría` · `subcategoría`. Para transferencias el hero lleva además un eyebrow "Transferencia interna" sobre el título.
- **GRILLA "de un vistazo"**: tiles en cards blancos (radius ~20px) en **2 columnas desktop / 1 columna mobile** que **cambian por tipo**. El tile **"Peso en el mes"** SHALL ir **siempre al final** (primero el detalle del movimiento, después el contexto del mes).

El color del monto/hero (tone) lo define el **tipo**, seteado con una clase en el contenedor raíz:

- gasto → terracotta (`--terracota`), signo `−` (U+2212).
- ingreso → emerald-deep (`--emerald-deep`), signo `+`.
- transferencia → slate (`--slate`), **sin signo**.

Los **tiles por tipo** SHALL ser:

- **gasto simple**: Pagado con · Detalle (fecha) · Descripción · Peso en el mes.
- **cuotas**: En cuotas (barra de pagadas/restantes + próxima + fin) · Pagado con · Detalle (total + valor cuota) · Descripción · Peso en el mes.
- **compartido**: Te toca pagar (tu parte) · Pagado con · Dividido entre (personas con su parte, **sin** badge de estado de liquidación) · Detalle · Descripción.
- **reintegro**: Resultado neto (pagaste + reintegro = costo neto, con el movimiento vinculado clickeable) · Pagado con · Detalle · Descripción.
- **recurrencia**: Recurrencia (próximo cobro · activa desde · nº de cobros) · Pagado con (acumulado) · Historial de cobros (barras de los últimos 6 meses) · Descripción.
- **ingreso**: Acreditado en · Detalle (origen) · Descripción · Peso del mes (% de ingresos).
- **transferencia**: Movimiento (origen → destino) · callout "no cuenta como gasto ni ingreso" · Detalle · Descripción.

**Reglas de negocio** que la presentación SHALL respetar:

- App de gestión, **NO** opera pagos: NUNCA mostrar número de tarjeta; solo **nombre + tipo** del medio de pago.
- Los movimientos guardan **solo fecha** (sin hora).
- No existe estado "confirmado": el detalle SHALL mostrar un estado **solo cuando informa algo real** — *Reintegrado* (reintegro recibido), *Completada* (transferencia), *Acreditado* (ingreso).
- Las **transferencias no afectan el balance del mes** (no son gasto ni ingreso); el callout lo explicita.
- El campo de texto libre se rotula **"Descripción"** (no "Nota").

La lógica de qué campos mostrar por kind, el manejo de cuotas hermanas, los reembolsos vinculados y el back navigation NO cambia — preserva el comportamiento de datos del componente actual. El **banner de recurrencia** (link a la regla) se mantiene en el layout de la página (`page.tsx`), arriba del hero.

#### Scenario: El detalle se abre y muestra los campos correctos según el kind

- **WHEN** el usuario abre `/transactions/[txId]` de un gasto categorizado en una cuenta cash
- **THEN** el detalle muestra el hero con tone gasto (terracotta), monto con signo `−`, ícono de la categoría con bg tintado, título y línea de contexto, y los chips fecha · medio de pago · categoría · subcategoría
- **AND** la grilla muestra los tiles "Pagado con", "Detalle", "Descripción" (si la tiene) y "Peso en el mes" al final
- **AND** el botón "Volver" resuelve al destino que indica `?from=` o, por defecto, a `/transactions`

#### Scenario: Compra en cuotas muestra el tile de progreso de cuotas

- **WHEN** el usuario abre el detalle de una compra en cuotas (madre o hija)
- **THEN** el hero muestra la descripción de la compra y el monto total
- **AND** un tile "En cuotas" muestra la barra de cuotas pagadas/restantes, el valor por cuota, la próxima fecha y la fecha de fin
- **AND** un tile "Detalle" muestra el total de la compra y el desglose `n × valor cuota`

#### Scenario: Gasto con reintegro muestra el resultado neto

- **WHEN** el usuario abre el detalle de un gasto con uno o más reintegros recibidos
- **THEN** un tile "Resultado neto" muestra `pagaste` + `reintegro` = `costo neto`
- **AND** lista el/los movimiento(s) de reintegro vinculado(s), clickeable(s) hacia su propio detalle

#### Scenario: Gasto compartido muestra las partes sin estado por persona

- **WHEN** el usuario abre el detalle de un gasto compartido de un hogar de varias personas
- **THEN** un tile "Te toca pagar" muestra la parte propia del usuario
- **AND** un tile "Dividido entre" lista a cada persona con su parte, **sin** badge "Te debe"/"Saldado" (el modelo no guarda el estado de liquidación por transacción)

#### Scenario: La transferencia explicita que no afecta el balance

- **WHEN** el usuario abre el detalle de una transferencia entre cuentas propias
- **THEN** el hero usa tone transferencia (slate) y el monto se muestra **sin signo**
- **AND** un tile "Movimiento" muestra origen → destino y un callout aclara que no cuenta como gasto ni ingreso

#### Scenario: El back navigation respeta el origen

- **WHEN** el usuario abre `/transactions/[txId]?from=account:abc-123` y hace click en "Volver"
- **THEN** el sistema navega a `/accounts/abc-123`

#### Scenario: El AlertDialog de eliminar tiene copy contextual

- **WHEN** el usuario elige "Eliminar" en el detalle de una compra en cuotas madre
- **THEN** el AlertDialog muestra el warning de eliminar la compra y todas sus cuotas
- **AND** cuando el movimiento es un pago de resumen, el warning explica que las cuotas del período volverán a pendientes
- **AND** en todos los otros casos, el warning genérico

#### Scenario: Transacción de otro usuario no es accesible

- **WHEN** el usuario intenta acceder directamente a la URL de una transacción que no le pertenece
- **THEN** el sistema retorna `notFound()` (la RLS filtra la fila; la página renderiza 404)

### Requirement: El detalle del movimiento usa un hero editorial centrado con el monto como protagonista

El sistema SHALL renderizar el hero del detalle de un movimiento como una **tarjeta con banda tintada por tono**, centrada, con la siguiente anatomía:

- Una **banda superior** con `radial-gradient` derivado del tono del tipo (gasto/ingreso/transferencia) sobre fondo blanco.
- Un **ícono de categoría** en un cuadro redondeado tintado (`--tone-soft`) de 88×88 px (desktop) / 72×72 px (mobile), con sombra suave. Para movimientos categorizables usa el emoji de la categoría; para movimientos de estructura (transfer, exchange, adjustment, card_payment) usa un ícono lucide acorde al kind.
- El **monto display** debajo del ícono, tipografía editorial 60px (desktop) / 46px (mobile) font-bold, en el color del tono (`--tone`):
  - terracotta (gasto) con signo `−`.
  - emerald-deep (ingreso) con signo `+`.
  - slate (transferencia) **sin signo**.
- El **currency symbol** SHALL renderearse a la izquierda del entero, más chico (~50% del display) y opaco (~0.6). Los **decimales** SHALL respetar la preferencia `showCents` del usuario.
- Para transferencias, un **eyebrow** uppercase ("Transferencia interna") SHALL ir sobre el título.
- Debajo del monto, una **línea de contexto** (`hero-flow`) que describe el tipo en lenguaje funcional (ej. "Gasto · pago único en efectivo", "Ingreso de ACME S.A.", "Movimiento entre tus cuentas").
- Una fila de **chips** (`hero-chips`) separada por un borde superior: `fecha`, `medio de pago` (chip tonal), `categoría`, `subcategoría`. Estados reales (Reintegro acreditado, etc.) pueden aparecer como un chip de color cuando informan algo.

A diferencia del hero anterior, el nuevo hero **SÍ** lleva chips de contexto (fecha · medio · categoría · subcategoría) debajo del monto; el tipo se comunica con el tono, el ícono y la línea de contexto, no con pills de "tipo" sobre el monto.

#### Scenario: El hero usa el tono y signo correctos por tipo

- **WHEN** el sistema renderiza el detalle de un gasto cash de $4.200,50 en ARS
- **THEN** el hero muestra el monto como `−$ 4.200,50` en color terracotta, con el símbolo de moneda más chico y opaco
- **AND** debajo aparecen la línea de contexto y los chips de fecha · medio de pago · categoría · subcategoría

#### Scenario: El hero de una transferencia no muestra signo

- **WHEN** el sistema renderiza el detalle de una transferencia interna
- **THEN** el monto se muestra en slate **sin** signo `+` ni `−`
- **AND** un eyebrow "Transferencia interna" aparece sobre el título

#### Scenario: El hero muestra los chips de contexto

- **WHEN** el sistema renderiza el detalle de un gasto categorizado con subcategoría
- **THEN** la fila de chips incluye la fecha, el medio de pago, la categoría y la subcategoría
- **AND** el chip del medio de pago NO muestra ningún número de tarjeta, solo el nombre del medio

### Requirement: Las acciones del detalle viven en un kebab menu

El sistema SHALL exponer las acciones del detalle en la **topbar** de la pantalla, no en un kebab ni como botones planos al pie. En **desktop**, **Editar** SHALL ser un botón sólido navy a la derecha de la topbar y **Eliminar** un icon button (con hover en tono peligro). En **mobile**, la topbar es sticky: las acciones secundarias (incluida Eliminar) colapsan en un menú **"···"**, y **Editar** SHALL renderearse como un **botón fijo full-width en una barra inferior** (thumb-reach, respetando `safe-area-inset-bottom`).

Las acciones disponibles dependen de los permisos del usuario y del editable-state del movimiento (igual que hoy): **Editar** abre el drawer de edición en contexto cuando está disponible, o navega a `[txId]/edit`; **Eliminar** abre el `AlertDialog` con copy contextual (parent / card payment / default). Cuando el movimiento no permite ninguna acción, la topbar deja el slot de acciones vacío.

#### Scenario: En desktop, Editar y Eliminar están en la topbar

- **WHEN** el sistema renderiza en viewport ancho el detalle de un gasto editable y eliminable
- **THEN** la topbar muestra a la derecha el botón sólido "Editar" y un icon button de "Eliminar"
- **AND** no se renderea ningún menú kebab `⋯`

#### Scenario: En mobile, Editar pasa a una barra inferior fija

- **WHEN** el sistema renderiza en viewport angosto (≤600px) el detalle de un gasto editable
- **THEN** la topbar es sticky y las acciones secundarias viven en un menú "···"
- **AND** "Editar" se muestra como un botón fijo full-width en una barra inferior

#### Scenario: Editar abre el drawer de edición en contexto

- **WHEN** el usuario toca "Editar" en un movimiento con drawer de edición disponible
- **THEN** se abre el drawer de edición en contexto (sin navegar a `[txId]/edit`)
