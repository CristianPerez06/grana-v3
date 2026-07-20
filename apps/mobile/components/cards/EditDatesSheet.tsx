import { useState } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { updatePeriodDates } from '../../lib/cards/mutations'
import { useT } from '../../lib/locale-context'
import { DateField } from '../ui/DateField'
import { Button } from '../ui/Button'

type Props = {
  visible: boolean
  onClose: () => void
  periodId: string
  currentEndDate: string
  currentDueDate: string
  /** Start date of the next period, or null when this is the last period. */
  nextPeriodStart: string | null
  /** The next period already has a payment ⇒ the boundary can't move. */
  nextPeriodIsPaid: boolean
}

const addOneDay = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + 1)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/**
 * Native "Editar fechas" sheet over `updatePeriodDates` (mirror of the web
 * edit-dates-sheet). Editing the close date can cascade the boundary with the
 * next period; when that next period is already paid the boundary is locked and
 * the sheet blocks the save. Chronology (due after close) is enforced both here
 * and server-side.
 */
export function EditDatesSheet({
  visible,
  onClose,
  periodId,
  currentEndDate,
  currentDueDate,
  nextPeriodStart,
  nextPeriodIsPaid,
}: Props) {
  const t = useT()
  const queryClient = useQueryClient()
  const [endDate, setEndDate] = useState(currentEndDate)
  const [dueDate, setDueDate] = useState(currentDueDate)
  const [openPicker, setOpenPicker] = useState<'end' | 'due' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const newNextStart = nextPeriodStart !== null ? addOneDay(endDate) : null
  const boundaryMoves =
    nextPeriodStart !== null && newNextStart !== null && newNextStart !== nextPeriodStart
  const blockedByPaidNext = boundaryMoves && nextPeriodIsPaid

  const handleSubmit = async () => {
    setError(null)
    if (blockedByPaidNext) {
      setError(t('cards.edit_dates.error_next_paid'))
      return
    }
    if (dueDate <= endDate) {
      setError(t('cards.errors.due_after_close'))
      return
    }
    setSubmitting(true)
    const result = await updatePeriodDates(queryClient, periodId, {
      end_date: endDate,
      due_date: dueDate,
    })
    setSubmitting(false)
    if (result.ok) onClose()
    else setError(t(result.errorKey))
  }

  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="slide"
      presentationStyle="formSheet"
    >
      <View className="flex-1 bg-page">
        <View className="flex-row items-center justify-between border-b border-border px-5 py-4">
          <Text className="text-lg font-semibold text-text">
            {t('cards.edit_dates.dialog_title')}
          </Text>
          <Pressable onPress={onClose} accessibilityRole="button">
            <Text className="text-sm font-medium text-emerald">{t('common.close')}</Text>
          </Pressable>
        </View>

        <View className="flex-col gap-5 px-6 py-6">
          <View className="flex-col gap-1.5">
            <Text className="text-xs font-medium text-text-muted">
              {t('cards.edit_dates.close_label')}
            </Text>
            <DateField
              value={endDate}
              onChange={setEndDate}
              open={openPicker === 'end'}
              onOpenChange={(o) => setOpenPicker(o ? 'end' : null)}
            />
          </View>

          <View className="flex-col gap-1.5">
            <Text className="text-xs font-medium text-text-muted">
              {t('cards.edit_dates.due_label')}
            </Text>
            <DateField
              value={dueDate}
              onChange={setDueDate}
              open={openPicker === 'due'}
              onOpenChange={(o) => setOpenPicker(o ? 'due' : null)}
            />
          </View>

          {error && <Text className="text-sm text-error">{error}</Text>}

          <Button onPress={handleSubmit} loading={submitting} disabled={blockedByPaidNext}>
            {t('cards.actions.save')}
          </Button>
        </View>
      </View>
    </Modal>
  )
}
