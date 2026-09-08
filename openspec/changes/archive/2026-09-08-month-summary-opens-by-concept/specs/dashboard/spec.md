## ADDED Requirements

### Requirement: "Entró" y "Se fué" se pueden abrir por concepto

Los dos flujos del "Resumen del mes" SHALL poder abrirse para mostrar **de qué están hechos**, por concepto y no por medio de pago. "Tenías" NO SHALL abrirse: no es un flujo, es el saldo con el que se entró al mes.

La apertura de **"Entró"** SHALL listar:

- **Ingresos** — lo que el usuario ganó: sueldo, una venta, un regalo.
- **Ingresos financieros** — lo que ganó la plata sola, clasificado en la categoría **Financiero**: sale de "Ingresos", nunca se suma encima.
- **Devoluciones** — reintegros "a cuenta" recibidos: plata que VOLVIÓ, no plata ganada.
- **Otros** — el lado positivo de los baldes con signo: una liquidación a favor, la pata destino de un cambio de moneda, un ajuste positivo.

La apertura de **"Se fué"** SHALL listar:

- **Gastos** — gasto real pagado desde una cuenta.
- **Pago de tarjetas** — pagos de resumen, que cancelan deuda ya devengada y no son gasto nuevo. Que tengan fila propia es el punto: es la salida de caja más grande de muchos meses y confundirla con gasto es lo que hace que "Se fué" no se entienda.
- **Otros** — el lado negativo de los mismos baldes con signo.

Cada apertura SHALL sumar exactamente su total, al centavo. Los montos NO SHALL calcularse por una vía paralela a la del total: SHALL ser los mismos términos que el total ya suma, expuestos en vez de descartados, de modo que una card no pueda contradecir las filas que acaba de abrir.

Una fila en cero NO SHALL mostrarse. "Otros" es cero en el mes corriente ordinario, y una fila que no dice nada igual ocupa un renglón e invita a preguntar qué significa.

SHALL haber **una sola apertura abierta por vez**: dos paneles apilados bajo una tira de tres columnas dejan de leerse como "esto pertenece a aquella columna". La apertura SHALL renderizarse **inmediatamente debajo de la fila que la abrió** con la tira apilada, y debajo de la tira cuando se muestra en tres columnas, nunca adentro de la columna: un tercio de una card de ancho de teléfono son ~105px y "Pago de tarjetas $968.558,83" no entra sin partirse o achicarse hasta dejar de leerse.

La apertura SHALL existir en **ambas plataformas** y SHALL respetar la regla bimoneda de la tira: el monto USD de cada concepto acompaña al ARS bajo las mismas condiciones que los totales.

#### Scenario: Abrir "Se fué" separa el gasto del pago de tarjetas

- **WHEN** el usuario toca "Se fué" en un mes donde gastó $1.592.094,40 y pagó $968.558,83 de resúmenes
- **THEN** ve dos filas, "Gastos $1.592.094,40" y "Pago de tarjetas $968.558,83"
- **AND** las dos suman los $2.560.653,23 que muestra "Se fué"

#### Scenario: Abrir "Entró" separa lo ganado de lo devuelto

- **WHEN** el usuario toca "Entró" en un mes con $2.929.111,22 de ingresos y $446.002,12 de reintegros recibidos
- **THEN** ve "Ingresos $2.929.111,22" y "Devoluciones $446.002,12"
- **AND** las dos suman los $3.375.113,34 que muestra "Entró"

#### Scenario: Un concepto en cero no ocupa un renglón

- **WHEN** el mes no tuvo liquidaciones, cambios de moneda ni ajustes
- **THEN** la apertura no muestra la fila "Otros"

#### Scenario: Solo una apertura abierta por vez

- **WHEN** el usuario tiene abierta la apertura de "Entró" y toca "Se fué"
- **THEN** se cierra la de "Entró" y se abre la de "Se fué"

#### Scenario: "Tenías" no se abre

- **WHEN** el usuario mira el "Resumen del mes"
- **THEN** "Tenías" no ofrece apertura
