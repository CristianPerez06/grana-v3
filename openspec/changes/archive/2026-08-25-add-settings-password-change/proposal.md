## Why

Un usuario autenticado de Grana no tiene forma de cambiar su contraseña. La única vía existente es **desloguearse** y pasar por el flujo de recovery completo: `/forgot-password` → email con OTP de 8 dígitos → `recovery-verify` → pantalla de password nuevo → `signOut()` → volver a loguearse. Cinco pasos y un email de por medio para una operación que la app ya sabe hacer: el mecanismo (`supabase.auth.updateUser({ password })`) está implementado y speceado dos veces, en `apps/web/app/(auth)/reset-password/page.tsx` y en `apps/mobile/app/(auth)/new-password.tsx`.

Lo que falta no es el mecanismo sino la **puerta de entrada desde el área autenticada** y las dos garantías que un cambio in-app necesita y el flujo de recovery no: verificar que quien está del otro lado del teclado conoce la contraseña actual (en recovery eso ya lo probó el OTP del email), y cerrar la sesión en los otros dispositivos (en recovery el `signOut()` global lo resuelve de taquito, pero acá el usuario tiene que quedarse adentro).

Ese segundo punto es el que le da valor de seguridad real al cambio: hoy, si alguien deja la sesión abierta en un dispositivo que ya no controla, no tiene ninguna acción disponible para revocarla.

## What Changes

- **Sección "Seguridad" nueva en `/settings`, en ambas plataformas**, cuarta y última, después de Categorías. Una sola fila: "Cambiar contraseña", con una descripción que anticipa el efecto sobre las otras sesiones. Se compone con el `SettingsSection` existente — mismo título, mismas secciones, mismo orden en web y mobile, como manda la capability `settings`.
- **Ruta nueva `/settings/password`** (web) y `/(app)/settings/password` (mobile), pusheada desde esa fila. **No** se crea un hub `/settings/security` intermedio: con un solo ítem sería una pantalla cuyo único contenido es un link. La sección crece por filas y recién se promueve a hub cuando la raíz quede cargada (ver `design.md`, decisión 1).
- **Formulario de tres campos**: contraseña actual + nueva + confirmación. El schema `changePasswordSchema` se agrega a `@grana/validation` como `resetSchema` + `currentPassword`, así las reglas de fortaleza (≥8, ≥1 letra, ≥1 número) siguen viniendo de un único `passwordRules`.
- **La contraseña actual se verifica contra un cliente Supabase descartable** (`persistSession: false`), no contra el cliente vivo. Verificar con el cliente de la app haría que un `signInWithPassword` exitoso **reemplace la sesión en curso** (cookies en web, SecureStore en mobile) en medio del flujo. Con el cliente descartable la verificación es un predicado puro: si algo falla después, la sesión del usuario quedó intacta.
- **Al terminar, `signOut({ scope: 'others' })`**: revoca los refresh tokens de todos los demás dispositivos y **deja viva la sesión actual**. Es la pieza que hace que "cambiar la contraseña sin desloguearse" funcione: `'others'` no emite el evento `SIGNED_OUT`, así que el listener de `apps/mobile/app/_layout.tsx:44` no rebota al usuario a `(auth)/login`.
- **Card de éxito en el lugar del formulario**, con dos estados: revocación OK y revocación fallida. No hay toast en el repo — ni `sonner` en web ni equivalente en mobile — y navegar de vuelta en silencio (el patrón de `CreateCategoryForm`) no sirve acá: a diferencia de crear una categoría, un cambio de contraseña no deja **ningún rastro visible** en el destino, y el aviso de revocación fallida no tendría dónde renderizarse.
- **Errores donde corresponde**: `invalid_credentials` (contraseña actual incorrecta) se renderiza a nivel de campo sobre "Contraseña actual", no en el `Alert` del formulario. El resto (`same_password`, `weak_password`, `over_request_rate_limit`) va a nivel formulario. Todos los códigos ya están mapeados en `mapSupabaseError`; no se agregan entradas.
- **Copy nuevo bajo `settings.security.*`** en ambos catálogos. Las dos pantallas nuevas usan i18n desde la primera línea (`getTranslations`/`useTranslations` en web, `useT()` en mobile) — incluidos los labels del toggle de `PasswordField`, que hoy caen a defaults hardcodeados en el componente.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `settings`: se agrega la sección **Seguridad** como cuarta sección de `/settings`, en web y en mobile, con la regla de que la sección agrupa filas de acción (no preferencias de aplicación inmediata) y de que sus filas navegan a rutas hijas en lugar de mutar en el lugar. Se agrega además la ruta hija `/settings/password` en ambas plataformas. Se **modifica** el requirement de la pantalla de settings mobile para acotar la cláusula de `SafeAreaView edges={['top']}` a las pantallas que componen el árbol a mano: las pantallas de formulario montadas sobre `FormScreen` ya delegan el inset superior en `PageHeader`, que es lo que `/settings/categories/new` viene haciendo desde que existe el shell (drift preexistente, ver `design.md`).
- `auth`: se agrega el flujo de **cambio de contraseña desde el área autenticada**, hermano del "Setear password nuevo durante recovery" que ya existe. Cubre las tres diferencias con recovery: la verificación de la contraseña actual con cliente descartable, la revocación de las demás sesiones con `signOut({ scope: 'others' })` en lugar del `signOut()` global, y la card de éxito que retiene al usuario adentro en lugar de mandarlo a `/login`.

## Impact

- **Web** (`apps/web/`): `app/(app)/settings/page.tsx` (sección nueva), `app/(app)/settings/password/page.tsx` + `_components/change-password-form.tsx` (nuevos), helper de cliente de verificación en `lib/supabase/`.
- **Mobile** (`apps/mobile/`): `app/(app)/settings/index.tsx` (sección nueva), `app/(app)/settings/password.tsx` (nuevo, sobre `FormScreen`), `components/settings/ChangePasswordForm.tsx` (nuevo), helper de cliente de verificación en `lib/`.
- **Packages**: `@grana/validation` suma `changePasswordSchema` + `ChangePasswordInput`; `@grana/i18n-messages` suma el namespace `settings.security` en `es.json` y `en.json`.
- **i18n**: sin delta de spec. Los requirements de cobertura ya vigentes cubren las dos pantallas nuevas — el de web alcanza a toda ruta bajo `app/(app)/**`, y el de mobile nombra explícitamente "todas las pantallas/components nuevos de `/settings`".
- **Base de datos**: ninguna migración. No se toca `profiles`, ni RLS, ni el schema. Todo el cambio vive contra la API de Supabase Auth.
- **Templates de email**: ninguno. Se descartó el flujo de reauthentication con nonce por email precisamente para no traer el template "Reauthentication" al alcance de la regla de templates versionados (ver `design.md`, decisión 3).
- **Riesgo**: medio-bajo. No toca el ledger ni ningún cálculo, pero sí la sesión del usuario, y una operación es irreversible (el cambio de contraseña) mientras la otra es best-effort (la revocación). La secuencia y el manejo del estado intermedio están speceados con scenario propio.

## Non-Goals

- **Arreglar el drift de i18n del stack `(auth)` de mobile.** Las ocho pantallas/componentes de `apps/mobile/app/(auth)/**` y `components/auth/**` no usan traductor alguno — cero `useT()`, cero `t()` — incumpliendo un requirement que la capability `i18n` ya tiene escrito. Es deuda preexistente que merece su propio change: meterla acá mezclaría una feature nueva con un retrofit sobre login, signup y recovery, y triplicaría la superficie de review.
- **Localizar los mensajes base de Yup en mobile.** `apps/mobile/lib/yup-locale.ts` llama a `setYupLocale` con literales en español a nivel de módulo, bajo un comentario ya vencido (*"Mobile is Spanish-only for now (no i18n catalog yet)"* — el catálogo existe desde que aterrizó `LocaleProvider`). Consecuencia: en `en`, los errores de `required`, `min` y `email` de **cualquier** formulario mobile salen en español, y el formulario de este change los hereda. No es un one-liner: `setYupLocale` es un efecto global de import-time y el locale es state reactivo de React, así que arreglarlo bien pide decidir entre re-aplicar el locale en cada cambio o traducir en tiempo de render como ya hace `translateValidationMessage` con las claves custom. Va con su propio change, junto al drift de i18n del stack `(auth)`. Web no tiene el problema: usa un `ValidationLocaleSetter` montado en el layout.
- **Revisar el `scope` de los `signOut()` existentes.** Los seis call sites del repo omiten `scope`, y el default del SDK es `'global'`: hoy el botón "Cerrar sesión" desloguea al usuario de **todos** sus dispositivos. En recovery y post-signup eso es correcto; en los dos botones de logout es discutible y el spec no dice nada. Hallazgo adjunto, decisión aparte.
- **Cambiar el email o borrar la cuenta.** `profiles` ya guarda `email`, `full_name` y `financial_timezone` sin UI que los edite. Son las candidatas naturales a poblar la sección Seguridad (o una sección Cuenta) más adelante; no entran acá.
- **Listar / revocar sesiones individuales.** La revocación de este change es todo-o-nada y automática, sin pantalla de dispositivos.
- **Introducir un sistema de toasts.** Se resuelve con la card de éxito, que reusa un patrón ya speceado.
