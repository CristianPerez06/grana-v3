---
name: checkpoint
description: Audita el estado del proyecto contra su objetivo fundacional ("el repo es la memoria, una IA fresca puede continuar sin contexto de chat"). Detecta drift documental, deuda técnica concreta y falsos positivos típicos. Devuelve un reporte priorizado con recomendación SEGUIR / PIT-STOP / FRENAR. Usar periódicamente o al cerrar un módulo grande.
---

# Checkpoint del estado del proyecto

Este flujo replica formalmente el análisis que originó la change archivada `2026-05-22-chore-pit-stop-docs-and-shared-logic`. La idea: cada cierto tiempo (al terminar un módulo grande, antes de arrancar uno nuevo, cuando algo "huele raro"), parar 20 minutos y tomar la temperatura del repo antes de que la deuda se vuelva un dolor.

**Esta skill es solo de análisis.** NO modifica código, specs ni docs. Si encuentra cosas para arreglar, recomienda crear una openspec change separada.

## Argumentos

- Sin argumento → audita el repo completo.
- Con argumento `<módulo>` (por ejemplo `/checkpoint cards`) → acota el análisis a esa capability + lo que la rodea.

## Pasos

### 1. Snapshot inicial (sin sub-agentes)

Recopilar en paralelo (vía Bash directo, **no** vía sub-agente — esto es rápido y conviene tenerlo en mi contexto):

- `git branch --show-current`, `git log --oneline -20`, `git status --short`.
- `ls openspec/specs/` y `ls openspec/changes/` (excluyendo `archive/`).
- `ls openspec/changes/archive/ | tail -10` para ver las últimas changes archivadas.
- `ls supabase/migrations/` y `ls packages/` y `ls apps/`.
- Leer `CLAUDE.md` completo. Es la fuente de verdad declarada; todo lo demás se contrasta contra esto.

Anunciar al usuario en una línea qué se va a auditar y arrancar.

### 2. Lanzar 3 sub-agentes Explore en paralelo

Un solo mensaje con tres `Agent` tool calls, `subagent_type: "Explore"`. Cada prompt tiene que ser **autocontenido** (el sub-agente no tiene el contexto de la conversación) y pedir resultado **bajo 600-700 palabras** con `file_path:line` por hallazgo.

**Agente 1 — Coherencia specs ↔ código.** Para cada spec en `openspec/specs/`, verificar que exista código que lo implementa en `apps/web/` y/o `apps/mobile/`. Listar:
- Specs huérfanos (sin código).
- Código huérfano (rutas, módulos en `lib/` o `components/` que no aparecen en ningún spec).
- Changes activas en `openspec/changes/` (no archive) cuyo código YA está implementado y deberían estar archivadas.
- Specs con `Purpose: TBD - created by archiving change ...` (placeholder no reemplazado).
- Specs maestros que aún tienen secciones `## ADDED Requirements` / `## MODIFIED Requirements` (no deberían — esos son solo para `changes/`).

**Agente 2 — Calidad de código y reutilización.**
- Inventario de primitivos UI en `apps/web/components/ui/` vs `apps/mobile/components/ui/`. ¿Coinciden? ¿Divergen en convención o en API?
- Lógica de negocio: ¿dónde vive el cálculo de balance, períodos de tarjeta, recurrencias? ¿En `packages/money-logic` o duplicada en `apps/<x>/lib/`?
- Server actions: patrón consistente, `ActionResult<T>`, error handling.
- Tests: cuántos hay, cobertura de invariantes contables (`disponible ≥ 0`, off-ledger credit, deterministic ordering ASC vs DESC, `getTodayAR()` vs `new Date()` en fechas contables).
- 3-5 code smells concretos con `file:line` (archivos > 600 líneas, duplicaciones de helpers, etc.).

**Agente 3 — Documentación funcional + técnica.**
- `CLAUDE.md`: tabla "Modules" coincide con la realidad (módulos hechos vs marcados, `🚧 / ✅`). Sección "Repo Layout" coincide con `apps/` y `packages/`. Política web↔mobile escrita.
- `README.md` y `SUPABASE_SETUP.md`: en español, mencionan las dos apps, instrucciones funcionan para un dev nuevo.
- Cada `packages/<name>/` tiene `README.md` propio.
- Migraciones tienen comentario inicial explicativo.
- Email templates en `supabase/templates/` con URLs correctas.
- Calificación 1-10 de "qué tan factible es que una IA fresca continúe el repo solo".

### 3. Verificaciones puntuales propias (NO delegadas a sub-agente)

Los sub-agentes Explore tienen una ventana de lectura limitada y a veces leen los snippets sin contexto. Lo que sigue lo hago yo en el thread principal antes de sintetizar:

- `pnpm openspec:check` (si existe el script) — debe pasar. Si falla, anotar qué specs tienen TBD residuales.
- `pnpm --filter web typecheck`, `pnpm --filter web test`, `pnpm --filter mobile typecheck` — confirmar que el repo compila y los tests pasan. Si no, eso pisa cualquier otro hallazgo.
- Grep de `new Date()` en server actions y libs financieras. **Importante**: contrastar cada hit contra el tipo de columna destino. Si la columna es `TIMESTAMPTZ` (`created_at`, `resolved_at`, `<foo>_at`), `new Date()` ES correcto. Solo es bug cuando se compara o se escribe a una columna `DATE` financiera.

### 4. Sintetizar el reporte

Estructura obligatoria del output al usuario:

1. **TL;DR en 3 líneas.** Color: VERDE (todo bien), AMARILLO (deuda manejable, pit-stop opcional), ROJO (frenar antes de seguir features).
2. **Tabla de hallazgos por dimensión** con columnas: Dimensión / Estado (OK / Atención / Mal) / Hallazgo principal. Una fila por cada cosa concreta encontrada, no genérica.
3. **Lo que sí está bien** — explícito, 4-6 bullets. Es parte de la temperatura, no solo lo malo.
4. **Riesgos sistémicos** — los 3-5 que dolerían en 2 meses si no se atienden.
5. **Plan de acción priorizado** (solo si el color no es VERDE):
   - **P0**: hacer en el pit-stop inmediato (1-2 días).
   - **P1**: hacer en paralelo al próximo feature.
   - **P2**: cuando moleste, no antes.
   - Por cada item: tarea concreta + esfuerzo estimado + por qué importa.
6. **Decisiones abiertas que requieren input del usuario** — si las hay. Una por una, con opciones reales.
7. **Si recomienda PIT-STOP o FRENAR**: ofrecer crear una openspec change formal con el plan. NO crearla automáticamente.

## Guardrails — lecciones aprendidas

Errores que el primer análisis (el que originó esta skill) cometió y que esta skill debe evitar:

### G1. No tomar al pie de la letra los hallazgos de sub-agentes

Los sub-agentes Explore tienen ventana de lectura acotada y pueden flaggear cosas que parecen bugs pero no lo son. **Antes de mencionar un finding del sub-agente al usuario, verificarlo en el thread principal** leyendo el archivo, el tipo de columna en la migración relevante, o el call-site real.

### G2. `new Date()` no siempre es bug

CLAUDE.md dice que "any 'today' default in financial operations must be computed from the user's financial timezone". Eso aplica **solo a columnas `DATE` financieras**. Las columnas `TIMESTAMPTZ` (`created_at`, `resolved_at`, `onboarding_completed_at`, etc.) son timestamps técnicos de auditoría y `new Date().toISOString()` ES el valor correcto. **Verificar el tipo de columna en la migración correspondiente antes de flaggear.**

### G3. Formato delta openspec vs flat

Los specs **vivos en `openspec/changes/<name>/specs/`** usan `## ADDED Requirements` / `## MODIFIED Requirements` / `## REMOVED Requirements`. Los specs **maestros en `openspec/specs/`** NO deben tener esas secciones — solo `## Requirements` plano. Que falten en los maestros NO es problema; que sobren SÍ lo es.

### G4. Capabilities pueden compartirse

Algunos módulos no tienen su propia capability porque sus deltas fueron a una capability cross-cutting. Ejemplo: `recurring-movements` no tiene `openspec/specs/recurring-movements/` porque sus requirements viven en `openspec/specs/transactions/`. **Antes de reportar un spec faltante, buscar el nombre del módulo dentro de los specs existentes con grep.**

### G5. Tabla "Modules" de CLAUDE.md como verdad declarada

Es donde el repo declara qué módulos cree que están hechos. Si la realidad del código difiere, eso es drift documental (y el bug es CLAUDE.md, no el código). Anotar las diferencias precisas.

### G6. No inventar deuda

Si una verificación devuelve "está OK", **decirlo explícitamente** y pasar al siguiente. Inventar deuda para llenar el reporte rompe la confianza del usuario en la skill.

### G7. Diferenciar deuda real de deuda intencional documentada

Algunas cosas que parecen deuda (ej.: `title?` legacy en mobile Button) están documentadas en código como "deuda P2 conocida" con comentario explícito. No reportar esas como hallazgo nuevo — solo confirmar que el comentario sigue siendo válido.

## Qué NO hacer en esta skill

- **No escribir código**. La skill audita, no implementa. Si encuentra cosas para arreglar, recomienda crear una openspec change.
- **No modificar specs, CLAUDE.md, README ni migraciones**. Solo leer.
- **No crear branches ni commits**. El usuario decide qué hacer con el reporte.
- **No correr `pnpm install` ni nada que toque `node_modules`** salvo que el typecheck/test inicial falle por una dep faltante (y avisar antes).
- **No pasarse de 1500 palabras en el reporte final.** Conciso, accionable, citando `file:line`.

## Ejemplo de invocación

```
Usuario: /checkpoint
Claude: [snapshot] → [3 agentes en paralelo] → [verificaciones propias] → [reporte]
```

```
Usuario: /checkpoint cards
Claude: [snapshot acotado al módulo cards] → [3 agentes con foco en cards] → [verificaciones puntuales del módulo] → [reporte centrado en cards]
```

## Cuándo invocarla

Buenos momentos para correrla:

- Al cerrar un módulo grande (recién mergeado a `main`).
- Antes de arrancar un módulo nuevo, especialmente si va a tocar varios existentes.
- Cuando "se siente que algo está desincronizado" pero no se sabe qué.
- Después de una sesión larga con cambios dispersos.
- Cuando entra alguien nuevo (humano o LLM) al repo y conviene tener una foto del estado.

No tiene sentido correrla:

- Mientras se está en el medio de implementar un feature (el ruido es alto).
- Inmediatamente después de un checkpoint anterior sin cambios en el medio.
- Para responder "¿está roto X?" — para eso es más eficiente buscar X directamente.
