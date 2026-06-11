import { Text, View } from 'react-native'
import { getCategoryName, type CategoryWithSubcategories } from '../../lib/categories'
import { useT } from '../../lib/locale-context'
import { CategoryRow } from './CategoryRow'

type Props = {
  categories: CategoryWithSubcategories[]
  onChanged?: () => void
}

export function CategoryList({ categories, onChanged }: Props) {
  const t = useT()
  const system = categories.filter((c) => c.user_id === null)
  const own = categories.filter((c) => c.user_id !== null)

  if (categories.length === 0) {
    return (
      <View className="py-12">
        <Text className="text-center text-sm text-text-soft">
          {t('settings.categories.list.empty')}
        </Text>
      </View>
    )
  }

  return (
    <View className="flex-col gap-[26px]">
      {system.length > 0 && (
        <Group heading={t('settings.categories.list.system_heading')}>
          {system.map((category, index) => (
            <View
              key={category.id}
              className={index === 0 ? '' : 'border-t border-border-soft'}
            >
              <CategoryRow
                category={category}
                displayName={getCategoryName(category, t)}
                subcategoryCount={category.subcategories.filter((s) => s.is_active).length}
                isSystem
                onChanged={onChanged}
              />
            </View>
          ))}
        </Group>
      )}

      {own.length > 0 && (
        <Group heading={t('settings.categories.list.user_heading')}>
          {own.map((category, index) => (
            <View
              key={category.id}
              className={index === 0 ? '' : 'border-t border-border-soft'}
            >
              <CategoryRow
                category={category}
                displayName={getCategoryName(category, t)}
                subcategoryCount={category.subcategories.filter((s) => s.is_active).length}
                isSystem={false}
                onChanged={onChanged}
              />
            </View>
          ))}
        </Group>
      )}
    </View>
  )
}

function Group({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <View className="flex-col gap-2.5">
      <Text className="text-xs font-extrabold uppercase tracking-[0.08em] text-text-muted">
        {heading}
      </Text>
      <View className="overflow-hidden rounded-[18px] border border-border bg-card">
        {children}
      </View>
    </View>
  )
}
