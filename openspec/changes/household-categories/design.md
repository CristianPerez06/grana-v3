## Context

Ver `proposal.md` para la motivación. Lo que condiciona el diseño:

- `categories` y `subcategories` tienen dos dueños posibles: sistema (`user_id IS NULL`) y usuario (`user_id = auth.uid()`). La política de lectura es exactamente esa disyunción (migración `0005`). "Del sistema" se reconoce en todo el código por `user_id === null`, y de ahí sale la traducción por `canonical_name` (`translateCategoryLabel` en web, su espejo nativo).
- La unicidad de `canonical_name` es un índice parcial por sistema y otro por `(user_id, canonical_name)`; las subcategorías son únicas por `(category_id, canonical_name)`.
- El hogar ya tiene un patrón para entidades compartidas: `recurrences.household_id` (migración `0045`) con lectura por `is_household_member(household_id)`, y `unshare_movement` (`0048`) como referencia de operación atómica que deriva sus filas server-side.
- La salida del hogar es una secuencia app-side en `leaveHouseholdCore` (`@grana/shared`), no un RPC.
- Web y nativo tienen sus propias lecturas de categorías (`apps/web/lib/categories/queries.ts`, `apps/mobile/lib/categories.ts`) y sus propias pantallas de Configuración > Categorías. El selector del formulario de movimiento comparte contratos vía `@grana/ui-contracts` y estado vía `@grana/movement-form`.
- Los FK de `category_id` y `subcategory_id` en `transactions`, `recurrences` y `recurrence_instances` son `ON DELETE RESTRICT`.

## Goals / Non-Goals

**Goals:**
- Que ninguna superficie de un miembro reciba una categoría sin nombre por un movimiento compartido, con una regla que no dependa de que el cliente la recuerde.
- Un solo lugar para administrar las categorías del hogar, en las dos plataformas.
- Cero cambios en las lecturas del Inicio y Movimientos: el problema se resuelve en la propiedad y en RLS, no en cada consumer.

**Non-Goals:**
- Compartir categorías entre usuarios fuera de un hogar.
- Convertir una categoría del hogar en propia.
- Fusionar categorías duplicadas (una propia y una del hogar con el mismo nombre). Se distinguen con la marca "Hogar"; fusionar es una operación aparte.
- Cambiar cómo se calculan porciones, dona o lista.

## Decisions

**1. `household_id` en las dos tablas, conservando `user_id`.**
Se agrega `household_id uuid null references household(id) on delete set null` a `categories` y `subcategories`. La categoría del hogar mantiene `user_id` = creador. Alternativa descartada: `user_id NULL` para el hogar, que confundiría "del hogar" con "del sistema" en todos los `isSystem` del código y haría traducir por canonical un nombre que no está en i18n. Un `CHECK (household_id IS NULL OR user_id IS NOT NULL)` deja las tres formas excluyentes.

**2. Unicidad por alcance con índices parciales.**
Se reemplaza el índice `(user_id, canonical_name) WHERE user_id IS NOT NULL` por `WHERE user_id IS NOT NULL AND household_id IS NULL`, y se agrega `(household_id, canonical_name) WHERE household_id IS NOT NULL`. Las subcategorías no cambian: siguen únicas por categoría.

**3. RLS por membresía, con el helper existente.**
- Lectura: `user_id IS NULL OR user_id = auth.uid() OR (household_id IS NOT NULL AND is_household_member(household_id))`.
- Inserción: `user_id = auth.uid() AND (household_id IS NULL OR is_household_member(household_id))`.
- Actualización y borrado: `user_id = auth.uid() OR (household_id IS NOT NULL AND is_household_member(household_id))`.
Mismas cuatro políticas para `subcategories`, con una lectura adicional por el hogar de la categoría padre para el caso "subcategoría del hogar bajo categoría del sistema": ahí la subcategoría lleva su propio `household_id`, así que la política es la misma y no hace falta el join.

**4. La herencia de hogar en subcategorías la garantiza un trigger.**
`BEFORE INSERT OR UPDATE` en `subcategories`: si la categoría padre tiene `household_id`, la subcategoría toma ese valor. Alternativa descartada: dejarlo al cliente, que es el patrón "mirror … keep in sync" que el repo prohíbe, y que dejaría subcategorías privadas colgando de categorías del hogar.

**5. La promoción al compartir es un trigger sobre `transactions` y `recurrences`.**
`AFTER INSERT OR UPDATE OF is_shared, category_id, subcategory_id, household_id`: si la fila es compartida y su categoría o subcategoría es propia (`user_id IS NOT NULL AND household_id IS NULL`), se le asigna el `household_id` del movimiento. La función es `SECURITY DEFINER` con `search_path` fijo, porque escribe sobre una fila de `categories` cuyo dueño es quien comparte, pero conviene no depender de que la política de UPDATE del invocante lo permita en todos los caminos (el RPC `unshare_movement`, un `UPDATE` por SQL). Alternativa descartada: hacerlo en la mutación TS, que no cubre nativo ni SQL manual y que duplica la regla en tres lugares. La migración corre exactamente la misma función sobre lo ya cargado.

**6. Copia al salir, app-side, antes de desvincular.**
`leaveHouseholdCore` gana un paso previo: para cada categoría del hogar referenciada por movimientos o recurrencias del usuario **no compartidos**, crea una copia propia (mismo nombre, ícono, color, tipo; `canonical_name` con sufijo si ya existe una propia igual), repunta esas filas a la copia, y recién después borra la membresía. Las subcategorías del hogar bajo esas categorías se copian con ellas. Si falla a mitad, quedan copias propias sin usar, que son inofensivas y visibles en Configuración; no queda ningún movimiento apuntando a algo ilegible, porque el repunte va antes del borrado de membresía. Alternativa descartada: un RPC atómico; vale la pena solo si aparece un caso de corrupción real, y el orden de pasos ya lo evita.

**7. Un grupo más, no una pantalla más.**
Configuración > Categorías pasa de dos grupos a tres. El control "Es del hogar" vive en el mismo formulario de categoría, visible solo con hogar activo. Alternativa descartada: una sección propia en `/shared/settings`; duplicaría el listado y las acciones, y la gente busca "categorías" donde ya están.

**8. El selector no esconde nada.**
El picker del formulario de movimiento muestra los tres grupos siempre. No hace falta filtrar las propias cuando el movimiento es compartido, porque la decisión 5 convierte la propia elegida en del hogar al guardar. Esto también cubre "compartir después".

**9. Los consumidores reconocen "del hogar" por `household_id`, y "del sistema" sigue siendo `user_id === null`.**
El tipo `Category` de web y nativo suma `household_id: string | null`. Los view-models que hoy exponen `isSystem` suman `isHousehold`. Ningún consumer cambia su lógica de traducción.

## Risks / Trade-offs

- [Una categoría propia con movimientos históricos pasa al hogar sin aviso al compartir un solo gasto] → Es el comportamiento buscado y lo dice la spec; el nombre y los movimientos no cambian, solo quién más puede verla. La marca "Hogar" en Configuración lo hace visible.
- [El trigger de promoción escribe con `SECURITY DEFINER`] → Función con `search_path = public` fijo, sin parámetros del cliente, que solo modifica `household_id` de la fila referenciada y solo cuando la fila del movimiento ya pasó RLS. Test PGlite de que no promueve categorías de un no-miembro.
- [Dos miembros crean "Hogar" propia y "Hogar" del hogar] → Permitido por diseño; la marca "Hogar" distingue. Fusionar queda fuera de alcance.
- [Hogar inactivo con categorías del hogar huérfanas] → Cuando el último miembro sale también recibe sus copias. Las filas quedan referenciadas solo por movimientos compartidos históricos, que nadie lee. Inofensivas.
- [Tipos generados desactualizados] → Regenerar `packages/supabase/src/types.ts` después de aplicar la migración; el typecheck lo detecta.

## Migration Plan

1. Migración `0063_household_categories.sql`, en una sola transacción, en este orden: columnas, `CHECK`, índices parciales, políticas RLS (drop de las cuatro de cada tabla y create de las nuevas), trigger de herencia en subcategorías, función y triggers de promoción, backfill (una llamada a la misma función de promoción por cada movimiento y recurrencia compartida), self-check que verifique cero compartidos con categoría propia.
2. Aplicar en el proyecto online desde el SQL Editor y regenerar tipos.
3. Desplegar web y nativo con las pantallas nuevas. Entre 1 y 3 no hay ventana rota: con la migración aplicada y el código anterior, las categorías del hogar ya se leen (RLS) y los pickers las muestran en el grupo "Mías" sin marca, que es mejor que en blanco.
4. Rollback: las políticas nuevas son un superconjunto de las viejas; volver a las viejas deja las categorías del hogar visibles solo para su creador, el estado de hoy. Los datos no se pierden.

## Open Questions

- El sufijo de `canonical_name` al copiar una categoría del hogar que colisiona con una propia del que sale (`-hogar` es la opción por defecto). No cambia specs ni tareas.
