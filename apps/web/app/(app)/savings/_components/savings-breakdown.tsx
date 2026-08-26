'use client'

import { useTranslations } from 'next-intl'
import { ChevronRight } from 'lucide-react'
import { moduleGroups, moduleRest, moduleVisibleAmounts } from '@grana/savings'
import type { ModuleAmount, PurposeSums } from '@grana/savings'
import { cn } from '@/lib/utils'
import { money } from './money'

/**
 * El desglose: para qué es lo guardado.
 *
 * Cada fila hace UNA cosa —abrir el detalle— y lo promete con su chevron. Sin
 * acción contextual: guardar cambia el total y su tope no está acá, y destinar
 * por fila no ahorra ningún tap sobre el enlace del resto.
 */
export const SavingsBreakdown = ({ purposeSums }: { purposeSums: PurposeSums[] }) => {
  const t = useTranslations('savings')

  // El orden, el resto y cuántos montos muestra cada fila salen de
  // `@grana/savings`: testeados una vez y compartidos con mobile.
  const groups = moduleGroups(purposeSums)
  const rest = moduleRest(purposeSums)
  const restHasMoney = rest.some((a) => a.reserved > 0)

  return (
    <div className="mt-5">
      <p className="px-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-text-soft">
        {t('purposes.label')}
      </p>

      <ul className="mt-2 flex flex-col gap-1.5">
        {groups.map((g) => (
          <li key={g.purposeId}>
            <button
              type="button"
              className="flex min-h-[52px] w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-surface-sunken"
            >
              <span aria-hidden className="text-[16px]">
                {g.icon ?? '🫙'}
              </span>
              <span className="flex-1 truncate text-[14px] font-semibold text-text">{g.name}</span>
              <Amounts amounts={g.amounts} />
              <ChevronRight className="size-4 shrink-0 text-text-soft" aria-hidden />
            </button>
          </li>
        ))}
      </ul>

      {/* El resto al pie, tras una regla: no es un propósito. Sin chevron —no
          tiene detalle— y con el monto apagado. El `pr` compensa el ancho del
          chevron que no tiene, para que los montos queden en una columna. */}
      <div className="mt-1 border-t border-border-soft pt-2">
        <div className="flex items-center gap-2.5 py-1.5 pl-2 pr-[34px]">
          <span aria-hidden className="text-[16px]">
            🫙
          </span>
          <span className="flex-1 truncate text-[14px] font-semibold text-text-muted">
            {t('purposes.none')}
          </span>
          <Amounts amounts={rest} muted />
        </div>
        {restHasMoney && (
          // 44px de alto cada uno y separados: pegados por un punto medio, el
          // error más probable es tocar «Volver a usar» queriendo «Destinar» —
          // la que saca plata del disponible y la que no la toca.
          <div className="flex gap-1.5 pl-[30px]">
            <RestLink label={t('purposes.allocate')} />
            <RestLink label={t('release')} />
          </div>
        )}
      </div>
    </div>
  )
}

const RestLink = ({ label }: { label: string }) => (
  <button
    type="button"
    className="flex min-h-[44px] items-center rounded-[10px] px-2.5 text-[13px] font-bold text-emerald-deep transition-colors hover:bg-surface-sunken"
  >
    {label}
  </button>
)

/**
 * Los montos de un grupo, en las dos monedas y SIN sumarlas. La fila crece solo
 * cuando el dato lo pide: un propósito con pesos únicamente ocupa una línea.
 * Los montos no se achican ni se parten — el que cede es el nombre (D24).
 */
const Amounts = ({
  amounts,
  muted = false,
}: {
  amounts: ModuleAmount[]
  muted?: boolean
}) => {
  const list = moduleVisibleAmounts(amounts)

  return (
    <span className="flex shrink-0 flex-col items-end">
      {list.map((a, i) => (
        <span
          key={a.currency}
          className={cn(
            'whitespace-nowrap tabular-nums',
            i === 0
              ? cn('text-[14px] font-extrabold', muted ? 'text-text-muted' : 'text-text')
              : 'text-[11.5px] font-semibold text-text-soft',
          )}
        >
          {money(a.reserved, a.currency)}
        </span>
      ))}
    </span>
  )
}
