# Design: add-savings-set-aside

Decisiones cerradas de la fase 1, con su porqué. El modelo conceptual completo está en
`docs/modelo-de-dinero.md`; acá viven solo las decisiones que gobiernan **esta** implementación.

## D0 — El concepto es una reserva de disponibilidad, no "ahorro"

La tabla se llama **`availability_reserve`**, no `savings_entry`. Lo que registra es:

> De la plata que hoy podría gastar, decidí no tocar este monto.

No es patrimonio, no es inversión, no es plata movida de lugar. Nombrarla "savings" invitaría a que en
fase 3 alguien se pregunte por qué el plazo fijo no está adentro — y la respuesta sería que nunca fue
una tabla de ahorros.

La **capability** sigue siendo `savings` (el módulo 16) y la **UI** sigue diciendo *Guardar*. El repo ya
nombra en técnico preciso lo que el producto llama distinto: `card_periods` es el "resumen",
`shared_expense_split` es "compartido".

## D1 — Guardar no es un movimiento

Guardar **no crea ninguna fila en `transactions`**. Vive en su propia tabla, fuera del ledger.

El ledger registra **hechos** (qué le pasó a la plata); el guardado registra **decisiones** (qué
decidiste sobre ella). Son naturalezas distintas y mezclarlas obligaría a inventar reglas de signo,
tocar `calculateTransactionSums`, romper la paridad SQL↔TS y ensuciar la analítica del mes.

Corolario que el copy debe respetar: **Grana nunca inventa un movimiento financiero para representar
una intención**. Guardar $200.000 no genera una transferencia ficticia — el banco no se enteró de nada.

## D2 — El tope aplica al acto de guardar, no al resultado de gastar

| | ¿Se topea? | Por qué |
|---|---|---|
| **Guardar** | **Sí**, al disponible | Guardar más de lo que tenés no es un estado incómodo: es un **input inválido** |
| **Gastar** | **No** | Un saldo negativo es un **hecho**, y Grana lo muestra como es |

Si el usuario guarda $200.000 y después gasta hasta quedar con $150.000, el disponible queda en
**−$50.000** y se muestra tal cual, con el aviso no bloqueante que ya existe. El sistema **NO** reduce
el guardado en silencio para que el número cierre: sería borrar una decisión que el usuario no revocó.

## D2bis — El disponible real nace como lectura única, en SQL

**La resta no se compone en TypeScript.** Una función de Postgres devuelve, por moneda, el saldo de
cuentas, lo reservado y el disponible ya calculado:

```sql
get_available_sums(p_today)      → (currency_code, accounts_net, reserved, available)
get_reserve_flow_sums(p_from, p_to)  → (currency_code, reserved_net)
```

**Stock y flujo, los dos.** La línea *Guardaste este mes* es un flujo: si se calcula a mano en TS,
vuelve el mismo problema por la otra puerta.

Web, mobile y el dashboard **consumen**; ninguno recompone. `get_available_sums` tiene tres
consumidores —el Hero, el tope del drawer y la validación del write path—, así que derivar la resta
por separado en cada uno es garantía de divergencia. Es la lección de la migración `0051`: el
predicado de "cuenta propia" estaba replicado a mano en cada call site y **ya había divergido** en
producción. Repetir la resta en tres lugares es el mismo bug esperando a pasar.

## D3 — El guardado es por moneda, sin anclar a una cuenta

Se guarda ARS **o** USD, nunca un total mezclado. Y no se ancla a una cuenta.

Anclarlo permitiría decir "esos $200.000 están en tu Billetera", pero **simularía un movimiento que no
ocurrió** — una versión suave de romper D1. Además obligaría a inventar reglas cuando el usuario
transfiere entre cuentas o cuando el saldo de la cuenta ancla baja.

Consecuencia asumida: en la lista de Cuentas el guardado se muestra como **línea del grupo**, nunca
pegado a una fila. Esa plata no está en una cuenta: está repartida en todas.

## D4 — El drawer es contextual

| Origen | Moneda | Monto | Fecha |
|---|---|---|---|
| Desde un ingreso | Heredada del ingreso | Prellenado por el porcentaje | Hoy, no se pregunta |
| Suelto | Se elige, y solo si hay saldo en las dos | Vacío | Hoy, editable |

Viniendo de un ingreso queda **un solo campo, ya resuelto**. Ese es el presupuesto de taps: registrar
el ingreso y guardar sale en **dos**.

**El cálculo del drawer es del momento, no del cierre del mes.** Muestra el disponible de hoy, que
puede ser muy distinto del que el dashboard muestra a fin de mes.

**Y NO se calcula contra el ingreso** ("de $2.000.000 te quedan $1.800.000"), aunque sería más fácil
de leer: implicaría que ese guardado *sale de ese movimiento*, y por D3 el guardado es fungible y no
pertenece a ninguno.

## D5 — El disparador es un ingreso, como máximo una vez por mes

Sin umbrales, sin "ingreso típico", sin algoritmo. Esa inteligencia es una evolución posterior.

Dispara con **cualquier `income`**, por el camino que sea (confirmar una recurrencia o cargarlo a
mano) — el sueldo del usuario puede no ser una recurrencia. Un `reimbursement` **no** es un `income`,
así que el caso ruidoso más común ni siquiera lo activa.

El ciclo de vida lo lleva `guidance` (`seen` / `dismissed` / `completed` por usuario): si el usuario
lo descarta, se apaga.

## D6 — Se recuerda el porcentaje, no el importe

La primera vez sugiere 10% del ingreso. Después, **el último porcentaje usado**: 10% sobre $2.000.000
en agosto propone $250.000 sobre $2.500.000 en septiembre. Cero pantalla de ajustes — es la regla
"todo lo que Grana pueda inferir, lo infiere".

El porcentaje solo aplica **guardando desde un ingreso**. Suelto no hay ingreso del cual sacarlo: ahí
la sugerencia es el último monto, o ninguna.

## D7 — Una sola línea en el dashboard, bajo una regla

La tira de tres (`Tenías · Entró · Se fué`) es **liquidez pura** y no se toca. La línea *Guardaste este
mes* va **debajo de una regla**, no como cuarto hermano: son naturalezas distintas.

**Lleva signo menos.** El menos dice *"salió de lo que podés gastar"*, que es literalmente cierto; el
**color y el verbo** dicen si eso es bueno o malo. Sin signo, la identidad deja de leerse de izquierda
a derecha y la card pierde lo mejor que tiene, que es cerrar en pantalla.

Color **emerald**, no terracota: el terracota está reservado en Grana para lo que está por pagar o
vencido. *Guardaste* es progreso.

**Se renderiza solo en el mes corriente.** "Para gastar" al cierre de un mes pasado no significa nada.

## D8 — El rótulo del Hero no cambia, y el guardado se netea donde el rótulo dice "disponible"

Sigue diciendo **"Saldo disponible total"**. Al netear el guardado sigue siendo literalmente cierto, y
evita renombrar una card recién rediseñada.

**El neteo solo aplica al mes corriente.** En un mes pasado el rótulo ya dice otra cosa ("Saldo al
cierre de mayo de 2026") y el número sigue siendo el saldo al cierre, sin descontar nada: un
"disponible" de un mes cerrado no significa nada — la plata ya se gastó o no se gastó, y guardar es
una postura sobre el futuro, no un hecho del pasado.

Eso deja **una sola regla**, que además se lee del propio rótulo: *el guardado se netea exactamente
donde la card dice "disponible"*. Y hace que la línea `Guardaste este mes` y el neteo del Hero
aparezcan y desaparezcan **juntos**, que es lo que mantiene la card cerrando en los dos casos.

## D9 — El detalle existe, pero no entra en la navegación

Se llega tocando el número, como al detalle de un resumen de tarjeta.

Existe por una razón de fondo: guardar **no aparece en Movimientos** (no es un movimiento), así que sin
esta vista el usuario no podría auditar su propia decisión — y eso choca con el pilar de confianza
contable. Separa los dos números que se confunden: **total guardado** (stock) y **este mes** (flujo).

Qué hub la agrupa se decide en fase 2, con uso real.

## D10 — El verbo es "Guardar"

En la UI: **Guardar** / **Volver a usar**, y el dato se llama **Guardado**.

"Reservar" suena a reservar una mesa; "Ahorrar" interpreta antes de describir. *Guardar plata* es
lenguaje cotidiano argentino. En el código y en las specs el módulo es `savings`.

**El inverso NO es "Liberar".** Es correcto técnicamente y es como se llama la operación en el código
(`releaseAvailability`), pero nadie dice "voy a liberar $100.000": es palabra de sistemas —liberar
espacio, liberar un recurso—, no de plata.

Los candidatos y por qué caen:

| | Por qué no |
|---|---|
| **Sacar** | Es el verbo que la gente usa para **retirar plata del banco**, y sugerir movimiento es justo la confusión que este modelo combate |
| **Usar** | Promete que la estás gastando ahora, y la operación no gasta nada |
| **Retirar** | Igual que "Sacar", con más olor a cajero |
| **Dejar de guardar** | Preciso, pero tres palabras al lado de un botón de una, y suena a apagar una conducta más que a elegir un monto |
| **Desguardar** | No es una palabra |

**"Volver a usar"** dice exactamente lo que pasa —esa plata vuelve a contar como gastable— sin
insinuar que se mueve, y el *"volver a"* desactiva la promesa de "Usar": no es *usala*, es *que vuelva
a estar para usar*.

## D11 — El detalle de una cuenta no menciona el guardado

`/accounts/[id]` sigue mostrando su saldo tal cual. No lleva ninguna línea sobre lo guardado.

**No hay un número honesto que poner ahí.** La reserva es por moneda y fungible: no está en Mercado
Pago más que en Galicia. Una línea *"de estos $6.741.212 hay $200.000 reservados"* sería falsa en
cada pantalla por separado y, entre todas, sumaría varias veces el mismo guardado.

**Y esa pantalla ya no contesta disponibilidad.** Tampoco descuenta las expensas por pagar, ni las
cuotas de tarjeta, ni los gastos fijos que vienen. Su rótulo dice **SALDO**, no "disponible", y esa
es la pregunta que contesta: *cuánto tengo acá*. Descontar el guardado pero no los compromisos sería
peor que no descontar nada — parecería que ya entregó el número bueno.

**El riesgo que se acepta:** alguien que vive en las pantallas de cuentas puede no cruzarse nunca con
el guardado. Lo compensa que el dashboard sea la pantalla de aterrizaje y que la fila esté siempre
ahí, pero es una compensación, no una garantía. Si con uso real resulta insuficiente, la salida no es
una línea en el detalle de cuenta: es decidir que las pantallas de cuentas pasen a contestar
disponibilidad, y entonces tienen que descontar **compromisos y guardado juntos**. Es una decisión
más grande y no es de esta fase.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| El guardado como `transaction_type` propio | Rompe D1: obliga a reglas de signo, ensucia analítica y paridad |
| Anclar el guardado a una cuenta | Simula un movimiento que no ocurrió (D3) |
| Una línea de guardado en el detalle de cada cuenta | La reserva no vive en ninguna cuenta: la línea sería falsa por pantalla y, sumada, contaría el guardado tantas veces como cuentas haya. Ver D11 |
| Incluir `counts_as_available` "porque es barato" | El booleano arrastra: transferencias que dejan de ser neutras → la card no cierra → una segunda línea que nadie entiende. Y no va a ninguna fase: la fase 3 modela el plazo fijo como **posición**, no como cuenta, y ahí el disponible sale bien sin flag (ver `docs/modelo-de-dinero.md`) |
| Pedir propósito en el drawer | Sin propósitos que elegir es un campo muerto. Fase 2 |
| Restar los compromisos del Hero | Mezcla presente con futuro. Comprometido sigue siendo su propia card |
| Un cuarto término en la tira de tres | Mezcla un hecho con una decisión en la misma grilla |
