## 1. Preparación y branching

- [x] 1.1 Crear branch `feature/onboarding-mobile` desde `main` (recordatorio: pre-commit check `git branch --show-current`).
- [~] 1.2 Verificar que la migración 0012 está aplicada en Supabase remoto:
      ```sql
      SELECT column_name FROM information_schema.columns
      WHERE table_name='profiles' AND column_name IN ('mode','financial_timezone','onboarding_completed_at');
      ```
      Debería devolver las 3 columnas. Si no, esta change no puede arrancar — la dependencia es la change web ya mergeada.
- [~] 1.3 Verificar que el owner ya tiene `onboarding_completed_at` seteado, para no caer él mismo en el wizard al testear mobile (`SELECT id, onboarding_completed_at FROM profiles`). _(Diferido al owner — requiere acceso a Supabase remoto.)_

## 2. Helper i18n mobile

- [x] 2.1 Crear `apps/mobile/lib/i18n.ts` con `import { es as esMessages } from '@grana/i18n-messages'` y exportar `t(path: string, params?: Record<string, string | number>): string` que navega con notación dot e interpola `{key}` por params. _(Importa desde el entry point del package en lugar del .json directo — el package ya exporta `es` tipado.)_
- [x] 2.2 Fallback: si la clave no existe, retornar el `path` mismo (visible en runtime, no rompe el render).
- [~] 2.3 Smoke test en una pantalla cualquiera. _(Diferido al QA manual del owner — el typecheck cubre el shape, el runtime se valida en simulator.)_

## 3. Componentes UI nuevos

- [x] 3.1 Crear `apps/mobile/components/ui/SelectableCard.tsx`:
  - Props: `title: string`, `description: string`, `selected: boolean`, `onPress: () => void`, `disabled?: boolean`.
  - Implementación: `Pressable` con borde 2px (selected → `border-emerald` + `bg-emerald/5`, no-selected → `border-border`), padding 4, layout column con title `font-semibold` y description `text-text-muted`.
  - `accessibilityRole="button"` + `accessibilityState={{ selected }}`.
- [x] 3.2 Crear `apps/mobile/components/ui/InstitutionPickerModal.tsx`:
  - Props: `visible: boolean`, `onClose: () => void`, `institutions: Array<{id: string, name: string}>`, `onSelect: (institution) => void`, `selectedId?: string | null`.
  - Implementación: `Modal` RN con `animationType="slide"`, `presentationStyle="formSheet"`. Header con título + close button. `TextInput` de búsqueda. `FlatList` filtrada case-insensitive sobre `name`. Item: `Pressable` con `name` + check icon si `selectedId === institution.id`.
  - `KeyboardAvoidingView` interno para no tapar la list cuando el teclado se abre.

## 4. Gate dual (auth spec — requirement nuevo)

- [x] 4.1 Modificar `apps/mobile/app/index.tsx`:
  - Agregar `'/(onboarding)/welcome'` al type `Target`.
  - Después de resolver sesión y descartar recovery, ejecutar `await supabase.from('profiles').select('onboarding_completed_at').eq('id', session.user.id).maybeSingle()`.
  - Si `data?.onboarding_completed_at` es null/undefined → `setTarget('/(onboarding)/welcome')`. Sino → `setTarget('/(app)/dashboard')`.
- [x] 4.2 Modificar `apps/mobile/app/_layout.tsx`:
  - El handler de `onAuthStateChange` para `SIGNED_IN` consulta `onboarding_completed_at` (igual que el splash) antes de elegir destino.
  - Si NULL → `router.replace('/(onboarding)/welcome')`. Sino → `router.replace('/(app)/dashboard')`.
  - Recovery sigue cortando antes con `hasRecoveryClaim(session?.access_token)`.
- [x] 4.3 Modificar `apps/mobile/app/(app)/_layout.tsx`:
  - Agregar `useEffect` que en mount lee sesión + `onboarding_completed_at`. Si NULL, `router.replace('/(onboarding)/welcome')`.
  - Mientras consulta, no bloquear el render (es safety net; en flujo normal nunca dispara).

## 5. Route group y layout del wizard

- [x] 5.1 Crear `apps/mobile/app/(onboarding)/_layout.tsx`: Stack con `screenOptions={{ headerShown: false }}`. Componente verifica sesión via `supabase.auth.getSession()` y redirige a `(auth)/login` si no hay.
- [~] 5.2 Verificar que la nueva ruta `(onboarding)/welcome` resuelve correctamente desde `expo-router`. _(Diferido a QA manual del owner — requiere correr el dev server.)_

## 6. Pantalla welcome

- [x] 6.1 Crear `apps/mobile/app/(onboarding)/welcome.tsx`:
  - Server Component-like: usa `useEffect` para leer `profiles.full_name` desde supabase y guardar en state.
  - Render: copy de `t('onboarding.welcome.greeting', { name: firstName })`, `t('onboarding.welcome.title')`, `t('onboarding.welcome.description')`, y `<Button title={t('onboarding.welcome.cta')} onPress={() => router.push('/(onboarding)/perfil')} />`.
  - Mientras `full_name` carga, renderizar el copy sin nombre (omitir el saludo).
  - Usar `CurvedNavyContainer` o un layout similar centrado con `max-w-md`.

## 7. Pantalla perfil

- [x] 7.1 Crear `apps/mobile/app/(onboarding)/perfil.tsx`:
  - State manual: `mode`, `hasBankAccount`, `institutionId`, `institutionName` (para mostrar el label), `bankAccountName`, `fieldErrors`, `formError`, `loading`, `pickerVisible`.
  - `useEffect`: cargar `institutions` desde supabase ordenadas por nombre.
  - Render: header con `t('onboarding.perfil.title')`, sección de cards con `SelectableCard` x2 (Vista simple/detallada). Pregunta de banco solo si `mode === 'experto'`. Bloque institución + nombre solo si `hasBankAccount === true`. Submit button con `t('onboarding.perfil.continue')`.
  - Selector de institución: campo "Banco" es un `Pressable` con apariencia de input que abre `InstitutionPickerModal`. Tras seleccionar, muestra `institutionName`.
- [x] 7.2 Implementar `handleSubmit` en perfil:
  - Validar con `perfilSchema.validate(values, { abortEarly: false })`. Mapear `err.inner` a `fieldErrors`.
  - UPDATE `profiles.mode`. Si falla, mostrar `t('onboarding.errors.generic')`.
  - Si `mode === 'experto' && hasBankAccount`: INSERT `accounts` → si OK, INSERT `account_currencies` (ARS+USD). Si éste falla, `DELETE accounts WHERE id = ...` (rollback manual) y mostrar error.
  - Éxito → `router.replace('/(onboarding)/saldo-actual')`.
- [x] 7.3 Verificar manualmente que la pantalla NO contiene ningún campo, switch, picker o card sobre tarjeta de crédito. _(Verificado por inspección del código: el form solo tiene mode + banco + institución + nombre. Cero referencias a tarjeta.)_

## 8. Pantalla saldo-actual

- [x] 8.1 Crear `apps/mobile/app/(onboarding)/saldo-actual.tsx`:
  - `useEffect`: leer `profiles.mode` y `accounts` activas (cash + bank) del usuario.
  - Determinar `primaryAccount` y `secondaryCashAccount` igual que el web (`bank ?? cash` para primary; `secondaryCash = bank ? cash : null`).
  - Si no hay cash account (caso anormal), `router.replace('/(onboarding)/done')` (mismo fallback que web).
  - State: 4 strings (`primary_ars_str`, `primary_usd_str`, `cash_ars_str`, `cash_usd_str`), `loading`, `formError`.
  - Render: header con `t('onboarding.saldoActual.title')` y description según mode/secondary, sección primary con 2 `TextInput` (ARS, USD), sección secondaryCash si aplica, Submit.
- [x] 8.2 Implementar `handleSubmit` en saldo-actual:
  - Parsear cada string con `parseMoneyInput`. Si null → `t('onboarding.errors.amount_invalid')`. Si negativo → `t('onboarding.errors.amount_negative')`.
  - `primary_ars` obligatorio (0 válido); vacío → `t('onboarding.errors.primary_ars_required')`.
  - Validar con `saldoActualSchema` como safety net.
  - Para cada par (cuenta, moneda) con monto > 0: UPDATE `account_currencies.initial_balance`. Si alguno falla, mostrar error genérico.
  - Éxito → `router.replace('/(onboarding)/done')`.

## 9. Pantalla done

- [x] 9.1 Crear `apps/mobile/app/(onboarding)/done.tsx`:
  - `useEffect` que en mount: (1) SELECT actual de `profiles.onboarding_completed_at`; si NULL, UPDATE con `new Date().toISOString()` (idempotencia explícita). (2) SELECT agregado de `account_currencies.initial_balance` joined con `accounts` filtrando por user_id (RLS), `is_active=true`, `type IN ('cash','bank')`. Sumar por `currency_code` a `totals = { ARS, USD }`.
  - State: `totals: { ARS: number, USD: number } | null`, `hasData: boolean`.
  - Render: header con `t('onboarding.done.title')`, card con `t('onboarding.done.balance_label')` + total ARS grande formateado con `Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })` (prefijo `$`), total USD chico si > 0 (prefijo `US$`).
  - Copy condicional: `hasData` → `t('onboarding.done.next_step_with_data')`, sino `t('onboarding.done.next_step_skip')`.
  - CTA `t('onboarding.done.cta')` → `router.replace('/(app)/dashboard')`.

## 10. Verificación

- [x] 10.1 Correr `pnpm --filter mobile typecheck`. Cero errores nuevos.
- [x] 10.2 Correr `pnpm --filter mobile lint`. Cero errores nuevos.
- [x] 10.3 Correr `pnpm --filter web test` (los tests de `perfilSchema` + `saldoActualSchema` siguen verdes; aplican a mobile porque comparten package). _(121 tests verdes incluyendo `onboarding-schemas.test.ts` con 16 tests.)_

## 11. QA manual (lo ejecuta el owner)

- [~] 11.1 Levantar el dev server mobile (`pnpm --filter mobile dev`) en simulador iOS.
- [~] 11.2 Crear usuario nuevo: signup + verify + login. Verificar que aterriza en `(onboarding)/welcome` (no en dashboard).
- [~] 11.3 Recorrer wizard novato puro (Vista simple, monto ARS=100000, USD vacío). Verificar que termina en dashboard con disponible correcto (vía dashboard si está implementado, o vía DB: `SELECT * FROM account_currencies WHERE account_id = ...`).
- [~] 11.4 Crear segundo usuario, recorrer con Vista detallada + banco "Galicia" + "Caja de ahorro" + saldos. Verificar que existe la cuenta bank en DB con sus 2 currencies y los `initial_balance` correctos.
- [~] 11.5 Forzar un usuario con `UPDATE profiles SET onboarding_completed_at = NULL WHERE id = '<test>'`, cerrar la app, abrirla en frío. Verificar que el splash gate lo redirige a `(onboarding)/welcome`.
- [~] 11.6 Con un usuario en `(onboarding)/saldo-actual`, matar la app, abrirla. Verificar que vuelve a `(onboarding)/welcome` (splash) y al avanzar a `/perfil` ve sus respuestas previas.
- [~] 11.7 Disparar el flujo de recovery (forgot-password con un usuario que tenga `onboarding_completed_at IS NULL`). Verificar que el código de recovery lleva a `(auth)/new-password`, NO al wizard.
- [~] 11.8 Tras completar el wizard con un usuario, verificar que abrir la app de nuevo va directo a `(app)/dashboard` sin pasar por el wizard.

## 12. Documentación

- [~] 12.1 Actualizar `apps/mobile/README.md` para mencionar el wizard de onboarding bajo `(onboarding)/`. _(No aplica: el README mobile no documenta rutas/pantallas — solo scripts y builds. Nada que actualizar.)_
- [x] 12.2 Correr `openspec validate add-onboarding-mobile --strict` y resolver cualquier error reportado. _(Validación strict pasa sin errores.)_

## 13. Merge

> §13 lo ejecuta el owner después del QA manual.

- [~] 13.1 Squashear los commits del branch a un único commit.
- [~] 13.2 Rebase del branch sobre `main` actualizado.
- [~] 13.3 Merge a `main` con `git merge --ff-only`.
- [~] 13.4 Push a `origin/main`.
- [~] 13.5 Ejecutar `openspec archive add-onboarding-mobile` (después de que `add-onboarding-post-signup` también esté archivada, ya que esta change MODIFICA sus capabilities).
