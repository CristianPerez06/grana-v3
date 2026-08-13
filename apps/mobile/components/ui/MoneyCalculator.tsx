import { useState, type ReactNode } from 'react'
import { Keyboard, Pressable, Text, View } from 'react-native'
import { Calculator, Delete } from 'lucide-react-native'
import { evaluateMoneyExpression } from '@grana/validation'
import { BottomSheet } from './BottomSheet'
import { useT } from '../../lib/locale-context'
import { colors } from '../../lib/colors'

// MoneyCalculator — a calculator-icon trigger that opens a touch keypad (bottom
// sheet) for building an arithmetic expression, resolving it via the shared
// `evaluateMoneyExpression`, and filling the associated money field with the
// canonical result through its normal `onChangeText`. Native counterpart of
// web's `MoneyCalculatorPopover`: same evaluator and same commit path, but a
// tap-driven sheet instead of a Radix popover (no physical-keyboard handling).

type Props = {
  // Called with the canonical result (plain digits + optional `.` decimal) when
  // the user applies a computed value.
  onResult: (canonical: string) => void
  // Seed the keypad with the field's current value when opening.
  seed?: string
  // Reject a negative result (most money fields are non-negative).
  allowNegative?: boolean
}

const fmt = (n: number) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

type Variant = 'num' | 'op' | 'ctrl'

// Rows of the keypad (row-major, mirror of web's pad). `v` is appended to the
// expression (× ÷ and the es-AR `,` are understood by the evaluator); the `0`
// key is twice as wide.
const ROWS: { label: string; v: string; variant: Variant; flex?: number }[][] = [
  [
    { label: '7', v: '7', variant: 'num' },
    { label: '8', v: '8', variant: 'num' },
    { label: '9', v: '9', variant: 'num' },
    { label: '÷', v: '÷', variant: 'op' },
  ],
  [
    { label: '4', v: '4', variant: 'num' },
    { label: '5', v: '5', variant: 'num' },
    { label: '6', v: '6', variant: 'num' },
    { label: '×', v: '×', variant: 'op' },
  ],
  [
    { label: '1', v: '1', variant: 'num' },
    { label: '2', v: '2', variant: 'num' },
    { label: '3', v: '3', variant: 'num' },
    { label: '−', v: '-', variant: 'op' },
  ],
  [
    { label: '0', v: '0', variant: 'num', flex: 2 },
    { label: ',', v: ',', variant: 'num' },
    { label: '+', v: '+', variant: 'op' },
  ],
]

function CalcKey({
  onPress,
  variant,
  flex = 1,
  label,
  icon,
  accessibilityLabel,
}: {
  onPress: () => void
  variant: Variant
  flex?: number
  label?: string
  icon?: ReactNode
  accessibilityLabel?: string
}) {
  const bg = variant === 'num' ? 'bg-card' : 'bg-border-soft'
  const textColor =
    variant === 'op' ? 'text-navy' : variant === 'ctrl' ? 'text-text-muted' : 'text-text'
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={{ flex }}
      className={`h-12 items-center justify-center rounded-xl ${bg}`}
    >
      {icon ?? <Text className={`text-[18px] font-semibold ${textColor}`}>{label}</Text>}
    </Pressable>
  )
}

export function MoneyCalculator({ onResult, seed, allowNegative = false }: Props) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [expr, setExpr] = useState('')

  const preview = evaluateMoneyExpression(expr)
  const previewValid = preview !== null && (allowNegative || preview >= 0)

  const openSheet = () => {
    // The keypad takes over amount entry — drop the field's soft keyboard so the
    // two input modes don't fight (spec: "opening the keypad takes over entry").
    Keyboard.dismiss()
    setExpr(seed && seed !== '0' ? seed : '')
    setOpen(true)
  }
  const push = (v: string) => setExpr((e) => e + v)
  const backspace = () => setExpr((e) => e.slice(0, -1))
  const clear = () => setExpr('')
  const apply = () => {
    if (!previewValid || preview === null) return
    onResult(String(preview))
    setOpen(false)
  }

  return (
    <>
      <Pressable
        onPress={openSheet}
        accessibilityRole="button"
        accessibilityLabel={t('common.calculator.open')}
        hitSlop={6}
        className="h-8 w-8 items-center justify-center rounded-lg"
      >
        <Calculator size={18} color={colors.textSoft} />
      </Pressable>

      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        ariaLabel={t('common.calculator.title')}
      >
        <View className="px-5 pb-2 pt-3">
          {/* Display: running expression + live grouped result */}
          <View className="mb-3 rounded-xl bg-border-soft px-4 py-3">
            <Text
              className="min-h-[18px] text-right text-[13px] text-text-soft"
              numberOfLines={1}
            >
              {expr || ' '}
            </Text>
            <Text
              className="text-right text-[26px] font-bold text-text"
              numberOfLines={1}
            >
              {previewValid && preview !== null ? fmt(preview) : expr ? '—' : '0'}
            </Text>
          </View>

          {/* Controls row: clear · backspace · parentheses */}
          <View className="mb-2 flex-row gap-2">
            <CalcKey label="C" variant="ctrl" onPress={clear} accessibilityLabel={t('common.calculator.clear')} />
            <CalcKey
              variant="ctrl"
              onPress={backspace}
              accessibilityLabel={t('common.calculator.backspace')}
              icon={<Delete size={18} color={colors.textMuted} />}
            />
            <CalcKey label="(" variant="op" onPress={() => push('(')} />
            <CalcKey label=")" variant="op" onPress={() => push(')')} />
          </View>

          {/* Digit / operator rows */}
          {ROWS.map((row, i) => (
            <View key={i} className="mb-2 flex-row gap-2">
              {row.map((k) => (
                <CalcKey
                  key={k.label}
                  label={k.label}
                  variant={k.variant}
                  flex={k.flex}
                  onPress={() => push(k.v)}
                />
              ))}
            </View>
          ))}

          {/* Apply */}
          <Pressable
            onPress={apply}
            disabled={!previewValid}
            accessibilityRole="button"
            className={`h-12 w-full items-center justify-center rounded-xl bg-navy ${
              previewValid ? '' : 'opacity-40'
            }`}
          >
            <Text className="text-[16px] font-bold text-white">
              {t('common.calculator.apply')}
            </Text>
          </Pressable>
        </View>
      </BottomSheet>
    </>
  )
}
