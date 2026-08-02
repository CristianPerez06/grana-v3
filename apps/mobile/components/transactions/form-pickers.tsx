import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import {
  selectableSubcategories,
  type CategoryWithSubcategories,
  type MovementFormAccount,
} from '@grana/movement-form'
import { Label } from '../ui/Label'
import { AccountAvatar } from '../ui/AccountAvatar'
import { SelectField, SheetRow } from '../ui/SelectField'
import { SelectSheet } from '../ui/SelectSheet'
import { colors } from '../../lib/colors'
import { useT } from '../../lib/locale-context'

type Subcategory = CategoryWithSubcategories['subcategories'][number]

// Account picker: compact trigger (avatar + name) that opens a sheet with the
// account list. Shared by the movement form (source / transfer destination /
// reimbursement credit-to) and the recurrence create form.
export function AccountSelectField({
  label,
  accounts,
  selectedId,
  onSelect,
}: {
  label: string
  accounts: MovementFormAccount[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const selected = accounts.find((a) => a.id === selectedId)

  return (
    <View className="flex-col gap-1.5">
      <Label>{label}</Label>
      <SelectField
        placeholder={t('transactions.placeholders.account')}
        onPress={() => setOpen(true)}
        value={
          selected ? (
            <View className="flex-row items-center gap-2">
              {selected.avatar && <AccountAvatar {...selected.avatar} size="sm" />}
              <Text className="flex-1 text-sm text-text" numberOfLines={1}>
                {selected.institutionName ?? selected.name}
              </Text>
            </View>
          ) : undefined
        }
      />
      <SelectSheet
        visible={open}
        onClose={() => setOpen(false)}
        title={label}
        items={accounts}
        keyExtractor={(a) => a.id}
        renderRow={(a) => (
          <SheetRow
            leading={a.avatar ? <AccountAvatar {...a.avatar} size="sm" /> : undefined}
            primary={a.institutionName ?? a.name}
            secondary={a.institutionName ? a.name : undefined}
            hint={a.type === 'credit' ? t('transactions.drawer.credit_hint') : undefined}
            selected={a.id === selectedId}
            onPress={() => {
              onSelect(a.id)
              setOpen(false)
            }}
          />
        )}
      />
    </View>
  )
}

// Category picker: trigger shows `Categoría › Subcategoría`; the sheet drills one
// level (categories → back + "whole category" + subcategories), mirror of web.
export function CategorySelectField({
  categories,
  categoryId,
  subcategoryId,
  onPick,
}: {
  categories: CategoryWithSubcategories[]
  categoryId: string
  subcategoryId: string
  onPick: (categoryId: string, subcategoryId: string) => void
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [drillId, setDrillId] = useState<string | null>(null)

  const selectedCat = categories.find((c) => c.id === categoryId)
  const selectedSub = selectedCat?.subcategories.find((s) => s.id === subcategoryId)
  const drillCat = drillId ? categories.find((c) => c.id === drillId) ?? null : null

  const close = () => {
    setOpen(false)
    setDrillId(null)
  }

  return (
    <View className="flex-col gap-1.5">
      <Label>{t('transactions.form.category_label')}</Label>
      <SelectField
        placeholder={t('transactions.placeholders.category')}
        onPress={() => setOpen(true)}
        value={
          selectedCat ? (
            <View className="flex-row items-center gap-1">
              <Text className="text-sm text-text" numberOfLines={1}>
                {selectedCat.name}
              </Text>
              {selectedSub && (
                <>
                  <Text className="text-text-soft">›</Text>
                  <Text className="text-sm text-text-muted" numberOfLines={1}>
                    {selectedSub.name}
                  </Text>
                </>
              )}
              {/* The value can be an archived row this movement was classified
                  with before it was archived — say so instead of showing it as
                  if it were still on offer. */}
              {(selectedCat.is_active === false || selectedSub?.is_active === false) && (
                <Text className="text-xs text-text-soft" numberOfLines={1}>
                  {`(${t('transactions.drawer.archived')})`}
                </Text>
              )}
            </View>
          ) : undefined
        }
      />
      <SelectSheet<CategoryWithSubcategories | Subcategory>
        visible={open}
        onClose={close}
        title={t('transactions.form.category_label')}
        items={drillCat ? drillCat.subcategories : categories}
        keyExtractor={(item) => item.id}
        header={
          drillCat ? (
            <View className="pb-1">
              <Pressable
                onPress={() => setDrillId(null)}
                accessibilityRole="button"
                className="flex-row items-center gap-1.5 py-3"
              >
                <ChevronLeft size={18} color={colors.textMuted} />
                <Text className="text-sm font-semibold text-text-muted">{drillCat.name}</Text>
              </Pressable>
              <SheetRow
                primary={t('transactions.drawer.whole_category')}
                selected={categoryId === drillCat.id && !subcategoryId}
                onPress={() => {
                  onPick(drillCat.id, '')
                  close()
                }}
              />
            </View>
          ) : undefined
        }
        renderRow={(item) => {
          if ('subcategories' in item) {
            // Only selectable subcategories make a category drillable: a grafted
            // archived one is this movement's current value, not an option.
            const drillable = selectableSubcategories(item).length > 0
            return (
              <SheetRow
                primary={item.name}
                secondary={
                  item.is_active === false ? t('transactions.drawer.archived') : undefined
                }
                selected={!drillable && categoryId === item.id}
                trailing={
                  drillable ? <ChevronRight size={18} color={colors.textSoft} /> : undefined
                }
                onPress={() => {
                  if (drillable) {
                    setDrillId(item.id)
                  } else {
                    onPick(item.id, '')
                    close()
                  }
                }}
              />
            )
          }
          return (
            <SheetRow
              primary={item.name}
              secondary={item.is_active === false ? t('transactions.drawer.archived') : undefined}
              selected={subcategoryId === item.id}
              onPress={() => {
                if (drillCat) onPick(drillCat.id, item.id)
                close()
              }}
            />
          )
        }}
      />
    </View>
  )
}
