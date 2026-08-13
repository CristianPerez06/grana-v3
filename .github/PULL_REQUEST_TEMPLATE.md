### 🎯 ¿Qué hace este PR?

<!-- Describí brevemente el cambio y su propósito: la intención, no un recuento de archivos. -->

### 🔗 Ticket

<!-- Opcional. Link al ticket, issue o tarea que originó este cambio, si existe. Borrá esta sección si el PR no tiene uno. -->
<!-- Si es un issue de este repo (`#26` o la URL completa), al mergear el PR se mueve solo a "Done" en el Project — ver .github/workflows/ticket-to-done.yml. -->

Ticket:

### 🧩 Tipo de cambio

<!-- Marcá la opción que corresponda con una "x". -->

- [ ] 🐞 Bug fix
- [ ] 🧩 Feature nueva
- [ ] ⚙️ Mejora / Refactor
- [ ] 📄 Documentación
- [ ] 🔧 Config / CI
- [ ] 🗂️ OpenSpec (propuesta o archivado de un change)

### 📐 OpenSpec

<!-- Si el PR implementa un change de OpenSpec, completá esta sección. Si no toca specs, borrala. -->

Change: `openspec/changes/<nombre>/`

- [ ] El change está **archivado en la rama** (carpeta movida a `openspec/changes/archive/YYYY-MM-DD-<nombre>/`)
- [ ] Deltas aplicados a los master specs — no quedan secciones `## ADDED/MODIFIED/REMOVED/RENAMED Requirements`
- [ ] `Purpose` real escrito en cada capability nueva (sin `TBD`)
- [ ] `AGENTS.md` actualizado si el change completa/agrega un módulo o un package

### 📸 Screenshots / Videos

<!-- Si hay cambios de UI, adjuntá antes/después o un video corto. Cubrí las vistas que hayas tocado (web desktop, web mobile, nativo). Borrá esta sección si no aplica. -->

**Antes:**

**Después:**

### 🧪 Cómo probarlo

<!-- Pasos para verificar que el PR funciona como se espera. -->

1.
2.
3.

### ✅ Checklist previo al merge

#### Validaciones locales (mismas que corre CI)

<!-- CI corre 5 jobs en paralelo sobre cada PR a `main`: quality, web-build, web-test, monorepo-health y specs. Correlos localmente antes de abrir el PR. -->

- [ ] Lint web y mobile pasan (`pnpm lint` + `pnpm lint:mobile`)
- [ ] Typecheck web y mobile pasan (`pnpm typecheck` + `pnpm typecheck:mobile`)
- [ ] Tests pasan (`pnpm test`)
- [ ] Build de producción de web pasa (`pnpm build`)
- [ ] `pnpm openspec:check` pasa (sin placeholders `TBD` en los master specs)
- [ ] Si toqué dependencias: `pnpm-lock.yaml` actualizado y commiteado (`pnpm install --frozen-lockfile` pasa)
- [ ] Si toqué dependencias: no se duplicaron `react` ni `react-native` en el workspace

#### Arquitectura y convenciones

- [ ] Sin JSX compartido entre web y mobile — la paridad va por prop types en `@grana/ui-contracts` y lógica pura en `@grana/money-logic`
- [ ] Nada de strings hardcodeados de cara al usuario: van a `@grana/i18n-messages` con claves en **`es.json` y `en.json`**
- [ ] Código en inglés (identificadores, nombres de archivo, comentarios); documentación en español
- [ ] Sin balances persistidos — todo monto derivado se calcula desde el historial, y toda lectura que produzca un número de dinero agrega en SQL o pagina exhaustivamente

#### Higiene de rama

- [ ] Rama nombrada `<feature|bugfix|hotfix|chore>/<kebab-case-en-inglés>`, sin IDs ni sufijos aleatorios
- [ ] Rama actualizada sobre `main` (`main` tiene historia lineal — sin merge commits)
- [ ] El merge se hace con **Squash and merge**, con el título del PR en formato conventional commit (`type(scope): subject`) y **sin body**

### 💬 Notas para quien revisa

<!-- Trade-offs, preguntas abiertas, áreas que necesitan atención extra. Borrá esta sección si no aplica. -->
