# Design: fix-recurrence-projection-and-orphans

## Context

`packages/money-logic/src/recurrences.ts` tiene **dos caminantes del calendario** que responden la misma pregunta con criterios distintos:

- `getNextExpectedOccurrence` (`:228`) recibe `lastGeneratedDate` y salta toda ocurrencia en o antes del cursor. Su comentario explica por qué: sin eso, una regla cuya ocurrencia de hoy ya fue confirmada seguiría mostrando hoy como "próximo".
- `projectRuleOccurrences` (`:192`) camina desde `start_date` y empuja **toda** ocurrencia dentro de la ventana. No conoce el cursor.

Las cards "Próximos 7 días" / "Más adelante este mes" (`upcoming-recurrences.tsx:54-59`) usan la segunda. Resultado: toda regla creada desde un movimiento dibuja su propia semilla como próxima ocurrencia, y una regla cuya ocurrencia futura quedó registrada en `last_generated_date` dibuja una fila que el generador nunca va a producir. Esa superficie **no tiene ningún requirement** en `openspec/specs/transactions/spec.md` — se construyó sin spec, que es parte de por qué la divergencia pasó desapercibida.

En paralelo, `recurrences.created_from_transaction_id` es `ON DELETE SET NULL` (`0011_recurring_movements.sql:25`) y `deleteTransaction` (`packages/transactions-mutations/src/thin-mutations.ts`) no consulta `recurrences`. Borrar la semilla deja la regla viva y sin vínculo. Estado real hoy (4-ago-2026): 10 reglas huérfanas entre los 3 usuarios, de las cuales 2 quedaron inservibles porque su semilla borrada era futura.

## Goals / Non-Goals

**Goals:**

- Que la proyección de próximas ocurrencias y el generador coincidan siempre, por construcción y no por disciplina.
- Especificar las cards de próximas ocurrencias, hoy implementadas sin requirement.
- Que borrar un movimiento semilla sea imposible en silencio, para todo cliente (web, mobile, SQL manual).
- Reparar la clase de huérfanas que quedó inservible, sin tocar las que funcionan.
- Que un preset de frecuencia no pueda volver a mentir sobre su intervalo real.
- Hacer visibles las reglas duplicadas para que cada dueño resuelva las suyas.

**Non-Goals:**

- **No** se borran reglas duplicadas por migración. Elegir cuál sobrevive es criterio del dueño (categoría correcta, día de vencimiento real); una migración que lo decida por heurística es el mismo acto a escala.
- **No** se repara `last_generated_date` en huérfanas de fecha pasada (ver Decisión 4).
- **No** se toca `recurrence_instances.confirmed_transaction_id`, también `ON DELETE SET NULL`. Perder ese vínculo degrada la auditoría de una instancia ya confirmada pero no corrompe la generación (`last_generated_date` ya avanzó). Es un change aparte si duele.
- **No** se cambia la política de fechas futuras en el listado de movimientos: siguen visibles, según el requirement de saldo (`transactions/spec.md:74`) y las decisiones de `exclude-future-dated-from-balance` y `cut-month-lenses-at-today`.

## Decisions

### 1. Un solo caminante del calendario, dos wrappers finos

En vez de agregarle el cursor a `projectRuleOccurrences` y dejar dos implementaciones, se extrae un único `walkOccurrences(rule, { from, to, cursor })` que aplica en un solo lugar `max_occurrences`, `end_date`, el clamping de fin de mes y el cursor. `getNextExpectedOccurrence` pasa a ser "el primero que devuelve" y `projectRuleOccurrences` "todos los de la ventana".

Alternativa considerada: pasar `last_generated_date` a `projectRuleOccurrences` y listo. Se descarta porque deja las dos implementaciones vivas y el próximo criterio que se agregue (pausas, excepciones por fecha) vuelve a divergir. El defecto de este change **es** la divergencia, no el parámetro faltante.

`RuleForProjection` gana `last_generated_date: string | null`; el read del hub ya trae la columna (`RECURRENCE_SELECT`), así que no hay query nueva.

### 2. `ON DELETE RESTRICT` en vez de aviso en el frontend

La garantía baja a la base. Es el patrón que el repo ya usa para el mismo problema: `period_payments.transaction_id` es `ON DELETE RESTRICT` (`0010_credit_cards.sql:214`) y los FK de categorías/subcategorías también, con el razonamiento escrito en `categories/spec.md:133` — el bloqueo aplica a todos los clientes y no depende de que cada frontend lo recuerde.

Alternativas: (a) solo aviso en UI — la garantía vive en cada cliente y mobile o un SQL manual siguen huerfanizando; (b) cascada que borra la regla — destruiría reglas sanas (la regla `7c4cdf8e` de `azulpalau98` lleva generando desde junio y su semilla original es prescindible).

Costo aceptado: borrar un movimiento semilla pasa a ser una operación de dos pasos en todos los clientes.

### 3. Pre-chequeo para el mensaje, FK como red

El flujo de borrado **no** se apoya en atrapar el `23503` de Postgres. `deleteTransaction` consulta primero si existe una regla activa con `created_from_transaction_id = <tx>` y devuelve un resultado accionable (`errorCode: 'seeded_recurrence'` + el id y la descripción de la regla) para que el shell arme un diálogo con nombre propio. La FK queda como red de seguridad para los caminos que no pasen por la mutación compartida.

El diálogo ofrece dos salidas, y la elección importa:

- **Eliminar también la regla** → `deleteRecurrence` (que ya borra las instancias pendientes) y después el movimiento.
- **Conservar la regla, desvincular** → `UPDATE` explícito de `created_from_transaction_id = NULL` y después el movimiento. `RESTRICT` bloquea la cascada del DELETE, no un UPDATE deliberado.

### 4. Al desvincular, la regla se repara con el mismo criterio que la migración

Desvincular re-crea a propósito el estado huérfano, así que tiene que salir sano. Si la regla queda con `last_generated_date = start_date` y esa fecha es **futura**, el desvínculo SHALL además ponerla en `NULL`: la ocurrencia que ese `last_generated_date` decía cubrir es justamente el movimiento que se está borrando. Con `NULL`, el generador la emite como instancia pendiente en `start_date` y pasa por el gate de aprobación.

Ese es exactamente el predicado de la migración, y por eso la reparación se limita a esa clase:

| Estado | Qué pasa | Reparación |
|---|---|---|
| `lgd` avanzó más allá de `start_date` | Genera bien; solo se perdió el vínculo de auditoría | ninguna |
| `lgd = start_date`, **pasada** | Próximo disparo en `start + intervalo`, correcto | ninguna |
| `lgd = start_date`, **futura** | Afirma cubrir una ocurrencia inexistente; pierde ese período | `lgd = NULL` |

Poner `NULL` en la fila del medio sería peor que el bug: el generador emitiría una instancia pendiente fechada en el pasado, proponiendo re-crear un movimiento que el usuario borró a propósito. El spec garantiza que sería una sola instancia y no una por período vencido (`transactions/spec.md:1245`), pero una propuesta indeseada sigue siendo ruido.

### 5. La etiqueta de frecuencia se deriva del intervalo, no al revés

El motor ya obedece `interval_count`/`interval_unit` en todos los caminos. Normalizar `frequency` a partir del intervalo **no cambia cuándo dispara ninguna regla**: solo deja de mentir la etiqueta. Lo inverso (derivar el intervalo del preset) sí cambiaría comportamiento y está descartado.

Orden dentro de la migración: primero el `UPDATE` de normalización, después el `CHECK`. Al revés falla, porque hoy existe una fila que lo viola (`ccbe304a`).

El `CHECK` cubre los cuatro presets y deja `custom` libre:

```sql
check (
  frequency = 'custom'
  or (frequency = 'weekly'   and interval_count = 1 and interval_unit = 'week')
  or (frequency = 'biweekly' and interval_count = 2 and interval_unit = 'week')
  or (frequency = 'monthly'  and interval_count = 1 and interval_unit = 'month')
  or (frequency = 'annual'   and interval_count = 1 and interval_unit = 'year')
)
```

### 6. El aviso de duplicado no bloquea, y por eso puede errar

Clave de detección: reglas `status='active'` del mismo usuario con igual `(account_id, currency_code, movement_type, amount)`. Deliberadamente **no** incluye categoría ni descripción: en los duplicados reales observados esos campos difieren (una regla quedó en `impuestos` y su gemela en `impuestos / IIBB`), así que exigir igualdad los dejaría pasar.

La contracara es que produce falsos positivos: `malacalzamarcelo` tiene dos reglas de USD 20 en la misma tarjeta, "chat gpt" y "claude", que no son duplicados. Por eso el aviso **no bloquea** y muestra el título de la regla existente — el usuario distingue en un vistazo lo que la clave no puede. Un aviso bloqueante con esta clave sería un bug.

## Risks / Trade-offs

- **[Un DELETE en cascada legítimo choca contra el nuevo RESTRICT]** → Verificado contra el catálogo, no supuesto. Son **tres** los caminos que pueden borrar una fila de `transactions` sin que nadie la borre explícitamente, y ninguno puede alcanzar una semilla:
  1. `transactions.account_id → accounts ON DELETE CASCADE` (`0008_transactions.sql:16`): solo se dispara al eliminar una cuenta, y eliminar una cuenta ya está prohibido si tiene aunque sea una transacción (`accounts/spec.md:239`).
  2. `transactions.parent_id → transactions ON DELETE CASCADE` (`0010_credit_cards.sql:153`): borrar la madre de una compra en cuotas borra las hijas. Una hija nunca es semilla — el toggle de recurrencia está bloqueado para cuotas (`use-movement-form.ts:566`, `!isInstallments`) y la spec lo confirma (`transactions/spec.md:1453`).
  3. `transactions.linked_transaction_id → transactions ON DELETE CASCADE` (`0018_reimbursements.sql:15`): borrar un gasto borra sus reintegros vinculados. Un reintegro nunca es semilla: `movement_type` de una recurrencia solo admite `income`/`expense`/`transfer` (`validation/src/recurrences.ts:92-113`) y no hay camino de UI que cree una recurrencia desde un reintegro.

  Corolario para el pre-chequeo: como ningún descendiente de una cascada puede ser semilla, alcanza con chequear **la fila que se borra**, sin recorrer sus descendientes. Los puntos 2 y 3 son garantías por construcción del código, no por constraint, así que el `RESTRICT` queda como red: si alguna vez se habilitara una recurrencia sobre una cuota o un reintegro, el borrado fallaría ruidosamente en vez de corromper en silencio.
- **[Clientes que hoy borran sin manejar el nuevo error]** → El pre-chequeo vive en la mutación compartida que web y mobile ya consumen, así que ambos heredan el camino feliz. El mapeo de `23503` se agrega igual al traductor de errores para el caso residual.
- **[La proyección "pierde" filas que el usuario venía viendo]** → Es el defecto, no una regresión: cada fila que desaparece corresponde a una ocurrencia ya materializada. Verificado contra los datos reales: las reglas sanas de los tres usuarios conservan sus fechas proyectadas y solo se caen las cubiertas.
- **[La migración de `lgd` repara 0 filas en producción]** → Cierto: hoy las 2 filas que matchean se van a borrar antes por limpieza manual. Se incluye igual para que el estado sea irreparable-por-construcción y no dependa de que alguien corra SQL a mano.
- **[Fricción real al borrar]** → Un usuario que quiere borrar un movimiento cargado por error y no le importa la regla ahora hace dos clicks. Mitigado por la salida "conservar la regla, desvincular", que es un click y deja todo sano.

## Migration Plan

Una sola migración, en este orden (los pasos 1–2 son interdependientes):

1. `UPDATE` de normalización de `frequency` a partir de `interval_count`/`interval_unit`.
2. `ALTER TABLE ... ADD CONSTRAINT` del `CHECK` de coherencia preset↔intervalo.
3. `UPDATE` de reparación de `last_generated_date = NULL` en la clase huérfana-futura (predicado de la Decisión 4).
4. `DROP CONSTRAINT` + `ADD CONSTRAINT` del FK `created_from_transaction_id` con `ON DELETE RESTRICT`.

Rollback: revertir el paso 4 a `ON DELETE SET NULL` y dropear el `CHECK` del paso 2 restauran el comportamiento anterior. Los pasos 1 y 3 no se revierten — normalizan datos hacia un estado que también es válido bajo el esquema viejo.

## Open Questions

- El aviso de reglas casi idénticas en el hub, ¿es un badge por fila o una franja agrupada arriba? Se resuelve al implementar; no cambia el contrato de la spec.
