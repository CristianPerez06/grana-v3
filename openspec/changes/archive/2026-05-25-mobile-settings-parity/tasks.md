## 1. Contratos compartidos en `@grana/ui-contracts`

- [x] 1.1 Agregar `SettingsSectionProps`, `ShowCentsToggleProps`, `LanguageSwitcherProps` en `packages/ui-contracts/src/index.ts` con la convención de naming del paquete (`onValueChange`, `onSelect`, props presentacionales puros).
- [x] 1.2 Refactorizar `apps/web/app/(app)/settings/_components/show-cents-toggle.tsx` para consumir `ShowCentsToggleProps`: mover la llamada a `setShowCents` server action al parent (`page.tsx`), recibir `value`/`onValueChange`. Verificar que la página sigue funcionando idénticamente.
- [x] 1.3 Refactorizar `apps/web/app/(app)/settings/_components/language-switcher.tsx` para consumir `LanguageSwitcherProps`: parent pasa `current`, `locales`, `onSelect`. Mover el `useLocale()` y la llamada a `setLocaleAction` al parent.
- [x] 1.4 Crear `apps/web/app/(app)/settings/_components/settings-section.tsx` que implemente `SettingsSectionProps`. Migrar las tres secciones de `page.tsx` para usarlo y eliminar el markup duplicado.

## 2. i18n locale-aware en mobile

- [x] 2.1 Crear `apps/mobile/lib/locale.ts` con `getLocale()` / `setLocale(value)` contra `expo-secure-store` (clave `locale`, fallback a `'es'` si valor ausente o no soportado). Incluir TODO espejo al de `preferences.ts` apuntando a la futura migración a `users.preferences`.
- [x] 2.2 Crear `apps/mobile/lib/locale-context.tsx` con `LocaleProvider`, `useLocale()`, `setLocale()` y `useT()`. El provider lee SecureStore en mount, mantiene state, escribe SecureStore + actualiza state al `setLocale`.
- [x] 2.3 Actualizar `apps/mobile/lib/i18n.ts`: mantener `t()` global con fallback documentado a `es`. Agregar un selector interno `getMessages(locale)` que devuelve `esMessages` o `enMessages` desde `@grana/i18n-messages`.
- [x] 2.4 Envolver el árbol en `apps/mobile/app/_layout.tsx` con `<LocaleProvider>` (afuera o adentro del `<PreferencesProvider>`, con preferencia por orden estable; documentar el orden).

## 3. PreferencesContext reactivo en mobile

- [x] 3.1 Refactorizar `apps/mobile/lib/preferences-context.tsx` para exponer `{ showCents, setShowCents }`. `setShowCents(value)` SHALL (a) escribir SecureStore vía `setShowCentsAsync` y (b) actualizar el state del provider.
- [x] 3.2 Renombrar el setter interno actual y separar el de SecureStore para evitar shadowing. Verificar que los consumers existentes (`MaskedAmount`, `HeroSection`, `UpcomingFortnightSection`, `CreditCardItem`, `dashboard.tsx`) siguen compilando — solo añaden capacidad, no rompen el contrato actual.

## 4. Pantalla mobile `/settings`

- [x] 4.1 Crear `apps/mobile/app/(app)/settings/_layout.tsx` con `Stack screenOptions={{ headerShown: false }}`.
- [x] 4.2 Registrar la ruta `settings` en `apps/mobile/app/(app)/_layout.tsx` con `<Tabs.Screen name="settings" options={{ href: null }} />` para que no aparezca en el tab bar.
- [x] 4.3 Crear `apps/mobile/components/settings/SettingsSection.tsx` implementando `SettingsSectionProps` con primitivas RN (View/Text + NativeWind).
- [x] 4.4 Crear `apps/mobile/components/settings/ShowCentsToggle.tsx` implementando `ShowCentsToggleProps`. Usar `Switch` de RN o un Pressable custom con estilo de toggle.
- [x] 4.5 Crear `apps/mobile/components/settings/LanguageSwitcher.tsx` implementando `LanguageSwitcherProps`. Mirror visual del LanguageSwitcher web (botones inline, locale activo destacado).
- [x] 4.6 Crear `apps/mobile/app/(app)/settings/index.tsx`: `PageHeader title="Configuración"`, tres `SettingsSection` (Visualización / Idioma / Categorías). Cablear el toggle a `usePreferences()` y el switcher a `useLocale()` + `setLocale()`. El bloque Categorías es un link `Pressable` que navega a `/(app)/settings/categories`.

## 5. AppMenu navega a settings

- [x] 5.1 En `apps/mobile/components/layout/AppMenu.tsx`, actualizar el ítem "Configuración" para que su `onPress` cierre el sheet y navegue a `/(app)/settings` (usando `router.push` análogo al ítem "Tarjetas").
- [ ] 5.2 Verificar visualmente en simulador iOS y Android que la transición sheet → settings es fluida y que el back gesture / botón vuelve al menu/dashboard correctamente.

## 6. Mobile categories — lib y queries

- [x] 6.1 Crear `apps/mobile/lib/categories.ts` con funciones contra el cliente Supabase mobile: `getAllCategories(userId)`, `getCategoryById(id)`, `getSubcategoriesByCategoryId(categoryId)`, `createCategory(input)`, `updateCategory(id, input)`, `archiveCategory(id)`, `deleteCategory(id)`, `createSubcategory(input)`, `updateSubcategory(id, input)`, `archiveSubcategory(id)`.
- [x] 6.2 Para las funciones que mutan (`create*`, `update*`), validar con los schemas de `@grana/validation` antes del insert/update. Mapear errores Postgres conocidos (`23505` → mensaje i18n de duplicado).
- [x] 6.3 Asegurar que `getAllCategories` filtra por `is_active = true` y trae `subcategories(*)` igual que la versión web.

## 7. Mobile categories — UI

- [x] 7.1 Crear `apps/mobile/components/categories/CategoryRow.tsx`: render de una categoría (nombre traducido para sistema usando `useT()`, literal para propia), tipo, cantidad de subcategorías. Acciones de editar/archivar solo si `user_id !== null`.
- [x] 7.2 Crear `apps/mobile/components/categories/CategoryList.tsx`: agrupa por tipo (`income`, `expense`, `both`), renderea `CategoryRow` por cada una.
- [x] 7.3 Crear `apps/mobile/components/categories/CreateCategoryForm.tsx`: form controlado con campos nombre/tipo/icono/color. Valida con `createCategorySchema`, envía vía `createCategory`. Maneja errores y muestra mensajes i18n.
- [x] 7.4 Crear `apps/mobile/components/categories/EditCategoryForm.tsx`: análogo al de creación pero con `updateCategorySchema` y `updateCategory`. Muestra mensaje deshabilitado si la categoría es sistema.
- [x] 7.5 Crear `apps/mobile/components/categories/SubcategoryList.tsx`: lista de subcategorías de una categoría, con acciones de editar/archivar solo para propias.
- [x] 7.6 Crear `apps/mobile/components/categories/CreateSubcategoryForm.tsx`: form de alta de subcategoría con `createSubcategorySchema` y `createSubcategory`.

## 8. Mobile categories — routes

- [x] 8.1 `apps/mobile/app/(app)/settings/categories/_layout.tsx` con `Stack`.
- [x] 8.2 `apps/mobile/app/(app)/settings/categories/index.tsx`: `PageHeader` con título "Categorías", descripción y botón "+ Agregar" (action) que navega a `/new`. Renderea `<CategoryList />` con datos de `getAllCategories(user.id)`.
- [x] 8.3 `apps/mobile/app/(app)/settings/categories/new.tsx`: `PageHeader` con `backLink` a `/(app)/settings/categories`, renderea `<CreateCategoryForm />`. Al success navega de vuelta a la lista.
- [x] 8.4 `apps/mobile/app/(app)/settings/categories/[id]/edit.tsx`: lee la categoría por id, renderea `<EditCategoryForm />`.
- [x] 8.5 `apps/mobile/app/(app)/settings/categories/[id]/subcategories/index.tsx`: lista subcategorías + botón "+ Agregar subcategoría".
- [x] 8.6 `apps/mobile/app/(app)/settings/categories/[id]/subcategories/new.tsx`: form de alta de subcategoría.
- [ ] 8.7 Validar que todas las rutas anidadas resuelven correctamente con `expo-router` y que el back gesture funciona en cada nivel.

## 9. i18n catalog updates

- [x] 9.1 Agregar a `packages/i18n-messages/src/es.json` claves nuevas: `settings.title`, `settings.display.label`, `settings.display.show_cents.label/description`, `settings.categories.label`, `settings.categories.manage_cta`, `settings.categories.list.empty`, `settings.categories.actions.add/edit/archive/delete`, `settings.categories.errors.duplicate`, `settings.categories.new.title`, `settings.categories.edit.title`, `settings.categories.subcategories.title`, `settings.categories.subcategories.new.title`.
- [x] 9.2 Duplicar las claves en `packages/i18n-messages/src/en.json` con traducciones equivalentes.
- [x] 9.3 Migrar los textos hardcodeados de las pantallas mobile creadas en pasos 4, 7 y 8 a `useT()` con las claves nuevas.
- [x] 9.4 Migrar TODOS los call sites de `t()` global a `useT()` en componentes para que el switcher afecte toda la app: dashboard + 6 subcomponentes, AppMenu, TabBar, 4 pantallas onboarding, RouteError. `t()` global queda exportado solo para uso fuera de componentes (helpers puros, mappers de error).
- [x] 9.5 Web: migrar a `getTranslations`/`useTranslations` los strings hardcoded de las pantallas tocadas por este change: `/settings` page + `settings-client`, `/settings/categories` page + `category-list` + `category-row`, `/new` page + form, `/[id]/edit` page + form, `/[id]/subcategories` page + `subcategory-list`, `/[id]/subcategories/new` page + form. Las pantallas web fuera del scope de este change (`/accounts`, `/cards`, `/movimientos`) mantienen sus strings hardcoded — follow-up `web-i18n-coverage-completion`.

## 10. Verificación

- [x] 10.1 `pnpm --filter mobile typecheck` pasa sin errores.
- [x] 10.2 `pnpm --filter mobile lint` pasa sin errores (solo warnings pre-existentes en `lib/cards/`).
- [x] 10.3 `pnpm --filter web typecheck` y `pnpm --filter web lint` pasan (validan que el refactor a contratos no rompió web).
- [ ] 10.4 Smoke test manual en simulador iOS: AppMenu → Configuración → toggle centavos → ir a dashboard, verificar centavos visibles → volver a settings, cambiar a EN → verificar copy en inglés → ir a Categorías → crear una categoría propia → editarla → archivarla → entrar a subcategorías de una categoría sistema y crear una nueva.
- [ ] 10.5 Smoke test manual en device/simulator Android: mismo flujo, foco en que el sheet del menu se cierre antes de la navegación y que el back gesture funcione en cada nivel del stack de categorías.
- [ ] 10.6 Web smoke test: abrir `/settings`, togglear centavos, cambiar idioma, ir a categorías. Verificar paridad funcional con el estado pre-refactor.

## 12. Header nativo + safe-area (scope ampliado)

- [x] 12.1 Montar `<SafeAreaProvider>` en `apps/mobile/app/_layout.tsx` como wrapper outermost (sobre `LocaleProvider` → `QueryClientProvider` → `Slot`).
- [x] 12.2 Pantallas root del shell autenticado envueltas con `SafeAreaView edges={['top']}`: `dashboard.tsx`, `accounts.tsx`, `tarjetas.tsx`, `movimientos.tsx`, `settings/index.tsx`, `settings/categories/index.tsx`.
- [x] 12.3 Pantallas anidadas de settings unificadas al patrón `PageHeader` + `SafeAreaView edges={['top']}` (con `backLink` arriba del título): `categories/new`, `[id]/edit`, `[id]/subcategories/index`, `[id]/subcategories/new`. Decisión revertida del native stack header inicial — la consistencia visual cross-platform (mismo PageHeader que web y que el resto de mobile) pesa más que el chrome nativo del stack.
- [x] 12.4 `CurvedNavyHeader` (auth + onboarding) lee `useSafeAreaInsets()` para `paddingTop` dinámico en vez de `pt-12` hardcoded.
- [x] 12.5 Pantallas de onboarding (`welcome`, `perfil`, `saldo-actual`, `done`) envueltas con `SafeAreaView edges={['top']}`.
- [x] 12.6 Spec deltas actualizadas: `settings` (nested screens usan native header), `mobile-app-shell` (nuevo requirement `SafeAreaProvider` + safe-area por pantalla root).

## 11. Documentación y archive

- [x] 11.1 Actualizar el TODO en `apps/mobile/lib/preferences.ts` para que también referencie a `apps/mobile/lib/locale.ts` como segundo cliente local (preferencia UI-only que en el futuro migra a `users.preferences`).
- [x] 11.2 Agregar nota "+ paridad mobile..." en el bullet de `settings` de la tabla de Modules en CLAUDE.md.
- [ ] 11.3 Ejecutar archive de OpenSpec (mover a `archive/YYYY-MM-DD-mobile-settings-parity/`, aplicar deltas a los specs maestros, completar Purposes nuevos en `settings`/`i18n`/`categories`/`mobile-app-shell` si quedaron como TBD).
- [ ] 11.4 `pnpm openspec:check` pasa antes del merge a `main`.
