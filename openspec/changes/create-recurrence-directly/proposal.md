# Crear recurrencias directamente (desde cero)

## Why

Hoy una regla recurrente solo puede nacer desde un movimiento ya registrado (`createRecurrenceFromMovement`) o aceptando una sugerencia detectada. No hay forma de declarar "todos los días 1 pago el alquiler" antes de que ocurra el primer movimiento, que es justo el caso mental más natural para planificar gastos fijos. Esta es la última puerta de entrada faltante del módulo de recurrencias.

## What Changes

- Nuevo server action `createRecurrence` que inserta una regla recurrente sin transacción de origen (`created_from_transaction_id = null`), validando los invariantes contables del módulo.
- Se fija la semántica contable de la creación directa: `last_generated_date = null`, de modo que la **primera instancia se genere para `start_date`** (a diferencia de los flujos con movimiento semilla). Un `start_date` pasado produce una única instancia pendiente, no un backfill.
- Nueva UI para crear la regla desde cero (tipo, monto, cuenta, categoría/subcategoría, frecuencia con presets + custom, fecha inicio/fin opcional, preview en lenguaje natural), siguiendo la referencia de diseño desktop.
- Punto de entrada "+" en `/transactions/recurring` que abre el flujo de creación directa.
- Strings i18n (es/en) para la nueva UI.

## Capabilities

### New Capabilities

(ninguna — el comportamiento se suma a la capacidad existente `transactions`)

### Modified Capabilities

- `transactions`: se AGREGA el requisito de crear reglas recurrentes directamente (sin movimiento de origen) y se MODIFICA el requisito de generación de instancias para definir la fecha de la primera instancia cuando `last_generated_date` es `null` (regla directa ⇒ primera instancia en `start_date`).

## Impact

- Affected specs: `transactions` (capacidad de recurrencias).
- Affected code:
  - `apps/web/app/_actions/recurrences.ts` — nuevo `createRecurrence`.
  - `packages/validation/src/recurrences.ts` — `createRecurrenceSchema` ya existe; se revisa/ajusta si hace falta.
  - `apps/web/app/(app)/transactions/recurring/` — página + nuevo componente de creación y botón "+".
  - `packages/i18n-messages/src/{es,en}.json` — nuevos strings.
- Sin cambios de schema de base de datos: `recurrences.created_from_transaction_id` ya es nullable (migration `0011_recurring_movements.sql`).
