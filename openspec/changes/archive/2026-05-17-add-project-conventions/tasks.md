> **Convención crítica para todas las traducciones de specs:**
> Preservar SIEMPRE los keywords parseados por OpenSpec en inglés:
> `## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements`, `## RENAMED Requirements`, `### Requirement:`, `#### Scenario:`, `**WHEN**`, `**THEN**`, `**AND**`, `FROM:`, `TO:`, `**Reason**:`, `**Migration**:`.
> Si se rompe un marker, OpenSpec deja de detectar el requirement y el archive falla.

## 1. README — paso de instalación pnpm

- [x] 1.1 Agregar al `README.md`, antes del actual paso "Instalar dependencias", un paso nuevo titulado "Instalar pnpm" con dos opciones: `corepack enable pnpm` (rápido) y link a `https://pnpm.io/installation` (canónico)
- [x] 1.2 Renumerar los pasos siguientes ("Configurar variables de entorno", "Configuración inicial de Supabase", "Ejecutar la aplicación", etc.) para que el numeral siga siendo correcto
- [x] 1.3 Revisar el resto del README y confirmar que esté íntegramente en español (las secciones "Configuración inicial de Supabase" y "Convenciones" ya están en español; verificar la tabla de scripts y el bloque de "Estructura del proyecto" + "Stack tecnológico")

## 2. CLAUDE.md — cláusula de branch naming

- [x] 2.1 En la sección `## Branching` de `CLAUDE.md`, después de la lista de prefijos, agregar una cláusula que prohíba explícitamente sufijos/prefijos con IDs random, hashes o números arbitrarios en el cuerpo del nombre de branch
- [x] 2.2 Incluir un ejemplo positivo (`feature/add-login-form`) y uno negativo (`feature/add-login-form-xA43I`)
- [x] 2.3 Aclarar que sufijos semánticamente significativos (p. ej. `-v2`, `-step-2`, `-rollback`) están permitidos
- [x] 2.4 Confirmar que el resto de `CLAUDE.md` permanece en inglés (excepción declarada en la spec)

## 3. Traducir SUPABASE_SETUP.md

- [x] 3.1 Traducir título, intro y todas las secciones (1 a 10) de `SUPABASE_SETUP.md` al español
- [x] 3.2 Conservar en inglés los términos técnicos clave: `RLS`, `JWT`, `OTP`, `PKCE`, `RPC`, `anon`, `service_role`, `SSR`, `App Router`, nombres de funciones de la API de Supabase (`signUp`, `signInWithPassword`, `exchangeCodeForSession`, etc.), nombres de archivos y paths
- [x] 3.3 Traducir comentarios dentro de los bloques de código (los identifiers se mantienen en inglés porque son código real)
- [x] 3.4 Verificar que los snippets de código no se modificaron (sólo se traducen los comentarios y el texto fuera de los bloques)

## 4. Traducir specs de add-auth-flow

- [x] 4.1 Traducir `openspec/changes/add-auth-flow/specs/auth/spec.md`: nombres de Requirement, descripciones y scenarios al español. Preservar `## ADDED Requirements`, `### Requirement:`, `#### Scenario:`, `**WHEN**`, `**THEN**`, `**AND**` en inglés
- [x] 4.2 Traducir `openspec/changes/add-auth-flow/specs/profiles/spec.md` con los mismos cuidados
- [x] 4.3 Traducir `openspec/changes/add-auth-flow/specs/i18n/spec.md` con los mismos cuidados
- [x] 4.4 Verificar con `openspec status --change add-auth-flow` que el conteo de requirements sigue siendo el mismo después de traducir (si bajó alguno, se rompió un marker)
- [x] 4.5 Verificar con `openspec instructions specs --change add-auth-flow --json` que todos los requirements son detectados correctamente

## 5. Revisar coherencia de proposal/design/tasks de add-auth-flow

- [x] 5.1 Releer `openspec/changes/add-auth-flow/proposal.md` y confirmar que está íntegramente en español; ajustar si quedó alguna frase en inglés
- [x] 5.2 Releer `openspec/changes/add-auth-flow/design.md` y confirmar mismo idioma; ajustar si quedó alguna frase en inglés
- [x] 5.3 Releer `openspec/changes/add-auth-flow/tasks.md` y confirmar mismo idioma. Preservar el estado `- [x]` / `- [ ]` de los checkboxes (la traducción NO debe alterar el progreso)

## 6. Verificación final

- [x] 6.1 Ejecutar `openspec status --change add-auth-flow` y confirmar que sigue mostrando `4/4 artifacts complete`
- [x] 6.2 Ejecutar `openspec status --change add-project-conventions` y confirmar `4/4 artifacts complete`
- [x] 6.3 Grep manual: `grep -rn "Requirement: " openspec/changes/add-auth-flow/specs/` debe seguir devolviendo el mismo número de líneas que antes de traducir (8 en auth, 3 en profiles, 4 en i18n = 15 total)
- [x] 6.4 Abrir el README en preview y verificar que el flujo de "primera vez" tiene sentido: instalar pnpm → instalar deps → configurar env → setup de Supabase → correr
- [x] 6.5 `pnpm lint` y `npx tsc --noEmit` siguen pasando (ninguna traducción debería tocar código, pero confirmamos)
