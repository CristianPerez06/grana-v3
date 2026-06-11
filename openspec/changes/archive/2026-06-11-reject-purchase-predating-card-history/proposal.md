# Reject Purchase Predating Card History

## Why

Un consumo cuya fecha es **anterior** al inicio del período más viejo de la tarjeta (en la práctica, anterior a `cierre_actual − 30 días` que el alta usa como `start_date` de P1) no encuentra período que lo cubra. Hoy `getOrCreatePeriodForDate` no lo detecta: cae a la rama de "rolling forward" y crea un período **futuro** (`start_date = último.end_date + 1`), asignándole el consumo. El consumo queda pegado a un resumen que no contiene su fecha, inflando una deuda futura que no corresponde. Es corrupción silenciosa, no un error visible.

Conceptualmente, un consumo más viejo que el resumen actual pertenece a un ciclo ya cerrado/pagado que Grana no trackea: el sistema empieza a registrar desde el alta. Lo correcto es rechazar con un mensaje claro, no inventar un período.

## What Changes

- `getOrCreatePeriodForDate` SHALL rechazar (lanzando un error tipado) cuando la fecha objetivo es anterior al `start_date` del período más viejo de la cuenta, en lugar de crear un período futuro y asignar mal. La generación lazy de períodos sigue existiendo **solo hacia adelante**.
- Los orquestadores `registerCardPurchase` y `registerInstallments` SHALL traducir ese error a un mensaje de usuario claro que nombre la fecha de inicio del historial de la tarjeta. (En cuotas solo la primera cuota usa la fecha de compra; las demás son `+N meses`, rolling forward legítimo.)

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `cards`: el requirement de asignación de transacción a período se extiende — además de rechazar el solapamiento (más de un candidato), el sistema rechaza el caso de **cero candidatos por fecha anterior al historial** (antes: asignaba a un período futuro incorrecto).

## Impact

- **Lógica compartida**: `packages/transactions-mutations/src/internal/card-periods.ts` — guard en `getOrCreatePeriodForDate` + clase de error exportada.
- **Orquestadores**: `packages/transactions-mutations/src/register-card-purchase.ts` y `register-installments.ts` — catch tipado con mensaje claro.
- **Specs**: `openspec/specs/cards/spec.md` — requirement de asignación.
- **Sin migración**: solo afecta inserciones futuras. Datos ya mal asignados (si los hubiera) no se tocan; son corregibles editando la fecha del consumo.
- **Mobile**: la lógica vive en el paquete compartido, así que el fix beneficia a ambos clientes cuando consuman estos orquestadores.
