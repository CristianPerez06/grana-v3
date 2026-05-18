## 1. Dependencias y utilitarios de dominio

- [x] 1.1 Agregar `decimal.js` a `packages/validation/package.json`
- [x] 1.2 Crear `packages/validation/src/money.ts` con el tipo `Money` (branded type sobre `decimal.js`) y sus métodos: `add`, `subtract`, `multiply`, `divide`, `toNumber`, `toFixed`, `isZero`, `isNegative`, `compare`, `from`
- [x] 1.3 Agregar lógica de distribución de residuo en `Money.divide(n)` para garantizar que las N partes sumen exactamente el total original
- [x] 1.4 Exportar `Money` desde `packages/validation/src/index.ts`
- [x] 1.5 Crear `apps/web/lib/date.ts` con `getTodayAR()` usando `Intl.DateTimeFormat` con timezone `America/Argentina/Buenos_Aires`
- [x] 1.6 Crear `apps/web/lib/slugify.ts` con función `slugify(text: string): string` siguiendo las reglas de D8 del design (lowercase, remover diacríticos, espacios→guiones, solo alfanumérico+guiones)

## 2. Migraciones de tablas seed

- [x] 2.1 Crear `supabase/migrations/0002_seed_currencies.sql` con tabla `currencies` (code PK, name, symbol, is_active) e INSERT de ARS, USD, EUR con `ON CONFLICT DO NOTHING`
- [x] 2.2 Crear `supabase/migrations/0003_seed_institutions.sql` con tabla `institutions` (id UUID, name, slug UNIQUE, brand_color, icon_type, country DEFAULT 'AR', is_active) e INSERT de las 28 instituciones argentinas del Apéndice B del design con `ON CONFLICT DO NOTHING`
- [x] 2.3 Crear `supabase/migrations/0004_seed_card_networks.sql` con tabla `card_networks` (id UUID, name UNIQUE, slug UNIQUE, brand_color, display_order, is_active) e INSERT de las 7 redes del Apéndice C del design con `ON CONFLICT DO NOTHING`
- [x] 2.4 Agregar políticas RLS a las tres tablas seed: SELECT para usuarios autenticados, sin INSERT/UPDATE/DELETE para usuarios

## 3. Migración de categorías y subcategorías

- [x] 3.1 Crear `supabase/migrations/0005_categories.sql` con tabla `categories` (id UUID, user_id UUID NULLABLE → auth.users, name TEXT, canonical_name TEXT, icon TEXT NULLABLE, color TEXT NULLABLE, type TEXT CHECK IN ('income','expense','both'), is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ)
- [x] 3.2 Agregar a `0005_categories.sql` UNIQUE `(user_id, canonical_name)` para categorías del usuario y UNIQUE parcial para categorías del sistema (`WHERE user_id IS NULL`)
- [x] 3.3 Agregar a `0005_categories.sql` tabla `subcategories` (id UUID, category_id UUID → categories, user_id UUID NULLABLE, name TEXT, canonical_name TEXT, is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ) con UNIQUE `(category_id, canonical_name)`
- [x] 3.4 Agregar políticas RLS a `categories` y `subcategories`: SELECT para todos los autenticados, INSERT/UPDATE/DELETE solo donde `user_id = auth.uid()`
- [x] 3.5 Crear `supabase/migrations/0006_seed_categories.sql` con INSERT de las 17 categorías sistema y las 31 subcategorías del Apéndice A del design con `ON CONFLICT DO NOTHING`

## 4. Traducciones de categorías del sistema

- [x] 4.1 Agregar sección `"categories"` a `packages/i18n-messages/src/es.json` con los 17 canonical_names mapeados a sus nombres en español (ej: `"comida": "Comida"`, `"ropa-y-calzado": "Ropa y calzado"`)
- [x] 4.2 Agregar sección `"categories"` a `packages/i18n-messages/src/en.json` con los 17 canonical_names mapeados a sus equivalentes en inglés (ej: `"comida": "Food & Dining"`, `"transporte": "Transportation"`)
- [x] 4.3 Agregar sección `"subcategories"` a ambos archivos JSON con las 31 subcategorías del sistema
- [x] 4.4 Crear `apps/web/lib/categories/display.ts` con `getCategoryName(category, t)` que usa `t('categories.' + canonical_name)` con fallback a `category.name`, y equivalente `getSubcategoryName(subcategory, t)`

## 5. Tipos TypeScript

- [x] 5.1 Regenerar `packages/supabase/src/types.ts` ejecutando `supabase gen types typescript --project-id <PROJECT_ID> --schema public` contra el proyecto Supabase online (no requiere instancia local)
- [x] 5.2 Crear `apps/web/lib/categories/types.ts` con los tipos de dominio: `Category`, `Subcategory`, `CategoryType`, `SystemCategory`, `UserCategory`

## 6. Queries y server actions de categorías

- [x] 6.1 Crear `apps/web/lib/categories/queries.ts` con `getAllCategories(userId)` que retorna sistema + propias del usuario activas, con subcategorías incluidas
- [x] 6.2 Agregar a queries `getCategoryById(id)` y `getSubcategoriesByCategoryId(categoryId)`
- [x] 6.3 Crear `apps/web/app/_actions/categories.ts` con `createCategory(input)` — incluye generación de `canonical_name` via `slugify` (reglas D8 del design)
- [x] 6.4 Agregar a actions `updateCategory(id, input)` — actualiza name/icon/color, nunca canonical_name
- [x] 6.5 Agregar a actions `archiveCategory(id)` — pone `is_active = false`, solo para categorías propias
- [x] 6.6 Agregar a actions `deleteCategory(id)` — solo si no tiene transacciones asociadas (query de verificación previa)
- [x] 6.7 Agregar a actions `createSubcategory(input)`, `updateSubcategory(id, input)`, `archiveSubcategory(id)`, `deleteSubcategory(id)` con las mismas reglas
- [x] 6.8 Agregar schemas Yup de validación para `createCategory` y `updateCategory` en `packages/validation/src/categories.ts`

## 7. UI de categorías en Configuración

- [x] 7.1 Crear la ruta `apps/web/app/(app)/settings/categories/page.tsx` (Server Component) que carga y lista todas las categorías activas
- [x] 7.2 Crear componente `CategoryList` que agrupa categorías del sistema (sin acciones de editar/archivar) y propias (con acciones), usando `getCategoryName` para el display
- [x] 7.3 Crear componente `CategoryRow` con nombre traducido, tipo, conteo de subcategorías activas, y menú contextual según tipo
- [x] 7.4 Crear pantalla/sheet de creación de categoría con formulario (nombre, tipo, ícono opcional, color opcional)
- [x] 7.5 Crear pantalla/sheet de edición de categoría propia
- [x] 7.6 Crear pantalla/sheet de subcategorías de una categoría (lista + agregar + archivar), usando `getSubcategoryName` para el display
- [x] 7.7 Agregar enlace "Categorías" a la navegación de Configuración existente

## 8. Verificación

- [x] 8.1 Verificar que las 17 categorías sistema y las 31 subcategorías están presentes tras aplicar migraciones en DB local
- [x] 8.2 Verificar que RLS bloquea edición de categorías del sistema desde el cliente
- [x] 8.3 Verificar creación, edición y archivado de categorías propias end-to-end
- [x] 8.4 Verificar que `Money(0.1).add(Money(0.2))` retorna `Money(0.3)` exacto
- [x] 8.5 Verificar que `getTodayAR()` retorna la fecha argentina correcta (testeable simulando las 23:30 AR)
- [x] 8.6 Verificar que `getCategoryName` muestra la traducción en el idioma activo para categorías del sistema y el `name` directo para categorías propias
- [x] 8.7 Verificar que `pnpm build` pasa sin errores TypeScript
