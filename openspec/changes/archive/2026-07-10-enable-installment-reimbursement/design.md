## Context

El reintegro (`type='reimbursement'`) ya está modelado como movimiento propio vinculado al gasto origen vía `linked_transaction_id` (mig `0018_reimbursements.sql`). El alta declara el reintegro **inline** con la creación del gasto, atómicamente, vía `insertDeclaredReimbursement` (`packages/transactions-mutations/src/internal/declared-reimbursement.ts`).

Hay tres orchestrators de alta de gasto:
- `createExpense` (gasto cash/débito) — **procesa** `data.reimbursement`.
- `registerCardPurchase` (compra de un pago en tarjeta) — **procesa** `data.reimbursement`, con default de `card_period_id` al período de la compra para el subtipo "en resumen".
- `registerInstallments` (compra en cuotas) — **NO procesa** reintegro: ni el schema tiene el campo, ni el orchestrator lo inserta, ni el form lo manda.

El bloqueo es puramente de wiring/UI. La base **ya** contempla el caso: el trigger `trg_fn_reimbursement_invariants` tiene un branch `is_parent` que valida "reintegro en resumen sobre la madre de una compra en cuotas, cuyas hijas están en tarjeta". La madre es un `expense` off-ledger (`account_id = NULL`, `is_parent = true`); el subtipo "a cuenta" del trigger ni siquiera mira `is_parent` (sólo exige que el linked sea un `expense` del mismo usuario), así que "a cuenta" es trivialmente válido.

## Goals / Non-Goals

**Goals:**
- Habilitar el reintegro inline en el alta de una compra **en cuotas**, con paridad de features respecto a la compra de un pago: ambos subtipos (a cuenta / en resumen) y ambos estados (recibido / pendiente).
- Mantener la atomicidad (madre + cuotas + reintegro) y el rollback.
- Preservar los contratos de la capa compartida que consume la app nativa (mismos tipos de input, mismo comportamiento de `insertDeclaredReimbursement`).

**Non-Goals:**
- Agregar o editar un reintegro sobre una compra en cuotas **ya existente** (flujo posterior — backlog #3). El toggle sigue gateado por `!isEdit`.
- Resolver la coherencia de la **lente devengada** (la cuota cuenta por vencimiento, el reintegro por su fecha → netean en meses distintos). Se documenta; se resuelve con backlog #1 (`spending-accrual-and-lenses`).
- Cambios de esquema o migraciones nuevas. Ninguno es necesario.
- UI nativa (mobile). Se deja la capa compartida lista; el cableado de la pantalla nativa lo lleva el tech lead.

## Decisions

### 1. El reintegro se vincula a la MADRE, no a una cuota hija

`linked_transaction_id = parent.id`. La madre es el `expense` que representa la compra completa; las cuotas hijas son su materialización mensual en la tarjeta. El reintegro corresponde a la compra completa (un único monto, no cuotificado), así que la madre es el ancla natural.

- Para "a cuenta": el trigger sólo exige linked = `expense` del mismo usuario. La madre califica. Cero riesgo.
- Para "en resumen": el trigger, al ser `is_parent`, deriva el tipo de cuenta desde una cuota hija (`JOIN accounts` sobre `parent_id`) y verifica que sea `credit`. Las hijas están en la tarjeta. Válido por diseño.

*Alternativa descartada:* vincular a la primera cuota hija. Rompería la semántica (el reintegro no es de una cuota puntual) y ataría el reintegro al ciclo de vida de una hija.

### 2. "En resumen" cae en el período de la primera cuota, sin picker

Espeja `register-card-purchase.ts:132-134`: `card_period_id ?? periodIds[0]`. `periodIds[0]` es el período de la fecha de compra (la primera cuota), el mismo resumen donde una compra 1× habría caído. La ambigüedad "¿qué período de los N?" se resuelve por convención (el primero), y el usuario reconcilia el período real al **confirmar** el reintegro (`confirmReimbursement` acepta `card_period_id` opcional). Sin UI de picker.

*Alternativa descartada:* pedir un picker de cuota/período en el alta. Agrega superficie de UI y decisión al usuario para un caso donde el default es casi siempre correcto y es reconciliable después.

### 3. Herencia del split: una fila de reintegro con los % del hogar

`insertDeclaredReimbursement` recibe `shared = data.shared` y aplica los mismos porcentajes al monto del reintegro mediante `applySharedSplits`. En una compra en cuotas compartida, los splits del **gasto** viven en las N cuotas hijas, pero el **reintegro** es una sola fila con su propio split. El motor de deuda (`collectDebtInputs`) suma splits por hogar/moneda **sin match fila-a-fila**, así que "N filas de gasto vs 1 fila de reintegro" es coherente: la deuda derivada resta la parte del reintegro una vez, cuando está recibido.

### 4. Orden de inserción y rollback, espejando `registerCardPurchase`

Secuencia en `registerInstallments`: validar → verificar tarjeta → split + períodos → guardas (backdate / período pagado) → insertar **madre** → insertar **cuotas** → declarar **reintegro** (linked = madre) → aplicar **splits** a las cuotas.

Rollback best-effort (el paquete no asume transacciones Postgres):
- Falla el reintegro → borrar cuotas + madre. El reintegro (si alcanzó a insertarse parcialmente) cascadea vía `ON DELETE CASCADE` de `linked_transaction_id` al borrar la madre.
- Falla el split de las cuotas → borrar cuotas + madre (cascadea el reintegro).

### 6. El reintegro impacta ENTERO en el mes de la primera cuota (confirmado en QA)

Un reintegro sobre una compra en cuotas devenga **completo en su propio mes** (el de la primera cuota / fecha de compra), NO se reparte entre las N cuotas. Consecuencia: si el reintegro es mayor que la cuota que devenga ese mes, la categoría queda **negativa** y se muestra como crédito ("te devolvieron"), separada de la dona — comportamiento ya previsto por el spec `spending-by-category`.

Verificado con data real (QA 2026-07-09): compra $60.000 en 6 cuotas ($10.000/cuota) + reintegro `statement` recibido de $12.000 → julio: `$10.000 − $12.000 = −$2.000` crédito en Hogar; ago–dic: $10.000/mes. Total del semestre `$48.000 = $60.000 − $12.000`. El reintegro se guarda en **una fila de $12.000** (no dividido).

*Alternativa evaluada y descartada por el usuario:* consumir el reintegro cronológicamente contra las cuotas (julio neto $0, el excedente baja agosto) para que ningún mes quede como crédito. Se prefiere el impacto entero en el primer mes por simplicidad y por respetar "el reintegro no se divide".

### 5. Levantar el gateo en las cuatro capas

1. **Schema** (`packages/validation/src/credit-cards.ts`): `registerInstallmentsSchema` suma `reimbursement: reimbursementDeclarationSchema.optional().default(undefined)`, idéntico a `registerCardPurchaseSchema`.
2. **Orchestrator** (`register-installments.ts`): implementa las Decisiones 1–4.
3. **Form hook** (`packages/movement-form/src/use-movement-form.ts`): quitar `&& !isInstallments` del `if` que arma `reimbursementDecl`; pasar `reimbursement: reimbursementDecl` en el dispatch de `registerInstallments`. El resolver de cuenta (`statement → accountId = la tarjeta`) ya funciona sin cambios.
4. **UI web** (`apps/web/lib/transactions/components/movement-form.tsx`): `showReimbursementToggle = !isEdit && tab === 'expense'` (quitar `&& !isInstallments`). El selector de subtipo account/statement ya se muestra para `isCredit`; no requiere cambio.

## Risks / Trade-offs

- **Lente devengada inconsistente entre cuota y reintegro** → Documentado como comportamiento conocido; la deuda liquidable (base caja) es correcta, sólo la vista devengada muestra el neteo en meses distintos. Se resuelve junto con backlog #1.
- **Rollback best-effort deja huérfanos si el delete falla** → Es el mismo modelo ya vigente en `registerInstallments` y `registerCardPurchase`; no se introduce un riesgo nuevo. El `ON DELETE CASCADE` cubre el reintegro al borrar la madre.
- **El usuario podría esperar elegir el período del reintegro "en resumen"** → Mitigado con la convención "primera cuota" + reconciliación al confirmar. Si en QA resulta confuso, es un ajuste de UI aislado, no un cambio de modelo.

## Migration Plan

Sin migración de base. Cambios solo en `validation`, `transactions-mutations`, `movement-form` y la UI web. Rollback = revertir el commit; no hay estado persistido nuevo que limpiar.
