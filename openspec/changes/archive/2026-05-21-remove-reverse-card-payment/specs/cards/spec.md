## MODIFIED Requirements

### Requirement: El período activo mostrado en el detalle de tarjeta MUST priorizar la deuda sobre la apertura

Cuando el usuario abre el detalle de una tarjeta, el sistema MUST mostrar el período más urgente como "período activo", siguiendo este orden de prioridad:

1. **Vencido con deuda** (`overdue`, `tx_count > 0`): el período con `due_date < today`, sin pago, con transacciones.
2. **Cerrado esperando pago** (`closed`, `tx_count > 0`): el período con `end_date < today ≤ due_date`, sin pago, con transacciones.
3. **Período abierto actual** (`open`): el período cuyo rango contiene `today`.
4. **Fallback**: el último período no pagado (por `end_date` descendente).

Esta priorización garantiza que, incluso cuando existe un período nuevo y vacío (creado al pagar el anterior), el sistema muestre el período cerrado con deuda pendiente si lo hubiera, y no el período futuro vacío.

#### Scenario: Tarjeta con período closed y período open posterior muestra el closed

- **WHEN** una tarjeta tiene P1 en estado `closed` con 3 transacciones pendientes y P2 en estado `open` con 0 transacciones, y `today` cae dentro del rango de P2
- **THEN** el detalle de la tarjeta muestra P1 como período activo (con CTA "Pagar resumen")
- **AND** P2 aparece en la sección "Próximos resúmenes"
