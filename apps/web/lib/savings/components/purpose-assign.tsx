'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { PURPOSE_SEEDS, type Purpose, type ReserveEntry } from '@grana/savings'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { assignPurpose } from '@/app/_actions/savings'
import { DrawerBackHeader } from './drawer-back-header'

type Currency = 'ARS' | 'USD'

/**
 * Ponerle nombre a algo que YA guardaste — el segundo par de verbos del modelo:
 * **asignar ⇄ desasignar**.
 *
 * Igual que guardar y volver a usar, no mueve plata; pero a diferencia de ellos
 * tampoco cambia el disponible ni el total guardado. Es la operación más
 * inofensiva del modelo, y por eso no tiene tope, ni piso, ni confirmación: no
 * hay ningún número que pueda quedar mal.
 *
 * Existe porque sin ella la fase 2 solo serviría de acá en adelante: todo lo que
 * el usuario venía guardando quedaría condenado a «Sin destino» para siempre, y
 * la fase se estrenaría con la plata de la gente ya del lado equivocado.
 */
export function PurposeAssign({
  entry,
  currency,
  purposes,
  onDone,
  onCreate,
  onBack,
}: {
  entry: ReserveEntry
  currency: Currency
  purposes: Purpose[]
  onDone: () => void | Promise<void>
  onCreate: (seedKey?: string) => void
  onBack: () => void
}) {
  const t = useTranslations('savings')
  const [selected, setSelected] = useState<string | null>(entry.purposeId)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const money = (amount: number) =>
    currency === 'USD' ? formatUSD(amount) : formatARS(amount, true)

  const taken = new Set(purposes.map((p) => p.name.trim().toLowerCase()))
  const suggestions = PURPOSE_SEEDS.filter(
    (seed) => !taken.has(t(`purposes.seeds.${seed.key}`).trim().toLowerCase()),
  )

  const submit = () => {
    setError(null)
    startTransition(async () => {
      const result = await assignPurpose(entry.id, selected)
      if (!result.ok) {
        setError(result.formError ?? t('purposes.errors.generic'))
        return
      }
      await onDone()
    })
  }

  return (
    <div className="flex flex-col">
      <DrawerBackHeader title={t('purposes.assign_title')} onBack={onBack} />

      {/* El movimiento que se está etiquetando, a la vista: sin él, la pantalla
          preguntaría "¿para qué fue?" sobre algo que el usuario no ve. */}
      <div className="mt-4 flex items-baseline justify-between rounded-2xl border border-border-soft bg-card px-4 py-3">
        <span className="text-[14px] font-semibold text-text">
          {entry.amount >= 0 ? t('entry_saved') : t('entry_released')}
        </span>
        <span className="text-[15px] font-extrabold tabular-nums text-text">
          {entry.amount >= 0 ? '+' : '−'}
          {money(Math.abs(entry.amount))}
        </span>
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {purposes.map((purpose) => (
          <li key={purpose.id}>
            <button
              type="button"
              onClick={() => setSelected(purpose.id)}
              className={`flex min-h-[52px] w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${
                selected === purpose.id
                  ? 'border-emerald-deep bg-emerald-deep/5'
                  : 'border-border-soft bg-card hover:bg-surface-sunken'
              }`}
            >
              <span aria-hidden className="text-[18px]">
                {purpose.icon ?? '🫙'}
              </span>
              <span className="flex-1 text-[14px] font-semibold text-text">{purpose.name}</span>
            </button>
          </li>
        ))}
        {/* Desasignar es elegir «Sin destino». No hay un botón "sacar": el par
            de verbos es simétrico y se expresa con la misma lista. */}
        <li>
          <button
            type="button"
            onClick={() => setSelected(null)}
            className={`flex min-h-[52px] w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${
              selected === null
                ? 'border-emerald-deep bg-emerald-deep/5'
                : 'border-border-soft bg-card hover:bg-surface-sunken'
            }`}
          >
            <span aria-hidden className="text-[18px]">
              🫙
            </span>
            <span className="flex-1 text-[14px] font-semibold text-text">{t('purposes.none')}</span>
          </button>
        </li>
      </ul>

      {suggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((seed) => (
            <button
              key={seed.key}
              type="button"
              onClick={() => onCreate(seed.key)}
              className="flex min-h-[44px] items-center gap-2 rounded-full border border-border-soft bg-card px-3.5 text-[13.5px] font-semibold text-text transition-colors hover:bg-surface-sunken"
            >
              <span aria-hidden>{seed.icon}</span>
              {t(`purposes.seeds.${seed.key}`)}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => onCreate()}
        className="mt-3 flex min-h-[44px] items-center gap-2 self-start text-[13.5px] font-bold text-emerald-deep"
      >
        <Plus size={16} strokeWidth={2.5} />
        {t('purposes.new')}
      </button>

      <p className="mt-4 rounded-xl bg-surface-sunken px-3 py-2.5 text-[12.5px] leading-snug text-text-muted">
        {t('purposes.assign_note')}
      </p>

      {error && <p className="mt-3 text-[13px] font-semibold text-negative">{error}</p>}

      <Button className="mt-4 h-11" onClick={submit} disabled={pending}>
        {t('purposes.assign_cta')}
      </Button>
    </div>
  )
}
