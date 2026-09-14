## 1. El andamio deja de opinar sobre qué día es

- [x] 1.1 En `packages/recurrences/__tests__/support/pglite-postgrest.ts`, hacer que
      las columnas `date` lleguen como el texto `YYYY-MM-DD` en vez de decodificarse a
      `Date` y reformatearse (D1: parser de tipo para el OID 1082).
- [x] 1.2 Borrar la conversión con getters locales (`getFullYear`/`getMonth`/`getDate`)
      que queda sin uso, y actualizar el comentario del archivo para que describa lo que
      hace ahora: entregar el mismo texto que entrega PostgREST.
- [x] 1.3 Agregar un test del propio andamio que fije la fidelidad: una columna `date`
      leída a través del doble devuelve el texto exacto que se insertó, y no un `Date`.
      Es el test que impide que la conversión vuelva a entrar.

## 2. Verificar que pasan por corrección y no por entorno (D3)

- [x] 2.1 `TZ=UTC pnpm --filter @grana/recurrences test` → 150 pasan, 0 fallan.
- [x] 2.2 `TZ=America/Argentina/Buenos_Aires pnpm --filter @grana/recurrences test` →
      150 pasan, 0 fallan. Los 14 fallos de #131 quedan en verde con el huso argentino
      puesto, que es la prueba de que el arreglo es real.
- [x] 2.3 `pnpm test` completo (los 12 scripts) sin regresiones en los otros paquetes.

## 3. Fijar el huso financiero en los tests

- [x] 3.1 Prefijar con `TZ=America/Argentina/Buenos_Aires` el script `test` de los 11
      paquetes que lo tienen (`accounts`, `cards`, `dashboard`, `money-logic`,
      `movement-form`, `recurrences`, `savings`, `shared`, `transactions`,
      `transactions-mutations`, `validation`) y el de `apps/web`.
- [x] 3.2 Agregar al job `monorepo-health` de `.github/workflows/ci.yml` una aserción
      que falle si algún `package.json` con script `test` no lleva el prefijo del huso,
      nombrando en el mensaje de error el paquete que falta.
- [x] 3.3 Verificar la aserción por los dos lados: falla si se le quita el prefijo a un
      paquete, pasa con los 12 puestos.

## 4. Dejar la regla escrita donde se busca

- [x] 4.1 Documentar en `AGENTS.md` que los tests corren en la zona horaria financiera
      y por qué no en UTC, y que un doble del cliente de Supabase entrega las fechas
      como texto. Va junto a las reglas de fecha contable existentes, no como sección
      nueva.
- [x] 4.2 `pnpm openspec:check` en verde.
- [ ] 4.3 Cerrar el issue #131 con el hallazgo: era el andamio, no la reparación de
      recurrencias, y el `hoy + 29` que parecía un piso mal liberado era `hoy + 30`
      corrido un día por el huso.
      **Deliberadamente sin hacer al archivar:** el arreglo vive en la branch, no en
      `main`, y cerrar el issue antes del merge afirmaría que el bug está resuelto en
      el producto cuando todavía no lo está. El merge lo hace el usuario (regla del
      repo), así que el cierre del issue va con el merge, no antes.
