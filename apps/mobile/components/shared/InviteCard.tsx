import { useState } from 'react'
import { Share, Text, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '../ui/Button'
import { Alert } from '../ui/Alert'
import { useT } from '../../lib/locale-context'
import { createInvite } from '../../lib/shared/mutators'

// Mobile mirror of web's invite-card. Web offers copy / WhatsApp / native share
// as three buttons; on mobile the OS share sheet already bundles all of those,
// so we generate the code, show it as a selectable monospace text (long-press to
// copy), and expose a single "Compartir" that opens the native share sheet.
export function InviteCard() {
  const t = useT()
  const queryClient = useQueryClient()
  const [code, setCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const generate = async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await createInvite(queryClient)
      if (res.ok && res.code) setCode(res.code)
      else setError((!res.ok && res.formError) || 'No se pudo generar el código.')
    } finally {
      setLoading(false)
    }
  }

  const share = async () => {
    if (!code) return
    await Share.share({ message: t('shared.invite.share_message', { code }) })
  }

  return (
    <View className="flex-col gap-4 rounded-2xl border border-border bg-card shadow-sm p-5">
      <View className="flex-col gap-1">
        <Text className="text-lg font-semibold text-text">{t('shared.invite.title')}</Text>
        <Text className="text-sm text-text-muted">{t('shared.invite.hint')}</Text>
      </View>

      {code ? (
        <View className="flex-col gap-4">
          <View className="items-center rounded-xl border border-border-soft bg-page py-4">
            <Text selectable className="text-2xl font-semibold tracking-[4px] text-text">
              {code}
            </Text>
          </View>
          <Button variant="primary" onPress={share}>
            {t('shared.invite.share_action')}
          </Button>
        </View>
      ) : (
        <Button variant="primary" onPress={generate} loading={loading}>
          {t('shared.invite.generate_action')}
        </Button>
      )}

      {error ? <Alert variant="error">{error}</Alert> : null}
    </View>
  )
}
