import { useState } from 'react'
import { View } from 'react-native'
import type { CardDetailViewModel, PeriodKey } from '@grana/cards'
import { useShowCents } from '../../../lib/preferences-context'
import { LifecycleTimeline } from './LifecycleTimeline'
import { PayHeroCard } from './PayHeroCard'
import { EnCursoCard } from './EnCursoCard'
import { ProximoMiniRow } from './ProximoMiniRow'
import { CardLimitPanel } from './CardLimitPanel'
import { CuotasEnCursoPane } from './CuotasEnCursoPane'

type Props = {
  vm: CardDetailViewModel
}

/**
 * Native read-only orchestrator for the active card detail (mirror of the web
 * `CardDetailView`, minus writes and the movs/cuotas segmented). Holds the
 * selected statement so the timeline and heroes stay in sync; the "a pagar" hero
 * is display-only and the cuotas pane renders inline (the per-period movements
 * pane is deferred). Default focus: "a pagar" if it exists, else "en curso".
 */
export const CardDetailView = ({ vm }: Props) => {
  const showCents = useShowCents()
  const [periodo, setPeriodo] = useState<PeriodKey>(vm.apagar ? 'apagar' : 'curso')

  // Guard: if there is no "a pagar" but it's selected, fall back to "en curso".
  const active: PeriodKey = periodo === 'apagar' && !vm.apagar ? 'curso' : periodo

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
        onSelect={setPeriodo}
      />

      <View className="flex-col gap-4">
        {vm.apagar ? (
          <>
            <PayHeroCard
              period={vm.apagar}
              daysToDue={vm.apagarDaysToDue ?? 0}
              selected={active === 'apagar'}
              showCents={showCents}
              onSelect={() => setPeriodo('apagar')}
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
              onSelect={() => setPeriodo('curso')}
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
            onSelect={() => setPeriodo('curso')}
          />
        )}

        {vm.prox && (
          <ProximoMiniRow
            period={vm.prox}
            selected={active === 'prox'}
            accent={vm.accent}
            showCents={showCents}
            onSelect={() => setPeriodo('prox')}
          />
        )}
      </View>

      <CardLimitPanel
        creditLimit={vm.creditLimit}
        committedARS={vm.committedARS}
        accent={vm.accent}
        showCents={showCents}
      />

      <CuotasEnCursoPane
        items={vm.installments}
        totalRemaining={vm.installmentsTotalRemaining}
        accent={vm.accent}
        showCents={showCents}
      />
    </View>
  )
}
