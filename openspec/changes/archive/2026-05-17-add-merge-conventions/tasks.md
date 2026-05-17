## 1. CLAUDE.md — regla de merge

- [x] 1.1 En `CLAUDE.md` sección `## Branching`, después de los bullets actuales sobre prefijos y nombres, agregar bullets nuevos sobre el flujo de merge:
  - Una branch que se mergea a `main` debe tener exactamente 1 commit por encima de `main` (squash local previo si tiene más).
  - El merge se ejecuta SIEMPRE con `git merge --ff-only` (nunca `--no-ff`, nunca `--squash` en el comando de merge).
  - Si `main` se movió mientras trabajabas, rebase primero (`git rebase main`), después merge `--ff-only`.
  - El resultado: `main` tiene historia lineal, 1 commit = 1 feature/fix/chore.
- [x] 1.2 Agregar un mini-ejemplo del flow happy path al final de la sección (3–5 líneas de comandos): squash (si N > 1) → rebase (si main se movió) → checkout main + merge --ff-only.
- [x] 1.3 Confirmar que el resto de `CLAUDE.md` (idioma, otros bullets de branching) sigue intacto.

## 2. Verificación final

- [x] 2.1 Correr `openspec status --change add-merge-conventions` y confirmar `4/4 artifacts complete`.
- [x] 2.2 Correr `openspec instructions specs --change add-merge-conventions --json` y confirmar que el nuevo requirement es detectado.
- [x] 2.3 Releer el snippet en `CLAUDE.md`: tiene los 4 bullets nuevos + ejemplo, en inglés, sin tocar lo que ya estaba.
