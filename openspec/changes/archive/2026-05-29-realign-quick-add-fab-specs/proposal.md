## Why

The `feature/quick-add-fab-redesign` branch (commit `67c99d4`) shipped a visible behavior change: on mobile-web the header "Nuevo movimiento" CTA disappears and a square green FAB takes over as the only entry point, and the native app gains an equivalent (disabled) FAB on the dashboard and transactions screens. The current specs still describe the previous behavior — the dashboard requirement says the header CTA is always present on web, and the transactions requirement explicitly says **"El FAB convive con los accesos de header existentes; no los reemplaza"**, which is now false on mobile-web. Specs need to catch up before this gets archived, otherwise the next reader (human or fresh AI) will trust the wrong contract.

## What Changes

- Header CTA "Nuevo movimiento" on web becomes **desktop-only** (sm+). Mobile-web shows only the eye toggle in the header.
- Transactions FAB on web becomes **mobile-only** (sm:hidden), bottom-right (`bottom-10 right-10`), 64px square (`rounded-2xl`), `bg-success`. On mobile-web it **replaces** the header CTA rather than coexisting with it.
- Native app gains a mobile FAB on dashboard and transactions screens: 80px square `rounded-2xl` `bg-emerald`, bottom-right (`bottom-10 right-10`), **disabled** until the `/transactions/new` screen exists.
- Header-state copy that references "controls" plural (eye + Nuevo movimiento) must clarify that on mobile-web only the eye toggle lives in the header.

No code changes — this proposal updates spec text only. The implementation already exists on `feature/quick-add-fab-redesign`.

## Capabilities

### New Capabilities

<!-- None: both affected capabilities already exist. -->

### Modified Capabilities

- `dashboard`: header CTA "Nuevo movimiento" requirement gains a desktop-only qualifier; loading-state scenarios that reference both controls get a mobile-web variant where only the eye toggle is in the header.
- `transactions`: FAB requirement loses the "convive con los accesos de header" sentence and gains viewport scoping (mobile-web only on web; replaces the header CTA on mobile). New requirement for the native-app FAB and its disabled-pending-route state.

## Impact

- **Specs only**: `openspec/specs/dashboard/spec.md` and `openspec/specs/transactions/spec.md`.
- **No code, no migrations, no API surface.** The code on `feature/quick-add-fab-redesign` is the source of truth this proposal aligns the specs to.
- **No downstream specs** reference these requirements transitively (verified by search for "FAB", "Nuevo movimiento", "register_movement" across `openspec/specs/`).
