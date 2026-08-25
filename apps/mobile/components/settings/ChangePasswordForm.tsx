import { useState } from 'react'
import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { CheckCircle2 } from 'lucide-react-native'
import { changePasswordSchema, ValidationError } from '@grana/validation'
import { Button } from '../ui/Button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/Card'
import { FormError } from '../ui/FormError'
import { PasswordField } from '../ui/PasswordField'
import { AUTH_INPUT_CLASS } from '../../lib/auth-class-names'
import { colors } from '../../lib/colors'
import { supabase } from '../../lib/supabase'
import { verifyCurrentPassword } from '../../lib/supabase-verification'
import { supabaseErrorKey } from '../../lib/supabase-errors'
import { useT } from '../../lib/locale-context'
import { translateValidationMessage } from '../../lib/yup-locale'

type Field = 'currentPassword' | 'password' | 'confirmPassword'
type FieldErrors = Partial<Record<Field, string>>

export function ChangePasswordForm() {
  const t = useT()
  const router = useRouter()

  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // `null` while the form is live; once set, the form unmounts and the success
  // card takes its place. `othersRevoked` carries the outcome of the last,
  // best-effort step — the password change already happened either way.
  const [outcome, setOutcome] = useState<{ othersRevoked: boolean } | null>(null)

  async function handleSubmit() {
    setFieldErrors({})
    setFormError(null)

    try {
      await changePasswordSchema.validate(
        { currentPassword, password, confirmPassword },
        { abortEarly: false },
      )
    } catch (err) {
      if (err instanceof ValidationError) {
        const errs: FieldErrors = {}
        for (const issue of err.inner) {
          if (issue.path && !errs[issue.path as Field]) {
            errs[issue.path as Field] = translateValidationMessage(issue.message)
          }
        }
        setFieldErrors(errs)
      }
      return
    }

    setLoading(true)

    const { data: userData } = await supabase.auth.getUser()
    const email = userData.user?.email
    if (!email) {
      setLoading(false)
      setFormError(t('auth.errors.generic'))
      return
    }

    // 1. Verify the current password on a throwaway client, so the live
    //    session survives untouched whatever happens next.
    const verifyError = await verifyCurrentPassword(email, currentPassword)
    if (verifyError) {
      setLoading(false)
      if (verifyError.code === 'invalid_credentials') {
        // Not the shared error mapper: its copy for this code names the email
        // ("Email o contraseña incorrectos"), which is right for the login
        // screen and misleading here — the only thing to fix is this field.
        setFieldErrors({
          currentPassword: t('settings.security.change_password.errors.current_incorrect'),
        })
      } else {
        setFormError(t(supabaseErrorKey(verifyError)))
      }
      return
    }

    // 2. The irreversible step.
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setLoading(false)
      setFormError(t(supabaseErrorKey(updateError)))
      return
    }

    // 3. Revoke every other device. `scope: 'others'` is load-bearing: the SDK
    //    default is 'global', which would sign the user out right here — and
    //    on mobile the root layout's `onAuthStateChange` would bounce them to
    //    the login screen. 'others' fires no SIGNED_OUT event. Failure is
    //    reported on the success card, never swallowed: the password did change.
    const { error: revokeError } = await supabase.auth.signOut({ scope: 'others' })
    setLoading(false)
    setOutcome({ othersRevoked: !revokeError })
  }

  if (outcome) {
    return (
      <Card>
        <CardHeader className="flex-row items-center gap-3">
          <CheckCircle2 size={22} strokeWidth={2} color={colors.positive} />
          <CardTitle>{t('settings.security.change_password.success_title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Text
            className={`text-sm ${outcome.othersRevoked ? 'text-text-muted' : 'text-warning'}`}
          >
            {outcome.othersRevoked
              ? t('settings.security.change_password.success_body')
              : t('settings.security.change_password.success_body_revoke_failed')}
          </Text>
        </CardContent>
        <CardFooter>
          <Button
            variant="secondary"
            title={t('settings.security.change_password.back_cta')}
            onPress={() => router.replace('/(app)/settings')}
          />
        </CardFooter>
      </Card>
    )
  }

  return (
    <View className="flex-col gap-4">
      <PasswordField
        label={t('settings.security.change_password.current_label')}
        value={currentPassword}
        onChangeText={setCurrentPassword}
        placeholder="••••••••"
        autoComplete="current-password"
        toggleLabelShow={t('settings.security.change_password.toggle_show')}
        toggleLabelHide={t('settings.security.change_password.toggle_hide')}
        error={fieldErrors.currentPassword}
        className={AUTH_INPUT_CLASS}
      />

      <PasswordField
        label={t('settings.security.change_password.new_label')}
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        autoComplete="new-password"
        toggleLabelShow={t('settings.security.change_password.toggle_show')}
        toggleLabelHide={t('settings.security.change_password.toggle_hide')}
        error={fieldErrors.password}
        className={AUTH_INPUT_CLASS}
      />

      <PasswordField
        label={t('settings.security.change_password.confirm_label')}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="••••••••"
        autoComplete="new-password"
        toggleLabelShow={t('settings.security.change_password.toggle_show')}
        toggleLabelHide={t('settings.security.change_password.toggle_hide')}
        error={fieldErrors.confirmPassword}
        className={AUTH_INPUT_CLASS}
      />

      <FormError message={formError} />

      <View className="mt-2">
        <Button
          title={t('settings.security.change_password.submit')}
          onPress={handleSubmit}
          loading={loading}
        />
      </View>
    </View>
  )
}
