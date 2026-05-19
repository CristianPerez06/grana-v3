## ADDED Requirements

### Requirement: El usuario puede crear una regla recurrente al registrar un movimiento

El sistema SHALL permitir que el usuario marque como recurrente un movimiento al registrarlo. La recurrencia SHALL ser una regla separada del movimiento real y SHALL conservar los datos necesarios para generar futuras instancias: tipo funcional, cuenta o tarjeta, cuenta destino cuando aplique, moneda, monto, categoria cuando aplique, descripcion, frecuencia, fecha de inicio y fecha final opcional.

El movimiento registrado en ese momento SHALL crearse como transaccion real normal usando el flujo existente. La regla recurrente SHALL apuntar opcionalmente a ese movimiento mediante `created_from_transaction_id`.

#### Scenario: Ingreso recurrente creado desde registro

- **WHEN** el usuario registra un ingreso y activa "Recurrente"
- **THEN** el sistema crea el ingreso real en `transactions` con `status=NULL`
- **AND** crea una regla recurrente de tipo `income`
- **AND** no crea una segunda transaccion para la primera recurrencia

#### Scenario: Gasto de tarjeta recurrente creado desde registro

- **WHEN** el usuario registra un consumo simple en tarjeta y activa "Recurrente"
- **THEN** el sistema crea el consumo real de tarjeta con `status='pending'` y `card_period_id`
- **AND** crea una regla recurrente de tipo `expense` asociada a esa tarjeta
- **AND** la regla no modifica el estado del resumen

#### Scenario: Transferencia recurrente creada desde registro

- **WHEN** el usuario registra una transferencia y activa "Recurrente"
- **THEN** el sistema crea la transferencia real
- **AND** crea una regla recurrente con cuenta origen y cuenta destino

---

### Requirement: Las instancias recurrentes pendientes no son transacciones reales

El sistema SHALL representar las ocurrencias pendientes de una regla recurrente en una entidad separada de `transactions`. Una instancia pendiente SHALL ser una propuesta editable y revisable por el usuario. Mientras este pendiente, SHALL NOT impactar saldos, resumenes de tarjeta, listados contables de cuenta ni `period_payments`.

El sistema SHALL NOT usar `transactions.status` para expresar pendiente/confirmado/omitido de recurrencias. `transactions.status` SHALL permanecer reservado para el estado de consumos de tarjeta frente al resumen (`pending`/`paid`).

#### Scenario: Instancia pendiente no impacta saldo

- **WHEN** se genera una instancia pendiente de gasto cash/bank por `$10.000 ARS`
- **THEN** no se inserta ninguna fila en `transactions`
- **AND** el saldo de la cuenta no cambia

#### Scenario: Instancia pendiente de tarjeta no aparece en resumen

- **WHEN** se genera una instancia pendiente de consumo recurrente de tarjeta
- **THEN** no se inserta ninguna fila con `card_period_id`
- **AND** el resumen de la tarjeta no cambia hasta que el usuario confirme

#### Scenario: Estado de recurrencia no usa `transactions.status`

- **WHEN** una instancia recurrente esta pendiente, confirmada u omitida
- **THEN** ese estado vive en la entidad de instancia recurrente
- **AND** ninguna migracion agrega valores como `posted` o `recurrence_pending` a `transactions.status`

---

### Requirement: El usuario puede confirmar una instancia recurrente

El sistema SHALL permitir confirmar una instancia recurrente pendiente. Al confirmar, el sistema SHALL crear una transaccion real usando el mismo contrato de creacion que usa un movimiento manual del mismo tipo. La instancia SHALL quedar vinculada a la transaccion creada mediante `confirmed_transaction_id`.

#### Scenario: Confirmar gasto cash/bank recurrente

- **WHEN** el usuario confirma una instancia de gasto recurrente en cuenta cash o bank
- **THEN** el sistema crea una transaccion `type='expense'` con `status=NULL`
- **AND** el saldo de esa cuenta baja segun las reglas existentes

#### Scenario: Confirmar consumo recurrente de tarjeta

- **WHEN** el usuario confirma una instancia de gasto recurrente en tarjeta de credito
- **THEN** el sistema crea un consumo de tarjeta con `status='pending'`, `card_period_id` y `due_date`
- **AND** si la moneda no es ARS, exige `fx_rate_to_ars`
- **AND** el saldo cash/bank no cambia

#### Scenario: Confirmar transferencia recurrente

- **WHEN** el usuario confirma una instancia de transferencia recurrente
- **THEN** el sistema crea una transaccion `type='transfer'`
- **AND** el saldo de la cuenta origen baja y el de la cuenta destino sube

#### Scenario: Confirmar consumo de tarjeta en periodo pagado falla

- **WHEN** una instancia recurrente de tarjeta tiene fecha dentro de un periodo ya pagado
- **THEN** la confirmacion falla con error explicativo
- **AND** no se crea ninguna transaccion
- **AND** la instancia permanece pendiente para que el usuario edite la fecha u omita

---

### Requirement: El usuario puede omitir una instancia recurrente

El sistema SHALL permitir omitir una instancia recurrente pendiente. Omitir SHALL resolver la instancia sin crear transaccion real y sin modificar saldos ni resumenes.

#### Scenario: Omitir gasto recurrente

- **WHEN** el usuario omite una instancia pendiente
- **THEN** la instancia queda marcada como omitida o se elimina segun la implementacion elegida
- **AND** no se inserta ninguna fila en `transactions`

---

### Requirement: El sistema genera instancias recurrentes de forma secuencial

El sistema SHALL generar como maximo una instancia pendiente por regla activa. La siguiente instancia SHALL generarse solamente despues de que la instancia actual haya sido confirmada u omitida. La fecha de la instancia SHALL ser la fecha que corresponde por frecuencia, no la fecha actual.

#### Scenario: Una sola instancia pendiente por regla

- **WHEN** una regla mensual ya tiene una instancia pendiente
- **THEN** abrir `/transactions` nuevamente no genera otra instancia para esa regla

#### Scenario: Usuario vuelve despues de varios meses

- **WHEN** el usuario abre la app despues de varios periodos sin resolver una regla
- **THEN** el sistema muestra solo la instancia pendiente mas antigua que corresponda
- **AND** no genera automaticamente todas las ocurrencias atrasadas

#### Scenario: Regla con fecha final

- **WHEN** la proxima fecha calculada supera `end_date`
- **THEN** el sistema no genera una nueva instancia
- **AND** desactiva la regla o la marca como finalizada

---

### Requirement: El usuario puede editar una instancia antes de confirmarla

El sistema SHALL permitir editar los campos mutables de una instancia recurrente pendiente antes de confirmarla. Los cambios de fecha, descripcion, categoria y subcategoria SHALL aplicar a la instancia puntual. Si el usuario modifica el monto, el sistema SHALL actualizar tambien el monto de la regla recurrente.

#### Scenario: Editar fecha de consumo recurrente de tarjeta

- **WHEN** el usuario cambia la fecha de una instancia pendiente de tarjeta
- **THEN** la confirmacion usa la nueva fecha para asignar el `card_period_id`

#### Scenario: Editar monto y actualizar regla

- **WHEN** el usuario cambia el monto de una instancia pendiente
- **THEN** la instancia se confirma con el nuevo monto
- **AND** las futuras instancias de la regla se generan con ese nuevo monto

---

### Requirement: El modulo Movimientos muestra pendientes recurrentes separados del historial

El sistema SHALL mostrar las instancias recurrentes pendientes en `/transactions` en un bloque separado del historial cronologico normal. El historial normal SHALL contener solo movimientos reales derivados de `transactions`.

#### Scenario: Pendiente recurrente visible sobre el historial

- **WHEN** existen instancias recurrentes pendientes
- **THEN** `/transactions` muestra un bloque de pendientes con acciones de confirmar, editar y omitir
- **AND** debajo muestra el historial real de movimientos

#### Scenario: Movimiento confirmado aparece en historial

- **WHEN** el usuario confirma una instancia recurrente
- **THEN** se crea una transaccion real
- **AND** el movimiento aparece en el historial global segun su fecha contable

---

### Requirement: El usuario puede gestionar, pausar y eliminar reglas recurrentes

El sistema SHALL exponer una pantalla `/transactions/recurring` para ver y gestionar reglas recurrentes. La pantalla SHALL listar reglas activas y pausadas con tipo, descripcion, monto, cuenta o tarjeta, frecuencia, proxima fecha e indicador de instancia pendiente cuando exista. El sistema SHALL permitir pausar, reactivar y eliminar/desactivar reglas.

#### Scenario: Acceso desde Movimientos

- **WHEN** el usuario abre `/transactions`
- **THEN** puede navegar a `/transactions/recurring`

#### Scenario: Regla eliminada no borra historial

- **WHEN** el usuario desactiva o elimina una regla recurrente
- **THEN** las transacciones reales ya confirmadas se conservan
- **AND** dejan trazabilidad hacia la regla si la FK sigue disponible

#### Scenario: Regla pausada no genera instancias

- **WHEN** el usuario pausa una regla recurrente
- **THEN** el sistema no genera nuevas instancias pendientes para esa regla
- **AND** las transacciones ya confirmadas se conservan

#### Scenario: Regla pausada puede reactivarse

- **WHEN** el usuario reactiva una regla pausada
- **THEN** el sistema vuelve a considerarla para generar la proxima instancia pendiente segun su frecuencia

---

### Requirement: El sistema puede sugerir recurrencias por patrones repetidos

El sistema MAY detectar movimientos similares repetidos y sugerir al usuario crear una regla recurrente. Una sugerencia SHALL NOT crear reglas ni instancias por si sola. El usuario SHALL poder aceptar, editar antes de crear, o descartar la sugerencia. El sistema SHOULD calcular sugerencias on-the-fly a partir del historial y SHALL persistir los descartes por patron para no insistir.

#### Scenario: Sugerencia por movimientos repetidos

- **WHEN** el sistema detecta varios movimientos con descripcion normalizada, cuenta o tarjeta, categoria, moneda, monto similar y periodicidad compatibles
- **THEN** puede mostrar una sugerencia de recurrencia
- **AND** la sugerencia requiere confirmacion del usuario antes de crear la regla

#### Scenario: Sugerencia descartada

- **WHEN** el usuario descarta una sugerencia
- **THEN** el sistema recuerda el descarte para no insistir con el mismo patron

---

### Requirement: Las recurrencias iniciales excluyen ajustes y compras en cuotas

El sistema SHALL NOT ofrecer recurrencias para ajustes ni compras en cuotas en el alcance inicial.

#### Scenario: Compra en cuotas no ofrece recurrencia

- **WHEN** el usuario registra una compra en cuotas
- **THEN** el sistema no muestra el toggle de recurrencia para esa operacion

#### Scenario: Ajuste no ofrece recurrencia

- **WHEN** el usuario registra un ajuste de saldo
- **THEN** el sistema no muestra el toggle de recurrencia
