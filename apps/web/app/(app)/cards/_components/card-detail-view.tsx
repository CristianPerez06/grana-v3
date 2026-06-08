'use client'

import { useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Segmented } from '@/components/ui/segmented'
import type { CardDetailViewModel, PeriodKey } from './card-detail-types'
import { LifecycleTimeline } from './lifecycle-timeline'
import { PayHeroCard } from './pay-hero-card'
import { EnCursoCard } from './en-curso-card'
import { ProximoMiniRow } from './proximo-mini-row'
import { CardLimitPanel } from './card-limit-panel'
import { PeriodMovementsPane } from './period-movements-pane'
import { CuotasEnCursoPane } from './cuotas-en-curso-pane'

type Tab = 'movs' | 'cuotas'

type Props = {
  vm: CardDetailViewModel
  todayISO: string
  showCents?: boolean
  /**
   * Extra content rendered inside the side column on desktop (and stacked at
   * the bottom on narrow widths) — e.g. the "ver todos los resúmenes" link
   * and the admin metadata footer.
   */
  sideExtras?: ReactNode
}

/**
 * Client orchestrator for the card detail. Holds the selected statement
 * (`periodo`) and tab. Default focus: "a pagar" if it exists, else "en curso"
 * (README §Estado). Clicking a timeline step / hero / mini-row selects that
 * statement and returns to the movements tab. On lg+ the route splits into a
 * main stack (timeline, heroes, segmented, pane) and a side stack (próximo
 * mini-row, limit panel, admin extras); on narrow widths everything stacks.
 */
export const CardDetailView = ({ vm, todayISO, showCents = false, sideExtras }: Props) => {
  const t = useTranslations('cards')
  const [periodo, setPeriodo] = useState<PeriodKey>(vm.apagar ? 'apagar' : 'curso')
  const [tab, setTab] = useState<Tab>('movs')

  // Guard: if there is no "a pagar" but it's selected, fall back to "en curso".
  const effectivePeriod: PeriodKey = periodo === 'apagar' && !vm.apagar ? 'curso' : periodo

  const selectPeriod = (p: PeriodKey) => {
    setPeriodo(p)
    setTab('movs')
  }

  const selectedPeriod =
    effectivePeriod === 'apagar' ? vm.apagar : effectivePeriod === 'prox' ? vm.prox : vm.curso

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-5">
        <LifecycleTimeline
          hasApagar={vm.apagar !== null}
          hasPaid={vm.hasPaid}
          cursoCloseDate={vm.curso.end_date}
          apagarDueDate={vm.apagar?.due_date ?? null}
          proxCloseDate={vm.prox?.end_date ?? null}
          active={effectivePeriod}
          accent={vm.accent}
          onSelect={selectPeriod}
        />

        {/* Heroes: pay-hero (if any) + en-curso, else en-curso as hero */}
        <div className="flex flex-col gap-4">
          {vm.apagar ? (
            <>
              <PayHeroCard
                cardId={vm.cardId}
                period={vm.apagar}
                daysToDue={vm.apagarDaysToDue ?? 0}
                selected={effectivePeriod === 'apagar'}
                showCents={showCents}
                onSelect={() => selectPeriod('apagar')}
              />
              <EnCursoCard
                period={vm.curso}
                isHero={false}
                selected={effectivePeriod === 'curso'}
                accent={vm.accent}
                cycleDay={vm.cursoCycleDay}
                cycleTotal={vm.cursoCycleTotal}
                daysToClose={vm.cursoDaysToClose}
                movementsCount={vm.curso.transactions.length}
                installmentsARS={vm.cursoInstallmentsARS}
                showCents={showCents}
                onSelect={() => selectPeriod('curso')}
              />
            </>
          ) : (
            <EnCursoCard
              period={vm.curso}
              isHero
              selected={effectivePeriod === 'curso'}
              accent={vm.accent}
              cycleDay={vm.cursoCycleDay}
              cycleTotal={vm.cursoCycleTotal}
              daysToClose={vm.cursoDaysToClose}
              movementsCount={vm.curso.transactions.length}
              installmentsARS={vm.cursoInstallmentsARS}
              showCents={showCents}
              onSelect={() => selectPeriod('curso')}
            />
          )}

          {/* On narrow widths the próximo mini row stays in the main flow next to
              the hero (mirrors the mobile mock). On lg+ it moves into the side
              column below. */}
          {vm.prox && (
            <div className="lg:hidden">
              <ProximoMiniRow
                period={vm.prox}
                selected={effectivePeriod === 'prox'}
                accent={vm.accent}
                showCents={showCents}
                onSelect={() => selectPeriod('prox')}
              />
            </div>
          )}
        </div>

        {/* The limit panel sits in the main flow on narrow widths, in the side
            column on lg+. */}
        <div className="lg:hidden">
          <CardLimitPanel
            cardId={vm.cardId}
            creditLimit={vm.creditLimit}
            committedARS={vm.committedARS}
            accent={vm.accent}
            showCents={showCents}
          />
        </div>

        <Segmented
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          ariaLabel={t('detail.tab_movements')}
          options={[
            { value: 'movs', label: t('detail.tab_movements') },
            {
              value: 'cuotas',
              label: vm.installments.length > 0
                ? `${t('detail.tab_installments')} · ${vm.installments.length}`
                : t('detail.tab_installments'),
            },
          ]}
        />

        {tab === 'movs' && selectedPeriod ? (
          <PeriodMovementsPane
            cardId={vm.cardId}
            period={selectedPeriod}
            periodKey={effectivePeriod}
            todayISO={todayISO}
          />
        ) : tab === 'cuotas' ? (
          <CuotasEnCursoPane
            items={vm.installments}
            totalRemaining={vm.installmentsTotalRemaining}
            accent={vm.accent}
            showCents={showCents}
          />
        ) : null}
      </div>

      {/* Side column — visible only on lg+. The mini row + limit panel mirror
          the narrow-width copies above; React keeps state via props. */}
      <aside className="hidden min-w-0 flex-col gap-4 lg:flex">
        {vm.prox && (
          <ProximoMiniRow
            period={vm.prox}
            selected={effectivePeriod === 'prox'}
            accent={vm.accent}
            showCents={showCents}
            onSelect={() => selectPeriod('prox')}
          />
        )}
        <CardLimitPanel
          cardId={vm.cardId}
          creditLimit={vm.creditLimit}
          committedARS={vm.committedARS}
          accent={vm.accent}
          showCents={showCents}
        />
        {sideExtras}
      </aside>

      {/* Side extras stacked at the end of the main column on narrow widths. */}
      {sideExtras && <div className="lg:hidden">{sideExtras}</div>}
    </div>
  )
}
