## ADDED Requirements

### Requirement: Los cálculos monetarios usan aritmética decimal

Todo cálculo monetario del producto SHALL usar aritmética decimal (`Money`/`decimal.js` o una primitiva equivalente), no aritmética binaria de JavaScript con `number`, mientras el valor esté dentro del motor contable. Esto aplica a saldos derivados, sumatorias de transacciones, pagos, límites, cuotas, ajustes y cualquier operación que combine montos.

Los campos monetarios pueden cruzar bordes de UI/API como `number` o `string` cuando sea necesario por formularios, Supabase o formateo visual, pero la conversión a `number` SHALL ocurrir únicamente en el borde de presentación o persistencia. Entre lectura, cálculo y comparación de montos, el código SHALL usar `Money`.

#### Scenario: Sumar centavos no deja residuo binario

- **WHEN** el sistema calcula `0.10 + 0.20 - 0.30` para un saldo o total monetario
- **THEN** el resultado contable es exactamente `0`
- **AND** la comparación contra cero se hace con `Money.isZero` o equivalente decimal

#### Scenario: Una query convierte a number solo al devolver datos para display

- **WHEN** una query de saldos lee `numeric(18,2)` desde Supabase
- **THEN** acumula los montos con `Money`
- **AND** convierte a `number` recién al construir el modelo de lectura que consume la UI

#### Scenario: Un cálculo contable nuevo no usa `Number(row.amount)` para sumar

- **WHEN** un colaborador agrega una sumatoria de montos de transacciones
- **THEN** convierte cada monto con `Money.from(row.amount)`
- **AND** usa `Money.add`/`Money.subtract` para acumular

#### Scenario: Un formulario monetario no usa parseFloat directo

- **WHEN** un formulario convierte un string ingresado por el usuario en un monto
- **THEN** usa un parser monetario compartido que rechaza parseos parciales como `123abc`
- **AND** recién después pasa el monto normalizado a la action o schema correspondiente

#### Scenario: Una server action normaliza antes de persistir

- **WHEN** una server action persiste `amount`, `initial_balance`, `credit_limit` o un campo monetario equivalente
- **THEN** normaliza el valor con el helper monetario compartido antes del INSERT/UPDATE
- **AND** usa la escala de DB correspondiente (`2` decimales para montos, `6` para `fx_rate_to_ars`)

#### Scenario: El baseline monetario actual queda auditado

- **WHEN** un colaborador revisa el baseline monetario de la V3
- **THEN** encuentra cubiertos con helpers decimales: cálculo de balances de cuentas, totales de tarjetas/períodos, inputs monetarios de formularios, normalización previa a persistencia, cuotas y comparación contra saldo cero
- **AND** considera aceptables los usos residuales de `number` en bordes de IO/display, formateo de una fila individual, cálculo de porcentajes visuales, y tipos generados de Supabase
- **AND** mantiene como pendiente consciente cualquier migración futura para representar `NUMERIC` como `string` o `Money` en tipos generados/curados de Supabase
