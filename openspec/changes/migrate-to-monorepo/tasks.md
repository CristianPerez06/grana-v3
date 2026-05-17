## 1. Setup raíz del workspace

- [x] 1.1 Ampliar `pnpm-workspace.yaml` para incluir `packages: ['apps/*', 'packages/*']` además del `allowBuilds` existente.
- [x] 1.2 Crear `package.json` raíz (`private: true`, `name: "grana-v3"`) con scripts orquestadores: `dev`, `build`, `lint`, `storybook` (todos via `pnpm --filter web ...`).
- [x] 1.3 Mover los campos `engines` y `packageManager` al `package.json` raíz si aplica, junto con dev tooling cross-app.
- [x] 1.4 Crear `tsconfig.base.json` raíz con `paths` mapeando `@grana/<name>` a `packages/<name>/src/index.ts` (TS paths a fuente directa, sin build step por paquete — ver design.md, Decisión 7). Documentar la elección en CLAUDE.md.

## 2. Mudanza de web a apps/web/

- [x] 2.1 Crear `apps/web/` con `git mv` de: `app/`, `components/`, `lib/`, `middleware.ts`, `next.config.ts`, `next-env.d.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `.storybook/`, `public/`.
- [x] 2.2 Crear `apps/web/package.json` con todas las deps actuales de Next, scripts (`dev`, `build`, `start`, `lint`, `storybook`, `build-storybook`), y `name: "web"`.
- [x] 2.3 Eliminar el `package.json` de la raíz que era el de Next (ya reemplazado por el orquestador en 1.2).
- [x] 2.4 Ajustar `apps/web/tsconfig.json` para que `paths` `@/*` resuelva a `./` (relativo a `apps/web/`), y para que extienda `../../tsconfig.base.json`.
- [x] 2.5 Ajustar `apps/web/.storybook/main.ts` (o equivalente) si referencia paths que cambiaron con la mudanza.
- [x] 2.6 Verificar: `pnpm install` desde la raíz no falla.
- [x] 2.7 Verificar: `pnpm --filter web build` cierra sin errores.
- [x] 2.8 Verificar: `pnpm --filter web lint` cierra sin errores.
- [x] 2.9 Verificar: `pnpm --filter web dev` levanta el server y `/`, `/login`, `/signup`, `/dashboard` cargan en el browser.
- [x] 2.10 Verificar: `pnpm --filter web storybook` levanta Storybook y al menos un story renderiza.

## 3. Extracción de @grana/validation

- [x] 3.1 Crear `packages/validation/` con `package.json` (`name: "@grana/validation"`, `main: "./src/index.ts"`, deps: `yup`).
- [x] 3.2 Mover `apps/web/lib/validation/auth.ts`, `setup-yup-locale.tsx`, `translate-error.ts`, `validate-action-input.ts` a `packages/validation/src/`.
- [x] 3.3 Crear `packages/validation/src/index.ts` que re-exporte los símbolos públicos.
- [x] 3.4 Decidir qué piezas son verdaderamente cross-platform vs específicas de web. Si `setup-yup-locale.tsx` o `validate-action-input.ts` dependen de Next/React server-side, dejarlas en `apps/web/lib/` y mover solo los schemas puros y helpers agnósticos.
- [x] 3.5 Agregar `@grana/validation: workspace:*` a `apps/web/package.json`.
- [x] 3.6 Agregar `@grana/validation` al `transpilePackages` de `apps/web/next.config.ts`.
- [x] 3.7 Reemplazar imports en `apps/web/` de `@/lib/validation/...` por `@grana/validation` donde corresponda.
- [x] 3.8 Verificar: `pnpm --filter web build` y `pnpm --filter web lint` siguen pasando.

## 4. Extracción de @grana/i18n-messages

- [x] 4.1 Crear `packages/i18n-messages/` con `package.json` (`name: "@grana/i18n-messages"`, sin deps de runtime).
- [x] 4.2 Mover los JSON de `apps/web/lib/i18n/messages/*.json` a `packages/i18n-messages/src/`.
- [x] 4.3 Crear `packages/i18n-messages/src/index.ts` que exporte los catálogos tipados (`import es from './es.json'; export { es, en, ... }`).
- [x] 4.4 Mantener `apps/web/lib/i18n/{config,request}.ts` como está — el runtime `next-intl` se queda en web.
- [x] 4.5 Ajustar `apps/web/lib/i18n/request.ts` (o equivalente) para cargar los mensajes desde `@grana/i18n-messages`.
- [x] 4.6 Agregar `@grana/i18n-messages: workspace:*` a `apps/web/package.json`.
- [x] 4.7 Agregar `@grana/i18n-messages` al `transpilePackages` de `apps/web/next.config.ts`.
- [x] 4.8 Verificar: la app web sigue cargando mensajes en ES y EN, y el switcher funciona.

## 5. Extracción de @grana/supabase

- [x] 5.1 Crear `packages/supabase/` con `package.json` (`name: "@grana/supabase"`, deps: `@supabase/supabase-js`).
- [x] 5.2 Crear `packages/supabase/src/client.ts` con un factory que reciba `url`, `anonKey`, y un `storageAdapter` opcional. Devuelve un `SupabaseClient<Database>` tipado.
- [x] 5.3 Crear `packages/supabase/src/types.ts` con un placeholder `export type Database = { /* generated */ }` — slot para los tipos generados que vendrán en un follow-up.
- [x] 5.4 Crear `packages/supabase/src/index.ts` que re-exporte `createClient` (factory) y `Database`.
- [x] 5.5 Reemplazar `apps/web/lib/supabase/client.ts` para que use `createClient` de `@grana/supabase` con el adapter de cookies de `@supabase/ssr`. Mantener la interfaz pública (`createClient()` que devuelve el mismo tipo).
- [x] 5.6 Reemplazar `apps/web/lib/supabase/server.ts` análogamente (server-side con cookies de Next).
- [x] 5.7 Dejar `apps/web/lib/supabase/middleware.ts` y `errors.ts` como están — son Next-specific.
- [x] 5.8 Agregar `@grana/supabase: workspace:*` a `apps/web/package.json`.
- [x] 5.9 Agregar `@grana/supabase` al `transpilePackages` de `apps/web/next.config.ts`.
- [x] 5.10 Verificar: login, signup, logout, forgot-password, reset-password siguen funcionando end-to-end en web.

## 6. Extracción de @grana/ui-tokens

- [x] 6.1 Crear `packages/ui-tokens/` con `package.json` (`name: "@grana/ui-tokens"`, sin deps de runtime).
- [x] 6.2 Extraer del `apps/web/tailwind.config` (o donde estén hoy) los tokens: colors, spacing, typography, dark mode config. ~~Escribirlos en `packages/ui-tokens/src/index.ts` como objetos TS exportados.~~ **Deviation**: Tailwind v4 has no `tailwind.config`; tokens were CSS-first in `app/globals.css`. Extracted as `packages/ui-tokens/src/theme.css` (the `:root`, `.dark`, and `@theme inline` blocks). TS mirror deferred until a real second consumer (mobile) exists, then derive via codegen to avoid manual drift.
- [x] 6.3 ~~Ajustar `apps/web/tailwind.config` para importar y splat los tokens desde `@grana/ui-tokens`.~~ **Deviation**: replaced with `@import "@grana/ui-tokens/theme.css"` in `apps/web/app/globals.css`. Package is the single source of truth for web; verified the tokens (`--background`, `--destructive`, etc., both light and dark) compile into the production CSS bundle.
- [x] 6.4 Agregar `@grana/ui-tokens: workspace:*` a `apps/web/package.json`.
- [x] 6.5 Verificar: web mantiene su look-and-feel exacto, dark mode incluido (chequear visualmente login, signup, dashboard en ambos modos).

## 7. Documentación y CLAUDE.md

- [x] 7.1 Actualizar `CLAUDE.md`: nuevo layout del repo (apps/web, packages/), regla de qué va en cada lugar, comandos para web (`pnpm --filter web dev`, `build`, `lint`, `storybook`). Nota explícita: `apps/mobile/` se documenta cuando se haga el scaffold mobile en un change separado.
- [x] 7.2 Actualizar `CLAUDE.md`: agregar la nueva convención de specs cross-platform (tag de plataforma en scenarios, prefijo `web-`/`mobile-` en capabilities platform-only). Brief, con link al `project-conventions` spec.
- [x] 7.3 Actualizar `CLAUDE.md`: documentar la decisión de TS paths (paths a fuente directa, `transpilePackages` en next.config).
- [x] 7.4 Actualizar `README.md`: instrucciones de setup actualizadas (`pnpm install` desde la raíz, `pnpm --filter web dev` para web).
- [x] 7.5 Actualizar `README.md`: nota explícita sobre cambiar "Root Directory" → `apps/web` en Vercel antes de deployar el merge.

## 8. Vercel y merge

- [ ] 8.1 (Humano, antes del push) En el dashboard de Vercel, cambiar "Root Directory" del proyecto a `apps/web`. Verificar que las env vars del proyecto siguen presentes.
- [x] 8.2 Verificar checklist completo en local: `pnpm install`, `pnpm --filter web build`, `pnpm --filter web lint`, `pnpm --filter web storybook`, `pnpm --filter web dev` con los flujos clave funcionando (login, signup, logout, switcher de idioma, dark mode).
- [ ] 8.3 Squash de todos los commits de la branch en uno solo (`git rebase -i main` con fixups, o `git reset --soft main && git commit`). Mensaje: `feat(repo): migrate to pnpm monorepo with apps/web and shared packages`.
- [ ] 8.4 (Humano) Fast-forward merge a main: `git checkout main && git merge --ff-only feature/migrate-to-monorepo && git push origin main`.
- [ ] 8.5 (Humano) Verificar que el deploy de Vercel post-merge cierra verde. Si no, revertir el commit en main y revertir el cambio de Root Directory.

## 9. Cierre del change

- [ ] 9.1 Ejecutar `openspec validate migrate-to-monorepo --strict` y confirmar que pasa.
- [ ] 9.2 Archivar el change con `openspec archive migrate-to-monorepo` una vez deployado y estable.
