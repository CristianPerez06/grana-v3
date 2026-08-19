import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { buildMovementEditContext } from '@/lib/transactions/edit-context'
import { MovementForm } from '@/lib/transactions/components/movement-form'

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

  const fromQuery = from ? `?from=${encodeURIComponent(from)}` : ''
  const detailHref = `/transactions/${txId}${fromQuery}`

  const data = await buildMovementEditContext(txId, detailHref)
  if (!data) notFound()
  const { edit, categories, household, accounts } = data

  // No back-link here: the segment's layout already mounts `EditChrome`, whose
  // `PageHeader` carries the title and the "← Detalle" affordance. This page used
  // to add a second one pointing at /transactions — two stacked arrows going to
  // different places, a leftover from before the detail grew its own topbar.
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <MovementForm accounts={accounts} categories={categories} edit={edit} household={household} />
    </div>
  )
}

export default EditMovementPage
