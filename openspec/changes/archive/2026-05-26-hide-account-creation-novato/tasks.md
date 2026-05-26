## 1. Gating de UI

- [x] 1.1 En `accounts/page.tsx`, leer `profiles.mode` (patrón de `cards/new/page.tsx`) y renderizar el botón "Crear cuenta" solo si `!isNovato`.
- [x] 1.2 Pasar `showCreate={!isNovato}` a `EmptyAccountsState` y ocultar su CTA cuando sea novato.
- [x] 1.3 En `accounts/new/page.tsx`, si el usuario es novato, `redirect('/accounts')`.

## 2. Verificación y cierre

- [x] 2.1 `pnpm --filter web exec tsc --noEmit` (0 errores) y `pnpm --filter web lint` (0 errores).
- [x] 2.2 QA: novato no ve el botón (listado ni empty state) y `/accounts/new` redirige; experto sí ve el botón y puede crear. Probado por el usuario en su cuenta novato.
- [x] 2.3 Archivar el change y aplicar el delta al master spec `openspec/specs/accounts/spec.md`.
