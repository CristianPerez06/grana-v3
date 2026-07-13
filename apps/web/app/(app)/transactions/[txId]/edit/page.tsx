import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { buildMovementEditContext } from '@/lib/transactions/edit-context'
import { MovementForm } from '@/lib/transactions/components/movement-form'
import { TxBackLink } from '../_components/tx-back-link'

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

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <Suspense fallback={<div className="px-3.5 pb-1.5 pt-3.5" aria-hidden />}>
        <TxBackLink />
      </Suspense>
      <MovementForm accounts={accounts} categories={categories} edit={edit} household={household} />
    </div>
  )
}

export default EditMovementPage
