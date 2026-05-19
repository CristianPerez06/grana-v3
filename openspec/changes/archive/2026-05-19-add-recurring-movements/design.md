## Context

v3 ya tiene el nucleo de Movimientos y tarjetas:

- `transactions.status` se usa para consumos de tarjeta en resumen: `pending` antes del pago y `paid` despues del pago.
- Los saldos cash/bank se calculan excluyendo filas con `status != NULL`, para no descontar consumos de tarjeta antes de pagar el resumen.
- Los pagos de resumen se modelan como `expense` normal en la cuenta de pago y vinculo en `period_payments`.
- Las compras en cuotas tienen madre off-ledger e hijas imputadas a resumenes.

Por eso recurrencias deben tener su propio ciclo de vida. Una instancia recurrente pendiente es una propuesta de movimiento, no una transaccion real.

## Goals / Non-Goals

**Goals:**

- No romper saldos, resumenes ni movimientos existentes.
- Soportar recurrencias en ingresos, gastos cash/bank, consumos simples de tarjeta y transferencias.
- Mantener `transactions.status` exclusivo para estado de resumen de tarjeta.
- Generar una sola instancia pendiente por regla a la vez.
- Permitir que el usuario confirme, edite antes de confirmar, u omita.
- Crear la transaccion real solo al confirmar.
- Permitir que la app sugiera recurrencias detectando patrones repetidos, siempre con aprobacion del usuario.

**Non-Goals iniciales:**

- Recurrencias de ajustes.
- Recurrencias de compras en cuotas.
- Cron/background jobs; la generacion inicial sera lazy al abrir la app o Movimientos.
- Crear reglas automaticamente sin consentimiento.
- Proyeccion de cashflow basada en recurrencias.

## Decisions

### D1 - Instancias pendientes fuera de `transactions`

Las instancias pendientes SHALL vivir en `recurrence_instances` o entidad equivalente, no en `transactions`.

**Rationale.** En v3, `transactions.status` ya esta ocupado por tarjeta. Una fila `transactions` pendiente de recurrencia podria impactar o no impactar saldos de forma ambigua. Separar entidades permite que lo pendiente no sea contable hasta que el usuario confirme.

### D2 - `transactions.status` no cambia

No se agrega `posted`, `scheduled`, `recurrence_pending` ni ningun valor nuevo a `transactions.status` para recurrencias.

**Rationale.** El contrato actual de tarjeta depende de `pending|paid|null`. Ampliarlo mezclaria dos dominios: estado de resumen y estado de confirmacion de recurrencia.

### D3 - Confirmar instancia delega en flujos existentes

Confirmar una instancia no inserta una fila generica a mano. La action de confirmacion SHALL delegar en la misma logica de creacion que usa el registro manual segun tipo:

- ingreso cash/bank: inserta `transactions.type='income'`, `status=NULL`;
- gasto cash/bank: inserta `transactions.type='expense'`, `status=NULL`;
- consumo de tarjeta: inserta `transactions.type='expense'`, `status='pending'`, `card_period_id`, `due_date`, `fx_rate_to_ars` si aplica;
- transferencia: inserta `transactions.type='transfer'`, `status=NULL`.

**Rationale.** Asi se heredan validaciones existentes: moneda activa, tarjeta activa, periodo de tarjeta, backdating en periodo pagado, cuenta destino distinta, constraints DB.

### D4 - Gasto de tarjeta recurrente es consumo simple

Una recurrencia de tarjeta representa un consumo simple repetido, por ejemplo un debito automatico mensual. No representa cuotas.

**Rationale.** Las cuotas ya modelan un compromiso distribuido propio. Mezclar cuotas recurrentes con recurrencias generaria doble calendario.

### D5 - Transferencias recurrentes son first-class

Una regla recurrente de transferencia guarda cuenta origen, cuenta destino, moneda, monto, descripcion y frecuencia. La instancia pendiente no mueve saldos. Al confirmar, se crea una transferencia real.

### D6 - Edicion de instancia vs regla

Antes de confirmar, el usuario puede editar la instancia puntual. Cambios de fecha, descripcion y categoria aplican solo a esa instancia. Si el usuario edita el monto, el sistema SHALL actualizar tambien el monto de la regla recurrente.

**Rationale.** En Argentina los importes cambian seguido. El usuario no deberia tener que editar la regla aparte cada mes despues de ajustar una instancia pendiente.

### D7 - Deteccion de patrones como sugerencia

La app MAY detectar patrones de movimientos repetidos por descripcion normalizada, cuenta/tarjeta, categoria, moneda, monto similar y periodicidad aproximada. La deteccion solo produce sugerencias. El usuario debe aceptar y puede editar los datos antes de crear la regla.

La deteccion inicial SHOULD calcularse on-the-fly al leer movimientos, sin guardar todas las sugerencias posibles. Los descartes SHALL persistirse por fingerprint para no insistir con el mismo patron.

### D8 - Pausar/reactivar y eliminar regla

La pantalla de reglas SHALL ofrecer pausar/reactivar y eliminar/desactivar. Pausar detiene la generacion de nuevas instancias sin borrar la regla. Reactivar vuelve a habilitarla desde su proxima fecha calculada. Eliminar/desactivar oculta la regla de la lista activa y cancela cualquier instancia pendiente sin borrar transacciones reales ya confirmadas.

## Proposed Schema Shape

### `recurrences`

Guarda la regla aprobada por el usuario.

- `id`
- `user_id`
- `movement_type`: `income | expense | transfer`
- `account_id`: cuenta origen o tarjeta
- `transfer_destination_account_id`: solo transferencias
- `currency_code`
- `amount`
- `category_id`
- `subcategory_id`
- `description`
- `frequency`: `weekly | biweekly | monthly | annual`
- `start_date`
- `end_date`
- `last_generated_date`
- `status`: `active | paused | deleted`
- `created_from_transaction_id`: nullable, para reglas creadas desde un movimiento real
- `created_at`

### `recurrence_instances`

Guarda propuestas pendientes o historico minimo de omisiones/confirmaciones.

- `id`
- `recurrence_id`
- `user_id`
- `scheduled_date`
- `status`: `pending | skipped | confirmed`
- snapshot editable: `amount`, `account_id`, `transfer_destination_account_id`, `currency_code`, `category_id`, `subcategory_id`, `description`
- `confirmed_transaction_id`: nullable
- `created_at`
- `resolved_at`

Una regla activa SHALL tener como maximo una instancia `pending` a la vez.

### `recurrence_suggestion_dismissals`

Guarda patrones descartados por el usuario para que la deteccion on-the-fly no vuelva a sugerirlos.

- `id`
- `user_id`
- `fingerprint`
- `reason`: nullable
- `created_at`

## Lifecycle

1. El usuario crea una regla manualmente al registrar un movimiento, o acepta una sugerencia.
2. El movimiento del dia, si existe, se registra como transaccion real normal.
3. La primera instancia se calcula para el siguiente periodo segun frecuencia.
4. Al abrir Movimientos, la app genera lazy una instancia pendiente si corresponde y no existe otra pendiente para la regla.
5. El usuario confirma, edita y confirma, u omite.
6. Confirmar crea una transaccion real y vincula `confirmed_transaction_id`.
7. Omitir no crea transaccion.
8. La siguiente instancia solo se habilita despues de confirmar u omitir la actual.

## Risks / Trade-offs

- **Tarjeta y status:** mitigado al no tocar `transactions.status`.
- **Duplicacion de validaciones:** mitigado delegando confirmacion en actions/flujos existentes.
- **Patrones falsos positivos:** mitigado con sugerencias no automaticas y descartes persistentes por fingerprint.
- **Cuentas archivadas:** al confirmar se debe revalidar que cuentas/tarjetas siguen activas; si no, bloquear y pedir editar instancia o regla.
- **Periodo de tarjeta pagado:** al confirmar consumo recurrente de tarjeta, usar la misma validacion de `registerCardPurchase`; si la fecha cae en periodo pagado, bloquear o pedir cambiar fecha.
- **Concurrencia lazy:** constraint unica por regla para instancia `pending`.

## Closed Decisions

- Editar el monto de una instancia pendiente actualiza tambien la regla recurrente.
- Las sugerencias se calculan on-the-fly; los descartes se persisten por fingerprint.
- La gestion de reglas incluye pausar/reactivar y eliminar/desactivar.
