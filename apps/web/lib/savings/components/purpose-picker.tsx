'use client'

import { useTranslations } from 'next-intl'
import { PURPOSE_SEEDS, type Purpose, type PurposeSums } from '@grana/savings'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { Plus } from 'lucide-react'
import { DrawerBackHeader } from './drawer-back-header'

type Currency = 'ARS' | 'USD'

/**
 * Elegir para qué.
 *
 * Dos listas y un alta, en ese orden: lo que el usuario ya tiene primero,
 * porque después de la primera semana es lo único que va a usar. Las sugerencias
 * quedan abajo y **desaparecen a medida que las adopta** — ofrecer "Viaje" a
 * alguien que ya tiene "Viaje" es empujarlo contra el índice único, con el atajo
 * pensado justamente para ahorrarle trabajo.
 *
 * «Sin destino» aparece como una opción más y no como "ninguno": es un grupo con
 * las mismas reglas que cualquier propósito, incluido el piso, y presentarlo
 * como la ausencia de elección lo volvería invisible justo para el usuario que
 * tiene ahí toda su plata.
 */
export function PurposePicker({
  purposes,
  sums,
  currency,
  selectedId,
  allowNone = true,
  onPick,
  onCreate,
  onBack,
}: {
  purposes: Purpose[]
  /** Para mostrar cuánto tiene cada uno en la moneda en juego. */
  sums: PurposeSums[]
  currency: Currency
  selectedId: string | null
  /**
   * «Sin destino» como opción. Al elegir para qué guardar, sí: no etiquetar es
   * una respuesta válida. Al elegir hacia dónde apartar, no: apartar al resto
   * es no apartar, y ofrecerlo sería un botón que no hace nada.
   */
  allowNone?: boolean
  onPick: (purposeId: string | null) => void
  /** Sin argumento abre el alta en blanco; con una clave, precargada. */
  onCreate: (seedKey?: string) => void
  onBack: () => void
}) {
  const t = useTranslations('savings')

  const money = (amount: number) =>
    currency === 'USD' ? formatUSD(amount) : formatARS(amount, true)

  const amountOf = (purposeId: string | null): number =>
    sums.find((s) => s.currencyCode === currency && s.purposeId === purposeId)?.reserved ?? 0

  const taken = new Set(purposes.map((p) => p.name.trim().toLowerCase()))
  const suggestions = PURPOSE_SEEDS.filter(
    (seed) => !taken.has(t(`purposes.seeds.${seed.key}`).trim().toLowerCase()),
  )

  return (
    <>
      <DrawerBackHeader title={t('purposes.choose')} onBack={onBack} />

      {/* Sin propósitos propios y sin «Sin destino» como opción, la lista queda
          vacía: un recuadro con borde y nada adentro, que se lee como un error.
          Es el estado de todos la primera vez, así que en vez de la lista va la
          frase — y abajo siguen las sugerencias, que es por donde se empieza. */}
      {purposes.length === 0 && !allowNone ? (
        <>
          <p className="mt-4 text-[11px] font-extrabold uppercase tracking-[0.12em] text-text-soft">
            {t('purposes.yours')}
          </p>
          <p className="mt-2 text-[13px] text-text-soft">{t('purposes.empty')}</p>
        </>
      ) : (
        <>
      <p className="mt-4 text-[11px] font-extrabold uppercase tracking-[0.12em] text-text-soft">
        {t('purposes.yours')}
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {purposes.map((purpose) => (
          <PurposeRow
            key={purpose.id}
            icon={purpose.icon}
            name={purpose.name}
            amount={money(amountOf(purpose.id))}
            selected={selectedId === purpose.id}
            onClick={() => onPick(purpose.id)}
          />
        ))}
        {allowNone && (
          <PurposeRow
            icon={null}
            name={t('purposes.none')}
            amount={money(amountOf(null))}
            selected={selectedId === null}
            onClick={() => onPick(null)}
          />
        )}
      </ul>
        </>
      )}

      {suggestions.length > 0 && (
        <>
          <p className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-text-soft">
            {t('purposes.suggestions')}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
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
        </>
      )}

      <button
        type="button"
        onClick={() => onCreate()}
        className="mt-5 flex min-h-[44px] items-center gap-2 self-start text-[13.5px] font-bold text-emerald-deep"
      >
        <Plus size={16} strokeWidth={2.5} />
        {t('purposes.new')}
      </button>
    </>
  )
}

/**
 * Una opción del selector. Fuera del componente padre: definida adentro se
 * recrea en cada render y React la trata como un tipo distinto cada vez,
 * desmontando y remontando la fila entera.
 */
const PurposeRow = ({
  icon,
  name,
  amount,
  selected,
  onClick,
}: {
  icon: string | null
  name: string
  amount: string
  selected: boolean
  onClick: () => void
}) => (
  <li>
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[52px] w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${
        selected
          ? 'border-emerald-deep bg-emerald-deep/5'
          : 'border-border-soft bg-card hover:bg-surface-sunken'
      }`}
    >
      <span aria-hidden className="text-[18px]">
        {icon ?? '🫙'}
      </span>
      <span className="flex-1 text-[14px] font-semibold text-text">{name}</span>
      <span className="text-[13px] font-extrabold tabular-nums text-text-muted">{amount}</span>
    </button>
  </li>
)
