## Context

Tras los Changes 1 (reconstrucción de la lista) y 2 (filtros) el módulo quedó con la lista y los filtros unificados, pero la **creación y la edición siguen fragmentadas** en cinco formularios sobre dos jerarquías de ruta:

- `apps/web/app/(app)/transactions/new/_components/movement-form.tsx` — creación global. Ya maneja los cinco tipos (tabs ingreso/gasto/transferencia/ajuste/cambio), consumos de tarjeta, cuotas (ARS), cotización (USD) y alta de recurrencia. Llama a `createIncome/Expense/Transfer/Adjustment/Exchange` + `registerCardPurchase/registerInstallments`. **No edita.**
- `accounts/[id]/transactions/new/_components/{transaction-form,register-card-purchase-form}.tsx` — creación scoped (redundante con el anterior).
- `accounts/[id]/transactions/[txId]/edit/_components/{edit-transaction-form,edit-exchange-form}.tsx` — edición scoped. Reciben `amountEditable` (calculado en la página: `status !== 'paid'`, o para la madre `!hijasPagadas`) y bloquean campos según tipo/estado.

El detalle global ya es canónico (`/transactions/[txId]`, neutral de ruta) y respeta `?from=account:<id>` para el back-nav (Change 1). La edición y el alta, en cambio, siguen pasando por el árbol scoped.

Restricciones del dominio que el diseño respeta: bimoneda (saldos por moneda, nunca sumados), off-ledger (tarjetas sin saldo disponible), fechas contables, las reglas de editabilidad ya especificadas (tipo/cuenta/moneda inmutables; consumo `paid` bloquea monto/fecha; madre de cuotas re-divide si no hay cuota paga y nunca edita fecha), y la perspectiva cuenta/global del Change 1.

## Goals / Non-Goals

**Goals:**
- Un único `MovementForm` que crea y edita todos los tipos.
- Reglas de editabilidad extraídas a `getEditableFields(tx)` puro en `@grana/money-logic` (fuente de verdad, testeada, reusable por mobile).
- Rutas canónicas: detalle `/transactions/[txId]`, edición `/transactions/[txId]/edit`, alta `/transactions/new`. Eliminar el árbol scoped.
- Contexto de cuenta por query params (`?account=`, `?from=`).
- Saldo por moneda en el selector de cuenta del alta.

**Non-Goals:**
- Cambiar las **reglas** de editabilidad o de creación (sólo se centralizan/mueven).
- Quick-add/FAB, detalle como drawer, empty states de 3 variantes (Change 4); resumen en dashboard.
- Mobile (lo maneja el tech lead; la función pura queda disponible).

## Decisions

### Decisión 1: `getEditableFields(tx)` puro en money-logic como única fuente de verdad

Las reglas de "qué campo se puede editar" hoy están repartidas entre la página de edición (cálculo de `amountEditable`) y los dos formularios scoped (gating por tipo/estado/`isParent`/`isCardPayment`). Se extraen a una función pura en `@grana/money-logic`:

```
getEditableFields(input: MovementEditInput): EditableFields
```

- **Entrada** (datos ya disponibles, sin I/O): `type`, `status` (`pending|paid|null`), `isParent`, `isCardPayment` (gasto que es pago de resumen → sin categoría), `hasPaidInstallment` (para la madre; lo computa el server fetchando la familia, como hoy).
- **Salida**: booleanos de editabilidad — `amount`, `date`, `category`, `subcategory`, `description`, `adjustmentDirection`, `destinationAmount` (pata recibida del cambio) — más `showCategory` (false para pago de resumen, que oculta la categoría).
- **Reglas** (sin cambios respecto de las actuales): descripción siempre editable; tipo/moneda/cuenta nunca (no son parte de la salida, son contexto inmutable); transferencia → monto+fecha+descripción; ajuste → +dirección; cambio → monto+`destinationAmount`+fecha; consumo `pending` → monto+fecha+categoría; consumo `paid` → sólo categoría/descripción; madre → categoría/descripción siempre, monto sólo si `!hasPaidInstallment` (re-divide), fecha nunca.

El formulario consulta el descriptor y se vuelve un **renderizador tonto**: la complejidad (la matriz tipo × estado) vive en una función chica y testeada, siguiendo el patrón del Change 1 (`resolveMovementView`, `summarizePeriod`).

- **Alternativa descartada**: dejar el gating en el componente. Es lo que hoy duplica la regla y la divergió; mover a money-logic la hace testeable exhaustivamente y reusable por mobile.

### Decisión 2: el formulario único maneja todos los tipos (incluido cambio y madre de cuotas)

`MovementForm` recibe una transacción opcional. **Sin transacción → modo creación** (comportamiento actual: tabs de tipo, selección de cuenta, recurrencia, cuotas/cotización). **Con transacción → modo edición**: se ocultan las tabs y los controles propios del alta (recurrencia, selección de cuotas nuevas); el tipo, la moneda y la(s) cuenta(s) se muestran como contexto inmutable; los campos se gatean por `getEditableFields`; el submit llama a las actions `updateX` correspondientes y vuelve a `returnHref`.

El cambio de moneda (dos montos) y la madre de cuotas (re-división) entran en el mismo formulario porque el descriptor ya expresa sus campos (`destinationAmount`, `amount` re-divisor). Se eligió **incluirlos** —en vez de dejar el cambio aparte— porque el alta ya conoce la forma de dos patas del exchange, y "un formulario" es más explícito para una sesión fresca que "un formulario + una excepción". El riesgo se controla con la Decisión 1 + verificación por tipo.

- **Alternativa descartada**: mantener un editor dedicado para el cambio. Ahorra poco y reintroduce un segundo formulario.

### Decisión 3: rutas canónicas bajo `/transactions`; cuenta por query param

Un movimiento = una URL. El detalle ya es `/transactions/[txId]`; se agrega `/transactions/[txId]/edit`, y el alta canónica es `/transactions/new`. El contexto de cuenta se transmite por params:

- `?account=<id>` en el alta → pre-selecciona la cuenta (CTA desde detalle de cuenta o de tarjeta). Si `<id>` es una tarjeta de crédito, el formulario arranca en la tab Gasto (único tipo válido para tarjeta).
- `?from=<origen>` → back-nav y perspectiva. En el alta, al guardar, vuelve al origen (`/accounts/<id>` o `/cards/<id>`) o a `/transactions` si no hay `from`. En detalle/edición, ajusta el botón "volver".

Se elimina el árbol scoped `/accounts/[id]/transactions/*`. La lista de la cuenta (que vive en `/accounts/[id]`, no se toca) enlaza sus filas a `/transactions/[txId]?from=account:<id>`.

### Decisión 4: borrado duro de las rutas scoped (sin redirects)

App personal en rebuild activo, un solo usuario, sin bookmarks externos. Todos los enlaces internos se recablean en este change, así que nada dentro de la app queda colgado. Dejar redirects reintroduciría el doble-camino que el colapso busca eliminar (la duplicación es la causa raíz de los bugs del módulo) y sería deuda a limpiar. Best practice para un refactor interno sin consumidores externos: actualizar call-sites y borrar.

### Decisión 5: saldo por moneda en el selector de cuenta (sólo alta)

`MovementForm` ya recibe `balances: Record<'ARS'|'USD', number>` por cuenta. Se renderiza el saldo disponible junto a cada cuenta de efectivo/banco en el selector del alta (por moneda, bimoneda-aware). Las tarjetas no muestran saldo (off-ledger, `{0,0}`). En modo edición la cuenta es contexto inmutable; mostrar su saldo ahí es opcional y queda fuera del foco.

### Decisión 6: `revalidatePath` apunta a la ruta canónica

Las actions revalidaban `'/accounts/${accountId}/transactions/${id}'`. Al desaparecer esa ruta, pasan a `'/transactions/${id}'` (y se conserva la revalidación de `/transactions`, `/accounts/[id]`, `/cards/[id]` donde corresponda para los saldos derivados).

## Risks / Trade-offs

- **[Formulario único = mucha superficie condicional]** → Mitigado por la Decisión 1 (la matriz vive en `getEditableFields` puro + tests por tipo × estado) y por construir **primero la lógica, después la UI**, con verificación manual por cada tipo (ingreso, gasto, transfer, ajuste, cambio, consumo pending/paid, madre con/sin cuota paga).
- **[Un enlace interno olvidado al borrar el árbol scoped]** → Se enumeraron todos los call-sites (CTA de alta en cuenta/tarjeta, pago de resumen, filas de tarjeta/período, "ver en cuenta", edit del detalle global y del header scoped). El build de TS rompe ante imports muertos; verificación manual por punto de entrada.
- **[`?account=` apuntando a una tarjeta en un tipo no-gasto]** → El alta fuerza la tab Gasto cuando la cuenta pre-seleccionada es de crédito.
- **[Retorno tras crear desde una tarjeta]** → `?from=card:<id>` lleva de vuelta a `/cards/[id]`; sin `from`, a `/transactions` (preserva el requirement del Change "make-movements-actionable").
- **[Edición de la madre re-divide cuotas]** → comportamiento existente (`updateInstallmentParent`); se preserva tal cual, sólo cambia quién renderiza el formulario.

## Open Questions

- ¿El alta lanzada desde una tarjeta (`?account=card`) debe **bloquear** el cambio de tipo a no-gasto, o sólo pre-seleccionar Gasto y permitir cambiar? Probablemente pre-seleccionar y, si el usuario cambia a un tipo que no admite tarjeta, reasignar a la primera cuenta cash/bank elegible (como hace hoy `handleTabChange`). A confirmar en implementación.
- ¿El selector en modo edición muestra también el saldo de la cuenta (inmutable)? Por defecto no; se evalúa si aporta.
