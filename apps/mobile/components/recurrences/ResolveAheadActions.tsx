import { useState } from 'react'
import { Text, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { resolveAheadMessageKeys } from '@grana/recurrences'
import { Button } from '../ui/Button'
import { useT } from '../../lib/locale-context'
import { invalidateAfterRecurrenceResolution } from '../../lib/recurrences/invalidate'
import { AlreadyLoadedAction } from './AlreadyLoadedAction'
import { PayAheadSheet } from './PayAheadSheet'

type Props = {
  recurrenceId: string
  /** El vencimiento. NO se mueve: la fecha de pago es otro hecho. */
  dueDate: string
  ruleAmount: number
  ruleCurrency: string
  /** Lo que la hoja necesita para ofrecer cuentas válidas, igual que web. */
  movementType: string
  ruleAccountId: string | null
  transferDestinationAccountId: string | null
  shared: boolean
}

/**
 * Paridad nativa de las dos salidas para un vencimiento que todavía no llegó.
 *
 * Registrar el pago acá NO adelanta el calendario: el próximo vencimiento sigue
 * siendo el que la regla preveía.
 */
export function ResolveAheadActions({
  recurrenceId,
  dueDate,
  ruleAmount,
  ruleCurrency,
  movementType,
  ruleAccountId,
  transferDestinationAccountId,
  shared,
}: Props) {
  const t = useT()
  // LA INVALIDACIÓN VIVE ACÁ, no en cada pantalla que monta el componente. Las
  // dos que lo montan —el hub y el detalle— la pasaban como prop, y una de las
  // dos podía elegir mal: elegían el helper angosto y el saldo quedaba viejo.
  // Acá no hay nada que elegir.
  const queryClient = useQueryClient()
  // Gemelo de web: el rótulo y el acuse dependen de lo que la regla mueve. Un
  // sueldo se cobra, una transferencia se hace; ninguno de los dos se paga.
  const msg = resolveAheadMessageKeys(movementType)
  // EL ACUSE. Sin él la pantalla cambia en silencio y el usuario no sabe si pasó
  // algo. Acá la regla sigue en la lista —sólo se corre su próxima fecha—, así
  // que el mensaje puede quedarse donde estaban los botones.
  const [done, setDone] = useState<string | null>(null)
  // Cada apertura monta una hoja NUEVA, por la misma razón que la de candidatos
  // (`AlreadyLoadedAction`):
  // confirmar la cierra sin pasar por el cierre que limpia su estado.
  const [payOpen, setPayOpen] = useState(false)
  const [payKey, setPayKey] = useState(0)

  // ANTES REGISTRABA DE UNA, con los valores de la regla. Ahora abre el mismo
  // formulario que web —importe, cuenta y fecha de pago, con el aviso de saldo
  // negativo—, que es lo que hacía falta para que pagar antes con otro importe
  // no obligue a ir a corregirlo después.
  const openPayAhead = () => {
    setDone(null)
    setPayKey((n) => n + 1)
    setPayOpen(true)
  }

  const paid = () => {
    setPayOpen(false)
    setDone(t(`recurrences.link.${msg.recorded}`))
    invalidateAfterRecurrenceResolution(queryClient)
  }

  return (
    <View className="gap-2">
      {/* Una sola fila, mitad y mitad, y las dos con el mismo peso — el gemelo
          de web. El `Button` nativo es `w-full` igual que el de web, así que sin
          la mitad cada uno se comería la fila entera. Y las dos `secondary`
          porque son caminos equivalentes: una llena y la otra fantasma hacía que
          la primera pareciera ya elegida. */}
      <AlreadyLoadedAction
        recurrenceId={recurrenceId}
        dueDate={dueDate}
        ruleAmount={ruleAmount}
        ruleCurrency={ruleCurrency}
        shared={shared}
        onLinked={() => setDone(t('recurrences.link.linked_success'))}
        renderTrigger={(openSheet, linking) => (
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button variant="secondary" size="xs" onPress={openPayAhead} disabled={linking}>
                {t(`recurrences.link.${msg.action}`)}
              </Button>
            </View>
            <View className="flex-1">
              <Button
                variant="secondary"
                size="xs"
                onPress={() => {
                  setDone(null)
                  openSheet()
                }}
                disabled={linking}
              >
                {t('recurrences.link.already_loaded')}
              </Button>
            </View>
          </View>
        )}
      />
      {done ? <Text className="text-[13px] text-emerald-deep">{done}</Text> : null}

      {/* La `key` dice de qué hoja habla: la de candidatos vive dentro de
          `AlreadyLoadedAction` con su propio contador, y un número pelado en dos
          hermanos hace que React reuse el estado de una en la otra. */}
      <PayAheadSheet
        key={`pay-${payKey}`}
        visible={payOpen}
        onClose={() => setPayOpen(false)}
        recurrenceId={recurrenceId}
        dueDate={dueDate}
        ruleAmount={ruleAmount}
        ruleCurrency={ruleCurrency as 'ARS' | 'USD'}
        movementType={movementType}
        ruleAccountId={ruleAccountId}
        transferDestinationAccountId={transferDestinationAccountId}
        actionKey={msg.action}
        onDone={paid}
      />
    </View>
  )
}
