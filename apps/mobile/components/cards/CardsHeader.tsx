import { Pressable, Text } from 'react-native'
import { useRouter } from 'expo-router'
import { Plus } from 'lucide-react-native'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '../ui/PageHeader'
import { supabase } from '../../lib/supabase'
import { getTodayAR } from '../../lib/date'
import { useLocale, useT } from '../../lib/locale-context'

export const CardsHeader = () => {
  const t = useT()
  const locale = useLocale()

  const monthLabel = getTodayAR().toLocaleDateString(
    locale === 'en' ? 'en-US' : 'es-AR',
    { month: 'long', year: 'numeric' },
  )

  const countQuery = useQuery({
    queryKey: ['cards', 'count'] as const,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('accounts')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'credit')
        .eq('is_active', true)
      if (error) throw error
      return count ?? 0
    },
  })

  const description =
    countQuery.data == null
      ? t('cards.route.subtitle_loading', { month: monthLabel })
      : t('cards.route.subtitle', { count: countQuery.data, month: monthLabel })

  return (
    <PageHeader
      title={t('cards.title')}
      description={description}
      // Root screen of a chromeless section: without the tab bar, this link is
      // the only visible way out. Fixed href over `router.back()` so the
      // destination is the same coming from the menu, a deep link or the
      // dashboard cards (see spec `page-header`).
      backLink={{ href: '/(app)/dashboard', label: t('nav.dashboard') }}
      actions={<AddCardButton label={t('cards.actions.add_label')} />}
    />
  )
}

// Header CTA: pushes the native /cards/new alta route. The route screen loads
// its own catalog (institutions + networks) and shows a spinner meanwhile, so
// the button itself stays enabled.
const AddCardButton = ({ label }: { label: string }) => {
  const router = useRouter()
  return (
    <Pressable
      onPress={() => router.push('/(app)/cards/new')}
      accessibilityRole="button"
      className="flex-row items-center gap-1.5 rounded-xl bg-emerald px-3 py-2"
    >
      <Plus size={16} color="white" strokeWidth={3} />
      <Text className="text-sm font-semibold text-white">{label}</Text>
    </Pressable>
  )
}

