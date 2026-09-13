## Why

La red de seguridad del proyecto miente sobre las fechas, y miente distinto según
en qué máquina corra. Hoy `pnpm test` deja 14 de los 150 tests de
`@grana/recurrences` en rojo en una máquina argentina y los deja en verde en CI,
el mismo día y sobre el mismo commit ([#131](https://github.com/CristianPerez06/grana-v3/issues/131)).

**Ningún número de la app está mal.** Lo que está mal es el andamio con el que se
prueba: el simulador de base de datos que usan esos tests convierte las fechas
usando la hora de la máquina, y la base se las entrega en hora universal. En
Argentina (UTC−3) esa diferencia corre cada fecha **un día para atrás**, así que
una cuota que vence el 23 se lee como si venciera el 22. En CI, que corre en hora
universal, la diferencia es cero y nadie ve nada.

Eso deja dos daños. El chico: cada vez que alguien corre los tests antes de un PR
tiene que decidir a mano si el rojo es suyo o heredado, lo cual vuelve inútil al
gate local. El grande: **CI valida la app en un huso en el que el producto nunca
corre.** Grana es una app argentina cuya fecha contable es argentina; un gate que
corre en hora universal es estructuralmente ciego a toda una familia de errores de
fecha — justamente la familia que este bug destapó — y los deja pasar a `main`.
Que el rojo apareciera sólo en la máquina del autor no fue mala suerte: esa
máquina es la que está en el huso correcto.

## What Changes

- El simulador de base de datos de los tests **entrega las fechas tal como las
  entrega Supabase de verdad**: el texto `2026-06-23`, sin pasar por un objeto de
  fecha intermedio que la hora local pueda correr. Así el andamio deja de tener su
  propia opinión sobre qué día es.
- Los tests **corren en la zona horaria financiera de la app**
  (`America/Argentina/Buenos_Aires`), en toda máquina y también en CI. Hoy no hay
  ningún lugar que fije el huso: CI está en verde por accidente del runner.
- Con las dos piezas, los 150 tests de `@grana/recurrences` pasan, y pasan igual
  en una máquina argentina que en CI.

Lo que **no** se hace:

- No se toca la reparación de recurrencias ni ninguna lógica de la app: el
  comportamiento ya era correcto y los tests ya pedían lo correcto.
- No se fija el huso en hora universal. Pondría local y CI de acuerdo, pero de
  acuerdo en el huso equivocado, y volvería a esconder esta familia de errores.
- No se revisan los otros simuladores de base de datos del repo más allá de
  confirmar que no repiten esta conversión (no la repiten: es única).

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `schema-base`: dos requirements nuevos sobre la fecha contable. Uno fija que una
  fecha no puede cambiar de día al cruzar de la base a JavaScript, incluido
  cualquier doble de test que se haga pasar por el cliente de Supabase. El otro
  fija que los tests corren en la zona horaria financiera, para que un corrimiento
  de fecha salga rojo en CI en vez de esconderse.

La ubicación sale del test de admisión de `project-conventions`: manda el sujeto
del requirement, no su ámbito de aplicación. Estos dos hablan de fecha contable y
zona horaria financiera — el sujeto de `schema-base` — aunque se apliquen a los
tests de todo el repo.

## Impact

- `packages/recurrences/__tests__/support/pglite-postgrest.ts` — la conversión de
  fechas del simulador. Es el único lugar del repo que la hace.
- Configuración de vitest (raíz y por paquete/app) — dónde se fija el huso.
- `.github/workflows/ci.yml` — sólo si el huso se fija ahí y no en la config de
  vitest; la decisión va en `design.md`.
- 14 tests hoy en rojo vuelven a verde. Ninguna migración, ninguna pantalla,
  ningún dato.
