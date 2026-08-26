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

  // Las decisiones de qué se muestra viven en `@grana/savings`, testeadas y
  // compartidas con lo que va a necesitar mobile. Acá solo se dibujan.
  const hasAnythingSaved = moduleHasSavings(sums)

  return (
    <div className="flex flex-col">
      <Grid sums={sums} />

      {hasAnythingSaved ? (
        <>
          {children}
          {/* Contenidos en desktop: a lo ancho de la página quedaban enormes
              para dos acciones. En teléfono siguen ocupando el ancho. */}
          <div className="mt-5 flex gap-2.5 sm:max-w-[26rem]">
            <Button
              size="lg"
              className="h-12 flex-1 font-semibold"
              onClick={() => setDrawer({ mode: 'save', currency: 'ARS' })}
            >
              {t('save')}
            </Button>
            {/* El borde es lo que lo separa de un control deshabilitado: sin él,
                un relleno gris claro se lee como apagado y no como secundario. */}
            <Button
              variant="secondary"
              size="lg"
              className="h-12 flex-1 border border-border bg-card font-semibold hover:bg-border-soft"
              onClick={() => setDrawer({ mode: 'release', currency: 'ARS' })}
            >
              {t('release')}
            </Button>
          </div>
        </>
      ) : (
        // Sin nada guardado no hay desglose que mostrar ni de dónde volver a
        // usar: una sola acción y la frase que evita el malentendido.
        <div className="mt-4 rounded-2xl border border-border-soft bg-card p-5 sm:max-w-[34rem]">
          <h2 className="text-[16px] font-extrabold tracking-[-0.01em] text-text">
            {t('empty_title')}
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-snug text-text-muted">{t('empty_body')}</p>
          <Button
            size="lg"
            className="mt-4 h-12 font-semibold sm:max-w-[16rem]"
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

/**
 * Dos conceptos por dos monedas.
 *
 * El protagonismo de «Guardado» sale del PESO y no del tamaño ni del color: los
 * dos montos comparten cuerpo, y lo que los separa es que uno es extrabold en
 * tinta plena y el otro normal en gris. Una cifra verde gigante grita, y encima
 * usa el color de acento —el de las acciones— en un número que no es una acción.
 *
 * El ancho se topea: estirada a la página entera, la distancia entre el rótulo y
 * su monto la volvía una planilla.
 */
const Grid = ({ sums }: { sums: AvailableSums[] }) => {
  const t = useTranslations('savings')
  const showUsd = moduleShowsUsd(sums)
  const rowFor = (currency: BalanceCurrency) => moduleRowFor(sums, currency)

  return (
    <div className="rounded-2xl border border-border-soft bg-card px-5 py-[18px] shadow-sm sm:max-w-[34rem]">
      <div
        className={cn(
          'grid items-baseline gap-x-6 gap-y-1.5',
          showUsd ? 'grid-cols-[1fr_auto_auto]' : 'grid-cols-[1fr_auto]',
        )}
      >
        <span />
        <HeadCell>{t('currency_ars')}</HeadCell>
        {showUsd && <HeadCell>{t('currency_usd')}</HeadCell>}

        <Label>{t('to_spend')}</Label>
        <Amount value={rowFor('ARS').available} currency="ARS" />
        {showUsd && <Amount value={rowFor('USD').available} currency="USD" subordinate />}

        <Label strong>{t('total_saved')}</Label>
        <Amount value={rowFor('ARS').reserved} currency="ARS" strong />
        {showUsd && <Amount value={rowFor('USD').reserved} currency="USD" strong subordinate />}
      </div>
    </div>
  )
}

const HeadCell = ({ children }: { children: React.ReactNode }) => (
  <span className="pb-1 text-right text-[10px] font-bold uppercase tracking-[0.14em] text-text-soft">
    {children}
  </span>
)

const Label = ({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) => (
  <span
    className={cn(
      'pt-1.5 text-[14px]',
      strong ? 'font-semibold text-text' : 'font-normal text-text-muted',
    )}
  >
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
      'whitespace-nowrap pt-1.5 text-right tabular-nums',
      subordinate ? 'text-[15px]' : 'text-[20px] tracking-[-0.01em]',
      strong ? 'font-extrabold text-text' : 'font-normal text-text-muted',
    )}
  >
    {money(value, currency)}
  </span>
)
