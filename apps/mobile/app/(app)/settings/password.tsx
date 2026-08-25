import { FormScreen } from '../../../components/layout/FormScreen'
import { ChangePasswordForm } from '../../../components/settings/ChangePasswordForm'
import { useT } from '../../../lib/locale-context'

export default function ChangePasswordScreen() {
  const t = useT()

  return (
    <FormScreen
      title={t('settings.security.change_password.title')}
      backLink={{ href: '/(app)/settings', label: t('settings.title') }}
    >
      <ChangePasswordForm />
    </FormScreen>
  )
}
