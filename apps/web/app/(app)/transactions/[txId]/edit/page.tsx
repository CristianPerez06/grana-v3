import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { buildMovementEditContext } from '@/lib/transactions/edit-context'
import { PageHeader } from '@/components/ui/page-header'
import { MovementForm } from '../../new/_components/movement-form'

type Props = {
  params: Promise<{ txId: string }>
  searchParams: Promise<{ from?: string }>
}

const EditMovementPage = async ({ params, searchParams }: Props) => {
  const { txId } = await params
  const { from } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const t = await getTranslations('transactions')

  // Canonical detail keeps the perspective via `?from=`.
  const fromQuery = from ? `?from=${encodeURIComponent(from)}` : ''
  const detailHref = `/transactions/${txId}${fromQuery}`

  const data = await buildMovementEditContext(txId, detailHref)
  if (!data) notFound()
  const { edit, categories } = data

  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <PageHeader
        title={t('edit_title')}
        backLink={{ href: detailHref, label: t('detail_back_label') }}
      />

      <MovementForm accounts={[]} categories={categories} edit={edit} />
    </div>
  )
}

export default EditMovementPage
