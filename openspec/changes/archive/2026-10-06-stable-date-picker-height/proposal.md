## Why

En la web, el calendario del selector de fecha cambia de alto al pasar de un mes a otro: muestra tantas filas como semanas toca el mes (4, 5 o 6). Al cambiar de alto se mueve de lugar en la pantalla, sobre todo cuando se abre hacia arriba del campo, y las flechas para cambiar de mes se corren bajo el dedo o el mouse. Si la persona toca la flecha varias veces seguidas, puede terminar tocando otra cosa. Ticket #176.

## What Changes

- El calendario muestra **siempre 6 semanas**, en todos los meses. Los lugares sobrantes se completan con los primeros días del mes siguiente, en gris, como ya se ven hoy los días de otros meses.
- Al pasar de mes, el calendario no cambia de tamaño y las flechas quedan en el mismo lugar.
- Aplica a todos los formularios de la web que usan el selector, en computadora y en celular, porque es un único componente.

Fuera de alcance:

- La app nativa. Usa el selector del sistema operativo (rueda en iPhone, diálogo del sistema en Android), que no tiene este problema y no controlamos.
- Cualquier otro cambio de diseño del selector (el #92 sigue aparte).

## Capabilities

### New Capabilities

_Ninguna._

### Modified Capabilities

- `web-date-picker`: el requisito «Selección de fecha que abre el mes completo» suma un escenario: el calendario mantiene el mismo tamaño en todos los meses.

## Impact

- `apps/web/components/ui/date-picker.tsx`: el único primitivo de fecha de la web. Todos los formularios lo heredan sin tocarse.
- Sin cambios en datos, en la base ni en `packages/`.
