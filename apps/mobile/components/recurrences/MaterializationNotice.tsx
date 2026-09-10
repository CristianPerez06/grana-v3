import { ActivityIndicator, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AlertTriangle } from 'lucide-react-native'
import { materializationOutcome } from '@grana/recurrences'
import { useT } from '../../lib/locale-context'
import { useRecurrenceMaterialization } from '../../lib/recurrences/materialization-context'
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
 * a year of daily backlog takes several runs and nobody is going to reopen the
 * app eight times to see their own history.
 *
 * The three-way decision itself lives in `materializationOutcome`, shared with
 * web, so the two platforms cannot answer it differently.
 */
export function MaterializationNotice() {
  const t = useT()
  const state = useRecurrenceMaterialization()
  // The notice sits ABOVE every screen's `PageHeader`, so it is the top-most
  // thing on screen and nothing else is clearing the status bar for it. Without
  // this it renders under the notch: unreadable text and a half-covered button.
  //
  // The inset lives HERE and not in the layout that mounts it, because the
  // notice renders nothing most of the time — padding applied one level up
  // would leave a permanent gap at the top of the app for a notice that is not
  // there.
  const insets = useSafeAreaInsets()

  if (!state) return null
  const { running, run } = state
  const outcome = materializationOutcome(state)
  if (outcome.kind === 'quiet') return null

  if (outcome.kind === 'failed') {
    return (
      <View style={{ paddingTop: insets.top }}>
        <RecurrenceFailureNotice
          title={t('recurrences.materialization.failed_title')}
          body={t('recurrences.materialization.failed_body')}
          onRetry={run}
          retrying={running}
        />
      </View>
    )
  }

  return (
    <View style={{ paddingTop: insets.top }}>
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
    </View>
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
