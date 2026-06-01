'use client'

import { useState } from 'react'
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
}

/**
 * Client orchestrator for the card detail. Holds the selected statement
 * (`periodo`) and tab. Default focus: "a pagar" if it exists, else "en curso"
 * (README §Estado). Clicking a timeline step / hero / mini-row selects that
 * statement and returns to the movements tab. No scrollIntoView, no pane
 * enter-animation (handoff note).
 */
export const CardDetailView = ({ vm, todayISO, showCents = false }: Props) => {
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
    <div className="flex flex-col gap-6">
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

        {vm.prox && (
          <ProximoMiniRow
            period={vm.prox}
            selected={effectivePeriod === 'prox'}
            accent={vm.accent}
            showCents={showCents}
            onSelect={() => selectPeriod('prox')}
          />
        )}
      </div>

      <CardLimitPanel
        cardId={vm.cardId}
        creditLimit={vm.creditLimit}
        committedARS={vm.committedARS}
        accent={vm.accent}
        showCents={showCents}
      />

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
  )
}
