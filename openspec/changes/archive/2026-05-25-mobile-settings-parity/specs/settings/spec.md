## ADDED Requirements

### Requirement: El usuario MUST poder acceder a la pantalla de configuración en mobile (mobile)

`apps/mobile` SHALL exponer la ruta `/(app)/settings` con una pantalla que renderee, en este orden: un `PageHeader` con `title="Configuración"`, una sección **Visualización**, una sección **Idioma** y una sección **Categorías** (con enlace a `/(app)/settings/categories`). La composición SHALL ser paritaria con `apps/web/app/(app)/settings/page.tsx`: mismo título, mismas secciones, mismo orden.

Cada sección SHALL renderearse con el componente compartido `SettingsSection` (header uppercase + contenedor con borde y fondo `card`), cuyo contrato vive en `@grana/ui-contracts`.

La pantalla NO SHALL renderear un `<h1>` ad-hoc — usa `PageHeader` mobile.

**Todas** las pantallas del stack de settings (roots y anidadas) SHALL usar el `PageHeader` custom — no el native stack header. Las anidadas (`/(app)/settings/categories/new`, `/[id]/edit`, `/[id]/subcategories`, `/[id]/subcategories/new`) SHALL pasar la prop `backLink` (con `href` al stack-parent y `label` legible) para que el back link aparezca arriba del título, siguiendo el mismo patrón visual que `PageHeader` ya implementa en web y en el resto de mobile. El native stack header (`headerShown: true` via `<Stack.Screen>`) NO SHALL aparecer en este stack — el `_layout.tsx` de cada nivel mantiene `screenOptions={{ headerShown: false }}` y el chrome lo provee el componente compartido. Razón: consistencia visual cross-platform y unificación del lenguaje de headers; las pantallas web equivalentes usan el mismo `PageHeader` con `backLink`.

Cada pantalla (root o anidada) SHALL envolver su contenido en `SafeAreaView edges={['top']}` (de `react-native-safe-area-context`) para respetar el notch / status bar, ya que al no haber native header no hay safe-area automático.

#### Scenario: La ruta /settings está disponible en mobile

- **WHEN** un usuario autenticado en mobile navega a `/(app)/settings`
- **THEN** la pantalla renderea el `PageHeader` con título "Configuración"
- **AND** muestra las secciones "Visualización", "Idioma" y "Categorías" en ese orden

#### Scenario: La pantalla settings es accesible desde el AppMenu

- **WHEN** un usuario abre el `AppMenu` y presiona el ítem "Configuración"
- **THEN** el sheet del menú se cierra
- **AND** la app navega a `/(app)/settings`

---

### Requirement: El usuario MUST poder activar o desactivar la visualización de centavos en mobile (mobile)

`apps/mobile` SHALL ofrecer dentro de `/(app)/settings`, en la sección **Visualización**, un control para activar/desactivar la preferencia "Mostrar centavos". El control SHALL implementarse con el componente `ShowCentsToggle` mobile, cuyo contrato vive en `@grana/ui-contracts` (`ShowCentsToggleProps`).

La preferencia SHALL persistirse en `expo-secure-store` bajo la clave `show_cents` (`'true'` | `'false'`). El default SHALL ser `false`. La preferencia SHALL aplicar inmediatamente, en la sesión activa, a todos los montos visibles (cuentas, transacciones, tarjetas) — el cambio NO requiere reiniciar la app.

La reactividad SHALL implementarse vía `PreferencesContext` mobile, que expone `{ showCents, setShowCents }`. Al llamar `setShowCents(value)`, el provider SHALL (a) escribir la SecureStore y (b) actualizar su state, disparando re-render de todos los consumers.

La preferencia mobile SHALL ser independiente de la cookie `show_cents` de web. Toggle en una plataforma NO se sincroniza con la otra. Esta divergencia es esperada y queda documentada en `apps/mobile/lib/preferences.ts` (TODO existente de migración a `users.preferences`).

#### Scenario: Default desactivado en primer arranque

- **WHEN** un usuario instala la app y abre `/(app)/settings` sin haber tocado la preferencia
- **THEN** el toggle aparece en estado OFF
- **AND** todos los montos visibles se muestran sin decimales

#### Scenario: Activar centavos refleja el cambio inmediatamente

- **WHEN** un usuario activa el toggle "Mostrar centavos" en `/(app)/settings`
- **THEN** la SecureStore guarda `show_cents=true`
- **AND** al navegar al dashboard (sin reiniciar la app), todos los montos muestran 2 decimales

#### Scenario: La preferencia persiste entre sesiones

- **WHEN** un usuario activa el toggle, cierra la app completamente y la vuelve a abrir
- **THEN** el toggle aparece en estado ON
- **AND** los montos siguen mostrándose con decimales

---

### Requirement: El usuario PUEDE cambiar el idioma de la app desde `/settings` en mobile (mobile)

`apps/mobile` SHALL exponer dentro de `/(app)/settings`, en la sección **Idioma**, un componente `LanguageSwitcher` mobile que permite al usuario seleccionar entre los locales soportados (`es`, `en`). El contrato vive en `@grana/ui-contracts` (`LanguageSwitcherProps`).

El cambio de locale SHALL persistirse en `expo-secure-store` y reflejarse inmediatamente en toda la app sin necesidad de reiniciar — implementado vía `LocaleProvider` (ver capability `i18n`).

El selector mobile SHALL ser independiente de la cookie `NEXT_LOCALE` de web. Cambiar el locale en una plataforma NO se sincroniza con la otra.

#### Scenario: El switcher de idioma aparece en /settings mobile

- **WHEN** un usuario autenticado navega a `/(app)/settings`
- **THEN** la sección "Idioma" renderea el `LanguageSwitcher` con los locales soportados
- **AND** el locale activo aparece marcado visualmente

#### Scenario: El cambio de idioma se aplica inmediatamente

- **WHEN** un usuario presiona "EN" en el switcher
- **THEN** las pantallas de `/(app)/settings` (y cualquier consumer del `LocaleProvider` vía `useT()`) re-renderean con strings en inglés
- **AND** no es necesario reiniciar la app

#### Scenario: El idioma elegido persiste entre sesiones

- **WHEN** un usuario cambia a "EN", cierra la app completamente y la vuelve a abrir
- **THEN** la app arranca con el locale `en` activo

---

### Requirement: El usuario MUST poder administrar sus categorías personalizadas desde configuración en mobile (mobile)

`apps/mobile` SHALL proveer acceso a la gestión de categorías propias (lista, alta, edición, archivar, eliminar; subcategorías propias por categoría) desde `/(app)/settings/categories`. Las categorías y subcategorías de sistema SHALL ser visibles pero no editables (la restricción vive en DB vía RLS y se respeta en el cliente mobile mostrando sin botones de acción).

El detalle del flujo CRUD mobile (rutas, surface, errores) vive en la capability `categories`.

#### Scenario: Entry a categorías desde /settings mobile

- **WHEN** un usuario abre `/(app)/settings`
- **THEN** ve un ítem "Administrar categorías" en la sección Categorías
- **AND** al presionarlo navega a `/(app)/settings/categories`
