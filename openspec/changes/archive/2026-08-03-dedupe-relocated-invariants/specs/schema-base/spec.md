## MODIFIED Requirements

### Requirement: Aritmética monetaria con tipo Money

Todo cálculo o comparación monetaria de la aplicación SHALL usar el tipo `Money` (branded type sobre `decimal.js`) o un helper compartido que lo use internamente. Está prohibido usar operadores aritméticos nativos de JavaScript (`+`, `-`, `*`, `/`) directamente para combinar valores monetarios dentro del motor contable. Esto aplica a saldos derivados, sumatorias de transacciones, pagos, límites, cuotas, ajustes y cualquier operación que combine montos.

El tipo `Money` provee métodos seguros: `add`, `subtract`, `multiply`, `divide`, `toNumber`, `toFixed`, `isZero`, `isNegative`, `compare`. Los helpers compartidos MAY convertir el resultado a `number` cuando están construyendo un modelo de lectura para UI o normalizando un valor justo antes de persistir.

Los campos monetarios MAY cruzar bordes de UI/API como `number` o `string` cuando sea necesario por formularios, Supabase o formateo visual, pero la conversión a `number` SHALL ocurrir **únicamente en el borde de presentación o persistencia**. Entre lectura, cálculo y comparación de montos, el código SHALL usar `Money`.

Los valores monetarios en DB se almacenan como `NUMERIC(18,2)` y `fx_rate_to_ars` se almacena como `NUMERIC(18,6)`. Los tipos generados de Supabase pueden transportar esos valores como `number`; esa representación se considera un borde de IO, no una autorización para hacer aritmética binaria. Al escribir a DB, las server actions SHALL normalizar los montos con la escala correspondiente.

#### Scenario: Suma de dos montos sin error de punto flotante

- **WHEN** se suman `Money(0.1)` y `Money(0.2)` usando `Money.add`
- **THEN** el resultado es `Money(0.3)`, no `Money(0.30000000000000004)`
- **AND** la comparación contra cero se hace con `Money.isZero` o equivalente decimal

#### Scenario: División de monto en cuotas

- **WHEN** se divide `Money(100)` en 3 cuotas usando `Money.divide(3)`
- **THEN** las cuotas suman exactamente `Money(100)` (el residuo se asigna a la primera cuota)

#### Scenario: Supabase transporta numeric como number en el borde

- **WHEN** una query de Supabase retorna un campo `NUMERIC(18,2)` tipado como `number`
- **THEN** el código puede pasarlo a la UI para display sin cálculo intermedio
- **AND** si necesita sumarlo, restarlo, compararlo contra cero o persistirlo de nuevo, lo convierte mediante `Money` o un helper monetario compartido

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

## REMOVED Requirements

### Requirement: Los cálculos monetarios usan aritmética decimal

**Reason**: Deduplicación, no deprecación. Este requirement y "Aritmética monetaria con tipo Money" gobernaban la misma regla desde dos textos escritos por separado, colocalizados a propósito por `split-project-conventions` para hacer visible la duplicación. La regla sigue vigente **sin ninguna pérdida de alcance**: el requirement sobreviviente absorbió sus dos cláusulas propias (que la conversión a `number` SHALL ocurrir únicamente en el borde de presentación o persistencia, y la enumeración de operaciones cubiertas) y sus cinco scenarios que no estaban duplicados (conversión a `number` sólo para display, prohibición de `Number(row.amount)` para sumar, parser de formularios que rechaza parseos parciales, normalización en server action con la escala correcta, y la auditoría del baseline monetario).

**Migration**: Ninguna migración de código ni de datos. La regla vive ahora completa en el requirement "Aritmética monetaria con tipo Money" de esta misma capability (`openspec/specs/schema-base/spec.md`).
