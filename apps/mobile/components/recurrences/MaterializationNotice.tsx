import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { AlertTriangle } from 'lucide-react-native'
import { useT } from '../../lib/locale-context'
import { useRecurrenceMaterialization } from '../../lib/recurrences/materialization-context'
import { colors } from '../../lib/colors'

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
 * Web parity: `apps/web/lib/recurrences/components/materialization-notice.tsx`.
 */
export function MaterializationNotice() {
  const t = useT()
  const state = useRecurrenceMaterialization()

  if (!state) return null
  const { running, remaining, error, run } = state
  if (!error && remaining === 0) return null

  const isFailure = error != null

  return (
    <View
      accessibilityRole={isFailure ? 'alert' : undefined}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: isFailure ? colors.error : colors.border,
        backgroundColor: isFailure ? 'rgba(197, 75, 60, 0.06)' : colors.borderSoft,
        paddingHorizontal: 14,
        paddingVertical: 12,
      }}
    >
      {isFailure ? (
        <AlertTriangle size={16} color={colors.error} />
      ) : running ? (
        <ActivityIndicator size="small" color={colors.textSoft} />
      ) : null}

      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        {isFailure ? (
          <>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
              {t('recurrences.materialization.failed_title')}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSoft }}>
              {t('recurrences.materialization.failed_body')}
            </Text>
          </>
        ) : (
          <Text style={{ fontSize: 12, color: colors.textSoft }}>
            {t('recurrences.materialization.remaining', { count: remaining })}
          </Text>
        )}
      </View>

      <Pressable onPress={run} disabled={running} accessibilityRole="button">
        <Text
          style={{
            fontSize: 13,
            fontWeight: '600',
            color: running ? colors.textSoft : colors.emeraldDeep,
          }}
        >
          {running
            ? t('recurrences.materialization.running')
            : t(
                isFailure
                  ? 'recurrences.materialization.retry'
                  : 'recurrences.materialization.continue',
              )}
        </Text>
      </Pressable>
    </View>
  )
}
