# Design: fix-archived-categories-in-selectors

## Context

Ver `proposal.md — Why` para el motivo. Lo que importa para el enfoque es la forma exacta del código actual:

- `getAllCategories` existe **dos veces**, una por plataforma (`apps/web/lib/categories/queries.ts`, `apps/mobile/lib/categories.ts`), con el mismo cuerpo: `.select('*, subcategories(*)').eq('is_active', true)`. El `.eq` aplica a la tabla base (`categories`); el embed viene sin filtrar. La duplicación importa: cualquier fix hay que aplicarlo a las dos o solo se arregla media app.
- El árbol lo consumen el drawer de movimientos (web), las tres pantallas de formulario de mobile, el modal de recurrencias, el edit context de las dos plataformas y la pantalla de Configuración. Todos leen `categoria.subcategories` tal cual.
- Las keys de cache no coinciden entre plataformas: web usa `['categories','tree']` con `staleTime` 15 min declarado en `lib/query-client.ts`; mobile usa `['categories','all']` sin `staleTime` propio. Las pantallas de Configuración de mobile ni siquiera usan react-query (leen con `useState`/`useEffect`), aunque hay un `QueryClientProvider` en la raíz (`apps/mobile/app/_layout.tsx:82`), así que pueden invalidar igual.
- El edit context de las dos plataformas entrega `categoryId` / `subcategoryId` como **ids sueltos** (`edit-context.ts:207-208`): el nombre a mostrar lo resuelve el formulario buscando el id dentro del árbol. Ese detalle es el que convierte "filtrar el árbol" en un problema de edición.

## Goals / Non-Goals

**Goals:**

- Que el catálogo salga correcto del read, en las dos plataformas, sin que ningún consumer tenga que acordarse de filtrar.
- Que archivar o eliminar se refleje en el acto, sin recargar.
- Que un movimiento viejo clasificado con algo ya archivado se pueda editar sin perder su clasificación.

**Non-Goals:**

- **Unificar los dos `getAllCategories` en un package compartido.** Es la deuda de fondo y se ve desde acá, pero moverlo mientras se arregla un bug mezcla dos cambios y agranda el diff de revisión. Este change los arregla en paralelo y deja la extracción para un change de data-access dedicado.
- **Tocar la visibilidad de las filas archivadas fuera de los selectores.** Configuración las sigue administrando y los movimientos históricos las siguen mostrando.
- **Unificar las query keys de web y mobile.** Se invalidan las dos por separado; homologarlas es otro change.

## Decisions

### Decisión 1 — El filtro va en el embed, server-side, no en el consumer

PostgREST filtra un recurso embebido cuando el predicado apunta a su columna:

```
.select('*, subcategories(*)').eq('is_active', true).eq('subcategories.is_active', true)
```

El primer `.eq` angosta las categorías; el segundo angosta **las filas embebidas**, no las padres — una categoría activa sin ninguna subcategoría activa sigue viniendo, con `subcategories: []`. Eso es exactamente lo que queremos: la categoría se sigue pudiendo elegir, simplemente deja de ser drillable.

Descartado `subcategories!inner(*)`: el `!inner` convierte el embed en INNER JOIN y haría desaparecer toda categoría sin subcategorías activas — incluidas las que nunca tuvieron. Rompería el selector para media docena de categorías del sistema.

Descartado filtrar en JS después del fetch: el payload viaja para tirarse, y sobre todo deja la puerta abierta a que el próximo consumer se olvide — que es precisamente cómo llegamos acá. Por eso, además, se **saca** el `.filter((s) => s.is_active)` de `category-list.tsx:31`: mientras el parche defensivo esté ahí, un read que vuelva a mentir no se nota en la pantalla que más lo mostraría.

### Decisión 2 — Se invalida el prefijo `['categories']`, desde el cliente

Las mutaciones de categoría de web son server actions. `revalidatePath('/settings/categories')` sirve para el render server-side de esa pantalla y no hace nada con el cache de TanStack del browser, que es de donde come el selector. La invalidación tiene que salir del componente cliente que dispara la action, después de un resultado `ok`.

Se invalida el **prefijo** `['categories']`, no la key exacta:

- Alcanza a `['categories','tree']` (web) y a `['categories','all']` (mobile) sin que cada call site tenga que saber cuál está vigente en su plataforma.
- Si mañana aparece otra familia `['categories', …]`, queda cubierta por construcción. El costo de invalidar de más un catálogo que cambia poco es un refetch chico; el costo de invalidar de menos es este bug.

Va en los cuatro pares de call sites (archivar/eliminar de categoría, archivar/eliminar de subcategoría) **más** los de alta y edición: una categoría recién creada que no aparece en el selector hasta dentro de 15 minutos es el mismo defecto con el signo cambiado.

Mobile invalida desde sus propias pantallas de Configuración. No hace falta migrarlas a react-query para eso: les alcanza con `useQueryClient()` del provider raíz. Migrarlas sería un cambio más grande sin relación con este bug.

### Decisión 3 — El ítem archivado ya asignado se **injerta** en el árbol, no se exceptúa del filtro

Filtrar el árbol rompe la edición de un movimiento viejo: el formulario resuelve el nombre de la categoría buscando su id en el árbol, y si el id ya no está, el campo aparece vacío. Peor que verse mal: guardar así puede escribir `category_id = null` en un movimiento que sí estaba clasificado.

Tres opciones consideradas:

| Opción | Por qué no / por qué sí |
|---|---|
| No filtrar en modo edición | Vuelve a ofrecer **todo** el catálogo archivado para reclasificar. El bug reaparece en la mitad de las pantallas. |
| Un read extra que busque el ítem archivado por id | Un round trip más en el mount del formulario de edición, para un dato que ya está en la respuesta que el edit context acaba de traer. |
| **Injertar el nodo archivado que ya viene con el movimiento** | El edit context ya lee el movimiento con su categoría y subcategoría embebidas: los nombres están en la mano, sin pedir nada nuevo. |

Se toma la tercera. El edit context expone el nodo archivado como parte de `MovementEditContext`, y el hook compartido (`use-movement-form.ts`, donde ya se derivan `transactionCategories` y `selectedCategory`) lo injerta en el árbol **solo si el id coincide con el valor inicial del formulario y no está ya presente**. Consecuencia importante del "solo si coincide con el valor inicial": apenas el usuario elige otra categoría, el nodo injertado deja de ser el valor actual y desaparece del selector. No queda pinneado como opción reutilizable.

El injerto viaja marcado con su `is_active: false` real, de modo que el render lo distingue sin heurísticas: badge de archivado, y no cuenta para decidir si la categoría es drillable.

Los embeds del read de detalle necesitan un par de columnas que hoy no piden (`id` y `category_id` en la subcategoría, `is_active` en ambos). Es agrandar un `select` existente, no un read nuevo.

### Decisión 4 — El `›` se deriva de lo ofrecible, no de lo que existe

`drillable = c.subcategories.length > 0` (`movement-form.tsx:690`, `form-pickers.tsx:153`) se vuelve correcto solo por el filtro del read: si el árbol ya viene sin subcategorías archivadas, `length` cuenta lo ofrecible. No hay que tocar la expresión — pero sí hay que **excluir el nodo injertado** de esa cuenta, o una categoría cuyo único hijo es la subcategoría archivada del movimiento se mostraría drillable en modo edición y abriría un nivel 1 con una sola opción archivada.

## Risks / Trade-offs

- **El predicado sobre el embed es silencioso si se escribe mal.** `eq('subcategories.is_active', true)` con el nombre del embed mal escrito no falla: PostgREST devuelve un error 400 que la query function propaga, así que se nota — pero un test que solo mockee la respuesta no lo detectaría. → El test del read verifica el **string exacto** del predicado, igual que hizo `cut-month-lenses-at-today` con el corte temporal.
- **Invalidar el prefijo `['categories']` invalida de más.** Un futuro `['categories','spending']` caro se refetchearía al archivar una categoría. → Aceptado: el catálogo cambia pocas veces por sesión, y errar hacia el refetch de más es exactamente el trade-off que este bug enseña a preferir.
- **Un usuario con subcategorías archivadas ve el selector encogerse.** Es el comportamiento que el spec pide desde siempre, pero es un cambio respecto de lo que la app mostraba ayer, y alguien que venía usando una subcategoría archivada por costumbre va a notar que ya no está. → Sigue disponible: se reactiva desde Configuración.
- **La duplicación de `getAllCategories` sobrevive a este change.** Mientras exista, un fix futuro puede volver a aplicarse a una sola plataforma. → Los tests se escriben por plataforma para que la asimetría falle en CI, y la extracción queda anotada como deuda para el change de data-access.
