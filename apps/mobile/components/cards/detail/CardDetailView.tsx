import { useState } from 'react'
import { View } from 'react-native'
import type { CardDetailViewModel, PeriodKey } from '@grana/cards'
import { useShowCents } from '../../../lib/preferences-context'
import { useT } from '../../../lib/locale-context'
import { Segmented } from '../../ui/Segmented'
import { LifecycleTimeline } from './LifecycleTimeline'
import { PayHeroCard } from './PayHeroCard'
import { EnCursoCard } from './EnCursoCard'
import { ProximoMiniRow } from './ProximoMiniRow'
import { CardLimitPanel } from './CardLimitPanel'
import { CuotasEnCursoPane } from './CuotasEnCursoPane'
import { PeriodMovementsPane } from './PeriodMovementsPane'

type Tab = 'movs' | 'cuotas'

type Props = {
  vm: CardDetailViewModel
  /** Financial "today" (from getTodayAR) — feeds the pane's date group labels. */
  todayISO: string
}

/**
 * Native read-only orchestrator for the active card detail (mirror of the web
 * `CardDetailView`, minus writes). Holds the selected statement so the timeline
 * and heroes stay in sync, plus a `[Movimientos | Cuotas]` segmented (default
 * Movimientos) that shows the selected period's movements pane or the active
 * installments. The "a pagar" hero is display-only. Default focus: "a pagar" if
 * it exists, else "en curso".
 */
export const CardDetailView = ({ vm, todayISO }: Props) => {
  const t = useT()
  const showCents = useShowCents()
  const [periodo, setPeriodo] = useState<PeriodKey>(vm.apagar ? 'apagar' : 'curso')
  const [tab, setTab] = useState<Tab>('movs')

  // Guard: if there is no "a pagar" but it's selected, fall back to "en curso".
  const active: PeriodKey = periodo === 'apagar' && !vm.apagar ? 'curso' : periodo

  // Selecting a period in the timeline focuses its movements.
  const selectPeriod = (p: PeriodKey) => {
    setPeriodo(p)
    setTab('movs')
  }

  const selectedPeriod =
    active === 'apagar' ? vm.apagar : active === 'prox' ? vm.prox : vm.curso

  return (
    <View className="flex-col gap-5">
      <LifecycleTimeline
        hasApagar={vm.apagar !== null}
        hasPaid={vm.hasPaid}
        cursoCloseDate={vm.curso.end_date}
        cursoIsEstimated={vm.curso.is_estimated}
        apagarDueDate={vm.apagar?.due_date ?? null}
        proxCloseDate={vm.prox?.end_date ?? null}
        proxIsEstimated={vm.prox?.is_estimated ?? false}
        active={active}
        accent={vm.accent}
        onSelect={selectPeriod}
      />

      <View className="flex-col gap-4">
        {vm.apagar ? (
          <>
            <PayHeroCard
              period={vm.apagar}
              daysToDue={vm.apagarDaysToDue ?? 0}
              selected={active === 'apagar'}
              showCents={showCents}
              onSelect={() => selectPeriod('apagar')}
            />
            <EnCursoCard
              period={vm.curso}
              isHero={false}
              selected={active === 'curso'}
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
            selected={active === 'curso'}
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
            selected={active === 'prox'}
            accent={vm.accent}
            showCents={showCents}
            onSelect={() => selectPeriod('prox')}
          />
        )}
      </View>

      <CardLimitPanel
        creditLimit={vm.creditLimit}
        committedARS={vm.committedARS}
        accent={vm.accent}
        showCents={showCents}
      />

      <Segmented
        value={tab}
        onValueChange={(v) => setTab(v as Tab)}
        ariaLabel={t('cards.detail.tab_movements')}
        options={[
          { value: 'movs', label: t('cards.detail.tab_movements') },
          {
            value: 'cuotas',
            label:
              vm.installments.length > 0
                ? `${t('cards.detail.tab_installments')} · ${vm.installments.length}`
                : t('cards.detail.tab_installments'),
          },
        ]}
      />

      {tab === 'movs' && selectedPeriod ? (
        <PeriodMovementsPane
          cardId={vm.cardId}
          period={selectedPeriod}
          periodKey={active}
          todayISO={todayISO}
        />
      ) : (
        <CuotasEnCursoPane
          items={vm.installments}
          totalRemaining={vm.installmentsTotalRemaining}
          accent={vm.accent}
          showCents={showCents}
        />
      )}
    </View>
  )
}
