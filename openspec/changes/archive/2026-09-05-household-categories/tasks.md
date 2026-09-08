## 1. Base de datos

- [x] 1.1 Migración `0063_household_categories.sql` (número contra `main`, máximo actual `0062`): `household_id` en `categories` y `subcategories`, `CHECK (household_id IS NULL OR user_id IS NOT NULL)`, índices parciales de unicidad por alcance (reemplazar el de propias, agregar el de hogar).
- [x] 1.2 Políticas RLS nuevas de lectura, inserción, actualización y borrado para las dos tablas, por membresía vía `is_household_member`.
- [x] 1.3 Trigger `BEFORE INSERT OR UPDATE` en `subcategories` que hereda el `household_id` de la categoría padre, y trigger en `categories` que arrastra las subcategorías propias al pasar al hogar.
- [x] 1.4 Función `promote_classification_to_household` (`SECURITY DEFINER`, `search_path` fijo) y triggers `AFTER INSERT OR UPDATE` en `transactions` y `recurrences` que pasan al hogar la categoría y subcategoría propias de una fila compartida.
- [x] 1.5 Backfill: aplicar la misma función a cada movimiento y recurrencia compartida existente. Self-check: cero compartidos con categoría o subcategoría propia.
- [ ] 1.6 Aplicar en el proyecto online y regenerar `packages/supabase/src/types.ts` (a mano quedó `household_id` en `categories`/`subcategories` y el RPC `detach_household_classifications`; regenerar confirma).
- [x] 1.7 Harness PGlite en `apps/web/lib/categories/__tests__/support/` que carga la migración verbatim, con tests de: lectura por miembro y no-miembro, edición por el otro miembro, rechazo de `user_id IS NULL` con hogar, unicidad por alcance, herencia en subcategorías, promoción al compartir, backfill.

## 2. Tipos, validación y lecturas

- [x] 2.1 `household_id` en los tipos `Category` y `Subcategory` de web (`apps/web/lib/categories/types.ts`) y nativo (`apps/mobile/lib/categories.ts`), y `categoryScope` donde hoy se deriva `isSystem`.
- [x] 2.2 `@grana/validation`: campo `scope: 'own' | 'household'` en `createCategorySchema` y `updateCategorySchema`; las subcategorías no lo necesitan (heredan el alcance de su categoría en la base). `household` sin hogar activo se rechaza en la mutación (`errors.household_required`).
- [x] 2.3 Mutaciones de categoría en web y nativo: resolver `household_id` desde el hogar del usuario cuando `scope = 'household'`; pasar una propia al hogar arrastra sus subcategorías propias (trigger).
- [x] 2.4 Lecturas de categorías de web y nativo sin filtro por `user_id` (la visibilidad la decide RLS); lo fija el harness de 1.7, que corre las lecturas como cada usuario.

## 3. Configuración > Categorías

- [x] 3.1 Web: tercer grupo "Del hogar" con la marca "Hogar" en filas, solo con hogar activo; acciones de editar y archivar para categorías del hogar; control "Es del hogar" en el form de crear y editar (drawer y page), activo y no desactivable cuando ya es del hogar.
- [x] 3.2 Nativo: mismo grupo, misma marca, mismo control, en la misma entrega.
- [x] 3.3 i18n: claves para el grupo, la marca, el control y su ayuda ("La ven y la usan los dos"), en `es` y `en`.

## 4. Selector de categoría y filtros

- [x] 4.1 `@grana/movement-form`: el catálogo del selector expone `household_id` por ítem; la marca se deriva de ahí. El selector no agrupa (los grupos viven solo en Configuración): con la marca alcanza para distinguir una del hogar de una propia con el mismo nombre.
- [x] 4.2 Web y nativo: el selector del formulario de movimiento renderiza la marca "Hogar" en las categorías del hogar.
- [x] 4.3 Chips y hoja de filtros de Movimientos: las categorías del hogar aparecen con nombre y marca ("· Hogar"); un movimiento compartido del otro miembro se filtra por su categoría porque la categoría es legible por los dos.

## 5. Salir del hogar

- [x] 5.1 RPC `detach_household_classifications` (0063 §6b, `SECURITY INVOKER`), llamado por `leaveHouseholdCore` antes de borrar la membresía: copia como propias las categorías y subcategorías del hogar que referencian movimientos, reglas o instancias no compartidos del que sale, y los repunta a la copia; sufijo `-hogar` en `canonical_name` si colisiona.
- [x] 5.2 Tests de la copia (`household-categories-leave.test.ts`): movimientos propios repuntados, compartidos intactos, el otro miembro sin cambios, colisión de nombre, subcategoría del hogar bajo categoría del sistema, reglas e instancias, no-miembro rechazado.

## 6. Auditoría y verificación

- [x] 6.1 `supabase/scripts/audit-inicio-movimientos.sql`: §7 distingue "del hogar" en la columna `origen`; §10 suma el detector "compartido con categoría o subcategoría propia" (debe dar cero después de la migración).
- [ ] 6.2 Verificación con datos reales: correr §1 y §7 de agosto para Julieta antes y después; "Hogar - La Foresta" pasa de sin nombre a nombrada y ningún otro número del §1 cambia.
- [x] 6.3 `pnpm test`, lint y typecheck en web y nativo.
- [x] 6.4 Archivar la change, aplicar los deltas a `categories` y `shared`, correr `pnpm openspec:check`.
