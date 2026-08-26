'use client'

import { useTranslations } from 'next-intl'
import { ChevronRight } from 'lucide-react'
import {
  moduleGroupCurrency,
  moduleGroups,
  moduleRest,
  moduleVisibleAmounts,
} from '@grana/savings'
import type { ModuleAmount, PurposeSums } from '@grana/savings'
import { cn } from '@/lib/utils'
import { useSavingsOverlay } from './savings-overlay-context'
import { money } from './money'

/**
 * El desglose: para qué es lo guardado.
 *
 * UNA card contiene todas las filas, con divisores finos entre ellas. Antes eran
 * filas sueltas sobre el fondo con su propio hover: la superficie competía con
 * el contenido y la que estuviera bajo el cursor parecía otra cosa. La card es
 * la superficie; las filas no tienen fondo propio.
 *
 * Cada fila hace UNA cosa —abrir el detalle— y lo promete con su chevron. Sin
 * acción contextual: guardar cambia el total y su tope no está acá, y destinar
 * por fila no ahorra ningún tap sobre el enlace del resto.
 */
export const SavingsBreakdown = ({ purposeSums }: { purposeSums: PurposeSums[] }) => {
  const t = useTranslations('savings')
  const overlay = useSavingsOverlay()

  const groups = moduleGroups(purposeSums)
  const rest = moduleRest(purposeSums)
  const restHasMoney = rest.some((a) => a.reserved > 0)
  // La moneda de la operación sale del dato, no de un default: un resto de solo
  // dólares abriría en pesos, con tope cero, sobre una pantalla que no explica
  // por qué.
  const restCurrency = moduleGroupCurrency(rest)

  return (
    <div className="mt-6 sm:max-w-[34rem]">
      <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-text-soft">
        {t('purposes.label')}
      </p>

      <div className="overflow-hidden rounded-2xl border border-border-soft bg-card shadow-sm">
        <ul className="flex flex-col divide-y divide-border-soft">
          {groups.map((g) => (
            <li key={g.purposeId}>
              <button
                type="button"
                onClick={() =>
                  overlay.openPurpose(
                    { id: g.purposeId, name: g.name, icon: g.icon },
                    moduleGroupCurrency(g.amounts),
                  )
                }
                className="flex min-h-[60px] w-full items-center gap-3 px-4 text-left transition-colors hover:bg-surface-sunken"
              >
                <Icon>{g.icon ?? '🫙'}</Icon>
                <span className="flex-1 truncate text-[14.5px] font-semibold text-text">
                  {g.name}
                </span>
                <Amounts amounts={g.amounts} />
                <ChevronRight className="size-4 shrink-0 text-text-soft" aria-hidden />
              </button>
            </li>
          ))}
        </ul>

        {/* El resto es la última fila de la misma card, separada por un divisor
            más marcado: no es un propósito —no navega, no tiene chevron— pero
            tampoco es otra sección. Es el pie de esta lista. */}
        <div className="border-t border-border bg-surface-sunken/40">
          <div className="flex min-h-[60px] items-center gap-3 px-4">
            <Icon muted>🫙</Icon>
            <span className="flex-1 truncate text-[14.5px] font-semibold text-text-muted">
              {t('purposes.none')}
            </span>
            <Amounts amounts={rest} muted />
            {/* Compensa el ancho del chevron que esta fila NO tiene, para que
                los montos queden en una sola columna con los de arriba. */}
            <span aria-hidden className="w-4 shrink-0" />
          </div>
          {restHasMoney && (
            // Alineadas a la derecha, bajo la columna de montos: sueltas a la
            // izquierda quedaban huérfanas y rompían la grilla vertical.
            // Separadas entre sí porque el error más probable es tocar «Volver a
            // usar» queriendo «Destinar» — la que saca plata del disponible y la
            // que no la toca.
            <div className="flex justify-end gap-2 px-4 pb-3">
              <RestAction
                label={t('purposes.allocate')}
                onClick={() => overlay.openRestAllocate(restCurrency)}
              />
              <RestAction
                label={t('release')}
                onClick={() => overlay.openRestRelease(restCurrency)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Caja fija para el emoji: sueltos al lado del texto, los nombres arrancaban
 *  en distinta `x` según el ancho del glifo y la lista dejaba de leerse. */
const Icon = ({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) => (
  <span
    aria-hidden
    className={cn(
      'grid size-8 shrink-0 place-items-center rounded-[10px] text-[16px]',
      muted ? 'bg-border-soft/60' : 'bg-surface-sunken',
    )}
  >
    {children}
  </span>
)

/**
 * 44px de alto, que es el mínimo del repo. Al volverlas pills se habían quedado
 * en 36 — más prolijo y peor de tocar, sobre una de las dos acciones que mueven
 * plata.
 *
 * Texto en tinta plena y no gris: en gris se leían como rótulos apagados y no
 * como algo que se toca. Y no verdes: el acento es de los botones globales, y
 * dos verdes en la misma pantalla los pone a competir.
 */
const RestAction = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex min-h-[44px] items-center rounded-full border border-border bg-card px-4 text-[13px] font-semibold text-text transition-colors hover:bg-surface-sunken"
  >
    {label}
  </button>
)

/**
 * Los montos de un grupo, en las dos monedas y SIN sumarlas. La fila crece solo
 * cuando el dato lo pide: un propósito con pesos únicamente ocupa una línea.
 * Los montos no se achican ni se parten — el que cede es el nombre (D24).
 */
const Amounts = ({ amounts, muted = false }: { amounts: ModuleAmount[]; muted?: boolean }) => {
  const list = moduleVisibleAmounts(amounts)

  return (
    <span className="flex shrink-0 flex-col items-end">
      {list.map((a, i) => (
        <span
          key={a.currency}
          className={cn(
            'whitespace-nowrap tabular-nums',
            i === 0
              ? cn('text-[14.5px] font-bold', muted ? 'text-text-muted' : 'text-text')
              : 'text-[11.5px] font-semibold text-text-soft',
          )}
        >
          {money(a.reserved, a.currency)}
        </span>
      ))}
    </span>
  )
}
