'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronRight } from 'lucide-react'
import type { AvailableSums, PurposeSums } from '@grana/savings'
import type { BalanceCurrency } from '@grana/money-logic'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { Button } from '@/components/ui/button'
import { SavingsDrawer } from '@/lib/savings/components/savings-drawer'
import { cn } from '@/lib/utils'

const CURRENCIES = ['ARS', 'USD'] as const

const money = (amount: number, currency: BalanceCurrency) =>
  currency === 'USD' ? formatUSD(amount) : formatARS(amount, true)

/** El monto de un grupo en una moneda. Ausente en la respuesta = cero. */
const groupAmount = (rows: PurposeSums[], currency: BalanceCurrency, purposeId: string | null) =>
  rows.find((r) => r.currencyCode === currency && r.purposeId === purposeId)?.reserved ?? 0

type Group = {
  purposeId: string | null
  name: string | null
  icon: string | null
  amounts: { currency: BalanceCurrency; reserved: number }[]
}

/**
 * La lectura del módulo.
 *
 * La cabecera es una GRILLA de dos conceptos por dos monedas, no una línea
 * subordinada: con dólares de verdad hacen falta dos números en dólares, y la
 * línea única solo alcanza para uno. Una cabecera que cambia de estructura el
 * día que alguien compra dólares en serio es peor que cualquiera de las dos.
 *
 * Las columnas NUNCA se suman ni se cruzan.
 */
export const SavingsOverview = ({
  sums,
  purposeSums,
}: {
  sums: AvailableSums[]
  purposeSums: PurposeSums[]
}) => {
  const t = useTranslations('savings')
  const [drawer, setDrawer] = useState<{ mode: 'save' | 'release'; currency: BalanceCurrency } | null>(
    null,
  )

  const row = (currency: BalanceCurrency) =>
    sums.find((s) => s.currencyCode === currency) ?? {
      currencyCode: currency,
      accountsNet: 0,
      reserved: 0,
      available: 0,
    }

  const totalReserved = CURRENCIES.reduce((acc, c) => acc + row(c).reserved, 0)

  // Los grupos con nombre, por lo que pesan; «Sin destino» va aparte, al pie.
  const groups: Group[] = Array.from(
    purposeSums
      .filter((r) => r.purposeId != null)
      .reduce((map, r) => {
        const g = map.get(r.purposeId!) ?? {
          purposeId: r.purposeId,
          name: r.purposeName,
          icon: r.purposeIcon,
          amounts: [],
        }
        g.name ??= r.purposeName
        g.icon ??= r.purposeIcon
        map.set(r.purposeId!, g)
        return map
      }, new Map<string, Group>())
      .values(),
  )
    .map((g) => ({
      ...g,
      amounts: CURRENCIES.map((c) => ({
        currency: c,
        reserved: groupAmount(purposeSums, c, g.purposeId),
      })),
    }))
    .sort(
      (a, b) =>
        b.amounts[0].reserved - a.amounts[0].reserved ||
        b.amounts[1].reserved - a.amounts[1].reserved,
    )

  const restAmounts = CURRENCIES.map((c) => ({
    currency: c,
    reserved: groupAmount(purposeSums, c, null),
  }))
  const restHasMoney = restAmounts.some((a) => a.reserved > 0)

  if (totalReserved <= 0) {
    return (
      <>
        <Headline sums={sums} rowFor={row} />
        <div className="mt-4 rounded-2xl border border-border-soft bg-card p-5">
          <h2 className="text-[16px] font-extrabold tracking-[-0.01em] text-text">
            {t('empty_title')}
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-snug text-text-muted">{t('empty_body')}</p>
          <Button className="mt-4 h-11 w-full" onClick={() => setDrawer({ mode: 'save', currency: 'ARS' })}>
            {t('empty_cta')}
          </Button>
        </div>
        <Drawer state={drawer} onClose={() => setDrawer(null)} />
      </>
    )
  }

  return (
    <>
      <Headline sums={sums} rowFor={row} />

      <p className="mt-5 px-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-text-soft">
        {t('purposes.label')}
      </p>

      <ul className="mt-2 flex flex-col gap-1.5">
        {groups.map((g) => (
          <li key={g.purposeId}>
            {/* La fila hace UNA cosa: abrir el detalle. Sin acción contextual —
                guardar cambia el total y su tope no está acá (D18), y destinar
                por fila no ahorra ningún tap sobre el enlace del resto. */}
            <button
              type="button"
              className="flex min-h-[52px] w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-surface-sunken"
            >
              <span aria-hidden className="text-[16px]">
                {g.icon ?? '🫙'}
              </span>
              <span className="flex-1 truncate text-[14px] font-semibold text-text">{g.name}</span>
              <GroupAmounts amounts={g.amounts} />
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
          <GroupAmounts amounts={restAmounts} muted />
        </div>
        {restHasMoney && (
          // 44px de alto cada uno y separados: pegados por un punto medio, el
          // error más probable es tocar «Volver a usar» queriendo «Destinar» —
          // la que saca plata del disponible y la que no la toca.
          <div className="flex gap-1.5 pl-[30px]">
            <button
              type="button"
              className="flex min-h-[44px] items-center rounded-[10px] px-2.5 text-[13px] font-bold text-emerald-deep transition-colors hover:bg-surface-sunken"
            >
              {t('purposes.allocate')}
            </button>
            <button
              type="button"
              className="flex min-h-[44px] items-center rounded-[10px] px-2.5 text-[13px] font-bold text-emerald-deep transition-colors hover:bg-surface-sunken"
            >
              {t('release')}
            </button>
          </div>
        )}
      </div>

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

      <Drawer state={drawer} onClose={() => setDrawer(null)} />
    </>
  )
}

const Drawer = ({
  state,
  onClose,
}: {
  state: { mode: 'save' | 'release'; currency: BalanceCurrency } | null
  onClose: () => void
}) => <SavingsDrawer open={state != null} onClose={onClose} initialMode={state ?? undefined} />

/**
 * Dos conceptos por dos monedas. Los pesos primarios —tipografía más grande,
 * primera columna— y los dólares subordinados. La celda vacía lleva un guión:
 * dice "no tenés" en vez de dejar la pregunta sin contestar.
 */
const Headline = ({
  sums,
  rowFor,
}: {
  sums: AvailableSums[]
  rowFor: (currency: BalanceCurrency) => AvailableSums
}) => {
  const t = useTranslations('savings')
  const hasUsd = sums.some((s) => s.currencyCode === 'USD')

  return (
    <div className="rounded-2xl border border-border-soft bg-card px-[18px] py-4">
      <div
        className={cn(
          'grid items-baseline gap-x-4 gap-y-1',
          hasUsd ? 'grid-cols-[1fr_auto_auto]' : 'grid-cols-[1fr_auto]',
        )}
      >
        <span />
        <HeadCell>{t('currency_ars')}</HeadCell>
        {hasUsd && <HeadCell>{t('currency_usd')}</HeadCell>}

        <span className="text-[13.5px] text-text-muted">{t('to_spend')}</span>
        <Amount value={rowFor('ARS').available} currency="ARS" />
        {hasUsd && <Amount value={rowFor('USD').available} currency="USD" subordinate />}

        <span className="pt-1 text-[14px] font-semibold text-text">{t('total_saved')}</span>
        <Amount value={rowFor('ARS').reserved} currency="ARS" strong />
        {hasUsd && <Amount value={rowFor('USD').reserved} currency="USD" strong subordinate />}
      </div>
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
      strong ? 'font-extrabold text-emerald-deep' : 'font-bold text-text',
      subordinate ? (strong ? 'text-[15px]' : 'text-[13px] font-semibold text-text-muted') : strong ? 'text-[21px] tracking-[-0.01em]' : 'text-[15px]',
    )}
  >
    {value === 0 && subordinate ? '—' : money(value, currency)}
  </span>
)

/**
 * Los montos de un grupo, en las dos monedas y SIN sumarlas. La fila crece solo
 * cuando el dato lo pide: un propósito con pesos únicamente ocupa una línea.
 * Los montos no se achican ni se parten — el que cede es el nombre (D24).
 */
const GroupAmounts = ({
  amounts,
  muted = false,
}: {
  amounts: { currency: BalanceCurrency; reserved: number }[]
  muted?: boolean
}) => {
  const shown = amounts.filter((a) => a.reserved !== 0)
  const list = shown.length > 0 ? shown : [amounts[0]]

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
