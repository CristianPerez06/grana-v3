import { useState } from 'react'
import { Text, View } from 'react-native'
import type { Purpose, PurposeSums } from '@grana/savings'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { useT } from '../../lib/locale-context'
import { Button } from '../ui/Button'
import { deletePurpose } from '../../lib/savings/mutations'
import { SheetBackHeader } from './SheetBackHeader'

/**
 * Borrar un propósito, avisando qué pasa con la plata. Espejo del de web.
 *
 * El aviso dice el MONTO, por moneda, y a dónde va. Un "¿seguro?" genérico
 * dejaría al usuario suponiendo lo peor —que borrar la etiqueta borra los
 * $300.000— justo en la operación donde eso NO pasa. Lo garantiza el schema
 * (`ON DELETE SET NULL`), no esta pantalla; acá solo se cuenta.
 */
export const PurposeDelete = ({
  purpose,
  sums,
  onDone,
  onBack,
}: {
  purpose: Purpose
  /** Todas las monedas: un propósito puede tener pesos y dólares a la vez. */
  sums: PurposeSums[]
  onDone: () => void | Promise<void>
  onBack: () => void
}) => {
  const t = useT()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const held = sums
    .filter((s) => s.purposeId === purpose.id && s.reserved !== 0)
    .map((s) => (s.currencyCode === 'USD' ? formatUSD(s.reserved) : formatARS(s.reserved, true)))

  const submit = async () => {
    setError(null)
    setPending(true)
    try {
      const result = await deletePurpose(purpose.id)
      if (!result.ok) {
        setError(t('savings.purposes.errors.generic'))
        return
      }
      await onDone()
    } finally {
      setPending(false)
    }
  }

  return (
    <View>
      <SheetBackHeader title={t('savings.purposes.delete')} onBack={onBack} />

      <Text className="mt-5 text-[15px] font-bold text-text">
        {t('savings.purposes.delete_confirm', { name: purpose.name })}
      </Text>
      <Text className="mt-2 text-[13.5px] leading-snug text-text-muted">
        {held.length > 0
          ? t('savings.purposes.delete_with_money', { amounts: held.join(' y ') })
          : t('savings.purposes.delete_empty')}
      </Text>

      {error != null && (
        <Text className="mt-4 text-[13px] font-semibold text-negative">{error}</Text>
      )}

      <View className="mt-6">
        <Button
          title={t('savings.purposes.delete')}
          variant="destructive"
          onPress={submit}
          loading={pending}
          disabled={pending}
        />
      </View>
    </View>
  )
}
