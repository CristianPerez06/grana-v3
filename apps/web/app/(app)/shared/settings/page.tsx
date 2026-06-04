import { getHousehold } from '@/lib/shared/queries'
import { SettingsForm } from './_components/settings-form'

export default async function SharedSettingsPage() {
  const household = await getHousehold()
  if (!household) return null

  return <SettingsForm household={household} />
}
