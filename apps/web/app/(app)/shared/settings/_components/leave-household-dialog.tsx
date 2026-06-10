'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { leaveHousehold } from '@/app/_actions/shared'

type Props = {
  open: boolean
  onClose: () => void
}

/**
 * Confirms leaving the household before invoking `leaveHousehold`. The caller
 * drives `open`; the destructive CTA runs the action and renders any tagged
 * `formError` (including the server-side live-debt block) inline without closing
 * the dialog. On success it closes and navigates back to `/shared`.
 */
export function LeaveHouseholdDialog({ open, onClose }: Props) {
  const t = useTranslations('shared')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setError(null)
    setLoading(true)
    const result = await leaveHousehold()
    setLoading(false)

    if (!result.ok) {
      setError(result.formError ?? t('settings.leave_blocked'))
      return
    }

    onClose()
    router.push('/shared')
    router.refresh()
  }

  const handleClose = () => {
    if (loading) return
    setError(null)
    onClose()
  }

  const title = t('settings.leave_confirm_title')

  return (
    <Dialog open={open} onClose={handleClose} ariaLabel={title}>
      <DialogHeader>{title}</DialogHeader>
      <DialogBody>
        <p>{t('settings.leave_confirm_body')}</p>
        {error && <p className="text-sm font-medium text-negative">{error}</p>}
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onPress={handleClose} disabled={loading}>
          {tCommon('cancel')}
        </Button>
        <Button variant="destructive" onPress={handleConfirm} loading={loading}>
          {t('settings.leave_action')}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
