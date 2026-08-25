import { Pressable, Text, View } from 'react-native'
import { ChevronLeft } from 'lucide-react-native'
import { useT } from '../../lib/locale-context'
import { colors } from '../../lib/colors'

/**
 * Encabezado con vuelta atrás para las vistas que el sheet apila. Espejo del
 * `DrawerBackHeader` de web.
 *
 * Control de 44×44, el mínimo del repo: en un teléfono la flecha se toca con el
 * pulgar y un área menor se falla seguido.
 */
export const SheetBackHeader = ({
  title,
  onBack,
  action,
}: {
  title: string
  onBack: () => void
  /** Acción secundaria a la derecha, cuando la vista tiene una. */
  action?: React.ReactNode
}) => {
  const t = useT()

  return (
    <View className="flex-row items-center gap-2.5">
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={t('savings.back')}
        className="size-11 items-center justify-center rounded-xl border border-border bg-card"
      >
        <ChevronLeft size={20} color={colors.textMuted} />
      </Pressable>
      <Text className="flex-1 text-[19px] font-extrabold text-text" numberOfLines={1}>
        {title}
      </Text>
      {action}
    </View>
  )
}
