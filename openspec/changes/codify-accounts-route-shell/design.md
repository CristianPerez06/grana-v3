## Context

`/accounts` (web) ya está refactorizado en `feat/accounts-route-shell` siguiendo el patrón documentado en `.claude/skills/grana-route-shell/SKILL.md`. El mismo patrón ya está codificado para `/cards` en `openspec/specs/cards/spec.md:653` ("El header de /cards SHALL renderizarse desde el primer paint…"). Este change no propone implementación nueva: archiva la decisión que el branch ya tomó, para que el spec sea la única fuente de verdad y un agente fresco pueda mantener la ruta sin perder el contexto.

El refactor en código:

- `app/(app)/accounts/page.tsx` ahora es un shell sync que monta `<AccountsHeader />` + `<AccountsErrorBoundary>` con dos `<Suspense>` (active, archived).
- `_components/accounts-header.tsx` ('use client') carga instituciones vía supabase client, renderiza `PageHeader` y el `CreateAccountButton` con `disabled={institutions == null}`.
- `_components/active-accounts-container.tsx` y `_components/archived-accounts-container.tsx` son async server components con `try/catch` y `SectionFallback` por error. Archivadas devuelve `null` cuando resuelve con cero (sin slot fantasma).
- `lib/accounts/queries.ts` ganó `getCashAndBankAccounts({ archivedOnly? })` para aislar las queries por sección sin compartir un `Promise.all` blocking.
- `SectionFallback` fue promovido a `components/ui/section-fallback.tsx` (compartido entre dashboard, cards y accounts).

## Goals / Non-Goals

**Goals:**
- Codificar el contrato del route shell para `/accounts` con el mismo nivel de detalle que el de cards.
- Clarificar la nueva semántica del estado vacío global (`EmptyAccountsState`) bajo aislamiento por sección.
- Mantener cero divergencia con los requirements visuales existentes (PageHeader, grouping, archived styling, column alignment).

**Non-Goals:**
- No agrega scenarios para mobile (`/accounts` no existe como ruta nativa todavía).
- No documenta `SectionFallback` como primitivo compartido en el spec `route-loading-and-errors` — eso queda para un change aparte (housekeeping).
- No introduce subtítulo en el header (el original no tenía y no estamos cambiando ese contrato).
- No reabre la discusión sobre qué hacer cuando `active=0 && archived>0`; el branch ya tomó la decisión (mostrar `EmptyAccountsState`), este change la codifica.

## Decisions

### Decision 1: Mirror exact, no extracción de patrón abstracto

El requirement nuevo describe `/accounts` específicamente, en paralelo al de `/cards`. **No** se crea un capability nuevo "route-shell" abstracto para compartir entre rutas.

**Por qué:** Cada ruta tiene su propia descomposición de secciones, su propia copy de fallback, sus propios queries. La abstracción sería falsa generalidad — el patrón vive como recipe en el skill `grana-route-shell`, y cada spec codifica su instancia. Es la misma decisión implícita que se tomó cuando cards aterrizó.

**Alternativa considerada:** Crear `route-shell` como capability y referenciarlo desde accounts/cards. **Rechazada** porque los requirements operativos (qué secciones, qué min-h, qué copy) son por-ruta y no se prestan a deduplicación útil.

### Decision 2: `EmptyAccountsState` siempre que `active=0`

El comportamiento previo era: `EmptyAccountsState` se mostraba solo cuando `active=0 && archived=0`. El branch lo simplificó a `active=0` (independiente de archivadas), porque el CTA de crear ahora vive *siempre* en el header — el CTA secundario del empty es redundante y la coupling cross-section rompe el aislamiento.

**Por qué codificarlo en el spec:** un agente fresco vería la nueva conducta como un bug ("¿por qué muestra empty si hay archivadas?"). El spec necesita decir explícitamente que esa es la intención.

**Alternativa considerada:** Restaurar la suppression vía un count de archivadas adentro del active container. **Rechazada** por la misma razón que motivó el cambio: introduce una dependencia cruzada que rompe el aislamiento que el route shell pretende garantizar.

### Decision 3: Scenarios alineados con los de cards (1:1 donde aplica)

Los scenarios del requirement nuevo siguen la misma forma que los del spec de cards (header visible durante loading, error en una sección no tira la ruta, archivada vacía no renderiza nada, etc.), traducidos al vocabulario de cuentas. Esto reduce la carga cognitiva al leer ambos specs en paralelo y deja claro que es el mismo contrato.

## Risks / Trade-offs

**[Riesgo] Drift entre el patrón en cards y en accounts** → Mitigación: ambos requirements se redactan en paralelo y se referencia `cards` desde el skill `grana-route-shell` como origen. Cualquier cambio futuro al patrón debe propagarse a ambos.

**[Trade-off] El requirement no es DRY entre cards y accounts** → Asumido: la duplicación es deliberada (Decision 1). El costo de mantenimiento es bajo porque los requirements cambian poco una vez codificados.

**[Trade-off] El cambio de semántica de `EmptyAccountsState` (Decision 2) es una micro-regresión UX en el caso edge (active=0 con archivadas>0)** → Aceptado y documentado en el scenario correspondiente. Es el costo de tener aislamiento puro.

## Migration Plan

No aplica — el código ya está en `feat/accounts-route-shell`. El change se archiva una vez mergeado el branch, vía `/openspec-archive-change`.

## Open Questions

Ninguna.
