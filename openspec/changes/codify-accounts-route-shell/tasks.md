## 1. Verificación de paridad código ↔ spec

> El código ya vive en `feat/accounts-route-shell`. Estas tareas confirman que cada scenario del spec se cumple en el branch antes de mergear.

- [ ] 1.1 Verificar que `apps/web/app/(app)/accounts/page.tsx` es un shell sync con `AccountsHeader` + `AccountsErrorBoundary` envolviendo dos `<Suspense>` (active, archived).
- [ ] 1.2 Verificar que `AccountsHeader` ('use client') ejecuta su propia query de `institutions` vía Supabase browser client y renderiza el botón con `disabled={institutions == null}`.
- [ ] 1.3 Verificar que `ActiveAccountsContainer` envuelve `getCashAndBankAccounts()` en `try/catch` y devuelve `<SectionFallback message={t('active_error')} className="min-h-[14rem]" />` en error.
- [ ] 1.4 Verificar que `ArchivedAccountsContainer` envuelve `getCashAndBankAccounts({ archivedOnly: true })` en `try/catch`, devuelve `null` cuando resuelve con cero, y `<SectionFallback>` con `min-h-[3rem]` en error.
- [ ] 1.5 Verificar que `AccountsErrorBoundary` es un Client Component con `getDerivedStateFromError` que renderiza `<RouteError>` y expone `onRetry` que resetea su state.
- [ ] 1.6 Verificar que `ActiveAccountsContainer` renderiza `<EmptyAccountsState />` cuando `cash.length + bank.length === 0` (independientemente del estado de archivadas) y `<AccountsHint />` cuando total === 1.
- [ ] 1.7 Verificar que los `<Suspense>` fallback usan `<SectionFallback>` desde `@/components/ui/section-fallback` con los mensajes `t('accounts.route.active_loading')` y `t('accounts.route.archived_loading')` y las `min-h-[Xrem]` indicadas en el spec.

## 2. Verificación de comportamiento (dev smoke)

- [ ] 2.1 Levantar el dev server, navegar a `/accounts` autenticado, y confirmar que el header aparece antes que el contenido (throttle de red opcional para acentuar).
- [ ] 2.2 Inducir un fallo en la query de instituciones (ej. bloqueando temporalmente el endpoint) y confirmar que el botón "+ Crear cuenta" queda disabled mientras el cuerpo carga normalmente.
- [ ] 2.3 Inducir un throw en `ActiveAccountsContainer` (ej. throw en `getCashAndBankAccounts`) y confirmar que el área activa muestra `<SectionFallback>` de error, el header sigue visible y la sección de archivadas se renderiza normalmente.
- [ ] 2.4 Inducir un throw en un componente presentacional (fuera del `try/catch` del container) y confirmar que `AccountsErrorBoundary` captura, muestra `<RouteError>` y el botón Reintentar resetea el render.
- [ ] 2.5 Probar el caso `active=0 && archived>0`: confirmar que `<EmptyAccountsState />` se muestra arriba de la sección de archivadas.
- [ ] 2.6 Probar el caso `active=1`: confirmar que `<AccountsHint />` aparece y se puede dismiss (one-shot localStorage).

## 3. Cierre del change

- [ ] 3.1 Mergear `feat/accounts-route-shell` a `main` (la lo hace el usuario, no Claude).
- [ ] 3.2 Una vez en `main`, archivar el change con `/openspec-archive-change codify-accounts-route-shell` para que el delta aterrice en `openspec/specs/accounts/spec.md` y la carpeta se mueva a `openspec/changes/archive/`.
