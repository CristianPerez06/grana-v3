## 0. Exploration (este change está PARKED)

Este change vive como exploration mientras `align-settings-headers` no esté en `main`. No tiene tareas ejecutables. Cuando se priorice:

- [ ] 0.1 Confirmar que `align-settings-headers` está mergeado y archivado. Si no, parar.
- [ ] 0.2 Resolver las "Open Questions" del proposal.md con el usuario.
- [ ] 0.3 Decidir si se extrae un primitivo compartido `<EntityCreateButton>` o se duplica el patrón (chequear el feedback `feedback_reusable_components` — wrappers solo si ≥2 rutas justifican la abstracción y con confirmación previa).
- [ ] 0.4 Decidir si la migración a drawer aplica también a `/edit` (no solo a `/new`).
- [ ] 0.5 Convertir las decisiones en specs concretos bajo `specs/` de este change y reescribir esta `tasks.md` con tareas ejecutables.
- [ ] 0.6 Validar con `openspec validate explore-categories-drawer-migration --strict`.

## 1. Implementación

A definirse después de la exploración. Como referencia, mirar las tareas de `2026-06-04-redesign-movement-form-as-drawer` en `openspec/changes/archive/` — patrón análogo (form que existía como page se migra a drawer).
