## ADDED Requirements

### Requirement: Cambio de contraseña desde el área autenticada

El sistema SHALL permitir que un usuario autenticado cambie su contraseña sin salir de la sesión, desde la ruta `/settings/password` (web) y `/(app)/settings/password` (mobile). El acceso NO SHALL estar gated por el claim `amr=otp`: a diferencia del flujo de recovery, la única precondición es tener sesión activa. La prueba de identidad la aporta la **contraseña actual**, que el formulario SHALL pedir como primer campo.

El formulario SHALL tener exactamente tres campos —contraseña actual, contraseña nueva y confirmación— y SHALL validarse con `changePasswordSchema` de `@grana/validation`, que extiende `resetSchema` con `currentPassword` (requerido) y conserva `passwordRules` (≥8 caracteres, ≥1 letra, ≥1 número) para la contraseña nueva. La validación local SHALL correr antes de cualquier llamada a Supabase.

El flujo SHALL ejecutarse 100% client-side, sin server action, por el mismo motivo documentado en el requirement de recovery. La secuencia SHALL ser, en este orden:

1. **Verificar la contraseña actual** con `signInWithPassword({ email, password: currentPassword })` sobre un **cliente Supabase descartable**, creado con `createClient` de `@grana/supabase` y `auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }`. El `email` SHALL leerse de la sesión activa (`getUser()`), NO SHALL provenir de un input del formulario. En web este cliente NO SHALL crearse con `createBrowserClient` de `@supabase/ssr`, que persiste cookies de auth por diseño. Si la verificación falla, el flujo SHALL abortar sin llamar a `updateUser`.
2. **Actualizar la contraseña** con `supabase.auth.updateUser({ password })` sobre el cliente vivo de la app.
3. **Revocar las demás sesiones** con `supabase.auth.signOut({ scope: 'others' })` sobre el cliente vivo.

El `scope: 'others'` SHALL ser explícito. El default del SDK es `'global'`, que desloguearía también el dispositivo en uso; y `'others'` no emite el evento `SIGNED_OUT`, de modo que el listener `onAuthStateChange` del root layout de mobile no redirige a `(auth)/login`. La sesión sobre la que el usuario está parado SHALL sobrevivir al cambio.

Al completarse el paso 2, el formulario SHALL desmontarse y ser reemplazado por una card de éxito en el mismo lugar, con un CTA de vuelta a `/settings`. El sistema NO SHALL navegar de vuelta en silencio: el cambio de contraseña no deja rastro visible en el destino. La card SHALL tener dos estados de body:

- **Revocación exitosa**: confirma el cambio e informa que se cerró la sesión en los otros dispositivos.
- **Revocación fallida** (paso 3 con error): confirma el cambio —que ya ocurrió y es irreversible— y avisa que las otras sesiones NO se cerraron. El sistema NO SHALL tragarse este error ni reportar éxito completo.

El copy SHALL describir la revocación sin prometer efecto instantáneo: `signOut({ scope: 'others' })` revoca los refresh tokens, pero los access tokens ya emitidos siguen siendo válidos hasta expirar.

Los errores de Supabase SHALL traducirse con `mapSupabaseError` y renderizarse según su naturaleza: `invalid_credentials` (contraseña actual incorrecta) SHALL renderizarse **a nivel de campo** sobre "Contraseña actual"; el resto (`same_password`, `weak_password`, `over_request_rate_limit`, genérico) SHALL renderizarse a nivel formulario. Este requirement NO SHALL agregar entradas nuevas al mapeo de códigos.

Todo el texto visible de las dos pantallas SHALL provenir de los catálogos i18n bajo `settings.security.*`, incluidos los labels del toggle de visibilidad de `PasswordField` (`toggleLabelShow` / `toggleLabelHide`), que de no pasarse caerían a defaults hardcodeados en el componente.

#### Scenario: Cambio exitoso conservando la sesión (web)

- **WHEN** un usuario autenticado en `/settings/password` envía el formulario con su contraseña actual correcta y una contraseña nueva válida que coincide con la confirmación
- **THEN** el sistema verifica la actual con el cliente descartable, llama a `updateUser({ password })` y luego a `signOut({ scope: 'others' })`
- **AND** el formulario se desmonta y en su lugar aparece la card de éxito con el body de revocación exitosa y un CTA a `/settings`
- **AND** el usuario sigue autenticado: navegar a `/dashboard` no redirige a `/login`

#### Scenario: Cambio exitoso conservando la sesión (mobile)

- **WHEN** un usuario autenticado en `/(app)/settings/password` envía el formulario con datos válidos
- **THEN** la app ejecuta la misma secuencia de tres pasos
- **AND** el listener `onAuthStateChange` del root layout NO recibe `SIGNED_OUT` y la app NO navega a `(auth)/login`
- **AND** la pantalla muestra la card de éxito con el CTA de vuelta a `/(app)/settings`

#### Scenario: Contraseña actual incorrecta

- **WHEN** un usuario envía el formulario con una contraseña actual que no es la suya
- **THEN** la verificación devuelve `invalid_credentials` y el error localizado se muestra **sobre el campo "Contraseña actual"**, no en el bloque de error del formulario
- **AND** el sistema NO llama a `updateUser` ni a `signOut`
- **AND** la contraseña de la cuenta queda sin cambios

#### Scenario: La verificación no altera la sesión en curso

- **WHEN** la verificación de la contraseña actual tiene éxito
- **THEN** la sesión activa del usuario no fue reemplazada: en web las cookies de auth no se reescribieron y en mobile el contenido de `expo-secure-store` no cambió
- **AND** si cualquier paso posterior falla, el usuario sigue en la misma sesión con la que entró a la pantalla

#### Scenario: La contraseña nueva es igual a la actual

- **WHEN** la verificación pasa y `updateUser` devuelve el código `same_password`
- **THEN** el formulario muestra el mensaje localizado de `same_password` a nivel formulario
- **AND** el formulario sigue montado y no se muestra la card de éxito
- **AND** no se llama a `signOut`

#### Scenario: La confirmación no coincide

- **WHEN** un usuario envía el formulario con `password !== confirmPassword`
- **THEN** el error de validación localizado aparece en el campo de confirmación
- **AND** no se hace ninguna llamada a Supabase, ni de verificación ni de actualización

#### Scenario: La revocación de las otras sesiones falla

- **WHEN** `updateUser` tiene éxito pero `signOut({ scope: 'others' })` devuelve error
- **THEN** el formulario se desmonta igual y aparece la card de éxito con el body alternativo
- **AND** ese body informa que la contraseña sí se cambió y que las otras sesiones no pudieron cerrarse
- **AND** el sistema no presenta la operación como completamente exitosa

#### Scenario: Otro dispositivo pierde la sesión

- **WHEN** un usuario con sesión abierta en dos dispositivos cambia la contraseña en uno de ellos y la revocación tiene éxito
- **THEN** el refresh token del otro dispositivo queda revocado y su próximo refresh falla, llevándolo al login
- **AND** el dispositivo donde se hizo el cambio sigue autenticado

#### Scenario: Reintentos con la contraseña actual equivocada topan el rate limit

- **WHEN** un usuario tantea varias veces seguidas una contraseña actual incorrecta y Supabase devuelve `over_request_rate_limit`
- **THEN** el formulario muestra el mensaje localizado de ese código a nivel formulario
- **AND** la pantalla no se rompe ni muestra el error crudo de Supabase

#### Scenario: La pantalla no exige sesión de recovery

- **WHEN** un usuario con una sesión normal (claim `amr=password`) abre la pantalla de cambio de contraseña
- **THEN** el formulario de tres campos se renderiza directamente
- **AND** NO se muestra la card de "sesión inválida o expirada" que sí gatea la pantalla de recovery
