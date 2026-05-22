## 1. Preparación y branching

- [x] 1.1 Crear branch `feature/onboarding-post-signup` desde `main` (recordatorio: pre-commit check `git branch --show-current`).
- [x] 1.2 Revisar el SQL Editor de Supabase para confirmar que `profiles` no tiene conflictos con los nombres de columna a agregar (`mode`, `financial_timezone`, `onboarding_completed_at`) ni cuentas cash adicionales llamadas `Efectivo` (más allá de la creada por el trigger).
- [x] 1.3 Confirmar el siguiente número correlativo para la migración en `supabase/migrations/` (mirar la última, sumar 1).

## 2. Migración: profiles + rename de cuenta default

- [x] 2.1 Crear `supabase/migrations/<NNNN>_profiles_onboarding_and_default_account.sql` con tres bloques:
  - `ALTER TABLE profiles ADD COLUMN ...` para `mode`, `financial_timezone`, `onboarding_completed_at` (con defaults y check constraints).
  - `CREATE OR REPLACE FUNCTION` del trigger `on_auth_user_created_default_account` cambiando el `name` de la cuenta default de `'Efectivo'` a `'Billetera'`.
  - `UPDATE accounts SET name='Billetera' WHERE name='Efectivo' AND type='cash'` para renombrar las cuentas existentes.
- [x] 2.2 Agregar comentario en el archivo recordando: (a) el UPDATE manual al owner post-deploy para evitar el wizard, (b) el riesgo conocido del rename masivo (mitigado por contexto: un solo usuario activo).
- [x] 2.3 Pegar el SQL en el SQL Editor de Supabase y ejecutar contra el proyecto remoto.
- [x] 2.4 Verificar que el trigger reescrito sigue cubriendo I-CRED-1 y demás invariantes preexistentes (mirar los CHECK constraints relevantes; no debería haber cambios pero confirmar).
- [x] 2.5 Ejecutar `UPDATE profiles SET onboarding_completed_at = now() WHERE id = '<owner>';` manualmente.
- [x] 2.6 Verificar con un `SELECT` que la cuenta del owner se renombró a `Billetera`.
- [~] 2.7 Regenerar types: `supabase gen types typescript --project-id <id> > packages/supabase/src/types.ts`. _(Diferido: el owner maneja Supabase desde el dashboard. `types.ts` está vacío como slot — el código no se apoya en tipos estrictos del schema.)_
- [~] 2.8 Verificar que `packages/supabase/src/types.ts` ahora incluye los tres nuevos campos en el tipo `Tables<'profiles'>`. _(Diferido junto con 2.7.)_

## 3. CLAUDE.md y project-conventions

- [x] 3.1 Agregar entrada "Bimoneda por defecto" a la tabla "Cross-cutting principles" de `CLAUDE.md`, con un párrafo similar al de "Bimoneda" (que ARS+USD están habilitados por defecto al alta; opt-out vía settings futuro).
- [x] 3.2 Verificar que el principio queda visible y consistente con los otros principios cross-cutting.

## 4. Validaciones (packages/validation)

- [x] 4.1 Crear `packages/validation/src/onboarding.ts` con schemas Yup:
  - `perfilSchema`: valida modo (`'novato'` | `'experto'`) requerido, banco condicional (visible solo si modo='experto'; si banco='sí' entonces institución y nombre requeridos).
  - `saldoActualSchema`: valida montos por moneda y cuenta. Acepta vacíos (los trata como 0), no acepta negativos.
- [x] 4.2 Exportar los schemas desde `packages/validation/src/index.ts`.
- [x] 4.3 Decidir si el parsing de montos con formato local (puntos como miles, coma como decimal) requiere helper nuevo o usa uno existente. _(Resuelto: se reutilizan `parseMoneyInput` y `normalizeMoneyAmount` ya existentes en `packages/validation/src/money.ts`. El form los aplica en el cliente antes del submit.)_

## 5. i18n (packages/i18n-messages)

- [x] 5.1 Crear claves para todos los strings de las 4 pantallas en `packages/i18n-messages/src/es.json` (y `en.json` para paridad) bajo el namespace `onboarding.welcome`, `onboarding.perfil`, `onboarding.saldoActual`, `onboarding.done`, `onboarding.errors`.
- [x] 5.2 Incluir copy de las 2 cards de modo ("Vista simple" y "Vista detallada") con los bullets de cada una. NO incluir copy relacionado a tarjeta en `/perfil`.
- [x] 5.3 Incluir copy de los botones "Empezar", "Continuar", "Saltar este paso", "Ir al dashboard", y mensajes de error de validación.

## 6. Server actions (apps/web)

- [x] 6.1 Crear `savePerfilAction` en `apps/web/app/_actions/onboarding.ts`:
  - Recibe los inputs validados con `perfilSchema`.
  - UPDATE `profiles.mode` e INSERT condicional de `accounts` + `account_currencies` si dijo banco (con rollback manual si falla account_currencies).
  - Retorna `{ ok: true }` o `{ ok: false, fieldErrors? | formError }`.
- [x] 6.2 Crear `saveSaldoActualAction` en el mismo archivo:
  - Recibe inputs validados con `saldoActualSchema`.
  - Para cada par (cuenta, moneda) con monto > 0 ingresado: UPDATE `account_currencies.initial_balance`.
  - NO inserta filas en `transactions`.
- [x] 6.3 Crear `completeOnboardingAction` en el mismo archivo:
  - UPDATE `profiles.onboarding_completed_at = now()`.
  - Idempotente: si ya está seteado, retorna OK sin volver a escribir.
- [x] 6.4 ~~Crear `skipPerfilAction` y `skipSaldoActualAction`~~. _Removed in a later iteration: the wizard is now blocking (no skip allowed). See design.md Decision 8._

> Nota: las 5 actions viven en una sola file `apps/web/app/_actions/onboarding.ts` siguiendo la convención del repo (ver `signup.ts`, `credit-cards.ts`). El plan original asumía un sub-directorio bajo `(app)/onboarding/_actions/` — se descartó por consistencia con lo que ya existe.

## 7. Páginas y componentes (apps/web)

- [x] 7.1 Crear `welcome/page.tsx`: Server Component que lee `profiles.full_name`, renderiza el copy de bienvenida y el CTA "Empezar" que linkea a `/onboarding/perfil`.
- [x] 7.2 Crear `perfil/page.tsx` + `perfil/_components/perfil-form.tsx`:
  - Form con react-hook-form + yupResolver(perfilSchema).
  - Dos cards seleccionables ("Vista simple" / "Vista detallada") como pregunta principal.
  - Render condicional: la pregunta de banco aparece solo si elige "Vista detallada"; el bloque institución + nombre aparece solo si responde sí.
  - Sin campos sobre tarjeta de crédito.
  - Submit → `savePerfilAction` → `router.push('/onboarding/saldo-actual')`. "Saltar" → `skipPerfilAction` (server redirige).
- [x] 7.3 Crear `saldo-actual/page.tsx` + `saldo-actual/_components/saldo-actual-form.tsx`:
  - Page lee `profiles.mode` y las cuentas activas del usuario (Billetera + bancaria si existe).
  - Form renderiza inputs según modo: novato (1 grupo "En total", no menciona Billetera), experto sin banco (igual a novato), experto con banco (2 grupos: cuenta bancaria + Billetera "En efectivo").
  - Cada grupo tiene inputs ARS y USD; parsing local con `parseMoneyInput`.
  - Submit → `saveSaldoActualAction` → `router.push('/onboarding/done')`. "Saltar" → `skipSaldoActualAction`.
- [x] 7.4 Crear `done/page.tsx`:
  - Server Component que llama a `completeOnboardingAction` (idempotente).
  - Calcula y muestra disponible agregado por moneda desde `account_currencies.initial_balance` de las cuentas cash/bank activas.
  - Copy condicional según si el usuario cargó saldos o saltó.
  - CTA "Ir al dashboard" linkea a `/dashboard`.
- [x] 7.5 Agregar layout en `(onboarding-wizard)/layout.tsx` con verificación de sesión + wrapper `max-w-md` sin Header/Sidebar.

> Nota: el wizard vive en el route group `(onboarding-wizard)/onboarding/` (no bajo `(app)/`) para no heredar el Header del app layout. La carpeta vieja `apps/web/app/(app)/onboarding/` se elimina como parte de este grupo — los archivos restantes se cubren en §9.

## 8. Middleware

- [x] 8.1 Modificar `apps/web/lib/supabase/middleware.ts`:
  - Agregar `/onboarding` y `/cards` a `protectedPrefixes` (este último ya estaba implícitamente protegido por el layout `(app)`, ahora también desde middleware por consistencia).
  - Después de validar sesión, leer `profiles.onboarding_completed_at` (con `maybeSingle()`) cuando la ruta sea protegida pero NO sea `/onboarding/*` ni una recovery session.
  - Si `onboarding_completed_at IS NULL`, redirect a `/onboarding/welcome`.
- [x] 8.2 Lectura de `profiles` reutiliza el `supabaseClient` ya creado en el middleware, con el cookie store del request actual → respeta RLS automáticamente.
- [~] 8.3 Medición de latencia: diferida. Documentada como Open Question en design.md (se evaluará en producción; mitigación es cache en cookie si fuera necesario, fuera de scope de esta change).

## 9. Cleanup del flujo viejo

- [x] 9.1 Eliminar `apps/web/app/(app)/onboarding/_components/novato-onboarding-form.tsx` y la `page.tsx` que lo montaba. _(Hecho como parte de §7 para resolver el conflicto de rutas.)_
- [x] 9.2 Eliminar la función `completeNovatoOnboarding` de `apps/web/app/_actions/credit-cards.ts`. La función `createNovatoCreditCard` se conserva (puede reusarse en un wizard simplificado futuro sin acoplarse al onboarding).
- [x] 9.3 Buscar referencias huérfanas a "Mi plata" y "Mi tarjeta" en el código y actualizarlas:
  - El fallback hardcodeado `'Mi tarjeta'` en `createCreditCard` ahora dice `'Tarjeta'` (genérico, sin posesivo).
  - `accounts.defaultCashName` en `es.json`/`en.json` pasó de "Efectivo"/"Cash" a "Billetera"/"Wallet" para consistencia con el trigger renombrado.
  - El selector de cuenta de pago en `(app)/cards/.../pay/_components/pay-card-period-form.tsx` no hardcodea ningún nombre — lee `a.name` directamente, así que ya pinta "Billetera" sin cambios.
- [x] 9.4 Eliminar tests que validaban el flujo viejo de onboarding novato. _(No había tests del flujo viejo en el repo; verificado con grep.)_
- [x] 9.5 Verificar que no haya rutas/links a `/onboarding/tarjeta` (paso viejo). _(Verificado con grep — no hay referencias.)_

## 10. Módulo cards — adaptar selector de cuenta de pago a Billetera

- [x] 10.1 Buscar el componente del selector de "cuenta de pago" en el flujo de pago de resumen (módulo `cards`). _(Encontrado en `(app)/cards/[id]/periods/[periodId]/pay/_components/pay-card-period-form.tsx`.)_
- [x] 10.2 Cambiar la referencia hardcodeada `"Mi plata"` por la cuenta `Billetera`. _(El selector NO hardcodeaba nada — itera sobre `paymentAccounts` y muestra `a.name`. Como la cuenta default ahora se llama "Billetera" en DB, el selector la muestra correctamente sin cambios de código.)_
- [~] 10.3 Verificar manualmente con un usuario novato de prueba que el flujo de pago de resumen funciona contra Billetera. _(Diferido a §12 — QA manual del owner.)_

## 11. Tests

- [x] 11.1 / 11.2 Tests de schemas `perfilSchema` + `saldoActualSchema` en `apps/web/lib/__tests__/onboarding-schemas.test.ts` (15 tests, pasan). Cubren:
  - Modos válidos (novato / experto) y rechazo de valores inválidos.
  - Validación condicional de banco según modo + has_bank_account.
  - UUIDs requeridos y montos no negativos en `saldoActualSchema`.
- [~] 11.3 Test unitario del middleware: diferido. El middleware llama a Supabase real (SSR client) y mockearlo requiere setup considerable. La cobertura efectiva queda en el QA manual (§12) que recorre los flujos. Anotado como Open Question en design.md.
- [~] 11.4 Test E2E del wizard completo: diferido. El repo no tiene infra E2E (Playwright/Cypress) configurada y agregarla excede el alcance. Cobertura por QA manual (§12).
- [~] 11.5 Test de regresión del trigger: diferido. Probar triggers de Supabase requiere ejecutar SQL contra una DB de prueba; no hay test DB en el setup. La migración 0012 ya incluye self-checks que se ejecutaron al aplicarla.

> Nota: la cobertura automatizada se reduce a los schemas porque las actions y el middleware tocan Supabase directamente y no hay infra de mocking. El gap se cubre con el QA manual (§12) que el owner ejecuta. Si en el futuro se decide invertir en mocking de Supabase server-side, los tests de actions y middleware podrían retomarse sin cambios de spec.

## 12. QA manual

> §12 lo ejecuta el owner — todo el código necesario está mergeado en este branch.

- [ ] 12.1 En entorno de desarrollo, crear un nuevo usuario de prueba vía signup + OTP.
- [ ] 12.2 Recorrer el wizard completo eligiendo Vista simple — verificar que aterriza en /dashboard con disponible cargado.
- [ ] 12.3 Crear otro usuario, recorrer eligiendo Vista detallada con banco — verificar que la cuenta bancaria existe con los saldos ingresados.
- [ ] 12.4 Crear un tercer usuario y saltar todos los pasos — verificar que llega a /done y queda `onboarding_completed_at IS NOT NULL` y `initial_balance=0` en todo.
- [ ] 12.5 Verificar que un usuario con onboarding completado puede revisitar /onboarding/welcome sin ser bloqueado.

## 13. Documentación

- [~] 13.1 README de `apps/web/`: no existe — no hay nada que actualizar. Si en el futuro se agrega, mencionar el wizard en `/onboarding`.
- [x] 13.2 `SUPABASE_SETUP.md` actualizado:
  - La sección 10.3 ahora indica que la cuenta default se llama `Billetera` (renombrada en 0012).
  - Nueva sección 12.5 documenta la migración 0012 con sus 3 bloques, los self-checks, y el comando para regenerar types.
- [x] 13.3 `openspec validate add-onboarding-post-signup --strict` corre sin errores.

## 14. Merge

> §14 lo ejecuta el owner después del QA manual. El branch queda listo con todos los commits incrementales.

- [ ] 14.1 Squashear los commits del branch a un único commit (ver convención de CLAUDE.md).
- [ ] 14.2 Rebase del branch sobre `main` actualizado.
- [ ] 14.3 Merge a `main` con `git merge --ff-only`.
- [ ] 14.4 Push a `origin/main`.
- [ ] 14.5 Ejecutar `openspec archive add-onboarding-post-signup` para promover las specs delta a `openspec/specs/<capability>/spec.md` definitivos.
