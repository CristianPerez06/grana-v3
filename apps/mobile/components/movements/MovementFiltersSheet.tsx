import { useEffect, useState } from 'react'
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { parseMoneyInput } from '@grana/validation'
import {
  MOVEMENT_TYPE_KEYS,
  type MovementCurrencyFilter,
  type MovementFilterOptions,
  type MovementTypeFilter,
} from '@grana/transactions'
import { useT } from '../../lib/locale-context'
import { Label } from '../ui/Label'
import { MoneyAmountInput } from '../ui/MoneyAmountInput'
import { AccountAvatar } from '../ui/AccountAvatar'
import { FormSheetBody } from '../layout/FormSheetBody'
import type { MovementFiltersState } from '../../lib/transactions/feed-filters'

type Props = {
  visible: boolean
  onClose: () => void
  filters: MovementFiltersState
  onApply: (next: MovementFiltersState) => void
  /** Filter option catalog (`getMovementFilterOptions`), shared with web. */
  options: MovementFilterOptions | undefined
  /**
   * Reports the DRAFT category so the host can refetch the catalog for it. The
   * catalog only serves the active category's subcategories, and this sheet
   * commits on Aplicar — without this, picking a category would need a second
   * pass through the sheet before its subcategories appeared.
   */
  onDraftCategoryChange: (categoryId: string | null) => void
  /**
   * The account detail hides the account filter — it is already scoped to one
   * account. Mirror of web's `showAccountFilter`. Even when true, the block only
   * renders with 2+ accounts to disambiguate (web's `showAccount` rule): with a
   * single `Billetera` the account dimension is not offered at all.
   */
  showAccountFilter?: boolean
}

const CURRENCY_OPTIONS: MovementCurrencyFilter[] = ['ARS', 'USD']

// Cap for the scrolling body. A ScrollView inside an auto-height panel sizes
// itself to its content, so a percentage cap on the PANEL only clips it — the
// scroller still thinks its viewport is as tall as everything inside it and
// there is nothing left to scroll. The bound has to land on the scroller, in
// real pixels, exactly as `SelectSheet` caps its list.
const BODY_MAX_HEIGHT = Math.round(Dimensions.get('window').height * 0.7)

// Breathing room below the Aplicar/Limpiar row, on top of the OS inset — the
// home-indicator inset is 0 on Android phones with button navigation, so the
// inset alone can leave the footer flush against the screen edge.
const BOTTOM_SPACING = 20

function Chip({
  label,
  active,
  onPress,
  leading,
}: {
  label: string
  active: boolean
  onPress: () => void
  leading?: React.ReactNode
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 ${
        active ? 'border-emerald bg-emerald-soft' : 'border-border-soft bg-card'
      }`}
    >
      {leading}
      <Text className={`text-[13px] ${active ? 'font-semibold text-text' : 'text-text-soft'}`}>
        {label}
      </Text>
    </Pressable>
  )
}

// Bottom-of-screen filters form for the movements lists — shared by the global
// Movimientos feed and the account detail. Holds a local draft; Aplicar commits,
// Limpiar resets the content filters (month + query are owned by the toolbar and
// preserved).
//
// The sheet is agnostic about HOW the result is applied: the feed projects it to
// `MovementFilters` and lets the RPC filter, the account detail filters its
// loaded history in memory. Keeping that decision out of here is what lets one
// sheet serve both surfaces.
export function MovementFiltersSheet({
  visible,
  onClose,
  filters,
  onApply,
  options,
  onDraftCategoryChange,
  showAccountFilter = true,
}: Props) {
  const t = useT()
  const insets = useSafeAreaInsets()
  const [type, setType] = useState<MovementTypeFilter | null>(filters.type)
  const [accountId, setAccountId] = useState<string | null>(filters.accountId)
  const [categoryId, setCategoryId] = useState<string | null>(filters.categoryId)
  const [subcategoryId, setSubcategoryId] = useState<string | null>(filters.subcategoryId)
  const [currency, setCurrency] = useState<MovementCurrencyFilter | null>(filters.currency)
  const [amountMin, setAmountMin] = useState(filters.amountMin != null ? String(filters.amountMin) : '')
  const [amountMax, setAmountMax] = useState(filters.amountMax != null ? String(filters.amountMax) : '')

  // The sheet stays mounted so the slide-out animation survives, which means the
  // draft `useState` initializers only ever run once. Re-seed them from the
  // committed filters each time it opens, or a draft abandoned without Aplicar
  // would still be sitting there on the next open.
  useEffect(() => {
    if (!visible) return
    setType(filters.type)
    setAccountId(filters.accountId)
    setCategoryId(filters.categoryId)
    setSubcategoryId(filters.subcategoryId)
    setCurrency(filters.currency)
    setAmountMin(filters.amountMin != null ? String(filters.amountMin) : '')
    setAmountMax(filters.amountMax != null ? String(filters.amountMax) : '')
    onDraftCategoryChange(filters.categoryId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const accounts = options?.accounts ?? []
  const categories = options?.categories ?? []
  const subcategories = options?.subcategories ?? []

  // Category selection drives the subcategory drill, so it has to reach the host
  // (which owns the catalog query) even though everything else stays a draft.
  const pickCategory = (next: string | null) => {
    setCategoryId(next)
    setSubcategoryId(null)
    onDraftCategoryChange(next)
  }

  // System categories translate via `categories.{canonical}`; user ones use their
  // own name. Same rule as `resolveCategoryLabel`, over the catalog row shape.
  // A household category carries the "Hogar" mark, as in the web filters.
  const categoryLabel = (c: MovementFilterOptions['categories'][number]) => {
    const base = c.user_id === null ? t(`categories.${c.canonical_name}`) : c.name
    return c.household_id != null ? `${base} · ${t('settings.categories.household_badge')}` : base
  }
  const subcategoryLabel = (s: MovementFilterOptions['subcategories'][number]) =>
    s.user_id === null ? t(`subcategories.${s.canonical_name}`) : s.name

  const apply = () => {
    onApply({
      ...filters,
      type,
      accountId,
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
    setAccountId(null)
    pickCategory(null)
    setCurrency(null)
    setAmountMin('')
    setAmountMax('')
  }

  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      transparent
      animationType="slide"
      // Must match what the provider inside forces under edge-to-edge; the
      // keyboard-controller library requires the modal window to agree, and a
      // window that disagrees measures wrong. The footer is kept clear of the
      // navigation bar by the safe-area spacer at the end of the scroll content,
      // not by opting out of edge-to-edge.
      statusBarTranslucent
      navigationBarTranslucent
    >
      {/* The provider goes at the root of the window, not inside the panel: its
          view is `flex: 1` and would measure 0 in this content-sized sheet. */}
      <KeyboardProvider>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          {/* The scrim is a SIBLING behind the panel, not an ancestor of it.
              With the usual `Pressable` scrim wrapping a `Pressable` panel, the
              scrolling body hangs off two views that claim the touch responder
              on press — and every chip inside is a `Pressable` too. Starting a
              drag on one of them then races the scroller for the gesture, which
              is why parts of this sheet scrolled and parts did not. Behind and
              beside the panel, the scrim still closes on tap and competes with
              nothing. No tap-swallowing wrapper is needed either: the panel
              paints after the scrim, so its touches never reach it. */}
          <Pressable
            onPress={onClose}
            accessibilityLabel={t('transactions.filters.close')}
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(11,26,43,0.30)' }]}
          />
          {/* The panel hugs its content: the height bound lives on the scrolling
              body below, so a short sheet stays short and a long one scrolls. */}
          <View className="overflow-hidden rounded-t-2xl bg-page">
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

            <FormSheetBody maxHeight={BODY_MAX_HEIGHT} contentClassName="gap-5 px-5 pt-5">
              {/* Type — the DERIVED kind axis, not the transaction_type column:
                  it is what the shared `MovementFilters` contract declares, and
                  it carries the distinctions the row badges already show
                  (installments, statement payment, refund). */}
              <View className="gap-2">
                <Label>{t('transactions.filters.type')}</Label>
                <View className="flex-row flex-wrap gap-2">
                  <Chip
                    label={t('transactions.filters.all_masc')}
                    active={type === null}
                    onPress={() => setType(null)}
                  />
                  {MOVEMENT_TYPE_KEYS.map((option) => (
                    <Chip
                      key={option}
                      label={t(`transactions.movement_kinds.${option}`)}
                      active={type === option}
                      onPress={() => setType(option)}
                    />
                  ))}
                </View>
              </View>

              {/* Account — only where it disambiguates something. */}
              {showAccountFilter && accounts.length >= 2 && (
                <View className="gap-2">
                  <Label>{t('transactions.filters.account')}</Label>
                  <View className="flex-row flex-wrap gap-2">
                    <Chip
                      label={t('transactions.filters.all_fem')}
                      active={accountId === null}
                      onPress={() => setAccountId(null)}
                    />
                    {accounts.map((account) => (
                      <Chip
                        key={account.id}
                        label={account.name}
                        active={accountId === account.id}
                        onPress={() => setAccountId(account.id)}
                        leading={<AccountAvatar {...account.avatar} size="sm" />}
                      />
                    ))}
                  </View>
                </View>
              )}

              {/* Category */}
              {categories.length > 0 && (
                <View className="gap-2">
                  <Label>{t('transactions.filters.category')}</Label>
                  <View className="flex-row flex-wrap gap-2">
                    <Chip
                      label={t('transactions.filters.all_fem')}
                      active={categoryId === null}
                      onPress={() => pickCategory(null)}
                    />
                    {categories.map((option) => (
                      <Chip
                        key={option.id}
                        label={categoryLabel(option)}
                        active={categoryId === option.id}
                        onPress={() => pickCategory(option.id)}
                      />
                    ))}
                  </View>
                </View>
              )}

              {/* Subcategory — the catalog serves the drafted category's, so the
                  block appears as soon as a category is picked */}
              {categoryId && subcategories.length > 0 && (
                <View className="gap-2">
                  <Label>{t('transactions.filters.subcategory')}</Label>
                  <View className="flex-row flex-wrap gap-2">
                    <Chip
                      label={t('transactions.filters.all_fem')}
                      active={subcategoryId === null}
                      onPress={() => setSubcategoryId(null)}
                    />
                    {subcategories.map((sub) => (
                      <Chip
                        key={sub.id}
                        label={subcategoryLabel(sub)}
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

              {/* Bottom inset as a SPACER, not as content padding: NativeWind
                  maps `contentContainerClassName` onto `contentContainerStyle`,
                  so passing that style directly would collide with the class
                  names above. It rides inside the scroll content on purpose —
                  padding on the panel would push the footer up and clip it. */}
              <View style={{ height: insets.bottom + BOTTOM_SPACING }} />
            </FormSheetBody>
          </View>
        </View>
      </KeyboardProvider>
    </Modal>
  )
}
