## ADDED Requirements

### Requirement: El usuario puede registrar un ingreso en una cuenta

El sistema SHALL permitir registrar un ingreso (plata que entra) en una cuenta de tipo `cash` o `bank`. El ingreso requiere: cuenta, moneda activa en esa cuenta, monto mayor a cero, y fecha. La descripción y categoría son opcionales.

#### Scenario: Ingreso creado correctamente

- **WHEN** el usuario completa el formulario con cuenta, moneda, monto > 0 y fecha válida y confirma
- **THEN** el sistema inserta una fila en `transactions` con `type='income'`, `amount > 0`, y el saldo de la cuenta aumenta en ese monto para la moneda indicada

#### Scenario: Monto cero o negativo es rechazado

- **WHEN** el usuario ingresa un monto ≤ 0
- **THEN** el sistema muestra un error de validación y no inserta la transacción

#### Scenario: Moneda no habilitada en la cuenta es rechazada

- **WHEN** el usuario intenta registrar un ingreso en una moneda que no tiene una `account_currencies` activa en la cuenta seleccionada
- **THEN** el sistema retorna un error y no inserta la transacción

#### Scenario: Ingreso con fecha en el pasado

- **WHEN** el usuario ingresa una fecha anterior a hoy
- **THEN** el sistema acepta la transacción con esa fecha histórica (el backdating es válido)

---

### Requirement: El usuario puede registrar un gasto en una cuenta

El sistema SHALL permitir registrar un gasto (plata que sale) en una cuenta de tipo `cash` o `bank`. El gasto requiere: cuenta, moneda activa, monto mayor a cero, fecha y categoría. La subcategoría y descripción son opcionales.

#### Scenario: Gasto creado correctamente

- **WHEN** el usuario completa el formulario con cuenta, moneda, monto > 0, fecha y categoría válidos y confirma
- **THEN** el sistema inserta una fila en `transactions` con `type='expense'`, `amount > 0`, y el saldo de la cuenta disminuye en ese monto para la moneda indicada

#### Scenario: Gasto sin categoría es rechazado

- **WHEN** el usuario intenta crear un gasto sin seleccionar categoría
- **THEN** el sistema muestra un error de validación y no inserta la transacción

#### Scenario: Subcategoría pertenece a la categoría seleccionada

- **WHEN** el usuario selecciona una subcategoría que no pertenece a la categoría elegida
- **THEN** el sistema rechaza el input con error de validación

---

### Requirement: El saldo de la cuenta refleja las transacciones en tiempo real

El sistema SHALL calcular el saldo de cada cuenta como `initial_balance + Σ ingresos - Σ gastos` en la moneda correspondiente. No existe columna de saldo cacheada.

#### Scenario: Saldo después de crear un ingreso

- **WHEN** el usuario crea un ingreso de $100 ARS en una cuenta con `initial_balance_ars = 500`
- **THEN** la pantalla de detalle de esa cuenta muestra saldo ARS = $600

#### Scenario: Saldo después de crear un gasto

- **WHEN** el usuario crea un gasto de $200 ARS en una cuenta con `initial_balance_ars = 500` y sin transacciones previas
- **THEN** la pantalla de detalle muestra saldo ARS = $300

#### Scenario: Saldo puede ser negativo

- **WHEN** los gastos acumulados superan el `initial_balance` de una moneda
- **THEN** el sistema muestra el saldo negativo (no lo clampea a cero)

#### Scenario: ARS y USD se calculan por separado

- **WHEN** la cuenta tiene transacciones en ARS y en USD
- **THEN** el sistema muestra saldos independientes por moneda; nunca los convierte ni combina

---

### Requirement: El usuario puede ver la lista de transacciones de una cuenta

El sistema SHALL mostrar la lista de transacciones de una cuenta ordenada por fecha descendente (más reciente primero), luego por `created_at` descendente. La lista es parte de la pantalla de detalle de la cuenta.

#### Scenario: Lista muestra ingresos y gastos

- **WHEN** el usuario abre el detalle de una cuenta con transacciones de ambos tipos
- **THEN** el sistema muestra todas las transacciones con fecha, descripción, categoría (si aplica), monto y tipo diferenciado visualmente (ingreso vs gasto)

#### Scenario: Estado vacío

- **WHEN** la cuenta no tiene transacciones
- **THEN** el sistema muestra el mensaje vacío con CTA para agregar la primera transacción

#### Scenario: La lista está paginada

- **WHEN** la cuenta tiene más de 20 transacciones
- **THEN** el sistema muestra las 20 más recientes con opción de cargar más

---

### Requirement: El usuario puede ver el detalle de una transacción

El sistema SHALL mostrar el detalle completo de una transacción: fecha, monto, moneda, tipo, cuenta, categoría, subcategoría y descripción.

#### Scenario: Acceso al detalle

- **WHEN** el usuario toca una transacción en la lista
- **THEN** el sistema navega a la pantalla de detalle con todos los campos visibles

#### Scenario: Transacción de otro usuario no es accesible

- **WHEN** el usuario intenta acceder directamente a la URL de una transacción que no le pertenece
- **THEN** el sistema retorna `notFound()` (la RLS filtra la fila; la página renderiza 404)

---

### Requirement: El usuario puede editar una transacción

El sistema SHALL permitir editar los campos mutables de una transacción: monto, fecha, descripción, categoría y subcategoría. Los campos `type`, `account_id` y `currency_code` son inmutables post-creación.

#### Scenario: Edición de monto actualiza el saldo

- **WHEN** el usuario cambia el monto de un gasto de $100 a $150
- **THEN** el saldo de la cuenta disminuye $50 adicionales respecto al saldo previo

#### Scenario: Cambio de tipo es rechazado

- **WHEN** el usuario intenta cambiar un ingreso a gasto mediante la acción de edición
- **THEN** el sistema rechaza el input; el tipo es inmutable

#### Scenario: Cambio de cuenta es rechazado

- **WHEN** el usuario intenta mover la transacción a otra cuenta mediante la acción de edición
- **THEN** el sistema rechaza el input; la cuenta es inmutable

---

### Requirement: El usuario puede eliminar una transacción

El sistema SHALL permitir eliminar permanentemente una transacción. El sistema solicita confirmación antes de ejecutar. El saldo de la cuenta se recalcula automáticamente tras la eliminación.

#### Scenario: Eliminar transacción actualiza el saldo

- **WHEN** el usuario confirma la eliminación de un gasto de $200 ARS
- **THEN** el sistema borra la fila y el saldo ARS de la cuenta aumenta $200

#### Scenario: Eliminación requiere confirmación

- **WHEN** el usuario toca "Eliminar" en el detalle de la transacción
- **THEN** el sistema muestra un diálogo de confirmación antes de ejecutar el borrado

---

### Requirement: Solo el dueño de la transacción puede leerla y modificarla

El sistema SHALL aplicar Row Level Security sobre `transactions` de forma que `user_id = auth.uid()` para toda operación SELECT, INSERT, UPDATE y DELETE.

#### Scenario: RLS bloquea acceso cross-user

- **WHEN** un usuario autenticado realiza una query directa contra `transactions` sin filtro de `user_id`
- **THEN** Supabase retorna únicamente las filas donde `user_id = auth.uid()`
