'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useQueries } from '@tanstack/react-query'
import { PageHeader } from '@/components/ui/page-header'
import { RegisterMovementButton } from '@/lib/transactions/components/register-movement-button'
import { createClient } from '@/lib/supabase/client'
import { getAccounts } from '@/lib/accounts/queries'
import { getAllCategories } from '@/lib/categories/queries'
import { getHousehold } from '@/lib/shared/queries'
import { QUERY_KEYS } from '@/lib/transactions/query-keys'

/**
 * Header for the /transactions route. Renders synchronously from first paint
 * and gates the "Registrar movimiento" CTA on the data the drawer needs to
 * open: `accounts`, `categories`, `household`. While any of the three is
 * pending the button is disabled; once they all resolve the button enables.
 *
 * The actual MovementDrawerProvider is mounted by `<MovementDrawerLoader>`
 * downstream — TanStack dedupes the queries between this component and the
 * loader by their shared queryKey, so the network cost is paid once.
 */
export function TransactionsHeader() {
  const t = useTranslations('transactions')
  const pathname = usePathname()

  const queries = useQueries({
    queries: [
      { queryKey: QUERY_KEYS.accountsList, queryFn: () => getAccounts(createClient()) },
      { queryKey: QUERY_KEYS.categoriesTree, queryFn: () => getAllCategories(createClient()) },
      { queryKey: QUERY_KEYS.householdDetail, queryFn: () => getHousehold(createClient()) },
    ],
  })

  // El layout monta este header en toda ruta bajo /transactions/**;
  // solo lo renderizamos en el root para evitar el doble-header con las pages hijas.
  if (pathname !== '/transactions') return null

  const drawerReady = queries.every((q) => q.data !== undefined)

  return (
    <PageHeader
      title={t('title')}
      descriptionExtras={
        <Link
          href="/transactions/recurring"
          className="inline-flex items-center gap-0.5 text-slate hover:opacity-80 transition-opacity font-medium"
        >
          {t('header.see_recurrences')}
          <ChevronRight size={13} className="mt-px" />
        </Link>
      }
      actions={<RegisterMovementButton disabled={!drawerReady} />}
    />
  )
}
