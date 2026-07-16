import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { Check } from 'lucide-react-native'
import { colors } from '../../../lib/colors'

// Primitivas de la grilla "de un vistazo" del detalle — mirror RN de web
// `detail/glance.tsx`. Mobile es una sola columna (siempre full-width), así que
// no hay `span2`. Cards blancos, eyebrow uppercase, filas clave/valor.

export const Tile = ({ children }: { children: ReactNode }) => (
  <View className="rounded-2xl border border-border bg-card px-5 py-5">{children}</View>
)

export const Eyebrow = ({ children }: { children: ReactNode }) => (
  <Text className="text-[11px] font-extrabold uppercase tracking-[0.13em] text-text-muted">
    {children}
  </Text>
)

type TileHeadProps = {
  eyebrow: ReactNode
  /** Right-aligned secondary text (e.g. "$ 180.000 / mes"). */
  aside?: ReactNode
  asideMuted?: boolean
}

export const TileHead = ({ eyebrow, aside, asideMuted }: TileHeadProps) => (
  <View className="mb-4 flex-row items-center gap-2.5">
    <Eyebrow>{eyebrow}</Eyebrow>
    {aside != null && (
      <Text
        className={`ml-auto text-[13px] tabular-nums ${
          asideMuted ? 'font-semibold text-text-muted' : 'font-bold text-text'
        }`}
      >
        {aside}
      </Text>
    )}
  </View>
)

// Chip del hero: pill con bg field, o variante tonal (bg/tinte del tono).
export const Chip = ({
  children,
  toneClass,
}: {
  children: ReactNode
  /** Tonal variant classes (softBg + deep text); default is the neutral field. */
  toneClass?: { bg: string; text: string }
}) => (
  <View
    className={`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 ${
      toneClass ? toneClass.bg : 'bg-border-soft'
    }`}
  >
    {typeof children === 'string' ? (
      <Text className={`text-[12.5px] font-bold ${toneClass ? toneClass.text : 'text-text'}`}>
        {children}
      </Text>
    ) : (
      children
    )}
  </View>
)

type DetailRowProps = {
  icon?: ReactNode
  label: ReactNode
  value: ReactNode
  /** Optional right-aligned secondary pair (label + value). */
  rightLabel?: ReactNode
  rightValue?: ReactNode
  /** Drop the top border (first row of a stack). */
  first?: boolean
}

export const DetailRow = ({ icon, label, value, rightLabel, rightValue, first }: DetailRowProps) => (
  <View className={`flex-row items-start gap-3 py-3 ${first ? '' : 'border-t border-border'}`}>
    {icon != null && (
      <View className="mt-0.5 h-[33px] w-[33px] shrink-0 items-center justify-center rounded-[10px] bg-border-soft">
        {icon}
      </View>
    )}
    <View className="min-w-0 flex-1 flex-row items-center gap-3">
      <View className="min-w-0 flex-1">
        {typeof label === 'string' ? (
          <Text className="text-[13px] font-semibold text-text-muted">{label}</Text>
        ) : (
          label
        )}
        {typeof value === 'string' ? (
          <Text className="mt-px text-[14.5px] font-bold text-text">{value}</Text>
        ) : (
          <View className="mt-px">{value}</View>
        )}
      </View>
      {rightValue != null && (
        <View className="min-w-0 items-end">
          {rightLabel != null &&
            (typeof rightLabel === 'string' ? (
              <Text className="text-[13px] font-semibold text-text-muted">{rightLabel}</Text>
            ) : (
              rightLabel
            ))}
          {typeof rightValue === 'string' ? (
            <Text className="mt-px text-[14.5px] font-bold tabular-nums text-text">{rightValue}</Text>
          ) : (
            <View className="mt-px">{rightValue}</View>
          )}
        </View>
      )}
    </View>
  </View>
)

// Estado real (Reintegrado / Acreditado / Completada): check verde + label. Solo
// se usa cuando el estado informa algo real.
export const StatusDot = ({ label }: { label: string }) => (
  <View className="flex-row items-center gap-1.5">
    <Check size={15} strokeWidth={2.6} color={colors.emeraldDeep} />
    <Text className="text-[14.5px] font-bold text-emerald-deep">{label}</Text>
  </View>
)
