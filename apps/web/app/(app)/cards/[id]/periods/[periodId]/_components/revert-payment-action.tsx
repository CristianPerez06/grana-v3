'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { Undo2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { revertCardPeriodPayment } from '@/app/_actions/credit-cards'

type Props = {
  periodId: string
  /** Monto del gasto-débito: lo que vuelve a la cuenta. */
  /**
   * Los débitos reales del pago, uno por cuenta y moneda. Un resumen mixto pagado en
   * dos monedas tiene dos, y la reversión devuelve las dos: mostrar solo la primera
   * subestimaría lo que la operación hace, que es justo lo que este diálogo existe
   * para evitar.
   */
  debits: Array<{ amount: number; currencyCode: string; accountName: string | null }>
  /** Cuenta a la que vuelve la plata. */
  /** Movimientos del resumen que vuelven a pendiente (sin contar el sello). */
  movementCount: number
  /** El pago registró un sello vinculado — se elimina con la reversión. */
  hasStampTax: boolean
  showCents: boolean
}

/**
 * "Deshacer pago" — vive en el detalle del período, no en el detalle del movimiento.
 * El gasto-débito es una consecuencia del pago, no el pago: borrarlo desde el
 * movimiento invertiría la relación y escondería la magnitud de lo que se revierte
 * (todo el resumen vuelve a pendiente). Acá el usuario tiene el resumen a la vista.
 *
 * La confirmación enumera los efectos con los números reales de ESTE pago y aclara
 * que las fechas ya confirmadas del ciclo en curso se mantienen: la reversión toca
 * la plata, no el calendario.
 */
export const RevertPaymentAction = ({
  periodId,
  debits,
  movementCount,
  hasStampTax,
  showCents,
}: Props) => {
  const t = useTranslations('cards')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleRevert = () => {
    setError(null)
    startTransition(async () => {
      const result = await revertCardPeriodPayment(periodId)
      if (!result.ok) {
        setError(result.formError ?? t('errors.revert_failed'))
        return
      }
      setOpen(false)
      // Legacy payment whose sello could not be told apart from a hand-entered one:
      // the reversal completed, but a movement stayed behind and the user must know.
      if (result.summary?.stampTax === 'ambiguous') {
        setNotice(t('revert.stamp_tax_ambiguous'))
      }
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 self-start rounded-[12px] border border-border bg-card px-3 py-2 text-[13px] font-medium text-text-muted transition-colors hover:text-text"
      >
        <Undo2 size={15} strokeWidth={2} aria-hidden />
        {t('actions.revert_payment')}
      </button>

      {notice && (
        <p className="rounded-[12px] border border-border bg-card px-3 py-2 text-[13px] text-text-muted">
          {notice}
        </p>
      )}

      <AlertDialog.Root open={open} onOpenChange={setOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-40 bg-navy/40" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-border bg-card p-6 shadow-xl">
            <AlertDialog.Title className="text-[16px] font-bold text-text">
              {t('revert.title')}
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-[13.5px] leading-relaxed text-text-muted">
              {t('revert.intro')}
            </AlertDialog.Description>

            <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-[13.5px] leading-relaxed text-text-muted">
              {/* Una línea por débito, cada una en SU moneda: nunca se suman. */}
              {debits.map((d) => {
                const amount =
                  d.currencyCode === 'USD'
                    ? formatUSD(d.amount, showCents)
                    : formatARS(d.amount, showCents)
                return (
                  <li key={`${d.currencyCode}-${d.accountName ?? ''}-${d.amount}`}>
                    {d.accountName
                      ? t('revert.effect_amount_to_account', { amount, account: d.accountName })
                      : t('revert.effect_amount', { amount })}
                  </li>
                )
              })}
              <li>{t('revert.effect_movements', { count: movementCount })}</li>
              {hasStampTax && <li>{t('revert.effect_stamp_tax')}</li>}
            </ul>

            <p className="mt-3 text-[12.5px] leading-relaxed text-text-muted">
              {t('revert.dates_kept')}
            </p>

            {error && <p className="mt-3 text-[13px] text-expense">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <button
                  type="button"
                  className="h-10 rounded-[12px] border border-border bg-card px-4 text-[13px] font-medium text-text-muted transition-colors hover:text-text"
                  disabled={isPending}
                >
                  {tCommon('cancel')}
                </button>
              </AlertDialog.Cancel>
              <button
                type="button"
                onClick={handleRevert}
                disabled={isPending}
                className="h-10 rounded-[12px] bg-expense px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {t('revert.confirm')}
              </button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  )
}
