# Design — Deshacer el pago de un resumen

## Contexto: qué escribe un pago

`payCardPeriod` (`packages/cards/src/pay-card-period.ts`) hace dos clases de escrituras, y la distinción es el eje de todo este change:

```
  payCardPeriod
  │
  ├─ 📅 CALENDARIO ──────────────────────────────── irreversible por diseño
  │    · confirma P(n+1): end_date, due_date, is_estimated = false
  │    · crea el período estimado "eager" P(n+2)
  │    · reasigna consumos entre períodos (shift_extend / shrink / reproject)
  │    · deriva y persiste accounts.stamp_tax_rate (solo si era NULL)
  │
  └─ 💰 PLATA ─────────────────────────────────────  esto es lo que se revierte
       · INSERT gasto-débito en la cuenta de pago (status = null, card_period_id = null)
       · INSERT sello (card_period_id = período, status = 'pending')
       · UPDATE del período: pending → paid (barre todos los movimientos)
       · INSERT period_payments (period_id UNIQUE, transaction_id)
```

## Decisión 1 — La reversión revierte la plata, no el calendario

**Deshacer un pago NO deshace la confirmación de fechas del ciclo en curso, ni el período estimado creado, ni las reasignaciones de consumos.**

El propio `payCardPeriod` ya razona así cuando el pago falla a mitad de camino:

> *"confirmed dates are real-world facts, so if the payment fails afterwards they harmlessly stay confirmed"*

Las fechas del ciclo en curso las leyó el usuario del resumen en papel: son verdad independientemente de si el pago se cargó bien. Además, desandarlas sería activamente dañino:

- volver `is_estimated = true` un período que ya es real degrada información;
- las reasignaciones de consumos entre períodos (`shift_extend` / `shrink`) no son invertibles sin reconstruir el estado previo, que no se persiste en ningún lado;
- el período "eager" siguiente puede ya tener consumos imputados.

**Consecuencia para el usuario:** deshacer y volver a pagar el resumen le vuelve a pedir las fechas del ciclo en curso, pre-cargadas con las ya confirmadas. Correcto: son las mismas fechas.

**Alternativa descartada:** snapshot del estado de calendario dentro de `period_payments` para restaurarlo. Agrega una tabla de historial y un modo de fallo nuevo (restaurar un snapshot sobre un período que ya cambió) para revertir algo que no queremos revertir.

## Decisión 2 — La alícuota de sellos no se revierte

`accounts.stamp_tax_rate` se deriva y persiste solo la primera vez (si era `NULL`). Deshacer el pago **no** la vuelve a `NULL`.

Es aprendizaje sobre la tarjeta, no plata del usuario; y el propio flujo de pago ya deja el monto del sello siempre editable, así que una alícuota mal aprendida se corrige naturalmente en el próximo pago. Volverla `NULL` reintroduciría el interrogatorio de primera vez sin beneficio.

## Decisión 3 — El sello se vincula explícitamente, no por heurística

Hoy el movimiento de sello no tiene ninguna referencia al pago:

```
   period_payments
   ├─ period_id       ──► card_periods    (UNIQUE ✓)
   ├─ transaction_id  ──► gasto-débito     ✓ linkeado
   └─ ??? ─────────────► sello              ✗ huérfano
```

Identificarlo por heurística (`card_period_id = X` + subcategoría `impuesto-de-sellos` + `status = 'paid'`) borra el movimiento equivocado si el usuario cargó un sello a mano en esa tarjeta. Dejar un borrado adivinado dentro de una operación destructiva es deuda que muerde.

**Se agrega `period_payments.stamp_tax_transaction_id UUID NULL REFERENCES transactions(id) ON DELETE SET NULL`**, que `payCardPeriod` completa al insertar el sello.

`ON DELETE SET NULL` (y no `RESTRICT`) porque el sello sí es un movimiento borrable de forma independiente: si el usuario lo borra por su cuenta, el vínculo se limpia y la reversión simplemente no tiene nada que borrar.

**Pagos anteriores a la migración** quedan con la columna en `NULL`. Para ellos la reversión cae en la **heurística como fallback**, y solo borra el sello si encuentra **exactamente uno** que matchee; si encuentra más de uno, no borra ninguno y avisa. La migración no intenta backfillear: adivinar hacia atrás tiene el mismo problema que adivinar hacia adelante, pero sin que el usuario esté mirando.

**Refinamiento surgido al implementar (mig 0050).** Un `NULL` en `stamp_tax_transaction_id` es *ambiguo*: puede significar "este pago no tuvo sello" o "este pago es viejo y no supo registrar el vínculo". Sin distinguirlos, un pago **nuevo sin sello** caería igual en la heurística y podría borrar un sello que el usuario cargó a mano — exactamente el riesgo que la Decisión 3 vino a eliminar.

Se agrega entonces `period_payments.stamp_tax_link_known boolean not null default true`, que la migración pone en `false` para todas las filas existentes:

```
   stamp_tax_link_known = false  → pago viejo   → NULL es ambiguo → heurística (si es única)
   stamp_tax_link_known = true   → pago nuevo   → NULL significa "no hubo sello", punto
```

Así la heurística queda acotada a la ventana histórica real y desaparece sola con el tiempo, en vez de quedar como un camino vivo para siempre.

## Decisión 4 — Atomicidad en base, vía RPC `SECURITY INVOKER`

La reversión es una RPC `revert_card_period_payment(p_period_id UUID)`, gemela de `unshare_movement` (mig 0048).

`payCardPeriod` orquesta desde el cliente con rollback manual paso a paso — un patrón que ahí se tolera porque cada paso falla ruidosamente y el rollback es un borrado de filas recién creadas. Para la reversión no alcanza: el paso `paid → pending` toca movimientos que **ya existían** antes de la operación, y un fallo a mitad de camino deja el resumen en un estado que nadie puede reconstruir (¿qué movimientos eran `pending` antes?).

`SECURITY INVOKER` (no `DEFINER`), igual que `unshare_movement`: la RLS del usuario sigue aplicando y la función no puede tocar datos ajenos. La verificación de propiedad de la tarjeta se hace explícita igual, para dar un error claro en vez de un no-op silencioso.

Orden dentro de la RPC:

```
  1. verificar propiedad de la tarjeta        → si no, error de acceso
  2. guarda de orden cronológico (Decisión 5) → si no, GRN02
  3. DELETE period_payments (period_id)         ← libera el FK RESTRICT
  4. UPDATE transactions SET status='pending'
       WHERE card_period_id = período AND status = 'paid'
  5. DELETE del sello (por vínculo, o fallback heurístico único)
  6. DELETE del gasto-débito (transaction_id)
```

El paso 4 va **antes** de borrar el sello a propósito: el sello queda `paid` como el resto del período, así que primero vuelve a `pending` junto con todo y después se borra. Invertir el orden dejaría el mismo resultado, pero este orden hace que cada paso sea el espejo exacto de `payCardPeriod`.

El paso 4 es simétrico y seguro porque `period_payments.period_id` es `UNIQUE` y el pago se rechaza si el período ya tiene uno: un período solo pudo haber sido barrido a `paid` **una vez**. No hay movimientos que estuvieran en `paid` por otra razón.

## Decisión 5 — Guarda de orden cronológico

**No se puede deshacer el pago de un resumen si un resumen posterior de la misma tarjeta ya está pagado.** La RPC lanza `SQLSTATE GRN02`, que la app mapea a un mensaje amable ("deshacé primero el pago del resumen de {mes}").

Sin la guarda, un usuario podría dejar el resumen de marzo impago con abril y mayo pagados: un estado que el modelo permite pero que ninguna pantalla comunica bien, y del que se sale solo deshaciendo todo igual. Es el mismo espíritu que las guardas temporales de liquidaciones (mig 0043 + 0049): impedir que una reversión reescriba un pasado sobre el que ya se construyó.

Se reusa el patrón de `SQLSTATE` custom → mensaje amable ya establecido con `GRN01`.

## Decisión 6 — El punto de entrada vive en la tarjeta

"Deshacer pago" es una acción del **detalle del período** (`/cards/[id]/periods/[periodId]`), no del detalle del movimiento.

Borrar un gasto y que como efecto colateral se despague un resumen entero invierte la relación: el gasto-débito es una consecuencia del pago, no el pago. En el período, en cambio, el usuario ve exactamente lo que va a volver a `pending`.

En el detalle del movimiento, "Eliminar" sobre un pago de resumen pasa a **bloquear y redirigir**, exactamente como ya hacen las guardas de cuota hija ("eliminá la compra completa desde el movimiento padre") y de liquidación ("revertila desde la cuenta corriente"). El copy `delete_warning_card_payment`, que hoy promete una reversión inexistente, se elimina.

La confirmación de "Deshacer pago" enumera qué se revierte, con los números reales: monto que vuelve a la cuenta, cantidad de movimientos que vuelven a pendiente, y el sello si existe.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Operación destructiva sobre plata | Atomicidad en RPC; confirmación que enumera efectos con números reales |
| Sello mal identificado en pagos viejos | Fallback heurístico solo si hay **exactamente un** candidato; si no, no borra y avisa |
| Estado inconsistente entre resúmenes | Guarda de orden cronológico (`GRN02`) |
| El usuario espera que "deshacer" también revierta las fechas | La confirmación aclara explícitamente que las fechas del ciclo confirmado se mantienen |
