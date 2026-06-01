# Rediseño de "Editar tarjeta" como drawer lateral

## Why

Editar una tarjeta hoy vive como **página completa** (`/cards/[id]/edit`, componente `edit-credit-card-form.tsx`): edita nombre, banco y límite, muestra la red read-only y **no permite tocar el ciclo** (cierre/vencimiento). El handoff de diseño (Julieta, hi-fi — `docs/design/design_handoff_editar_tarjeta/`) pide reemplazar esa página por un **drawer lateral derecho** sobre el detalle de la tarjeta, con el mismo patrón que el drawer de "Registrar movimiento", más una **vista previa en vivo** que refleja los cambios mientras se editan.

Decisión de alcance (Cristian, junio 2026):

1. **Respetar el backend por sobre el prototipo.** El handoff proponía red editable, ciclo como "día fijo del mes" y "moneda principal". Nada de eso existe hoy: la red es inmutable post-creación, el ciclo se modela como períodos (4 fechas reales) y las tarjetas son **bimoneda por defecto**. El drawer se ciñe a lo que el código soporta.
2. **Reusar primitivos y lógica, no reescribir.** El drawer compone el primitivo `Drawer` (Radix) y el primitivo `Button`; persiste vía `updateCreditCard` (nombre/banco/límite) y `updatePeriodDates` (fechas del ciclo). Cero lógica de negocio nueva.
3. **Ciclo editable de verdad.** Las "4 fechas" del alta (cierre/vto del resumen actual + del próximo) se vuelven editables desde el drawer, delegando en la edición de fechas de período ya especificada (cascada del borde, bloqueo si el próximo está pagado).

## What Changes

### A — Editar tarjeta se presenta como drawer (web)

- **MODIFIED** "El usuario puede editar campos mutables de una tarjeta": el form se abre en un **drawer lateral derecho** sobre el detalle (trigger "Editar" del detalle), con header fijo (eyebrow + nombre + cerrar) → body scrolleable → footer fijo (Cancelar + Guardar cambios). La ruta `/cards/[id]/edit` sigue resolviendo como **fallback no-JS / deep-link** renderizando el mismo form.
- **MODIFIED** los campos editables: nombre, institución (banco) y `credit_limit` se mantienen; se **agrega** la edición de las fechas del ciclo (cierre/vto del resumen actual y del próximo). La red se muestra como **chip read-only con candado** (en vez de un simple rechazo en el schema). Las monedas no se editan desde este form (bimoneda por defecto).

### B — Vista previa en vivo + acciones en el drawer

- **ADDED** "Vista previa en vivo en el drawer de edición": una tarjeta que refleja nombre, inicial del avatar (del nombre), red, banco, límite (con barra contra lo comprometido) y mini-diagrama cierre→vence, recalculada a cada cambio. El color de acento lo define el backend, no es un campo.
- **MODIFIED** archivar/eliminar pasan a vivir dentro del drawer: **archivar** siempre (sujeto al check de deuda existente, con el dialog de bloqueo) y **eliminar** habilitado solo si la tarjeta no tiene/tuvo movimientos (deshabilitado con copy explicativo en caso contrario).

### C — Ciclo editable desde el drawer

- **ADDED** "Las 4 fechas del ciclo se editan desde el drawer de edición": resumen actual (cierre/vto) + próximo (cierre/vto), persistidas con `updatePeriodDates` **primero el período actual** (por la cascada del borde que corre el inicio del próximo) y luego el próximo. Hereda validaciones (vto > cierre, próximo cierre > cierre actual, próximo vto > próximo cierre) y los bloqueos de período pagado ya especificados.

## Stakeholders

- **Producto** (Cristian): valida ceñir el form al backend (red inmutable, sin "moneda principal") por sobre el prototipo.
- **Diseño** (Julieta): dueña del hi-fi; valida el snapping de tokens del prototipo a `@grana/ui-tokens`.

## Out of scope

- **Paridad mobile**: el módulo `cards` en `apps/mobile` hoy solo tiene el carrusel del listado (no hay detalle de tarjeta, períodos ni edición). Llevar este drawer a mobile requiere primero ese stack — queda como follow-up de módulo, no de este cambio.
- Cambios en el motor de períodos/balances: las server actions (`updateCreditCard`, `updatePeriodDates`, `deactivateCreditCardAccount`, `deleteAccount`) ya existen y no se tocan.
- Edición de monedas activas de la tarjeta (se rige por bimoneda por defecto; no es parte de este form).
