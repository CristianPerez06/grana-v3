## Why

Las recurrencias ya saben tres cosas que no dicen. La app tiene el dato adentro y lo
calla, así que el usuario saca su propia conclusión — y se equivoca.

Es la **Tanda 2** del relevamiento (`docs/qa/relevamiento-recurrencias-2026-09-03.md`),
la que ahí se llama «que el dato deje de mentir». Las tandas 0 y 1 ya se entregaron
(`fix-recurrence-backlog`, `edit-recurrence-due-day`, `how-a-recurrence-ends`).

Los tres silencios, en orden de lo que cuesta cada uno:

**Pausar no se siente como pausar.** Julieta pausa el gimnasio y la cuota de febrero
sigue apareciendo en «Vencimientos por revisar», idéntica a las demás. No hay nada que
diga por qué está ahí ni que no van a venir más. La app sabe que la regla está pausada
—lo muestra en el listado de reglas— y no lo dice donde importa.

**«Lo que viene» se corta a fin de mes, y del día 24 en adelante desaparece.** Las dos
tarjetas del hub son «Próximos 7 días» y «Más adelante este mes». El 25 de septiembre,
la segunda arranca el 3 de octubre y termina el 30 de septiembre: **está vacía por
definición**. El alquiler del 23 de octubre no aparece en ninguna parte. Una semana
por mes, el horizonte de la app son siete días y nadie avisa que se achicó.

**Cuando una regla se traba, la app se queda callada.** Si una recurrencia lleva meses
sin resolverse, no hay ningún cartel que lo diga. Ese silencio es exactamente lo que
convirtió el #96 en un bug de tres meses en vez de una molestia de tres días: el
usuario no tenía cómo enterarse de que algo había dejado de funcionar.

## What Changes

**Un vencimiento de una regla pausada lo dice.** Sigue apareciendo en la lista —el
usuario todavía puede querer confirmarlo u omitirlo— pero con un sello **«Pausada»**
que explica por qué está ahí y que no van a venir más. Esconderlo se evaluó y se
descartó en el relevamiento: le sacaría de la vista algo que todavía puede resolver.

**«Lo que viene» pasa a ser una ventana de 30 días corridos.** En vez de «lo que queda
del mes calendario», que se vacía sola, la segunda tarjeta muestra los próximos 30
días. La pregunta real de cualquiera es «qué se me viene», no «qué entra en el mes».

**La app dice cuando una regla está trabada, con todas las letras.** Cuando una regla
acumula vencimientos sin resolver, aparece un aviso que nombra desde cuándo y cuántos
son: «Esta recurrencia está trabada desde el 10 de junio. Hay 27 ocurrencias sin
registrar.» No bloquea nada y no inventa una acción nueva: las que ya existen
—ponerse al día, omitir, confirmar— siguen siendo las mismas.

### Lo que este cambio NO hace

- **No esconde nada.** Ni el vencimiento pausado ni la regla trabada desaparecen de
  ninguna lista. El cambio es lo que la app dice, no lo que muestra.
- **No cambia la generación ni los saldos.** Ninguna ocurrencia se crea, se borra ni se
  cuenta distinto. Ninguna migración.
- **No construye las tarjetas de «próximas» en nativo.** Hoy esa superficie existe sólo
  en web; el hub nativo muestra la próxima fecha en cada fila de regla. Darle a nativo
  las dos tarjetas es un cambio de paridad propio, no un arreglo de este. El sello
  «Pausada» y el aviso de regla trabada **sí** entran en las dos plataformas, porque el
  bloque de vencimientos existe en las dos.
- **No es el X4 del relevamiento.** Ese —que la fila diga qué va a pasar antes de
  tocar— ya está implementado desde `fix-recurrence-backlog`; la Tanda 2 quedó en tres
  comportamientos, no cuatro.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `transactions`: tres requirements de recurrencias cambian — el bloque de pendientes
  pasa a distinguir el vencimiento de una regla pausada y a nombrar una regla trabada;
  la proyección de próximas ocurrencias del hub pasa de una ventana de mes calendario a
  una de 30 días corridos.

## Impact

- `packages/recurrences/src/review-surface.ts` — el modelo de vista compartido del
  bloque de vencimientos; ahí viven la urgencia y el estado del feed, y ahí entran el
  sello de pausada y el aviso de trabada, una sola vez para las dos plataformas.
- `apps/web/lib/recurrences/components/pending-recurrences-block.tsx` y
  `apps/mobile/components/recurrences/PendingRecurrencesBlock.tsx` — el dibujo del
  sello y del aviso, uno por plataforma.
- `apps/web/app/(app)/transactions/recurring/_components/upcoming-recurrences.tsx` — la
  ventana de 30 días. Es donde hoy vive el corte a fin de mes.
- `packages/i18n-messages/src/{es,en}.json` — las claves nuevas. La clave `rule_paused`
  ya existe y no se usa en ningún lado: este cambio la consume o la reemplaza, pero no
  la deja huérfana.
- Sin migraciones, sin cambios de esquema y sin lecturas nuevas a la base.
