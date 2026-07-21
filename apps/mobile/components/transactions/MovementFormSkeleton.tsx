import { View } from 'react-native'
import { SkeletonBlock } from '../ui/SkeletonBlock'
import { useT } from '../../lib/locale-context'

// Loading skeleton for the new/edit movement form. Mirrors the resting anatomy
// of <MovementForm> (the `flex-col gap-5` stack of labelled field blocks + a
// bordered card + the submit button) so the screen does not jolt when the
// accounts / categories / household reads land. Two variants:
//   • create — the two-row tab-selector pill group sits on top.
//   • edit   — the immutable context-rows card sits on top instead (the tab
//              selector is hidden in edit mode).
// Native twin of the plain spinner these screens used before. Rendered inside
// the route's `bg-page` scroll body, which the pale skeleton blocks need for
// contrast.

// Label line + field control. Widths/heights track the real primitives: `Label`
// (text-sm), `Input`/`DateField` (h-11 rounded-lg) and the `SelectField`
// trigger (min-h-[52px] rounded-xl).
const FieldBlock = ({ control }: { control: 'input' | 'select' }) => (
  <View className="flex-col gap-1.5">
    <SkeletonBlock className="h-3.5 w-24 rounded" />
    <SkeletonBlock
      className={control === 'select' ? 'h-[52px] w-full rounded-xl' : 'h-11 w-full rounded-lg'}
    />
  </View>
)

// A bordered card with a title + toggle header (mirror of the reimbursement /
// repeat cards). The white `bg-card` surface gives the pale blocks contrast.
const CardBlock = () => (
  <View className="flex-col gap-3 rounded-xl border border-border bg-card p-4">
    <View className="flex-row items-center justify-between">
      <View className="flex-1 gap-2 pr-3">
        <SkeletonBlock className="h-4 w-40 rounded" />
        <SkeletonBlock className="h-3 w-56 rounded" />
      </View>
      <SkeletonBlock className="h-7 w-12 rounded-full" />
    </View>
  </View>
)

// The two-row wrapping tab-selector pill group (create only). Chip-shaped blocks
// on the page surface rather than inside the real `bg-border-soft` container —
// same fill as the blocks would leave no contrast.
const TAB_WIDTHS = ['w-16', 'w-16', 'w-24', 'w-20', 'w-24']
const TabSelectorBlock = () => (
  <View className="flex-row flex-wrap gap-1.5">
    {TAB_WIDTHS.map((w, i) => (
      <SkeletonBlock key={i} className={`h-9 ${w} rounded-lg`} />
    ))}
  </View>
)

// The immutable context-rows card shown at the top of the edit form.
const ContextRowsBlock = () => (
  <View className="overflow-hidden rounded-xl border border-border bg-card">
    {[0, 1, 2].map((i) => (
      <View
        key={i}
        className={`flex-row items-center justify-between gap-3 px-4 py-3 ${
          i > 0 ? 'border-t border-border-soft' : ''
        }`}
      >
        <SkeletonBlock className="h-3 w-20 rounded" />
        <SkeletonBlock className="h-3.5 w-28 rounded" />
      </View>
    ))}
  </View>
)

export const MovementFormSkeleton = ({ variant = 'create' }: { variant?: 'create' | 'edit' }) => {
  const t = useT()
  return (
    <View
      accessibilityState={{ busy: true }}
      accessibilityLabel={t('transactions.route.form_loading')}
      className="flex-col gap-5"
    >
      {variant === 'edit' ? <ContextRowsBlock /> : <TabSelectorBlock />}

      {/* Amount hero (Label + MoneyAmountInput) */}
      <View className="flex-col gap-1.5">
        <SkeletonBlock className="h-3.5 w-20 rounded" />
        <SkeletonBlock className="h-12 w-full rounded-lg" />
      </View>

      {/* Account · Date · Description · Category */}
      <FieldBlock control="select" />
      <FieldBlock control="input" />
      <FieldBlock control="input" />
      <FieldBlock control="select" />

      {/* Reimbursement / repeat card */}
      <CardBlock />

      {/* Submit button (h-14 rounded-2xl) */}
      <SkeletonBlock className="h-14 w-full rounded-2xl" />
    </View>
  )
}
