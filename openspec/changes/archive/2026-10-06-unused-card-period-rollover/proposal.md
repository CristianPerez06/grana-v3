## Why

Una tarjeta que se da de alta y no se usa durante meses queda congelada en Grana: muestra **"$ 0 · A pagar"**, con el vencimiento viejo marcado en rojo, por tiempo indefinido. Y cuando la persona intenta corregir las fechas, el formulario la frena con un error («La nueva fecha de cierre cubriría todo el próximo resumen»). Pasa con tarjetas reales del usuario (Mastercard ICBC, Amex Santander). Grana pide pagar algo que no existe, y eso rompe la confianza contable del producto.

La causa es que los resúmenes siguientes solo se generan cuando se carga un consumo o se paga un resumen. Sin uso, el calendario de la tarjeta no avanza nunca.

## What Changes

- **Un resumen que cerró sin consumos se cierra solo.** No figura "A pagar", no figura "Vencido", no ofrece "Pagar resumen" y no suma en ningún total. En el historial queda como "Sin consumos". Si después se carga un consumo con fecha dentro de ese resumen, vuelve a ser un resumen a pagar como cualquier otro: el estado se sigue calculando, no se guarda.
- **La tarjeta siempre muestra el ciclo en curso.** Si no hay ningún resumen que cubra el día de hoy, Grana completa los resúmenes que faltan, con fechas estimadas, hasta llegar a hoy. Una tarjeta sin uso desde junio muestra, en octubre, el cierre y el vencimiento estimados del ciclo de octubre.
- **Nueva etiqueta "Sin consumos"** (gris neutro), junto a "A pagar", "Cierra pronto" y "Al día". Aparece cuando el resumen vigente de la tarjeta no tiene ningún consumo. No cuenta como "Vencen pronto".
- **Cargar un consumo de hoy en una tarjeta parada lo pone en el resumen correcto.** Hoy Grana crea un solo resumen nuevo a continuación del último, aunque no llegue a la fecha del consumo. Pasa a crear los que hagan falta hasta cubrirla.
- **Editar las fechas del ciclo deja de chocar con resúmenes estimados vacíos.** Si el nuevo cierre pasa por encima de un resumen que solo era una estimación sin consumos, ese resumen se descarta en lugar de dar error. El bloqueo sigue igual cuando el resumen pisado tiene consumos, un pago o fechas confirmadas.
- **El formulario de edición guarda en el orden que corresponde.** Si la persona corre el cierre actual más allá del cierre anterior del próximo resumen, y también cambió las fechas del próximo, se guarda primero el próximo. Así el caso de las capturas deja de fallar.
- Todo lo anterior se aplica igual en la web (incluida la vista de celular) y en la app nativa.

No se hace:
- No se cambia cómo se estiman las fechas: sigue el promedio de los ciclos anteriores. Anclar la estimación a "el día X de cada mes" queda afuera.
- No se tocan el dashboard ni los compromisos: un resumen vacío ya suma $0 ahí.
- No se agrega una migración: no cambia el esquema de la base.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `cards`:
  - el invariante "siempre hay un período abierto por delante de hoy" se mantiene también al leer la tarjeta, y completa todos los resúmenes que falten, no uno solo;
  - la asignación de un consumo posterior al último resumen crea los resúmenes necesarios hasta cubrirlo;
  - la edición de fechas absorbe resúmenes estimados vacíos en vez de rechazar, y fija el orden de guardado actual/próximo;
  - el indicador de estado por fila suma el tono "Sin consumos";
  - se agrega la regla de que un resumen cerrado sin consumos no se paga ni vence.

## Impact

- `@grana/money-logic`: variante de período para "cerrado sin consumos" y planificador puro de los resúmenes que faltan hasta una fecha.
- `@grana/transactions-mutations`: creación de períodos hacia adelante (consumos y lecturas), en bucle hasta cubrir la fecha.
- `@grana/cards`: lecturas `getCreditCards` y `getCreditCardDetail` completan el calendario antes de leer; `updatePeriodDates` absorbe estimados vacíos; nuevo tono `CardTone` y orden de guardado compartido para el formulario de edición.
- `@grana/i18n-messages`: textos "Sin consumos" (es/en).
- `apps/web` y `apps/mobile`: indicador de estado, CTA "Pagar resumen" en el detalle del resumen y formulario de edición de tarjeta.
- Sin cambios de base de datos (las políticas RLS ya permiten crear y borrar `card_periods` propios).
