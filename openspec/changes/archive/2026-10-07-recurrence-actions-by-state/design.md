## Context

Ver `proposal.md` — Why. Tres cosas del estado actual condicionan el cómo:

- Los rechazos del circuito de vincular ya viajan como **código** (`linkErrorCode`, más el `GRN01` de liquidaciones) y se traducen en cada app con `linkErrorMessageKeys` de `@grana/recurrences`, que devuelve claves relativas a `recurrences.link.`. El package no conoce los catálogos y no debe conocerlos. El resto de las mutaciones devuelve `formError` como texto en español: web lo muestra tal cual y nativo lo descarta en `localize` (salvo en `localizeForm`, para crear y editar).
- El spec ya tiene un precedente para una regla que el código todavía no cumple: los «Compromisos» del inicio quedaron escritos como **divergencia conocida** con la frase «hasta que se haga el sistema NO SHALL darse por cumplido en esa pantalla». Es la forma de fijar el comportamiento sin que el spec mienta sobre el presente.
- Los comentarios con el supuesto «existe ⇒ ya pasó» están en cinco archivos de tres paquetes y dos apps. Ninguno afecta comportamiento.

## Goals / Non-Goals

**Goals:**
- Un solo mecanismo de traducción para todos los rechazos del módulo, en las dos apps, sin que el package dependa de catálogos.
- Que los tests detecten un código sin texto o sin traducir antes de que llegue a pantalla.
- Que el spec diga dónde va cada acción, y que nombre lo que todavía no se cumple.

**Non-Goals:**
- Implementar el #162 o la paridad del hub (son el change siguiente).
- Tocar las guardas de borrado de `@grana/transactions-mutations` («Tarjeta no encontrada.»), que tienen el mismo problema en otro módulo.
- Cambiar los textos existentes del español: se mueven al catálogo tal como están.

## Decisions

### D1 · Un `guardCode` al lado del `formError`, no en su lugar

Cada rechazo del package suma `guardCode: RecurrenceGuardCode` (unión de strings, una por mensaje) y **conserva** el `formError` en español. Las apps traducen `recurrences.guards.<code>` cuando el código está, y caen al `formError` sólo si no está.

Por qué así y no reemplazando `formError`: el package es consumido también por tests y por el seam de `@grana/transactions-mutations`, que leen `formError`; quitarlo rompe lo que hoy funciona para ganar nada. Y conservar el texto deja el **fallback** correcto en el único caso en que el código no alcanza: un error del motor que el package sólo puede repetir (`insertError.message`). Ahí el `guardCode` es `save_failed` y el texto crudo no llega a pantalla.

Alternativa descartada: reusar `linkErrorCode`. Ese tipo nombra rechazos de un circuito y se traduce bajo `recurrences.link.`; meterle «regla no encontrada» desdibuja los dos.

### D2 · La lista de códigos vive en el package y el test en web

`RECURRENCE_GUARD_CODES` se exporta del package como arreglo `readonly`, igual que `LINK_ERROR_MESSAGE_KEYS`, y el test de catálogo existente (`apps/web/lib/recurrences/__tests__/link-error-catalog.test.ts`) gana un bloque que exige, para cada código, texto en `es` y en `en` y que los dos difieran. El test vive en web porque el package no depende de `@grana/i18n-messages`, y no debería.

### D3 · Las dos apps traducen en el único lugar por el que ya pasan los resultados

- Web: un helper `translateGuard(result)` en `apps/web/app/_actions/recurrences.ts` que devuelve el texto traducido o `null`, aplicado en cada action que hoy devuelve `result` o `formError ?? result.formError`. El orden es `mapErrorCode` → vínculo → `guardCode` → `formError`, el mismo que nativo.
- Nativo: `localize` y `localizeForm` en `apps/mobile/lib/recurrences/mutators.ts` ganan la rama `guardCode` antes del genérico. `localizeForm` deja de devolver el `formError` crudo: con código traducido ya no hace falta, y era la única rama que mostraba español en inglés.

### D4 · El spec fija el comportamiento y nombra la divergencia

El requirement nuevo escribe la tabla de acciones por estado como SHALL, y cierra con un párrafo «DIVERGENCIA CONOCIDA (#162)» que enumera qué pantallas no lo cumplen hoy y dice que el sistema no se da por cumplido en ellas. Es el patrón de «Compromisos». La alternativa, escribir sólo lo que hoy pasa, dejaría el spec afirmando la restricción que causa el #162.

Dentro de la tabla hay una decisión de producto que el ticket dejaba abierta: la ficha de la regla no apunta sus botones «al pendiente más viejo»; cada fila pendiente del historial lleva sus acciones y «Próxima fecha» sigue anunciando lo que se va a generar. La razón está en el spec: con dos o más pendientes, apuntar al más viejo resuelve uno y deja a los demás igual.

Y una segunda: el hub ofrece las acciones sobre **la próxima ocurrencia de cada regla activa**, además de las filas proyectadas. Es lo que hace nativo; web se iguala en el change del #162.

### D5 · Los comentarios se reescriben, no se borran

Cada comentario con el supuesto viejo se reemplaza por la regla vigente, nombrando qué la cambió cuando ayuda («desde `recurrence-link-movement` una ocurrencia puede existir con fecha futura»). Borrarlos dejaría el código sin la explicación que el comentario daba.

## Risks / Trade-offs

- [Un código nuevo sin texto llega a pantalla como clave cruda] → el test de catálogo falla en CI; la lista de códigos es la unión de TypeScript, así que agregar un código sin agregarlo a la lista es un error de tipos.
- [Nativo deja de mostrar el `formError` crudo en crear/editar] → los dos únicos textos que llegaban por ahí (cuenta sin moneda, destino igual al origen) tienen código y catálogo; el test de cableado nativo cubre `localizeForm`.
- [El spec nombra una divergencia que alguien lee como «ya resuelta»] → el párrafo cita el ticket y dice qué pantallas no cumplen; el change del #162 lo borra al cerrarlas.
