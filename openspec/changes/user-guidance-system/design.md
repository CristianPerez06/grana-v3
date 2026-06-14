## Context

Usuarios nuevos registran movimientos sin entender el impacto. Campos como "tipo" (gasto/ingreso) y "categoría" son opcionales en UI pero críticos para que Grana funcione. No hay momento educativo — el usuario simplemente guarda.

Change 1 propone una infraestructura mínima de educación contextual + un primer caso real: el primer movimiento.

Filosofía: **Small & fundational.** Build the system, validate with first case, expand after.

## Goals / Non-Goals

**Goals:**
- Implementar persistencia de hints (DB table + hook)
- Crear primitivos mínimos (InlineGuide, GuideCard)
- Primer movimiento web: 2-3 hints estratégicos
- Mostrar que hints en contexto bajan fricción (no molestan)

**Non-Goals:**
- Sistema de tours complejos (fuera de scope)
- GuidedPopover (dejaría fuera si post-save es complicado enganchar)
- Mobile hints (esperamos que flujos existan antes)
- Copy final para cuentas/tarjetas/shared (Changes 2-3)
- Analytics de hints (fase siguiente)

## Decisions

**D1: Persistencia en DB (`user_guidance_events`), no localStorage**

*Alternatives:*
- A1: localStorage → Pierde al cambiar dispositivo, no sincroniza web/mobile
- **A2: DB table (elegida)** → Sincroniza, auditable, testeable

*Rationale:* Cuando movamos esto a mobile, queremos que el usuario vea "ya viste este hint" en ambas plataformas.

**D2: Primitivos mínimos en Change 1 (InlineGuide + GuideCard, sin GuidedPopover)**

*Alternatives:*
- A1: Full suite (InlineGuide, GuideCard, GuidedPopover, etc.) → Sobre-engineering, riesgo de complejidad innecesaria
- **A2: Mínimo (InlineGuide + GuideCard) (elegida)** → Validar si hints ayudan primero
- A3: Post-save popover solo si engancha fácil (decisión in-implementation)

*Rationale:* No queremos construir plataforma de guidance gigante antes de ver a un usuario usarlo. Primitivos base: suficientes.

**D3: Primer movimiento web ONLY (mobile espera flujos equivalentes)**

*Alternatives:*
- A1: Web + mobile en parallel → Complejidad innecesaria si mobile flujos no existen aún
- **A2: Web first, mobile después (elegida)**

*Rationale:* Mobile hints no existen si flujos no existen. Mejor esperar a que QuickAddFab esté habilitado y /transactions/new exista.

**D4: Trigger es "usuario sin movimientos" (primer movimiento real), no "ventana temporal"**

*Alternatives:*
- A1: Mostrar hints si `onboarding_completed_at < 7 days` → Detecta "usuario nuevo", no "primer movimiento". Problema: se ocultan si usuario espera días.
- **A2: Mostrar hints si `!hasAnyTransaction` (elegida)** → Detecta primer movimiento real. Persistence: una vez dismissed/completed, no reaparecen (respeta al usuario).

*Rationale:* Los hints son para educación del primer movimiento, no para "usuarios nuevos". Si el usuario no tiene movimientos, debería ver hints. Si ya tiene movimientos (aunque sea antiguo), no.

**D5: 2-3 hints en primer movimiento (no saturar)**

*Alternatives:*
- A1: Hint en cada campo → Pesado, user no lee
- **A2: 2-3 campos clave (Tipo, Cuenta, Categoría) (elegida)**
- A3: Solo 1 hint → Muy poco educativo

*Rationale:* Equilibrio entre educación y fricción. 3 es el máximo antes de "demasiado".

**D5: Copy en español primero (canon), traducción EN después**

*Reason:* Usuario real es hispanohablante. Tono nace ahí.

---

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Hints molestan (no ayudan) | A/B test, iterate. Si fallan, disableamos todo |
| Post-save popover rompe UX del drawer | Implementamos SOLO si engancha sin fricción |
| Mobile querría hints "ya" | Documentamos claramente que Change 2 lo cubre |
| Schema `user_guidance_events` es overhead inicial | Sí, pero escalable después |

---

## Migration Plan

No hay migración de datos. Esta es greenfield:
1. Create tabla `user_guidance_events`
2. Migrate web/mobile cuando existan flujos
3. Rollback: DROP table (reversible)

---

## Implementation Notes

**D6: Guidance ID como catálogo conocido (enum), no strings libres**

*Reason:* Evita IDs garbage imposibles de limpiar después. Catálogo centralizado.

*Catalog en Change 1:*
```
first_movement.type
first_movement.account
first_movement.category
first_movement.saved  (opcional)
```

*Changes 2-3 agregarán:*
```
accounts.discovery
cards.discovery
cards.closure_date
cards.payment_date
cards.limit
shared.discovery
(etc.)
```

**D7: Tabla con granularidad clara (seen_at / dismissed_at / completed_at)**

*Reason:* Diferencia entre "se mostró", "user lo cerró" y "acción completada". Permite lógica nuanced.

*Para inline hints:* Ocultar si `dismissed_at IS NOT NULL` (user lo cerró)

**D8: RLS desde el inicio**

*Reason:* Seguridad by default, evita leak de datos entre usuarios.

## Open Questions

1. **Post-save popover:** Si se implementa, ¿Toast, Modal, o Popover? Validar en implementación. **PERO**: si ensucia mutations, afuera.
2. **Cuando marcar seen_at:** ¿Al mount si es visible en viewport, o al primer interacción? (decisión de UX en implementación)
3. **Analytics:** Fuera de Change 1, pero posible post-launch si queremos iterar.
4. **Mobile sync:** DB lista para mobile, pero UI hints esperan a que flujos existan.
