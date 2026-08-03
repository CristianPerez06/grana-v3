# Deduplicar los invariantes reubicados por `split-project-conventions`

## Why

`split-project-conventions` movió 17 requirements a las capabilities que los gobiernan, y en cuatro casos el destino **ya tenía su propia versión de la misma regla**. Aquel change se había prohibido editar contenido, así que reubicó igual y dejó los pares colocalizados a propósito: el objetivo era volver la duplicación imposible de ignorar antes de resolverla. Esta change la resuelve.

El caso del off-ledger de tarjetas justifica por sí solo el ejercicio. Los tres textos **no dicen lo mismo**:

- `cards` (`I-CRED-1`) excluye del saldo los `expense` de tarjeta, sin calificar por status.
- `transactions` los excluye explícitamente **"tanto `pending` como `paid`"**.
- `accounts` los excluye sólo cuando `status='pending'`.

Leído literal, `accounts` afirma que un consumo de tarjeta **pagado** sí descuenta saldo disponible. Los otros dos afirman que no descuenta nunca. Es una contradicción sobre el invariante central del motor contable, no una diferencia de redacción, y era invisible mientras los tres textos vivían separados. `accounts` es el que está mal.

El resto de los pares no se contradicen, pero cada uno tiene cláusulas que el otro no: el par de aritmética decimal reparte la definición del tipo y la disciplina de uso en dos requirements, y el par de período abierto tiene una versión precisa y una debilitada.

## What Changes

### Solapamiento 1 — aritmética decimal (`schema-base`)

Sobrevive **"Aritmética monetaria con tipo Money"**, que define el tipo, sus métodos y las escalas de DB. Absorbe del otro: la regla explícita de que la conversión a `number` SHALL ocurrir sólo en el borde de presentación o persistencia, y cuatro scenarios que no tenía —parser de formularios, normalización en server action, disciplina para cálculos nuevos, y la auditoría del baseline—. Conserva su scenario propio de división en cuotas con residuo a la primera. Se elimina "Los cálculos monetarios usan aritmética decimal".

### Solapamiento 2 — `fx_rate_to_ars` (`transactions`)

Sobrevive **"El sistema enforza que `fx_rate_to_ars` se popule solo y solamente en consumos de tarjeta no-ARS"**. Absorbe del otro el nombre del invariante `I-CRED-11` y el detalle de enforcement (constraint `CHECK` con subquery sobre `accounts.type`, o trigger equivalente). Los tres scenarios son equivalentes 1:1, se conservan los del sobreviviente. Se elimina "La columna `fx_rate_to_ars` se popula solo en consumos de tarjeta no-ARS".

**Se agrega una referencia cruzada en `cards`** apuntando a `I-CRED-11` en `transactions`. La propiedad queda en `transactions` —ahí viven la columna y su enforcement— y la referencia resuelve el problema de descubribilidad sin reubicar la regla. Es la decisión que `split-project-conventions` dejó explícitamente abierta en su tarea 4.4.

### Solapamiento 3 — período abierto (`cards`)

Sobrevive **"El sistema mantiene siempre al menos un período abierto por delante de hoy"**, que es la versión precisa: exige `is_estimated=true` en el período auto-generado y cubre la race condition de generación concurrente. Absorbe del otro el nombre `I-CRED-12`, el alcance explícito a `is_active=true`, y el scenario de tarjeta archivada.

**Esto salda la deuda 4** anotada por `split-project-conventions`: el texto eliminado contenía una cláusula "o, alternativamente" que unía dos condiciones distintas y volvía el invariante no verificable. La versión que sobrevive no la tiene. Se elimina "Toda tarjeta activa tiene siempre al menos un período abierto por delante de hoy".

### Solapamiento 4 — off-ledger de tarjetas (triple)

El texto canónico queda en **`cards`**, en "Las tarjetas no descuentan disponible hasta el pago del resumen" (`I-CRED-1`). Es el más completo —único que trae la regla de `initial_balance=0`, el nombre del constraint `chk_credit_initial_balance` y la lista de puntos de enforcement— y es consistente con los otros cinco invariantes `I-CRED-*`, que ya viven en `cards`.

Absorbe de los otros dos:

- De `transactions`: la enumeración de qué **sí** afecta el saldo de una cuenta `cash`/`bank`, y la explicitación de que la exclusión aplica **tanto a `pending` como a `paid`**.
- De `accounts`: los scenarios concretos de usuario (los montos de "Galicia"), que comunican la regla mejor que una formulación abstracta.

**Se corrige la contradicción**: la versión canónica excluye los `expense` de tarjeta en cualquier status. La cláusula `AND status='pending'` de `accounts` desaparece.

`accounts` y `transactions` conservan un requirement propio, reducido a una referencia cruzada explícita a `I-CRED-1` más sus scenarios de usuario. No se quedan sin decir nada sobre el tema —un lector de `accounts` que pregunta "¿esto descuenta saldo?" sigue encontrando la respuesta ahí— pero la fuente normativa es una sola.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `schema-base`: 1 `MODIFIED` (absorbe cláusulas y scenarios) + 1 `REMOVED` (el duplicado).
- `transactions`: 2 `MODIFIED` (el de `fx_rate_to_ars` absorbe; el de off-ledger pasa a referencia cruzada) + 1 `REMOVED` (el duplicado de `fx_rate_to_ars`).
- `cards`: 2 `MODIFIED` (off-ledger canónico; período abierto absorbe) + 1 `REMOVED` (el duplicado de período abierto) + la referencia cruzada a `I-CRED-11`.
- `accounts`: 1 `MODIFIED` (pasa a referencia cruzada y pierde la cláusula `status='pending'` que contradecía al resto).

## Impact

- **Código**: ninguno. Ninguna regla nueva se introduce; la contradicción de `accounts` se resuelve a favor de lo que el código ya hace (ver Verificación en `tasks.md`, que exige confirmarlo contra las queries de saldo antes de archivar).
- **Datos**: ninguno. No hay migraciones.
- **Specs**: 4 capabilities tocadas. Neto: −4 requirements (27 → 23 entre las cuatro).
- **Riesgo**: medio. Es la primera change de esta serie que **edita significado** en vez de mover texto. Se mitiga con la verificación explícita de que la semántica que sobrevive es la que el código implementa, y con la tabla de trazabilidad de `tasks.md`, que exige confirmar cláusula por cláusula que nada del texto eliminado se perdió sin registrarse.
- **Solapamiento con changes activas**: ninguna. No hay changes activas.
