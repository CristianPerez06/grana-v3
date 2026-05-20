## Context

La capability `auth` ya existe en web e implementa signup-with-link, login, forgot-password con link/PKCE, reset-password client-side, y enforcement de sesión de recovery vía cookie `recovery_in_progress` + claim `amr=otp` en middleware. Mobile aterrizó hace poco con NativeWind + Supabase + login + route guard via `onAuthStateChange`. Faltan signup y forgot-password en mobile.

Este change reemplaza el mecanismo de "click en el link del email" por **código OTP de 8 dígitos** en ambas plataformas, y aterriza las pantallas faltantes en mobile. La decisión de migrar también el web (en vez de solo agregar OTP en mobile) ya está tomada en el proposal: una única mecánica para todos los usuarios.

Supabase emite tanto `{{ .TokenHash }}` (para links) como `{{ .Token }}` (código numérico — el proyecto de Grana lo tiene seteado a 8 dígitos, configurable en el dashboard) en los emails de confirmación y recovery — así que el cambio es de UX y routing, no de backend.

## Goals / Non-Goals

**Goals:**

- Una única mecánica de confirmación/recuperación (OTP) en web y mobile, con la misma UX y los mismos copy keys donde aplique.
- Eliminar el código muerto del callback de email y de la cookie de recovery una vez migrado el flujo.
- Habilitar signup y forgot-password en mobile sin introducir deep-link plumbing.
- Resend con cooldown visible para evitar que el usuario quede "atrapado" si el código no llega.

**Non-Goals:**

- Colapsar las dos pantallas de recovery (código + password nuevo) en una sola.
- UI de 6 boxes con auto-advance para el código.
- Extracción de un componente compartido a `packages/`.
- Cambios al esquema de `auth.users`, a las políticas RLS, o al perfil del usuario.
- Cambios al flujo de login fuera del CTA inline de "tu cuenta no está confirmada".

## Decisions

### 1. Mecánica Supabase: `signUp` → `verifyOtp` para confirmación, `resetPasswordForEmail` → `verifyOtp` para recovery

| Flujo | Trigger | Verificación |
|---|---|---|
| Confirmación de signup | `supabase.auth.signUp({ email, password, options: { data: { full_name } } })` — sin `emailRedirectTo` | `supabase.auth.verifyOtp({ email, token, type: 'signup' })` |
| Recovery | `supabase.auth.resetPasswordForEmail(email)` — sin `redirectTo` | `supabase.auth.verifyOtp({ email, token, type: 'recovery' })` |
| Resend signup | `supabase.auth.resend({ email, type: 'signup' })` | (mismo verifyOtp) |
| Resend recovery | `supabase.auth.resetPasswordForEmail(email)` (idempotente — re-emite el OTP) | (mismo verifyOtp) |

**Por qué `resetPasswordForEmail` sin `redirectTo` y no `signInWithOtp`:** ambos disparan un email con el `{{ .Token }}` poblado, pero `resetPasswordForEmail` se mapea al template `reset-password.html` y `signInWithOtp` se mapea al template "Magic Link". Mantener el template existente reduce el blast radius del change — solo tocamos los dos templates que la spec actual ya reclama (`confirm-signup`, `reset-password`).

**Alternativa considerada:** usar `signInWithOtp({ email, shouldCreateUser: false })` para recovery. Descartada por la razón anterior — agregaría un tercer template al mirror del repo.

### 2. Routing: dos rutas nuevas en web, cinco en mobile, callback borrado

**Web (`apps/web/app/(auth)/`):**

```
(auth)/
  signup/
    page.tsx                  ~ existe — al submit navega a /signup/verify
    signup-form.tsx
    verify/
      page.tsx                + nuevo — pantalla de ingreso de código de signup
      verify-form.tsx         + nuevo
  forgot-password/
    page.tsx                  ~ existe — al submit navega a /forgot-password/verify
    forgot-password-form.tsx
    verify/
      page.tsx                + nuevo — pantalla de ingreso de código de recovery
      verify-form.tsx         + nuevo
  reset-password/
    page.tsx                  ~ existe — gate por sesión amr=otp (no más cookie)
```

`/auth/callback/route.ts` se borra entero.

**Mobile (`apps/mobile/app/(auth)/`):**

```
(auth)/
  login.tsx              ~ existe — agregar CTA email_not_confirmed
  signup.tsx             + nuevo
  signup-verify.tsx      + nuevo — código de signup
  forgot-password.tsx    + nuevo
  recovery-verify.tsx    + nuevo — código de recovery
  new-password.tsx       + nuevo — password nuevo (post-verify)
```

**Alternativa considerada:** una sola ruta `/verify` parametrizada por query (`?type=signup` o `?type=recovery`). Descartada porque ofusca el flujo y hace que el copy localizado dependa de la query string. Dos rutas son más explícitas, lo único que se duplica es el shell — el componente de ingreso de código se reusa intra-app.

### 3. Componente de ingreso de código: una sola implementación por plataforma, parametrizada por `type`

Dentro de cada app vive un componente `<OtpVerifyForm type="signup" | "recovery" email={...} />` que encapsula:

- Validación del input (8 dígitos numéricos, schema en `@grana/validation`).
- Llamada a `verifyOtp` con el `type` correspondiente.
- Botón de resend con cooldown visible.
- Manejo de error (código inválido, expirado, rate-limited).
- Acción de éxito delegada al parent — el parent decide a dónde routear (login para signup, new-password para recovery).

Este componente vive duplicado entre web y mobile **a propósito** según la convención del proyecto: extraer a `packages/` solo cuando la duplicación real lo justifica y con confirmación previa. Acá la duplicación es 1:1 en cuanto a comportamiento pero las piezas de UI (form fields, alerts, submit button) son platform-specific (`apps/web/components/ui/*` vs los componentes mobile con NativeWind), así que el ROI de extraer sería bajo.

**Alternativa considerada:** extraer `<OtpVerifyForm />` headless a un package compartido. Descartada para este change, marcada como mejora futura.

### 4. Cooldown del resend: timer client-side, error del server como fallback

El cooldown lo lleva el cliente con un `useEffect` + `setInterval` que arranca cuando el usuario aterriza en la pantalla de código (lo dispara el submit anterior — `signUp`, `resetPasswordForEmail`, o `resend`). Default: 60 segundos, durante los cuales el botón de resend aparece deshabilitado con un contador en el label.

Si por algún motivo el cliente pierde el estado (refresh en web, kill de la app en mobile) y el usuario intenta resend antes de los 60s reales del server, Supabase responde con `over_email_send_rate_limit` y mostramos el error mapeado. **El server es la verdad**, el timer del cliente es UX.

**Por qué no leer el rate limit del server al entrar a la pantalla:** Supabase no expone el "tiempo restante" — solo rate-limita el próximo POST. Hacer un round-trip "fake" para descubrirlo sería peor.

**Persistencia entre navegaciones:** no se persiste. Si el usuario vuelve de una pantalla a otra dentro del flujo, el cooldown se resetea. Aceptable; el cap real lo pone el server.

### 5. Detección de `email_not_confirmed` desde el login: un único mapeo, CTA inline

Cuando `signInWithPassword` falla con `error.code === 'email_not_confirmed'`, el formulario de login renderiza:

```
<Alert variant="warning">
  {t('auth.errors.email_not_confirmed_with_resend')}
  <Button onClick={handleResendAndNavigate}>
    {t('auth.login.resend_confirmation_code')}
  </Button>
</Alert>
```

Al click:

1. Se llama a `supabase.auth.resend({ email, type: 'signup' })`.
2. Si Supabase responde OK, se navega a `/signup/verify?email=<email>` (web) o `signup-verify` (mobile) con el email en estado/query.
3. Si Supabase responde con rate-limit, se navega de todos modos y el cooldown del cliente toma el control (el usuario probablemente ya tiene un código vivo en su bandeja).

El código `email_not_confirmed` ya está mapeado en la spec actual a `auth.errors.email_not_confirmed`; **agregamos** la key `auth.errors.email_not_confirmed_with_resend` para no mezclar el copy del CTA con el mensaje genérico (que otros call sites podrían reusar).

### 6. Eliminación de la cookie `recovery_in_progress`, retención del claim `amr=otp`

Hoy el middleware tiene dos señales: cookie + claim. La cookie sobrevivía como compatibilidad porque la sesión de recovery vía `exchangeCodeForSession` no siempre traía el claim consistentemente. Con OTP directo, `verifyOtp({ type: 'recovery' })` produce una sesión con `amr=otp` de forma confiable.

El middleware queda con **una sola señal**: si la sesión tiene `amr=otp` y la URL no es `/reset-password`, redirige a `/reset-password`. La rama que setea/limpia la cookie se borra entera.

`/reset-password` deja de chequear la cookie. Solo chequea que `supabase.auth.getUser()` (client-side) devuelva una sesión y que su JWT tenga `amr=otp`. Si la sesión existe pero `amr !== 'otp'`, la página muestra "este link no es válido" — porque el usuario está logueado normalmente y no debería estar acá.

**Trade-off:** durante el deploy, los usuarios que ya estén "en una sesión de recovery" con la cookie vieja se quedan sin nada (la cookie se ignora, el middleware no la limpia ni nada). El blast radius es minúsculo — el TTL de la cookie eran 10 minutos. Igual hay que limpiar cualquier código que referencie la cookie por nombre para no dejar referencias muertas.

### 7. Mensaje one-shot post-confirmación: se mantiene

La spec actual define que tras confirmar el email, el usuario es redirigido a `/login?message=account_confirmed` y la página muestra "Tu cuenta fue confirmada, iniciá sesión". Mantenemos ese contrato — la única diferencia es que ahora el redirect lo dispara la pantalla de verify (client-side `useRouter().replace()`), no el callback server-side. Mobile usa la versión equivalente con expo-router: `router.replace('/login')` y un toast/state one-shot para mostrar el mismo mensaje.

### 8. Schemas y mensajes: dónde viven

- **`packages/validation`:** un nuevo schema `otpCodeSchema` (Yup) que valida string de exactamente 8 dígitos numéricos. Se reusa intra-app entre signup-verify y recovery-verify.
- **`packages/i18n-messages`:** nuevas keys agrupadas bajo `auth.verify.*` (copy de las pantallas), `auth.resend.*` (botón, cooldown, errores), `auth.errors.invalid_otp`, `auth.errors.otp_expired`, `auth.errors.over_email_send_rate_limit` (puede que ya exista), `auth.login.resend_confirmation_code`, `auth.errors.email_not_confirmed_with_resend`.

## Risks / Trade-offs

- **[Riesgo] Emails viejos con links rotos durante la ventana de deploy.** Mitigación: aceptamos el impacto (window pequeño, recovery es trivial — pedir un email nuevo). Se documenta como nota de deploy en `tasks.md`.

- **[Riesgo] El template del dashboard de Supabase queda desincronizado con el repo después del merge.** Mitigación: la regla del repo-como-source-of-truth ya está spec'eada en `auth`. El task de deploy explícitamente lista "actualizar templates en el dashboard" antes de mergear a `main`.

- **[Riesgo] El cooldown client-side se desincroniza del server.** Mitigación: surface el error de rate-limit del server con copy claro. El UX malo en este corner case es aceptable porque ocurre solo si el usuario navega/refresca a propósito durante el cooldown.

- **[Riesgo] Duplicación del componente `<OtpVerifyForm />` entre web y mobile genera drift.** Mitigación: aceptado conscientemente. Si aparece un tercer call site o la duplicación causa problemas, se extrae a un package en un change separado.

- **[Trade-off] Usar `resetPasswordForEmail` sin `redirectTo` mantiene el template existente, pero significa que el método ya no tiene un destino "natural" cuando alguien lo llama desde un futuro contexto web-link. No vemos casos así en el roadmap.**

- **[Trade-off] No persistir el cooldown entre navegaciones es UX pobre si el usuario sale y vuelve a la pantalla de código. Aceptado: el cap real está en el server, y persistirlo en sessionStorage/AsyncStorage agrega más código del que la mejora vale.**

## Open Questions

(ninguna bloqueante — todas las decisiones técnicas están tomadas. Las dudas marcadas como "a confirmar en design" en el brief original quedaron resueltas arriba.)

- Si durante la implementación se descubre que Supabase rate-limita más agresivo de lo asumido (60s no alcanzan), ajustar el default del cooldown del cliente.
- Confirmar empíricamente que `verifyOtp({ type: 'recovery' })` produce sesiones con `amr=otp` consistentemente. Si no, retomar la rama de la cookie como fallback — pero esto sería sorpresa y debería tirar para atrás la decisión 6.
