## Context

Dos superficies nativas listan movimientos y sólo una se puede acotar.

| | Detalle de cuenta (`MovementsSection.tsx`) | Feed global (`transactions/index.tsx`) |
|---|---|---|
| Read | `getAccountMovementsAscending` — **todas** las filas de la cuenta | `getGlobalMovementsPage` — **una página** (limit+1 lookahead) |
| Modelo de fila | `TransactionWithDetails` (fila DB + joins) | `FinancialMovement` (VM derivado) |
| Filtrado | En memoria (`applyAccountFilters`) | Ninguno, salvo el mes |
| Toolbar | Completa: mes inline, búsqueda, chips de acción, chips activos | Ninguna |
| Opciones del sheet | Derivadas de las filas cargadas | — |

La asimetría de reads no es accidental: el detalle necesita el historial completo para calcular el **running balance por fila**, así que ya tiene todo en memoria y filtrar ahí es gratis. El feed no puede: pagina.

Ese es el eje de todo este diseño. Lo que se comparte tiene que ser lo que no depende de esa diferencia (la **hoja de filtros**, los **chips activos**, la **forma del estado**), y lo que no se comparte tiene que quedar explícito para que un lector futuro no lo lea como drift.

Restricciones del repo que acotan el espacio de soluciones:

- **JSX no se comparte entre web y RN.** La paridad se garantiza con contratos de props, no con componentes. Esto ya está resuelto acá: el sheet nativo existe, no hay que inventarlo.
- **Una superficie nativa con input de texto no arma su scroller a mano** (AGENTS.md, spec `mobile-app-shell`). El feed ya usa `KeyboardAwareScrollView` del layer de layout y el sheet ya monta su `KeyboardProvider` en la raíz de su `Modal`. La búsqueda no obliga a tocar chrome.
- **El grafo de packages es dirigido**: `@grana/accounts → @grana/cards → @grana/transactions → @grana/dashboard`. Nada que entre a `@grana/transactions` puede importar `@grana/accounts`.

## Goals / Non-Goals

**Goals:**

- El feed de Movimientos se acota por texto, tipo, cuenta, categoría/subcategoría, moneda y rango de monto.
- Los filtros del feed se resuelven **en la base**, de modo que la paginación siga siendo correcta con filtros activos.
- Una sola implementación de la hoja de filtros, servida a las dos superficies.
- El usuario que vació la lista con sus propios filtros entiende por qué y puede deshacerlo en un toque.

**Non-Goals:**

- **Rango de fechas custom** (`from`/`to`) → [#77](https://github.com/CristianPerez06/grana-v3/issues/77).
- **`showShared`** como preferencia persistida → [#76](https://github.com/CristianPerez06/grana-v3/issues/76).
- **Breakdown por categoría** en el feed nativo. Es otra superficie con su propia spec (`spending-by-category`) y sigue explícitamente fuera de alcance, igual que hoy.
- **Migrar el detalle de cuenta a filtrado server-side.** Perdería el running balance por fila. Ver decisión 1.
- Cualquier cambio de datos, RPC, RLS o migración. La base ya soporta todo esto desde la migración 0029.

## Decisions

### 1. El feed filtra en el servidor; el detalle de cuenta sigue filtrando en memoria

**Decisión.** Los filtros del feed se proyectan a `MovementFilters` y viajan a `get_movements_page`. El detalle de cuenta conserva `applyAccountFilters`.

**Por qué.** Filtrar en memoria una lista paginada da un resultado **incorrecto**, no sólo incompleto: la RPC devuelve las primeras N filas del mes ordenadas por fecha desc, y filtrar esas N por "categoría = Supermercado" muestra los supermercados **de las primeras N filas**, no los del mes. Peor: "cargar más" traería filas nuevas que sí matchean, así que la lista crecería de a saltos arbitrarios y `hasMore` mentiría. El mismo argumento que en el principio de **Derived balances** de AGENTS.md — una lectura cuyo producto tiene que ser completo no se completa filtrando en el cliente.

En el detalle no aplica porque no hay página parcial: `getAccountMovementsAscending` trae el historial entero por diseño (lo necesita el running balance).

**Alternativas descartadas.**
- *Migrar el detalle a server-side también, por simetría.* Le saca el running balance por fila, que es la razón por la que ese read existe. La simetría se pagaría con una regresión funcional.
- *Traer todo el mes al cliente en el feed y filtrar ahí.* Reintroduce por la ventana el problema de `max-rows` de PostgREST que el repo ya se comió una vez.

**Consecuencia visible.** La búsqueda de texto de las dos superficies deja de matchear lo mismo. El feed matchea lo que matchea SQL — título, descripción efectiva, nombre de cuenta origen y destino (`0042_get_movements_page_exclude_shared.sql:167-173`). El `movementMatchesText` nativo del detalle además matchea **nombre de categoría y subcategoría**. Buscar "supermercado" en el feed no trae los gastos categorizados como Supermercado si la descripción no lo dice. Es una divergencia conocida y documentada, no un bug: cerrarla del lado del feed exigiría el filtrado en cliente que esta decisión existe para evitar. Cerrarla del lado de SQL (sumar los joins de categoría al `ILIKE`) es un change propio sobre la RPC, con impacto en web.

### 2. El eje de tipo se unifica sobre `kind`, no sobre `transaction_type`

**Decisión.** El campo `type` del estado compartido es `MovementTypeFilter` (= `FinancialMovement['kind']`, ocho valores). El detalle de cuenta deriva el `kind` de sus filas.

**Por qué.** Hoy las dos superficies filtran ejes distintos con el mismo nombre:

- `applyAccountFilters` compara `tx.type` — la columna DB `transaction_type`, cinco opciones (`income`, `expense`, `transfer`, `adjustment`, `exchange`).
- La RPC compara `calc.kind` — el VM derivado, ocho opciones, que suma `card_payment`, `installment_purchase` y `reimbursement`.

`MovementFilters.type` ya declara `kind` (`packages/transactions/src/filters.ts:7`), y web usa `kind` en sus dos superficies. Unificar sobre la columna DB obligaría a traducir `type → kind` al proyectar los filtros del feed, y dejaría fuera del filtro tres distinciones que el usuario **sí** ve dibujadas en los badges de la fila.

**Cómo, sin tocar el package.** La única derivación de `kind` que existe vive dentro de `toFinancialMovement` (`packages/transactions/src/movements.ts:248-362`), entrelazada con la construcción del objeto completo. En vez de extraerla —lo que crearía una segunda definición que puede divergir de la primera— el detalle de cuenta construye **una vez por carga** (`useMemo` sobre `movements`) un `Map<txId, MovementTypeFilter>` con `toFinancialMovement(tx).kind`, y `applyAccountFilters` lo recibe como parámetro. El mapeo corre cuando cambian las filas, no en cada tecleo.

**Alternativa descartada.** Extraer `deriveMovementKind` a `@grana/transactions` y que `toFinancialMovement` la consuma. Es más limpio en abstracto, pero obliga a reestructurar un mapper con ocho ramas que hoy funciona y está cubierto, para un beneficio que el `Map` memoizado ya entrega. Si un tercer consumidor necesita el `kind` suelto, ahí sí vale la extracción.

### 3. Las opciones de filtro salen del catálogo, en las dos superficies

**Decisión.** `getMovementFilterOptions` se promueve a `@grana/transactions` y la consumen el feed **y** el detalle de cuenta nativo.

**Por qué el feed no tiene opción.** Derivar las opciones de las filas cargadas —lo que hace hoy `MovementsSection.tsx:47-70`— sobre una lista paginada da un menú que **crece al hacer "cargar más"**. Un control de filtro cuyo contenido depende de cuánto scrolleaste no es un control de filtro.

**Por qué el detalle también cambia.** Porque el detalle de cuenta **web** ya usa el catálogo (`movement-filters-account-container.tsx:40`). Derivar de las filas es una divergencia introducida sólo del lado nativo. Dejarla en pie significaría que la hoja compartida recibe sus opciones de dos orígenes con semánticas distintas, que es la clase de bifurcación que hace envejecer mal a un componente compartido.

**El costo, explícito.** Las opciones derivadas tenían una propiedad buena que se pierde: nunca llevaban a una lista vacía. El catálogo sí puede ofrecer una categoría que en esa cuenta da cero resultados. Es exactamente lo que ya pasa en web, y es lo que la tercera variante de empty state (decisión 5) existe para explicar. No se compensa deshabilitando opciones vacías: saber cuáles lo están exigiría un conteo por categoría que hoy nadie calcula, y en el feed sería un round-trip más por cada cambio de mes.

**Mecánica de la promoción.** La función ya es isomórfica (`supabase` como primer parámetro, cero `next/*`). Su única dependencia web es `getSubcategoriesByCategoryId`, ocho líneas de `select` sobre `subcategories` que se inlinean en el package; la función web se queda donde está porque tiene otro consumidor (`settings/categories/[id]/subcategories/page.tsx:21`) y no vale un `@grana/categories` nuevo para esto. `@grana/transactions` suma `@grana/ui-contracts` como dependencia directa por `resolveAccountAvatar`; ya entra transitivamente vía `@grana/dashboard` y `ui-contracts` no depende de nada, así que no hay ciclo posible.

### 4. Se comparte la hoja y los chips; cada superficie arma su propia fila de acciones

**Decisión.** `MovementFiltersSheet` se muda a `components/movements/` con un flag `showAccountFilter`, y se extrae `ActiveFilterChips`. La toolbar como tal **no** se extrae.

**Por qué.** Las dos filas de acciones difieren en tres puntos a la vez, y ninguno es cosmético:

| | Detalle de cuenta | Feed |
|---|---|---|
| Título | "Movimientos", dentro del card | No hay: lo pone el `PageHeader` |
| Nav de mes | Inline, en la misma fila del título | `MonthNavigator`, componente aparte de la pantalla |
| Recurrencias | Chip de acción | Ya vive en el `PageHeader` (`index.tsx:130`) |

Un componente que absorba esas tres variaciones es un wrapper con tres slots para dos consumidores — el tipo de abstracción que se paga cada vez que una de las dos superficies cambia. Lo que **sí** es idéntico es la hoja (249 líneas, cero variación salvo el filtro de cuenta) y el renderer de chips activos removibles. Eso se comparte.

**El flag del filtro de cuenta** replica `showAccountFilter` de web (`apps/web/lib/transactions/components/movement-filters.tsx:74`) y se combina con la regla `showAccount`: el filtro se ofrece sólo cuando hay **2+ cuentas** que desambiguar (`movement-filters-container.tsx:109`). Es la misma regla de perfil único del dominio — con una sola `Billetera`, la dimensión cuenta no se ofrece.

### 5. El empty state tiene tres variantes, no dos

**Decisión.** El feed distingue: *bienvenida* (sin historial) / *mes vacío* (hay historial, este mes no) / **sin resultados** (los filtros o la búsqueda vaciaron la lista), esta última con acción de limpiar.

**Por qué.** Con filtros, "no hay nada" deja de ser un hecho sobre los datos y pasa a ser, muchas veces, una consecuencia de lo que el usuario acaba de tocar. Sin la tercera variante, aplicar un filtro que no matchea nada muestra "No registraste nada en agosto todavía" — que es **falso** y además esconde la salida.

El discriminador se resuelve **sin I/O extra**: si hay filtros de contenido o búsqueda activos, es la variante de sin-resultados; recién si no los hay se consulta `hasAnyTransaction` para separar bienvenida de mes vacío (esa query ya existe y ya está gateada por `enabled: isEmpty`).

Las copys ya existen en `@grana/i18n-messages` (`transactions.empty.filter_title` / `filter_description` / `clear_filters`, y `search_title` / `search_description` / `clear_search`). Cero i18n nuevo.

### 6. `limit` se resetea en cada cambio de filtro, no sólo al cambiar de mes

**Decisión.** Toda mutación de filtro (mes, búsqueda, tipo, cuenta, categoría, subcategoría, moneda, rango de monto, y limpiar) vuelve `limit` a `DEFAULT_MOVEMENTS_LIMIT`.

**Por qué.** El `limit` es una propiedad del recorrido de **un** conjunto de resultados; cambiar el filtro cambia el conjunto. Sin el reset, cambiar de filtro con `limit` en 300 pide 300 filas del conjunto nuevo de una — se pierde el sentido de la paginación y se paga la query grande sin que nadie la haya pedido. Web lo hace en **todas** las ramas de su reducer (`apps/web/lib/transactions/filters-state.ts:107-176`); el nativo hereda la regla, no la reinventa.

Corolario que hay que respetar en la implementación: `limit` es parte del `queryKey` de TanStack junto con los filtros proyectados, así que el reset y el cambio de filtro tienen que ocurrir en **un solo** `setState` — dos updates separados dispararían un fetch intermedio con el filtro nuevo y el `limit` viejo.

## Risks / Trade-offs

- **La búsqueda del feed no matchea nombres de categoría, la del detalle sí (decisión 1).** → Se documenta como divergencia en la spec en vez de dejarla implícita en el código. Un usuario que busca "supermercado" y no encuentra sus gastos de Supermercado tiene, en la misma pantalla, el filtro de categoría que sí los trae. Cerrar la brecha del lado de SQL queda como change propio sobre la RPC, con impacto en web.

- **El menú de filtros puede ofrecer opciones que dan cero resultados (decisión 3).** → Es el comportamiento que web ya tiene, y la variante de empty state de la decisión 5 lo explica con salida en un toque. Deshabilitar las opciones vacías exigiría un conteo por categoría que hoy nadie calcula.

- **Cada cambio de filtro es un round-trip a la base.** El detalle de cuenta filtra en memoria y responde instantáneo; el feed no. → El input de búsqueda **debe** ir debounced (web usa 300ms, `movement-filters.tsx:216`) o cada tecla dispara una query. Los demás filtros se aplican al tocar "Aplicar" en la hoja, así que ya vienen batcheados por diseño.

- **Mudar `MovementFiltersSheet` toca una superficie que hoy funciona.** El detalle de cuenta es el consumidor existente y cambia por partida triple: nueva ubicación del import, opciones de catálogo y eje `kind`. → Es el riesgo real de este change y por eso el detalle se verifica explícitamente, no de rebote. Ninguno de los tres cambios altera qué filas muestra el detalle para un filtro que ya existía en los dos ejes; lo que cambia es qué opciones se ofrecen y qué filtros nuevos son posibles.

- **La hoja compartida crece, y con ella su necesidad de scroll.** El sheet pasa de cinco chips de tipo a ocho y suma el bloque de cuenta, asi que por primera vez su contenido supera la pantalla. Dos defectos latentes salieron a la luz al montarlo. (a) El cap de altura vivia como **porcentaje sobre el panel**, que solo lo recorta: un `ScrollView` dentro de un contenedor auto-height se dimensiona a su contenido y cree que su viewport es todo, asi que no queda nada para scrollear. El bound tiene que caer en **pixeles sobre el scroller**, como ya hace `SelectSheet` con su lista y como avisa el docstring de `BottomSheet`. (b) El `Modal` no pasaba `statusBarTranslucent` / `navigationBarTranslucent`, en contra de la regla de AGENTS.md, con un comentario que lo daba por deliberado para que el footer no quedara bajo la barra de navegacion. La biblioteca de teclado exige que la ventana del modal coincida con lo que el provider fuerza bajo edge-to-edge; el footer se despeja con el inset de safe-area **dentro del contenido scrolleable**, no saliendose de edge-to-edge. (c) El scroller colgaba de **dos `Pressable` ancestros** (scrim + panel tragatoques), el patron que usan `BottomSheet` y `Drawer`. Ahi no molesta porque sus cuerpos son inputs; aca el cuerpo es una grilla de chips, que tambien son `Pressable`, y arrancar un drag sobre uno le disputaba el gesto al scroller: partes del sheet scrolleaban y partes no. El scrim pasa a ser **hermano detras del panel** en vez de ancestro, con lo que ningun `Pressable` queda en la cadena de ancestros del scroller y el envoltorio tragatoques deja de hacer falta (el panel pinta despues, asi que sus toques no llegan al scrim). -> Los tres corregidos en este change.

- **`toFinancialMovement` sobre el historial completo de una cuenta grande (decisión 2).** → Corre una vez por carga dentro de un `useMemo`, no por tecleo. Si alguna vez pesa, ahí sí se justifica extraer `deriveMovementKind`.
