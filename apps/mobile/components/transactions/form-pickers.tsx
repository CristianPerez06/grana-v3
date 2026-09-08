import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { ChevronLeft, ChevronRight, Tag } from 'lucide-react-native'
import {
  selectableSubcategories,
  type CategoryWithSubcategories,
  type MovementFormAccount,
} from '@grana/movement-form'
import { Label } from '../ui/Label'
import { AccountAvatar } from '../ui/AccountAvatar'
import { SelectField, SheetRow } from '../ui/SelectField'
import { SelectSheet } from '../ui/SelectSheet'
import { Segmented } from '../ui/Segmented'
import { colors } from '../../lib/colors'
import { useT } from '../../lib/locale-context'

type Subcategory = CategoryWithSubcategories['subcategories'][number]

const CURRENCY_SYMBOL: Record<'ARS' | 'USD', string> = { ARS: '$', USD: 'U$D' }
// Balance across the account's active currencies, e.g. "-$12.345 · U$D 100".
// Sign before the symbol; a space after the multi-char USD code. Cash/bank only
// — credit cards are off-ledger and carry no available balance.
const formatBalance = (a: MovementFormAccount): string =>
  a.activeCurrencies
    .map((c) => {
      const n = a.balances[c] ?? 0
      const sign = n < 0 ? '-' : ''
      const amount = Math.abs(n).toLocaleString('es-AR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })
      return `${sign}${CURRENCY_SYMBOL[c]}${c === 'USD' ? ' ' : ''}${amount}`
    })
    .join(' · ')

// Account picker: compact trigger (avatar + name) that opens a sheet with the
// account list. Shared by the movement form (source / transfer destination /
// reimbursement credit-to) and the recurrence create form.
export function AccountSelectField({
  label,
  accounts,
  selectedId,
  onSelect,
  grouped = false,
}: {
  label: string
  accounts: MovementFormAccount[]
  selectedId: string
  onSelect: (id: string) => void
  // Borderless label-left / value-right row inside the grouped field card.
  grouped?: boolean
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const selected = accounts.find((a) => a.id === selectedId)

  return (
    <>
      {grouped ? (
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          className="flex-row items-center justify-between gap-3 px-4 py-3"
        >
          <Text className="text-[13px] font-semibold text-text-muted">{label}</Text>
          <View className="flex-1 flex-row items-center justify-end gap-2">
            {selected ? (
              <>
                {selected.avatar && <AccountAvatar {...selected.avatar} size="sm" />}
                <Text className="text-sm font-semibold text-text" numberOfLines={1}>
                  {selected.institutionName ?? selected.name}
                </Text>
              </>
            ) : (
              <Text className="text-sm text-text-soft">
                {t('transactions.placeholders.account')}
              </Text>
            )}
            <ChevronRight size={18} color={colors.textSoft} />
          </View>
        </Pressable>
      ) : (
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
        </View>
      )}
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
    </>
  )
}

// Account picker organized by family (design D10): when the eligible accounts
// span both Débito/Efectivo and Crédito, a family toggle sits on top and the
// accounts of the active family show as chips. With a single account in a
// family, the toggle already selects it (no redundant chip). One family only ⇒
// no toggle, just the chips. Only rendered when there are ≥2 eligible accounts
// (the caller hides it otherwise). Avatars carry each institution's brand color.
export function AccountFamilySelect({
  label,
  accounts,
  selectedId,
  onSelect,
  grouped = false,
}: {
  label: string
  accounts: MovementFormAccount[]
  selectedId: string
  onSelect: (id: string) => void
  // Row presentation inside the grouped field card: uppercase eyebrow + row
  // padding instead of a standalone `<Label>` block (mirror of web's
  // accountFamilyRow inside fieldGroup).
  grouped?: boolean
}) {
  const t = useT()
  const debit = accounts.filter((a) => a.type !== 'credit')
  const credit = accounts.filter((a) => a.type === 'credit')
  const bothFamilies = debit.length > 0 && credit.length > 0
  const selected = accounts.find((a) => a.id === selectedId)
  const family: 'debit' | 'credit' = selected?.type === 'credit' ? 'credit' : 'debit'
  const list = family === 'credit' ? credit : debit

  // Switching family selects that family's first account (the toggle "is" the
  // account when a family holds a single one).
  const pickFamily = (next: string) => {
    const target = (next === 'credit' ? credit : debit)[0]
    if (target && target.id !== selectedId) onSelect(target.id)
  }

  return (
    <View className={grouped ? 'flex-col gap-2.5 px-4 py-3' : 'flex-col gap-1.5'}>
      {grouped ? (
        <Text className="text-[11px] font-bold uppercase tracking-wider text-text-soft">
          {label}
        </Text>
      ) : (
        <Label>{label}</Label>
      )}
      {bothFamilies && (
        <Segmented
          ariaLabel={label}
          value={family}
          onValueChange={pickFamily}
          options={[
            { value: 'debit', label: t('transactions.form.family_debit') },
            { value: 'credit', label: t('transactions.form.family_credit') },
          ]}
        />
      )}
      {family === 'credit' ? (
        // Credit cards carry no balance, so lay them out as compact chips side by
        // side — the saved vertical space goes to the installments row.
        <View className="flex-row flex-wrap gap-2">
          {list.map((a) => {
            const active = a.id === selectedId
            return (
              <Pressable
                key={a.id}
                onPress={() => onSelect(a.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                className={`flex-row items-center gap-1.5 rounded-lg border px-2.5 py-1 ${
                  active ? 'border-emerald bg-emerald-soft' : 'border-border bg-card'
                }`}
              >
                {a.avatar && <AccountAvatar {...a.avatar} size="sm" />}
                <Text
                  className={`text-[13px] font-semibold ${active ? 'text-emerald-deep' : 'text-text'}`}
                  numberOfLines={1}
                >
                  {a.institutionName ?? a.name}
                </Text>
              </Pressable>
            )
          })}
        </View>
      ) : (
        // Cash/bank: one full-width row per account — name left, balance right —
        // stacked vertically. The selected one is highlighted.
        <View className="flex-col gap-1.5">
          {list.map((a) => {
            const active = a.id === selectedId
            return (
              <Pressable
                key={a.id}
                onPress={() => onSelect(a.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                className={`flex-row items-center gap-2.5 rounded-xl border px-3 py-1.5 ${
                  active ? 'border-emerald bg-emerald-soft' : 'border-border bg-card'
                }`}
              >
                {a.avatar && <AccountAvatar {...a.avatar} size="sm" />}
                <Text
                  className={`flex-1 text-sm font-semibold ${active ? 'text-emerald-deep' : 'text-text'}`}
                  numberOfLines={1}
                >
                  {a.institutionName ?? a.name}
                </Text>
                {a.type !== 'credit' && (
                  <Text
                    className={`text-xs ${active ? 'text-emerald-deep' : 'text-text-muted'}`}
                    numberOfLines={1}
                  >
                    {formatBalance(a)}
                  </Text>
                )}
              </Pressable>
            )
          })}
        </View>
      )}
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
  compact = false,
  selectionIsActiveChip = false,
  grouped = false,
}: {
  categories: CategoryWithSubcategories[]
  categoryId: string
  subcategoryId: string
  onPick: (categoryId: string, subcategoryId: string) => void
  /** Compact mode: no label, "Elegir otra categoría" placeholder — used when
   *  frequent-classification chips carry the common case above this field. */
  compact?: boolean
  /** In compact mode, whether the current selection is already shown as an
   *  active chip (then this field stays as the generic "pick other" trigger). */
  selectionIsActiveChip?: boolean
  /** Row presentation inside the grouped field card: the same slim trigger as
   *  compact, but with card-row padding and no standalone wrapper. */
  grouped?: boolean
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

  // The slim, borderless "Elegir otra categoría" trigger is used both in compact
  // mode (below the frequent chips) and inside the grouped field card (card-row
  // padding). It shows the current selection when it isn't an active chip.
  const slim = compact || grouped
  return (
    <>
      {slim ? (
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          className={`flex-row items-center gap-2 ${grouped ? 'px-4 py-3' : 'py-1.5'}`}
        >
          <Tag size={16} color={colors.textSoft} />
          {selectedCat && !selectionIsActiveChip ? (
            <View className="flex-1 flex-row items-center gap-1">
              <Text className="text-[13px] font-semibold text-text" numberOfLines={1}>
                {selectedCat.name}
              </Text>
              {selectedSub && (
                <>
                  <Text className="text-text-soft">›</Text>
                  <Text className="text-[13px] text-text-muted" numberOfLines={1}>
                    {selectedSub.name}
                  </Text>
                </>
              )}
            </View>
          ) : (
            <Text className="flex-1 text-[13px] font-medium text-text-muted">
              {t('transactions.drawer.pick_other_category')}
            </Text>
          )}
          <ChevronRight size={16} color={colors.textSoft} />
        </Pressable>
      ) : (
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
        </View>
      )}
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
            // No forced drill: tapping the row assigns the bare category; the
            // chevron (its own Pressable — RN routes the touch to the child)
            // drills into subcategories for whoever wants to refine.
            return (
              <SheetRow
                primary={item.name}
                secondary={
                  // "Hogar" tells a household category apart from an own one with
                  // the same name (unique per scope, spec `categories`); mirror of
                  // the web picker's badge.
                  [
                    item.household_id != null ? t('settings.categories.household_badge') : null,
                    item.is_active === false ? t('transactions.drawer.archived') : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || undefined
                }
                selected={categoryId === item.id && !subcategoryId}
                trailing={
                  drillable ? (
                    <Pressable
                      onPress={() => setDrillId(item.id)}
                      hitSlop={12}
                      accessibilityRole="button"
                      accessibilityLabel={t('transactions.form.category_drill', {
                        category: item.name,
                      })}
                    >
                      <ChevronRight size={18} color={colors.textSoft} />
                    </Pressable>
                  ) : undefined
                }
                onPress={() => {
                  onPick(item.id, '')
                  close()
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
    </>
  )
}
