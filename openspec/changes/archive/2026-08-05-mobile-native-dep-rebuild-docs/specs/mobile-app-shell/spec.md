## ADDED Requirements

### Requirement: La app corre siempre sobre un development build, nunca sobre Expo Go

`apps/mobile` SHALL ejecutarse exclusivamente sobre un **development build** propio (`expo run:ios` / `expo run:android`, o un build de EAS). Expo Go NO SHALL considerarse un entorno de ejecución soportado, ni siquiera para pruebas rápidas.

La razón es estructural, no circunstancial: Expo Go es un binario fijo con un set cerrado de módulos nativos, y la app depende de módulos que no están en ese set (`react-native-keyboard-controller`, entre otros). No existe configuración que lo habilite, y la decisión no se revisa cuando cambie la lista de dependencias — sumar módulos nativos es el camino esperado del proyecto.

La documentación de `apps/mobile` NO SHALL ofrecer Expo Go como alternativa de ejecución en ninguna sección (requisitos, scripts, troubleshooting u onboarding).

#### Scenario: El README no ofrece Expo Go como forma de correr la app

- **WHEN** un desarrollador nuevo lee `apps/mobile/README.md` para levantar la app
- **THEN** encuentra que el entorno soportado es un development build y que Expo Go no se usa en el proyecto
- **AND** no encuentra ninguna instrucción que lo mande a instalar Expo Go

#### Scenario: El script de desarrollo apunta al dev client

- **WHEN** un desarrollador corre el script `dev` de `apps/mobile`
- **THEN** Metro arranca en modo dev-client (`expo start --dev-client`) contra el build ya instalado
- **AND** no se ofrece un flujo alternativo vía Expo Go

---

### Requirement: Una dependencia nativa nueva exige recompilar el binario

Agregar, actualizar o eliminar una dependencia con código nativo SHALL requerir **recompilar el binario** de la app (`expo run:ios` / `expo run:android`), porque el autolinking ocurre en tiempo de build. Instalar el paquete con `pnpm install` trae únicamente el JavaScript; recargar Metro NO SHALL considerarse suficiente.

Esto SHALL aplicar también al **traer cambios de otra persona** que hayan agregado una dependencia nativa: el rebuild es parte del flujo normal, no la señal de un defecto.

La documentación de `apps/mobile` SHALL registrar esta regla junto con los síntomas que produce omitirla, de modo que el diagnóstico no tenga que re-derivarse: `doesn't seem to be linked` (binario compilado antes de que existiera la dependencia) y `Failed to get the SHA-1` (file map de Metro apuntando a un `node_modules` reinstalado).

#### Scenario: Traer una dependencia nativa nueva y no recompilar

- **WHEN** un desarrollador hace `git pull` de un cambio que agregó una dependencia nativa, corre `pnpm install` y levanta Metro sin recompilar
- **THEN** la app falla en runtime con `The package 'X' doesn't seem to be linked`
- **AND** el README de `apps/mobile` documenta ese síntoma y su fix (`pnpm ios` / `pnpm android`)

#### Scenario: La tabla de scripts describe lo que cada script hace

- **WHEN** un desarrollador consulta la tabla de scripts de `apps/mobile/README.md`
- **THEN** `ios` y `android` figuran como builds nativos completos (`expo run:*`), no como atajos para abrir un simulador
- **AND** `dev` figura como "solo Metro, contra un build ya instalado"

---

### Requirement: El layout `hoisted` de node_modules es parte del contrato de resolución

El monorepo SHALL usar `nodeLinker: hoisted` (definido en `pnpm-workspace.yaml`), de modo que las dependencias de `apps/mobile` se instalan en el `node_modules` de la **raíz del repo** y NO en `apps/mobile/node_modules/`. `metro.config.js` SHALL resolver ambas rutas (`nodeModulesPaths`) y observar la raíz del workspace (`watchFolders`).

La ausencia de un paquete bajo `apps/mobile/node_modules/` SHALL entenderse como el layout esperado y NO como un install incompleto. La documentación SHALL advertirlo explícitamente, porque la lectura equivocada lleva a reinstalar `node_modules` sin necesidad — y ese borrado invalida el file map de Metro, produciendo un segundo error (`Failed to get the SHA-1`) sin relación con el problema original.

#### Scenario: Verificar si un paquete está instalado

- **WHEN** un desarrollador busca una dependencia de mobile bajo `apps/mobile/node_modules/` y no la encuentra
- **THEN** el README le indica que el layout `hoisted` la instala en el `node_modules` de la raíz
- **AND** le advierte que reinstalar `node_modules` por esa ausencia es innecesario y rompe el cache de Metro

#### Scenario: Metro resuelve desde la raíz del workspace

- **WHEN** Metro bundlea un módulo instalado en el `node_modules` de la raíz del repo
- **THEN** lo resuelve sin `Unable to resolve module`, porque `metro.config.js` incluye esa ruta en `nodeModulesPaths` y la raíz en `watchFolders`
