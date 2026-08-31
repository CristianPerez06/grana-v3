# Design: unify-movement-search-fields

## Context

La búsqueda de movimientos está implementada tres veces, y cada implementación matchea un set de campos distinto:

| Texto visible en la fila | `/transactions` (RPC) | `/accounts/[id]` web | `/accounts/[id]` mobile |
|---|---|---|---|
| `description` efectiva | ✅ | ✅ | ✅ |
| `title` derivado | ✅ | ✅ | ❌ |
| Nombre de la cuenta origen | ✅ | ✅ | ✅ |
| Nombre de la cuenta destino | ⚠️ sólo `transfer` | ⚠️ sólo `transfer` | ✅ |
| **Institución** (origen y destino) | ❌ | ❌ | ❌ |
| Nombre de categoría fuera del `title` | ❌ | ❌ | ✅ |
| **Subcategoría** | ❌ | ❌ | ✅ |
| `canonical_name` | ❌ | ❌ | ✅ |

Los tres sitios:

- **SQL** — cláusula `ilike` de `get_movements_page`. Sirve al feed global web **y** a la tab Movimientos de mobile.
- **TS (web)** — `movementMatchesText` en `packages/transactions/src/filters.ts:79`, sobre `FinancialMovement`.
- **TS (mobile)** — `movementMatchesText` en `apps/mobile/lib/accounts/movement-filters.ts:69`, sobre `TransactionWithDetails`.

Restricciones del terreno, todas ya resueltas por el código existente:

- **El feed pagina, el detalle no.** El feed tiene que filtrar en la base: filtrar la página cargada respondería "cuáles de estas 50 filas coinciden" en vez de "cuáles del mes coinciden", y rompería `hasMore`. El detalle de cuenta carga el historial completo (lo necesita para el saldo corriente), así que filtrar en memoria es correcto y gratis. Esto ya está escrito en las specs de `transactions` y `accounts`, y no se toca.
- **La institución ya viaja en las dos lecturas.** `TRANSACTION_SELECT` embebe `institution:institutions(name)` en `source_account` y `destination_account` (`packages/transactions/src/queries.ts:35-36`), y la RPC ya tiene los joins `sai` / `dai` porque construye los objetos `source_account` / `destination_account` del payload. No hace falta ningún join ni ningún campo nuevo en ningún read.
- **`toFinancialMovement` ya aplana todo lo que el set necesita.** `account_institution_name`, `destination_account_institution_name`, `category_name`, `subcategory_name` están en `BaseMovement` (`movements.ts:23-37`).

## Goals / Non-Goals

**Goals:**

- Un set de campos buscables único, enunciado en la spec y verificable: la misma query devuelve lo mismo en las cuatro superficies.
- La institución de la cuenta pasa a ser alcanzable por búsqueda, en origen y destino.
- La cuenta destino de un `exchange` pasa a matchear, igual que ya matchea la de una `transfer`.
- Bajar de tres implementaciones del match a dos —el mínimo posible dado que una corre en SQL y la otra en JS.

**Non-Goals:**

- **Insensibilidad a acentos.** Es [#87](https://github.com/CristianPerez06/grana-v3/issues/87). Del lado JS sería una línea, pero del lado SQL pide la extensión `unaccent` y una decisión sobre índices; hacerlo acá mezclaría dos ejes en el mismo diff de la RPC.
- **Búsqueda i18n-aware.** Ver el trade-off más abajo. Se enuncia, no se resuelve.
- **Performance del match.** `ilike '%…%'` sobre un `concat_ws` no usa índice, ni antes ni después. Con el volumen actual es irrelevante; si molesta, `pg_trgm` o una columna `search_text` generada van en el change de #87, que es el que ya tiene que decidir sobre indexabilidad.
- **Mover el filtrado del feed a memoria** para "igualar" las superficies. Sería el arreglo al revés y rompería la paginación.

## Decisions

### 1. El set se angosta respecto del issue: categoría y subcategoría quedan afuera

El issue #78 proponía sumar `category.name` y `subcategory.name` como eje explícito. No entran.

La razón que decide es que **la categoría ya está en el `title` donde importa**. La RPC deriva `title` como `coalesce(c.name, 'Ingreso')` / `coalesce(c.name, 'Gasto')` para ingresos y gastos (`0042_…sql:150-157`, espejado en `movements.ts:303-318`), y la fila renderiza `description ?? categoría` como línea principal (`movement-row.tsx:115-118`). El caso que motivaba el pedido —"un gasto sin descripción es difícil de encontrar"— ya está cubierto: en ese gasto, la categoría **es** el título. Sumar el campo explícito sólo cambiaría el resultado en `transfer` / `exchange` / `card_payment` / `adjustment`, donde el título es una etiqueta fija y la categoría rara vez es lo que el usuario busca.

La razón de fondo es de diseño: categoría y subcategoría tienen filtro dedicado y preciso. Un eje con filtro propio no gana nada duplicándose como texto libre, y pierde predictibilidad — resultados que aparecen "por algo que no se ve" son los que hacen que la gente deje de confiar en la búsqueda.

**Alternativa considerada:** el set completo del issue. Cubre literalmente todo el texto visible de la fila, incluida la subcategoría de la línea secundaria. Se descartó por lo anterior, y como efecto colateral se evita el problema i18n más grande (las categorías del sistema se guardan en español y se renderizan traducidas).

**Alternativa considerada:** sólo `title` + `description`, lo más angosto posible. Se descartó porque obligaría a **sacar** el nombre de cuenta, que hoy matchea en las tres superficies: es una regresión visible, y dejaría la institución sin ninguna vía de acceso (no existe filtro por institución).

### 2. La declaración canónica del set vive en TS; el SQL la referencia

No hay forma de compartir código entre la cláusula `ilike` y el matcher JS. Lo que sí se puede es que haya **un solo lugar donde el set esté escrito como código**, y que el otro apunte ahí.

`movementMatchesText` de `@grana/transactions` es ese lugar: opera sobre `FinancialMovement`, que es el modelo que las cuatro superficies terminan renderizando, y es lo único de las dos implementaciones que se puede testear en CI. El SQL lleva un comentario de bloque que nombra el archivo y dice que cualquier cambio del set se hace en los dos lados.

**Alternativa considerada:** generar la cláusula SQL desde TS (codegen a la migración). Se descartó por desproporcionado — son seis campos en una función que cambia dos veces por año — y porque introduce un paso de build en el único lugar del repo que hoy no tiene ninguno.

### 3. El matcher nativo se borra; mobile consume el compartido

`apps/mobile/lib/accounts/movement-filters.ts:69` es una reimplementación del match sobre `TransactionWithDetails`. Es exactamente el patrón "mirror … keep in sync" que AGENTS.md prohíbe, y la divergencia de campos que motivó este change es la prueba de por qué.

Se puede borrar sin costo porque **el caller ya paga el precio de la conversión**: `MovementsSection.tsx:72-77` construye un `Map<string, MovementTypeFilter>` recorriendo las filas con `toFinancialMovement(tx).kind`. Ese memo pasa a guardar el `FinancialMovement` completo en vez de sólo su `kind` — misma cantidad de trabajo, mismo momento (una vez por carga de filas, no por interacción), y `applyAccountFilters` lo usa tanto para el eje de tipo como para el match. La firma cambia de `Map<string, MovementTypeFilter>` a `Map<string, FinancialMovement>`.

Efecto secundario que hay que nombrar: **el detalle de cuenta nativo pierde el match por subcategoría y por `canonical_name`**, que hoy tiene. Es intencional —es el precio de que las cuatro superficies devuelvan lo mismo— y a cambio gana el `title` derivado y las dos instituciones, que hoy no tiene. Ver Risks.

**Alternativa considerada:** mantener los dos matchers alineados a mano, como proponía el issue. Se descartó: es el estado actual, y el estado actual es el bug.

### 4. La migración se basa en `0042`, no en `0039`

El issue apunta a `0039_get_movements_page_account_institution.sql`. El cuerpo vigente de la función es el de **`0042_get_movements_page_exclude_shared.sql`**, que la redefinió entera para sumar el filtro `excludeShared`. `0055_harden_anon_boundary.sql` la toca también, pero sólo `revoke`/`grant`.

`0057` hace `CREATE OR REPLACE` partiendo del cuerpo de `0042` y cambia únicamente la cláusula de texto del `where`:

```sql
-- antes (0042:167-173)
and (f.text_pattern is null
     or concat_ws(' ', calc.title, calc.eff_description, sa.name,
          case when calc.kind = 'transfer' then da.name end) ilike f.text_pattern)

-- después
and (f.text_pattern is null
     or concat_ws(' ', calc.title, calc.eff_description,
          sa.name, sai.name, da.name, dai.name) ilike f.text_pattern)
```

El `case when calc.kind = 'transfer'` desaparece en vez de extenderse a `('transfer','exchange')`: `da` es `transactions.transfer_destination_account_id`, que sólo está poblado en esos dos kinds, así que el `case` no protegía de nada — el `concat_ws` ya ignora los `null`. Quitarlo es más simple y más correcto que enumerar kinds.

El escapeo del patrón (`0042:34-40`) no se toca: `%`, `_` y `\` tipeados por el usuario siguen escapándose antes de armar el `'%…%'`.

**Nota operativa:** por convención del repo la migración se aplica a Supabase antes de mergear el PR, así que la base va adelantada respecto de `main` durante la revisión. Verificar `gh pr list` antes de asumir un número de migración libre.

### 5. Los tests viven sólo en web, y eso es el punto

`apps/mobile` no tiene test runner (su `package.json` sólo expone `lint` y `typecheck`). Antes eso significaba que el matcher nativo no tenía cobertura posible. Al borrarlo, la única implementación JS del match queda cubierta por `apps/web/lib/transactions/__tests__/filters.test.ts`, y esa cobertura vale para las dos plataformas. La verificación del lado mobile es `typecheck` (la firma del `Map` cambia y rompe en compilación si el caller no se actualiza) más la verificación manual.

## Risks / Trade-offs

**[El detalle de cuenta nativo pierde el match por subcategoría y `canonical_name`]** → Es una pérdida real y visible para quien la use hoy en esa pantalla. Se acepta porque el objetivo del change es precisamente que las superficies no difieran, y porque el eje de subcategoría tiene filtro dedicado en la misma hoja de filtros de esa pantalla. A cambio la pantalla gana el título derivado y las dos instituciones. La spec de `accounts` deja el cambio escrito, así que no se descubre como regresión sin explicación.

**[SQL y TS pueden volver a divergir]** → No hay forma de que el compilador lo impida. Mitigación en tres capas: el set enunciado como requirement con scenarios (que es lo que un test futuro puede citar), el comentario cruzado entre la migración y `filters.ts`, y los tests de `movementMatchesText`, que fijan el borde de arriba (institución, destino en `exchange`) **y** el de abajo (subcategoría explícita NO matchea) — un test que sólo verifica lo que entra deja pasar la mitad de las regresiones posibles.

**[`ilike` sobre un `concat_ws` más ancho no usa índice]** → Ya no lo usaba: `'%…%'` con comodín inicial descarta el índice B-tree cualquiera sea el ancho. Sumar dos columnas agrega concatenación por fila sobre un conjunto que el `where` ya acotó por usuario (RLS), fecha y el resto de los filtros. Irrelevante al volumen actual; el eje de performance está anotado en #87, que es el que tiene que decidir sobre indexabilidad de todos modos.

**[La búsqueda no encuentra por etiqueta traducida con la UI en inglés]** → Preexistente, no lo introduce este change. El contenido del usuario matchea siempre (se guarda como se tipeó); lo que no matchea es el texto que genera Grana: las categorías del sistema (guardadas en español, renderizadas vía `translateCategoryLabel`) y el label de tipo de la fila, que se traduce al renderizar (`t(typeLabelKey[kind])`, `movement-row.tsx:84`) en vez de leerse del `title`. Se enuncia en la spec para que no se re-descubra. Cerrarlo implicaría sacar la derivación del título del SQL o llevar el catálogo i18n a la query — otro change.

**[El copy del placeholder queda un poco corto]** → "Descripción, cuenta o texto visible" sigue siendo cierto y ahora es más cierto que antes (la institución es parte de "cuenta" tal como el usuario la lee). No se toca: cambiarlo obligaría a tocar los catálogos i18n sin que nadie lo haya pedido.

## Migration Plan

1. Aplicar `0057` a Supabase (la base va adelantada respecto de `main`; es la convención del repo).
2. El cambio de TS es independiente del de SQL: cada superficie mejora por separado, no hay ventana en la que una rompa a la otra. Un deploy de web con la migración vieja simplemente mantiene el comportamiento actual del feed.
3. **Rollback**: `CREATE OR REPLACE` con el cuerpo de `0042`. No hay cambio de datos, de firma, de forma de respuesta ni de grants, así que revertir es una sola función y nada más.

## Open Questions

Ninguna. Las tres del issue quedaron resueltas antes de proponer: el set se acordó angosto (decisión 1), los acentos salieron a [#87](https://github.com/CristianPerez06/grana-v3/issues/87), y la performance se difirió al mismo ticket, que es el que tiene que decidir sobre indexabilidad.
