# Diseño — corregir el drift de signup y onboarding

## Context

Este change cierra la última deuda de contenido que dejó `split-project-conventions`, y de paso una que apareció al verificarla.

El hallazgo que ordena el diseño: el requirement de `accounts` y el de `onboarding` **se contradecían sobre el nombre de la misma cuenta**, y resolverlo mal era fácil. La migración `0007_accounts.sql` dice `Efectivo` con toda claridad; si uno la toma como fuente, "corrige" `onboarding`, `auth`, `dashboard` y `transactions` en la dirección equivocada y rompe cuatro specs que estaban bien. La `0012` es la que rige, porque la verdad del schema son las migraciones **ordenadas** — regla que el propio `AGENTS.md` enuncia y que es fácil de saltear cuando una migración temprana es explícita.

## Goals / Non-Goals

**Goals:**

- Que ambos requirements describan el flujo que el código ejecuta hoy.
- Que el scenario que describe un paso inexistente desaparezca en vez de corregirse: no hay ruta que arreglar, no hay paso.
- Que la corrección del nombre deje traza de por qué, para que no se revierta.
- Acotar la garantía de bimoneda a lo que realmente se garantiza.

**Non-Goals:**

- Renombrar el título del requirement de `accounts`. Ver Decisión 3.
- Tocar los usos correctos de "Efectivo" como tipo de cuenta o rótulo de sección.
- Construir el toggle de ocultar USD. Se lo describe como condicional, no se lo promete.
- Tocar código, migraciones o tests.

## Decisions

### Decisión 1 — El scenario de la cuenta bancaria se elimina, no se corrige

El scenario decía: "un usuario en `/onboarding/perfil` crea una cuenta bancaria → existen filas para ARS y USD". La tentación es corregir la ruta y seguir.

No alcanza, porque el defecto no es la ruta: **el wizard no crea cuentas**. Tiene tres pantallas —`welcome` no tiene inputs, `initial-balance` actualiza el `initial_balance` de la `Billetera`, `done` marca el onboarding completo— y ninguna inserta en `accounts`. Corregir la ruta produciría un scenario igual de falso con una URL válida, que es peor: se vuelve más creíble sin volverse más cierto.

En su lugar entra un scenario que afirma la propiedad real y es refutable: el wizard NO crea cuentas y opera sobre la `Billetera` del trigger. Un scenario que dice "esto no pasa" tiene valor cuando la spec afirmaba durante meses que sí pasaba.

### Decisión 2 — La corrección del nombre viene con la traza de las migraciones

Cambiar `Efectivo` por `Billetera` y nada más deja el arreglo expuesto a revertirse: el próximo que abra `0007_accounts.sql` va a ver `values (new.id, 'Efectivo', ...)` y va a concluir que la spec está mal.

Por eso el requirement dice explícitamente que la `0007` la creó como `Efectivo`, que la `0012` la renombró con reemplazo de la función del trigger más backfill, y que rige la ordenada. La spec no sólo afirma el hecho: explica por qué la evidencia que lo contradice no es la que manda.

Se agrega además el deslinde con "Efectivo" como tipo de cuenta y rótulo de sección, porque un grep por la palabra devuelve los dos usos mezclados y sólo uno estaba mal.

### Decisión 3 — El título del requirement de `accounts` no se toca

El título sigue siendo "Cuenta Efectivo por defecto en el signup" aunque el cuerpo diga `Billetera`. Es incómodo y es deliberado.

OpenSpec no tiene rename de requirement dentro de un `MODIFIED`: cambiar el título es `REMOVED` + `ADDED`, y eso arrastra al archive la misma ambigüedad de "¿esta regla se murió o se mudó?" que `split-project-conventions` tuvo que desactivar con `Reason` explícitos en 17 bloques. Pagar ese costo por un cambio cosmético no se justifica en esta change, cuyo valor está en el cuerpo.

Queda anotado como seguimiento, para hacerlo junto a otro cambio de `accounts` que ya justifique tocar ese requirement.

### Decisión 4 — La garantía de bimoneda se acota en vez de ampliarse

El texto decía "toda cuenta creada en el wizard… SHALL incluir ARS y USD". Verificado contra `accounts`, las cuentas que crea el usuario llevan "una o más" monedas, no necesariamente las dos.

Había dos salidas: ampliar la regla (exigir ambas monedas en toda cuenta) o acotarla a lo que se garantiza. Se acota, porque ampliar sería una regla **nueva** de producto disfrazada de corrección de spec — y una que el código no cumple, así que la spec quedaría falsa otra vez, en la dirección contraria.

## Risks / Trade-offs

- **El título de `accounts` queda desalineado con su cuerpo.** Es el costo consciente de la Decisión 3. Se mitiga porque la primera línea del cuerpo dice `Billetera` y explica el rename: nadie que lea el requirement se queda con el título.
- **Eliminar un scenario reduce el conteo de cobertura.** Es correcto acá: cubría un paso inexistente, así que no cubría nada. El scenario nuevo cubre una propiedad real.
- **El opt-out de USD queda descrito pero no construido.** Se acepta: la regla de que sólo afecta presentación es una restricción de diseño válida para cuando se construya, y ahora está marcada como condicional en vez de prometida.
