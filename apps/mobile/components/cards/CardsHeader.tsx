import { Pressable, Text } from 'react-native'
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
      actions={<AddCardPlaceholder label={t('cards.actions.add_label')} />}
    />
  )
}

// CTA placeholder: visually present, permanently disabled until /cards/new
// mobile exists. Matches the disabled-button pattern used in web while
// catalog queries load — same look, different reason.
const AddCardPlaceholder = ({ label }: { label: string }) => (
  <Pressable
    disabled
    accessibilityState={{ disabled: true }}
    className="flex-row items-center gap-1.5 rounded-xl bg-emerald px-3 py-2 opacity-50"
  >
    <Plus size={16} color="white" strokeWidth={3} />
    <Text className="text-sm font-semibold text-white">{label}</Text>
  </Pressable>
)

