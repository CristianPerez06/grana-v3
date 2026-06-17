## Why

Los usuarios nuevos usan Grana sin guía. Registran un movimiento sin saber qué información importa o qué impacto tiene cada campo. El dashboard muestra números, pero el usuario no entiende "por qué esto importa" en el momento preciso donde está actuando.

La oportunidad: **educación contextual mínima** que aparezca en el momento exacto donde el usuario está haciendo algo real (su primer movimiento), explicando qué importa sin ser invasivo.

No es un onboarding obligatorio. No es un tour. Es: "Hacé lo que viniste a hacer, y Grana te explica en el momento justo por qué cada cosa importa."

## What Changes

- **Modelo DB**: Crear tabla `user_guidance_events` con `seen_at`, `dismissed_at`, `completed_at` (granularidad clara, RLS habilitado)
- **Guidance ID Catalog**: IDs como enum (ej: `first_movement.type`, `first_movement.account`, etc.) — no strings libres
- **Primitivos UI mínimos**: `<InlineGuide>` (hint dismissible debajo de campos) + `<GuideCard>` (sugerencia contextual)
- **Hook**: `useGuidance(guidanceId)` — query estado (seen/dismissed/completed), retorna `isVisible` + `mark()` helper
- **Primer caso real**: Primer movimiento web con exactamente 3 InlineGuides (Tipo, Cuenta, Categoría) — no más, no menos
- **Post-save (opcional)**: Popover breve explicando impacto SOLO si se engancha fácil sin refactoring

**No incluye:** GuidedPopover sistema, mobile hints (esperan flujos equivalentes), copy para tarjetas/cuentas/shared, Analytics.

## Capabilities

### New Capabilities
- `user-guidance`: Sistema base para mostrar hints contextuales en el momento de uso, con persistencia en DB

## Impact

**Database:**
- Nueva tabla `user_guidance_events` (persistencia de hints vistos/dismissed)

**Code (web):**
- Componentes: `InlineGuide`, `GuideCard` (primitivos mínimos)
- Hook: `useGuidance` (lib/guidance/hooks)
- Primer movimiento: Hints inline en formulario (movement-form.tsx)
- Post-save: Popover breve si se integra sin fricción

**i18n:**
- Copy para hints del primer movimiento (es.json + en.json)

**No incluye:**
- GuidedPopover sistema complejo
- Mobile hints (flujos no existen)
- Cuentas/tarjetas/shared guidance
- Tours o discovery flows
