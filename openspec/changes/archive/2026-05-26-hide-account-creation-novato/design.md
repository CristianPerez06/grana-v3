## Context

El modo de usuario (`profiles.mode`, `'novato' | 'experto'`) es un flag **solo de UI**: el server no enforcea modo (`CLAUDE.md`). Ya existe un patrón para leer el modo en una página server: `apps/web/app/(app)/cards/new/page.tsx` hace `supabase.from('profiles').select('mode').eq('id', user.id).single()` → `isNovato = profile?.mode === 'novato'`.

Hoy la creación de cuentas está disponible para todos: el botón vive en el header de `accounts/page.tsx` y en `empty-accounts-state.tsx`, y la ruta `/accounts/new` no valida modo.

## Goals / Non-Goals

**Goals:**
- Que en modo novato no exista el camino para crear cuentas (botón oculto + ruta redirigida).
- Reusar el patrón de lectura de modo existente; cambios mínimos y contenidos a `accounts`.

**Non-Goals:**
- Tocar el server action de creación (el modo es solo-UI).
- El nudge para sugerir pasar a experto y la ubicación del cambio de modo en el menú (pieza futura).
- Cambios en mobile.

## Decisions

- **D1 — Leer el modo server-side** en `accounts/page.tsx` y `accounts/new/page.tsx` con el mismo query que `cards/new/page.tsx`.
- **D2 — Ocultar el botón**: en `accounts/page.tsx`, renderizar la acción "Crear cuenta" solo si `!isNovato`. Pasar `showCreate={!isNovato}` (o equivalente) a `EmptyAccountsState` para ocultar también su CTA.
- **D3 — Guard de ruta**: en `accounts/new/page.tsx`, si `isNovato`, `redirect('/accounts')` (defensa ante URL directa, capa de UI/routing — no toca el server action).

## Risks / Trade-offs

- **[Un novato en estado vacío vería "no hay cuentas" sin CTA]** → En la práctica el onboarding provisiona la `Billetera`, así que el novato no debería llegar al empty state. Aun así se oculta el CTA por consistencia.
- **[Gating solo de UI, no de servidor]** → Intencional y consistente con `CLAUDE.md`; el botón oculto + redirect cubren los caminos de UI. No se agrega enforcement de modo al server action.
