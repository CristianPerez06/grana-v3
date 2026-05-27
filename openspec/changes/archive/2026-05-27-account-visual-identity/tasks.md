## 1. Esquema y datos (DB)

- [x] 1.1 Nueva migración en `supabase/migrations/`: `ALTER TABLE accounts ADD COLUMN color_key text, ADD COLUMN icon_key text;` (ambas NULL, sin default, sin backfill) → `0016_accounts_visual_identity.sql`
- [x] 1.2 Migración aplicada en el SQL Editor del proyecto Supabase online ("Success. No rows returned.")
- [x] 1.3 Regenerar `packages/supabase/src/types.ts` — _stopgap_: columnas agregadas a mano (Row/Insert/Update); pendiente regen real con `supabase gen types` tras aplicar 1.2

## 2. Design tokens (paleta de cuentas)

- [x] 2.1 Definir los hexes de la paleta `--account-*` (8 colores: slate/indigo/violet/plum/magenta/teal/cyan/clay), lejos de `emerald`/`terracotta`/`error` (OQ2)
- [x] 2.2 Agregar los CSS vars `--account-<key>` a `packages/ui-tokens/src/theme.css` (`:root` + utilidades en `@theme inline`)
- [x] 2.3 Exportar desde `ui-tokens` el mapa key→valor para mobile (codegen regenera `tokens.cjs` con los `account-*`)

## 3. Contracts + resolver puro (ui-contracts)

- [x] 3.1 Definir los string unions `AccountColorKey` y `AccountIconKey` (+ arrays canónicos `ACCOUNT_COLOR_KEYS`/`ACCOUNT_ICON_KEYS`)
- [x] 3.2 Definir `AccountAvatarProps` (`= ResolvedAccountAvatar & { size?, className? }`, con `colorKey`/`colorOverride`/`iconKey`/`monogram`)
- [x] 3.3 Implementar el resolver puro `resolveAccountAvatar(account, institution?)`: override explícito > herencia viva de institución (bank) > color determinístico `hash(id)` + `wallet` (cash)
- [x] 3.4 Tests unitarios del resolver (10 tests): herencia bank, override fijo, determinismo del hash, spread, key inválida ignorada, monograma
- [x] 3.5 Test de sincronización: cada `AccountColorKey` tiene su `--account-<key>` en `theme.css`

## 4. Validación

- [x] 4.1 Extender `createAccountSchema` y `updateAccountSchema` con `color_key`/`icon_key` opcionales, validados contra el registry (`.oneOf`)
- [x] 4.2 Tests (7 tests): key fuera del registry rechazada; ausencia/null válidos (NULL = auto)

## 5. Web — datos y componente AccountAvatar

- [x] 5.1 Ampliar `AccountWithBalances` y las queries de `lib/accounts/queries.ts`: `Account` gana `color_key`/`icon_key`, y ambas queries resuelven `avatar` server-side con `resolveAccountAvatar` (OQ1 resuelto: server-side)
- [x] 5.2 Implementar `AccountAvatar` web (`components/ui/account-avatar.tsx`) con `lucide-react`: `iconKey → componente`, color por `style` (`var(--account-<key>)` o `colorOverride`), monograma como fallback, tamaños sm/md
- [x] 5.3 Story de Storybook para `AccountAvatar` (con ícono, monograma, override de institución, todos los colores, todos los íconos)

## 6. Web — render del avatar

- [x] 6.1 `account-row.tsx`: avatar (sm) antes del nombre; badge de texto del banco → nombre de institución como subtítulo muted
- [x] 6.2 `account-detail-header.tsx`: avatar (md) junto al título
- [x] 6.3 Hero del dashboard: avatar en el breakdown por cuenta (threaded por `packages/dashboard`: `HeroAccountBalance.avatar`)
- [~] 6.4 ~~Pickers de cuenta~~ — **DIFERIDO a follow-up**: el picker es un `<select>` nativo (no renderiza avatares); requiere dropdown custom. Spec/proposal/design actualizados para excluirlo de este change

## 7. Web — alta y edición

- [x] 7.1 `account-avatar-picker.tsx`: swatches de color + grilla de íconos + opción "auto", con preview en vivo del `AccountAvatar`
- [x] 7.2 Integrado en `create-account-form.tsx` (preview auto/heredado) y `edit-account-form.tsx` (inicializa desde `color_key`/`icon_key` guardados)
- [x] 7.3 `createAccount` inserta `color_key`/`icon_key`; `updateAccount` distingue undefined (no cambiar) de null (volver a auto)
- [x] 7.4 i18n labels `accounts.labels.{appearance,color,icon,avatar_auto}` en en.json + es.json

## 8. Mobile — componente AccountAvatar

- [x] 8.1 OQ3 resuelto: mobile ya tiene `lucide-react-native@1.16.0` (misma versión que web → paridad de nombres) + `react-native-svg`; el set completo está disponible
- [x] 8.2 `apps/mobile/components/ui/AccountAvatar.tsx` consumiendo `AccountAvatarProps`; colores vía mirror `accountColors` en `lib/colors.ts`

## 9. Limpieza y verificación

- [x] 9.1 Drift A code-side confirmado: la página de cuentas ya renderiza solo cash+bank; el campo `credit` de `getAccounts` NO es código muerto (lo consume `transactions/new` para el picker de Gasto). El drift era solo del spec (ya corregido)
- [x] 9.2 `pnpm lint` (0 errores; 5 warnings pre-existentes) + `pnpm build` (web) en verde; 209 tests verdes
- [x] 9.3 Smoke manual OK: lista con avatares, detalle, alta con selector, banco heredando color + override
- [x] 9.4 Gate de specs verde (replicado en bash: sin placeholders TBD reales). Nota: `pnpm openspec:check` no corre en cmd de Windows (one-liner bash); CI lo corre en bash
