## 1. Validación

- [x] 1.1 `openspec validate sync-transactions-spec-drift --strict` clean.

## 2. Archive (aplica los deltas a la spec viva)

- [x] 2.1 `openspec archive sync-transactions-spec-drift` aplicó `+1 added` y `-1 removed` a `openspec/specs/transactions/spec.md` y movió el change folder a `openspec/changes/archive/2026-06-05-sync-transactions-spec-drift/`.

## 3. Verificación post-archive

- [x] 3.1 `openspec validate --specs` clean (20/20).
- [x] 3.2 `grep -n "Guardar y cargar otro\|+ Otro\|add_another" openspec/specs/transactions/spec.md` — la requirement removida está fuera, **y** además se limpió un residuo descubierto durante la verificación: la requirement "El drawer en modo edición ajusta chrome y CTA" mencionaba que el botón "+ Otro" SHALL ocultarse en modo edición. Como el botón no existe en ningún modo, esa cláusula es dead language; se removió de la requirement y del scenario "CTA y '+ Otro' en edición" (renombrado a "CTA en edición"). Edit hecho directo sobre `openspec/specs/transactions/spec.md` y commiteado con el archive.
- [x] 3.3 `grep -n "Saldo inicial" openspec/specs/transactions/spec.md` ubica la requirement nueva en el contexto del listado scoped a cuenta (línea ~2721).
