import { getTranslations } from 'next-intl/server'
import { PageHeader } from '@/components/ui/page-header'
import { ChangePasswordForm } from './_components/change-password-form'

// The `/settings` layout mounts `SettingsHeader`, which renders only when the
// pathname is exactly `/settings` — so this child route owns its own header
// and there is no double-header to dodge.
const ChangePasswordPage = async () => {
  const t = await getTranslations('settings')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('security.change_password.title')}
        backLink={{ href: '/settings', label: t('title') }}
      />
      <ChangePasswordForm />
    </div>
  )
}

export default ChangePasswordPage
