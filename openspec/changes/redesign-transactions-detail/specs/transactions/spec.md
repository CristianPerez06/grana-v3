# Delta — Rediseño visual del detalle del movimiento

## MODIFIED Requirements

### Requirement: El usuario puede ver el detalle de una transacción

El sistema SHALL exponer una pantalla de detalle `/transactions/[txId]` para cada movimiento, que muestre toda la información asociada al movimiento (campos según su `kind`), las cuotas hermanas cuando es una compra en cuotas (madre o hija), los reintegros vinculados cuando corresponde, y la regla recurrente que lo generó cuando aplica. La pantalla SHALL respetar el origen de navegación (`?from=account:<id>` o `?from=card:<id>`) para resolver el destino del "Volver".

La **presentación visual** SHALL seguir el patrón editorial centrado:

- **`TxHeader`** arriba: un ícono `←` (sin label de texto) a la izquierda como link al destino del back, y un slot a la derecha para el `TxActionsMenu` (kebab) o nada cuando el movimiento no permite acciones.
- **`TxHero`** centrado verticalmente: ícono circular de 64px con sombra suave (`0 8px 22px rgba(11,26,43,0.10)`) y fondo derivado de la categoría (categorizables) o `bg-muted` (estructurales). Debajo, el monto display 38-48px en `text-{tone}` (income/expense/neutral-amount/pending), con el signo (+/−), el currency symbol más chico y opaco (~60% opacity) y los decimales en superscript (`fontSize: 0.55em, verticalAlign: 0.65em`). Debajo del monto, la descripción 18px font-bold navy centrada (hasta ~300px de ancho), y opcionalmente una context line 12px muted centrada con la info contextual (fecha · cuenta · subtipo · etc.).
- **`TxDetailGroup`(s)** para los metadatos: cards blancos con border y radius grande (~18px), un eyebrow caps uppercase opcional como header del group (ej. "DETALLES", "TARJETA"), y filas adentro de tipo `TxDetailRow` (ícono cuadrado redondeado 32×32 con bg-muted + label uppercase 10.5px + value 13.5px font-semibold navy). Las filas se separan con border-bottom; la última no tiene border.
- **`TxInstallmentRows`** cuando aplica (madre o hija de cuotas): variant del DetailGroup con cada fila llevando un número circular 28×28 con color de fondo según estado (`pending` warning soft, `paid` income soft, otras muted), descripción de la cuota, chip de estado y monto.
- **`TxActionsMenu`** como kebab `⋯` arriba a la derecha, no como botones planos abajo: dropdown con "Editar" (link a `[txId]/edit`) y "Eliminar" (abre AlertDialog con copy contextual según parent / card payment / default).
- **Banner de recurrencia** (cuando aplica) se mantiene arriba del `TxHero`, ubicado en el layout de la página (`page.tsx`), no dentro del componente del detalle.

La lógica de qué campos mostrar por kind, el manejo de cuotas hermanas, los reembolsos vinculados y el back navigation NO cambia — preserva todo el comportamiento del componente actual.

#### Scenario: El detalle se abre y muestra los campos correctos según el kind

- **WHEN** el usuario abre `/transactions/[txId]` de un gasto categorizado en una cuenta cash
- **THEN** el detalle muestra el hero centrado con monto en `text-expense`, ícono de la categoría con bg tintado, descripción debajo del monto, y un `TxDetailGroup` con filas para fecha, cuenta, categoría y subcategoría (si la tiene)
- **AND** el back en `TxHeader` resuelve al destino que indica `?from=` o, por defecto, a `/transactions`

#### Scenario: Compra en cuotas muestra el detalle con tabla de cuotas

- **WHEN** el usuario abre el detalle de una compra en cuotas (madre o hija)
- **THEN** el `TxHero` muestra la descripción de la compra y el monto total (en la madre) o la cuota (en la hija)
- **AND** un `TxInstallmentRows` lista todas las cuotas con su número circular, estado y monto
- **AND** un click sobre una cuota hija navega a su propio detalle

#### Scenario: Un reintegro pendiente muestra tone pending

- **WHEN** el usuario abre el detalle de un reintegro con `received_at IS NULL` y `cancelled_at IS NULL`
- **THEN** el `TxHero` muestra el monto con `text-pending` (gris)
- **AND** un `TxDetailGroup` lista el gasto vinculado, el monto esperado y el estado

#### Scenario: El back navigation respeta el origen

- **WHEN** el usuario abre `/transactions/[txId]?from=account:abc-123` y hace click en el `←`
- **THEN** el sistema navega a `/accounts/abc-123`

#### Scenario: El AlertDialog de eliminar tiene copy contextual

- **WHEN** el usuario abre el kebab del detalle de una compra en cuotas madre y elige "Eliminar"
- **THEN** el AlertDialog muestra el warning "Se van a eliminar la compra y todas sus cuotas. Esta acción no se puede deshacer."
- **AND** cuando el movimiento es un pago de resumen, el warning dice "Al eliminar este pago, las cuotas del período volverán a pendientes. ¿Continuar?"
- **AND** en todos los otros casos, el warning genérico "Esta acción no se puede deshacer."

---

## ADDED Requirements

### Requirement: El detalle del movimiento usa un hero editorial centrado con el monto como protagonista

El sistema SHALL renderizar el hero del detalle de un movimiento como un bloque **centrado verticalmente**, con la siguiente anatomía:

- Un **ícono circular** de 64×64 px con sombra suave (`box-shadow: 0 8px 22px rgba(11,26,43,0.10)`) y fondo derivado del kind: tintado del color de la categoría para movimientos categorizables (income, expense, installment_purchase), bg-muted con un ícono lucide en text-soft para movimientos de estructura (transfer, exchange, adjustment, card_payment), bg con tono del estado para reintegros.
- El **monto display** debajo del ícono, tipografía editorial 38-48px font-bold, en `text-{tone}` según el tone resuelto:
  - `text-income` para income, reimbursement recibido, ajuste positivo.
  - `text-expense` para gasto en cash/bank, consumo o cuota de tarjeta, pago de resumen, ajuste negativo.
  - `text-neutral-amount` para transferencia y cambio de moneda.
  - `text-pending` para reintegro esperado (no recibido).
- El monto SHALL llevar un **signo** (+/−) cuando el tone es income o expense, y omitirlo cuando es neutral o pending. El **currency symbol** SHALL renderearse en línea, a la izquierda del entero, en font-size ~63% del display, opacidad 0.6. Los **decimales** SHALL renderearse en **superscript** (`fontSize: 0.55em, verticalAlign: 0.65em`) cuando el usuario tiene `showCents=true` y el monto no es entero exacto.
- Debajo del monto, una **descripción** 18px font-bold navy centrada, máximo ~300px de ancho.
- Opcionalmente, una **context line** 12px muted centrada con info contextual (fecha relativa, cuenta, subtipo, fx_rate, período, etc., según el kind).

El hero NO SHALL llevar type chips ("Compra en cuotas", "3 cuotas · pesos", etc.) — la información del tipo se infiere del ícono y se especifica en los DetailGroups y la tabla de cuotas debajo.

#### Scenario: El hero usa el tone semántico correcto

- **WHEN** el sistema renderiza el detalle de un gasto cash de $1.234,56 en ARS
- **THEN** el hero muestra el monto como `−$1.234,56` con `,56` en superscript, en color `text-expense`
- **AND** la descripción 18px bold debajo

#### Scenario: El hero de un reintegro pendiente usa tone pending

- **WHEN** el sistema renderiza el detalle de un reintegro con `received_at IS NULL`
- **THEN** el monto se muestra con `text-pending` (gris) y sin signo
- **AND** la context line incluye la etiqueta "esperado"

#### Scenario: El hero no muestra type chips

- **WHEN** el sistema renderiza el detalle de una compra en cuotas madre
- **THEN** el hero muestra ícono + monto + descripción + context line
- **AND** NO renderea pills con etiquetas tipo "Compra en cuotas" o "3 cuotas · pesos" arriba del monto

---

### Requirement: Las acciones del detalle viven en un kebab menu

El sistema SHALL exponer las acciones del detalle (Editar, Eliminar) como un **kebab menu `⋯`** ubicado arriba a la derecha del `TxHeader`, no como botones planos al pie del detalle. El kebab es un botón de 36×36 con ícono `MoreHorizontal`. Al click abre un dropdown con los items disponibles según los permisos del usuario y el editable-state del movimiento.

Items del dropdown:

- **Editar**: link a `/transactions/[txId]/edit`. SHALL aparecer solo cuando `canEdit` (movimiento editable según `getEditableFields`).
- **Eliminar**: abre un AlertDialog con copy contextual según el kind del movimiento. SHALL aparecer solo cuando `canDelete`.

Cuando ambos `canEdit` y `canDelete` son false, el kebab NO SHALL renderearse — el slot de actions del header queda vacío.

#### Scenario: El kebab abre el dropdown con los items aplicables

- **WHEN** el usuario abre el detalle de un gasto editable y eliminable y hace click en el kebab `⋯`
- **THEN** se abre un dropdown con "Editar" y "Eliminar"
- **AND** click en "Editar" navega a `/transactions/[txId]/edit`
- **AND** click en "Eliminar" abre un AlertDialog de confirmación

#### Scenario: El kebab se oculta cuando no hay acciones disponibles

- **WHEN** el usuario abre el detalle de un movimiento donde `canEdit && canDelete` son false (ej. una cuota hija con período pagado)
- **THEN** el slot de actions del `TxHeader` queda vacío
- **AND** el kebab `⋯` no aparece

---

### Requirement: Los metadatos del detalle se agrupan en DetailGroups con eyebrow caps y filas

El sistema SHALL agrupar los metadatos del detalle en componentes `TxDetailGroup`: cards blancos con border de 1px y border-radius ~18px, opcionalmente precedidos por un **eyebrow caps uppercase** de 10.5px font-bold tracked (~0.6px) y color text-soft, que actúa como header del group (ej. "DETALLES", "TARJETA", "CUOTAS", "REINTEGROS").

Dentro del group, cada fila SHALL ser un `TxDetailRow`:

- A la izquierda, un **ícono cuadrado redondeado** de 32×32 px con `border-radius: 10px`, fondo `bg-muted`, ícono lucide pequeño en `text-text-soft`.
- En el centro, un bloque vertical: el **label** uppercase 10.5px font-bold con tracking abierto + el **value** 13.5px font-semibold navy debajo (o un `valueNode` custom cuando el value es más complejo: un Link, un chip, etc.).
- Las filas se separan por **border-bottom 1px** color border-soft. La última fila NO SHALL tener border-bottom.

#### Scenario: El detalle muestra un DetailGroup "Detalles" con las filas correctas

- **WHEN** el sistema renderiza el detalle de un gasto cash
- **THEN** un `TxDetailGroup` con eyebrow "DETALLES" aparece debajo del hero
- **AND** contiene filas para fecha (ícono Calendar), cuenta (ícono Wallet), categoría (ícono Tag), y subcategoría si la tiene

#### Scenario: Cada fila tiene su ícono, label y value

- **WHEN** el sistema renderiza una fila para "Fecha"
- **THEN** la fila muestra un ícono Calendar 32×32 con bg-muted a la izquierda
- **AND** label "FECHA" en uppercase caps + value "Martes, 27 de mayo" debajo

---

### Requirement: Las cuotas hermanas se renderean con numeración circular y chip de estado por cuota

Cuando el movimiento del detalle es una compra en cuotas (madre o hija de cuotas), el sistema SHALL renderizar un `TxDetailGroup` con la lista de todas las cuotas hermanas usando un layout variant del `TxDetailRow`:

- A la izquierda, un **número circular** 28×28 px con `border-radius: 9999px`, color de fondo según el estado de la cuota:
  - `pending` (próxima a vencer del período activo) → `bg-warning-soft text-warning-deep`.
  - `paid` (ya pagada) → `bg-income/14 text-income`.
  - Otra (futura lejana) → `bg-muted text-text-muted`.
- En el centro, **descripción de la cuota** ("Cuota 1 de 3", "Cuota 2 de 3", etc.) en 14px font-semibold navy + **caption** del período al que pertenece la cuota debajo (12px text-soft).
- A la derecha, un **chip de estado** ("Pendiente" / "Pagada") seguido del **monto** de la cuota.

Una hija navegable: al hacer click en una fila de cuota (que no es la actual), el sistema navega al detalle de esa cuota.

#### Scenario: La tabla de cuotas usa numeración circular según estado

- **WHEN** el sistema renderiza el detalle de la madre de una compra en 3 cuotas, donde la primera está pendiente y las otras dos en estado neutro
- **THEN** la primera fila tiene un círculo "1" con bg warning-soft y text warning-deep
- **AND** las filas 2 y 3 tienen círculos con bg muted

#### Scenario: Una cuota hija click navega a su detalle

- **WHEN** el usuario está en el detalle de la madre y hace click en la fila de la cuota 2
- **THEN** el sistema navega a `/transactions/[txId-de-la-cuota-2]` preservando el `from` si corresponde

---

### Requirement: El back del detalle se renderea como ícono solo, sin label de texto

El sistema SHALL renderizar el back del `TxHeader` del detalle como un **ícono `←` (`ArrowLeft` 20px de lucide) en un botón cuadrado 36×36**, sin label de texto al lado. El destino del back se sigue resolviendo por `?from=` query param (account:<id>, card:<id>, o `/transactions` por defecto).

Razón: el label de texto ("← Visa Galicia", "← Movimientos", "← Cuenta") consume real estate sin agregar info crítica — el back del browser cumple el mismo rol semántico, y el ícono solo es el patrón estándar de banking/finance apps (v2, Mobills, Splid).

#### Scenario: El back muestra solo el ícono

- **WHEN** el sistema renderiza el `TxHeader` del detalle
- **THEN** a la izquierda aparece un botón con `ArrowLeft` y `aria-label="Volver"`
- **AND** NO aparece texto al lado del ícono

#### Scenario: El back lleva al destino del `from` query param

- **WHEN** la URL es `/transactions/[txId]?from=account:abc` y el usuario hace click en el `←`
- **THEN** el sistema navega a `/accounts/abc`
- **AND** cuando `?from=card:xyz`, navega a `/cards/xyz`
- **AND** cuando no hay `?from=`, navega a `/transactions`

---

### Requirement: El detalle ofrece pedagogía in-context sobre off-ledger y reintegros pendientes

El detalle del movimiento SHALL renderizar **copy contextual corto** debajo del hero, según el `kind` y el estado del movimiento, explicando al usuario qué pasa con el impacto contable. La copy SHALL ser editorial cálida y breve (máximo 2-3 líneas), reusable del namespace i18n. NO SHALL ser un formulario, banner accionable, ni alerta intrusiva — es texto explicativo, en color muted o slate suave, ubicado entre el `TxHero` y el primer `TxDetailGroup`.

Variantes obligatorias:

- **Consumo o cuota de tarjeta no pagada** (`account.type='credit'` y el período aún no fue pagado): texto similar a "Este consumo no afecta tu disponible hasta que pagues el resumen del `{período}`." donde `{período}` se reemplaza con el rango del período del consumo.
- **Cuota hija ya pagada** (status=`paid`): texto similar a "Esta cuota ya está incluida en el resumen del `{período}` que pagaste." Se omite cuando la cuota es la primera o única.
- **Pago de resumen de tarjeta** (`card_payment`): texto similar a "Con este pago, las cuotas del período `{período}` quedaron en estado pagado." Aclara la conexión entre el pago cash y las cuotas tarjeta.
- **Reintegro pendiente** (`type='reimbursement'` con `received_at IS NULL` y `cancelled_at IS NULL`): texto similar a "Esperás que te lo devuelvan. Cuando llegue, marcalo como recibido y se va a sumar a tu disponible." Aclara que el monto no entra a balance hasta confirmar.
- **Reintegro cancelado** (`cancelled_at IS NOT NULL`): texto similar a "Marcaste este reintegro como cancelado. Si finalmente lo recibís, podés reabrirlo." Aclara que el estado es revertible.

Los otros kinds (income cash, expense cash, transfer, exchange, adjustment, reimbursement recibido) NO requieren copy in-context — su impacto contable es directo y no necesita explicación.

Las copys SHALL vivir bajo `transactions.detail.context.*` para que se traduzcan al inglés y futuro mobile las reuse.

Razón: ninguna de las apps relevadas (YNAB, Mobills, Mint, Spendee, Copilot Money, Monarch Money) modela explícitamente el off-ledger ni el estado "esperado vs hecho" de los reintegros. Es un diferenciador propio de grana, que encaja con el tono editorial ("sugiere y enseña, no condena") sin agregar features funcionales nuevas — solo presentación + copy. La fricción común en otras apps ("¿por qué este consumo de tarjeta no bajó mi saldo?") se preempts directamente desde el detalle.

#### Scenario: Un consumo de tarjeta no pagado muestra copy off-ledger

- **WHEN** el usuario abre el detalle de un consumo o cuota hija con `account.type='credit'` y `status='pending'`
- **THEN** debajo del `TxHero`, antes del primer `TxDetailGroup`, aparece un párrafo corto en color muted con copy "Este consumo no afecta tu disponible hasta que pagues el resumen del `{período}`."
- **AND** la copy NO es un banner accionable ni una alerta — es texto explicativo

#### Scenario: Un reintegro pendiente muestra copy editorial

- **WHEN** el usuario abre el detalle de un reintegro con `received_at IS NULL`
- **THEN** debajo del `TxHero` aparece un párrafo corto editorial: "Esperás que te lo devuelvan. Cuando llegue, marcalo como recibido y se va a sumar a tu disponible."

#### Scenario: Un income cash no muestra copy contextual

- **WHEN** el usuario abre el detalle de un income cargado en una cuenta cash
- **THEN** NO aparece párrafo contextual debajo del hero
- **AND** el detalle pasa directamente al primer `TxDetailGroup`

#### Scenario: Las copys son i18n-enabled

- **WHEN** el sistema renderiza una de las variantes de copy contextual
- **THEN** el texto proviene del namespace `transactions.detail.context.*`
- **AND** acepta el placeholder `{período}` cuando aplica
