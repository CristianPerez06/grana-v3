# Proposal: simplify-edit-type-selector

## Why

Las changes `simplify-movement-form-surface`, `add-frequent-classification-chips` y `align-mobile-movement-form-visual-parity` rediseñaron el **alta** de movimiento en superficie mobile: el selector de tipo dejó de ser una tira de cinco tabs y pasó a ser **dos primarias (`Gasto` / `Ingreso`) más "Otros"**, con los tipos secundarios detrás de una affordance explícita.

La **edición** quedó afuera y hoy diverge en las dos plataformas, de dos maneras distintas y ninguna buena:

- **Web en viewport angosto** (`apps/web/lib/transactions/components/movement-form.tsx`): el gate del rediseño era `isMobile && !isEdit`, así que al abrir "Editar movimiento" cae al branch de escritorio y dibuja el `Segmented` completo con los cinco tipos, deshabilitado y **cortado** por el ancho del teléfono (se lee "Gasto · Ingreso · Transferencia · Ajuste · Ca…"). Es exactamente la tira que el rediseño sacó del alta, encima inservible: el tipo es inmutable, así que las cinco opciones son ruido puro.
- **App nativa** (`apps/mobile/components/transactions/MovementForm.tsx`): el selector se **oculta** entero en edición y el tipo sólo aparece como una fila de contexto "TIPO — Gasto — no editable". No hay tira rota, pero tampoco hay continuidad visual con el alta: la misma pantalla cambia de forma según el modo.

Y en las dos, el tipo se dice **dos veces**: la fila de contexto "TIPO" repite lo que el selector (o la etiqueta) ya nombra.

## What Changes

- **El selector simplificado también en edición.** En superficie mobile —app nativa y web en viewport angosto— el formulario de edición dibuja el mismo control que el alta: dos primarias + "Otros", con el tipo del movimiento como opción activa. La forma de la pantalla deja de depender del modo.
- **Read-only, no deshabilitado a medias.** El tipo sigue siendo inmutable: en edición ninguna opción es accionable, no hay handler de cambio de tipo y la lista de "Otros" (popover en web, `SelectSheet` en nativa) directamente no se monta.
- **Un tipo secundario ocupa el slot "Otros".** Al editar una transferencia, un ajuste o un cambio de moneda, el tercer slot muestra el nombre de ese tipo en vez de la etiqueta genérica. El slot aparece también cuando ese tipo ya no es elegible para un alta nueva (p. ej. una transferencia cuya segunda cuenta se cerró); si no, el tipo del movimiento se quedaría sin dónde mostrarse.
- **El tipo se dice una sola vez.** La fila de contexto "TIPO" se va en mobile, porque el selector ya la cubre. Sobrevive en la madre de una compra en cuotas, donde el valor es "Compra en cuotas" y aporta algo que un slot "Gasto" no dice.
- **Escritorio intacto.** En viewport ancho el `Segmented` de cinco tipos deshabilitado y la fila "TIPO" siguen exactamente como están: este cambio no toca el layout de escritorio, igual que las pasadas anteriores del rediseño.

Sin cambios de datos, de validación ni contables: el tipo era inmutable en edición antes y después. Es una pasada de superficie.

## Capabilities

### Modified Capabilities

- `transactions`: el requirement del selector de tipo pasa a cubrir también el modo edición (forma igual al alta, read-only, slot "Otros" para los secundarios, sin repetir el tipo en las filas de contexto). Se ajustan en consecuencia el requirement del drawer en modo edición y el de la edición en la app nativa, que hoy dice "ocultar el selector de tipo".

### New Capabilities

(ninguna)

**Pre-change check.** La change activa `fix-recurrence-projection-and-orphans` también tiene deltas sobre `transactions`, pero sobre requirements disjuntos (proyección de recurrencias, duplicados de reglas, borrado de transacciones, edición desde el módulo global). No hay solapamiento con los tres requirements que toca esta change, así que las dos pueden avanzar en paralelo y archivarse en cualquier orden.

## Impact

- **`apps/web/lib/transactions/components/movement-form.tsx`** — el gate del selector pasa de `isMobile && !isEdit` a `isMobile`, con las opciones renderizadas como texto no accionable cuando `isEdit`; `contextRows` deja de emitir la fila "TIPO" en mobile salvo para la madre de cuotas.
- **`apps/mobile/components/transactions/MovementForm.tsx`** — el bloque del selector deja de estar envuelto en `!isEdit` y renderiza `View` en vez de `Pressable` en edición; el `SelectSheet` de "Otros" sigue montándose sólo en alta; misma poda de la fila "TIPO".
- **i18n**: sin claves nuevas — reusa `transactions.form.other_types`, `transactions.types.*` y `transactions.labels.type`, ya presentes en ambos catálogos.
- **Sin impacto** en `@grana/movement-form` (el hook ya expone `secondaryTabs` / `isSecondaryTab` / `isEdit`), en `@grana/ui-contracts`, en las server actions ni en el schema.
