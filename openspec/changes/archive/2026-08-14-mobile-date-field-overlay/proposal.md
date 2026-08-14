# Proposal: mobile-date-field-overlay

## Why

En la app nativa el picker de fecha se monta **en el flujo del layout**, como hermano del trigger dentro del propio `DateField` (`apps/mobile/components/ui/DateField.tsx`). Al abrirlo, el componente deja de ocupar el alto de su trigger y pasa a ocupar el del calendario: el host se deforma.

El síntoma visible está en el alta de movimiento. La fila de fecha de la card agrupada (`MovementForm.tsx`) es un `flex-row` con el trigger a la izquierda y los chips **Hoy / Ayer** a la derecha. Al abrir el picker en iOS pasan dos cosas a la vez:

1. **Vertical**: el spinner (~200pt de alto) expande la columna del trigger hacia abajo, la `GroupCard` crece y todo lo que sigue se desplaza.
2. **Horizontal**: el spinner tiene un ancho intrínseco grande y en React Native el `flexShrink` por defecto es `0`, así que la columna del trigger se ensancha más allá del espacio disponible y **empuja los chips Hoy / Ayer fuera de la pantalla**.

El commit `0aa0679` ya intentó contener esto alineando la fila arriba (`items-start` + offsets verticales). Trató el síntoma vertical, pero no podía resolver el horizontal: la causa raíz es que el picker participa del layout. Cualquier host que ponga algo al lado del `DateField` vuelve a romperse.

El problema no es de una pantalla: `DateField` se usa en **18 lugares de 9 archivos** (tarjetas, recurrencias, reintegros, saldar, alta de movimiento). Todos heredan la deformación en iOS.

Además hay un hueco de memoria del repo: **el campo de fecha nativo no está especificado en ninguna parte**. El spec `web-date-picker` dice textualmente *"Scope solo web; la contraparte mobile la maneja el tech lead"*, y el spec `transactions` sólo nombra a `DateField` en listas de primitivos (L3236, L3252, L3624, L3685), nunca cómo se presenta. La regla que arregla esto —el picker se presenta **sobre** el layout, nunca dentro— no está escrita en ningún lado, así que una sesión nueva la vuelve a romper.

## What Changes

- **El picker se presenta como overlay, no en flujo.** `DateField` deja de montar el `DateTimePicker` como hermano del trigger. En iOS el calendario pasa a presentarse dentro del primitivo `BottomSheet` existente (mismo scrim + grabber + slide-up que `Popover` y `SelectSheet` ya usan para los pickers de cuenta y categoría). En Android no cambia nada: `display="default"` ya renderiza el diálogo nativo del SO, que es modal y no ocupa layout.
- **El host no se entera de que el picker se abrió.** Abrir o cerrar el picker NO SHALL alterar el alto ni el ancho de la fila, card o pantalla que contiene el campo.
- **La API pública de `DateField` no cambia.** `value` / `onChange` / `placeholder` / `invalid` / `bare` / `open` / `onOpenChange` se mantienen tal cual, de modo que los 18 call sites no se tocan y la exclusión mutua de pickers (`EditCardForm`, `EditDatesSheet`) sigue funcionando igual.
- **La fila de fecha del alta vuelve a su alineación natural.** Los workarounds de `0aa0679` (`items-start` + los `pt-1.5` / `pt-1` de compensación) quedan sin propósito y se revierten a `items-center`.
- **Se especifica por primera vez el campo de fecha nativo**, cerrando la nota pendiente de `web-date-picker`: presentación como overlay, cobertura total (todo campo de fecha de la nativa usa `DateField`), contrato de valor ISO sin desfase de zona y API controlada para pickers mutuamente excluyentes. Las dos primeras son la regla nueva; las dos últimas ya son ciertas en el código y hoy sólo viven ahí.

No es un cambio de comportamiento contable: no toca qué fecha se guarda ni cómo se interpreta, sólo dónde se dibuja el selector.

## Capabilities

### New Capabilities

- `mobile-date-field`: el primitivo de selección de fecha de la app nativa (`DateField`) — presentación como overlay sin impacto en el layout del host, divergencia idiomática iOS (sheet) / Android (diálogo nativo), cobertura total de los campos de fecha de la nativa, contrato de valor ISO `YYYY-MM-DD` sin desfase de zona y API controlada para pickers mutuamente excluyentes. Es la contraparte nativa de `web-date-picker`, que dejó ese scope explícitamente afuera.

### Modified Capabilities

(ninguna)

`transactions` **no** se toca a propósito. Su spec nombra a `DateField` como primitivo usado por el alta, pero nunca describe cómo se presenta, así que no hay requirement que modificar. Además la change activa `fix-recurrence-projection-and-orphans` tiene todos sus deltas sobre `transactions`, y el pre-change check prohíbe dos changes activas sobre la misma capability sin resolver orden y dependencias: mantener este cambio fuera de `transactions` evita ese acoplamiento sin perder nada.

## Impact

- **`apps/mobile/components/ui/DateField.tsx`** — único archivo con cambio de comportamiento: el bloque `{show && (<View>…)}` en flujo se reemplaza por la presentación en overlay. Sin cambios de props.
- **`apps/mobile/components/ui/BottomSheet.tsx`** — se reutiliza tal cual, sin modificaciones.
- **`apps/mobile/components/transactions/MovementForm.tsx`** — revierte los offsets de compensación de `0aa0679` en la fila de fecha.
- **18 call sites en 9 archivos** (`settle`, `EditCardForm`, `PayCardPeriodForm`, `EditDatesSheet`, `CreateCardForm`, `PendingReimbursementsBlock`, `RecurrenceEditForm`, `RecurrenceForm`, `MovementForm`) — no requieren edición; se benefician del arreglo sin tocarlos.
- **Riesgo conocido**: `EditDatesSheet` usa `DateField` **dentro** de un `BottomSheet`, así que ese caso pasa a ser un `Modal` dentro de otro `Modal`. React Native lo soporta, pero es el único punto que exige verificación en simulador y no en el diff. Se detalla en `design.md`.
- **i18n**: sin claves nuevas — el sheet reusa `common.close`, ya presente en el catálogo.
- **Sin impacto en web**, en `@grana/ui-contracts` ni en el schema: `DateField` es un primitivo local de `apps/mobile` sin contract compartido.
