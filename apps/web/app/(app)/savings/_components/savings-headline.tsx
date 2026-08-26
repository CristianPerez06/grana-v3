'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { moduleHasSavings, moduleRowFor, moduleShowsUsd } from '@grana/savings'
import type { AvailableSums } from '@grana/savings'
import type { BalanceCurrency } from '@grana/money-logic'
import { Button } from '@/components/ui/button'
import { SavingsDrawer } from '@/lib/savings/components/savings-drawer'
import { cn } from '@/lib/utils'
import { money } from './money'

type DrawerState = { mode: 'save' | 'release'; currency: BalanceCurrency } | null

/**
 * La foto del módulo y sus dos acciones globales, con el desglose en el medio.
 *
 * La cabecera es una GRILLA de dos conceptos por dos monedas, no una línea
 * subordinada: con dólares de verdad hacen falta dos números en dólares, y la
 * línea única solo alcanza para uno. Las columnas NUNCA se suman ni se cruzan.
 *
 * Las acciones viven acá y no en las filas de la lista: guardar cambia el TOTAL
 * guardado, y su tope —el disponible— es justo lo que esta grilla muestra.
 */
export const SavingsHeadline = ({
  sums,
  children,
}: {
  sums: AvailableSums[]
  children: React.ReactNode
}) => {
  const t = useTranslations('savings')
  const [drawer, setDrawer] = useState<DrawerState>(null)

  // Las cuatro decisiones de qué se muestra viven en `@grana/savings`, testeadas
  // y compartidas con lo que va a necesitar mobile. Acá solo se dibujan.
  const rowFor = (currency: BalanceCurrency) => moduleRowFor(sums, currency)
  const hasAnythingSaved = moduleHasSavings(sums)

  return (
    <div className="flex flex-col">
      <Grid sums={sums} rowFor={rowFor} />

      {hasAnythingSaved ? (
        <>
          {children}
          <div className="mt-5 flex gap-2">
            <Button className="flex-1" onClick={() => setDrawer({ mode: 'save', currency: 'ARS' })}>
              {t('save')}
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setDrawer({ mode: 'release', currency: 'ARS' })}
            >
              {t('release')}
            </Button>
          </div>
        </>
      ) : (
        // Sin nada guardado no hay desglose que mostrar ni de dónde volver a
        // usar: una sola acción y la frase que evita el malentendido.
        <div className="mt-4 rounded-2xl border border-border-soft bg-card p-5">
          <h2 className="text-[16px] font-extrabold tracking-[-0.01em] text-text">
            {t('empty_title')}
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-snug text-text-muted">{t('empty_body')}</p>
          <Button
            className="mt-4 h-11 w-full"
            onClick={() => setDrawer({ mode: 'save', currency: 'ARS' })}
          >
            {t('empty_cta')}
          </Button>
        </div>
      )}

      {/* El overlay abre DIRECTO al formulario, así que su vista de detalle
          nunca se dibuja: la lectura vive en esta página y no se duplica. */}
      <SavingsDrawer
        open={drawer != null}
        onClose={() => setDrawer(null)}
        initialMode={drawer ?? undefined}
      />
    </div>
  )
}

const Grid = ({
  sums,
  rowFor,
}: {
  sums: AvailableSums[]
  rowFor: (currency: BalanceCurrency) => AvailableSums
}) => {
  const t = useTranslations('savings')
  const showUsd = moduleShowsUsd(sums)

  return (
    <div className="rounded-2xl border border-border-soft bg-card px-[18px] py-4">
      <div
        className={cn(
          'grid items-baseline gap-x-4 gap-y-1',
          showUsd ? 'grid-cols-[1fr_auto_auto]' : 'grid-cols-[1fr_auto]',
        )}
      >
        <span />
        <HeadCell>{t('currency_ars')}</HeadCell>
        {showUsd && <HeadCell>{t('currency_usd')}</HeadCell>}

        <span className="text-[13.5px] text-text-muted">{t('to_spend')}</span>
        <Amount value={rowFor('ARS').available} currency="ARS" />
        {showUsd && <Amount value={rowFor('USD').available} currency="USD" subordinate />}

        <span className="pt-1 text-[14px] font-semibold text-text">{t('total_saved')}</span>
        <Amount value={rowFor('ARS').reserved} currency="ARS" strong />
        {showUsd && <Amount value={rowFor('USD').reserved} currency="USD" strong subordinate />}
      </div>
      {sums.length === 0 && <span className="sr-only">{t('empty_title')}</span>}
    </div>
  )
}

const HeadCell = ({ children }: { children: React.ReactNode }) => (
  <span className="pb-0.5 text-right text-[9.5px] font-bold uppercase tracking-[0.12em] text-text-soft">
    {children}
  </span>
)

const Amount = ({
  value,
  currency,
  strong = false,
  subordinate = false,
}: {
  value: number
  currency: BalanceCurrency
  strong?: boolean
  subordinate?: boolean
}) => (
  <span
    className={cn(
      'whitespace-nowrap text-right tabular-nums',
      strong && 'font-extrabold text-emerald-deep',
      !strong && !subordinate && 'text-[15px] font-bold text-text',
      !strong && subordinate && 'text-[13px] font-semibold text-text-muted',
      strong && !subordinate && 'text-[21px] tracking-[-0.01em]',
      strong && subordinate && 'text-[15px]',
    )}
  >
    {money(value, currency)}
  </span>
)
