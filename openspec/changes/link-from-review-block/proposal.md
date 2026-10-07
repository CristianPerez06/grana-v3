## Why

Un vencimiento que ya existe y sigue sin resolver no se puede resolver señalando un movimiento ya
cargado: en «Vencimientos por revisar» sólo hay Confirmar —que crea uno nuevo— y Omitir. En
producción esto terminó en un sueldo cargado dos veces (#162). Desvincular deja exactamente ese
estado, así que un vencimiento desvinculado tampoco tiene cómo volver a vincularse. Esta es la
entrega 1a del #162; la ficha de la regla y el hub web quedan para la 1b.

Agregar un tercer botón hace cada fila más alta, y el bloque ya molesta desplegado con muchos
vencimientos (#163). Por eso va junto con que el bloque arranque plegado.

## What Changes

- Cada fila de «Vencimientos por revisar» ofrece **«Ya lo tengo cargado»** junto a Confirmar y
  Omitir, en web y en la app nativa, en Movimientos y en el inicio. Abre la misma lista de
  movimientos ya cargados que hoy usan el hub y la ficha, con la misma pregunta de conversión en una
  regla compartida. No crea movimientos ni mueve saldos. «Ya lo pagué» NO se agrega al bloque:
  Confirmar ya es esa acción.
- El bloque **siempre arranca plegado**, tenga los vencimientos que tenga. Plegado sigue mostrando
  el conteo y las líneas de reglas trabadas. Cuando el usuario lo despliega, su elección manda.
  **Reemplaza** la regla vigente de que el bloque arranca abierto si hay algo vencido, y corrige el
  requirement nativo viejo que decía «plegado desde dos».
- Una pendiente **con fecha futura** (la que deja desvincular) sigue en el bloque y cuenta en el
  «N por revisar», pero **no** cuenta para «regla trabada» ni para el aviso de gastos compartidos
  por confirmar: esas dos lecturas hablan de lo que ya venció.
- El párrafo «DIVERGENCIA CONOCIDA (#162)» se reescribe: el bloque deja de estar en divergencia y
  siguen la ficha y el hub web.

No entra: las acciones en el historial de la ficha ni el hub web igualado al nativo (1b), omitir en
lote (#163, segunda mitad) ni deshacer un pago registrado (#104).

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `transactions`: acciones del bloque de por revisar, su estado inicial plegado, qué cuenta para
  «regla trabada», y la divergencia conocida del requirement de acciones por estado.
- `shared-recurrences`: el aviso de gastos compartidos recurrentes por confirmar cuenta sólo los
  vencimientos ya llegados.

## Impact

- Pantalla: el bloque de pendientes en web (`apps/web/lib/recurrences/components/`) y en nativo
  (`apps/mobile/components/recurrences/PendingRecurrencesBlock.tsx`), y el aviso de Compartido en
  web.
- Lógica compartida: `@grana/recurrences` (`review-surface.ts`: estado inicial y reglas trabadas;
  `queries.ts`: el conteo de compartidos por confirmar).
- Sin migraciones: la base ya admite vincular una ocurrencia existente.
