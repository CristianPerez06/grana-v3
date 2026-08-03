# Tareas — actualizar el layout del monorepo

Este change no toca código: corrige lo que la spec afirma sobre un repo que ya tiene esta forma. Toda la verificación es contra el filesystem.

## 1. Deltas (hecho al proponer)

- [x] 1.1 Escribir el `## MODIFIED Requirements` de `repo-architecture` con el requirement restatado completo.
- [x] 1.2 Confirmar por `diff` contra el spec maestro que el bloque `MODIFIED` difiere sólo en: la descripción de `apps/`, la de `packages/` (de inventario a familias + fuente de verdad), la enumeración de la raíz, y el scenario nuevo.

## 2. Verificación contra el repo

- [x] 2.1 `apps/` contiene exactamente `web/` y `mobile/`, ambas con su `package.json` y su toolchain propio.
- [x] 2.2 `packages/` contiene 14 paquetes, todos con `name: "@grana/<name>"`.
- [x] 2.3 Las tres familias cubren los 14 sin dejar ninguno afuera: 7 de dominio/feature, 5 cross-cutting, 2 de design system.
- [x] 2.4 `tsconfig.base.json` existe en la raíz.
- [x] 2.5 Los ejemplos citados existen: `@grana/accounts`, `@grana/cards`, `@grana/transactions`, `@grana/supabase`, `@grana/validation`, `@grana/money-logic`, `@grana/ui-contracts`, `@grana/ui-tokens`.
- [x] 2.6 `pnpm-workspace.yaml` declara los globs `apps/*` y `packages/*`, que es lo que la spec nombra como fuente de verdad.
- [x] 2.7 `npx --yes @fission-ai/openspec@1.7.0 validate refresh-monorepo-layout --strict` pasa con exit code 0.

## 3. Archivado (en la branch, antes del merge a `main`)

- [x] 3.1 Aplicar el delta al spec maestro de `repo-architecture`, sin dejar secciones `## ADDED/MODIFIED/REMOVED/RENAMED`.
- [x] 3.2 Confirmar que `repo-architecture` sigue con 3 requirements.
- [x] 3.3 Confirmar que no queda ninguna afirmación de "app futura" ni el inventario de 4 paquetes en el spec maestro.
- [x] 3.4 Mover la carpeta a `openspec/changes/archive/YYYY-MM-DD-refresh-monorepo-layout/`.
- [x] 3.5 `pnpm openspec:check` pasa. Correrlo de verdad y ver el exit code.
- [x] 3.6 `npx --yes @fission-ai/openspec@1.7.0 validate --specs --strict` pasa sobre los specs maestros sincronizados.
- [x] 3.7 Confirmar en el PR que el job `OpenSpec validation` de CI pasa (gate bloqueante desde que el ruleset de `main` lo exige).

## 4. Seguimiento

- [x] 4.1 Marcar la deuda 2 como saldada en `openspec/changes/archive/2026-08-02-split-project-conventions/tasks.md`.
- [ ] 4.2 Deuda restante de aquel change, NO tocada acá: la regla de admisión a capabilities meta, y la bimoneda desactualizada en `onboarding` (deuda 1).
