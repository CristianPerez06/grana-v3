## Why

La web ya tiene `/settings` con tres bloques (Visualización, Idioma, Categorías) cubriendo preferencias UI-only y administración del catálogo personal. En mobile no existe ninguna pantalla equivalente: el `AppMenu` muestra el ítem "Settings" pero su `onPress` solo cierra el modal. La preferencia `show_cents` tiene plumbing en `apps/mobile/lib/preferences.ts` pero no hay UI para tocarla; el cambio de idioma no está disponible (mobile renderea siempre `esMessages`); y la administración de categorías propias y subcategorías es directamente inaccesible desde mobile.

Esto rompe el estándar V3 de **paridad feature por feature** entre web y mobile, y deja a la app mobile como un visor de solo lectura para configuración. El usuario decidió ir por paridad completa, no por una versión recortada.

## What Changes

- **Safe-area fix global**: monta `SafeAreaProvider` en el root layout y envuelve cada pantalla root del shell autenticado (`dashboard`, `accounts`, `tarjetas`, `movimientos`, `settings`, `settings/categories`) con `SafeAreaView edges={['top']}`. `CurvedNavyHeader` (auth + onboarding) pasa de `pt-12` hardcoded a `useSafeAreaInsets()`. Las pantallas anidadas de settings usan el **native stack header** (`<Stack.Screen options={{ headerShown: true, title, headerBackTitle }} />`) que ya respeta safe-area + chevron + swipe-back. Esto saca un bug de raíz que estaba afectando toda la app, no solo settings.
- **Nueva ruta `/(app)/settings` en mobile** con la misma composición que web: tres secciones — Visualización, Idioma, Categorías — y `PageHeader` con `title="Configuración"`.
- **Entry point desde `AppMenu`**: el ítem "Settings" pasa de `onPress={onClose}` a navegar a `/(app)/settings` (cerrando el modal antes).
- **Bloque Visualización**: nuevo componente `ShowCentsToggle` mobile (Pressable + switch nativo o el patrón visual del switch web) que llama `setShowCents(value)` y refresca el `PreferencesContext` para que el cambio sea inmediato en sesión. Hoy `PreferencesContext` solo lee en mount; este change agrega un mecanismo de update reactivo (setter expuesto por el provider).
- **Bloque Idioma**: nuevo componente `LanguageSwitcher` mobile + persistencia de locale en mobile. Hoy `apps/mobile/lib/i18n.ts` está hardcodeado a `esMessages`; este change introduce un `LocaleProvider` que lee/escribe el locale en `expo-secure-store` (clave `locale`, default `es`), expone `useLocale()` y `setLocale()`, y reemplaza la función `t()` para que tome el catálogo activo (`es` | `en`) desde `@grana/i18n-messages`. Esta persistencia es independiente de la cookie `NEXT_LOCALE` web — la divergencia es esperada (mismo patrón que `show_cents`, ver TODO en `apps/mobile/lib/preferences.ts`).
- **Bloque Categorías mobile completo**:
  - `/(app)/settings/categories` — lista de categorías sistema + propias, agrupadas; "+ Agregar" como acción del header.
  - `/(app)/settings/categories/new` — formulario de alta de categoría propia.
  - `/(app)/settings/categories/[id]/edit` — edición de categoría propia (sistema bloqueado).
  - `/(app)/settings/categories/[id]/subcategories` — listado de subcategorías de una categoría.
  - `/(app)/settings/categories/[id]/subcategories/new` — alta de subcategoría propia.
  - Las operaciones de DB van directo contra el cliente Supabase de mobile (`apps/mobile/lib/supabase.ts`); no hay server actions en mobile. Reutiliza los schemas Yup de `@grana/validation` (los mismos que usa web) para validar inputs antes del `insert`/`update`. Las reglas de negocio (RLS, `canonical_name` inmutable, archivar vs. eliminar) ya están enforced en DB; el cliente mobile solo formatea errores.
- **Nuevos prop contracts en `@grana/ui-contracts`**: `ShowCentsToggleProps`, `LanguageSwitcherProps`, `SettingsSectionProps` (encabezado uppercase + card). Web migra a importarlos también, para que la divergencia rompa TypeScript en ambos lados.
- **i18n keys nuevas** en `packages/i18n-messages` para las cadenas mobile de settings que no existen aún (`settings.title`, `settings.display.label`, `settings.display.show_cents.label/description`, `settings.categories.label`, `settings.categories.manage_cta`, etiquetas de las pantallas de categoría). Web puede reusar las claves nuevas donde aplique para no duplicar copy.

## Capabilities

### New Capabilities

(ninguna — toda la funcionalidad nueva extiende capabilities existentes con scenarios `(mobile)`)

### Modified Capabilities

- `settings`: nuevos requirements/scenarios tagged `(mobile)` para Visualización, Idioma y Categorías en la app mobile. Los requirements existentes web mantienen sus scenarios; los nuevos scenarios mobile establecen la paridad.
- `i18n`: nuevo requirement de "Soporte multi-idioma en mobile" — persistencia de locale en `expo-secure-store`, helper `t()` locale-aware, `LocaleProvider`. Reemplaza el comportamiento actual hardcodeado a `es`.
- `categories`: scenarios `(mobile)` que describen el flujo de administración en la app mobile (lista, alta/edición de propias, subcategorías). Las reglas semánticas (RLS, `canonical_name`, archivar vs. eliminar) ya existen en el requirement y se aplican igual; solo se documenta el surface mobile.
- `mobile-app-shell`: el `AppMenu` `Settings` SHALL navegar a `/(app)/settings` en vez de solo cerrar el modal.

## Impact

**Mobile — código nuevo:**
- `apps/mobile/app/(app)/settings/index.tsx` (pantalla principal).
- `apps/mobile/app/(app)/settings/_layout.tsx` (Stack para anidar categorías).
- `apps/mobile/app/(app)/settings/categories/index.tsx`, `new.tsx`, `[id]/edit.tsx`, `[id]/subcategories/index.tsx`, `[id]/subcategories/new.tsx`.
- `apps/mobile/components/settings/ShowCentsToggle.tsx`, `LanguageSwitcher.tsx`, `SettingsSection.tsx`.
- `apps/mobile/components/categories/CategoryRow.tsx`, `CategoryList.tsx`, `CreateCategoryForm.tsx`, `EditCategoryForm.tsx`, `SubcategoryList.tsx`, `CreateSubcategoryForm.tsx`.
- `apps/mobile/lib/categories.ts` (queries Supabase + helpers de CRUD).
- `apps/mobile/lib/locale.ts` y `apps/mobile/lib/locale-context.tsx` (persistencia + provider).
- `apps/mobile/lib/preferences-context.tsx` actualizado para exponer `setShowCents` reactivo.

**Mobile — código modificado:**
- `apps/mobile/lib/i18n.ts`: `t()` deja de tomar `esMessages` hardcodeado; toma el catálogo del `LocaleProvider` o de un selector basado en el locale persistido. Para uso fuera de componentes (helpers puros), mantiene un fallback síncrono a `es`.
- `apps/mobile/app/_layout.tsx`: envuelve la app con `LocaleProvider` por debajo (o por arriba) del `PreferencesProvider`.
- `apps/mobile/components/layout/AppMenu.tsx`: el `SheetItem` de Settings recibe `onPress` que navega.

**Shared packages:**
- `packages/ui-contracts/src/index.ts`: nuevos types `ShowCentsToggleProps`, `LanguageSwitcherProps`, `SettingsSectionProps`.
- `packages/i18n-messages/src/es.json` y `en.json`: nuevas claves `settings.*` y `categories.admin.*` (los textos mobile-específicos).

**Web — código modificado (paridad de contratos, no de comportamiento):**
- `apps/web/app/(app)/settings/_components/show-cents-toggle.tsx`, `language-switcher.tsx`: importan los nuevos props desde `@grana/ui-contracts` y se ajustan al contrato compartido.

**DB / Backend:** ninguno. Toda la operatoria mobile va contra las tablas `categories` / `subcategories` ya existentes con RLS vigente. La preferencia `show_cents` sigue siendo local a cada plataforma (TODO de migración a `users` permanece en `apps/mobile/lib/preferences.ts`).

**Dependencias nuevas:** ninguna. `expo-secure-store` ya está instalado (lo usa `preferences.ts`).
