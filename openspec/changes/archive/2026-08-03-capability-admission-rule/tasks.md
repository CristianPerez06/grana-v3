# Tareas — regla de admisión a las capabilities meta

Este change no toca código. Agrega un requirement nuevo y no modifica ninguno existente.

## 1. Deltas (hecho al proponer)

- [x] 1.1 Escribir el `## ADDED Requirements` de `project-conventions` con el requirement de admisión.
- [x] 1.2 Confirmar que el título no existe ya en el spec maestro.

## 2. Verificación de coherencia

- [x] 2.1 **El requirement pasa su propio test.** Su sujeto es el workflow de autoría de specs → proceso de trabajo sobre el repo → `project-conventions`. Si no pasara, estaría mal ubicado por construcción.
- [x] 2.2 Confirmar que los 10 requirements que hoy tiene `project-conventions` pasan el test de admisión, es decir que este change no deja la capability en violación de su propia regla nueva.
- [x] 2.3 Confirmar que la tabla de capabilities meta lista exactamente las que existen hoy (`project-conventions`, `repo-architecture`, `ui-foundations`) y que ninguna otra capability de `openspec/specs/` es meta.
- [x] 2.4 Confirmar que el requirement tiene al menos un `SHALL`/`MUST` y que cada scenario usa `####`.
- [x] 2.5 `npx --yes @fission-ai/openspec@1.7.0 validate capability-admission-rule --strict` pasa con exit code 0.

## 3. Archivado (en la branch, antes del merge a `main`)

- [x] 3.1 Aplicar el delta al spec maestro de `project-conventions`, sin dejar secciones `## ADDED/MODIFIED/REMOVED/RENAMED`.
- [x] 3.2 Confirmar que `project-conventions` queda con 11 requirements (10 + 1).
- [x] 3.3 Mover la carpeta a `openspec/changes/archive/YYYY-MM-DD-capability-admission-rule/`.
- [x] 3.4 `pnpm openspec:check` pasa. Correrlo de verdad y ver el exit code.
- [x] 3.5 `npx --yes @fission-ai/openspec@1.7.0 validate --specs --strict` pasa sobre los specs maestros sincronizados.
- [x] 3.6 Confirmar en el PR que el job `OpenSpec validation` de CI pasa.

## 4. Seguimiento

- [x] 4.1 Marcar la regla de admisión como saldada en `openspec/changes/archive/2026-08-02-split-project-conventions/tasks.md` (tarea 4.2). Con eso queda saldada toda la deuda estructural de aquel change; la única pendiente es la deuda 1 (bimoneda desactualizada en `onboarding`), que es de contenido y no de estructura.
- [ ] 4.2 Evaluar si `AGENTS.md` debería mencionar la regla en su sección de specs. No se hace acá para no mezclar: este change agrega la regla, y sincronizar `AGENTS.md` es una decisión aparte sobre cuánta spec se duplica en el manual del agente.
