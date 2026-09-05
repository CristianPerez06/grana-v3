## Why

Un gasto compartido puede llevar una categoría **personal** del miembro que lo cargó, y para el otro miembro esa categoría no existe: la política de lectura de `categories` es "del sistema o mías". El resultado es un gasto que aparece **sin nombre** en la dona, en la lista y en los chips de filtro del otro miembro, y que no se puede filtrar ni usar. Caso real de la auditoría del 5/9: "Hogar - La Foresta", creada por Cristian, se ve en blanco para Julieta como la cuarta categoría de agosto (196.133,55, 9 % del mes), y al tocarla la lista queda vacía.

El hogar ya comparte movimientos, splits, liquidaciones y recurrencias, pero no el vocabulario con el que se clasifican. Esa asimetría es la que produce el hueco.

## What Changes

- **Un tercer dueño para categorías y subcategorías: el hogar.** Además de "del sistema" y "propia", una categoría puede ser **del hogar**: la ven, la usan y la editan todos los miembros, tanto en gastos compartidos como en gastos propios.
- **Se administran en Configuración > Categorías**, en un grupo "Del hogar" junto a "Del sistema" y "Mías", en web y en la app nativa. Al crear o editar una categoría propia, quien tiene hogar puede marcarla como del hogar. El pasaje es de propia a del hogar; no se ofrece el camino inverso.
- **Invariante: un movimiento compartido no referencia categorías privadas.** Al compartir un movimiento cuya categoría o subcategoría es personal, esa categoría pasa automáticamente al hogar. La regla vive en la base, así que aplica a web, nativo y SQL manual por igual, y es la misma regla que la migración aplica una vez sobre lo ya cargado.
- **Salir del hogar no deja movimientos sin nombre.** Quien sale recibe una copia personal de las categorías del hogar que sus movimientos propios usan, y esos movimientos pasan a apuntar a la copia. Los movimientos compartidos históricos siguen apuntando a la categoría del hogar.
- **Migración de datos:** toda categoría o subcategoría personal usada hoy por un movimiento o una recurrencia compartida pasa al hogar de ese movimiento.

### Alternativas descartadas

- **Solo ampliar la lectura** (un miembro puede leer las categorías personales del otro usadas en compartidos). Resuelve el nombre en blanco pero no la administración: la categoría sigue siendo del otro, no se puede editar ni usar con confianza, y cada nuevo caso repite el hueco en subcategorías. Sirve como parche de horas; no como solución.
- **Que el selector de un gasto compartido solo ofrezca categorías del hogar y del sistema.** Obliga al usuario a decidir la propiedad antes de clasificar y no cubre el caso de "compartir después" un gasto ya categorizado. La promoción automática al compartir cubre los dos caminos sin pedirle nada.
- **Marcar del hogar con `user_id = NULL` y `household_id`.** Rompería el criterio "sistema = `user_id IS NULL`" que usan las etiquetas traducidas y los pickers. La categoría del hogar conserva `user_id` (quién la creó) y suma `household_id`.

## Capabilities

### New Capabilities

_Ninguna._

### Modified Capabilities

- `categories`: nuevo requirement de propiedad del hogar (visibilidad, uso, edición, unicidad, subcategorías); el requirement de edición de categorías propias admite la edición por cualquier miembro cuando la categoría es del hogar; el de visualización en Configuración suma el grupo "Del hogar" y el control para pasar una categoría al hogar; requirement de paridad nativa.
- `shared`: nuevo requirement de invariante (un movimiento compartido solo referencia categorías del hogar o del sistema, con promoción automática); el requirement de salida del hogar suma la copia personal de categorías para quien sale.

## Impact

- **Base:** migración `0063` (número elegido contra `main`, cuyo máximo es `0062`): columna `household_id` en `categories` y `subcategories`, índices de unicidad por hogar, políticas RLS de lectura/escritura para miembros, trigger de herencia de hogar en subcategorías, trigger de promoción al compartir, backfill. Regenerar `packages/supabase/src/types.ts`.
- **Paquetes:** `@grana/validation` (campo de alcance en los schemas de categoría), tipos y lecturas de categorías en web (`apps/web/lib/categories`) y nativo (`apps/mobile/lib/categories.ts`), agrupación del picker en `@grana/movement-form` / `@grana/ui-contracts`, `leaveHouseholdCore` en `@grana/shared`.
- **Pantallas:** Configuración > Categorías (web y nativo), formulario de categoría (web y nativo), selector de categoría del formulario de movimiento (web y nativo), chips de filtro de Movimientos.
- **Lecturas del Inicio y Movimientos:** no cambian. La dona, la lista y los chips dejan de recibir categorías sin nombre porque la política de lectura ahora las incluye.
- **Auditoría:** `supabase/scripts/audit-inicio-movimientos.sql` §7 y §10 pasan a distinguir "del hogar" y a detectar compartidos con categoría privada (que después de la migración deben ser cero).
