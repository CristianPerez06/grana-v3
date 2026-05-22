## ADDED Requirements

### Requirement: El usuario PUEDE cambiar el idioma de la app desde `/settings`

`apps/web` SHALL exponer una sección "Idioma" dentro de `/settings` que permite al usuario seleccionar entre los locales soportados por la app. El control SHALL ser el componente `LanguageSwitcher` (previamente alojado en un footer global, ahora eliminado).

La preferencia de locale SHALL persistir entre sesiones mediante el mecanismo que ya provee next-intl (cookie de locale escrita por el server action `setLocaleAction`). Esta change NO introduce un mecanismo nuevo de persistencia; solo cambia el punto de entrada visual.

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
