## MODIFIED Requirements

### Requirement: El usuario puede archivar una cuenta

El sistema SHALL permitir archivar cualquier cuenta del usuario (set `is_active=false` en `accounts`). Archivar **siempre está disponible**: no depende del saldo ni del historial de transacciones. Archivar es la opción correcta para sacar de la vista activa una cuenta que tuvo movimientos pero que el usuario ya no usa; las transacciones se preservan intactas y la cuenta puede reactivarse en cualquier momento. La cuenta archivada deja de aparecer en la lista principal y deja de aceptar transacciones nuevas.

#### Scenario: Archivar cuenta con historial de transacciones

- **WHEN** el usuario archiva una cuenta que tiene movimientos registrados
- **THEN** la cuenta queda con `is_active=false`, deja de aparecer en la lista principal y todas sus transacciones se conservan

#### Scenario: Archivar cuenta sin transacciones también es válido

- **WHEN** el usuario archiva una cuenta sin movimientos
- **THEN** la operación es aceptada (archive no impone restricción de saldo ni de historial)

---

### Requirement: El usuario puede eliminar permanentemente una cuenta sin historial

El sistema SHALL permitir eliminar una cuenta **solo si nunca tuvo transacciones registradas**. Eliminar es la opción correcta para limpiar cuentas creadas por error (errata de tipeo, alta duplicada, prueba); no es la herramienta para "dar de baja" una cuenta con historial — para ese caso existe archivar. Una cuenta con transacciones (propias o entrantes como destino de transferencia) no puede eliminarse: el usuario debe archivarla.

La eliminación es permanente y cascadea a `account_currencies` (FK `ON DELETE CASCADE`). La DB además bloquea el delete si la cuenta es destino de alguna transferencia activa (`transfer_destination_account_id` tiene `ON DELETE RESTRICT`).

#### Scenario: Eliminar cuenta sin movimientos

- **WHEN** el usuario elimina una cuenta que nunca tuvo transacciones
- **THEN** la cuenta y sus monedas se borran permanentemente

#### Scenario: Intentar eliminar cuenta con movimientos es rechazado

- **WHEN** el usuario intenta eliminar una cuenta con al menos una transacción donde `account_id = X` o `transfer_destination_account_id = X`
- **THEN** el sistema rechaza la operación y orienta al usuario a archivar en su lugar

#### Scenario: La UI ofrece eliminar o archivar según el caso

- **WHEN** la cuenta no tiene transacciones
- **THEN** la pantalla de detalle muestra la opción "Eliminar" como acción primaria de baja
- **AND** cuando sí tiene transacciones, la opción visible es "Archivar"
