import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { SectionFallback } from '@/components/ui/section-fallback'
import { AccountsErrorBoundary } from './_components/accounts-error-boundary'
import { AccountsHeader } from './_components/accounts-header'
import { ActiveAccountsContainer } from './_components/active-accounts-container'
import { ArchivedAccountsContainer } from './_components/archived-accounts-container'

const AccountsPage = async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const t = await getTranslations('accounts.route')

  return (
    <div className="flex flex-col gap-6">
      <AccountsHeader />

      <AccountsErrorBoundary>
        <div className="flex flex-col gap-6">
          <Suspense
            fallback={
              <SectionFallback
                message={t('active_loading')}
                className="min-h-[14rem]"
              />
            }
          >
            <ActiveAccountsContainer />
          </Suspense>

          <Suspense
            fallback={
              <SectionFallback
                message={t('archived_loading')}
                className="min-h-[3rem]"
              />
            }
          >
            <ArchivedAccountsContainer />
          </Suspense>
        </div>
      </AccountsErrorBoundary>
    </div>
  )
}

export default AccountsPage
