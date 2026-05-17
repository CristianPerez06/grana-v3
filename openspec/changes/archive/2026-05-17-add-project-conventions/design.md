## Context

grana-v3 va a tener al menos dos colaboradores hispanohablantes (el dueño del repo + un colaborador externo) y va a recibir contribuciones tanto humanas como de LLMs (Claude Code y eventualmente otros). Hoy las convenciones de idioma viven informalmente: el `CLAUDE.md` describe el stack y los prefijos de branches, pero no enforce idioma de doc, de código, de commits, ni prohíbe explícitamente sufijos random en branch names. El resultado es una mezcla: README/CLAUDE.md en inglés, OpenSpec proposals/design/tasks en español, specs en inglés, código en inglés (por convención implícita).

Estas reglas existen en la práctica pero no son revisables. Llevarlas a una capability `project-conventions` les da el mismo lifecycle que cualquier otra parte del sistema: viven en `openspec/specs/`, se modifican vía changes y se archivan con cambios.

Restricciones:
- OpenSpec parsea las specs buscando markers estructurales (`### Requirement:`, `#### Scenario:`, `**WHEN**/**THEN**/**AND**`, `## ADDED Requirements`, etc.). Estos markers **deben permanecer en inglés** porque son tokens del parser.
- `CLAUDE.md` ya está en inglés y la convención del ecosistema Claude Code es mantenerlo así. La capability lo declara como excepción explícita.
- La traducción de las specs de `add-auth-flow` es delicada: si se rompe un marker, OpenSpec deja de detectar requirements y el change archiva mal.

## Goals / Non-Goals

**Goals:**
- Capability `project-conventions` con 6 requirements claros y testeables.
- Traducción al español de toda la doc que hoy está en inglés (specs, SUPABASE_SETUP), preservando los markers del parser.
- README con paso de instalación de pnpm explícito antes del primer `pnpm install`.
- CLAUDE.md actualizado con la cláusula de branch naming (prohibición de IDs random).
- Cero cambios funcionales al código.

**Non-Goals:**
- Linters / hooks / CI que validen automáticamente estas reglas. Por ahora son enforce manual (revisión humana + prompts a LLMs). Si la disciplina manual falla, abrimos un change futuro `enforce-project-conventions-ci` con eslint custom rules / commit-msg hook / branch-name hook / vale (prose linter).
- Traducir `CLAUDE.md` (declarado como excepción).
- Cambiar el contenido / requirements de las specs de `add-auth-flow` — solo se cambia el idioma de la prosa.
- Reglas de proceso adicionales (PR templates, code review checklist, release flow, etc.) — fuera de alcance.

## Decisions

### 1. Capability separada en vez de mezclar con `add-auth-flow`

**Decisión:** crear `project-conventions` como capability independiente, en un change separado (`add-project-conventions`).

**Por qué:** `add-auth-flow` ya está casi completado (4/4 artifacts, 68/85 tasks). Re-abrirlo para sumar requirements no relacionados al flujo de auth confunde el archive. Además, `project-conventions` aplica a todo el repo, no solo a auth — su ciclo de vida es independiente.

**Alternativa descartada:** mezclar en `add-auth-flow`. Lo descartamos por scope creep y por mala señal en el git history (un change "agregar auth" no debería traducir specs de otras capabilities).

### 2. `CLAUDE.md` queda en inglés (excepción declarada)

**Decisión:** la regla de "documentación en español" excluye `CLAUDE.md` de forma explícita.

**Por qué:**
- `CLAUDE.md` es efectivamente una extensión del system prompt para LLMs. La convención del ecosistema Claude Code es mantenerlo en inglés.
- Los modelos siguen instrucciones operativas en inglés con una fidelidad marginalmente superior (sesgo de la data de entrenamiento). Para un archivo cuya función es darle reglas precisas al asistente, esa precisión marginal importa.
- El colaborador humano puede leer inglés (es un proyecto técnico); el costo de mantenerlo así es bajo.

**Trade-off:** un colaborador hispanohablante puro tendrá que leer ese archivo en inglés. Aceptable.

### 3. Excepción explícita de keywords parseados de OpenSpec

**Decisión:** los markers estructurales de OpenSpec quedan en inglés:
- Headers de delta: `## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements`, `## RENAMED Requirements`
- Prefijos: `### Requirement:`, `#### Scenario:`
- Conectores de scenarios: `**WHEN**`, `**THEN**`, `**AND**`
- Operadores: `FROM:`, `TO:` (rename), `**Reason**:`, `**Migration**:` (remove)

Estos no se traducen. Los nombres después de `Requirement:` / `Scenario:` sí se traducen, y la prosa del cuerpo también.

**Por qué:** son tokens del parser. Traducirlos rompe la detección y el archive del change.

### 4. Branch naming: regla negativa explícita

**Decisión:** la spec prohíbe explícitamente sufijos/prefijos con IDs random, hashes, o números arbitrarios en el cuerpo del nombre de branch.

**Por qué:** Los LLMs (sobre todo agents autónomos) tienden a generar branches con sufijos tipo `-xA43I` o `-7b3f9` para evitar colisiones. Eso ensucia el historial. La regla negativa explícita le da al asistente algo que enforzar.

**Cómo se enforce:** prompt-level (CLAUDE.md lo documenta) + revisión humana en PR. Sin CI por ahora.

**Excepción aceptable:** sufijos descriptivos numerados como `feature/migration-step-2` son válidos — el número aporta significado, no es random. La regla apunta a randomness/hashing, no a numbering semántico.

### 5. README: paso de instalación pnpm antes del primer `pnpm install`

**Decisión:** insertar un paso 1 nuevo "Instalar pnpm" antes del actual paso 1 ("Instalar dependencias"), con dos rutas:
- `corepack enable pnpm` (rápido, si tenés Node ≥ 16.13 con corepack)
- Link a [pnpm.io/installation](https://pnpm.io/installation) (canónico)

Renumerar los pasos siguientes.

**Por qué:** la doc actual asume pnpm instalado. Un colaborador nuevo se traba en el primer comando.

### 6. Traducción de specs: preservar checkbox state de tasks.md

**Decisión:** al traducir `openspec/changes/add-auth-flow/tasks.md`, los `- [x]` y `- [ ]` se preservan en su estado actual. Solo se traduce el texto de la tarea.

**Por qué:** ese estado refleja el trabajo real hecho. Resetearlo a `- [ ]` perdería información y obligaría a re-hacer manualmente el tracking.

### 7. Sin enforcement automatizado (por ahora)

**Decisión:** las reglas son enforcement manual: revisión humana en PR + CLAUDE.md las menciona para guiar a LLMs.

**Por qué:**
- Cada regla tiene un costo de tooling no trivial: eslint custom rules para identifier-language, commit-msg hook para idioma, vale + un dictionary español para prose, branch-name hook…
- La disciplina manual puede ser suficiente con dos personas y un LLM bien briefeado.

**Trigger para revisitar:** si llegan inconsistencias repetidas (≥3 PRs con violaciones), abrimos `enforce-project-conventions-ci`.

## Risks / Trade-offs

- **[Riesgo] Romper un marker del parser al traducir** → el spec deja de archivarse. **Mitigación**: checklist explícito en tasks.md ("preservar markers"), y verificación final con `openspec status --change add-auth-flow` post-traducción.
- **[Riesgo] La regla de "código en inglés" es subjetiva en bordes** (¿story names de Storybook son código? ¿nombres de carpetas tipo `_actions`?). **Mitigación**: la spec lista los casos explícitos (variables, funciones, tipos, archivos, dirs, comentarios, JSDoc, story names) para minimizar interpretación.
- **[Trade-off] Sin CI = depende de revisión manual** → posible drift. Aceptado porque el costo de tooling supera al beneficio a esta escala. Mitigado por CLAUDE.md (los LLMs lo leen automáticamente al inicio de cada sesión).
- **[Trade-off] CLAUDE.md en inglés rompe la regla "todo en español"** → confuso de leer. Mitigado declarándolo como excepción explícita y justificada en la propia spec.
- **[Riesgo menor] Traducir SUPABASE_SETUP.md puede introducir errores técnicos** (terminología Supabase que pierde precisión al traducir). **Mitigación**: dejar términos técnicos clave en inglés (RLS, JWT, OTP, PKCE, RPC) y solo traducir prosa explicativa.
