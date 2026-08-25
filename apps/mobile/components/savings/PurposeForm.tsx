import { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { PURPOSE_ICONS, type Purpose } from '@grana/savings'
import { useT } from '../../lib/locale-context'
import { Button } from '../ui/Button'
import { createPurpose, renamePurpose } from '../../lib/savings/mutations'
import { SheetBackHeader } from './SheetBackHeader'

/**
 * Alta y edición de un propósito. Espejo nativo del `PurposeForm` de web.
 *
 * Un nombre y un ícono. Sin objetivo ni fecha, que es lo que separa un propósito
 * de una meta — y la meta llega en la fase 4, cuando existan las posiciones que
 * la respalden.
 */
export const PurposeForm = ({
  purpose,
  initialName,
  initialIcon,
  onDone,
  onBack,
}: {
  /** Presente = edición. Ausente = alta. */
  purpose?: Purpose | null
  /** Precarga del alta cuando se llegó tocando una sugerencia. */
  initialName?: string
  initialIcon?: string
  /** Devuelve el propósito ARMADO: quien navegue después no puede buscarlo en
   *  la lista, que todavía es la de antes de crearlo. */
  onDone: (purpose: Purpose) => void | Promise<void>
  onBack: () => void
}) => {
  const t = useT()
  const [name, setName] = useState(purpose?.name ?? initialName ?? '')
  const [icon, setIcon] = useState<string | null>(purpose?.icon ?? initialIcon ?? null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async () => {
    setError(null)
    setPending(true)
    try {
      const input = { name, icon }
      const result = purpose
        ? await renamePurpose(purpose.id, input)
        : await createPurpose(input)

      if (!result.ok) {
        // El mensaje del duplicado dice CUÁL ya existe: el índice normaliza
        // mayúsculas y espacios, así que quien escribió "emergencia" chocó
        // contra "Emergencia" y un "ya existe" a secas lo dejaría buscándolo.
        setError(
          result.messageKey != null
            ? t(result.messageKey, { name: result.conflictingName ?? '' })
            : t('savings.purposes.errors.generic'),
        )
        return
      }
      await onDone({
        id: result.id ?? purpose?.id ?? '',
        name: name.trim(),
        icon,
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <View>
      <SheetBackHeader
        title={purpose ? t('savings.purposes.edit') : t('savings.purposes.new')}
        onBack={onBack}
      />

      <Text className="mt-5 text-[10.5px] font-extrabold uppercase tracking-widest text-text-soft">
        {t('savings.purposes.name_label')}
      </Text>
      <TextInput
        value={name}
        onChangeText={setName}
        maxLength={40}
        autoFocus
        className="mt-2 h-12 rounded-xl border border-border bg-card px-3.5 text-[15px] font-semibold text-text"
      />

      <Text className="mt-5 text-[10.5px] font-extrabold uppercase tracking-widest text-text-soft">
        {t('savings.purposes.icon_label')}
      </Text>
      {/* El ícono no es decoración: en una lista plana es lo que hace que ✈️
          Japón y ✈️ Bariloche se lean como familia — el trabajo que en otro
          modelo haría una jerarquía de dos niveles. */}
      <View className="mt-2 flex-row flex-wrap gap-2">
        {PURPOSE_ICONS.map((option) => (
          <Pressable
            key={option}
            onPress={() => setIcon(option === icon ? null : option)}
            accessibilityRole="button"
            className={`size-11 items-center justify-center rounded-xl border ${
              option === icon ? 'border-positive bg-border-soft' : 'border-border bg-card'
            }`}
          >
            <Text className="text-[17px]">{option}</Text>
          </Pressable>
        ))}
      </View>

      {error != null && (
        <Text className="mt-4 text-[13px] font-semibold text-negative">{error}</Text>
      )}

      <View className="mt-6">
        <Button
          title={purpose ? t('savings.purposes.update_cta') : t('savings.purposes.create_cta')}
          onPress={submit}
          loading={pending}
          disabled={pending || name.trim().length === 0}
        />
      </View>
    </View>
  )
}
