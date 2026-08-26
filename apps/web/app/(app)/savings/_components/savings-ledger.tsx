'use client'

import { useTranslations } from 'next-intl'
import { ChevronRight } from 'lucide-react'
import { moduleRowFor, MODULE_CURRENCIES, RESERVE_HISTORY_LIMIT } from '@grana/savings'
import type { AvailableSums, ReserveEntry, ReserveFlowSums } from '@grana/savings'
import type { BalanceCurrency } from '@grana/money-logic'
import { cn } from '@/lib/utils'
import { money } from './money'

/**
 * Lo que la pantalla NO tiene que gritar: el puente con el banco y el historial.
 *
 * Los dos vivían en el detalle del overlay, que dejó de existir cuando el módulo
 * pasó a ser la lectura. No se borraron con él: el puente es lo que evita que
 * alguien abra su home banking, vea otra cifra y le crea al banco, y el
 * historial es la auditoría de un número que la app calcula sola.
 *
 * Van PLEGADOS y al pie. Las dos son preguntas que se hacen una vez —«¿por qué
 * no coinciden?», «¿cuándo guardé esto?»— y una explicación que se entiende una
 * vez no puede cobrar altura todos los días arriba del total.
 */
export const SavingsLedger = ({
  sums,
  flow,
  history,
}: {
  sums: AvailableSums[]
  flow: ReserveFlowSums[]
  history: { entries: ReserveEntry[]; hasMore: boolean }
}) => {
  const t = useTranslations('savings')

  // Las monedas con algo que decir. A cero, el puente sería tres líneas en cero
  // explicando una diferencia que no existe.
  const currencies = MODULE_CURRENCIES.filter((c) => {
    const row = moduleRowFor(sums, c)
    return c === 'ARS' || row.reserved !== 0 || row.available !== 0
  })

  const monthNet = (currency: BalanceCurrency) =>
    flow.find((f) => f.currencyCode === currency)?.reservedNet ?? 0

  return (
    <section className="mt-1 flex flex-col gap-1 sm:max-w-[34rem]">
      <Fold label={t('bank_fold')}>
        <div className="mt-2 flex flex-col gap-3">
          {currencies.map((currency) => (
            <BankBridge key={currency} currency={currency} sums={moduleRowFor(sums, currency)} />
          ))}
          <p className="px-1 text-[12.5px] leading-snug text-text-soft">{t('gap_note')}</p>
        </div>
      </Fold>

      <Fold label={t('history_count', { count: history.entries.length })}>
        {/* El neto del mes, arriba de la lista que lo resume: es el mismo flujo
            contado de dos maneras. */}
        {currencies.some((c) => monthNet(c) !== 0) && (
          <div className="mt-2 flex flex-col gap-0.5 rounded-xl bg-surface-sunken px-3 py-2 text-[13px]">
            {currencies
              .filter((c) => monthNet(c) !== 0)
              .map((c) => (
                <p key={c} className="flex justify-between text-text-muted">
                  <span>{t(monthNet(c) < 0 ? 'this_month_released' : 'this_month_saved')}</span>
                  <span
                    className={cn(
                      'font-extrabold tabular-nums',
                      monthNet(c) >= 0 ? 'text-emerald-deep' : 'text-terracotta-deep',
                    )}
                  >
                    {money(Math.abs(monthNet(c)), c)}
                  </span>
                </p>
              ))}
          </div>
        )}

        {history.entries.length === 0 ? (
          <p className="mt-2 px-1 text-[13px] text-text-soft">{t('empty_history')}</p>
        ) : (
          <ul className="mt-2 flex flex-col divide-y divide-border-soft">
            {history.entries.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-[14px] font-semibold text-text">
                  {entry.amount >= 0 ? t('entry_saved') : t('entry_released')}
                  <span className="ml-2 text-[12px] font-medium text-text-soft">
                    {shortDate(entry.date)}
                  </span>
                </span>
                <span
                  className={cn(
                    'text-[14px] font-extrabold tabular-nums',
                    entry.amount >= 0 ? 'text-emerald-deep' : 'text-terracotta-deep',
                  )}
                >
                  {entry.amount >= 0 ? '+' : '−'}
                  {money(Math.abs(entry.amount), entry.currencyCode)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {history.hasMore && (
          <p className="mt-2 px-1 text-[12px] text-text-soft">
            {t('history_truncated', { count: RESERVE_HISTORY_LIMIT })}
          </p>
        )}
      </Fold>
    </section>
  )
}

/** 44px de alto en el resumen, que es lo mínimo para abrirlo con el pulgar. */
const Fold = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <details className="group">
    <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 px-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-text-soft">
      <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" aria-hidden />
      {label}
    </summary>
    {children}
  </details>
)

/**
 * Por qué el banco dice otro número.
 *
 * Los rótulos nombran los DOS sistemas y no las entidades de Grana: la pregunta
 * acá no es «cuánto tengo en cuentas», es «por qué mi banco dice otra cosa», y
 * para contestarla hay que decir de quién es cada número.
 */
const BankBridge = ({ currency, sums }: { currency: BalanceCurrency; sums: AvailableSums }) => {
  const t = useTranslations('savings')

  return (
    <div className="rounded-xl bg-surface-sunken px-3 py-2.5 text-[13px]">
      <p className="mb-1 text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-text-soft">
        {currency}
      </p>
      <p className="flex justify-between py-0.5 text-text-muted">
        <span>{t('bank_shows')}</span>
        <span className="font-semibold tabular-nums text-text">
          {money(sums.accountsNet, currency)}
        </span>
      </p>
      <p className="flex justify-between py-0.5 text-text-muted">
        <span>{t('saved_in_grana')}</span>
        <span className="font-semibold tabular-nums text-emerald-deep">
          −{money(sums.reserved, currency)}
        </span>
      </p>
      <p className="mt-1 flex justify-between border-t border-border pt-1.5 text-text-muted">
        <span>{t('spendable_in_grana')}</span>
        <span className="font-extrabold tabular-nums text-text">
          {money(sums.available, currency)}
        </span>
      </p>
    </div>
  )
}

/** El mismo formato corto que usa el resto del módulo. */
const shortDate = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}
