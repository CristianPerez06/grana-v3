'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import type { Purpose, PurposeSums } from '@grana/savings'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { Button } from '@/components/ui/button'
import { deletePurpose } from '@/app/_actions/savings'
import { DrawerBackHeader } from './drawer-back-header'

/**
 * Borrar un propósito, avisando qué pasa con la plata.
 *
 * El aviso dice el MONTO, por moneda, y dice a dónde va. Un "¿seguro?" genérico
 * dejaría al usuario suponiendo lo peor —que borrar la etiqueta borra los
 * $300.000— justo en la operación donde eso NO pasa. La regla que lo garantiza
 * vive en el schema (`ON DELETE SET NULL`, con un self-check que falla la
 * migración si alguien la cambia), no en esta pantalla; acá solo se cuenta.
 */
export function PurposeDelete({
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
}) {
  const t = useTranslations('savings')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const held = sums
    .filter((s) => s.purposeId === purpose.id && s.reserved !== 0)
    .map((s) => (s.currencyCode === 'USD' ? formatUSD(s.reserved) : formatARS(s.reserved, true)))

  const submit = () => {
    setError(null)
    startTransition(async () => {
      const result = await deletePurpose(purpose.id)
      if (!result.ok) {
        setError(result.formError ?? t('purposes.errors.generic'))
        return
      }
      await onDone()
    })
  }

  return (
    <div className="flex flex-col">
      <DrawerBackHeader title={t('purposes.delete')} onBack={onBack} />

      <p className="mt-5 text-[15px] font-bold text-text">
        {t('purposes.delete_confirm', { name: purpose.name })}
      </p>
      <p className="mt-2 text-[13.5px] leading-snug text-text-muted">
        {held.length > 0
          ? t('purposes.delete_with_money', { amounts: held.join(' y ') })
          : t('purposes.delete_empty')}
      </p>

      {error && <p className="mt-4 text-[13px] font-semibold text-negative">{error}</p>}

      <Button className="mt-6 h-11" variant="destructive" onClick={submit} disabled={pending}>
        {t('purposes.delete')}
      </Button>
    </div>
  )
}
