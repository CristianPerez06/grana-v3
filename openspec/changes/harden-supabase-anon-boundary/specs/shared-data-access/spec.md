## MODIFIED Requirements

### Requirement: El dominio Compartido expone sus lecturas desde un paquete `@grana/shared` agnóstico de plataforma

El monorepo SHALL exponer las lecturas del dominio Compartido (hogar, deuda, proyección, cuenta corriente, liquidaciones pendientes, movimientos compartidos, reparto de un movimiento) desde un paquete `@grana/shared` consumible por `apps/web` y `apps/mobile`. Cada lectura SHALL recibir el cliente de Supabase como parámetro (no crear su propio cliente ni depender de un runtime de plataforma) y SHALL derivar la matemática de deuda/proyección delegando en `@grana/money-logic`, sin recalcular en la capa de lectura.

Las funciones de lectura SHALL cubrir al menos: `getHousehold`, `getHouseholdDebt`, `getHouseholdOutlook`, `getCurrentAccount`, `getPendingSettlements`, `getSharedAccruedMovements`, `getMovementSharedInfo`, `getSharedExpenses`.

Cuando una lectura necesite el nombre de un conviviente, SHALL obtenerlo invocando el RPC de profiles de convivientes y NO SHALL leer la tabla `profiles` directamente. El paquete NO SHALL depender de enumerar columnas en el `select` para evitar exponer datos ajenos: el allowlist es responsabilidad de la base, y la capa de datos se limita a consumirlo.

#### Scenario: Una lectura recibe el cliente y no lo construye

- **WHEN** un desarrollador invoca cualquier lectura de `@grana/shared`
- **THEN** la función acepta el cliente de Supabase como argumento
- **AND** no importa ni inicializa un cliente propio de web o de mobile

#### Scenario: La deuda se deriva, no se persiste ni recalcula en la lectura

- **WHEN** `getHouseholdDebt` produce la deuda neta por moneda
- **THEN** la derivación usa `@grana/money-logic`
- **AND** el resultado no lee un saldo persistido ni reimplementa la matemática de reparto

#### Scenario: El nombre del conviviente se resuelve vía RPC

- **WHEN** una lectura de `@grana/shared` necesita el `full_name` de un conviviente
- **THEN** lo obtiene invocando el RPC de profiles de convivientes
- **AND** no existe en el paquete ninguna consulta directa a la tabla `profiles` para leer filas ajenas

#### Scenario: La lectura sigue funcionando tras mover el allowlist a la base

- **WHEN** un usuario abre el módulo Compartido teniendo un conviviente en su hogar
- **THEN** la UI muestra el nombre del conviviente igual que antes del cambio
- **AND** ningún flujo del módulo cambia de comportamiento visible
