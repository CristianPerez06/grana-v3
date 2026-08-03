# Diseño — deduplicar los invariantes reubicados

## Context

Esta es la primera change de la serie que **edita significado**. `split-project-conventions` movió texto verbatim y pudo verificarse con `diff`; acá hay que elegir qué texto sobrevive y qué cláusulas del otro absorber, y eso no se verifica mecánicamente. El riesgo dominante no es romper el build —esta change no toca código— sino **perder una cláusula normativa en silencio**.

El segundo hecho que domina el diseño: uno de los cuatro pares no era un par, era una contradicción. Los tres textos del off-ledger de tarjetas no decían lo mismo, y el de `accounts` afirmaba algo distinto de los otros dos. Colocalizar los duplicados —el objetivo declarado de `split-project-conventions`— fue lo que la hizo visible.

## Goals / Non-Goals

**Goals:**

- Una sola fuente normativa por regla, con las demás capabilities remitiendo a ella.
- Cero pérdida de cláusulas: todo lo que el texto eliminado decía y el sobreviviente no, se absorbe antes de eliminar.
- Resolver la contradicción del off-ledger a favor de lo que el código realmente hace, verificado contra el código y no deducido del texto.
- Que cada `REMOVED` explique en su `Reason` qué se absorbió, para que el archive sea auditable sin abrir el original.

**Non-Goals:**

- Cambiar comportamiento. Ninguna regla nueva se introduce.
- Tocar código, migraciones o tests.
- Dejar a `accounts` y `transactions` sin nada que decir sobre el off-ledger. Conservan su requirement, reducido a referencia cruzada más sus scenarios de usuario.
- Resolver el resto de la deuda de `split-project-conventions` (bimoneda desactualizada, layout del monorepo, regla de admisión). Cada una tiene su propia change.

## Decisions

### Decisión 1 — La contradicción del off-ledger se resuelve contra el código, no contra el texto

Los tres textos discrepaban: `cards` excluía los `expense` de tarjeta sin calificar status, `transactions` decía explícitamente "tanto `pending` como `paid`", y `accounts` excluía sólo `status='pending'` — lo que implica que un consumo pagado sí descuenta saldo.

Elegir por mayoría (2 contra 1) habría dado la respuesta correcta por el motivo equivocado. La decisión se tomó verificando el motor de saldos:

- `getAccounts` (`packages/accounts/src/queries.ts`) trae únicamente cuentas `type IN ('cash','bank')`, así que las cuentas `credit` nunca entran al conjunto que lleva saldo.
- El RPC `get_account_balance_sums` (migración `0052`) filtra `where t.status is null`, y toda transacción de tarjeta tiene status no nulo (`pending` o `paid`).

Dos mecanismos independientes excluyen los consumos de tarjeta **sin mirar el status**. `accounts` estaba mal; su cláusula `AND status='pending'` desaparece.

### Decisión 2 — El canónico del off-ledger queda en `cards`

Los tres candidatos eran defendibles: `accounts` es dueño del saldo, `transactions` del motor de movimientos, `cards` del invariante.

Gana `cards` por tres razones. Es `I-CRED-1`, y los otros cinco invariantes `I-CRED-*` ya viven ahí después del split — dispersarlo rompería la única agrupación que el split logró. Su texto es el más completo: es el único que trae la regla de `initial_balance=0`, el nombre del constraint y la lista de puntos de enforcement. Y es el que responde la pregunta del lector que más se hace: "¿gastar con la tarjeta me baja el saldo?".

`accounts` y `transactions` no quedan mudos: conservan un requirement que declara la consecuencia sobre su propio dominio, remite a `I-CRED-1` por el enunciado completo, y mantiene sus scenarios concretos.

**Alternativa descartada:** borrar los requirements de `accounts` y `transactions` y dejar sólo el de `cards`. Se descarta porque un lector de `accounts` que pregunta "¿esto descuenta saldo?" merece encontrar la respuesta ahí, no un vacío. La duplicación peligrosa es la de dos textos normativos independientes; una referencia cruzada explícita no lo es.

### Decisión 3 — En cada par sobrevive el texto más verificable, no el más antiguo ni el más largo

El criterio aplicado a los cuatro casos es el mismo: sobrevive el texto que un test o una lectura de código puede refutar.

Por eso en el par del período abierto gana el que exige `is_estimated=true` y cubre la race condition, y se elimina el que decía "SHALL existir X **o, alternativamente**, SHALL existir Y". Dos condiciones unidas por "alternativamente" hacen que ninguna observación pueda violar el invariante, lo que lo vuelve decorativo. Eliminar ese texto salda la deuda 4 sin una change aparte.

En el par de aritmética decimal el criterio da un resultado menos obvio: sobrevive el texto **más corto** (`Aritmética monetaria con tipo Money`), porque define el tipo y las escalas, que es lo verificable; y absorbe del más largo la disciplina de bordes y cinco scenarios. Largo no es lo mismo que preciso.

### Decisión 4 — `fx_rate_to_ars` se queda en `transactions`, con referencia cruzada desde `cards`

`split-project-conventions` dejó esta decisión explícitamente abierta (su tarea 4.4). Se resuelve a favor de `transactions`: la columna es de `transactions`, su enforcement es un constraint sobre esa tabla, y `transactions` ya tenía el requirement incumbente escrito antes de todo este proceso.

El costo de esa decisión —que un lector de `cards` no encuentre `I-CRED-11`— se paga con una referencia cruzada explícita dentro del requirement de off-ledger de `cards`, que es donde ese lector ya está mirando. Resuelve la descubribilidad sin mover la regla de donde se enforza.

## Risks / Trade-offs

- **Pérdida silenciosa de una cláusula.** Es el riesgo real de esta change. Se mitiga con la tabla de trazabilidad de `tasks.md`, que obliga a listar cláusula por cláusula qué tenía el texto eliminado y dónde quedó, y con `Reason` que enumeran lo absorbido en vez de decir "se deduplicó".
- **La corrección de `accounts` cambia lo que la spec afirma.** Es deliberado y es el punto: la spec afirmaba algo que el código no hace. El riesgo inverso —que el código esté mal y la spec bien— se descartó leyendo las dos capas de exclusión.
- **Las referencias cruzadas envejecen.** Tres requirements ahora nombran a `I-CRED-1` y uno a `I-CRED-11`. Si esos requirements se renombran, los punteros quedan colgados. Se acepta: es el mismo riesgo que corre cualquier referencia del repo, y la alternativa (tres textos normativos independientes) es justamente lo que esta change elimina.
- **Neto de −4 requirements.** Un lector que compare el conteo antes/después podría leerlo como pérdida de cobertura. Los `Reason` existen para desmentirlo.
