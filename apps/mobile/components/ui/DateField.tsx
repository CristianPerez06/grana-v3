import { useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import { Calendar } from 'lucide-react-native'
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker'
import { useLocale, useT } from '../../lib/locale-context'
import { colors } from '../../lib/colors'

type Props = {
  /** Date-only ISO string (`YYYY-MM-DD`), or `''` when empty. */
  value: string
  onChange: (iso: string) => void
  placeholder?: string
  invalid?: boolean
  /**
   * Controlled open state. Pass together with `onOpenChange` to let a parent
   * own whether the picker is shown — used to keep sibling pickers (e.g. Cierre
   * / Vencimiento) mutually exclusive so opening one closes the other. Omit both
   * for the standalone, self-managed behavior.
   */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /**
   * Borderless trigger (leading calendar icon + text, no pill) for use inside a
   * grouped field card row. Omit for the standalone bordered field.
   */
  bare?: boolean
}

// `YYYY-MM-DD` ⇄ Date using LOCAL components so a date-only value never shifts a
// day across timezones (parsing the ISO string directly would treat it as UTC).
function isoToDate(iso: string): Date {
  if (!iso) return new Date()
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0)
}

function dateToISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Native date field: a tappable trigger that opens the platform DateTimePicker
// and emits `YYYY-MM-DD`. iOS renders an inline spinner with a Done button;
// Android shows the native dialog and commits on "set". Reusable across forms
// (cards alta today, movement form next).
export function DateField({ value, onChange, placeholder, invalid, open, onOpenChange, bare }: Props) {
  const t = useT()
  const locale = useLocale()
  const [internalShow, setInternalShow] = useState(false)

  // Controlled when the parent supplies both `open` and `onOpenChange`; else the
  // field manages its own visibility.
  const controlled = open !== undefined && onOpenChange !== undefined
  const show = controlled ? open : internalShow
  const setShow = (next: boolean) => {
    if (controlled) onOpenChange(next)
    else setInternalShow(next)
  }

  const display = value
    ? isoToDate(value).toLocaleDateString(locale === 'en' ? 'en-US' : 'es-AR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : (placeholder ?? t('common.pick_date'))

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShow(false)
    if (event.type === 'set' && selected) onChange(dateToISO(selected))
  }

  const borderClass = invalid ? 'border-error' : 'border-border'

  return (
    <View className="flex-col gap-2">
      {bare ? (
        <Pressable
          onPress={() => setShow(!show)}
          accessibilityRole="button"
          className="flex-row items-center gap-2"
        >
          <Calendar size={18} color={colors.textMuted} />
          <Text className={`text-[13px] font-semibold ${value ? 'text-text' : 'text-text-soft'}`}>
            {display}
          </Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => setShow(!show)}
          className={`h-11 w-full justify-center rounded-lg border bg-card px-3 ${borderClass}`}
        >
          <Text className={`text-sm ${value ? 'text-text' : 'text-text-soft'}`}>{display}</Text>
        </Pressable>
      )}

      {show && (
        <View>
          <DateTimePicker
            value={isoToDate(value)}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleChange}
          />
          {Platform.OS === 'ios' && (
            <Pressable onPress={() => setShow(false)} className="self-end px-3 py-1.5">
              <Text className="text-sm font-semibold text-emerald">{t('common.close')}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  )
}
