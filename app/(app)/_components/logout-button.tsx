'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { logoutAction } from '@/app/_actions/logout'

export const LogoutButton = () => {
  const t = useTranslations('common')
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="ghost" size="sm">
        {t('logout')}
      </Button>
    </form>
  )
}
