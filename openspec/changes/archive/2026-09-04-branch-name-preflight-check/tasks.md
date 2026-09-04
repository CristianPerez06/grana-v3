## 1. AGENTS.md

- [x] 1.1 Agregar un bloque "Pre-flight — MANDATORY" al inicio del archivo, antes de "V3 Rebuild Standard".
- [x] 1.2 El bloque nombra el chequeo del nombre de branch, el chequeo pre-commit existente y la elección del número de migración contra `main`, cada uno con link a su sección canónica. No reproduce ninguna regla completa.
- [x] 1.3 Cubrir explícitamente el caso de la branch provista por un harness de agente.
- [x] 1.4 Dejar la sección § Branching donde está, sin duplicar su contenido.

## 2. CLAUDE.md

- [x] 2.1 Agregar una línea que apunte al bloque pre-flight, manteniendo el archivo como pointer.

## 3. Spec

- [x] 3.1 Archivar la change y aplicar los deltas sobre `openspec/specs/project-conventions/spec.md`.
- [x] 3.2 Correr `pnpm openspec:check`.
