## Why

Los movimientos recurrentes cubren gastos, ingresos y transferencias que el usuario sabe que se repiten: sueldo, alquiler, servicios, debitos automaticos en tarjeta, pases mensuales entre cuentas, ahorro programado. Sin recurrencias, el usuario debe cargar manualmente hechos previsibles y pierde una de las ayudas mas valiosas de Grana: recordarle que algo deberia pasar sin asumir que ya paso.

v2 resolvio recurrencias con instancias `transactions.status='pending'` que luego pasaban a `posted`. Ese modelo no se puede portar tal cual a v3: en v3 `transactions.status` ya significa estado de resumen de tarjeta (`pending`/`paid`) y el motor de saldos excluye filas con `status != NULL`. Reutilizar ese campo romperia tarjetas, resumenes o saldos.

## What Changes

- Agregar reglas recurrentes como parte del modulo Movimientos/Transacciones, no como modulo separado.
- Permitir que el usuario marque como recurrente un movimiento al registrarlo.
- Permitir recurrencias para:
  - ingresos en cash/bank;
  - gastos en cash/bank;
  - consumos simples en tarjeta de credito;
  - transferencias entre cuentas propias.
- Generar instancias pendientes en una entidad separada de `transactions`, para que no impacten saldos ni choquen con `transactions.status`.
- Al confirmar una instancia, crear el movimiento real usando los flujos existentes:
  - ingreso -> `createIncome`;
  - gasto cash/bank -> `createExpense`;
  - gasto con tarjeta -> `registerCardPurchase`;
  - transferencia -> `createTransfer`.
- Al omitir una instancia, no crear ninguna transaccion contable.
- Mostrar instancias pendientes en `/transactions` como bloque separado del historial normal.
- Agregar gestion de reglas recurrentes en `/transactions/recurring`.
- Preparar deteccion de patrones: si la app detecta movimientos similares repetidos, sugiere crear una recurrencia, pero nunca la crea sin confirmacion del usuario.

## Capabilities

### Modified Capabilities

- `transactions`: integra reglas recurrentes, instancias pendientes, confirmacion/omision, acceso desde Movimientos y creacion desde los formularios de registro.

## Impact

- **Schema**: nuevas tablas propuestas `recurrences`, `recurrence_instances` y memoria persistente de descartes de sugerencias por patron.
- **No se modifica** el significado de `transactions.status`; sigue reservado para resumenes de tarjeta.
- **Backend**: nuevas queries/actions para reglas, instancias, generacion lazy, confirmacion, omision y sugerencias.
- **Frontend**: toggle "Recurrente" en registro, bloque de pendientes en Movimientos, pantalla de reglas recurrentes y surface de sugerencias.
- **Riesgo principal**: crear transacciones reales antes de confirmacion o mezclar estados con tarjeta. La mitigacion central es que las instancias pendientes no viven en `transactions`.
