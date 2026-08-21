import { View } from 'react-native'
import { SkeletonBlock } from '../ui/SkeletonBlock'
import { useT } from '../../lib/locale-context'

// Loading skeleton for `/transactions/recurring/new` while the accounts,
// categories and household catalogs resolve. Mirrors `RecurrenceForm`: type
// segmented control, amount, account and category selects, description, start
// date, the frequency card and the submit button.

const FieldSkeleton = ({ control = 'input' }: { control?: 'input' | 'select' }) => (
  <View className="flex-col gap-1.5">
    <SkeletonBlock className="h-3.5 w-24 rounded" />
    <SkeletonBlock className={`w-full rounded-lg ${control === 'select' ? 'h-12' : 'h-11'}`} />
  </View>
)

export const RecurrenceFormSkeleton = () => {
  const t = useT()
  return (
    <View
      accessibilityState={{ busy: true }}
      accessibilityLabel={t('recurrences.route.form_loading')}
      className="flex-col gap-5"
    >
      <View className="flex-col gap-1.5">
        <SkeletonBlock className="h-3.5 w-16 rounded" />
        <SkeletonBlock className="h-10 w-full rounded-xl" />
      </View>

      {/* Amount */}
      <View className="flex-col gap-1.5">
        <SkeletonBlock className="h-3.5 w-20 rounded" />
        <SkeletonBlock className="h-12 w-full rounded-lg" />
      </View>

      <FieldSkeleton control="select" />
      <FieldSkeleton control="select" />
      <FieldSkeleton />
      <FieldSkeleton />

      {/* Frequency card */}
      <View className="flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <SkeletonBlock className="h-3.5 w-28 rounded" />
        <SkeletonBlock className="h-10 w-full rounded-xl" />
        <SkeletonBlock className="h-3 w-3/5 rounded" />
      </View>

      <SkeletonBlock className="h-11 w-full rounded-xl" />
    </View>
  )
}
