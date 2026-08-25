## 1. Diseño

- [x] 1.1 Crear `docs/design/settings-password/` siguiendo la estructura de `docs/design/settings/`: `README.md`, `shared.css`, `web/settings-password.html`, `mobile/settings-password.html`, `components/`
- [x] 1.2 `components/security-section.html`: la sección nueva de la raíz de `/settings` — título uppercase, fila con CTA + descripción, chevron a la derecha, simétrica con `categories-link-row.html`
- [x] 1.3 `components/change-password-form.html`: los tres campos con el toggle de visibilidad, el error de campo sobre "Contraseña actual" y el bloque de error de formulario
- [x] 1.4 `components/success-card.html`: los **dos** estados de la card de éxito (revocación OK y revocación fallida) y el CTA "Volver a ajustes"
- [x] 1.5 Traducir el mock a tokens del design system (`bg-card`, `border-border`, `text-text-muted`, `text-error`…) — ningún hex literal
- [x] 1.6 El `README.md` deja explícito que el mock es no-autoritativo y lista los archivos de implementación inspeccionados

## 2. Spec

- [x] 2.1 Delta `specs/auth/spec.md` con el requirement `ADDED` del cambio de contraseña desde el área autenticada: secuencia de tres pasos, cliente descartable, `scope: 'others'`, card de éxito con dos estados, ubicación de cada error
- [x] 2.2 Delta `specs/settings/spec.md` con los dos requirements `ADDED` (sección Seguridad y chrome de la ruta hija) y el `MODIFIED` de la pantalla de settings mobile (cuarta sección + cláusula de `SafeAreaView` acotada a las pantallas que componen el árbol a mano)
- [x] 2.3 `openspec validate add-settings-password-change` pasa

## 3. Capa compartida

- [x] 3.1 `packages/validation/src/auth.ts`: agregar `changePasswordSchema` = `resetSchema` + `currentPassword: yup.string().label('current_password').required()`, reusando `passwordRules` para la nueva; exportar `ChangePasswordInput`
- [x] 3.2 `packages/validation/src/index.ts`: exportar schema y tipo
- [x] 3.3 Verificado: los `label()` se pasan a los mensajes de Yup como `{field}`, pero ningún mensaje del catálogo `validation` interpola esa variable, así que la etiqueta nunca se renderiza y `current_password` no necesita clave propia
- [x] 3.4 `packages/i18n-messages/src/es.json` y `en.json`: namespace `settings.security` con `label`, `change_password.{cta,description,title,current_label,new_label,confirm_label,submit,success_title,success_body,success_body_revoke_failed,back_cta,toggle_show,toggle_hide}`
- [x] 3.5 Confirmar paridad de catálogos: el type `Messages = typeof es` no debe romper `typecheck` con `en.json`

## 4. Web

- [x] 4.1 `apps/web/lib/supabase/`: helper del cliente de verificación con `createClient` de `@grana/supabase` y `auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }`. **No** `createBrowserClient` de `@supabase/ssr` — persistiría cookies de auth
- [x] 4.2 `apps/web/app/(app)/settings/page.tsx`: agregar la `SettingsSection` "Seguridad" al final, con el `Link` a `/settings/password` en el mismo formato que la fila de Categorías (label + descripción + `ChevronRight`)
- [x] 4.3 `apps/web/app/(app)/settings/password/page.tsx`: Server Component que lee las traducciones y monta `PageHeader` con `title` + `backLink={{ href: '/settings', label: t('settings.title') }}`, más el form
- [x] 4.4 `apps/web/app/(app)/settings/password/_components/change-password-form.tsx`: Client Component con `useForm` + `yupResolver(changePasswordSchema)` y tres `PasswordField` (pasándoles `toggleLabelShow`/`toggleLabelHide` traducidos)
- [x] 4.5 Implementar la secuencia: verificar con el cliente descartable → `updateUser` → `signOut({ scope: 'others' })`, con el `scope` explícito
- [x] 4.6 Renderizar `invalid_credentials` como error del campo "Contraseña actual" (`setError('currentPassword', …)`) y el resto en el `Alert` del formulario
- [x] 4.7 Al completar el paso 2, desmontar el form y renderizar la card de éxito con el body que corresponda al resultado del paso 3, con CTA a `/settings`
- [x] 4.8 Verificar que el `SettingsHeader` del layout retorna `null` en `/settings/password` (compara pathname exacto) y que no hay doble header

## 5. Mobile

- [x] 5.1 `apps/mobile/lib/`: helper del cliente de verificación con `createClient` de `@grana/supabase` + `persistSession: false` (sin el `ExpoSecureStoreAdapter`)
- [x] 5.2 `apps/mobile/app/(app)/settings/index.tsx`: agregar la `SettingsSection` "Seguridad" al final, con el `Pressable` a `/(app)/settings/password` en el mismo formato que la fila de Categorías
- [x] 5.3 `apps/mobile/app/(app)/settings/password.tsx`: pantalla sobre `FormScreen` con `title` + `backLink={{ href: '/(app)/settings', label: t('settings.title') }}`, sin `SafeAreaView edges={['top']}` propio
- [x] 5.4 `apps/mobile/components/settings/ChangePasswordForm.tsx`: validación con `changePasswordSchema.validate({ abortEarly: false })` y mapeo de `err.inner` a errores por campo, siguiendo el patrón de `new-password.tsx`
- [x] 5.5 Misma secuencia de tres pasos, `scope: 'others'` explícito, misma ubicación de errores. Los errores de formulario NO usan `mapSupabaseError` (devuelve español hardcodeado): se agregó `supabaseErrorKey` a `apps/mobile/lib/supabase-errors.ts`, gemelo del de web, que devuelve la clave i18n para traducir con `useT()`
- [x] 5.6 Card de éxito con los dos bodies y CTA a `/(app)/settings`
- [x] 5.7 Todo el texto vía `useT()` — incluidos los labels del toggle de `PasswordField`, que si no caen a los defaults `'Ver'` / `'Ocultar'` hardcodeados en el componente

## 6. Verificación funcional

- [ ] 6.1 Camino feliz en web: contraseña cambiada, card de éxito, y navegar a `/dashboard` **no** redirige a `/login`
- [ ] 6.2 Camino feliz en mobile: card de éxito y la app **no** salta a `(auth)/login` (si salta, el `scope` quedó en `'global'`)
- [ ] 6.3 Dos dispositivos: cambiar en A y confirmar que B pierde la sesión al refrescar el token; A sigue adentro
- [ ] 6.4 Contraseña actual incorrecta: error sobre el campo, sin llamada a `updateUser`, contraseña sin cambios
- [ ] 6.5 Contraseña nueva igual a la actual: mensaje de `same_password` a nivel formulario, form montado, sin `signOut`
- [ ] 6.6 Confirmación distinta: error de validación local, cero llamadas a Supabase (verificable en la pestaña de red / logs)
- [ ] 6.7 Cortar la red entre el paso 2 y el 3: aparece la card con el body de revocación fallida, no el de éxito completo
- [ ] 6.8 Tantear varias veces la contraseña actual: `over_request_rate_limit` se muestra traducido, sin romper la pantalla
- [ ] 6.9 Confirmar que después de una verificación exitosa las cookies de auth (web) y `expo-secure-store` (mobile) no cambiaron
- [ ] 6.10 Salir con el back-link a mitad del formulario y volver a entrar: el form arranca limpio
- [ ] 6.11 Las dos pantallas en `en`: todo el copy propio del change traducido, incluidos los `accessibilityLabel` / `aria-label` del toggle de visibilidad. **Excepción conocida y esperada en mobile**: los mensajes base de Yup (`required`, `min`, `email`) salen en español por `apps/mobile/lib/yup-locale.ts` — deuda preexistente, fuera de alcance (ver Non-Goals). Web sí los muestra traducidos
- [ ] 6.12 Mobile: el teclado no tapa el campo enfocado ni el botón de guardar
- [x] 6.13 `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm lint:mobile`, `pnpm typecheck:mobile` y `pnpm openspec:check` en verde

## 7. Archivo

- [ ] 7.1 Mover la carpeta a `openspec/changes/archive/<fecha>-add-settings-password-change/`
- [ ] 7.2 Integrar los deltas en `openspec/specs/auth/spec.md` y `openspec/specs/settings/spec.md` (sin secciones de delta en el master)
- [ ] 7.3 `pnpm openspec:check` pasa en la rama
