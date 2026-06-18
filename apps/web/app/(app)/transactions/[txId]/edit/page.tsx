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
  const { edit, categories, household } = data

  return <MovementForm accounts={[]} categories={categories} edit={edit} household={household} />
}

export default EditMovementPage
