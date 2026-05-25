# settings Specification

## Purpose

Agrupa las preferencias de visualización y la administración personal del usuario bajo la ruta `/settings`. Incluye el toggle de mostrar/ocultar centavos en todos los importes (persistido por cookie de 1 año, sin afectar los cálculos), y el acceso a la gestión de categorías personalizadas y subcategorías (las categorías de sistema se ven pero no se editan). Es UI-only: no muta el ledger ni la lógica de cálculo.
## Requirements
### Requirement: El usuario MUST poder activar o desactivar la visualización de centavos

El sistema MUST ofrecer una preferencia llamada "Mostrar centavos" que controla si los montos monetarios se muestran con decimales o redondeados al entero más cercano. Esta preferencia SHALL aplicar a todos los montos de la app (ARS y USD) en todas las vistas donde se muestre dinero: cuentas, transacciones y tarjetas.

La preferencia SHALL persistir entre sesiones mediante una cookie con `maxAge` de 1 año. El valor por defecto SHALL ser `false` (sin centavos).

Implementación:
- Cookie: `show_cents` (`'true'` | `'false'`), path `/`, `sameSite: lax`.
- Server action `setShowCents(value: boolean)` escribe la cookie y llama `revalidatePath('/', 'layout')`.
- Helper `getShowCents(): Promise<boolean>` lee la cookie en Server Components.
- `PreferencesContext` expone el valor a Client Components vía hook `useShowCents()`.
- El layout `(app)/layout.tsx` lee la preferencia y envuelve los hijos con `PreferencesProvider`.
- Las funciones `formatARS(amount, showCents)` y `formatUSD(amount, showCents)` de `lib/format.ts` aceptan el parámetro y ajustan `maximumFractionDigits` (0 sin centavos, 2 con centavos).

#### Scenario: Preferencia desactivada (valor por defecto)

- **WHEN** el usuario no ha configurado la preferencia o la tiene en `false`
- **THEN** los montos se muestran sin decimales (ej: `$ 333`, `U$S 100`)

#### Scenario: Preferencia activada

- **WHEN** el usuario activa "Mostrar centavos" en `/settings`
- **THEN** todos los montos de la app muestran 2 decimales (ej: `$ 333,34`, `U$S 100,00`)
- **AND** el cambio es inmediato en la misma sesión y persiste en sesiones futuras

#### Scenario: Cambio de preferencia

- **WHEN** el usuario cambia el toggle en `/settings`
- **THEN** el sistema escribe la cookie y recarga el layout
- **AND** todos los montos visibles reflejan la nueva preferencia sin recargar la página manualmente

---

### Requirement: El usuario MUST poder administrar sus categorías personalizadas desde configuración

El sistema SHALL proveer acceso a la gestión de categorías (crear, editar, archivar subcategorías y categorías propias) desde la sección `/settings/categories`. Las categorías de sistema SHALL ser visibles pero no editables.

#### Scenario: Acceso a categorías desde settings

- **WHEN** el usuario navega a `/settings`
- **THEN** ve un enlace a "Administrar categorías" que lleva a `/settings/categories`

---

### Requirement: El usuario PUEDE cambiar el idioma de la app desde `/settings`

`apps/web` SHALL exponer una sección "Idioma" dentro de `/settings` que permite al usuario seleccionar entre los locales soportados por la app. El control SHALL ser el componente `LanguageSwitcher` (previamente alojado en un footer global, ahora eliminado).

La preferencia de locale SHALL persistir entre sesiones mediante el mecanismo que ya provee next-intl (cookie de locale escrita por el server action `setLocaleAction`). Esta capability NO introduce un mecanismo nuevo de persistencia; solo cambia el punto de entrada visual.

El `Footer` global de `apps/web/app/layout.tsx` SHALL ser eliminado del repositorio. NINGÚN otro componente SHALL renderizar el `LanguageSwitcher` fuera de `/settings`.

#### Scenario: El usuario abre /settings y ve la sección Idioma

- **WHEN** un usuario autenticado navega a `/settings`
- **THEN** la página renderiza una sección titulada "Idioma" (label leído de `settings.language.label`)
- **AND** dentro de la sección aparece el `LanguageSwitcher` con los locales soportados

#### Scenario: El cambio de idioma persiste

- **WHEN** un usuario presiona el locale "EN" desde la sección Idioma
- **THEN** la app re-renderiza con strings en inglés
- **AND** al recargar la página, el idioma elegido sigue activo

#### Scenario: El footer global no existe

- **WHEN** un usuario carga cualquier ruta de la app
- **THEN** el DOM NO contiene ningún `<footer>` propio del shell raíz (`apps/web/app/layout.tsx`)
- **AND** el `LanguageSwitcher` solo aparece dentro de `/settings`

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

