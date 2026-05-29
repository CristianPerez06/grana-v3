# Rediseño visual del detalle del movimiento

## Why

Tras el rediseño visual del listado (`redesign-transactions-visuals`, mergeado a main como `fe5ede8`), el detalle del movimiento (`/transactions/[txId]`) sigue con la presentación heredada del relevamiento funcional: un solo componente `GlobalTransactionDetail` con 348 líneas que mezcla la estructura visual con el cálculo de campos por kind. Funcionalmente está bien — cubre los 8 kinds de movimiento (expense, income, transfer, exchange, adjustment, card_payment, installment_purchase, reimbursement), maneja cuotas hermanas, reembolsos vinculados y banner de recurrencia. **Visualmente no termina de transmitir la personalidad editorial** que el listado ya establece.

En una sesión de exploración del owner (Cristian, mayo 2026), se comparó el detalle actual con dos referencias:

1. **El artboard 04 que diseñé en Paper**: hero horizontal con type chips, eyebrow "TOTAL A PAGAR", monto display 48px, meta grid 2x2, tabla de cuotas separada, botones de acción planos (Editar primary + Duplicar + Eliminar destructive).
2. **El patrón v2** (`grana-v2/src/modules/transactions/components/detail/*`): hero centrado vertical con ícono circular con sombra, monto display 38px con currency opaco y decimales superscript, descripción 18px bold centrada, context line muted, `DetailGroups` (card blanco con eyebrow caps + filas), acciones en kebab `⋯` con dropdown.

El owner **prefiere el patrón v2** como base, por su sello editorial. Esta change implementa la migración a ese patrón en v3, manteniendo dos ganancias del artboard 04 que v2 no tenía: numeración circular de cuotas con chip de estado por cuota, y aplicación de los tokens semánticos editoriales (`text-expense`, `text-income`, `text-pending`, `text-neutral-amount`) del change anterior.

Este change NO toca:
- La lógica de qué campos mostrar por kind (`detailRows`, `installmentSiblings`, `reimbursements`).
- Server actions de edit/delete.
- Routing ni back-link logic (`from=account:<id>` / `from=card:<id>`).
- Banner de recurrencia arriba (ya existe en `page.tsx`).

Cambia exclusivamente la **capa de presentación**: cómo se renderean la jerarquía visual del hero, los metadatos, las cuotas y las acciones.

Decisiones de diseño tomadas (referencia visual: `D:/src/grana-v2/src/modules/transactions/components/detail/` y los artboards 04/06 en `docs/design/movimientos/`):

1. **Hero centrado vertical** con ícono circular 64px y sombra suave (`0 8px 22px rgba(11,26,43,0.10)`), monto display 38-48px en `text-{tone}` (expense/income/neutral-amount/pending según el kind y el signo), currency symbol en línea más chico y opaco al 60%, decimales en superscript (`fontSize: 0.55em, verticalAlign: 0.65em`). Descripción 18px bold navy centrada, context line 12px muted centrada con la info contextual (fecha · cuenta · subtipo).
2. **No type chips**: la descripción y el context line cuentan la historia. Los chips ("Compra en cuotas", "3 cuotas · pesos") que tenía el artboard 04 introducen ruido innecesario — la información ya está implícita en el ícono y en la tabla de cuotas si aplica.
3. **DetailGroups** para metadatos: card blanco con eyebrow caps uppercase como header opcional + filas adentro. Cada `TxDetailRow` lleva un ícono cuadrado redondeado pequeño (32×32, bg muted, ícono lucide en text-soft) + label uppercase 10.5px tracked + value 13.5px font-semibold navy. Las filas se dividen por `border-bottom 1px` salvo la última.
4. **Tabla de cuotas como DetailGroup variant**: mismo card pattern pero la fila tiene **número circular** (28×28, bg colorizado según estado: warning para pendientes activas, muted para futuras) en lugar del ícono cuadrado. Esa decisión sale del artboard 04 — v2 las muestra como filas planas; el número circular las hace más reconocibles como "lista de N cuotas".
5. **Acciones en kebab `⋯` arriba a la derecha**, no como botones planos abajo. Dropdown con "Editar" → ruta `[txId]/edit`, "Eliminar" → AlertDialog confirm. El menú se esconde por completo cuando `canEdit && canDelete` son false (movements no editables). Sin "Duplicar" en la primera iteración: feature poco usada en v2.
6. **Header simplificado**: ícono `←` solo (sin label) en `TxHeader`. El destino del back se sigue resolviendo por `from=` query param como hoy. El label que hoy decía "← Visa Galicia" o "← Movimientos" se retira porque consume real estate sin agregar info crítica (el back de browser cumple el mismo rol; el back-button de la app es secundario).
7. **Color tone** del monto según `view.tone`:
   - `'income'` → `text-income`
   - `'expense'` → `text-expense`
   - `'neutral'` → `text-neutral-amount` (transfer, exchange, ajuste sin signo)
   - **Reintegro pendiente** → `text-pending` (consistente con la decisión del MovementRow)
8. **Recurrence banner** arriba del hero queda como está (se renderea en `page.tsx`, no en el componente).

## What Changes

- **MODIFIED** "El usuario puede ver el detalle de una transacción": la presentación visual SHALL seguir el layout editorial centrado (hero + DetailGroups + acciones kebab) en lugar del shell heredado. La lógica de qué campos mostrar por kind se preserva intacta.
- **ADDED** "El detalle del movimiento usa un hero editorial centrado con el monto como protagonista": ícono circular con sombra, monto display con currency opaco y decimales en superscript, descripción y context line debajo.
- **ADDED** "Las acciones del detalle viven en un kebab menu, no como botones planos": dropdown con Editar / Eliminar. Eliminar abre un AlertDialog de confirmación.
- **ADDED** "Los metadatos del detalle se agrupan en DetailGroups con eyebrow caps y filas": card blanco con eyebrow uppercase opcional + filas con ícono cuadrado pequeño + label uppercase + value.
- **ADDED** "Las cuotas hermanas se renderean con numeración circular y chip de estado por cuota": variant de DetailGroup donde cada fila tiene un número circular en lugar del ícono cuadrado, con color de fondo según el estado (`pending` warning soft, `paid` income soft, otras muted).
- **ADDED** "El back del detalle se renderea como ícono `←` solo, sin label de texto": simplifica el header y delega el contexto del origen al back del browser.
- **ADDED** "El detalle ofrece pedagogía in-context sobre off-ledger y reintegros pendientes": copy contextual corto debajo del hero según el kind, explicando qué pasa con el impacto contable del movimiento.

## Research aplicado — pantalla de detalle en apps comparables

Antes del commit se hizo un research sobre cómo manejan la pantalla de detalle 6 apps de finanzas personales con tracción real: YNAB, Mobills, Mint (descontinuada pero hubo años de feedback), Spendee, Copilot Money, Monarch Money. El research informó decisiones que se integran a este change y otras que se documentan explícitamente como **no hacer**.

**Validaciones del enfoque actual**:

- **Kebab `⋯` arriba a la derecha** para acciones: Copilot Money lo usa así. Mint y YNAB ponen botones planos y los reviews lo critican como cluttered.
- **Sin FAB en el detalle**: queja explícita en reviews 2025 del rediseño de YNAB ("the floating add transaction button adds visual clutter").
- **Edición inline campo por campo**: patrón universal en las 6 apps.
- **Numeración circular de cuotas** (decisión propia del artboard 04 que mantenemos): ninguna de las 6 apps la tiene. Mobills es la más cercana al manejar cuotas pero las lista plano. Es diferenciador propio de grana / mercado LATAM.

**Hallazgo único de grana — pedagogía in-context**:

Ninguna de las 6 apps modela explícitamente el principio off-ledger en el detalle de un consumo de tarjeta, ni distingue "expectativa" vs "hecho" en reintegros. Es un diferenciador real que encaja con el tono editorial ("sugiere y enseña, no condena"). Se suma a este change un requirement para que el detalle muestre **copy contextual corto** según el kind del movimiento — sin formularios nuevos, solo texto — explicando qué pasa con su impacto contable.

## Trabajo futuro derivado del research

Un único change con scope claro y valor real:

- **`add-recurrence-edit-scope`** — al editar una instancia generada por una regla recurrente, preguntar al usuario el scope del cambio: "esta sola / todas pendientes / todas incluyendo pagas". Patrón probado en Mobills y Google Calendar. Resuelve un bug clásico ("edité una y se me modificaron todas"). Bajo costo (sin migration, sólo UI + server action enriquecida). Encaja con el módulo `recurring-movements` ya completo.

## Evaluación pendiente — features que requieren decisión previa

Dos features potencialmente valiosas pero que necesitan trabajo de definición antes de poder pasarlas a un change. NO entran al roadmap inmediato; se dejan documentadas para retomar cuando corresponda:

- **Adjuntar foto de recibo**: respaldo contable de la transacción. Table stakes en 5 de 6 apps (todas menos Copilot). Pro: encaja con "confianza contable". Contra: el target actual de grana no tiene la cultura yankee del receipt scanning. Requiere Supabase Storage + tabla nueva + quotas + UI de upload. **Reevaluar** si en el futuro grana apunta a freelancers/monotributistas con necesidad fiscal o de reembolso laboral.
- **Similar transactions del mismo merchant** en el detalle (estilo Copilot macOS: "Café Martínez: 6 veces este mes, $X"). Pedagógico, encaja con el tono. Pero requiere previo: **definir cómo se detecta "mismo merchant"** — hoy `description` es texto libre del usuario ("Coto del centro" vs "coto" vs "Coto Lima"). Sin un campo `merchant` formal o una capa de normalización, el matching va a ser ruidoso. **No avanzar** hasta que esa decisión esté tomada.

## Anti-features documentados — decisiones explícitas de NO hacer

Features que aparecen en las apps comparables y que **rechazamos para grana**, con razón. Documentadas acá para que una sesión futura no las re-proponga sin razón nueva (principio "el repo es la memoria"):

- **Notas / memo libre**: 5 de 6 apps lo tienen. Rechazado para grana — un campo libre de texto que el usuario llena con apuntes sueltos es exactamente el patrón planilla que la app declara no ser. La `description` de la transacción ya cumple esa función con foco.
- **Tags / hashtags multidimensionales**: presente en Mint, Monarch y Spendee. Rechazado — grana ya tiene categorías + subcategorías + cuentas + tarjetas + tipos de movimiento. Sumar una dimensión más es ruido. Incluso en las apps que los tienen, pocos los usan en serio según reviews.
- **Hide / exclude toggle** (Monarch, Copilot): permite "esconder" una transacción de stats sin borrarla. Rechazado — solapa con `borrar` + con el sistema de reintegros que grana ya tiene (`received_at`/`cancelled_at`). No agrega caso de uso nuevo.
- **Comparativo "promedio nacional"** estilo Mint ("vos gastás X en restaurantes, el promedio USA es Y"). Rechazado — irrelevante con inflación AR del 100%+, y en Mint dividía opiniones (magia para algunos, ruido para otros). Tampoco aplica culturalmente al mercado AR.
- **Balance corriente después de esta transacción** en el detalle. Rechazado — ninguna de las 6 apps lo tiene, los users no lo piden masivamente, y fricciona con bimoneda (dos balances distintos por moneda) y off-ledger (tarjeta no afecta disponible). Si alguna vez surge la necesidad, debería ser para cuentas cash/débito únicamente y con copy explícito por moneda.

## Stakeholders

- **Producto** (Cristian): valida la jerarquía editorial (monto como héroe, kebab vs botones planos, ausencia de type chips).
- **Diseño**: la referencia visual queda en `D:/src/grana-v2/src/modules/transactions/components/detail/*.tsx` (TxHero, TxHeader, DetailGroup, TxDetailRow, TransactionMenuActions). Cuando el archive de este change merge a main, los componentes de v3 se vuelven la nueva referencia.
- **Mobile** (tech lead): paridad mobile se traslada por el contrato. Esta change agrega tipos/contratos nuevos si hace falta (ej. `DropdownMenuProps`, `TxDetailRowProps` si los promovemos a contracts compartidos) — a discutir en el design. La implementación mobile no es scope.

## Mobile work pendiente (handoff al tech lead)

Lo que queda disponible para mobile cuando el tech lead replique:

- **Tokens semánticos** (`@grana/ui-tokens`): los del change anterior siguen vigentes (`--expense`, `--income`, `--neutral-amount`, `--pending`). No agrego nuevos en este change.
- **Lógica pura** (`@grana/money-logic`): si extraemos algo del cálculo de `tone` o de formateo de monto-con-decimales-superscript (la función `fmtAmount` de v2), va acá. Pendiente decisión en design.
- **Contracts** (`@grana/ui-contracts`): el `ButtonSize` ya tiene `'icon'` (cambio reciente del tech lead post-merge); lo usamos para los botones del header / kebab trigger. Probablemente promovamos `TxDetailRowProps` para que mobile tenga el mismo shape.
- **i18n keys** nuevas: `transactions.detail.*` con labels uppercase, copy del dropdown, copy del confirm de delete.

Lo que el tech lead implementa en `apps/mobile/`:

1. `TxHero` con sombra del ícono y monto con currency opaco / decimales superscript (mismo treatment tipográfico).
2. `TxHeader` con back `←` ícono solo.
3. `DetailGroup` y `TxDetailRow` (componentes muy simples — ícono + label + value).
4. `InstallmentRows` con numeración circular.
5. `TxActionsMenu` con kebab. **Divergence esperada**: mobile usa probablemente bottom sheet en lugar de dropdown, como Mobills/YNAB. Mismo contract, distinto chrome.
