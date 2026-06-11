## MODIFIED Requirements

### Requirement: El usuario PUEDE cambiar el idioma de la app desde `/settings`

`apps/web` SHALL exponer una sección "Idioma" dentro de `/settings` que permite al usuario seleccionar entre los locales soportados por la app. El control SHALL ser el componente `LanguageSwitcher` (previamente alojado en un footer global, ahora eliminado).

La sección Idioma SHALL renderizar una **fila descriptiva** alrededor del control: un `label` y una `description` (leídos de `settings.language.row_label` y `settings.language.description`) a la izquierda, y el control segmentado de locales a la derecha — simétrica con la fila de `ShowCentsToggle`. El copy de fila SHALL proveerse mediante las props **opcionales** `label` y `description` del contrato `LanguageSwitcherProps` (en `@grana/ui-contracts`). Por ser opcionales, un consumidor que no las pase (p. ej. el `LanguageSwitcher` mobile mientras mobile no esté implementado) SHALL seguir renderizando solo el control; la paridad sección-a-sección con web (mismo título, mismas secciones, mismo orden) se mantiene.

Las etiquetas de cada locale en el control SHALL ser los **endónimos** del idioma ("Español", "English"), leídos de `settings.language.es` y `settings.language.en`. Los endónimos no se localizan: ambos catálogos (`es.json`, `en.json`) SHALL contener los mismos valores.

La preferencia de locale SHALL persistir entre sesiones mediante el mecanismo que ya provee next-intl (cookie de locale escrita por el server action `setLocaleAction`). Esta capability NO introduce un mecanismo nuevo de persistencia; solo cambia el punto de entrada visual.

El `Footer` global de `apps/web/app/layout.tsx` SHALL ser eliminado del repositorio. NINGÚN otro componente SHALL renderizar el `LanguageSwitcher` fuera de `/settings`.

#### Scenario: El usuario abre /settings y ve la sección Idioma

- **WHEN** un usuario autenticado navega a `/settings`
- **THEN** la página renderiza una sección titulada "Idioma" (label leído de `settings.language.label`)
- **AND** dentro de la sección aparece una fila con `label` y `description` (de `settings.language.*`) más el `LanguageSwitcher` con los locales soportados

#### Scenario: El cambio de idioma persiste

- **WHEN** un usuario selecciona el locale `en` (botón con la etiqueta "English") desde la sección Idioma
- **THEN** la app re-renderiza con strings en inglés
- **AND** al recargar la página, el idioma elegido sigue activo

#### Scenario: El footer global no existe

- **WHEN** un usuario carga cualquier ruta de la app
- **THEN** el DOM NO contiene ningún `<footer>` propio del shell raíz (`apps/web/app/layout.tsx`)
- **AND** el `LanguageSwitcher` solo aparece dentro de `/settings`
