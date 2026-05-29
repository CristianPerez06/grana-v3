## Context

The `feature/quick-add-fab-redesign` branch already implements the desired behavior. This change is a backwards realignment: bringing `openspec/specs/dashboard/spec.md` and `openspec/specs/transactions/spec.md` in line with the code that's about to merge. No architectural decisions remain to be made — they were made implicitly as the code was written and approved iteratively in conversation.

This document exists because the spec-driven schema requires it; the content is therefore short by design.

## Goals / Non-Goals

**Goals:**
- Update existing requirements so the spec text matches the as-shipped behavior on `feature/quick-add-fab-redesign`.
- Preserve every requirement scenario that still applies (loading states, ARIA labels, i18n catalog usage, anon fallback, etc.) and add scenarios for the new viewport-conditional behavior.
- Add a native-app requirement for the disabled FAB so the spec captures *intent* (route pending) not just the visual.

**Non-Goals:**
- Changing any code. The implementation is frozen on `feature/quick-add-fab-redesign` commit `67c99d4`.
- Designing the eventual `/transactions/new` mobile screen — that's a separate change. This proposal only specifies the FAB's disabled-pending-route state.
- Re-styling, re-positioning, or re-sizing the FAB further. Pixel values are locked to what shipped.

## Decisions

### Decision 1: Use MODIFIED, not REMOVED + ADDED, for the dashboard CTA requirement

The "El header del dashboard ofrece un acceso primario para registrar un movimiento (web)" requirement is being narrowed (web → desktop-web), not deleted. Its core intent — *the header is a primary access point on web* — still holds for the desktop viewport, and all of its existing loading-state behavior carries over to that viewport. MODIFIED preserves the scenario set verbatim and adds new ones; REMOVED + ADDED would lose the loading-state contract.

**Alternative considered:** Split into two requirements, one per viewport. Rejected because the loading-state behavior is identical across viewports, just the *rendering surface* differs — duplicating the disabled-state contract across two requirements invites drift.

### Decision 2: The FAB requirement in `transactions/spec.md` becomes web-scoped, with a separate ADDED requirement for native

The current FAB requirement is platform-agnostic ("el sistema SHALL ofrecer un acceso rápido flotante"). Splitting it makes the viewport/platform conditions explicit and lets the native variant carry its own disabled-pending-route scenario without polluting the web requirement.

**Alternative considered:** One unified requirement with web vs. native sub-clauses. Rejected because the disabled-route condition is native-specific and would dilute the web requirement's clarity.

### Decision 3: Keep the requirement that the FAB *replaces* the header CTA explicit

The current spec sentence "El FAB convive con los accesos de header existentes; no los reemplaza" is being inverted on mobile-web. The MODIFIED requirement spells out the replacement relationship rather than just deleting the old sentence, because future readers will otherwise wonder why the header CTA isn't there on mobile.

## Risks / Trade-offs

- **[Risk]** The spec change lands separately from the code change, so a reader of `main` between the two merges sees code that disagrees with the spec. → **Mitigation:** Merge the code branch and this spec proposal in the same session; archive the proposal immediately after merging both.
- **[Risk]** The native FAB requirement specifies a disabled state tied to a route that doesn't exist yet — a future implementer might forget to flip `DISABLED = false` when the route ships. → **Mitigation:** The new requirement includes an explicit scenario for the "route ships" transition, and the constant has a TODO-style comment in code pointing to the toggle. The `/transactions/new` mobile screen will be its own change with its own spec delta touching this requirement.
- **[Trade-off]** Adding a native FAB requirement now means the next mobile change that touches this surface has to update both web and native scopes. This is the cost of capturing intent — accepted.
