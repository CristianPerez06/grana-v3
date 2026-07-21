import { getHousehold } from '@grana/shared'
import { SettingsForm } from './_components/settings-form'
import { createClient } from '@/lib/supabase/server'

export default async function SharedSettingsPage() {
  const household = await getHousehold(await createClient())
  if (!household) return null

  return <SettingsForm household={household} />
}
