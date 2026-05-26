## 1. Mobile — renombrar archivos de ruta

- [x] 1.1 `git mv apps/mobile/app/(app)/movimientos.tsx apps/mobile/app/(app)/transactions.tsx`
- [x] 1.2 `git mv apps/mobile/app/(app)/tarjetas.tsx apps/mobile/app/(app)/cards.tsx`
- [x] 1.3 `git mv apps/mobile/app/(onboarding)/saldo-actual.tsx apps/mobile/app/(onboarding)/initial-balance.tsx`
- [x] 1.4 `git mv apps/mobile/app/(onboarding)/perfil.tsx apps/mobile/app/(onboarding)/profile.tsx`

## 2. Mobile — actualizar referencias

- [x] 2.1 Actualizar `apps/mobile/app/(onboarding)/profile.tsx`: `router.replace('/(onboarding)/saldo-actual')` → `router.replace('/(onboarding)/initial-balance')`
- [x] 2.2 Actualizar `apps/mobile/app/(onboarding)/welcome.tsx`: cualquier `router.push('/(onboarding)/perfil')` → `.../profile`
- [x] 2.3 Actualizar `apps/mobile/components/layout/AppMenu.tsx`: type alias `'/tarjetas' | '/(app)/settings'` → `'/cards' | '/(app)/settings'` y todas las llamadas `navigateAndClose('/tarjetas')` → `navigateAndClose('/cards')`
- [x] 2.4 Actualizar `apps/mobile/components/dashboard/CreditCardItem.tsx`, `CardsSection.tsx`, `UpcomingFortnightSection.tsx`: `router.push('/tarjetas')` → `router.push('/cards')` y comentarios asociados
- [x] 2.5 Revisar `apps/mobile/app/(app)/_layout.tsx` (Tabs): `<Tabs.Screen name="movimientos">` → `name="transactions"`; `<Tabs.Screen name="tarjetas">` (si existe) → `name="cards"` (también `TabBar.tsx` SLOT_CONFIG y class names del componente Pressable)
- [x] 2.6 Revisar `apps/mobile/app/(onboarding)/_layout.tsx` (Stack): no enumera Stack.Screen — Expo Router auto-discovers desde filesystem, los renames de archivo bastan
- [x] 2.7 Grep `apps/mobile/` por `'/tarjetas\|/movimientos\|saldo-actual\|/perfil'` y reemplazar el resto de las ocurrencias residuales (strings literales en tests, helpers, comentarios)

## 3. Web — renombrar archivos de ruta y componentes

- [x] 3.1 `git mv apps/web/app/(onboarding-wizard)/onboarding/saldo-actual apps/web/app/(onboarding-wizard)/onboarding/initial-balance`
- [x] 3.2 `git mv apps/web/app/(onboarding-wizard)/onboarding/perfil apps/web/app/(onboarding-wizard)/onboarding/profile`
- [x] 3.3 `git mv apps/web/app/(onboarding-wizard)/onboarding/initial-balance/_components/saldo-actual-form.tsx apps/web/app/(onboarding-wizard)/onboarding/initial-balance/_components/initial-balance-form.tsx`
- [x] 3.4 `git mv apps/web/app/(onboarding-wizard)/onboarding/profile/_components/perfil-form.tsx apps/web/app/(onboarding-wizard)/onboarding/profile/_components/profile-form.tsx`

## 4. Web — actualizar referencias

- [x] 4.1 En `apps/web/app/(onboarding-wizard)/onboarding/initial-balance/page.tsx`: cambiar `import { SaldoActualForm } from './_components/saldo-actual-form'` a `import { InitialBalanceForm } from './_components/initial-balance-form'` y renombrar el export del componente en el archivo movido (`SaldoActualForm` → `InitialBalanceForm`).
- [x] 4.2 En `apps/web/app/(onboarding-wizard)/onboarding/profile/page.tsx`: idem para `PerfilForm` → `ProfileForm` y su import.
- [x] 4.3 Actualizar `apps/web/app/(onboarding-wizard)/onboarding/welcome/page.tsx`: `<Link href="/onboarding/perfil">` → `<Link href="/onboarding/profile">`.
- [x] 4.4 Actualizar `apps/web/app/(onboarding-wizard)/onboarding/profile/_components/profile-form.tsx`: `router.push('/onboarding/saldo-actual')` → `router.push('/onboarding/initial-balance')`.
- [x] 4.5 Actualizar `apps/web/app/(onboarding-wizard)/onboarding/done/page.tsx`: comentario `// declared in /saldo-actual.` → `// declared in /initial-balance.`.
- [x] 4.6 Grep `apps/web/` por `'/saldo-actual\|/onboarding/perfil\|saldo-actual-form\|perfil-form\|SaldoActualForm\|PerfilForm'` y reemplazar las ocurrencias residuales (tests, helpers, etc.).

## 5. i18n — renombrar keys en español

- [x] 5.1 En `packages/i18n-messages/src/es.json` y `packages/i18n-messages/src/en.json`: renombrar la key del namespace `onboarding.perfil` → `onboarding.profile` (preservando todos los valores de copy tal cual están).
- [x] 5.2 En los mismos catálogos: renombrar `onboarding.saldoActual` → `onboarding.initialBalance`.
- [x] 5.3 Buscar consumidores: `grep -rn "onboarding\\.perfil\\|onboarding\\.saldoActual\\|useTranslations('onboarding\\.perfil')\\|useTranslations('onboarding\\.saldoActual')\\|t('onboarding\\.perfil\\|t('onboarding\\.saldoActual" apps/ packages/` y actualizar a las nuevas keys.

## 5b. Identifiers de validación (descubierto durante implementación)

- [x] 5b.1 En `packages/validation/src/onboarding.ts`: renombrar `perfilSchema` → `profileSchema`, `saldoActualSchema` → `initialBalanceSchema`, `PerfilInput` → `ProfileInput`, `SaldoActualInput` → `InitialBalanceInput`.
- [x] 5b.2 En `packages/validation/src/index.ts`: actualizar los re-exports.
- [x] 5b.3 Actualizar consumidores: `apps/web/app/_actions/onboarding.ts`, `apps/web/app/(onboarding-wizard)/onboarding/initial-balance/_components/initial-balance-form.tsx`, `apps/web/app/(onboarding-wizard)/onboarding/profile/_components/profile-form.tsx`, `apps/web/lib/__tests__/onboarding-schemas.test.ts` (incluyendo `describe('perfilSchema', ...)` → `describe('profileSchema', ...)`), `apps/mobile/app/(onboarding)/profile.tsx`.

## 6. Verificación

- [x] 6.1 `pnpm --filter web lint` pasa (0 errors, 5 warnings preexistentes ajenas al rename).
- [x] 6.2 `pnpm --filter web build` pasa (rutas listadas: `/onboarding/initial-balance`, `/onboarding/profile`).
- [x] 6.3 `pnpm --filter mobile typecheck` (vía `tsc --noEmit`) pasa.
- [ ] 6.4 Smoke manual en web: `/onboarding/welcome` → `/onboarding/profile` → `/onboarding/initial-balance` → `/onboarding/done` funciona end-to-end. **PENDING — manual user verification**
- [ ] 6.5 Smoke manual en mobile: wizard de onboarding completo + abrir `AppMenu` → "Tarjetas" navega a `/cards` + tab "Movimientos" abre `/transactions`. **PENDING — manual user verification**
- [x] 6.6 Grep final por residuos: `grep -rn 'saldo-actual\\|/onboarding/perfil\\|/movimientos\\|/tarjetas\\|saldoActual\\|onboarding\\.perfil' apps/ packages/ --include="*.ts" --include="*.tsx" --include="*.json"` retorna vacío.

## 7. Archivado y merge

- [x] 7.1 Mover la carpeta a `openspec/changes/archive/2026-05-25-rename-spanish-routes-to-english/`.
- [x] 7.2 Integrar los deltas de `project-conventions`, `onboarding` y `mobile-app-shell` en los respectivos `openspec/specs/<capability>/spec.md` (aplicar el MODIFIED y eliminar las secciones de deltas en el master).
- [x] 7.3 Actualizar el `Purpose` de `openspec/specs/onboarding/spec.md` reemplazando `welcome, perfil, saldo-actual, done` por `welcome, profile, initial-balance, done`.
- [x] 7.4 `pnpm openspec:check` pasa.
- [ ] 7.5 `git rebase main` si `main` se movió; squash a un solo commit; `git merge --ff-only` a `main`.
