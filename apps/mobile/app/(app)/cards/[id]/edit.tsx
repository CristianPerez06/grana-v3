import { useRef } from 'react'
import { Alert, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { getInstitutions } from '@grana/accounts'
import { getTodayAR, formatDateISO } from '../../../../lib/date'
import { getCreditCardDetail, getCardNetworks } from '../../../../lib/cards/queries'
import { supabase } from '../../../../lib/supabase'
import { useT } from '../../../../lib/locale-context'
import { FormScreen } from '../../../../components/layout/FormScreen'
import { Spinner } from '../../../../components/ui/Spinner'
import { EditCardForm } from '../../../../components/cards/EditCardForm'

/**
 * Pushed edit screen for a credit card. Loads the card detail + institutions +
 * networks, then renders <EditCardForm> (the write logic). Header chrome is
 * visible from first paint; the back gesture confirms discard when the form has
 * unsaved changes.
 */
export default function EditCardScreen() {
  const t = useT()
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const dirtyRef = useRef(false)

  // Distinct key from the detail screen's `['cards','detail',id]`, which caches a
  // different shape (`{ cardDetail, periods, installments }`) — sharing the key
  // would serve that object here and read `card.type` as undefined (→ not-found).
  const cardQ = useQuery({
    queryKey: ['cards', 'card', id] as const,
    queryFn: () => getCreditCardDetail(id),
  })
  const institutionsQ = useQuery({
    queryKey: ['accounts', 'institutions'] as const,
    queryFn: () => getInstitutions(supabase),
  })
  const networksQ = useQuery({
    queryKey: ['cards', 'networks'] as const,
    queryFn: () => getCardNetworks(),
  })

  const card = cardQ.data ?? null
  const ready = card && institutionsQ.data && networksQ.data
  const notFound = cardQ.isError || (cardQ.isSuccess && (!card || card.type !== 'credit'))

  const goBack = () => {
    if (dirtyRef.current) {
      Alert.alert(t('cards.edit.discard_confirm'), undefined, [
        { text: t('common.back'), style: 'cancel' },
        { text: t('common.close'), style: 'destructive', onPress: () => router.back() },
      ])
      return
    }
    router.back()
  }

  return (
    <FormScreen
      title={t('cards.edit.title')}
      backLink={{ href: '/(app)/cards', label: t('cards.title') }}
      onBackPress={goBack}
    >
      {notFound ? (
        <View className="rounded-2xl border border-border-soft bg-card p-8">
          <Text className="text-center text-base font-bold text-text">
            {t('notFound.cards.title')}
          </Text>
          <Text className="mt-1.5 text-center text-sm text-text-muted">
            {t('notFound.cards.description')}
          </Text>
        </View>
      ) : !ready ? (
        <View className="items-center py-12">
          <Spinner size="md" />
        </View>
      ) : (
        <EditCardForm
          cardId={id}
          card={card}
          institutions={institutionsQ.data}
          networks={networksQ.data}
          todayISO={formatDateISO(getTodayAR())}
          onDirtyChange={(d) => {
            dirtyRef.current = d
          }}
        />
      )}
    </FormScreen>
  )
}
