import type { ReactNode } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AlertTriangle } from 'lucide-react-native'
import { materializationOutcome } from '@grana/recurrences'
import type { MaterializationOutcome } from '@grana/recurrences'
import { useT } from '../../lib/locale-context'
import { useRecurrenceMaterialization } from '../../lib/recurrences/materialization-context'
import { TopInsetTakenProvider } from '../../lib/top-inset'
import { colors } from '../../lib/colors'
import { Button } from '../ui/Button'

/**
 * A failure, with the one thing the user can do about it.
 *
 * Exported because the failure shape is not only the materialization's: failing
 * to READ what is pending has to look the same, and used to look like an empty
 * list instead. Web parity:
 * `apps/web/lib/recurrences/components/materialization-notice.tsx`.
 */
export function RecurrenceFailureNotice({
  title,
  body,
  onRetry,
  retrying,
}: {
  title: string
  body: string
  onRetry: () => void
  retrying: boolean
}) {
  const t = useT()
  return (
    <View accessibilityRole="alert" style={noticeStyle(true)}>
      <AlertTriangle size={16} color={colors.error} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{title}</Text>
        <Text style={{ fontSize: 12, color: colors.textSoft }}>{body}</Text>
      </View>
      <View style={{ width: 104 }}>
        <Button
          variant="ghost"
          size="sm"
          onPress={onRetry}
          disabled={retrying}
          title={
            retrying
              ? t('recurrences.materialization.running')
              : t('recurrences.materialization.retry')
          }
        />
      </View>
    </View>
  )
}

/**
 * What the materialization did, when it is not "everything is up to date".
 *
 * Two states, and the point of both is that neither may look like an empty
 * screen. A failure used to be swallowed, leaving the user with a screen
 * identical to somebody with nothing to review — the opposite claim to the true
 * one. A run that still owes occurrences says so and offers to continue, because
 * a year of backlog takes several runs and nobody is going to reopen the app
 * eight times to see their own history.
 *
 * The three-way decision itself lives in `materializationOutcome`, shared with
 * web, so the two platforms cannot answer it differently.
 */
function MaterializationNotice({
  outcome,
  running,
  run,
}: {
  outcome: Exclude<MaterializationOutcome, { kind: 'quiet' }>
  running: boolean
  run: () => void
}) {
  const t = useT()

  if (outcome.kind === 'failed') {
    return (
      <RecurrenceFailureNotice
        title={t('recurrences.materialization.failed_title')}
        body={t('recurrences.materialization.failed_body')}
        onRetry={run}
        retrying={running}
      />
    )
  }

  return (
    <View style={noticeStyle(false)}>
      {running ? <ActivityIndicator size="small" color={colors.textSoft} /> : null}
      <Text style={{ flex: 1, minWidth: 0, fontSize: 12, color: colors.textSoft }}>
        {t('recurrences.materialization.remaining', { count: outcome.count })}
      </Text>
      <View style={{ width: 152 }}>
        <Button
          variant="ghost"
          size="sm"
          onPress={run}
          disabled={running}
          title={
            running
              ? t('recurrences.materialization.running')
              : t('recurrences.materialization.continue')
          }
        />
      </View>
    </View>
  )
}

/**
 * The notice's place in the app, above every screen — and the top inset that
 * comes with standing there.
 *
 * The notice belongs to the LAYOUT, not to a screen: generation runs on every
 * screen now, so its failure — and a rebuild that still owes occurrences — can
 * happen while the user is in Cuentas, Tarjetas or Ahorros. Rendering it only on
 * Inicio and Movimientos meant the error was invisible exactly where it had just
 * occurred.
 *
 * THE NAVY IS NOT DECORATION. The status bar is drawn `light` (white clock, white
 * wifi) because everything says it sits on the navy header band. Pushing that
 * band down with a page-colored strip put white text on a near-white background
 * and made the notice look detached from the app. So the notice paints the inset
 * navy itself — the band simply starts higher — and tells the headers below, via
 * `TopInsetTakenProvider`, that the inset is already dealt with. Without that
 * second half each `PageHeader` clears it a SECOND time, which is the tall empty
 * navy band QA found.
 *
 * Renders nothing, and takes nothing, when there is nothing to say: the decision
 * is made once, here, and the padding lives with the notice rather than in the
 * layout, where it would leave a permanent gap at the top of the app for a
 * notice that is not there.
 */
export function MaterializationNoticeSlot({ children }: { children: ReactNode }) {
  const state = useRecurrenceMaterialization()
  const insets = useSafeAreaInsets()
  const outcome = state == null ? null : materializationOutcome(state)

  if (state == null || outcome == null || outcome.kind === 'quiet') return <>{children}</>

  return (
    <TopInsetTakenProvider value>
      <View className="bg-navy px-4 pb-3" style={{ paddingTop: insets.top + 8 }}>
        <MaterializationNotice outcome={outcome} running={state.running} run={state.run} />
      </View>
      {children}
    </TopInsetTakenProvider>
  )
}

const noticeStyle = (isFailure: boolean) =>
  ({
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isFailure ? colors.error : colors.border,
    backgroundColor: isFailure ? 'rgba(197, 75, 60, 0.06)' : colors.borderSoft,
    paddingHorizontal: 14,
    paddingVertical: 12,
  }) as const
