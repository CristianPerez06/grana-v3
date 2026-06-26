import { useState } from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { parseMoneyInput } from '@grana/validation'
import type { TransactionType } from '@grana/transactions'
import { useT } from '../../lib/locale-context'
import { Label } from '../ui/Label'
import { MoneyAmountInput } from '../ui/MoneyAmountInput'
import type { AccountMovementFilters } from '../../lib/accounts/movement-filters'

export type CategoryOption = {
  id: string
  label: string
  subcategories: { id: string; label: string }[]
}

type Props = {
  visible: boolean
  onClose: () => void
  filters: AccountMovementFilters
  onApply: (next: AccountMovementFilters) => void
  categoryOptions: CategoryOption[]
}

// Type options offered (the ones with i18n labels; card-only kinds don't occur
// in cash/bank accounts).
const TYPE_OPTIONS: TransactionType[] = ['income', 'expense', 'transfer', 'adjustment', 'exchange']
const CURRENCY_OPTIONS: ('ARS' | 'USD')[] = ['ARS', 'USD']

function Chip({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`rounded-full border px-3 py-1.5 ${
        active ? 'border-emerald bg-emerald-soft' : 'border-border-soft bg-card'
      }`}
    >
      <Text className={`text-[13px] ${active ? 'font-semibold text-text' : 'text-text-soft'}`}>
        {label}
      </Text>
    </Pressable>
  )
}

// Bottom-of-screen filters form for the account movements list. Holds a local
// draft; Aplicar commits, Limpiar resets the content filters (month + query are
// owned by the toolbar and preserved).
export function MovementFiltersSheet({ visible, onClose, filters, onApply, categoryOptions }: Props) {
  const t = useT()
  const [type, setType] = useState<TransactionType | null>(filters.type)
  const [categoryId, setCategoryId] = useState<string | null>(filters.categoryId)
  const [subcategoryId, setSubcategoryId] = useState<string | null>(filters.subcategoryId)
  const [currency, setCurrency] = useState<'ARS' | 'USD' | null>(filters.currency)
  const [amountMin, setAmountMin] = useState(filters.amountMin != null ? String(filters.amountMin) : '')
  const [amountMax, setAmountMax] = useState(filters.amountMax != null ? String(filters.amountMax) : '')

  const selectedCategory = categoryOptions.find((c) => c.id === categoryId) ?? null

  const apply = () => {
    onApply({
      ...filters,
      type,
      categoryId,
      // Subcategory only meaningful with a category selected.
      subcategoryId: categoryId ? subcategoryId : null,
      currency,
      amountMin: amountMin.trim() ? parseMoneyInput(amountMin, { allowNegative: true }) : null,
      amountMax: amountMax.trim() ? parseMoneyInput(amountMax, { allowNegative: true }) : null,
    })
    onClose()
  }

  const clear = () => {
    setType(null)
    setCategoryId(null)
    setSubcategoryId(null)
    setCurrency(null)
    setAmountMin('')
    setAmountMax('')
  }

  return (
    <Modal visible={visible} onRequestClose={onClose} transparent animationType="slide">
      <Pressable
        onPress={onClose}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(11,26,43,0.30)' }}
      >
        <Pressable onPress={() => {}} className="rounded-t-2xl bg-page" style={{ maxHeight: '85%' }}>
          <View className="flex-row items-center justify-between border-b border-border px-5 py-4">
            <Text className="text-lg font-semibold text-text">
              {t('transactions.filters.filters_button')}
            </Text>
            <Pressable onPress={onClose} accessibilityRole="button">
              <Text className="text-sm font-medium text-emerald">
                {t('transactions.filters.close')}
              </Text>
            </Pressable>
          </View>

          <ScrollView contentContainerClassName="gap-5 px-5 py-5" keyboardShouldPersistTaps="handled">
            {/* Type */}
            <View className="gap-2">
              <Label>{t('transactions.filters.type')}</Label>
              <View className="flex-row flex-wrap gap-2">
                <Chip
                  label={t('transactions.filters.all_masc')}
                  active={type === null}
                  onPress={() => setType(null)}
                />
                {TYPE_OPTIONS.map((option) => (
                  <Chip
                    key={option}
                    label={t(`transactions.types.${option}`)}
                    active={type === option}
                    onPress={() => setType(option)}
                  />
                ))}
              </View>
            </View>

            {/* Category */}
            {categoryOptions.length > 0 && (
              <View className="gap-2">
                <Label>{t('transactions.filters.category')}</Label>
                <View className="flex-row flex-wrap gap-2">
                  <Chip
                    label={t('transactions.filters.all_fem')}
                    active={categoryId === null}
                    onPress={() => {
                      setCategoryId(null)
                      setSubcategoryId(null)
                    }}
                  />
                  {categoryOptions.map((option) => (
                    <Chip
                      key={option.id}
                      label={option.label}
                      active={categoryId === option.id}
                      onPress={() => {
                        setCategoryId(option.id)
                        setSubcategoryId(null)
                      }}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Subcategory (only when a category with subcategories is selected) */}
            {selectedCategory && selectedCategory.subcategories.length > 0 && (
              <View className="gap-2">
                <Label>{t('transactions.filters.subcategory')}</Label>
                <View className="flex-row flex-wrap gap-2">
                  <Chip
                    label={t('transactions.filters.all_fem')}
                    active={subcategoryId === null}
                    onPress={() => setSubcategoryId(null)}
                  />
                  {selectedCategory.subcategories.map((sub) => (
                    <Chip
                      key={sub.id}
                      label={sub.label}
                      active={subcategoryId === sub.id}
                      onPress={() => setSubcategoryId(sub.id)}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Currency */}
            <View className="gap-2">
              <Label>{t('transactions.filters.currency')}</Label>
              <View className="flex-row flex-wrap gap-2">
                <Chip
                  label={t('transactions.filters.all_fem')}
                  active={currency === null}
                  onPress={() => setCurrency(null)}
                />
                {CURRENCY_OPTIONS.map((code) => (
                  <Chip
                    key={code}
                    label={code}
                    active={currency === code}
                    onPress={() => setCurrency(code)}
                  />
                ))}
              </View>
            </View>

            {/* Amount range */}
            <View className="gap-2">
              <View className="flex-row gap-3">
                <View className="flex-1 gap-1.5">
                  <Label>{t('transactions.filters.amount_min')}</Label>
                  <MoneyAmountInput value={amountMin} onChangeText={setAmountMin} placeholder="0" />
                </View>
                <View className="flex-1 gap-1.5">
                  <Label>{t('transactions.filters.amount_max')}</Label>
                  <MoneyAmountInput value={amountMax} onChangeText={setAmountMax} placeholder="0" />
                </View>
              </View>
            </View>

            {/* Footer */}
            <View className="flex-row items-center gap-3 pt-1">
              <Pressable
                onPress={clear}
                accessibilityRole="button"
                className="rounded-xl bg-border-soft px-4 py-3"
              >
                <Text className="text-sm font-semibold text-text">
                  {t('transactions.filters.clear')}
                </Text>
              </Pressable>
              <Pressable
                onPress={apply}
                accessibilityRole="button"
                className="flex-1 items-center rounded-xl bg-emerald px-4 py-3"
              >
                <Text className="text-sm font-semibold text-white">
                  {t('transactions.filters.apply')}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
