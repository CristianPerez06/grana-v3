## Context

`packages/shared/src/queries.ts` es la capa de datos del módulo Compartido, consumida igual por `apps/web` (server components) y `apps/mobile` (wrapper fino que inyecta el cliente nativo). Ocho de sus reads traen filas de detalle sin ninguna cota; **en todo el archivo no hay un solo `.range()`**.

El camino que produce la deuda es el crítico:

| Línea | Read | Alimenta |
|---|---|---|
| 117 | `shared_expense_split` por `household_id` | deuda, extracto, proyección |
| 142 | `transactions` `.in('id', txIds)` | tipo/fecha/moneda de cada split |
| 175 | `transactions` `.in('id', linkedIds)` | etiqueta de los reintegros |
| 220 | `settlement` por `household_id` | resta del saldo |
| 349 | `settlement` por `household_id` (2.ª vez) | filas del extracto |

Los tres consumidores —`getHouseholdDebt`, `getHouseholdOutlook`, `getCurrentAccount`— comparten `collectDebtInputs`, así que el defecto es único y el arreglo también.

Aparte, `getSharedAccruedMovements` (L461, L474, L494) acota con `.limit(500)` fijo y alimenta "Gastaron juntos", el desglose por categoría y el NETO: números de dinero cuya corrección depende de que el mes no pase de 500 movimientos.

El repo ya resolvió este problema dos veces —`getAccountMovementsAscending` (`packages/transactions/src/queries.ts:117`) y `getMonthBalanceSeries` (`packages/dashboard/src/queries.ts:191`)— y lo dejó escrito como requirement normativo en `web-data-access:327`. Este change lo aplica al módulo que quedó afuera.

**Estado de los datos hoy**: el hogar más grande tiene 186 splits contra un techo de 1000. El bug es latente, no activo. Eso define la postura: preservar comportamiento exactamente, sin oportunismo.

## Goals / Non-Goals

**Goals:**

- Que la deuda, el extracto, la proyección y el devengado del mes sean completos **por construcción**, no por tamaño del dataset.
- Que el paginado sea estable: orden determinístico, sin páginas que se solapen ni salteen.
- Cero cambio de comportamiento visible con los volúmenes actuales.
- Cubrir web y mobile con un solo arreglo, sin tocar ninguna de las dos apps.
- Dejar un test que falle si alguien vuelve a introducir un read sin cota en este camino.

**Non-Goals:**

- **No** se toca `@grana/money-logic`. `deriveCurrentAccount`, `computeHouseholdBalances` y `householdDebtAt` siguen siendo la fuente de verdad de la fórmula; este change solo garantiza que reciban el dataset entero.
- **No** hay migración ni RPC nueva. No se toca schema, RLS ni triggers.
- **No** se toca `getSharedExpenses`: su cota es de presentación, intencional y visible, explícitamente excluida por `web-data-access:348`.
- **No** se optimiza performance. Si el paginado agrega round-trips, se aceptan: el requirement es corrección.
- **No** se extrae un helper de paginación cross-package (ver D2).

## Decisions

### D1 — Paginación exhaustiva, no agregación en Postgres

`web-data-access:333` ofrece dos formas válidas y **prefiere** la RPC de agregación. Acá se elige la otra, deliberadamente.

La RPC resuelve cuando el producto del read es *solo* un número, como en `get_account_balance_sums`. No es el caso: de las mismas filas salen tres productos distintos. `getHouseholdDebt` quiere un neto, pero `getCurrentAccount` arma el **extracto** (una fila por movimiento, con etiqueta, fecha de impacto, monto y saldo corrido) y `getHouseholdOutlook` **itemiza** los meses que vienen. Una RPC de agregación cubriría un consumidor de tres y dejaría a los otros dos leyendo filas sin cota — el bug intacto, con una capa más.

Se podría hacer RPC *y* paginación, pero eso son dos fuentes de verdad de la fórmula de deuda que hay que mantener sincronizadas con un test de paridad, como pasó con `calculateTransactionSums`. Ese costo se justifica cuando la agregación es el camino caliente; acá no lo es.

**Alternativa considerada**: RPC `get_household_debt_sums` solo para `getHouseholdDebt` (el widget de `/shared`, el más frecuente). Descartada por ahora — queda anotada en el proposal como opción futura si el volumen la justifica.

### D2 — El helper de paginación vive local a `@grana/shared`

Los ocho call sites necesitan el mismo loop. Escribirlo ocho veces a mano es la duplicación que justifica un helper; el archivo se lleva uno privado, tipado sobre el builder de PostgREST:

```ts
/** Filas por round-trip. Independiente del `max-rows` del servidor: el loop
 *  avanza por lo que efectivamente volvió y corta en página vacía, así que un
 *  techo servidor más chico cuesta round-trips y nunca trunca. */
const PAGE_SIZE = 1000

async function fetchAllRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]>
```

**No** se extrae a un paquete común, aunque `@grana/transactions` y `@grana/dashboard` ya tengan su propia copia del loop. La convención del repo es extraer cuando la duplicación real aparece y con confirmación previa, no anticipándose; y una extracción cross-package acá tocaría dos módulos fuera del alcance de este change, ampliando el blast radius de un arreglo que se quiere quirúrgico. Queda como pregunta abierta.

### D3 — El conjunto de `transactions` se expresa como predicado, no como lista de ids

`collectDebtInputs` hoy junta los `transaction_id` de los splits y los manda con `.in('id', txIds)`. Paginar eso **no lo arregla**: con miles de uuids la URL cruza el límite de largo de PostgREST y el request falla entero. Es un segundo modo de falla, independiente del `max-rows`.

El mismo conjunto se expresa server-side:

```ts
.from('transactions').eq('household_id', householdId).eq('is_shared', true)
```

**Por qué es equivalente**: el invariante simétrico que instaló `fix-shared-unshare-integrity` (mig. 0048) garantiza que `is_shared = false` ⇒ sin splits. O sea, toda transacción que porta un split del hogar cae dentro del predicado. Al revés el predicado trae de más —la madre de una compra en cuotas es `is_shared` y no tiene splits propios—, pero eso es inocuo: el armado de `projectable` itera **los splits** y busca la transacción en el mapa, así que una entrada de sobra en el mapa no aporta nada.

El filtro defensivo de L192 (`if (!tx || !tx.is_shared || …) return []`) **se mantiene tal cual**. Con este cambio se vuelve redundante por construcción, pero es la red que atrapa un split extraviado, y quitarla sería deshacer una decisión de `fix-shared-unshare-integrity`.

### D4 — La etiqueta del reintegro sale del mapa que ya se trajo

Con D3, todas las transacciones compartidas del hogar están en `txById`, y el gasto que un reintegro compensa (`linked_transaction_id`) es uno de ellos. La segunda lectura de `transactions` (L175) queda sin razón de ser: la etiqueta se resuelve del mapa.

Para no cambiar comportamiento en un borde no verificado —un reintegro apuntando a un gasto fuera del conjunto del hogar— se conserva un read residual, paginado, solo para los ids que **no** estén en el mapa. Se espera que sea siempre vacío; si lo es, no cuesta un round-trip.

### D5 — Una sola lectura de `settlement`

Hoy `getCurrentAccount` lee `settlement` dos veces para el mismo hogar en el mismo request: una dentro de `collectDebtInputs` (L220, columnas mínimas) y otra propia (L349, con `id`/`status`/fechas). `collectDebtInputs` pasa a devolver **las filas ricas** una sola vez, y cada consumidor proyecta lo que necesita. Elimina un round-trip y, más importante, elimina la posibilidad de que las dos lecturas devuelvan conjuntos distintos.

### D6 — Orden determinístico por tabla

El paginado con `.range()` es estable solo con `ORDER BY` total. Se elige el más barato que sea total en cada tabla:

- `shared_expense_split` → `.order('transaction_id').order('user_id')`. El `unique (transaction_id, user_id)` de la mig. 0023 lo hace total.
- `transactions` → `.order('id')`. Es la PK: total y con índice. **No** se ordena por fecha: a diferencia del precedente de `getAccountMovementsAscending`, acá el consumidor no quiere filas cronológicas — `deriveCurrentAccount` reordena por fecha de impacto igual (`shared.ts:441`). El orden acá solo tiene que ser estable.
- `settlement` → `.order('id')`, misma razón.

### D7 — El devengado del mes pagina su ventana en vez de truncarla

`getSharedAccruedMovements` conserva su ventana `[start, end)` —angostar por mes es un predicado del dominio, compatible con el requirement— y reemplaza los `.limit(500)` por el loop de D2. El read de splits que lo acompaña (L494) sigue el mismo camino.

### D9 — Una página con error corta el proceso, no el recorrido

*(Decidido durante la implementación.)*

El resto del archivo desestructura solo `data` y trata la ausencia de filas como conjunto vacío. Eso no se puede sostener dentro del loop: en un error PostgREST devuelve `data: null`, que es **indistinguible de "no hay más filas"**. Tratarlo como fin del recorrido reintroduciría exactamente el truncado silencioso que el helper existe para evitar, solo que a mitad del conjunto en vez de en el techo.

`fetchAllRows` entonces **lanza** ante un error de página. Es un cambio de comportamiento respecto del código anterior —donde un error de red en la lectura de splits dejaba la deuda en "saldado"— y es deliberado: fallar ruidosamente es la única alternativa correcta a un número de dinero inventado. Lo cubre el test "does not end the walk on an errored page".

### D10 — La doble recolección de inputs queda como está

*(Observado durante la implementación.)*

`getCurrentAccount` llama a `collectDebtInputs` para el extracto y después a `getHouseholdOutlook`, que **vuelve a llamarla** para la proyección: todo el conjunto de entrada se trae dos veces por carga de página. Con la paginación eso ahora cuesta el doble de round-trips.

Es preexistente y **no se toca**: deduplicarlo es una optimización, y "no se optimiza performance" es un non-goal explícito de este change. Se deja documentado con un assert que fija el número real (4 round-trips a `settlement`, no 2) en vez de esconderlo, y la garantía que este change sí da —una sola lectura por recolección— se ancla por separado sobre `getHouseholdDebt`. Candidato claro para un change de eficiencia posterior.

### D8 — Test de read-path con techo artificial

`packages/shared` no tiene infra de tests: se le agrega `vitest` como devDependency y los scripts `test` / `test:watch`, espejando `packages/dashboard`.

El test usa un cliente Supabase fake que **honra `.range()`** y aplica un techo por página deliberadamente bajo (p. ej. 2 filas), con un dataset que lo cruza varias veces. Modela la base, no la forma de la query, para que no se rompa al refactorizar el read — mismo criterio que `packages/dashboard/__tests__/balance-read-path.test.ts`. Ancla tres cosas: que el conjunto se agota, que el saldo es idéntico al del mismo dataset por debajo del techo, y que dos corridas dan el mismo orden.

## Risks / Trade-offs

- **Más round-trips a medida que crece el hogar** → mitigado por `PAGE_SIZE = 1000`: los hogares actuales (186 splits el mayor) entran en una sola página, así que hoy el costo es exactamente cero. D5 además saca un round-trip, con lo que el neto inmediato es favorable.
- **D3 cambia el conjunto de `transactions` que se trae y podría alterar la deuda** → el argumento de equivalencia se apoya en el invariante de la mig. 0048; se mitiga conservando el filtro defensivo de L192 y con un test que alimente el mismo dataset a la implementación vieja y a la nueva verificando saldo idéntico.
- **D4 podría cambiar una etiqueta del extracto en un borde no verificado** → mitigado por el read residual, que preserva el comportamiento exacto en vez de degradar a la etiqueta genérica.
- **El fake del test puede divergir del PostgREST real** → es la limitación inherente del precedente que se copia. Acota el riesgo que el test cubre bien (la lógica del loop) y no pretende cubrir el que no (el comportamiento del servidor).
- **`packages/dashboard/__tests__` no está en el glob de `apps/web/vitest.config.ts`** (que solo incluye `lib/**/__tests__/**`), sino que corre por el `test` script del propio paquete. El test nuevo hereda esa condición: `pnpm --filter @grana/shared test`. Que ningún script raíz corra los tests de packages es un hueco preexistente y **fuera de alcance** — se anota para un change de CI.

## Migration Plan

No hay migración de datos ni de schema. Es un cambio de código puro, retrocompatible y desplegable de una: las firmas públicas de `@grana/shared` no cambian, así que `apps/web` y `apps/mobile` no requieren edición ni redeploy coordinado. Rollback = revertir el commit.

## Open Questions

- ¿Extraer el loop de paginación a un paquete común (`@grana/supabase`), dado que ya son tres los módulos que lo escriben a mano? Requiere confirmación explícita por la convención de extracción del repo y tocaría `@grana/transactions` y `@grana/dashboard`. Propuesta: **change aparte**, después de este.
- ¿Vale la pena la RPC `get_household_debt_sums` para el widget de deuda de `/shared`, que es el read más frecuente del módulo? Solo si aparece evidencia de que el round-trip pesa; hoy no la hay.
- ¿Cablear los tests de `packages/*` a un script raíz? Hueco preexistente que este change deja igual que como lo encontró.
