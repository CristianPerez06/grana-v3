## Context

El reintegro (reintegro / cashback) es un movimiento propio (`type='reimbursement'`) vinculado al gasto de origen vía `linked_transaction_id`, con estados: **pendiente** (`received_at IS NULL`, `cancelled_at IS NULL`), **recibido** (`received_at` seteado) y **cancelado** (`cancelled_at` seteado). La regla de dominio central: un reintegro pendiente nunca entra en ningún cálculo; solo uno recibido y no cancelado impacta saldo/resumen/deuda (`packages/money-logic/src/reimbursements.ts`).

Hoy el reintegro solo se puede **declarar en el alta** del gasto (`insertDeclaredReimbursement`, corrido dentro de los orquestadores `createExpense` / `registerCardPurchase` / `registerInstallments`, de forma atómica). El formulario de edición (`MovementForm`, un único componente compartido gateado por `isEdit`) tiene el estado del reintegro en el hook `useMovementForm` pero:
- la sección UI está gateada a alta (`showReimbursementToggle = !isEdit && tab === 'expense'`, `movement-form.tsx:1211`),
- `submitEdit` no tiene ninguna rama de reintegro,
- `MovementEditContext` no carga el reintegro vinculado existente.

Constraints relevantes:
- El trigger `trg_fn_reimbursement_invariants` valida la integridad del link (el linked es un `expense` del mismo usuario; `statement` requiere tarjeta y período) y hace `estimated_amount` **inmutable en UPDATE**.
- El toggle **Compartir** ya tiene su variante de edición (`showSharedToggleEdit`, gateada por `edit.editableFields.shared`) y re-aplica splits vía `applySharedSplits` — es el patrón gemelo a seguir.

## Goals / Non-Goals

**Goals:**
- Exponer la sección de reintegro completa en edición, en paridad de campos con el alta.
- CRUD del reintegro vinculado: agregar (donde no hay), editar y quitar (cuando está pendiente); read-only cuando está recibido/cancelado.
- Paridad de alcance con el alta: gasto simple, tarjeta simple y cuotas (link a la madre; "en resumen" → período de la 1ª cuota).
- Herencia del split compartido, consistente con el estado de compartido del gasto en la misma edición.
- Contratos compartidos listos para que mobile los consuma.

**Non-Goals:**
- Confirmar (marcar recibido con reconciliación de monto/fecha/período) y cancelar/reabrir un reintegro: siguen en sus flujos propios (`confirmReimbursement` / `cancelReimbursement`). Este cambio NO los reimplementa.
- Editar un reintegro ya recibido o cancelado (read-only aquí; tocan saldo/resumen).
- Implementación mobile.
- Migración de base (el esquema ya soporta todo).

## Decisions

### 1. Editar un reintegro pendiente = delete + insert, no UPDATE

`estimated_amount` es inmutable en UPDATE por el trigger. Además el subtipo (`account` ↔ `statement`) cambia la forma del reintegro (cuenta vs período, splits). En vez de un UPDATE parcial que choca con el trigger y multiplica los casos, el mutator **borra el reintegro pendiente existente y crea uno nuevo** con la declaración deseada. Es seguro porque un reintegro pendiente no tiene impacto contable (no tocó saldo, no participa en liquidaciones). Así "agregar" y "editar" comparten exactamente el mismo camino de inserción (`insertDeclaredReimbursement` reutilizado / extraído).

- Alternativa descartada: relajar el trigger para permitir mutar `estimated_amount`. Tocar invariantes de DB por una comodidad de UI es riesgo desproporcionado.
- Alternativa descartada: UPDATE selectivo campo a campo. Multiplica ramas (cambio de target implica re-derivar cuenta/período/splits) y sigue chocando con la inmutabilidad de `estimated_amount`.

### 2. Un solo mutator "reconciliador": `saveExpenseReimbursement`

Nuevo orquestador en `@grana/transactions-mutations` que recibe `expenseId` (el gasto o la **madre**) + una declaración deseada opcional (`undefined` ⇒ quitar) + el spec de compartido resultante. Reconcilia contra el estado actual:

1. Carga el reintegro vinculado (`linked_transaction_id = expenseId`, `type='reimbursement'`).
2. **Guarda de estado** (defensa en profundidad además del read-only de UI): si el actual está **recibido o cancelado**, rechaza cualquier cambio.
3. Si hay uno pendiente, lo borra (con sus splits).
4. Si la declaración deseada existe, inserta uno nuevo (reusa la lógica de `insertDeclaredReimbursement`, incluyendo la herencia del split vía `applySharedSplits`).

Agregar = (sin actual) → insert. Editar = delete + insert. Quitar = delete, sin insert. El mismo mutator cubre los tres.

### 3. Dos capas de gating: tipo de gasto vs estado del reintegro

- **`EditableFields.reimbursement`** (nuevo, computado en `getEditableFields`, `money-logic`): si el gasto es *elegible* para tener reintegro editable. `true` para gasto categorizable (efectivo/banco/tarjeta) y para la **madre** de cuotas; `false` para expense de pago de resumen (`isCardPayment`), cuota hija, y para income/transfer/adjustment/exchange. Es ortogonal al lock de monto por pagado (igual que `shared`): un consumo de tarjeta pagado puede recibir/tener reintegro aunque su monto esté bloqueado.
- **Estado del reintegro** (`edit.reimbursement.status`): dentro de un gasto elegible, decide editable (pendiente) vs read-only (recibido/cancelado). Vive en el edit context, no en `EditableFields`, porque depende del dato concreto, no del tipo.

### 4. `MovementEditContext.reimbursement` cargado por el builder

`buildMovementEditContext` (web) consulta el reintegro vinculado del gasto/madre y lo proyecta a un shape mínimo: `{ id, status: 'pending'|'received'|'cancelled', target, amount, accountId, cardPeriodId }` o `null`. El hook lo usa para prefillar el estado (`reimbursementEnabled`, `reimbursementAmount`, `reimbursementTarget`, `reimbursementReceivedNow`, `reimbursementAccountId`) y para decidir read-only.

### 5. Orquestación en `submitEdit`: gasto primero, reintegro después

`submitEdit` aplica la edición del gasto (con su `sharedUpdate`) como hoy, y **luego** llama al nuevo mutator con la declaración de reintegro deseada y el spec de compartido resultante (para que el reintegro herede/pierda el split de forma consistente con el gasto). Es el mismo patrón de dos llamadas que ya usa `submitCreate` (expense + recurrence).

- **Consistencia sin RPC atómica**: si el update del gasto ok pero el reintegro falla, se informa el error y NO se reporta éxito; la edición del gasto queda aplicada (es un cambio válido por sí mismo y revertir un gasto preexistente a su estado previo sería más sorpresivo que dejarlo guardado). El reintegro pendiente es recuperable reintentando. Una RPC que envuelva ambos en una transacción queda como mejora futura si aparece la necesidad.

## Risks / Trade-offs

- **[Partial-save: gasto guardado, reintegro falla]** → Se informa el error y no se declara éxito; el reintegro es pendiente (sin impacto contable) y reintentable. Documentado como comportamiento esperado; RPC atómica diferida.
- **[Delete+insert cambia el `id` del reintegro pendiente al editar]** → Aceptable: un reintegro pendiente no es referenciado por liquidaciones ni por saldo; nada estable depende de su id. Los flujos que sí referencian (confirmar/cancelar) operan sobre reintegros que este camino no toca (read-only).
- **[Doble fuente de verdad del read-only (UI + guarda del mutator)]** → Intencional (defensa en profundidad): la UI oculta la edición y el mutator la rechaza igual, por si un cliente desactualizado la intenta.
- **[Herencia del split al descompartir en la misma edición]** → El mutator recibe el spec de compartido *resultante* del update del gasto, no el previo; el orden (gasto → reintegro) garantiza consistencia. Cubierto por escenario de spec.
- **[Drift de contrato con mobile]** → El nuevo mutator entra en `Mutators` (el detector de drift del paquete) y `MovementEditContext` gana el campo; mobile compila contra esos tipos y el tech lead completa la implementación nativa.
