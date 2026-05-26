## MODIFIED Requirements

### Requirement: El código debe estar en inglés

Todos los identifiers del código SHALL estar en inglés. Esto cubre nombres de variables, funciones, tipos, interfaces, componentes, props, parámetros, hooks personalizados, imports y módulos. También cubre nombres de archivos y directorios bajo cualquier `apps/<name>/` o `packages/<name>/`, y cualquier código fuente nuevo. Los comentarios en el código y la documentación JSDoc/TSDoc SHALL estar en inglés. Los nombres de stories de Storybook (exports nombrados como `Default`, `WithError`, etc.) SHALL estar en inglés porque son TypeScript identifiers.

La regla cubre explícitamente los **segmentos de ruta** (archivos y directorios) bajo `apps/<name>/app/` y equivalentes (route groups, dynamic segments y archivos `page.tsx`/`layout.tsx`/`index.tsx` del file-system router). El hecho de que en Next App Router y Expo Router un archivo de ruta tenga su nombre proyectado como segmento de URL NO lo convierte en copy visible al usuario — sigue siendo código (un identifier en el filesystem) y SHALL estar en inglés. El copy que el usuario lee se sirve siempre desde `@grana/i18n-messages`, nunca desde el path.

La regla tiene una excepción explícita: los **valores** de las strings en los archivos de catálogos i18n (`packages/i18n-messages/src/*.json`) pueden estar en cualquier idioma — son copy visible al usuario final, no código. Las **claves** del JSON sí son identifiers y deben estar en inglés.

#### Scenario: Una función nueva se nombra en inglés

- **WHEN** un colaborador agrega una función al código fuente
- **THEN** el nombre de la función está en inglés (ej. `createUser`, no `crearUsuario`)
- **AND** sus parámetros y variables locales están en inglés

#### Scenario: Comentarios de código en inglés

- **WHEN** un colaborador agrega un comentario o un bloque JSDoc/TSDoc al código
- **THEN** el comentario está en inglés

#### Scenario: Strings de i18n en español o inglés según el catálogo

- **WHEN** un colaborador agrega una clave al catálogo `packages/i18n-messages/src/es.json`
- **THEN** la clave (identifier) está en inglés
- **AND** el valor (copy visible al usuario) está en español
- **AND** la misma clave existe en `packages/i18n-messages/src/en.json` con su valor en inglés

#### Scenario: Un archivo de ruta nuevo se nombra en inglés

- **WHEN** un colaborador crea una nueva pantalla bajo `apps/web/app/` o `apps/mobile/app/`
- **THEN** el nombre del archivo y de los directorios intermedios están en inglés (ej. `initial-balance/page.tsx`, no `saldo-actual/page.tsx`; `cards.tsx`, no `tarjetas.tsx`)
- **AND** las referencias al path en `<Link href>`, `router.push`, `redirect()`, `<Stack.Screen name>`, `<Tabs.Screen name>` usan los nombres en inglés
- **AND** el copy visible que el usuario lee sobre esa pantalla se sirve desde `@grana/i18n-messages` (en cualquier idioma), no desde el segmento de URL

#### Scenario: Un directorio de route group se nombra en inglés

- **WHEN** un colaborador agrega un route group (carpeta entre paréntesis) en `apps/web/app/` o `apps/mobile/app/`
- **THEN** el nombre del route group está en inglés (ej. `(onboarding-wizard)`, `(auth)`, `(app)`), incluso cuando no aparece en la URL final
