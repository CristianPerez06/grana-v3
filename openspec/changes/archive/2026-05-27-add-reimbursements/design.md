## Context

Un reintegro es la devolución parcial de un gasto: el banco reintegra a una cuenta, una billetera devuelve, una promo descuenta en el resumen de la tarjeta. El usuario lo declara como **control personal** — la app no valida promos ni elegibilidad.

v3 tiene hoy las bases para construirlo bien, y restricciones de dominio que condicionan el diseño:

- **Bimoneda**: ARS y USD son ledgers separados, nunca se suman. El reintegro hereda la moneda del gasto (multi-moneda fuera de V1).
- **Off-ledger credit cards**: los consumos de tarjeta no reducen `disponible`; sólo el pago del resumen (un `expense` sobre una cuenta cash) lo hace. Un reintegro "en resumen" tiene que vivir **dentro del período** para reducir el total a pagar, sin tocar `disponible` hasta el pago.
- **Derived balances**: no hay columna de saldo en ningún lado; todo se computa del historial. El reintegro no agrega saldos persistidos.
- **Money + decimal.js**: toda aritmética monetaria pasa por `Money`; `amount` es `NUMERIC(18,2)` y `chk_amount_positive` exige `amount > 0` (un reintegro **nunca** es "un gasto negativo").
- **Modo novato/experto** (solo UI): el modelo mental de "reduce deuda de tarjeta" es de experto; el copy se adapta, la disponibilidad no.
- **`transaction_type`** ya tiene 5 valores (`income, expense, transfer, adjustment, exchange`) y agregar uno es trivial (4 precedentes de `ALTER TYPE ... ADD VALUE`).

El detalle clave que verificamos en el código: `calculateTransactionSums` y `computeRunningBalances` (`packages/money-logic/src/balance.ts`) son cadenas `if/else-if` **sin `default` ni chequeo de exhaustividad**. Agregar el enum sin tocar esas funciones haría que el reintegro **desaparezca de los saldos en silencio** — exactamente el "bug silencioso en cualquier parte" que el dominio advierte. La defensa es un guard exhaustivo, no sólo "agregar la rama".

## Goals / Non-Goals

**Goals:**
- Modelar el reintegro como un **movimiento derivado y vinculado al gasto**, con estado propio (pendiente/recibido/cancelado) y dos materializaciones (a cuenta / en resumen).
- Separar **expectativa** de **hecho contable**: el pendiente nunca impacta saldos/resumen/neto; sólo el recibido lo hace.
- Mantener **trazabilidad** (vínculo al gasto), **categoría heredada** (analytics de bruto/neto) y **auditoría** de la diferencia esperado↔recibido.
- Integrar el reintegro "en resumen" con el modelo off-ledger sin romper invariantes de tarjeta.
- Lógica pura, testeada, en `money-logic`, con guard exhaustivo.

**Non-Goals (fuera de V1):**
- Validación de promos bancarias / cálculo de elegibilidad.
- Split/`shared` del reintegro (módulo `shared` aún no existe; el esquema no lo impide a futuro).
- Reintegros multi-moneda (se impone misma moneda que el gasto).
- Conciliación bancaria automática (el reintegro es por declaración).
- Paridad mobile (lógica pura disponible en `money-logic`; contratos en `ui-contracts`).

## Decisions

### Decisión 1: una sola entidad en `transactions` (modelo X), no una tabla separada (modelo Y)

El reintegro vive en `transactions` con `type='reimbursement'`. Pendiente = `received_at IS NULL`; recibido = `received_at` seteado; cancelado = `cancelled_at` seteado.

- **Alternativa descartada (Y):** una tabla `expected_reimbursements` para los pendientes y `transactions` sólo para hechos reales. Es más "pura" conceptualmente, pero suma **dos write paths, dos modelos de edición y joins cruzados** (el vínculo y la categoría derivada cruzarían dos tablas) para una feature que necesita estar muy integrada al gasto.
- **Por qué X:** v3 **ya** acepta filas que no impactan el saldo conviviendo en `transactions` — las hijas de cuota `pending` y la madre off-ledger. El pendiente del reintegro es el mismo patrón, no uno nuevo. El "costo" de X (excluir pendientes del cálculo) es **una cláusula** en las queries que ya filtran las filas off-ledger de tarjeta, más el guard exhaustivo. El costo de Y es complejidad estructural permanente.
- **Condición de solidez de X:** guards exhaustivos en `money-logic`; tests fuertes de saldos/running balance/dashboard/resumen; toda agregación decide explícitamente qué hace con `received_at IS NULL`; el pendiente no impacta saldos ni neto real; confirmar reconcilia.

### Decisión 2: tipo propio `reimbursement`, no `income` con flag

- **Por qué:** "no se trata como ingreso genérico". Con `income + flag`, **cada** reporte futuro tiene que acordarse de excluir el reintegro de "lo que entró" → fuente de bugs silenciosos. Con tipo propio, cada agregación nueva queda obligada a decidir: ¿suma, resta, proyecta o se ignora?
- **Por qué no `adjustment`:** perdería categoría, vínculo con la compra y estado pendiente/recibido.

### Decisión 3: esquema

```sql
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'reimbursement';

ALTER TABLE public.transactions
  ADD COLUMN linked_transaction_id uuid NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  ADD COLUMN reimbursement_target  text NULL CHECK (reimbursement_target IN ('account','statement')),
  ADD COLUMN estimated_amount      numeric(18,2) NULL,
  ADD COLUMN received_at           timestamptz   NULL,
  ADD COLUMN cancelled_at          timestamptz   NULL;

-- estado: no puede estar recibido y cancelado a la vez
ALTER TABLE public.transactions
  ADD CONSTRAINT chk_reimbursement_state
    CHECK (received_at IS NULL OR cancelled_at IS NULL);

-- los campos de reintegro existen sólo en reintegros (y son obligatorios ahí)
ALTER TABLE public.transactions
  ADD CONSTRAINT chk_reimbursement_fields
    CHECK (
      (type = 'reimbursement' AND linked_transaction_id IS NOT NULL
         AND reimbursement_target IS NOT NULL AND estimated_amount IS NOT NULL)
      OR
      (type <> 'reimbursement' AND linked_transaction_id IS NULL
         AND reimbursement_target IS NULL AND estimated_amount IS NULL
         AND received_at IS NULL AND cancelled_at IS NULL)
    );
```

Integridad que la FK sola no garantiza → **trigger**:
- `linked_transaction_id` apunta a un movimiento `type='expense'` del **mismo `user_id`** (RLS no chequea el FK cruzado).
- `reimbursement_target='statement'` sólo si el gasto origen es de una cuenta `type='credit'`.
- `account_id`: en `'account'` es la cuenta cash/bank de acreditación; en `'statement'` es la tarjeta cuyo período se reduce (y lleva `card_period_id` al confirmar).
- `estimated_amount` es **inmutable** tras el alta (el trigger rechaza cambiarlo).

`category_id` del reintegro queda **NULL**: la categoría se **deriva** del gasto via `linked_transaction_id` en lectura (igual que v2 enriquecía la fila del cashback). Una sola fuente de verdad, cero propagación al editar.

### Decisión 4: `amount` vs `estimated_amount` — semántica por estado

`amount` es el campo contable (NOT NULL, > 0, como en todo `transactions`). `estimated_amount` (inmutable) recuerda lo que el usuario esperaba.

> **Regla central:** en un reintegro **pendiente**, `amount` representa el **monto estimado vigente** y **no impacta ningún cálculo**. Recién cuando `received_at` está seteado, `amount` representa el **monto real reconciliado** y entra en saldos, resumen de tarjeta o analytics.

- Al crear pendiente: `amount = estimated_amount = monto esperado`, `received_at = NULL`.
- Al confirmar/reconciliar: el usuario puede ajustar el monto real (te dieron $18.000, no $20.000); `amount` pasa a ser el real; `estimated_amount` queda intacto; `received_at` se setea.
- El **% y tope** son helper de carga **UI-only** (la app sugiere un monto; ej. compra $100.000, 20%, tope $15.000 → sugiere $15.000); **no se persisten**.

### Decisión 5: confirmar = reconciliar (no sólo marcar)

El monto del alta es una **estimación**; al recibir, la realidad casi nunca coincide (monto, fecha, hasta la cuenta destino). Si confirmar sólo seteara `received_at`, el usuario tendría que **mentirle a la contabilidad** para cuadrar — viola "confianza contable". El paso de confirmación SHALL permitir ajustar **monto real, fecha y —según subtipo— cuenta destino o `card_period_id`**.

### Decisión 6: el reintegro "en resumen" reduce el total del período (off-ledger)

El total a pagar de un período se **deriva** sumando sus consumos. Para que un reintegro lo reduzca sin violar `amount > 0`, es un movimiento `reimbursement` **sobre la tarjeta, con monto positivo, asignado a un `card_period_id`**, y la lógica del período lo **resta** (igual que income/expense son positivos con signo opuesto).

```
   RESUMEN del período (derivado):
     Σ consumos (expense, off-ledger)        +100.000
     − Σ reintegros statement RECIBIDOS       −20.000
     ───────────────────────────────────────────────
     total a pagar                             80.000   → al pagar, recién acá toca disponible
```

- El `card_period_id` del reintegro es **independiente** del período de la compra y de la cuota: se decide **al confirmar** (la bonificación puede aparecer en N+1). Un reintegro que llega **después** de pagar el resumen es saldo a favor → rueda al próximo período impago; confirmar `statement` contra un período **pagado** no se permite.
- Toca el trigger de invariantes de tarjeta: hoy exige que un movimiento de crédito sea `expense` con período + `status`. Un `reimbursement` sobre la tarjeta lleva período pero **`status` NULL** (su estado vive en `received_at`); el trigger debe permitirlo sin romper I-CRED-6.

### Decisión 7: neto por categoría — bruto, recibido, esperado, neto

Función pura en `money-logic`:
- **bruto** = Σ gastos de la categoría.
- **reintegros recibidos** = Σ reintegros `received` cuya categoría **derivada** es esa.
- **neto real** = bruto − recibidos.
- **esperado** = Σ reintegros pendientes (mostrado **aparte y tenue**, nunca mezclado con el neto real).
- El reintegro **nunca** cuenta como ingreso genérico del mes.

Mismo espíritu que el dashboard separa "Para gastar" de "Lo que viene": expectativa y realidad no se mezclan en el mismo número.

### Decisión 8: subtipo por medio de pago; copy por modo

"a cuenta" está disponible siempre (sirve a cash/débito/QR/tarjeta). "en resumen" **sólo si el gasto es de tarjeta** (relación de disponibilidad, no de inferencia: comprar con tarjeta y que el banco devuelva a una cuenta es común). Default "a cuenta". El copy se adapta al modo (plano en novato, técnico en experto); la disponibilidad **no** depende del modo (esconder "en resumen" a un novato que lo recibe lo obliga a cargarlo mal).

### Decisión 9: alta atómica vía orquestación en TS con rollback (NO RPC)

> **Revisada durante la implementación (2026-05-27).** El proposal proponía una RPC Postgres. Al relevar el código, una RPC obligaría a reimplementar los **tres caminos** de creación de gasto (cash/débito, tarjeta 1 cuota, tarjeta N cuotas con madre+hijas, asignación de período, fx) en PL/pgSQL — duplicando lógica que hoy vive una sola vez en TS + `money-logic`, justo el anti-patrón "dos fuentes de verdad" que v3 evita.

En su lugar: el action **crea el gasto con el camino existente** (reusa la lógica de cuotas/período tal cual), obtiene su `id` (la madre, si es en cuotas) y luego inserta el/los reintegro(s) vinculados. Si el insert del reintegro falla, **borra el gasto** (`DELETE` de la fila o de la madre — el `ON DELETE CASCADE` de `parent_id` limpia las hijas, y la fila de reintegro fallida no existe). Devuelve error.

- **Por qué alcanza:** app de **un solo usuario**, concurrencia nula; el único modo de falla es un gasto sin su reintegro (un gasto válido, recuperable), no corrupción. El rollback lo deja limpio.
- **Trade-off:** no es atómico ante un crash entre los dos inserts (quedaría el gasto sin reintegro). Aceptable acá; si algún día se vuelve multi-usuario, se promueve a una RPC acotada.
- **Bonus:** no agrega otra migración para aplicar manualmente en el dashboard.

## Risks / Trade-offs

- **[`amount` no-final en pendientes]** → mitigado porque la regla central (Decisión 4) y los guards excluyen los pendientes de todo cálculo; el spec lo dice explícito para una sesión fresca.
- **[Cirugía sobre el trigger de invariantes de tarjeta]** → es el cambio más riesgoso (toca I-CRED-6). Mitigación: la migración trae self-check; tests de que un `reimbursement` con período + `status` NULL pasa, y que un `expense` de tarjeta sigue exigiendo `status`.
- **[Enum no-exhaustivo en `balance.ts`]** → mitigado con `assertNever`: el compilador obliga a manejar `reimbursement` y el próximo tipo.
- **[Categoría retirada con datos existentes]** → `ON DELETE RESTRICT` desde `transactions.category_id` impide borrarla; `is_active=false` es la vía segura y deja el historial intacto. Verificar que los pickers filtran `is_active=true`.
- **[Doble lectura del reintegro "a cuenta" en otra cuenta]** → un reintegro a la caja de ahorro por una compra hecha con tarjeta aparece en la caja con la categoría del gasto. Es correcto (la plata entró ahí); la perspectiva de cuenta lo muestra como entrante con su categoría heredada.

## Migration Plan

1. Migración: `ADD VALUE` del enum + columnas + CHECKs + trigger de integridad del vínculo + ajuste del trigger de tarjeta + función RPC del alta atómica + `is_active=false` en la categoría seed + self-check.
2. Regenerar `packages/supabase/src/types.ts` contra el proyecto remoto.
3. `money-logic`: integrar `reimbursement` en `calculateTransactionSums` y `computeRunningBalances` con `assertNever`; nuevos cálculos puros de neto por categoría y de reducción del total del período. Tests.
4. Web actions: crear-con-reintegro (RPC), confirmar/reconciliar, cancelar, editar/eliminar; guardas de edición del gasto origen.
5. Web UI: bloque "Tiene reintegro" en el form; fila del reintegro bajo el gasto; pantalla de confirmar; neto por categoría. i18n.
6. Verificación manual de los scenarios de la spec.

Rollback: revertir la migración requiere bajar columnas/trigger/función; el `ADD VALUE` de un enum no se revierte trivialmente en Postgres, así que el rollback real es dejar el tipo presente pero sin uso (sin filas `reimbursement`) y revertir el código.

## Resoluciones durante la implementación (verificadas en navegador)

Las Open Questions originales quedaron resueltas así al construir y probar V1:

- **Visibilidad del pendiente → bloque "A confirmar", no en el historial.** Decisión de UX del usuario: un reintegro pendiente es una expectativa, no un hecho; vive en un bloque **"Reintegros a confirmar"** arriba del listado (global y detalle de cuenta), mirror de `PendingRecurrencesBlock`. Sólo los **recibidos** entran al historial cronológico; los cancelados no aparecen. Esto resuelve también la confusión del color verde y del saldo corriente que no se movía. (`isHistoryRow` en `queries.ts`.)
- **Borrado del gasto origen → `ON DELETE CASCADE`** (el reintegro se va con el gasto). La edición de cuenta/moneda del gasto ya está bloqueada por diseño en v3 (campos inmutables post-creación).
- **Cuenta destino al alta**, prerellenada con la cuenta del **mismo banco/institución** que el gasto (Visa Comafi → banco Comafi). Refleja cómo funciona en la realidad.
- **Período del reintegro "en resumen" → derivado de la fecha** del consumo al confirmar (editable por el usuario); se valida que el período no esté pagado.
- **Categoría derivada vía segunda query**, no embed self-FK (PostgREST no resuelve `transactions → transactions` de forma confiable: PGRST200).
- **Atomicidad → orquestación TS con rollback** (no RPC; ver Decisión 9).
- **"Recibido ahora"** sí entró en V1 (no quedó diferido): el alta permite marcar el reintegro como ya acreditado.

### Diferido a V1.1 (fuera de alcance de este change)

- Reintegro sobre **compra en cuotas** (el bloque del form se oculta en cuotas).
- **Neto por categoría** como vista de analytics (la lógica pura `computeCategoryNet` ya existe; falta dónde mostrarla — el neteo en el resumen de tarjeta sí está vivo).
- Helper de **% + tope** en el alta (la función pura `suggestReimbursementAmount` ya existe).
- Editar/eliminar un reintegro por separado (hoy: confirmar/cancelar; borrar el gasto cascada).
- Copy **mode-aware** fino (novato vs experto) — V1 usa una línea clara para ambos.
- Reintegros pendientes `account` como "A cobrar" en el **dashboard**.
