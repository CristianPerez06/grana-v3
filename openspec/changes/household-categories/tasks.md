## 1. Base de datos

- [ ] 1.1 Migración `0063_household_categories.sql` (número contra `main`, máximo actual `0062`): `household_id` en `categories` y `subcategories`, `CHECK (household_id IS NULL OR user_id IS NOT NULL)`, índices parciales de unicidad por alcance (reemplazar el de propias, agregar el de hogar).
- [ ] 1.2 Políticas RLS nuevas de lectura, inserción, actualización y borrado para las dos tablas, por membresía vía `is_household_member`.
- [ ] 1.3 Trigger `BEFORE INSERT OR UPDATE` en `subcategories` que hereda el `household_id` de la categoría padre.
- [ ] 1.4 Función `promote_category_to_household` (`SECURITY DEFINER`, `search_path` fijo) y triggers `AFTER INSERT OR UPDATE` en `transactions` y `recurrences` que pasan al hogar la categoría y subcategoría propias de una fila compartida.
- [ ] 1.5 Backfill: aplicar la misma función a cada movimiento y recurrencia compartida existente. Self-check: cero compartidos con categoría o subcategoría propia.
- [ ] 1.6 Aplicar en el proyecto online y regenerar `packages/supabase/src/types.ts`.
- [ ] 1.7 Harness PGlite en `apps/web/lib/categories/__tests__/support/` que cargue la migración verbatim, con tests de: lectura por miembro y no-miembro, edición por el otro miembro, rechazo de `user_id IS NULL` con hogar, unicidad por alcance, herencia en subcategorías, promoción al compartir, backfill.

## 2. Tipos, validación y lecturas

- [ ] 2.1 `household_id` en los tipos `Category` y `Subcategory` de web (`apps/web/lib/categories/types.ts`) y nativo (`apps/mobile/lib/categories.ts`), y `isHousehold` donde hoy se deriva `isSystem`.
- [ ] 2.2 `@grana/validation`: campo `scope: 'own' | 'household'` en `createCategorySchema` y `updateCategorySchema` (y sus equivalentes de subcategoría), rechazando `household` cuando el usuario no tiene hogar activo.
- [ ] 2.3 Mutaciones de categoría en web y nativo: resolver `household_id` desde el hogar del usuario cuando `scope = 'household'`; pasar una propia al hogar arrastra sus subcategorías propias.
- [ ] 2.4 Verificar que las lecturas de categorías de web y nativo no filtran por `user_id` y dejan la visibilidad a RLS (hoy ya es así); agregar un test que lo fije.

## 3. Configuración > Categorías

- [ ] 3.1 Web: tercer grupo "Del hogar" con la marca "Hogar" en filas, solo con hogar activo; acciones de editar y archivar para categorías del hogar; control "Es del hogar" en el form de crear y editar (drawer y page), activo y no desactivable cuando ya es del hogar.
- [ ] 3.2 Nativo: mismo grupo, misma marca, mismo control, en la misma entrega.
- [ ] 3.3 i18n: claves para el grupo, la marca, el control y su ayuda ("La ven y la usan los dos"), en `es` y `en`.

## 4. Selector de categoría y filtros

- [ ] 4.1 `@grana/ui-contracts` y `@grana/movement-form`: el catálogo del selector expone los tres grupos (sistema, hogar, mías) y la marca por ítem.
- [ ] 4.2 Web y nativo: el selector del formulario de movimiento y de recurrencia renderiza los tres grupos con la marca "Hogar".
- [ ] 4.3 Chips y hoja de filtros de Movimientos: las categorías del hogar aparecen con nombre y marca; verificar que un movimiento compartido del otro miembro se filtra por su categoría.

## 5. Salir del hogar

- [ ] 5.1 `leaveHouseholdCore`: antes de borrar la membresía, copiar como propias las categorías y subcategorías del hogar que referencian movimientos o recurrencias no compartidos del que sale, y repuntarlos a la copia; sufijo en `canonical_name` si colisiona con una propia.
- [ ] 5.2 Tests de la copia: movimientos propios repuntados, compartidos intactos, el otro miembro sin cambios, colisión de nombre.

## 6. Auditoría y verificación

- [ ] 6.1 `supabase/scripts/audit-inicio-movimientos.sql`: §7 distingue "del hogar" en la columna `origen`; §10 suma el detector "movimiento compartido con categoría o subcategoría propia" (debe dar cero después de la migración).
- [ ] 6.2 Verificación con datos reales: correr §1 y §7 de agosto para Julieta antes y después; "Hogar - La Foresta" pasa de sin nombre a nombrada y ningún otro número del §1 cambia.
- [ ] 6.3 `pnpm test`, lint y typecheck en web y nativo.
- [ ] 6.4 Archivar la change, aplicar los deltas a `categories` y `shared`, actualizar `AGENTS.md` si corresponde, correr `pnpm openspec:check`.
