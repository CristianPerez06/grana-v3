import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PerfilForm } from './_components/perfil-form'

const PerfilPage = async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: institutions } = await supabase
    .from('institutions')
    .select('id, name')
    .order('name', { ascending: true })

  return <PerfilForm institutions={institutions ?? []} />
}

export default PerfilPage
