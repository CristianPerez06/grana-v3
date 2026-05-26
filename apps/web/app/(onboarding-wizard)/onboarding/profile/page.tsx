import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileForm } from './_components/profile-form'

const ProfilePage = async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: institutions } = await supabase
    .from('institutions')
    .select('id, name')
    .order('name', { ascending: true })

  return <ProfileForm institutions={institutions ?? []} />
}

export default ProfilePage
