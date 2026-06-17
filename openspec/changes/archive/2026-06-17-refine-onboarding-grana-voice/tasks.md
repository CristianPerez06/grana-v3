# Tasks: refine-onboarding-grana-voice

## 0. Limpieza previa

- [x] 0.1 Borrar el change vacío `openspec/changes/guided-onboarding-welcome/` (placeholder sin artefactos, cruft)

## 1. Update i18n Messages

- [x] 1.1 Actualizar `packages/i18n-messages/src/es.json`: reescribir copy de `onboarding.welcome`, `onboarding.initialBalance`, `onboarding.done` (incluye copy del fork: encabezado "Tu Grana, tu decisión", 2 cards con etiqueta, 2 confirmaciones, escape "Mejor lo veo después")
- [x] 1.2 Traducir copy nuevo a `packages/i18n-messages/src/en.json` (mantener tono Grana en EN)
- [x] 1.3 Verificar que no hay regresiones en otros keys de onboarding (ej: error messages) — bloque `errors` intacto

## 2. Refactor Web Onboarding

- [x] 2.1 Actualizar `apps/web/app/(onboarding-wizard)/onboarding/welcome/page.tsx`: implementar copy + saludo personalizado — copy vía i18n; el saludo condicional con `firstName` ya existía
- [x] 2.2 Actualizar form en `apps/web/app/(onboarding-wizard)/onboarding/initial-balance/_components/initial-balance-form.tsx`: copy explanatorio nuevo — vía i18n (usa `title`/`description`)
- [x] 2.3 Actualizar `apps/web/app/(onboarding-wizard)/onboarding/done/page.tsx`: copy de éxito/guiño + resumen de saldo (mantener marca de `onboarding_completed_at`)
- [x] 2.4 Confirmar que done web marca `onboarding_completed_at` antes de renderizar el fork (arquitectura actual D4)

## 2b. Fork "Tu Grana, tu decisión" (web, dentro de done)

- [x] 2b.1 `done` client component (`onboarding-fork.tsx`) dueño de TODA la pantalla (header éxito + saldo + fork), con estado de selección (idle → confirmando A/B), para que la confirmación tape lo demás
- [x] 2b.2 Render de las dos cards (A "Una billetera y listo" / B "Mis cuentas, al detalle") con etiquetas, acentos de color (emerald/navy), chips de ícono, sombras y hover — sin escape (elección forzada)
- [x] 2b.3 Estado de confirmación: reemplaza toda la pantalla con ícono + mensaje cálido + botón "Vamos 🚀" + "Volver" (no navega hasta el click) (D7)
- [x] 2b.4 Ruteo: A → `/dashboard?nuevo=1`; B → `/accounts?nuevaCuenta=1` (ambos abren drawer)
- [x] 2b.5 Confirmar que el nombre de la cuenta por defecto es "Billetera" para que el copy de la Card A sea literal (Open Question #2) — trigger 0012 inserta name='Billetera'

## 2c. Puente query-param → drawer de movimiento (web, capability transactions)

- [x] 2c.1 Consumidor dentro de `(app)` que lee `?nuevo=1` y dispara `openCreate()` del `MovementDrawerContext` — efecto en `MovementDrawerProvider`
- [x] 2c.2 Limpiar el param de la URL al abrir (router.replace) para no re-disparar en refresh/atrás
- [x] 2c.3 Reintentar la apertura si el provider aún no estaba montado al leer el param (no perder la intención) — el param sobrevive hasta que monta el provider (que solo monta con datos listos); el effect corre en ese montaje
- [ ] 2c.4 Verificar que el tour del primer movimiento arranca para el usuario sin movimientos que llega por este camino — runtime

## 2d. Puente query-param → drawer de alta de cuenta (web, capability accounts)

- [x] 2d.1 `CreateAccountButton` lee `?nuevaCuenta=1` y abre su drawer; espera a que carguen las instituciones (`disabled` false) antes de abrir
- [x] 2d.2 Limpiar el param de la URL al abrir (router.replace) para no re-disparar
- [x] 2d.3 Spec delta `accounts` con la requirement + scenarios del puente

## 3. Refactor Mobile Onboarding

- [x] 3.1 Actualizar `apps/mobile/app/(onboarding)/welcome.tsx`: implementar copy + saludo personalizado — vía i18n; saludo con `firstName` ya existía
- [x] 3.2 Actualizar `apps/mobile/app/(onboarding)/initial-balance.tsx`: copy explanatorio nuevo — vía i18n
- [x] 3.3 Actualizar `apps/mobile/app/(onboarding)/done.tsx`: copy nuevo + guiño + CTA única a dashboard (sin fork)
- [x] 3.4 Verificar que done mobile marca `onboarding_completed_at` (ya existe en código actual, idempotente)

## 4. Testing & Validation

- [ ] 4.1 Test web: flujo completo welcome → initial-balance → done (copy renderiza con tono nuevo)
- [ ] 4.2 Test web: fork — elegir A → confirmación tapa la pantalla → "Vamos 🚀" abre el drawer de movimiento en dashboard con el tour
- [ ] 4.3 Test web: fork — elegir B → confirmación → "Vamos 🚀" abre el drawer de alta de cuenta en `/accounts` (no la página)
- [ ] 4.4 Test web: "Volver" desde la confirmación vuelve a las dos cards sin navegar
- [ ] 4.5 Test web: `/dashboard?nuevo=1` directo abre el drawer y limpia el param; cerrar no lo reabre
- [ ] 4.6 Test mobile: flujo completo (copy renderiza, i18n funciona) + CTA único a dashboard
- [ ] 4.7 Test: usuario refresca en cada pantalla (persistencia no se rompe)
- [ ] 4.8 Test i18n: cambiar idioma a EN en web/mobile, verificar tono

## 5. Pre-merge Checks

- [x] 5.1 Revisar no hay cambios en archivos no intencionales (solo onboarding + i18n + puente drawer) — el fix de cards queda afuera del commit
- [x] 5.2 Confirmar spec matches implementación (copy exacto, ruteo del fork como se documentó)
- [x] 5.3 `openspec validate refine-onboarding-grana-voice --strict` pasa
- [ ] 5.4 Squash commits con mensaje convencional: `feat(onboarding): grana voice & "tu Grana, tu decisión" fork` — pendiente tras tu QA en dev
