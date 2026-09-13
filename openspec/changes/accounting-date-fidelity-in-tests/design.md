## Context

Ver `proposal.md` § Why para la motivación. Acá sólo el estado actual que explica
el enfoque.

Dos hechos del repo condicionan la solución:

1. **La conversión de fechas del andamio existe en un solo lugar.**
   `packages/recurrences/__tests__/support/pglite-postgrest.ts` decodifica las
   columnas `date` que devuelve PGlite. Es el único punto del repo que hace esa
   conversión: los otros simuladores de base de datos (`savings`, `cards`,
   `categories`, `accounts`) no la replican.
2. **Casi ningún paquete tiene config de vitest.** 11 paquetes más `apps/web` —
   12 scripts `test` en total — corren `vitest run` desde su propio script, y sólo
   tres tienen `vitest.config.ts` (`apps/web`, `@grana/movement-form`,
   `@grana/recurrences`); de los 11 paquetes, 9 no tienen ninguna.
   No hay config de vitest en la raíz ni `vitest.workspace.ts`. `pnpm test` es
   `pnpm -r test`, que invoca el script de cada paquete por separado — una decisión
   deliberada y documentada en `AGENTS.md` § Commands.

El segundo hecho es el que manda: cualquier mecanismo que viva en una config de
vitest deja afuera a los 9 paquetes que no tienen config.

## Goals / Non-Goals

**Goals:**

- Que el andamio entregue las fechas con la misma representación que el cliente
  real, sin conversión intermedia que el huso pueda correr.
- Que el huso quede fijado por **una sola** decisión del repo, y que cubra todos
  los caminos de invocación, no sólo `pnpm test` desde la raíz.
- Que olvidarse del huso en un paquete nuevo falle mecánicamente, no por revisión
  humana.

**Non-Goals:**

- No se reemplaza `pnpm -r test` por un runner central con `projects`. El repo
  eligió `-r` a propósito y `AGENTS.md` explica por qué; cambiarlo es otra change.
- No se auditan los otros simuladores más allá de confirmar que no repiten la
  conversión.
- No se agrega una dependencia nueva.

## Decisions

### D1 — El andamio pide la fecha como texto, en vez de corregir la conversión

PGlite decodifica `date` a un instante a medianoche en hora universal
(verificado: `'2026-06-23'::date` → `2026-06-23T00:00:00.000Z`). El andamio la
reformatea con los getters locales de `Date`, que en UTC−3 devuelven el día
anterior.

**Decisión:** registrar un parser de tipo para el OID `1082` que devuelva el valor
crudo, de modo que PGlite entregue directamente el texto `2026-06-23`. Verificado
que funciona, incluido en bordes de año y en fechas históricas.

**Por qué, y no usar los getters universales:** los getters universales también
arreglan el síntoma (verificado), pero dejan la conversión en pie, y con ella la
trampa de que el apareo correcto entre convención de construcción y convención de
lectura hay que recordarlo. Sacar el `Date` del camino elimina la clase de error en
vez de compensarla, y además hace lo que el propio comentario del archivo dice que
quiere hacer: entregar "la misma representación que entrega PostgREST". El cliente
real entrega texto; ahora el doble también.

### D2 — El huso se fija en el script `test` de cada paquete, con una aserción que lo vigila

**Decisión:** prefijar cada script `test` con
`TZ=America/Argentina/Buenos_Aires`, y agregar al job `monorepo-health` de CI una
aserción que falle si algún paquete con script `test` no lo lleva.

**Por qué el script y no una config:** el script es lo único que cubre todos los
caminos. Fijarlo sólo en el script raíz (`TZ=... pnpm -r test`) sería una sola
edición, pero deja afuera `pnpm --filter @grana/recurrences test`, que es
justamente el camino que `AGENTS.md` documenta para iterar sobre una suite — y el
que se usó para reproducir este bug. Fijarlo en las configs de vitest deja afuera a
9 paquetes. (Asignar `process.env.TZ` en runtime sí surte efecto en Node 24 —
verificado—, así que una config *funcionaría* donde existe; el problema es la
cobertura, no el mecanismo.)

**Por qué la aserción:** 12 ediciones se hacen una vez y se olvidan en el paquete
13, y el modo de falla es silencioso — los tests del paquete nuevo simplemente
heredan el huso de la máquina. El repo ya prefiere el gate mecánico a la memoria
humana en exactamente esta forma: la aserción de cobertura RLS de
`supabase/validate_schema.sql` existe por el mismo razonamiento, y `monorepo-health`
ya hospeda chequeos de consistencia del monorepo (frescura del lockfile, dedup de
peers). Es su lugar natural.

### D3 — Primero el andamio, después el huso. El orden no es intercambiable

**Decisión:** arreglar el andamio (D1) y verificar los 150 en verde **en los dos
husos** antes de fijar el huso (D2).

**Por qué:** al revés, la evidencia se pierde. Fijar el huso en argentino con el
andamio todavía roto deja los 14 tests en rojo y no distingue "el andamio sigue mal"
de "el arreglo no alcanzó". Y fijarlo sin arreglar el andamio tampoco es una opción
parcial válida: convertiría el rojo local de hoy en rojo de CI, que es peor que el
estado actual. Verificar en los dos husos antes de fijar es lo que prueba que los
tests pasan **por corrección** y no porque el entorno los acomode.

## Risks / Trade-offs

- **`TZ=x comando` en un script de npm no corre en cmd de Windows** → El repo es
  macOS en desarrollo y ubuntu en CI, sin ninguna señal de soporte Windows. Si
  alguna vez importa, la salida es `cross-env`, y la aserción de D2 es el lugar
  donde se cambiaría el patrón buscado. Trade-off aceptado.
- **Fijar el huso en argentino esconde errores que sólo aparecerían en otro huso**
  → Real, y es el precio de tener un huso fijo cualquiera. La alternativa no es
  "ningún huso" (eso es el estado actual, que esconde los errores argentinos, los
  únicos que hoy afectan al producto) sino parametrizar por huso los tests de la
  lógica que lo necesite. `schema-base` ya anticipa que el helper de "hoy"
  evolucione a `getTodayForTimezone(timezone)`; cuando eso pase, **esa** lógica
  merece tests que recorran varios husos explícitamente, en vez de depender del huso
  del proceso. Queda anotado, no resuelto acá.
- **Los 14 tests podrían pasar por la razón equivocada** → Mitigado por D3: se
  verifica en los dos husos antes de fijar ninguno.
- **La aserción de D2 puede volverse cosmética** si alguien agrega un paquete con
  script `test` que no corre vitest → La aserción chequea el prefijo del huso, no el
  runner, así que sigue valiendo. Un paquete sin script `test` no la activa, que es
  el comportamiento correcto.

## Migration Plan

No hay migración: ni datos, ni schema, ni pantallas. Los pasos son de verificación,
en el orden de D3.

1. Aplicar D1. Correr `pnpm --filter @grana/recurrences test` con `TZ=UTC` y con
   `TZ=America/Argentina/Buenos_Aires`: 150 en verde en los dos.
2. Aplicar D2. Correr `pnpm test` completo desde la raíz, y `pnpm --filter
   @grana/recurrences test` suelto: mismo resultado, sin depender del huso de la
   máquina.
3. Verificar en CI, en verde, en el PR.
4. Volver a correr la suite unos días después. El encabezado de
   `future-seed-repair` declara que quiere ser inmune al paso del tiempo, así que
   eso es parte de lo que hay que verificar y no se puede verificar el mismo día.

Rollback: revertir el commit. No queda estado atrás.
