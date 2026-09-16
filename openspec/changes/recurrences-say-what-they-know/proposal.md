## Why

Las recurrencias ya saben dos cosas que no dicen. La app tiene el dato adentro y lo
calla, así que el usuario saca su propia conclusión — y se equivoca.

Es parte de la **Tanda 2** del relevamiento
(`docs/qa/relevamiento-recurrencias-2026-09-03.md`), la que ahí se llama «que el dato
deje de mentir». Las tandas 0 y 1 ya se entregaron (`fix-recurrence-backlog`,
`edit-recurrence-due-day`, `how-a-recurrence-ends`).

**«Lo que viene» se corta a fin de mes, y del día 23 en adelante desaparece.** Las dos
tarjetas del hub son «Próximos 7 días» y «Más adelante este mes». El 25 de septiembre,
la segunda arranca el 3 de octubre y termina el 30 de septiembre: **está vacía por
definición**. El alquiler del 23 de octubre no aparece en ninguna parte. Una semana por
mes, el horizonte de la app son siete días y nadie avisa que se achicó.

**Cuando una regla se traba, la app se queda callada.** Si una recurrencia lleva meses
sin resolverse, no hay ningún cartel que lo diga. Ese silencio es exactamente lo que
convirtió el #96 en un bug de tres meses en vez de una molestia de tres días: el
usuario no tenía cómo enterarse de que algo había dejado de funcionar.

## What Changes

**«Lo que viene» pasa a ser una ventana de 30 días corridos.** En vez de «lo que queda
del mes calendario», que se vacía sola, la segunda tarjeta muestra los próximos 30
días. La pregunta real de cualquiera es «qué se me viene», no «qué entra en el mes».

**La app dice cuando una regla está trabada, con todas las letras.** Cuando una regla
acumula vencimientos sin resolver, aparece un aviso que nombra desde cuándo y cuántos
son: «Esta recurrencia está trabada desde el 10 de junio. Hay 27 ocurrencias sin
registrar.» No bloquea nada y no inventa una acción nueva: las que ya existen
—ponerse al día, omitir, confirmar— siguen siendo las mismas.

### Lo que este cambio NO hace

- **No toca los datos.** Ninguna ocurrencia se crea, se borra, se resuelve ni se cuenta
  distinto. Ninguna migración. Lo que cambia es lo que la app dice y qué entra en una
  ventana de fechas.
- **No cambia qué pasa al pausar una regla.** El tercer comportamiento de la Tanda 2
  —que pausar pregunte qué hacer con los vencimientos que quedaron sin resolver, y que
  después la regla no vuelva a aparecer en el bloque— **se separó en un change propio**
  a pedido del usuario: toca el camino de escritura y necesita un diálogo nuevo en las
  dos plataformas, mientras que estos dos no tocan nada. Hasta que ese change se
  implemente, una regla pausada sigue comportándose como hoy.
- **No construye las tarjetas de «próximas» en nativo.** Hoy esa superficie existe sólo
  en web; el hub nativo muestra la próxima fecha en cada fila de regla. Darle a nativo
  las dos tarjetas es un cambio de paridad propio. El aviso de regla trabada **sí** entra
  en las dos plataformas, porque el bloque de vencimientos existe en las dos.
- **No es el X4 del relevamiento.** Ese —que la fila diga qué va a pasar antes de
  tocar— ya está implementado desde `fix-recurrence-backlog`.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `transactions`: dos requirements de recurrencias cambian — el bloque de pendientes
  pasa a nombrar una regla trabada, y la proyección de próximas ocurrencias del hub pasa
  de una ventana de mes calendario a una de 30 días corridos.

## Impact

- `packages/recurrences/src/review-surface.ts` — el modelo de vista compartido del
  bloque de vencimientos; ahí viven la urgencia y el estado del feed, y ahí entra la
  decisión de regla trabada, una sola vez para las dos plataformas.
- `apps/web/lib/recurrences/components/pending-recurrences-block.tsx` y
  `apps/mobile/components/recurrences/PendingRecurrencesBlock.tsx` — el dibujo del
  aviso, uno por plataforma.
- `apps/web/app/(app)/transactions/recurring/_components/upcoming-recurrences.tsx` — la
  ventana de 30 días. Es donde hoy vive el corte a fin de mes.
- `packages/i18n-messages/src/{es,en}.json` — las claves nuevas del aviso y el rótulo de
  la segunda tarjeta.
- Sin migraciones, sin cambios de esquema, sin escrituras nuevas a la base.
