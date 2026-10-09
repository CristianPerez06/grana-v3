## Context

Ver `proposal.md` para el porqué. Estado actual:

- `recurrence_link_candidates` (0072) filtra en línea: mismo tipo y moneda, `is_parent = false`, tipo
  distinto de `settlement`/`reimbursement`, ventana del calendario, no vinculado, y la regla de
  compartido. No mira `parent_id` (cuotas hijas) ni `period_payments` (débito de pago de resumen e
  impuesto de sellos).
- `recurrence_link_movement` (0074, la versión vigente) solo valida tipo y moneda, que no esté ya
  vinculado y lo de compartido. Lo que la lista esconde, vincular lo acepta.
- `getRecurrenceLinkCandidates` (`@grana/recurrences/src/link.ts`) devuelve lo que trae el RPC: ids de
  cuenta y categoría, sin subcategoría ni nombres. Las dos pantallas muestran
  `description || t('no_description')` y comparan importes con `Math.abs(a - b) > 0.004`.
- Las filas de «por revisar» ya traen categoría, subcategoría y cuenta embebidas
  (`INSTANCE_SELECT`) y cada app las nombra con `recurrenceTitle` + sus ayudantes de traducción
  (`getCategoryName`/`getSubcategoryName` en web, `categoryName`/`subcategoryName` en nativo).

## Goals / Non-Goals

**Goals:**
- Una sola definición en SQL de «movimiento vinculable», la que usan la lista y vincular.
- Nombrar los candidatos con lo que la app ya hace, sin otra manera de resolver nombres.

**Non-Goals:**
- Cambiar el orden, la ventana o «Ampliar la búsqueda».
- Reparar vínculos existentes a cuotas o a débitos de pago (spec: se conservan).
- Unificar la fila del candidato con la fila de «por revisar» (son filas distintas).

## Decisions

**1. Una función SQL `recurrence_movement_linkable(t public.transactions) returns boolean`.**
Recibe la fila y responde si puede resolver un vencimiento:
`not coalesce(is_parent, false)`, `parent_id is null`, tipo fuera de `settlement`/`reimbursement`,
y que no exista `period_payments` con `transaction_id = t.id` o `stamp_tax_transaction_id = t.id`.
`recurrence_link_candidates` la usa en su `where`. `recurrence_link_movement` la evalúa después del
chequeo de tipo y moneda (GRN11) y antes del de «ya vinculado» (GRN12), y rechaza con
`movement_not_linkable` / `GRN19`. Es `security invoker`, así que lee `period_payments` con el RLS del
dueño, que es el único que puede vincular.
Por qué así: es el mismo patrón de 0072 con `recurrence_admits_occurrence`, una regla que comparten
dos caminos para que no contesten distinto. Recibe la fila y no un id para que la lista no haga un
segundo acceso por candidato.

**2. Los nombres se resuelven en `getRecurrenceLinkCandidates` con un select embebido.**
Después del RPC se hace un único `.from('transactions').select(...)` filtrado por esos ids, que
embebe `account:accounts!transactions_account_id_fkey(id, name, type)`,
`category:categories(id, name, canonical_name, color, icon, user_id)` y
`subcategory:subcategories(id, name, canonical_name, category_id, user_id)`: las mismas columnas que
`INSTANCE_SELECT`. Se fusiona con el resultado del RPC conservando su orden. `LinkCandidate` suma
`account`, `category` y `subcategory`. Cada app nombra la fila con `recurrenceTitle` y los ayudantes
que ya usa para las ocurrencias, y muestra `account.name` en el subtítulo junto a la fecha.
Por qué no en el RPC: las categorías del sistema se traducen en el cliente por `canonical_name`, así
que el RPC tendría que devolver las mismas columnas en otra forma, cambiar su tipo de retorno
(`drop function` + `types.ts`) y dejar dos maneras de traer una clasificación. El select embebido
reutiliza la forma que las pantallas ya saben leer. Cuesta una consulta más, y la lista es corta
(la ventana es de uno o tres vencimientos para cada lado).

**3. La diferencia de importe vive en el paquete.** `@grana/recurrences` exporta
`linkAmountDiffers(candidateAmount, ruleAmount)`, que compara con `Money.compare` de
`@grana/validation`. Las dos pantallas la llaman en lugar de `Math.abs(...) > 0.004`.

**4. Código de rechazo nuevo, no reutilizar GRN11.** El texto de GRN11 dice «no es del mismo tipo o
moneda». Para una cuota eso sería falso. `GRN19` → `movement_not_linkable` en
`RPC_ERROR_BY_SQLSTATE`, en `link-messages.ts` y en los catálogos `es`/`en`
(`recurrences.link.errors.movement_not_linkable`).

**5. Migración `0076_link_eligibility.sql`.** `create or replace` de las dos funciones, con las
firmas y el tipo de retorno sin cambios, más la función nueva con sus `revoke`/`grant`. Un bloque `do`
final verifica que existe y que las dos funciones la referencian, al estilo de 0072/0074. El cuerpo
de `recurrence_link_movement` parte de **0074**, la versión vigente, no de 0072.

## Risks / Trade-offs

- [El arnés PGlite no tiene `parent_id` ni `period_payments`] → se agregan al esquema de
  `recurrence-identity-db.ts` (columnas reducidas a lo que la función lee) y el arnés aplica 0076.
  Sin eso, el test pasaría contra una tabla que no tiene lo que la regla mira.
- [Partir de 0072 en vez de 0074 al redefinir vincular] → borraría la foto del movimiento que 0074
  arregló. La tarea dice explícitamente desde qué archivo se copia, y los tests de 0074 siguen
  corriendo.
- [El select embebido por ids se aplica después del RPC] → si un candidato desaparece entre las dos
  lecturas, se descarta en la fusión en lugar de mostrarse sin nombre.

## Migration Plan

Pegar `0076` en el SQL Editor del proyecto online después de 0075. Es reversible volviendo a pegar
las definiciones de 0072 (candidatos) y 0074 (vincular). No toca datos.
